# CLAUDE.md

Guidance for Claude Code (and humans) working in this repo. Product context is in [README.md](README.md); workflow is in [CONTRIBUTING.md](CONTRIBUTING.md). This file records **decisions and conventions** — keep it current when a decision changes.

> **Status:** Expo app shell and generic SMS parser, plus the local manual-first data layer: validated entry, account/category management, transaction queries/corrections, India-month totals, budgets, bills, CSV content and keyed paste review/save. See [the v1 data contract](docs/v1-data-layer.md) for scope, rules and verification gates. Connected manual-first screens and Android/web CSV destinations are in implementation and verification. Follow the exact Ink and Stamps references in DESIGN.md and docs/design/screens; the scrapped Quicksave name is not current branding. Native SMS/App Intent modules remain separate feasibility work. Rohan owns all iOS-specific implementation and real-device verification.

## What we're building

A mobile-first personal expense tracker for India. USP: it reads bank / UPI / card / wallet transaction SMS on-device and logs debits and credits automatically. Users can still add, edit, delete and re-categorise anything manually. Effortless, minimal taps, no setup friction. Finance Bro is the working product name; a final name is not selected.

## Stack

- **Expo SDK 58 (beta)**, React Native 0.88 RC, TypeScript (strict), New Architecture only.
- **Development build** via `expo-dev-client` — never Expo Go (we ship custom native code).
- **Expo Router** (tabs: Home, Insights, Budgets, Settings; add/edit as modal sheets).
- **expo-sqlite + Drizzle ORM** for the local ledger, with generated migrations. The DB is the source of truth; `useLiveQuery` integration remains planned.
- Planned **Zustand** for small UI-only state. No React Query (there is no server).
- **@expo/ui** native components where mature, Reanimated + haptics for motion.
- **pnpm workspaces + Turborepo**, `node-linker=hoisted` (try isolated installs later). Turbo's auto-written `AGENTS.md` is disabled (`agentGuidance: false`); before changing Turbo config, read the docs bundled in `node_modules/turbo/docs/`, since Turbo changes between versions.
- **Vitest** for packages and **node:test + node:sqlite** for ledger persistence/migration checks. Jest + React Native Testing Library are planned for screen tests. **EAS Build** for binaries.

### Expo skills — use them, don't rely on memory

SDK 58 is newer than most training data. The official Expo plugin is enabled for this project (`.claude/settings.json` → `expo@claude-plugins-official`). Before touching Expo/RN APIs, load the relevant skill:

| Task | Skill |
|---|---|
| Local Kotlin/Swift modules, config plugins | `expo-module` |
| Dev client setup/rebuilds | `expo-dev-client` |
| SDK beta → stable, dependency bumps | `expo-upgrade` |
| Routing, stacks, modals, sheets | `expo-router` |
| Native components, styling, icons | `expo-ui`, `expo-native-ui`, `expo-design-system` |
| Gestures, animation, haptics | `expo-animation` |
| Store builds, versioning, TestFlight | `eas-app-stores`, `eas-workflows` |

We deliberately have **no project-specific skills**. Add one only when a workflow has actually repeated enough to justify it.

## Repo layout

```
apps/mobile/                     Expo app (layout per the expo-project-structure skill)
  app.config.ts, eas.json
  src/app/                       Expo Router routes ONLY; each file renders a screen
  src/screens/<name>/            Screen bodies + their private components
  src/components/                Shared UI
  src/constants/theme.ts         Design tokens: every colour/spacing value comes from here
  src/hooks/
  modules/sms-reader/            (planned) Kotlin local Expo module + config plugin
  modules/transaction-intent/    (planned) Swift App Intent + JavaScriptCore parser bundle
packages/sms-parser/             Pure TS parser, consumed as source (no build step)
  src/normalise.ts, sender.ts    Canonical text; DLT header → institution
  src/classify.ts                transaction | otp | promo | reminder | request | balance_info | unknown | other
  src/extract/                   amount, account last4, UPI ref/VPA, direction/channel/payee
  src/rules/                     generic.ts + per-institution files (rules/index.ts registry)
  src/matching/                  smsDedupeKey, isSameTransaction, isTransferPair
  fixtures/<type>/<institution>/ Anonymised samples ({ note, cases: [...] } JSON)
  test/                          fixtures.test.ts (table-driven + rule coverage), units.test.ts
packages/config/                 Shared tsconfig.base.json
packages/merchant-catalog/       (planned) merchant / UPI VPA → default category data
```

