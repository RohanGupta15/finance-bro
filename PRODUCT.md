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

Mobile use is primary, with Android, iOS, and web support. Suvo can test on a Motorola Edge 60 Pro; Rohan has an iPhone. The user asked to settle visual directions before implementing custom finance screens. The current UI is a minimal shell and parser demo.

## Capabilities and Constraints

- Confirmed initial scope: expenses and income, budgets, and bills. Manual entry, receipt scanning, automatic Android SMS parsing, and connected email parsing are confirmed entry requirements. Budget and bill workflows remain in scope even though the preserved Rohan proposal schedules them later.
- Confirmed desired outcomes, not yet implemented: an easy-to-understand financial overview, identification of overspending, and month-end money estimates. The current direction is to show both projected total available account balance and money left from this month's income, clearly distinguished. The overspending baseline, calculation rules and required inputs remain to be agreed; do not assume complete account balances or income/bill schedules are available.
- Current implementation: Expo Router tabs with a simple home screen, paste-to-parse SMS demonstration, placeholder Insights/Budgets/Settings screens, and a pure TypeScript parser that returns transaction, review, or ignored results. Local ledger storage now provides accounts/categories/transactions, migrations, validated writes, correction protection and soft deletion through a shared async API. The data-side paste review/save API now prepares parser candidates, accepts corrections, retains parser provenance and prevents replay from duplicating or changing protected imports. Ledger, manual-entry and import review screens are not connected yet; native SMS capture, receipt OCR and email integration remain planned. See [the ledger contract](docs/ledger.md).
- Current architecture direction: local-only financial data with no app accounts or hosted backend. Storage, export, backup, and retention details need implementation. The email provider, requested permissions, and a local-only connection flow are undecided.
- One upstream Worklets peer-range warning remains under review, tracked in [issue #3](https://github.com/RohanGupta15/finance-bro/issues/3), despite the Expo install check and Expo Doctor passing.
- Android SMS access needs native integration and user consent. iOS does not let apps read a user's general SMS inbox; an iOS import path is undecided. Google Play SMS permission policy is relevant only if distributing through Google Play. Store setup is deferred. See [Google Play SMS and Call Log permissions](https://support.google.com/googleplay/android-developer/answer/10208820) and [Apple SMS filtering](https://developer.apple.com/documentation/identitylookup/sms-and-mms-message-filtering).
- Receipt OCR approach and provider choices for connected email remain undecided. Financial data is sensitive; examples and fixtures must be fictional or anonymized.
- Product name and open-source license are undecided.

## Evidence on Hand

Native ledger data-layer checks on 2026-10-07 passed on a Motorola Edge 60 Pro running Android 17 with the installed development client: old-schema migration, expense/income writes, edits/deletions, invalid-money rejection, concurrent paste saves, correction/replay protection and persistence after an app process restart. A fictional paste demo displayed a ₹450 Swiggy expense. The temporary harness used a separate database, which was deleted after validation; connected ledger/import screens and iOS behavior remain unverified. See [the Android validation record](docs/android-ledger-validation.md).

Paste import data-layer checks on 2026-10-07 passed eight Node SQLite ledger tests, including old-schema upgrades, ambiguous/ignored inputs, invalid corrections, simultaneous saves, cross-sender UPI alerts, and corrected/deleted replay. Frozen install, `pnpm check` (including 31 parser tests), Expo install check, Expo Doctor (20/20), and Android/iOS/web exports passed. This API has no connected review screen yet; browser and real-device import flows have not been verified.

Local-ledger checks on 2026-10-06 passed four Node SQLite tests for persistence, migrations, invalid money and correction/deletion protection. A temporary fictional-data browser harness passed async SQLite writes and reload persistence; the harness was removed. The restored paste flow displayed a ₹450 SWIGGY expense after the SDK compatibility patches. Frozen install, `pnpm check`, Expo install check, Expo Doctor (20/20), Android/iOS/web export and diff whitespace checks passed. Native ledger behavior remains unverified until a rebuilt development client is tested. The Worklets peer-range warning and tooling advisories remain recorded in issue #3 and SECURITY.md.

The repository contains the Expo app shell and an SMS parser package with parser code, tests, and fixtures. A frozen install and `pnpm check` passed, including type checking, lint, and 31 parser tests. The Expo install check, Expo Doctor (20/20), and Android/iOS/web export also passed locally. Browser rendering showed Home and four tab items; Home-to-Settings navigation and one synthetic SMS parse displaying a ₹450 SWIGGY expense were observed. The other tabs have not had a full click-through. No physical Android or iOS device or signed native build has been tested. Remote CI and CodeQL results are published on pull requests; use those checks for the current revision.

## Product Principles

- Design for low energy and limited attention: make the everyday financial picture understandable without overwhelming the user; deeper detail should be optional.
- Explain overspending and estimates in plain language. Distinguish recorded facts from projections and make missing data or assumptions clear.
- Keep everyday expense, income, budget, and bill workflows in the initial product scope.
- Preserve manual entry alongside automated imports so users can record transactions without granting message access.
- Keep financial records local and avoid app accounts or a hosted backend in the current architecture.
- Treat SMS, email, and receipt contents as sensitive and obtain clear consent for imports.
- Describe implemented behavior and platform limits plainly.
