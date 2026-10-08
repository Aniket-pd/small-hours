# Validation and handoff

Performed on 2026-10-08, macOS arm64, Node v24.8.0. These are recorded checks of the local prototype. Publishing the source does not itself constitute a contest submission or paid assignment.

## Observed passing checks

| Check | Evidence | Result |
| --- | --- | --- |
| Planner, model helpers, HTTP, discovery adapter | [`tests.txt`](../evidence/tests.txt), `npm test` | **33 passed**, 0 failed/skipped |
| Actual q8 CPU inference | [`model-spike.json`](../evidence/model-spike.json), `npm run verify:model` | 384 dimensions, normalized vectors, semantic paraphrase ranked correctly, 256-token truncation |
| Runtime network calls | Same model spike | `globalThis.fetch` blocked before runtime import; **0 attempted fetches** |
| Full curated corpus | [`model-corpus.json`](../evidence/model-corpus.json) | Actual rankings for three synthetic queries |
| Live loopback app | [`api-smoke.json`](../evidence/api-smoke.json), `npm run verify:api` while server runs | Model-ready status, three real semantic plans, constraints and time totals, static assets served |
| Source checks | `node --check public/app.js`, HTML/source review | Syntax, referenced element IDs, labels, form/API contract reviewed |
| Real headless Chrome | [`browser/results.json`](../evidence/browser/results.json), `scripts/verify-browser.mjs` | **21 passed**, zero page errors and zero external page requests |
| Actual demo recording | [`small-hours-local-demo.mp4`](../evidence/browser/small-hours-local-demo.mp4), [`demo-video.json`](../evidence/browser/demo-video.json) | 9.52-second real local-model flow, H.264, 1280×900, no audio |
| Dependency audit | Installation result recorded in [MODEL-SPIKE.md](MODEL-SPIKE.md) | Final locked installation reported 0 vulnerabilities on this date |

The fetch check is an application-level assertion, not a packet capture or a guarantee about every possible operating-system network call. Runtime code also disables remote model loading and selects local CPU files. All verification prompts are synthetic; no personal user data was uploaded. In the recorded API run, three selected plans were wildlife watching, a seated color observation, and noticing pavement patterns; measured ranking times were 7–34 ms. These are observations on this machine, not performance promises.

The tests exercise firm filters before semantic ranking, including green versus city-only settings, complete 5–60-minute budgets, actual corpus combinations, explicit fixture labels, model error propagation, request validation and limits, foreign Origin/Host rejection, concurrent-request bounds, UTF-8 chunk handling, malformed URLs, and disabled/mocked discovery. Review found and corrected a conflicting out-and-back template timing instruction.

## Completed browser verification

The initial desktop-control route was blocked by the locked Mac. The subsequently authorized automated-testing route used the existing Playwright 1.58.2 installation with a separate **headless Chrome 154.0.8037.98** session. It did not unlock the desktop, change OS settings, attach to personal tabs, or reuse a personal browser profile. Tests allowed only the two local app origins and observed zero external page requests.

The 21 checks cover real model readiness and plan rendering, empty and whitespace input, alternatives, actual text downloads and their contents, dialog keyboard behavior and Escape focus restoration, print CSS, stale-plan invalidation, combined constraints, computed text contrast, radio-key navigation and accessible labels/announcements, responsive layouts at 1440/768/390/320 pixels, no browser storage, and fixture labels in the interface and exported file. No-match and transport-failure UI tests use explicitly mocked local responses; these are not claimed as real model outcomes. Every supported combination examined in the curated corpus has at least two options.

Two small supporting-label contrast issues were corrected. Browser-computed contrast now exceeds 4.5:1 for both labels. Native Chrome dialogs permit focus to move through browser chrome (reported as BODY); the test verifies that underlying page controls do not receive focus. The initial stricter harness assertion was adjusted to match this native behavior.

The [desktop plan](../evidence/browser/small-hours-desktop-plan.png), [mobile plan](../evidence/browser/small-hours-mobile-plan.png), and [pocket view](../evidence/browser/small-hours-pocket-plan.png) screenshots were visually inspected. Full-page responsive captures are also preserved. The [local demo](../evidence/browser/small-hours-local-demo.mp4) records actual synthetic input, local inference, a pocket view, and alternative selection. Playwright recorded the original WebM; installed FFmpeg converted it to H.264 MP4 without changing the app interaction. It is an indoor software demo, not an outdoor field test or public submission.

## Remaining limits

- Physical-device browsers, screen-reader use, a full accessibility audit, and actual printer output. Browser print CSS was checked; no physical printing occurred.
- Linux execution; upstream documents Linux CPU support, but this run was on macOS only.
- Real outdoor usability or a human trial. No claim is made that anyone took these plans outside.
- General free-text constraint understanding. Recognized phrases supplement explicit controls; semantic similarity alone does not enforce arbitrary negation or requirements.

## Reproduce browser checks

The application itself does not depend on Playwright. With an existing trusted Playwright installation and Chrome, run:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/verify-browser.mjs
```

Alternatively install Playwright in a separate testing environment and make its module available. `CHROME_EXECUTABLE` can name an existing browser binary; otherwise the script uses the installed Chrome channel. Tests start and close private servers on ports 4327 and 4328, require the model to be installed, capture their own screenshots/video, and block remote page requests. They do not install a browser or contact third-party websites. The ordinary preview server remains local only and can be stopped with Ctrl+C.

## Contest preparation boundary

The verified deadline is October 11, 2026, 23:59 PDT / October 12, 06:59 UTC / 12:29 IST; see [official-source notes](RULES.md). Eligibility, a public project license/repository, demo video publication, and DEV publication remain future decisions requiring the user's authorization. A video demo is allowed; a hosted app is not necessary. No account creation, registration, terms acceptance, external API spending, submission, or public hosting happened. SerpApi remains disabled and is not claimed as partner use. Preserve [AI and third-party attribution](ATTRIBUTION.md) and [third-party notices](THIRD-PARTY-NOTICES.md) in any future write-up.
