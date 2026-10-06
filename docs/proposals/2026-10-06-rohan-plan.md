# Original Rohan proposal - 2026-10-06

Preserved from commit 35157cb. Historical planning snapshot. The user subsequently approved keeping Rohan's implemented monorepo and adapting the repository foundation around it. CLAUDE.md and PRODUCT.md describe the current state.

---

# CLAUDE.md

Guidance for Claude Code (and humans) working in this repo. Product context is in [README.md](README.md); workflow is in [CONTRIBUTING.md](CONTRIBUTING.md). This file records **decisions and conventions** — keep it current when a decision changes.

> **Status:** planning complete, scaffolding not started. Commands below are the intended scripts; update this file if they change during scaffolding.

## What we're building

A mobile-first personal expense tracker for India. USP: it reads bank / UPI / card / wallet transaction SMS on-device and logs debits and credits automatically. Users can still add, edit, delete and re-categorise anything manually. Effortless, minimal taps, no setup friction. Working name `finance-bro`; the product name is decided after v1.

## Stack

- **Expo SDK 58 (beta)**, React Native 0.88 RC, TypeScript (strict), New Architecture only.
- **Development build** via `expo-dev-client` — never Expo Go (we ship custom native code).
- **Expo Router** (tabs: Home, Insights, Budgets, Settings; add/edit as modal sheets).
- **expo-sqlite + Drizzle ORM** (migrations, `useLiveQuery`). The DB is the source of truth.
- **Zustand** for small UI-only state. No React Query (there is no server).
- **@expo/ui** native components where mature, Reanimated + haptics for motion.
- **pnpm workspaces + Turborepo**, `node-linker=hoisted` (try isolated installs later).
- **Vitest** for packages, Jest + React Native Testing Library for the app. **EAS Build** for binaries.

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
apps/mobile/                  Expo app
  app/                        Expo Router routes
  src/{db,features,ui,lib}/
  modules/sms-reader/         Kotlin local Expo module + config plugin (Android SMS)
  modules/transaction-intent/ Swift App Intent + JavaScriptCore parser bundle (iOS)
packages/sms-parser/          Pure TS parser: pipeline, rules/, extractors/, matching/
  fixtures/                   Anonymised real SMS samples, one folder per institution
packages/merchant-catalog/    Merchant / UPI VPA → default category data
packages/config/              Shared tsconfig, eslint, prettier
```

## Commands (intended)

```bash
pnpm install
pnpm dev                       # start Metro for the dev client
pnpm test                      # all tests via Turborepo
pnpm typecheck && pnpm lint
pnpm --filter sms-parser test  # parser only
pnpm parser:try "<sms text>"   # print the parse result for one SMS
pnpm parser:anonymise <file>   # scrub names/digits/VPAs from raw samples
pnpm build:android:dev         # EAS development build (APK)
pnpm build:ios:dev             # EAS development build (internal distribution)
```

## Hard rules

1. **Parser is pure.** `packages/sms-parser` has no React Native, Expo, DB or `Date.now()` imports. Time and locale are passed in. Same input → same output.
2. **Money is integer paise** (`amountPaise: number`). Never floats. Format only at the UI edge.
3. **Never hand-edit `android/` or `ios/`.** They are generated (CNG). All native config goes through config plugins in `modules/*` or `app.config.ts`.
4. **SMS is read-only.** We never send, delete, mark-read or modify SMS. We do not copy SMS bodies into our DB (see Privacy).
5. **No network calls with user data** without explicit, opt-in consent. No analytics/ads SDKs. Crash reporting, if added, is opt-in.
6. **Every parser rule has at least one positive fixture**; CI fails otherwise. Every bug fix in parsing starts with a failing fixture.
7. **Fixtures are anonymised** before commit — no real names, account digits, VPAs, phone numbers or reference numbers.
8. **The app must be fully usable without SMS permission** (manual entry + paste). This is a store-compliance requirement, not a nice-to-have.
9. Pin exact versions while on the beta. Use `npx expo install` for Expo-managed packages.

## Architecture decisions

### SMS parsing pipeline (`packages/sms-parser`)

```
{sender, body, receivedAt}
 → normalise       whitespace, ₹ / Rs. / INR → one token, Indian digit grouping (1,23,456.00)
 → resolveSender   "VM-HDFCBK-S" → { institution: 'hdfc', dltSuffix: 'S' }
 → classify        transaction | otp | promo | mandate_notice | balance_info | unknown
 → institution rules in priority order (first match wins)
 → generic fallback rules (keyword + amount, low confidence → Review inbox)
 → ParseResult { kind, txn?, ruleId, ruleVersion, confidence }
```

- One file per institution: `rules/banks/<bank>.ts`, `rules/upi/<app>.ts`, `rules/cards/<issuer>.ts`, `rules/wallets/<wallet>.ts`.
- A rule = `{ id, version, senders, pattern (named groups), build(groups) }`. Shared extractors (amount, last4, UPI ref, VPA, balance, date) are reused, not re-implemented per rule.
- Deterministic rules/regex only. **No AI/ML.**
- Unknown-but-financial-looking messages go to a **Review inbox**, never silently dropped.

### Edge cases (owned by the parser / `matching/`)

| Case | Handling |
|---|---|
| OTP, promo, "pre-approved", limit offers | `classify` → ignored. `-P` DLT suffix treated as promo (verify against real samples). |
| "Will be debited", AutoPay/mandate notices | `mandate_notice` → upcoming item, not a transaction |
| UPI collect requests ("has requested money") | Ignored |
| Failed / declined | `status: 'failed'`, excluded from totals |
| Refunds, reversals | `kind: 'refund' \| 'reversal'`, linked to the original via `linkedTxnId` (merchant + amount + window) |
| Same SMS seen twice | Idempotent via `dedupeKey` (sender + body hash + time bucket) |
| Same txn from bank + UPI app + card | Merge on UPI ref; else last4 + amount + direction within ±10 min |
| Own-account transfers, card bill payments, wallet top-ups | Paired as `kind: 'transfer'`, excluded from spend |
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

- **v1 (MVP):** monorepo + parser (~10 major banks, GPay/PhonePe/Paytm, the maintainer's cards/wallets) with fixtures; Android live capture + catch-up + 90-day backfill; dedupe/transfer/refund/failed handling; manual add/edit/delete/re-categorise; merchant auto-categorisation that learns; Home feed, month summary, category breakdown; Review inbox; app lock; iOS App Intent (JSC parser) + Shortcuts onboarding + paste; CSV export; Play `play`/`sideload` flavours.
- **v1.1:** budgets, encrypted backup/restore, home-screen widget, iOS share extension.
- **v2:** recurring payment detection + upcoming bills, insights, search/filters, tags, split entries, custom category tree.
- **Out of scope:** user accounts, backend sync, Account Aggregator / bank linking, AI/ML, investments, bill-splitting with friends, multi-currency, ads.

## Known risks

- SDK 58 beta / RN 0.88 RC: third-party lag (Drizzle expo-sqlite driver, Reanimated, `@expo/ui`), EAS image changes. Spike Headless JS (Android) and JSC-in-App-Intent (iOS) in week 1.
- Play may deny SMS permissions → `play` flavour must stand on its own.
- Bank SMS formats change without notice → Review inbox + fixture-driven rules.
- iOS: verify on a real device that messages filtered into "Transactions"/"Unknown Senders" still trigger the automation.

## Git

- Commits are authored by the repo owner's git identity. **Do not add `Co-Authored-By` or any AI attribution lines** to commits or PRs.
- Conventional Commits (`feat(parser): …`, `fix(android): …`). See CONTRIBUTING.md.
