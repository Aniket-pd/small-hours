import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { start } from '../src/server.mjs';

// Optional testing tool, not an application dependency. Use an existing trusted
// Playwright install with PLAYWRIGHT_MODULE, or install Playwright locally.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const output = resolve(import.meta.dirname, '../evidence/browser');
await mkdir(output, { recursive: true });
const results = [], pageErrors = [], blockedExternalRequests = [];
const origin = 'http://127.0.0.1:4327', fixtureOrigin = 'http://127.0.0.1:4328';
let browser, server, fixtureServer;
function passed(name, details = {}) { results.push({ name, passed: true, ...details }); console.log(`PASS ${name}`); }
async function guard(context) {
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (![origin, fixtureOrigin].includes(url.origin)) {
      blockedExternalRequests.push(url.origin); return route.abort();
    }
    return route.continue();
  });
  context.on('page', page => page.on('pageerror', e => pageErrors.push(String(e))));
}
async function requestPlan(page, { query = 'I want to quietly observe feathered wildlife while seated', minutes = 15, movement = 'seated', setting = 'green', daylight = true, company = 'solo' } = {}) {
  await page.getByLabel('Tell us what sounds good').fill(query);
  await page.locator(`input[name="minutes"][value="${minutes}"]`).check();
  await page.getByLabel('Pace', { exact: true }).selectOption(movement);
  await page.getByLabel('Surroundings').selectOption(setting);
  await page.getByLabel('Company', { exact: true }).selectOption(company);
  await page.getByLabel('It’s daylight').setChecked(daylight);
  const responsePromise = page.waitForResponse(r => r.url() === `${origin}/api/plan` && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Find my small adventure', exact: true }).click();
  const response = await responsePromise;
  const data = await response.json();
  assert.equal(response.status(), 200);
  await page.locator('#plan-title').waitFor({ state: 'visible' });
  return data;
}
async function assertNoOverflow(page, width) {
  const dimensions = await page.evaluate(() => ({ inner: innerWidth, doc: document.documentElement.scrollWidth }));
  assert.ok(dimensions.doc <= dimensions.inner + 1, `${width}px layout overflows: ${JSON.stringify(dimensions)}`);
  return dimensions;
}

try {
  server = await start({ fixture: false, port: 4327 });
  fixtureServer = await start({ fixture: true, port: 4328 });
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : { channel: 'chrome' }) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1, reducedMotion: 'reduce', acceptDownloads: true });
  await guard(context);
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Find my small adventure', exact: true }).waitFor();
  assert.equal(await page.locator('#runtime-label').textContent(), 'Local AI · CPU · Offline');
  assert.ok(await page.locator('#empty-plan').isVisible());
  assert.ok(await page.locator('#fixture-notice').isHidden());
  await page.screenshot({ path: resolve(output, 'small-hours-desktop-start.png'), fullPage: true });
  passed('actual local-model readiness and honest empty state');

  let planRequestCount = 0;
  page.on('request', r => { if (r.url().endsWith('/api/plan')) planRequestCount += 1; });
  await page.getByRole('button', { name: 'Find my small adventure', exact: true }).click();
  assert.equal(await page.locator('#query').evaluate(el => el.validity.valueMissing), true);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'query');
  assert.equal(planRequestCount, 0);
  passed('empty input uses native validation without a planner request');
  await page.getByLabel('Tell us what sounds good').fill('   ');
  await page.getByRole('button', { name: 'Find my small adventure', exact: true }).click();
  assert.equal(await page.locator('#query').getAttribute('aria-invalid'), 'true');
  assert.match(await page.locator('#form-error').textContent(), /at least 3 characters/);
  assert.equal(planRequestCount, 0);
  passed('whitespace input announces an error and preserves query focus');

  const result = await requestPlan(page);
  assert.equal(result.mode, 'local-model');
  assert.equal(result.plan.id, 'wildlife-watch');
  assert.equal(await page.locator('#plan-title').textContent(), result.plan.title);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'result-card');
  assert.equal(result.plan.steps.reduce((sum, s) => sum + s.minutes, 0), 15);
  assert.equal(await page.locator('#result-card .timeline li').count(), 3);
  assert.match(await page.locator('#result-card .conditions-note').textContent(), /daylight.*green space/);
  await page.screenshot({ path: resolve(output, 'small-hours-desktop-plan.png'), fullPage: true });
  passed('real MiniLM plan appears with constraints, budget, timeline and focus', { chosen: result.plan.id });

  const nextTitle = await page.locator('.alternative-title').first().textContent();
  await page.locator('.alternative-button').first().click();
  assert.equal(await page.locator('#plan-title').textContent(), nextTitle);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'result-card');
  passed('alternative selection replaces the plan and moves focus');
  const exportPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download this plan as a text file' }).click();
  const download = await exportPromise;
  const exportPath = resolve(output, 'verified-pocket-plan.txt');
  await download.saveAs(exportPath);
  const exported = await readFile(exportPath, 'utf8');
  assert.ok(exported.includes(nextTitle));
  assert.match(exported, /15 minutes, including your return/);
  assert.match(exported, /Local AI · CPU · Offline/);
  assert.ok(!exported.includes('Fixture demo'));
  for (const title of await page.locator('#result-card .timeline h4').allTextContents()) assert.ok(exported.includes(title));
  passed('real text download matches the selected plan and model provenance');

  await page.getByRole('button', { name: 'Take your pocket plan' }).click();
  assert.ok(await page.getByRole('dialog').isVisible());
  assert.equal(await page.locator('#pocket-title').textContent(), nextTitle);
  const focusSequence = [];
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => ({ tag: document.activeElement.tagName, id: document.activeElement.id, withinDialog: document.querySelector('#pocket-dialog').contains(document.activeElement) }));
    focusSequence.push(focus);
    // Native Chrome dialogs allow focus to browser chrome (reported as BODY),
    // but must never move into an actionable control on the inert page.
    assert.ok(focus.withinDialog || focus.tag === 'BODY', JSON.stringify(focus));
  }
  await page.screenshot({ path: resolve(output, 'small-hours-pocket-plan.png') });
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('.site-shell').evaluate(el => getComputedStyle(el).display), 'none');
  assert.notEqual(await page.locator('#pocket-dialog').evaluate(el => getComputedStyle(el).display), 'none');
  assert.equal(await page.locator('.pocket-actions').evaluate(el => getComputedStyle(el).display), 'none');
  await page.emulateMedia({ media: 'screen' });
  await page.keyboard.press('Escape');
  assert.ok(await page.getByRole('dialog').isHidden());
  assert.match(await page.evaluate(() => document.activeElement.textContent), /Take your pocket plan/);
  passed('native pocket dialog prevents focus entering underlying controls, Escape restores it, print CSS isolates the plan', { focusSequence });

  await page.getByLabel('Pace', { exact: true }).selectOption('gentle');
  assert.ok(await page.locator('#plan-output').isHidden());
  assert.ok(await page.locator('#empty-plan').isVisible());
  passed('editing constraints invalidates old plan and export controls');

  const strict = await requestPlan(page, { query: 'A quiet break, no walking, alone after dark, no parks', minutes: 5, movement: 'any', setting: 'urban', daylight: false, company: 'together' });
  for (const plan of [strict.plan, ...strict.alternatives]) {
    assert.equal(plan.movement, 'seated');
    assert.equal(plan.totalMinutes, 5);
    assert.deepEqual(plan.requirements, []);
  }
  assert.match(await page.locator('.applied-note').textContent(), /Seated only.*Solo.*No daylight.*No green space/);
  passed('combined no-walking, solo, dark, urban and 5-minute limits hold in live inference');

  const contrast = await page.evaluate(() => {
    const luminance = rgb => {
      const values = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => { x /= 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; });
      return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
    };
    return ['.runtime-status', '.applied-note'].map(selector => {
      const styles = getComputedStyle(document.querySelector(selector));
      const fg = luminance(styles.color), bg = luminance(styles.backgroundColor);
      return { selector, ratio: (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05) };
    });
  });
  for (const item of contrast) assert.ok(item.ratio >= 4.5, JSON.stringify(item));
  passed('small runtime and constraint labels meet 4.5:1 contrast in computed browser styles', { contrast });

  const originalBudget = await page.locator('input[name="minutes"]:checked').inputValue();
  await page.locator('input[name="minutes"]:checked').focus();
  await page.keyboard.press('ArrowRight');
  assert.notEqual(await page.locator('input[name="minutes"]:checked').inputValue(), originalBudget);
  assert.ok(await page.locator('#plan-output').isHidden());
  assert.equal(await page.locator('#plan-announcement').getAttribute('aria-live'), 'polite');
  assert.equal(await page.locator('#form-error').getAttribute('role'), 'alert');
  assert.ok((await page.locator('body').ariaSnapshot()).includes('Tell us what sounds good'));
  passed('keyboard radios, named fields, result announcements and error semantics work');

  // No supported combination is empty in the curated corpus. This is an
  // explicitly mocked server-error branch; it is not a claimed model outcome.
  await page.route('**/api/plan', route => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'No curated activity fits these options. Try a little more time or change one option.' }) }));
  await page.getByRole('button', { name: 'Find my small adventure', exact: true }).click();
  await page.getByRole('alert').waitFor({ state: 'visible' });
  assert.match(await page.getByRole('alert').textContent(), /No curated activity fits/);
  assert.ok(await page.locator('#plan-output').isHidden());
  assert.ok(await page.locator('#submit-button').isEnabled());
  await page.screenshot({ path: resolve(output, 'small-hours-no-match-fixture.png'), fullPage: true });
  await page.unroute('**/api/plan');
  passed('mocked no-match response shows an honest error and restores controls');

  await page.route('**/api/plan', route => route.abort('failed'));
  await page.getByRole('button', { name: 'Find my small adventure', exact: true }).click();
  await page.getByRole('alert').waitFor({ state: 'visible' });
  assert.match(await page.getByRole('alert').textContent(), /Could not reach/);
  assert.ok(await page.locator('#submit-button').isEnabled());
  await page.unroute('**/api/plan');
  passed('mocked failed request returns a readable error and restores controls');

  await requestPlan(page);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await assertNoOverflow(page, width);
    // Reset scroll before full-page capture so off-viewport fixed elements
    // (e.g. the hidden skip link) are not captured at the previous scroll offset.
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
    await page.screenshot({ path: resolve(output, `small-hours-responsive-${width}.png`), fullPage: true });
    if (width === 390) await page.locator('#plan-column').screenshot({ path: resolve(output, 'small-hours-mobile-plan.png') });
    await page.getByRole('button', { name: 'Take your pocket plan' }).click();
    const rect = await page.getByRole('dialog').boundingBox();
    assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1);
    await page.keyboard.press('Escape');
    passed(`responsive ${width}px layout and pocket dialog stay within viewport`);
  }
  const storage = await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length, cookie: document.cookie }));
  assert.deepEqual(storage, { local: 0, session: 0, cookie: '' });
  assert.equal((await context.cookies()).length, 0);
  passed('planner leaves no cookies, localStorage or sessionStorage');
  await context.close();

  const fixtureContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await guard(fixtureContext);
  const fixturePage = await fixtureContext.newPage();
  await fixturePage.goto(fixtureOrigin, { waitUntil: 'networkidle' });
  assert.equal(await fixturePage.locator('#runtime-label').textContent(), 'Fixture demo · no AI inference');
  assert.ok(await fixturePage.locator('#fixture-notice').isVisible());
  await fixturePage.getByLabel('Tell us what sounds good').fill('A quiet outdoor color study');
  await fixturePage.getByRole('button', { name: 'Find my small adventure', exact: true }).click();
  await fixturePage.locator('#plan-title').waitFor({ state: 'visible' });
  assert.match(await fixturePage.locator('#ranking-note').textContent(), /Fixture demo.*no AI inference/);
  const fixtureDownloadPromise = fixturePage.waitForEvent('download');
  await fixturePage.getByRole('button', { name: 'Download this plan as a text file' }).click();
  const fixtureDownload = await fixtureDownloadPromise;
  await fixtureDownload.saveAs(resolve(output, 'verified-fixture-plan.txt'));
  assert.match(await readFile(resolve(output, 'verified-fixture-plan.txt'), 'utf8'), /Fixture demo · no AI inference/);
  await fixturePage.screenshot({ path: resolve(output, 'small-hours-fixture-mode.png'), fullPage: true });
  passed('fixture mode stays honestly labeled in interface, result and actual download');
  await fixtureContext.close();

  // Short actual local screen recording. The deliberate one-second pauses make
  // the real interactions readable; nothing is staged as a field test.
  const videoContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce', recordVideo: { dir: output, size: { width: 1280, height: 900 } } });
  await guard(videoContext);
  const demo = await videoContext.newPage();
  await demo.goto(origin, { waitUntil: 'networkidle' });
  await demo.waitForTimeout(1400);
  await demo.locator('#planner').scrollIntoViewIfNeeded();
  await demo.getByLabel('Tell us what sounds good').fill('I want to quietly observe feathered wildlife while seated');
  await demo.getByLabel('Pace', { exact: true }).selectOption('seated');
  await demo.getByLabel('Surroundings').selectOption('green');
  await demo.waitForTimeout(1000);
  await demo.getByRole('button', { name: 'Find my small adventure', exact: true }).click();
  await demo.locator('#plan-title').waitFor({ state: 'visible' });
  await demo.locator('#plan-column').scrollIntoViewIfNeeded();
  await demo.waitForTimeout(2200);
  await demo.getByRole('button', { name: 'Take your pocket plan' }).click();
  await demo.waitForTimeout(2400);
  await demo.keyboard.press('Escape');
  await demo.locator('.alternative-button').first().click();
  await demo.waitForTimeout(1800);
  const video = demo.video();
  await videoContext.close();
  await rename(await video.path(), resolve(output, 'small-hours-local-demo.webm'));
  passed('short actual local-model demo recording saved without desktop access');

  assert.equal(pageErrors.length, 0, pageErrors.join('\n'));
  assert.equal(blockedExternalRequests.length, 0, blockedExternalRequests.join('\n'));
  passed('zero page errors and zero external page requests');
  const report = { verifiedAt: new Date().toISOString(), result: 'PASS', browser: browser.version(), testingTool: 'Playwright 1.58.2 (existing local installation)', localModel: true, desktopAccess: false, results, pageErrors, blockedExternalRequests, limitations: ['No physical-device or screen-reader trial.', 'No outdoor field test.', 'No-match and network-error UI branches use explicit local mocks.', 'Recording demonstrates local app use only; no hosted or submitted entry.'] };
  await writeFile(resolve(output, 'results.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ result: report.result, checks: results.length, browser: report.browser, pageErrors, blockedExternalRequests }));
} catch (error) {
  await writeFile(resolve(output, 'failure.json'), `${JSON.stringify({ error: String(error), completed: results, pageErrors, blockedExternalRequests }, null, 2)}\n`);
  throw error;
} finally {
  await browser?.close();
  await Promise.all([server, fixtureServer].filter(Boolean).map(s => new Promise(resolveClose => s.close(resolveClose))));
}
