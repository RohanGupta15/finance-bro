# CLAUDE.md

Guidance for Claude Code (and humans) working in this repo. Product context is in [README.md](README.md); workflow is in [CONTRIBUTING.md](CONTRIBUTING.md). This file records **decisions and conventions** — keep it current when a decision changes.

> **Status:** Expo app shell and generic SMS parser, plus the local ledger storage foundation. A data-side paste review/save contract is implemented (see docs/ledger.md); ledger screens and the review UI are not yet connected. Institution rules, native SMS/App Intent modules and ledger UI remain planned.

## What we're building

A mobile-first personal expense tracker for India. USP: it reads bank / UPI / card / wallet transaction SMS on-device and logs debits and credits automatically. Users can still add, edit, delete and re-categorise anything manually. Effortless, minimal taps, no setup friction. Working name `finance-bro`; the product name is decided after v1.

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

Dev builds use `APP_VARIANT=development` (set in `eas.json`), giving the id `com.rohangupta.financebro.dev` so a dev build and a store build can be installed side by side. `com.rohangupta.financebro` is a working id and **must be final before the first store upload**.

## Hard rules

1. **Parser is pure.** `packages/sms-parser` has no React Native, Expo, DB or `Date.now()` imports. Time and locale are passed in. Same input → same output.
2. **Money is integer paise** (`amountPaise: number`). Never floats. Format only at the UI edge.
3. **Never hand-edit `android/` or `ios/`.** They are generated (CNG). All native config goes through config plugins in `modules/*` or `app.config.ts`.
4. **SMS is read-only.** We never send, delete, mark-read or modify SMS. We do not copy SMS bodies into our DB (see Privacy).
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
     { kind: 'review', candidate: txn | null, ruleId | null, ruleVersion | null }   → Review inbox
     { kind: 'ignored', reason }
```

- One file per institution: `rules/banks/<bank>.ts`, `rules/upi/<app>.ts`, `rules/cards/<issuer>.ts`, `rules/wallets/<wallet>.ts`, registered in `rules/index.ts`.
- A rule = `{ id, version, institutions?, match(sms) → { txn, confidence } | null }`. Reuse the extractors in `src/extract/`; don't re-implement them per rule. Institution rules built from real samples should return `high`.
- The generic rule returns `medium` only when the sender is a known institution (or the SMS has a UPI ref) **and** there is an anchor (last4 / VPA / ref). Otherwise it returns `low`, which becomes `review`.
- `occurredAt` is the SMS arrival time; dates in the message body are not parsed yet.
- Deterministic rules/regex only. **No AI/ML.** Avoid regex lookbehind; the same bundle must run in Hermes and in iOS JavaScriptCore.
- Unknown-but-financial-looking messages go to a **Review inbox**, never silently dropped.
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
| Same SMS seen twice | Idempotent via `smsDedupeKey` (sender + body hash + 60 s bucket) |
| Same txn from bank + UPI app + card | `isSameTransaction`: equal UPI ref; else different institutions, same amount + direction + status, compatible last4, within ±10 min. Same-institution alerts are never merged. |
| Own-account transfers, card bill payments | `isTransferPair`: debit and credit of the same amount between two of the user's own last4s within 2 h → `kind: 'transfer'`, excluded from spend. Wallet top-ups (often no last4) still need a rule. |
| ATM withdrawal | `kind: 'cash_withdrawal'` |

### Android SMS (`modules/sms-reader`, Kotlin)

- Permissions `RECEIVE_SMS`, `READ_SMS`, `POST_NOTIFICATIONS` are added by the module's config plugin.
- Manifest `BroadcastReceiver` for `SMS_RECEIVED` (works when the app is killed). It pre-filters cheaply on sender/keywords and enqueues the message reference.
- A **Headless JS** task runs the TS parser immediately and posts a notification ("₹450 · Swiggy · Food — tap to change"). *Unproven on the New Architecture → spike first; fallback is draining the queue on app open.*
- **Catch-up on every app open:** query the SMS inbox from the last processed platform message id. This recovers anything missed by OEM battery killers (Xiaomi/Oppo/Vivo) and is the same code path as the first-run backfill (last 90 days).
- JS API: `requestPermission()`, `queryInbox({ sinceId, limit })`, `drainQueue()`, `onSms` event.

### iOS (`modules/transaction-intent`, Swift)

- App Intent `LogTransactionFromSMS(text: String)`, `openAppWhenRun = false`, returns a confirmation dialog ("Logged ₹450 · Swiggy").
- **Parsing runs inside the intent** using the same `sms-parser` compiled to a single JS bundle and executed in `JavaScriptCore`. One parser, both platforms. The intent writes to the app's SQLite DB.
- User sets up **one** Shortcuts automation: "When I get **any** message → Log transaction from SMS → Run Immediately, Notify When Run off". Non-transactional messages are discarded on-device. Apps cannot create automations programmatically, so onboarding provides an illustrated step-by-step guide, a `shortcuts://` deep link, and a live "send yourself a test SMS" check.
- Fallbacks: paste box, and clipboard detection on foreground. Share extension is v1.1.

