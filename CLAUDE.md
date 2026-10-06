# CLAUDE.md

Guidance for Claude Code (and humans) working in this repo. Product context is in [README.md](README.md); workflow is in [CONTRIBUTING.md](CONTRIBUTING.md). This file records **decisions and conventions** — keep it current when a decision changes.

> **Status:** scaffolded. Monorepo, Expo SDK 58 app shell (4 tabs) and the parser core with the generic rule are in place. Not built yet: institution rules (waiting on real samples), DB, native SMS/App Intent modules, ledger UI.

## What we're building

A mobile-first personal expense tracker for India. USP: it reads bank / UPI / card / wallet transaction SMS on-device and logs debits and credits automatically. Users can still add, edit, delete and re-categorise anything manually. Effortless, minimal taps, no setup friction. Working name `finance-bro`; the product name is decided after v1.

## Stack

- **Expo SDK 58 (beta)**, React Native 0.88 RC, TypeScript (strict), New Architecture only.
- **Development build** via `expo-dev-client` — never Expo Go (we ship custom native code).
- **Expo Router** (tabs: Home, Insights, Budgets, Settings; add/edit as modal sheets).
- Planned **expo-sqlite + Drizzle ORM** (migrations, `useLiveQuery`). The DB is the source of truth.
- Planned **Zustand** for small UI-only state. No React Query (there is no server).
- **@expo/ui** native components where mature, Reanimated + haptics for motion.
- **pnpm workspaces + Turborepo**, `node-linker=hoisted` (try isolated installs later). Turbo's auto-written `AGENTS.md` is disabled (`agentGuidance: false`); before changing Turbo config, read the docs bundled in `node_modules/turbo/docs/`, since Turbo changes between versions.
- **Vitest** for packages; Jest + React Native Testing Library are planned for app tests. **EAS Build** for binaries.

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
2. **Money is integer paise** (`amountPaise: number`). Never floats. Format only at the UI edge.
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
- Manifest `BroadcastReceiver` for `SMS_RECEIVED` (works when the app is killed). It pre-filters cheaply on sender/keywords and enqueues the message reference, never the message body.
- A **Headless JS** task may run the TS parser immediately and post a transaction notification. Message text is held in memory only while parsing. *Unproven on the New Architecture → spike first; fallback is draining references on app open.*
- **Catch-up on every app open:** query the SMS inbox from the last processed platform message id. This recovers anything missed by OEM battery killers (Xiaomi/Oppo/Vivo) and is the same code path as the first-run backfill (last 90 days).
- JS API: `requestPermission()`, `queryInbox({ sinceId, limit })`, `drainQueue()`, `onSms` event.
- Keep only the platform reference and minimal metadata. If Android can no longer reopen the original message, recover through manual entry or paste.

### iOS (`modules/transaction-intent`, Swift)

- Planned App Intent `LogTransactionFromSMS(text: String)`, `openAppWhenRun = false`, returns a confirmation dialog.
- Parsing uses the same pure `sms-parser` in JavaScriptCore. The input text is transient; successful imports store transaction data and minimal metadata. Failures increment a count only and recover through manual entry or paste.
- A Shortcuts automation is planned, but verify the complete Message → App Intent → ledger flow on a real iPhone in [issue #17](https://github.com/Starforge-lab/finance-bro/issues/17) before promising it. Non-transactional input is discarded after on-device parsing.
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
- Biometric app lock and a hide-amounts toggle.
- Backup (v1.1) is a user-initiated encrypted file export to a location they pick. Nothing is uploaded by the app.

### Data model (Drizzle / SQLite)

- `accounts`: id, name, institution, type (`bank|credit_card|wallet|upi_lite|cash`), last4, isOwn, archived
- `transactions`: id, amountPaise, direction (`debit|credit`), kind (`expense|income|transfer|refund|reversal|cash_withdrawal`), status (`posted|failed|pending`), accountId, counterparty, merchantId, categoryId, occurredAt, note, source (`sms|manual|ios_intent|paste`), smsRefId, upiRef, dedupeKey, linkedTxnId, excludeFromStats, userEdited, createdAt, updatedAt, deletedAt
  - `userEdited = true` → never overwritten by re-parsing. `deletedAt` = soft delete (undo, and blocks re-import).
- `sms_refs`: id, platformId, sender, bodyFingerprint, receivedAt, parseStatus (`parsed|ignored|unknown|failed`), ruleId, ruleVersion; never a message body
- `categories`: id, name, icon, color, parentId, kind (`expense|income`), isSystem, sortOrder
- `merchants`: id, displayName, aliases, vpaPatterns, defaultCategoryId
- `category_overrides`: matchType (`merchant|vpa|counterparty`), value, categoryId — learned from user re-categorisation
- v1.1+: `budgets`; v2: `recurring_series`

Every schema change ships a Drizzle migration, tested against a seeded DB.

## UX direction

Inspired by [Sushi](https://github.com/jerameel/sushi) — inspiration, not a template:
- Big total balance as the header, account cards in a horizontal row, date-grouped transaction feed with signed, colour-coded amounts (green credit / red debit), one primary "new transaction" action, filter chips (All / Debit / Credit), light + dark themes, a calm warm accent.
- Where we go further: auto-logged entries with one-tap category fix, number-pad-first manual add (~3 s), a Review inbox, and insights that state facts ("Food is 32% higher than last month") rather than chart walls.

## Scope

The confirmed initial finance workflows include expenses/income, budgets and bills; see PRODUCT.md. Receipt scanning and connected email are confirmed later entry requirements; providers and their fit with the local-only design remain open. The existing code is a parser and shell, not this full roadmap.

- **Implementation order (manual-first):** local ledger → manual entry → feed and totals → edit/delete/re-categorise → paste import, budgets and bills → CSV export. Further planned capabilities remain institution-specific parser rules with fixtures, merchant auto-categorisation, month/category breakdown, app lock, Android SMS capture/catch-up/90-day backfill, dedupe/transfer/refund/failed handling, Review without retained message text, and iOS App Intent/Shortcuts onboarding. Automatic imports have separate gates in PRODUCT.md and issues #16, #17, and #27.
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
