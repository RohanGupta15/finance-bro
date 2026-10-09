# finance-bro

Next: [the approved 2.0 roadmap](docs/v2-roadmap.md) covers automatic message imports, recovery and private financial understanding, with assigned GitHub tasks and explicit device/provider gates.

**Finance Bro is the working product name; a final name is not selected.**

[![CI](https://github.com/Starforge-lab/finance-bro/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/Starforge-lab/finance-bro/actions/workflows/ci.yml)

A mobile-first personal finance app for India, targeting Android, iOS, and web, with English and INR as initial defaults. Suvo and Rohan are building it together.

**Status:** Early development. Connected Home, manual entry/corrections, paste review/save, Budgets/Bills, Insights and Settings use the shared local ledger. Android/web CSV destinations are connected; iOS export and native SMS/App Intent imports remain separate work. See [the UI validation record](docs/v1-ui.md) and [data contract](docs/v1-data-layer.md) for observed checks and remaining gaps.

A frozen install, `pnpm check` (including 31 parser tests), Expo install check, Expo Doctor (20/20), and Android/iOS/web export passed locally. Browser rendering showed Home and four tab items; Home-to-Settings navigation and one synthetic SMS parse were observed. The other tabs have not had a full click-through. These starter checks are historical; later Android checks are recorded in [UI validation](docs/v1-ui.md). Remote CI and CodeQL results are published on pull requests; use those checks for the current revision. `pnpm audit` reported three transitive development/build-tool advisories (two high, one moderate); see [Security](SECURITY.md).

Expo SDK 58 is beta and React Native 0.88 is a release candidate. Dependency versions are pinned in `pnpm-lock.yaml`. TypeScript 6.0.3 and ESLint 9.39.5 remain the current Expo-tooling-compatible versions. One upstream Worklets peer-range warning is still under review; see [issue #3](https://github.com/Starforge-lab/finance-bro/issues/3).

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

The SDK 58 beta needs a compatible Expo Go or development client. For a physical iPhone, the beta's EAS Go path uses TestFlight and requires an active Apple Developer Program membership. Scoped Android device results are recorded in [UI validation](docs/v1-ui.md); iOS verification remains outstanding. See [Expo's SDK 58 beta guide](https://expo.dev/changelog/sdk-58-beta) and [iOS device setup](https://docs.expo.dev/get-started/set-up-your-environment/?device=physical&mode=expo-go&platform=ios).

## Check and build

```sh
pnpm check
pnpm build
pnpm parser:try "Rs.450 debited from A/c XX1234 to VPA shop@ybl" --sender VM-HDFCBK-S
```

`pnpm check` runs type checking, lint, and tests. `pnpm build` exports Android, iOS, and web bundles; it does not install or verify a native app. Use only fictional or anonymized message text in parser examples and tests.

## Product scope

The confirmed initial finance scope is expenses and income, budgets, and bills. Required entry paths include manual entry, receipt scanning, automatic Android SMS parsing, and connected email parsing. Budgets and bills remain in scope even though the preserved Rohan proposal originally scheduled them later. Manual finance workflows now save locally; receipt OCR, connected email and automatic imports remain future work.

The current direction is local-only, with no app account or hosted backend. The shared ledger and Android/web CSV destinations are implemented; backup and remaining platform flows need further work. Receipt OCR, email provider and permissions, and how email import fits the local-only design remain open. Android SMS access needs native integration and user consent. iOS apps cannot read a user's general SMS inbox; the iOS message-import approach is undecided. Google Play SMS rules matter only if distributing through Google Play. Store setup is deferred.

The original Rohan plan is preserved in [docs/proposals/2026-10-06-rohan-plan.md](docs/proposals/2026-10-06-rohan-plan.md) for reference. [PRODUCT.md](PRODUCT.md) records the current confirmed scope.

The [agreed MVP roadmap](docs/mvp-roadmap.md) sequences a manual-first local ledger, budgets, bills, reviewed paste import and CSV export. Rohan handles design. Automatic SMS experiments run alongside ledger work; native imports do not block the first usable MVP.

## Work with the maintainers

Use `dev` as the integration branch and `main` for stable releases. The GitHub default branch is dev; see the [branching guide](docs/branching.md). Read [Contributing](CONTRIBUTING.md) and [Security](SECURITY.md) before contributing. No open-source license has been chosen yet.

## Repository layout

- `apps/mobile/` — Expo app
- `packages/sms-parser/` — deterministic SMS normalization, classification, and transaction extraction
- `packages/config/` — shared TypeScript configuration