## Commands

```bash
pnpm install --frozen-lockfile
pnpm dev                       # Metro for the dev client
pnpm test                      # all tests via Turborepo
pnpm check                     # typecheck, lint and parser tests
pnpm --filter @finance-bro/sms-parser test
pnpm parser:try "<sms text>" --sender VM-HDFCBK-S   # print classification + parse result
pnpm build:android:dev         # EAS development build (APK); needs `eas login` + `eas init` once
pnpm build:ios:dev             # EAS development build (internal distribution)
pnpm --dir apps/mobile dlx expo-doctor   # dependency/config health
```

Planned: `pnpm parser:anonymise <file>`, which scrubs names, digits and VPAs from raw samples.

Dev builds use `APP_VARIANT=development` (set in `eas.json`), giving the id `com.rohangupta.financebro.dev` so a dev build and production build can be installed side by side. `com.rohangupta.financebro` is a working id and must be settled before the first F-Droid release. A shared application id across future channels is a goal; verify signing and version compatibility before promising cross-channel updates.

## Hard rules

1. **Parser is pure.** `packages/sms-parser` has no React Native, Expo, DB or `Date.now()` imports. Time and locale are passed in. Same input → same output.
2. **Money is safe integer paise** (`amountPaise: number`). Never floats. Format only at the UI edge. The parser rejects unsafe values and malformed precision/grouping; invalid transaction money stays in review without a candidate rather than falling through to a later fee. Invalid optional balances are omitted.
3. **Never hand-edit `android/` or `ios/`.** They are generated (CNG). All native config goes through config plugins in `modules/*` or `app.config.ts`.
4. **SMS and notification imports are read-only.** Never send, delete, mark-read or modify source messages. Never durably store raw SMS or notification text, including review and failure records (see Privacy).
5. **No network calls with user data** without explicit, opt-in consent. No analytics/ads SDKs. Crash reporting, if added, is opt-in.
6. **Every parser rule has at least one positive fixture**; CI fails otherwise. Every bug fix in parsing starts with a failing fixture.
7. **Fixtures are anonymised** before commit — no real names, account digits, VPAs, phone numbers or reference numbers.
8. **The app must be fully usable without SMS permission** (manual entry + paste). This is a store-compliance requirement, not a nice-to-have.
9. Pin exact versions while on the beta. Use `pnpm --dir apps/mobile exec expo install` for Expo-managed packages.

## Architecture decisions

### SMS parsing pipeline (`packages/sms-parser`)

```
{sender, body, receivedAt}
 → normalise       whitespace, ₹ / Rs. / INR → one token, Indian digit grouping (1,23,456.00)
 → resolveSender   "VM-HDFCBK-S" → { institution: 'hdfc', dltSuffix: 'S' }
 → classify        transaction | otp | promo | reminder | request | balance_info | unknown | other
 → institution rules for that sender, in priority order (first match wins)
 → generic.keyword rule (extractors + direction keywords)
 → ParseResult:
     { kind: 'transaction', txn, ruleId, ruleVersion, confidence: 'high' | 'medium' }
     { kind: 'review', candidate: txn | null, ruleId | null, ruleVersion | null }   → privacy-safe Review state
     { kind: 'ignored', reason }
```