### Store distribution (Play Store + App Store, SMS may be denied)

- **Google Play:** `READ_SMS` / `RECEIVE_SMS` are restricted permissions. Apps must be the default SMS handler or qualify for an exception ("SMS-based money management" has been one) via the Permissions Declaration Form + demo video. Approval is discretionary.
- Therefore we build **two Android flavours from one codebase**, selected by an env var in `app.config.ts`:
  - `play` — submitted with the SMS declaration. If denied, ship it with the SMS module's permissions stripped (config plugin flag) and rely on manual + paste + share-to-app.
  - `sideload` — full SMS features, distributed as an APK (GitHub Releases). Onboarding explains Android's "Allow restricted settings" step for sideloaded apps. Watch Google's sideloading developer-verification rollout.
- **App Store:** no SMS permission involved; App Intents + Shortcuts are standard. Privacy label targets "Data Not Collected".
- Both stores need a privacy policy and data-safety disclosures; keep them consistent with the Privacy section below.

### Privacy

- All parsing on-device. No backend, no accounts, no bank linking.
- **SMS bodies are not copied into our DB.** We store the parsed transaction plus metadata: platform message id, sender, body hash, `ruleId`, `ruleVersion`. On Android, re-parsing after a rule improvement re-reads from the system inbox by id.
- Exception: an **unparsed** message in the Review inbox keeps its body only until the user resolves or dismisses it, then the body is deleted.
- Biometric app lock and a hide-amounts toggle.
- Backup (v1.1) is a user-initiated encrypted file export to a location they pick. Nothing is uploaded by the app.

### Data model (Drizzle / SQLite)

- `accounts`: id, name, institution, type (`bank|credit_card|wallet|upi_lite|cash`), last4, isOwn, archived
- `transactions`: id, amountPaise, direction (`debit|credit`), kind (`expense|income|transfer|refund|reversal|cash_withdrawal`), status (`posted|failed|pending`), accountId, counterparty, merchantId, categoryId, occurredAt, note, source (`sms|manual|ios_intent|paste`), smsRefId, upiRef, dedupeKey, linkedTxnId, excludeFromStats, userEdited, createdAt, updatedAt, deletedAt
  - `userEdited = true` → never overwritten by re-parsing. `deletedAt` = soft delete (undo, and blocks re-import).
- `sms_refs`: id, platformId, sender, bodyHash, receivedAt, parseStatus (`parsed|ignored|unknown|failed`), ruleId, ruleVersion, pendingBody (nullable, Review inbox only)
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

- **v1 (MVP):** monorepo + parser (~10 major banks, GPay/PhonePe/Paytm, the maintainer's cards/wallets) with fixtures; Android live capture + catch-up + 90-day backfill; dedupe/transfer/refund/failed handling; manual add/edit/delete/re-categorise; merchant auto-categorisation that learns; Home feed, month summary, category breakdown; Review inbox; app lock; iOS App Intent (JSC parser) + Shortcuts onboarding + paste; CSV export; Play `play`/`sideload` flavours.
- **v1.1:** encrypted backup/restore, home-screen widget, iOS share extension.
- **v2:** advanced recurring detection, insights, search/filters, tags, split entries, custom category tree.
- **Out of scope:** user accounts, backend sync, Account Aggregator / bank linking, AI/ML, investments, bill-splitting with friends, multi-currency, ads.

## Known risks

- SDK 58 beta / RN 0.88 RC: third-party lag (Drizzle expo-sqlite driver, Reanimated, `@expo/ui`), EAS image changes. Spike Headless JS (Android) and JSC-in-App-Intent (iOS) in week 1.
- Play may deny SMS permissions → `play` flavour must stand on its own.
- Bank SMS formats change without notice → Review inbox + fixture-driven rules.
- iOS: verify on a real device that messages filtered into "Transactions"/"Unknown Senders" still trigger the automation.

## Git

- Commits are authored by the repo owner's git identity. **Do not add `Co-Authored-By` or any AI attribution lines** to commits or PRs.
- Conventional Commits (`feat(parser): …`, `fix(android): …`). See CONTRIBUTING.md.
