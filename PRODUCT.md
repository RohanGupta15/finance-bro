# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Stack

A pnpm 12.9.1 and Turborepo monorepo with an Expo SDK 58 beta, React Native 0.88 release candidate, TypeScript 6.0.3, and Expo Router app for Android, iOS, and web. The mobile app is in `apps/mobile/`; the pure TypeScript SMS parser is in `packages/sms-parser/`. ESLint 9.39.5 is the current Expo-tooling-compatible major.

## Users

Primarily for Suvo's personal finances, with friends as additional users. Suvo and Rohan maintain the repository together. Whether financial records are shared between users remains undecided. A public open-source release is a possibility, but no license has been chosen.

## Product Purpose

Help people in India track personal expenses and income, manage budgets and bills, and reduce manual transaction entry. English is the initial language. INR is the maintainer-selected default based on the region; multi-currency support is undecided.

A core goal is to help users who are tired after a day's work and feeling lazy open the app without feeling overwhelmed, understand their finances, see where they are overspending, and get an idea of how much they will have at the end of the month. Everyday understanding should require little effort or financial analysis from the user.

## Operating Context

Mobile use is primary, with Android, iOS, and web support. Suvo can test on a Motorola Edge 60 Pro; Rohan has an iPhone. The user asked to settle visual directions before implementing custom finance screens. Connected manual-first screens are under verification; iOS implementation and physical-device verification belong to Rohan.

## Capabilities and Constraints

- Confirmed initial scope: expenses and income, budgets, and bills. Manual entry, receipt scanning, automatic Android SMS parsing, and connected email parsing are confirmed entry requirements. Budget and bill workflows remain in scope even though the preserved Rohan proposal schedules them later.
- Confirmed desired outcomes, not yet implemented: an easy-to-understand financial overview, identification of overspending, and month-end money estimates. The current direction is to show both projected total available account balance and money left from this month's income, clearly distinguished. The overspending baseline, calculation rules and required inputs remain to be agreed; do not assume complete account balances or income/bill schedules are available.
- Current implementation: connected Home, manual-entry/edit/delete, paste review/save, Budgets/Bills, Insights and Settings screens use the shared local data API. Account/category management and CSV destinations are connected. New entries require only an amount; date defaults to today and category/account/note stay behind Add details. More controls, the full entry list, deeper insights and calculation explanations are collapsed by default. Native SMS capture, receipt OCR, email and encrypted backup remain future work. A connected screen is not evidence that every platform flow passes; see [UI validation](docs/v1-ui.md) and [the v1 data contract](docs/v1-data-layer.md).
- Current architecture direction: local-only financial data with no app accounts or hosted backend. Storage, export, backup, and retention details need implementation. The email provider, requested permissions, and a local-only connection flow are undecided.
- One upstream Worklets peer-range warning remains under review, tracked in [issue #3](https://github.com/RohanGupta15/finance-bro/issues/3), despite the Expo install check and Expo Doctor passing.
- Android SMS access needs native integration and user consent. iOS does not let apps read a user's general SMS inbox; an iOS import path is undecided. Google Play SMS permission policy is relevant only if distributing through Google Play. Store setup is deferred. See [Google Play SMS and Call Log permissions](https://support.google.com/googleplay/android-developer/answer/10208820) and [Apple SMS filtering](https://developer.apple.com/documentation/identitylookup/sms-and-mms-message-filtering).
- Receipt OCR approach and provider choices for connected email remain undecided. Financial data is sensitive; examples and fixtures must be fictional or anonymized.
- Product name and open-source license are undecided.

## Evidence on Hand

The [personal-finance benchmark research](docs/research/2026-10-07-personal-finance-benchmarks.md) compares commercial and open-source apps, separates documented capabilities from anecdotal shortcomings, and maps lessons to existing development issues. Use it when a feature decision needs this evidence; proposals do not change confirmed scope and competitor popularity does not prove Finance Bro outcomes.

Backend migration, persistence, validation and protected paste-save evidence is recorded separately in [Android ledger validation](docs/android-ledger-validation.md) and [the v1 data contract](docs/v1-data-layer.md). Those results do not prove the connected screens.

On 2026-10-08, the connected Motorola Edge 60 Pro running Android 17 rendered the simplified Home, Budgets, Insights and Settings with an isolated fictional ledger. Add opened with the decimal keyboard; a ₹12.34 expense saved without optional details and increased monthly spending from ₹7,598.00 to ₹7,610.34. Save remained above the keyboard after the Android layout fix. More insights revealed the six-month chart. Further UI flows and iOS remain pending; see [UI validation](docs/v1-ui.md). Current CI belongs to the exact PR revision.

## Product Principles

- Deliver future-tech, bleeding-edge functionality by excelling at speed, offline reliability and privacy within the approved manual-first v1 scope. Preserve exact money handling, protected corrections, clear persistence/error states and low-effort understanding. Use the newest compatible tooling; additional advanced capabilities require a confirmed user problem and scope decision.
- Approved visual baseline: Rohan's Ink and Stamps system in [PR #33](https://github.com/Starforge-lab/finance-bro/pull/33). Follow Rohan's exact screen compositions, components, typography, colors and spacing. The 2026-10-07 correction rejects an independent reinterpretation; changes must preserve the reference design, with truthful manual-first data and the retired Quicksave branding removed. Build the future-tech feel through polished motion, purposeful haptics and fast feedback; respect reduced-motion preferences. Mockups guide the connected screens; fictional mockup numbers and unsupported projections must never become product claims.
- Design for low energy and limited attention: the user explicitly requests minimal text, minimal overwhelm and minimal friction. First glance must explain the purpose. Prioritize open, understand spending, Add, amount, Save. Optional details and management controls stay behind a tap; retain validation and recoverable errors.
- Explain overspending and estimates in plain language. Distinguish recorded facts from projections and make missing data or assumptions clear.
- Keep everyday expense, income, budget, and bill workflows in the initial product scope.
- Preserve manual entry alongside automated imports so users can record transactions without granting message access.
- Keep financial records local and avoid app accounts or a hosted backend in the current architecture.
- Treat SMS, email, and receipt contents as sensitive and obtain clear consent for imports.
- Describe implemented behavior and platform limits plainly.
