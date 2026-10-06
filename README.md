# finance-bro

**Working repository name; final product name is undecided.**

[![CI](https://github.com/RohanGupta15/finance-bro/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/RohanGupta15/finance-bro/actions/workflows/ci.yml)

A mobile-first personal finance app for India, targeting Android, iOS, and web, with English and INR as initial defaults. Suvo and Rohan are building it together.

**Status:** Early development. The pnpm monorepo contains an Expo Router app shell, a paste-to-parse SMS demo, and a pure TypeScript SMS parser package. There is no saved transaction ledger, automatic SMS capture, receipt scanning, or connected email integration yet.

A frozen install, `pnpm check` (including 31 parser tests), Expo install check, Expo Doctor (20/20), and Android/iOS/web export passed locally. Browser rendering showed Home and four tab items; Home-to-Settings navigation and one synthetic SMS parse were observed. The other tabs have not had a full click-through. No physical device or signed native build has been tested. Remote CI and CodeQL results are published on pull requests; use those checks for the current revision. `pnpm audit` reported three transitive development/build-tool advisories (two high, one moderate); see [Security](SECURITY.md).

Expo SDK 58 is beta and React Native 0.88 is a release candidate. Dependency versions are pinned in `pnpm-lock.yaml`. TypeScript 6.0.3 and ESLint 9.39.5 remain the current Expo-tooling-compatible versions. One upstream Worklets peer-range warning is still under review; see [issue #3](https://github.com/RohanGupta15/finance-bro/issues/3).

## Install

Use Node.js 22.13 or newer in the 22.x line (the package also accepts Node 24.3+, 26.x, and 27+) and the repository-pinned pnpm 12.9.1:

```sh
corepack enable
pnpm install --frozen-lockfile
```

## Run

The mobile app starts in development-client mode. Install a matching Android or iOS development build first; see [Contributing](CONTRIBUTING.md) for EAS setup.

```sh
pnpm build:android:dev  # or pnpm build:ios:dev
pnpm dev
```

To run the web app:

```sh
pnpm web
```

The SDK 58 beta needs a compatible Expo Go or development client. For a physical iPhone, the beta's EAS Go path uses TestFlight and requires an active Apple Developer Program membership. This project has not been tested on a phone. See [Expo's SDK 58 beta guide](https://expo.dev/changelog/sdk-58-beta) and [iOS device setup](https://docs.expo.dev/get-started/set-up-your-environment/?device=physical&mode=expo-go&platform=ios).

## Check and build

```sh
pnpm check
pnpm build
pnpm parser:try "Rs.450 debited from A/c XX1234 to VPA shop@ybl" --sender VM-HDFCBK-S
```

`pnpm check` runs type checking, lint, and tests. `pnpm build` exports Android, iOS, and web bundles; it does not install or verify a native app. Use only fictional or anonymized message text in parser examples and tests.

## Product scope

The confirmed initial finance scope is expenses and income, budgets, and bills. Required entry paths include manual entry, receipt scanning, automatic Android SMS parsing, and connected email parsing. Budgets and bills remain in scope even though the preserved Rohan proposal originally scheduled them later. None of these finance workflows currently saves records; the SMS parser and paste demo are the only related implementation.

The current direction is local-only, with no app account or hosted backend. Storage and export details still need implementation. Receipt OCR, email provider and permissions, and how email import fits the local-only design remain open. Android SMS access needs native integration and user consent. iOS apps cannot read a user's general SMS inbox; the iOS message-import approach is undecided. A proposed distribution plan, covering Google Play, the App Store and F-Droid, is described under [Distribution](#distribution-proposed).

The original Rohan plan is preserved in [docs/proposals/2026-10-06-rohan-plan.md](docs/proposals/2026-10-06-rohan-plan.md) for reference. [PRODUCT.md](PRODUCT.md) records the current confirmed scope.

## Distribution (proposed)

> Proposal under discussion in [issue #25](https://github.com/Starforge-lab/finance-bro/issues/25). Nothing is published yet, and none of this is implemented.

The plan is to publish on Google Play and the App Store, and also as an open-source Android app on **F-Droid** (plus IzzyOnDroid and GitHub Releases). Google Play restricts apps that read SMS and may deny this app that permission. F-Droid has no such restriction, so Android users can always get automatic SMS reading.

| Channel | How transactions arrive |
|---|---|
| F-Droid, IzzyOnDroid, GitHub Releases | Reads bank SMS automatically, including past messages already in the inbox. Notification access is optional. |
| Google Play | Reads SMS only if Google approves; otherwise uses notification access (reads payment notifications as they arrive, with no history) |
| App Store | A one-time Shortcuts automation passes new messages to the app; you can also paste a message |
| Every channel | Manual entry and paste always work, and the app never requires message access |

Every channel uses the same app ID and signing key, so users can switch channels without reinstalling.

### What targeting F-Droid means

F-Droid builds the app from this repository's source code on its own servers. That brings these limitations:

- **Open-source license required.** None has been chosen yet, so F-Droid publication is blocked until one is (see issue #25).
- **No proprietary dependencies.** No Google Play Services, Firebase, or closed-source analytics or crash reporting, in the app or in any native library it uses. For example, `expo-notifications` pulls in Firebase on Android, so notifications must come from Firebase-free code.
- **Builds from source, not EAS.** The Android app must build with `expo prebuild` and Gradle from a clean checkout. Generated `android/` and `ios/` folders stay out of the repository.
- **No tracking or non-free network services.** F-Droid labels or rejects apps with these. This app sends no data anywhere.
- **Slower releases.** F-Droid builds on its own schedule, often several days after a release is tagged. GitHub Releases and IzzyOnDroid are faster.
- **Reproducible builds for shared signing.** F-Droid can only distribute an APK signed with our key if it can rebuild that exact APK from source.
- **Platform rules outside our control.** Google is rolling out mandatory developer verification for Android apps installed outside Google Play. On Android 13 and later, apps installed outside an app store may also need the user to allow "restricted settings" before granting SMS access. The app's first-run screens will explain this.

### Message privacy: read, record, forget

The app never stores message text. When it reads a transaction message, it saves the transaction (amount, account, payee and time) along with metadata needed to avoid duplicates. That metadata is the message ID, the sender, which parser rule matched, and a fingerprint made with a secret key that never leaves the phone. Your messages stay in your messaging app: keep or delete them as you like. If a message is deleted before the app reads it, that transaction is not imported.

Messages the app can't read:

- **Android:** the app remembers only the message ID and re-reads the text from your inbox when you review it.
- **iOS:** the app records only how many messages couldn't be read, so you can paste them in.

## Work with the maintainers

Use `dev` as the integration branch and `main` for stable releases. The GitHub default-branch setting still needs owner confirmation; see the [branching guide](docs/branching.md). Read [Contributing](CONTRIBUTING.md) and [Security](SECURITY.md) before contributing. No open-source license has been chosen yet. F-Droid publication requires one; see [issue #25](https://github.com/Starforge-lab/finance-bro/issues/25).

## Repository layout

- `apps/mobile/` — Expo app
- `packages/sms-parser/` — deterministic SMS normalization, classification, and transaction extraction
- `packages/config/` — shared TypeScript configuration
