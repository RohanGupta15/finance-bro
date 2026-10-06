# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Stack

A pnpm 12.9.1 and Turborepo monorepo with an Expo SDK 58 beta, React Native 0.88 release candidate, TypeScript 6.0.3, and Expo Router app for Android, iOS, and web. The mobile app is in `apps/mobile/`; the pure TypeScript SMS parser is in `packages/sms-parser/`. ESLint 9.39.5 is the current Expo-tooling-compatible major.

## Users

Primarily for Suvo's personal finances, with friends as additional users. Suvo and Rohan maintain the repository together. Whether financial records are shared between users remains undecided. Open-source distribution uses [Apache-2.0](LICENSE); distribution and privacy decisions are tracked in [issue #25](https://github.com/Starforge-lab/finance-bro/issues/25).

## Product Purpose

Help people in India track personal expenses and income, manage budgets and bills, and reduce manual transaction entry. English is the initial language. INR is the maintainer-selected default based on the region; multi-currency support is undecided.

## Operating Context

Mobile use is primary, with Android, iOS, and web support. Suvo can test on a Motorola Edge 60 Pro; Rohan has an iPhone. The user asked to settle visual directions before implementing custom finance screens. The current UI is a minimal shell and parser demo.

## Capabilities and Constraints

- Confirmed initial scope: expenses and income, budgets, and bills. Manual entry, receipt scanning, automatic Android SMS parsing, and connected email parsing are confirmed entry requirements. Budget and bill workflows remain in scope even though the preserved Rohan proposal schedules them later.
- Current implementation: Expo Router tabs with a simple home screen, paste-to-parse SMS demonstration, placeholder Insights/Budgets/Settings screens, and a pure TypeScript parser that returns transaction, review, or ignored results. There is no persisted ledger or CRUD, native SMS capture, receipt OCR, or email integration.
- Current architecture direction: local-only financial data with no app accounts or hosted backend. Storage, export, backup, and retention details need implementation. The email provider, requested permissions, and a local-only connection flow are undecided.
- One upstream Worklets peer-range warning remains under review, tracked in [issue #3](https://github.com/RohanGupta15/finance-bro/issues/3), despite the Expo install check and Expo Doctor passing.
- Automatic imports follow separate device feasibility gates: Android read-only SMS capture/catch-up in #16, optional notification access with its own consent and no inbox backfill, and iOS Shortcuts → App Intent in #17. iOS apps cannot read the general SMS inbox. These paths are planned and unverified; automatic imports do not block the manual-first MVP. Google Play SMS access requires approval under its permission policy. See [Google Play SMS and Call Log permissions](https://support.google.com/googleplay/android-developer/answer/10208820) and [Apple SMS filtering](https://developer.apple.com/documentation/identitylookup/sms-and-mms-message-filtering).
- Never persist raw SMS or notification text, including unreadable messages. Android SMS review re-reads the original inbox message; a missing original requires manual entry or paste. iOS and notification failures keep a count only with manual/paste recovery. Future persisted import fingerprints must be cryptographically keyed using a platform-protected device secret; key loss and restore behavior must be settled and tested before imports ship. These are implementation requirements, not existing capabilities.
- Main F-Droid is the current distribution goal. It requires a clean source build and compatible free/open-source dependencies, including transitive dependencies. GitHub Releases/IzzyOnDroid are optional later companion channels; Google Play/App Store and a full/play build split are deferred. Standard F-Droid signing is sufficient for the current goal; reproducibility and verified upstream signing become gates if shared signatures across channels are required later. Publication, signing setup and paid services require explicit authorization; this target does not authorize release. See [F-Droid inclusion](https://f-droid.org/en/docs/Inclusion_Policy/) and [upstream signing](https://f-droid.org/en/docs/Reproducible_Builds/).
- Receipt OCR approach and provider choices for connected email remain undecided. Financial data is sensitive; examples and fixtures must be fictional or anonymized.
- Product name is undecided.

## Evidence on Hand

The repository contains the Expo app shell and an SMS parser package with parser code, tests, and fixtures. A frozen install and `pnpm check` passed, including type checking, lint, and 31 parser tests. The Expo install check, Expo Doctor (20/20), and Android/iOS/web export also passed locally. Browser rendering showed Home and four tab items; Home-to-Settings navigation and one synthetic SMS parse displaying a ₹450 SWIGGY expense were observed. The other tabs have not had a full click-through. No physical Android or iOS device or signed native build has been tested. Remote CI and CodeQL results are published on pull requests; use those checks for the current revision.

## Product Principles

- Keep everyday expense, income, budget, and bill workflows in the initial product scope.
- Preserve manual entry alongside automated imports so users can record transactions without granting message access.
- Build the local ledger and approved manual workflows first, then paste review/save, budgets, bills and export; validate automatic imports separately.
- Keep financial records local and avoid app accounts or a hosted backend in the current architecture.
- Treat SMS, email, and receipt contents as sensitive and obtain clear consent for imports.
- Describe implemented behavior and platform limits plainly.
