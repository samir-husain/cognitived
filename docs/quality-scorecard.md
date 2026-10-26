# Quality scorecard

Measured on the student web app unless stated. "Before" is the state when I took ownership of both frontends (early Oct 2026); "after" is 24 Oct 2026.

| Measure | Before | After | How it was measured |
|---|---|---|---|
| Unit tests (student app) | 458 | **~1,560** | Jest, single run in the commit gate |
| Line coverage (student app) | 46% | **76%** | Jest coverage report |
| Unit tests (admin panel) | 235 | **~360** | Jest |
| ESLint | warnings allowed | **0 warnings, enforced** | `react-app` config, commit gate |
| Lint rule suppressions | 62 | **19** | grep over `eslint-disable` |
| Type-checked files | 0 | **110** | `// @ts-check` + JSDoc, `tsc` in the gate |
| End-to-end journeys | 0 | **35** (+14 parent) | Playwright against the deployed staging site |
| Accessibility | 37 axe issues | **0 violations on 20 screens** | axe-core, permanent e2e spec |
| Admin first JS download | 869 kB gz | **125 kB gz** | Vite build output |
| Main stylesheet | 940 kB | **735 kB** | build output, Bootstrap trimmed and self-hosted |
| Landing page main-thread JS (4× CPU) | ~1.1 s | **~0.5 s** | Chrome DevTools, throttled |
| Build tool | Create React App 5 | **Vite 6** | 75 of 76 chunks byte-identical at migration |
| Security headers | none | **HSTS, nosniff, Referrer-Policy, X-Frame-Options, CSP enforced** | staging and production mirror; e2e suite clean under CSP |
| Known double charges | occasional reports | **0 since the payment rebuild** | pending-payment reconciliation, bug tests PAY-19 to PAY-24 |

## Lighthouse, public landing page (production, 26 Oct 2026)

| Preset | Performance | Accessibility | Best practices | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| Mobile (default throttling) | 74 | 100 | 96 | 100 | 5.4 s | 80 ms | 0.02 |
| Desktop | 88 | 100 | 96 | 100 | 2.0 s | 0 ms | 0.01 |

Honest reading: accessibility, best practices and SEO are where the work above put them. Mobile performance is held back by the landing page's largest contentful paint, a hero poster behind an 8.5 MB background video on a page served by a separate web server that has not had the HTTP/2, caching and header work yet. The measured fix order is: serve the poster first and lazy-load the video, then apply the same nginx profile as the app. That is the next item on the list, not a hidden one.

## How the numbers stay honest

- They come from tools in the repository (`npm run test:ci`, `npm run test:coverage`, `npm run lint`, `npm run typecheck`, `npm run e2e`), not from a slide.
- Each bug fix carries a test named after its bug-report ID; each decision not to fix is written down with the reason.
- When a change could not be verified live (an outage, a missing CDN file), the note says so instead of claiming it.
