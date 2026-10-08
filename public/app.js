'use strict';

const byId = (id) => document.getElementById(id);
const form = byId('planner-form');
const submitButton = byId('submit-button');
const submitLabel = byId('submit-label');
const statusElement = byId('runtime-status');
const errorElement = byId('form-error');
const pocketDialog = byId('pocket-dialog');
let runtime = null;
let result = null;
let selectedPlan = null;
let isPending = false;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = String(text);
  return element;
}

function showError(message) {
  errorElement.textContent = message;
  errorElement.hidden = !message;
}

function isLocalReady(status) {
  return status?.mode === 'local-model' && status.ready === true;
}

function modeText(mode) {
  return mode === 'local-model' ? 'Local AI · CPU · Offline' : 'Fixture demo · no AI inference';
}

async function fetchJson(url, options) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    let body;
    try { body = await response.json(); }
    catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new Error('The local server returned an unreadable response. Please try again.');
    }
    if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'The local server could not complete this request. Please try again.');
    return body;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The local server took too long to respond. Please retry.');
    if (error instanceof TypeError) throw new Error('Could not reach the local server. Check that it is running and retry.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function checkStatus() {
  submitButton.disabled = true;
  byId('retry-status').hidden = true;
  byId('runtime-label').textContent = 'Checking local model…';
  statusElement.dataset.mode = 'loading';
  showError('');
  try {
    const status = await fetchJson('/api/status');
    runtime = status;
    if (!['local-model', 'fixture'].includes(status.mode)) throw new Error('The local server reported an unknown mode. Restart the server and try again.');
    byId('fixture-notice').hidden = status.mode !== 'fixture';
    if (!status.ready) throw new Error(status.error || 'The local model is not ready yet. Check the server setup, then retry.');
    statusElement.dataset.mode = status.mode;
    byId('runtime-label').textContent = isLocalReady(status) ? 'Local AI · CPU · Offline' : 'Fixture demo · no AI inference';
    submitButton.disabled = false;
  } catch (error) {
    runtime = null;
    statusElement.dataset.mode = 'error';
    byId('runtime-label').textContent = 'Local planner unavailable';
    showError(error.message || 'Could not reach the local server. Start it and retry.');
    byId('retry-status').hidden = false;
  }
}

function setPending(pending) {
  isPending = pending;
  submitButton.disabled = pending || !runtime?.ready;
  submitLabel.textContent = pending ? 'Finding your small adventure…' : 'Find my small adventure';
  form.classList.toggle('is-loading', pending);
  form.setAttribute('aria-busy', String(pending));
  form.querySelectorAll('input, select, textarea').forEach((control) => { control.disabled = pending; });
}

function validatePlan(plan) {
  return plan && typeof plan.id === 'string' && typeof plan.title === 'string' &&
    typeof plan.description === 'string' && Number.isFinite(plan.totalMinutes) &&
    Array.isArray(plan.steps) && plan.steps.length > 0 && plan.steps.every((step) =>
      typeof step.title === 'string' && typeof step.detail === 'string' && Number.isFinite(step.minutes));
}

function createTimeline(plan) {
  const list = node('ol', 'timeline');
  plan.steps.forEach((step, index) => {
    const item = node('li');
    const marker = node('span', 'timeline-marker', String(index + 1).padStart(2, '0'));
    marker.setAttribute('aria-hidden', 'true');
    const copy = node('div');
    const header = node('div', 'timeline-header');
    header.append(node('h4', '', step.title), node('span', 'step-duration', `${step.minutes} min`));
    copy.append(header, node('p', '', step.detail));
    item.append(marker, copy);
    list.append(item);
  });
  return list;
}

function createTakeaway(plan) {
  const section = node('div', 'takeaway');
  section.append(node('p', 'takeaway-label', 'TAKE A LITTLE SOMETHING BACK'), node('p', '', plan.takeaway || 'One small thing you noticed is enough.'));
  return section;
}

