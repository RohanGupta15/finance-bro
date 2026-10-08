# Connected manual-first UI

## Scope

The frontend connects the shared local data API to Home, entry/edit/delete, paste review/save, category budgets, bills, Insights, account/category management and CSV export. It follows Rohan's PR #33 Ink and Stamps typography, colors, outlines, fanned cards, category tiles and screen compositions. Quicksave is retired.

The user requested minimal text, minimal overwhelm and low effort after a full workday. Home names the purpose; new entries require only an amount. Date defaults to today and preserves the current India clock; edits preserve the original clock. Category, account and note are optional details. Filters, the full entry list, additional insights and calculation explanations start collapsed. Validation, explicit save errors and discard protection remain.

Android uses Router tabs for the reference floating capsule, with symmetric side insets and fully visible labels. Entry and paste hide that capsule. The entry footer avoids the keyboard and bottom system area. iOS retains NativeTabs and requires Rohan's device validation.

## Observed validation

On 2026-10-08, a Motorola Edge 60 Pro running Android 17 rendered the connected screens against a temporary, separate fictional ledger:

- Home displayed the purpose, three fanned entries, real monthly totals, category tiles and collapsed controls.
- Add opened the decimal keyboard. A ₹12.34 expense saved with no optional details and raised monthly spending from ₹7,598.00 to ₹7,610.34.
- After fixing keyboard overlap, Save was visibly above the keyboard and worked without dismissing it first.
- After a process restart, the capsule had equal side insets and all four labels were visible; tab navigation worked.
- Budgets displayed the overall remaining limit and Food's ₹50 overspend using the fictional recorded entries.
- Insights started with the summary and one factual category statement; More insights revealed the six-month chart.
- Settings displayed concise local-data and paste-text handling copy plus the fictional account.
- Light Home showed the expected paper, ink outlines, hard shadows and category stamps; dark Home and the other screens were also observed. This is a targeted visual check, not exhaustive accessibility or device certification.

The temporary source hook was restored, the isolated database and device test captures were deleted, and the phone's original dark-mode setting was restored. Normal financial data was not inspected. Local screenshots are development evidence and are not published to GitHub.

Earlier connected browser evidence included invalid amount rejection, save/edit, a category budget and paid bill, and CSV download. Those checks preceded the latest copy/disclosure refinements; they are not a complete check of the latest browser build.

## Remaining release gates

- Exercise the current paste review UI on web and Android: valid, ambiguous, ignored, corrected/deleted replay and key-loss acknowledgement.
- Complete the current entry/edit/delete, discard, reload, failure recovery, accounts/categories, budget/bill mutations and CSV destination matrix on supported platforms.
- Rohan owns all iOS-specific work and physical-device checks, including keyboard, navigation, persistence and CSV (issue #34).
- Verify large text, screen-reader navigation, responsive web and long/large ledgers.
- Purposeful motion, haptics and reduced-motion behavior remain to be implemented/verified.
- Review dependency PRs #31, #33 and #37, obtain peer review and pass CI at the exact frontend revision before promotion. Do not infer release readiness from bundle exports or screenshots.
