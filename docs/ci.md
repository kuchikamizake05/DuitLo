# Continuous integration

CI runs lint, type checking, unit tests, a production build, dependency auditing, and Playwright against desktop and mobile Chromium. The browser jobs use isolated mocked Supabase data and never use production credentials.

Pushes to main queue behind an active run instead of cancelling it. Pull requests cancel superseded runs. Desktop and mobile browser jobs run independently, each with two workers, and upload separate reports even after a failure.

Run the same browser checks locally with `npm run test:e2e -- --project=desktop-chromium --workers=2` and the equivalent mobile project. Playwright builds an isolated `.next-e2e` application on port 3100.

The browser suite checks the current navigation, transaction dialogs, receipt extraction and review, account and goal controls, budgets, onboarding recovery, themes, and report downloads. Category selection is tested in the transaction picker; the retired `/categories` page is no longer a route. CSV parsing and deduplication remain covered by unit tests; the former planning-page import UI is not part of the current budget page.

Palette and hover checks use the running application. They do not require a separate HTML reference server on port 8743. Logo editing starts from controlled approval data so checked-in logo approvals cannot change the test outcome.