function equipmentText(plan) {
  const equipment = Array.isArray(plan.equipment) ? plan.equipment.filter((item) => typeof item === 'string') : [];
  return equipment.length ? `Bring: ${equipment.join(', ')}.` : 'No special equipment needed.';
}

function requirementsText(plan) {
  const labels = { daylight: 'daylight', 'green-space': 'a reachable green space', companion: 'someone to join you' };
  const requirements = Array.isArray(plan.requirements) ? plan.requirements.filter((item) => typeof item === 'string') : [];
  return requirements.length ? `This idea needs ${requirements.map((item) => labels[item] || item.replace(/-/g, ' ')).join(' and ')}.` : '';
}

function selectPlan(plan, moveFocus = false) {
  selectedPlan = plan;
  const card = byId('result-card');
  card.replaceChildren();
  const topline = node('div', 'plan-topline');
  topline.append(node('span', 'plan-kicker', 'YOUR SMALL ADVENTURE'), node('span', 'duration-badge', `${plan.totalMinutes} minutes · return included`));
  const title = node('h3', '', plan.title);
  title.id = 'plan-title';
  const tags = node('div', 'plan-tags');
  (Array.isArray(plan.tags) ? plan.tags : []).filter((tag) => typeof tag === 'string').slice(0, 5).forEach((tag) => tags.append(node('span', 'plan-tag', tag)));
  const actions = node('div', 'plan-actions');
  const pocketButton = node('button', 'primary-button', 'Take your pocket plan');
  pocketButton.type = 'button';
  pocketButton.append(node('span', '', '↗'));
  pocketButton.addEventListener('click', openPocket);
  const downloadButton = node('button', 'secondary-button download-button', '↓');
  downloadButton.type = 'button';
  downloadButton.setAttribute('aria-label', 'Download this plan as a text file');
  downloadButton.title = 'Download text';
  downloadButton.addEventListener('click', downloadPlan);
  actions.append(pocketButton, downloadButton);
  card.append(topline, title, node('p', 'plan-description', plan.description));
  if (tags.childElementCount) card.append(tags);
  card.append(createTimeline(plan), createTakeaway(plan), node('p', 'equipment-note', equipmentText(plan)));
  const conditions = requirementsText(plan);
  if (conditions) card.append(node('p', 'conditions-note', conditions));
  const applied = result.constraints?.applied;
  if (Array.isArray(applied) && applied.length) card.append(node('p', 'applied-note', applied.filter((item) => typeof item === 'string').join(' · ')));
  card.append(actions);
  const alternatives = [result.plan, ...(result.alternatives || [])].filter((candidate) => candidate.id !== plan.id && validatePlan(candidate));
  const alternativeContainer = byId('alternatives');
  alternativeContainer.replaceChildren();
  alternatives.slice(0, 2).forEach((alternative) => {
    const button = node('button', 'alternative-button');
    button.type = 'button';
    button.append(node('span', 'alternative-title', alternative.title), node('span', 'alternative-meta', `${alternative.totalMinutes} minutes · View plan →`));
    button.addEventListener('click', () => selectPlan(alternative, true));
    alternativeContainer.append(button);
  });
  byId('alternatives-section').hidden = !alternativeContainer.childElementCount;
  const provenance = result.mode === 'local-model'
    ? 'Ranked on this device with the local open-source model. Steps come from a curated activity guide.'
    : 'Fixture demo: deterministic ranking, no AI inference. Steps come from a curated activity guide.';
  const explanation = typeof plan.reason === 'string' ? ` ${plan.reason}` : '';
  byId('ranking-note').textContent = (typeof result.note === 'string' ? result.note : provenance) + explanation;
  byId('empty-plan').hidden = true;
  byId('plan-output').hidden = false;
  byId('plan-announcement').textContent = `${plan.title}. Your ${plan.totalMinutes}-minute plan is ready. ${modeText(result.mode)}.`;
  if (moveFocus) card.focus({ preventScroll: true });
}

