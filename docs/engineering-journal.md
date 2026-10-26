# Engineering journal, Sep to Oct 2026

Dated notes from my own log of the work on the CognitivED web app and admin panel. Numbers are from the test runners, bundlers and audit tools at the time. Internal hosts, people and account details are left out.

## 29 Sep: admin panel, the whole pipeline

Ran the same process I use on the student app over the admin panel: audit, fix batches with tests, dead-code and lint sweep, restructure into `app/ api/ config/ features/ shared/` (204 version-control moves with import rewriting by script), then performance.

- Lint to 0 warnings; 8 unused packages and the dead files removed.
- Lazy routes, one global stylesheet order, Shaka loaded on demand: first JavaScript download **869 kB → 125 kB gzipped**.
- All 17 screens verified on the staging deployment afterwards.
- Lesson: files were CRLF and Git Bash `sed -i` silently converts them; every edit is now checked against the repository copy before commit.

## 6 Oct: four audits, eight fix areas

Read-only audits of user-visible quality and of every API contract against the backend, then eight fix areas across both apps.

- Student app **86 suites / 458 tests**; admin **39 suites / 235 tests**; both lint-clean with a new `no-console` rule (123 stray `console.log` removed from the admin).
- A 50-item backend fix list, security first, handed to the backend team.
- Kept on purpose, documented as decisions rather than bugs: production chapter gating by name, the released-course list, the fallback chat contacts.
- Lesson: an automated edit inside a commented-out CSS block broke the build with a stray `*/`. Jest does not parse CSS, so every changed stylesheet is now parsed with PostCSS before a batch is called done.

## 7 to 9 Oct: the "no hidden pain" plan, five phases

1. **Assessment grading** (5 bugs): time-over keeps the latest answer; verified with a timed quiz on staging. 90 suites / 472 tests.
2. **Payments**: the gateway script is loaded *before* order creation with a timeout and held in a ref; a failure reports `PORTAL_CLOSED`; the amount check tolerates the service's per-cart rounding (one paisa per course); the gateway charge feeds the result screens. 91 / 488.
3. **Sessions**: cross-tab user change detection (announce via storage, reload on a different user, focus re-check once a minute); the encryption key loader reloads once on a stale chunk; post-login failures end the session cleanly; the expiry screen became an overlay so routes stay mounted. 94 / 506.
4. **Performance**: a single playback clock instead of per-second re-renders, the three.js avatar lazy-loaded into its own chunk, KaTeX rendered once per text, memoised chat bubbles, the home page dropped its whole-store subscription. 97 / 512.
5. **Housekeeping**: axios upgraded (high advisory), `react-is` aligned with React 18, test libraries moved to devDependencies, 14 dead files and 3 images deleted with approval, `uuid` declared explicitly after an upgrade exposed a transitive dependency.

Live checks of every phase in a real browser against staging, including a test-mode purchase end to end. One fix came out of that session alone: a route-frame animation with `fill: both` kept a stacking context that trapped fixed modals under the footer.

## 12 to 13 Oct: cleanup rounds

- Student app: the AI tutor became one hook plus pure stream helpers; icon `div`s made keyboard-accessible through a shared `buttonProps` helper; 679 tests; checked live (ask, re-read, stop, lesson switch).
- Admin: tests **253 → 360**, hook-rule suppressions 28 → 12, 763 lines of dead code removed, the fill-in-the-blank question editor split into presets and validation modules, `useEscapeKey` for dialogs. Decision recorded: an unanswered *add* is not auto-retried (it may have been saved and the backend accepts duplicate names); only edits are retried.
- Deployed and smoke-tested read-only on the staging admin.

## 14 Oct: from 685 to 1,468 tests in one round

Goal set that day: the student app to "9.5 out of 10". The big controllers were split into hooks and pure utilities: video player 1,451 → 341 lines, assessment 1,527 → 918, course dashboard 930 → 233.

- Tests **685 → 1,468**, line coverage **46% → 76%**, lint suppressions 62 → 45.
- Bugs found while splitting: the success page cleared a *newer* pending-payment record; a double progress update on first open; an effect loop on the course page when there is no user; a hint control that needed two clicks; the saved playback speed reset to 1x by the player load.
- Quiz page, fill-in-the-blank editor (caret placement next to a trailing formula) and course dashboard verified live after staging recovered.
- Quiz results surfaced in the insights dashboard as "Quiz Details".

## 15 Oct: Create React App → Vite, type checking, speed

- Migration to Vite 6 with identical npm script names and output folder; Jest 29 kept on its own config; `react-scripts` removed; lint suppressions 45 → 19. Proof: the Vite build was compared element by element against the CRA build on five public pages, and with hashes masked **75 of 76 chunks were byte-identical**.
- Type checking without a TypeScript rewrite: `// @ts-check` plus JSDoc over the API layer, payments utilities and money formatting, enforced as step 4 of the commit gate.
- Playwright end-to-end suite started: 14 journeys against the deployed staging site from a saved session (automation never types a password).
- Speed: Bootstrap and the Montserrat font self-hosted and first in the cascade; nginx gained HTTP/2 and long cache lifetimes for images and fonts with a rollback-safe change; scroll animations moved off the app shell, cutting main-thread JS on the landing page from about 1.1 s to 0.5 s at 4× CPU throttling. A prefetch experiment for the hero poster gave no measurable gain and was removed rather than kept "just in case".

## 16 Oct: accessibility and library upgrades

- axe: **37 issues → 0 violations on 20 pages**. 17 colours darkened for 4.5:1 contrast (same hue), about 130 clickable non-buttons made real buttons or links, the equation keyboard opener made focusable, unavailable cards marked `aria-disabled`. A permanent accessibility spec (21 checks) joined the e2e suite.
- React Router 6 → 7 with no code change (Jest needed `TextEncoder`); KaTeX 0.16 → 0.19 with a single shared copy enforced through package overrides, verified by rendering 30 expressions pixel-identical before and after. 35 of 35 e2e journeys green on the local build.

## 21 to 24 Oct: parent portal merge and security headers

- Another developer's parent-portal module (5 screens) merged: 11 API routes wired, our earlier fixes his copy had dropped restored, invented sample data removed, type checking on all 7 controllers, axe at zero. Verified live with real data; 14 parent journeys added to e2e with their own test account.
- Security headers (HSTS, nosniff, Referrer-Policy, X-Frame-Options) and a Content-Security-Policy rolled out on staging and the production mirror: Report-Only first, then enforced after the full e2e suite ran with zero CSP violations. The policy lives in the repository next to the tests that exercise it.

## What stays constant

- Every commit passes lint (zero warnings), type check, the full unit suite and a production build before it lands; a scripted gate refuses otherwise.
- Bug tests are named after the bug report that found them, so the history explains itself.
- No fixed sleeps in tests: await the promise, `waitFor` the visible result, or settle the mock API and assert nothing changed.
- Verify in a real browser against staging before calling a change done, then write down what was verified and what was not.