- One file per institution: `rules/banks/<bank>.ts`, `rules/upi/<app>.ts`, `rules/cards/<issuer>.ts`, `rules/wallets/<wallet>.ts`, registered in `rules/index.ts`.
- A rule = `{ id, version, institutions?, match(sms) → { txn, confidence } | null }`. Reuse the extractors in `src/extract/`; don't re-implement them per rule. Institution rules built from real samples should return `high`.
- The generic rule returns `medium` only when the sender is a known institution (or the SMS has a UPI ref) **and** there is an anchor (last4 / VPA / ref). Otherwise it returns `low`, which becomes `review`.
- `occurredAt` is the SMS arrival time; dates in the message body are not parsed yet.
- Deterministic rules/regex only. **No AI/ML.** Avoid regex lookbehind; the same bundle must run in Hermes and in iOS JavaScriptCore.
- Unknown financial-looking SMS may retain extracted review fields, never the body; Android re-reads by platform id, with manual/paste recovery if the original is gone. iOS and notification failures retain only an aggregate count, with no durable per-failure candidate or payload; recovery is manual entry or paste.
- `fixtures/synthetic/` holds made-up messages that exercise the classifier and generic rule. They are not real bank formats; real anonymised samples go under `fixtures/<type>/<institution>/`.

### Edge cases (owned by the parser / `matching/`)

| Case | Handling |
|---|---|
| OTP, promo, "pre-approved", limit offers | `classify` → ignored. `-P` DLT suffix treated as promo (verify against real samples). |
| "Will be debited", AutoPay/mandate notices, bill due | `reminder` → ignored for now (upcoming-bills feature uses them later) |
| UPI collect requests ("has requested money") | `request` → ignored |
| Money mentioned by a person, not a bank | Low confidence → `review` |
| Failed / declined | `status: 'failed'`, excluded from totals |
| Refunds, reversals | `kind: 'refund' \| 'reversal'`, linked to the original via `linkedTxnId` (merchant + amount + window) |
| Same SMS seen twice | The current pure-parser demo helper uses cyrb53 plus a 60 s bucket; persisted import fingerprints must instead be cryptographically keyed at the import/storage boundary (see Privacy). |
| Same txn from bank + UPI app + card | `isSameTransaction`: equal UPI ref; else different institutions, same amount + direction + status, compatible last4, within ±10 min. Same-institution alerts are never merged. |
| Own-account transfers, card bill payments | `isTransferPair`: debit and credit of the same amount between two of the user's own last4s within 2 h → `kind: 'transfer'`, excluded from spend. Wallet top-ups (often no last4) still need a rule. |
| ATM withdrawal | `kind: 'cash_withdrawal'` |

### Android SMS (`modules/sms-reader`, Kotlin)

- Permissions `RECEIVE_SMS`, `READ_SMS`, `POST_NOTIFICATIONS` are added by the module's config plugin.
- Manifest `BroadcastReceiver` for `SMS_RECEIVED` (works when the app is killed). It pre-filters cheaply on sender/keywords and enqueues the message reference.
- Background parser execution is unproven on this New Architecture: #16 must establish a bounded runtime/SQLite path. Use WorkManager for best-effort catch-up with references only and app-open recovery. Notifications hide financial details by default; source text is never a notification payload.
- **Catch-up on every app open:** query the SMS inbox in bounded batches from the last committed cursor. The initial history window defaults to 90 days only after explicit preview/consent. Recovery depends on permission and the original message remaining available; test process death, force-stop/reopen, installer allowlisting and OEM restrictions under #16. Advance the cursor atomically with ingestion; never queue bodies to disk.
- Planned JS boundary: permission request and bounded inbox queries by source reference. Final event/catch-up methods depend on #16 and the shared ingestion contract in #43; no body queue or body-bearing durable event is selected.
- Keep only the platform reference and minimal metadata. If Android can no longer reopen the original message, recover through manual entry or paste.

### iOS (`modules/transaction-intent`, Swift)