function openPocket() {
  if (!selectedPlan) return;
  const content = byId('pocket-content');
  content.replaceChildren();
  const title = node('h2', '', selectedPlan.title);
  title.id = 'pocket-title';
  content.append(title, node('span', 'duration-badge', `${selectedPlan.totalMinutes} minutes · return included`), node('p', 'plan-description', selectedPlan.description), createTimeline(selectedPlan), createTakeaway(selectedPlan), node('p', 'equipment-note', equipmentText(selectedPlan)), node('p', 'conditions-note', requirementsText(selectedPlan)), node('p', 'pocket-mode', modeText(result.mode)));
  pocketDialog.showModal();
}

function downloadPlan() {
  if (!selectedPlan) return;
  const plan = selectedPlan;
  const text = [
    'SMALL HOURS — A little time outside', '', plan.title,
    `${plan.totalMinutes} minutes, including your return`, '', plan.description, '',
    ...plan.steps.flatMap((step, index) => [`${index + 1}. ${step.title} (${step.minutes} min)`, step.detail, '']),
    'Take a little something back', plan.takeaway || 'One small thing you noticed is enough.', '',
    equipmentText(plan), requirementsText(plan), '',
    'Choose somewhere familiar and reachable. These are curated activity ideas, not verified venue listings.',
    'Use your judgment about access, weather, and surroundings. Leave time to return.', '',
    modeText(result.mode), 'Private local prototype. AI-assisted creation.',
  ].join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const anchor = node('a');
  anchor.href = url;
  anchor.download = `small-hours-${plan.id.replace(/[^a-z0-9-]/gi, '-').slice(0, 60)}.txt`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function invalidatePlan(message) {
  if (!result) return;
  result = null;
  selectedPlan = null;
  byId('plan-output').hidden = true;
  byId('empty-plan').hidden = false;
  byId('plan-announcement').textContent = message;
}

form.addEventListener('input', () => {
  invalidatePlan('Your preferences changed. Find a new adventure to use these limits.');
  showError('');
  byId('query').removeAttribute('aria-invalid');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (isPending || !runtime?.ready) return;
  showError('');
  invalidatePlan('Finding a fresh plan for your preferences.');
  byId('plan-announcement').textContent = 'Finding an activity that fits your time and preferences.';
  const data = new FormData(form);
  const request = {
    query: String(data.get('query') || '').trim(),
    minutes: Number(data.get('minutes')),
    movement: String(data.get('movement')),
    setting: String(data.get('setting')),
    daylight: data.has('daylight'),
    company: String(data.get('company')),
  };
  if (request.query.length < 3) {
    showError('Add at least 3 characters about what you feel like doing.');
    byId('query').setAttribute('aria-invalid', 'true');
    byId('query').focus();
    return;
  }
  setPending(true);
  try {
    const response = await fetchJson('/api/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
    if (!validatePlan(response.plan) || !['local-model', 'fixture'].includes(response.mode)) throw new Error('The local server returned an incomplete plan. Please try again.');
    result = response;
    byId('fixture-notice').hidden = response.mode !== 'fixture';
    statusElement.dataset.mode = response.mode;
    byId('runtime-label').textContent = modeText(response.mode);
    selectPlan(response.plan, true);
    if (window.matchMedia('(max-width: 760px)').matches) byId('plan-column').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  } catch (error) {
    showError(error.message || 'Could not create a plan. Please try again.');
    byId('plan-announcement').textContent = 'The plan could not be created. Check the error next to the form.';
  } finally {
    setPending(false);
  }
});

byId('retry-status').addEventListener('click', checkStatus);
byId('close-pocket').addEventListener('click', () => pocketDialog.close());
byId('download-pocket').addEventListener('click', downloadPlan);
byId('print-pocket').addEventListener('click', () => window.print());
pocketDialog.addEventListener('click', (event) => {
  if (event.target !== pocketDialog) return;
  const bounds = pocketDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) pocketDialog.close();
});
checkStatus();
