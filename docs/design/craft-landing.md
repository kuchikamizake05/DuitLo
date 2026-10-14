# Craft reference and FinTrack adaptation

Approved direction: reproduce Craft's composition first, then adapt with frontend-workbench. Reference inspected on 14 October 2026: https://www.craft.do/.

REA bundle evidence `ev_487629129925da0e34488a4adecad99671e0477ea8186d16376363aa4850a813` supports Next.js (high confidence) and React (medium confidence). It does not establish Craft's animation library or original component source.

Reference captures: `.frontend/craft-reference-desktop.png`, `.frontend/craft-reference-mobile.png`, `.frontend/craft-reference-section.png`. Composition prototype: `.frontend/craft-layout-study.html`. Original markup and CSS; no Craft logo, illustrations, testimonials or production code copied.

Retain: floating pill navigation, centered serif headline, rounded full-width hero, layered paper backdrop, large overlapping app preview, generous section spacing and alternating product narratives.

Adapt: FinTrack brand, green/light-blue theme accents, Indonesian/English content, real app destinations, illustrative financial previews, receipt demo, native FAQ and honest feedback section. Existing Motion dependency handles animation; no extra animation or component dependency required. Respect reduced motion and keep mobile native scrolling.

Completion evidence: desktop and mobile screenshots, dark/light and ID/EN checks, showcase tab and receipt demo interaction, mobile menu, FAQ, login navigation, lint/typecheck/build and targeted Playwright regression tests. Testimonials await actual user submissions; no invented endorsements or ratings.

## Verification

- `pnpm typecheck`: passed.
- `pnpm lint`: zero errors; 101 existing warnings elsewhere in the application.
- `pnpm test`: 237 tests across 40 files passed.
- `pnpm exec playwright test e2e/landing-hero.spec.ts e2e/landing-experience.spec.ts`: eight tests passed on desktop and mobile; the configured production build also passed.
- `pnpm audit --prod --audit-level=high`: no known vulnerabilities.
- Browser review: 1440×900, 768×1024 and 390×844, light/dark and ID/EN. Mobile document width equals viewport width. Reduced-motion hydration is covered by the regression test, including console errors. Scroll parallax is checked with motion enabled and disabled.
- Final captures: `.frontend/fintrack-craft-light-final.png`, `.frontend/fintrack-craft-dark-final.png`, `.frontend/fintrack-craft-light-mobile-final.png`, `.frontend/fintrack-craft-dark-mobile-final.png`, `.frontend/fintrack-craft-mobile-full.png`.

This is an original FinTrack adaptation of the observed composition, not a pixel-identical export of Craft. Preview transactions and the receipt demo are explicitly illustrative. The feedback invitation is ready for actual user reviews; no fabricated quotes are published.