- Planned App Intent `LogTransactionFromSMS(text: String)`, `openAppWhenRun = false`, returns a confirmation dialog ("Logged ₹450 · Swiggy").
- Planned, pending #17: run the shared parser bundle in JavaScriptCore inside the App Intent, then write through the shared SQLite ingestion contract. Rohan must prove runtime availability, database access, concurrency and locked/background execution before this is treated as implemented.
- The user creates a Shortcuts Message automation with supported filters and automatic running. Rohan must prove message-text input, actual trigger coverage and background/locked execution in #17; an unfiltered any-message trigger is not assumed. Apps cannot create personal automations programmatically. Provide illustrated setup and manual/paste/share recovery; this path has no general SMS inbox access or historical backfill.
- Input text is transient. iOS and notification failures retain an aggregate count only, with manual/paste recovery and no per-failure payload.
- Fallbacks: paste box, and clipboard detection on foreground. Share extension is v1.1.

### Distribution (goal: main F-Droid)

Main F-Droid is the current distribution goal ([issue #27](https://github.com/Starforge-lab/finance-bro/issues/27)); Android and iOS import feasibility remains tracked separately in [#16](https://github.com/Starforge-lab/finance-bro/issues/16) and [#17](https://github.com/Starforge-lab/finance-bro/issues/17). This is a target, not an existing build or authorization to sign or publish.

- F-Droid prerequisites: build from clean source without relying on EAS binaries, and audit the complete runtime and build dependency graph for free/open-source compatibility. Expo SDK 58's [`expo-notifications` Android build file](https://github.com/expo/expo/blob/main/packages/expo-notifications/android/build.gradle) includes Firebase Messaging; assess that dependency before adding the package.
- Standard F-Droid signing is the initial target. Reproducibility and verified upstream signing are only needed if shared signatures across channels become a later requirement.
- GitHub Releases and IzzyOnDroid are optional companion channels later. Google Play and the App Store are deferred possibilities; do not add `full`/`play` flavors until a concrete channel requirement justifies them. If Play is considered, SMS access needs policy approval and notification access needs a separate consent and feasibility review; notification imports have no inbox history, may expose redacted content, and failures recover by count plus manual entry or paste.
- Keep privacy disclosures consistent with the Privacy section and [PRODUCT.md](PRODUCT.md).

### Privacy

- All parsing on-device. No backend, no accounts, no bank linking.
- Never durably store raw SMS or notification text, including unparsed, review, or failed messages. The parser may hold text transiently in memory. Keep raw SMS/notification text out of queues, logs, telemetry, and crash reports.
- Android may retain a platform message reference and minimal metadata (`sender`, `platformId`, `receivedAt`, rule, outcome) so review can re-read the original inbox message. If it is missing, the user recovers by manual entry or paste. iOS and notification failures retain an aggregate count only, with manual/paste recovery and no per-failure payload.
- Persisted message fingerprints must be cryptographically keyed at the import/storage boundary using a random device secret in platform-protected storage. Decide and test key loss and restore behavior before imports ship. Keep secret handling out of `packages/sms-parser`; its current `smsDedupeKey` uses non-cryptographic cyrb53 and is demo logic, not a persisted security fingerprint.
- Email/receipt source text is transient too; retain structured candidates or unavailable counts, never raw source content in durable review, logs or backups.
- Biometric app lock and a hide-amounts toggle.
- Backup (v1.1) is a user-initiated encrypted file export to a location they pick. Nothing is uploaded by the app.

### Data model (Drizzle / SQLite)

- `accounts`: id, name, institution, type (`bank|credit_card|wallet|upi_lite|cash`), last4, isOwn, archived
- `transactions`: id, amountPaise, direction (`debit|credit`), kind (`expense|income|transfer|refund|reversal|cash_withdrawal`), status (`posted|failed|pending`), accountId, counterparty, merchantId, categoryId, occurredAt, note, source (`sms|manual|ios_intent|paste`), smsRefId, upiRef, dedupeKey, linkedTxnId, excludeFromStats, userEdited, createdAt, updatedAt, deletedAt
  - `userEdited = true` → never overwritten by re-parsing. `deletedAt` = soft delete (undo, and blocks re-import).
- Planned `sms_refs`: id, platformId, sender, keyed body fingerprint, receivedAt, parseStatus (`parsed|ignored|unknown|failed`), ruleId, ruleVersion. Store no raw body; coordinate future schema under the 2.0 ingestion issue.
- `categories`: id, name, icon, color, parentId, kind (`expense|income`), isSystem, sortOrder
- `merchants`: id, displayName, aliases, vpaPatterns, defaultCategoryId
- `category_overrides`: matchType (`merchant|vpa|counterparty`), value, categoryId — learned from user re-categorisation
- v1.1+: `budgets`; v2: `recurring_series`

Every schema change ships a Drizzle migration, tested against a seeded DB.

## UX direction

The visual system is **"Ink and Stamps"** (C2 light, C3 dark), documented in [DESIGN.md](DESIGN.md) with tokens in `apps/mobile/src/constants/theme.ts`. Read DESIGN.md before building any screen. In short: ink outlines on paper, money in Space Mono, colour only in small category stamps plus one rationed highlighter yellow, ink-only charts, and red only for over-budget or destructive actions (not for ordinary debits).

Behaviour was originally inspired by [Sushi](https://github.com/jerameel/sushi) (inspiration, not a template):
- A date-grouped transaction feed, one primary "new transaction" action, light + dark themes.
- Where we go further: auto-logged entries with one-tap category fix, number-pad-first manual add (~3 s), a Review inbox, and insights that state facts ("Food is 32% higher than last month") rather than chart walls.

## Scope

Follow [the manual-first roadmap](docs/mvp-roadmap.md) for delivery order and [PRODUCT.md](PRODUCT.md) for confirmed scope. Native import experiments do not block the usable manual-first MVP.

For 2.0 implementation, import adapters, recovery or forecasts, follow [the approved 2.0 roadmap](docs/v2-roadmap.md) and its linked issues. It supersedes the older automatic-import plans below: source text stays transient, Android uses inbox catch-up, iOS automation requires #17 device proof, and provider/source-build gates remain explicit. Suvo owns shared contracts/Android/web; Rohan owns every iOS adapter and physical check. Planning grants no real-message access, account connection, signing or publication.

The confirmed initial finance workflows include expenses/income, budgets and bills; see PRODUCT.md. Receipt scanning and connected email are confirmed later entry requirements; providers and their fit with the local-only design remain open. The shared local business layer exists; connected screens are under verification. PRODUCT.md and roadmap issue #7 define the approved manual-first v1. The older automatic-import roadmap below is future work, not a v1 release gate.

- **v1 (manual-first MVP):** validated manual expenses/income; local accounts/categories; month feed, recorded cash-flow totals and category breakdown; protected edits and soft deletion; transient paste-to-review import with keyed deduplication and explicit key-loss recovery; monthly category budgets; due/paid bill records; user-initiated CSV export. Shared Expo SQLite contract on Android/iOS/web. No automatic inbox import, forecast or bank balance claim. Rohan owns iOS implementation and device checks.
- **Later import feasibility:** Android SMS live capture/catch-up/backfill (issue #16), iOS App Intents/Shortcuts (issue #17), additional bank parser fixtures, receipt scanning and connected email. Merchant learning, app lock and distribution flavors remain separate decisions/work.
- **v1.1:** encrypted backup/restore, home-screen widget, iOS share extension.
- **v2:** advanced recurring detection, insights, search/filters, tags, split entries, custom category tree.
- **Out of scope:** user accounts, backend sync, Account Aggregator / bank linking, AI/ML, investments, bill-splitting with friends, multi-currency, ads.

## Known risks

- SDK 58 beta / RN 0.88 RC: third-party lag (Drizzle expo-sqlite driver, Reanimated, `@expo/ui`), EAS image changes. Headless JS and the iOS App Intent flow remain unverified.
- Bank SMS formats change without notice → Review inbox + fixture-driven rules.
- iOS: verify the complete Shortcuts-to-ledger flow on a real device in #17.

## Git

- Commits are authored by the repo owner's git identity. **Do not add `Co-Authored-By` or any AI attribution lines** to commits or PRs.
- Conventional Commits (`feat(parser): …`, `fix(android): …`). See CONTRIBUTING.md.
