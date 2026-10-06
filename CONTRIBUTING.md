# Contributing

Thanks for helping. Read [CLAUDE.md](CLAUDE.md) first: it holds the architecture, decisions and hard rules. This file covers the workflow.

## Prerequisites

- Node.js LTS and **pnpm** (`corepack enable`)
- An Android phone and/or iPhone. SMS capture and App Intents need real devices; emulators can't fully test them.
- An Expo account for **EAS Build** (iOS builds don't need a Mac)
- Android Studio (optional, for local Android builds)

## Setup

```bash
pnpm install
pnpm test                # parser tests run with no device needed
```

To run the app on a phone:

```bash
npm i -g eas-cli && eas login
cd apps/mobile && eas init   # once: links the project to your Expo account
pnpm build:android:dev       # or build:ios:dev; install the result on your device
pnpm dev                     # start Metro, then open the dev build
```

This project uses a **development build**, not Expo Go. Rebuild the dev client whenever a native module, config plugin or native dependency changes.

## Workflow

1. Open or pick an issue. For parser work, have the SMS sample ready (anonymised).
2. Branch from `main`: `feat/…`, `fix/…`, `parser/<institution>-…`, `chore/…`.
3. Write a failing test first for parser and matching logic.
4. Run `pnpm typecheck && pnpm lint && pnpm test` before pushing.
5. Open a PR using the checklist below.

### Commits

[Conventional Commits](https://www.conventionalcommits.org/) with a scope:

```
feat(parser): add ICICI credit card debit format
fix(android): resume SMS catch-up after reboot
docs: clarify iOS Shortcuts setup
```

Scopes: `parser`, `catalog`, `app`, `db`, `android`, `ios`, `build`, `deps`, `docs`.

Commits must be authored by you, under your own git identity. Don't add AI co-author or attribution trailers.

## Adding a new SMS format

This is the most common contribution.

1. **Anonymise the sample** (by hand for now; a `pnpm parser:anonymise` helper is planned). Replace:
   - names → `RAHUL SHARMA`-style placeholders
   - account and card digits → `XX1234`
   - VPAs → `merchant@okaxis` or `user@ybl`
   - phone numbers, UPI reference numbers and balances → fake values in the same format

   Keep spacing, punctuation, casing and sender ID exactly as received, because the format is what we're testing.
2. **Add a fixture** to a JSON file under `packages/sms-parser/fixtures/<type>/<institution>/` (e.g. `fixtures/banks/hdfc/upi.json`). Each file holds a `cases` array:
   ```json
   {
     "note": "Where these samples came from (e.g. 'HDFC savings, received Oct 2026').",
     "cases": [
       {
         "name": "UPI debit to merchant VPA",
         "sender": "VM-HDFCBK-S",
         "body": "…anonymised text…",
         "receivedAt": "2026-10-06T10:15:00+05:30",
         "expected": {
           "kind": "transaction",
           "ruleId": "hdfc.upi.debit",
           "confidence": "high",
           "txn": { "amountPaise": 45000, "direction": "debit", "accountLast4": "1234", "channel": "upi", "upiRef": "123456789012" }
         }
       }
     ]
   }
   ```
   `txn` is a partial match, so list only the fields you care about. Other expected shapes are `{ "kind": "ignored", "reason": "otp" }` and `{ "kind": "review", "ruleId": null }`. Also add **negative fixtures** for look-alikes from the same sender: OTP, promo, failed, reminder and collect request. Every `*.json` under `fixtures/` is picked up by `test/fixtures.test.ts` automatically.
3. **Run the tests** and confirm the new fixture fails (or passes for the wrong reason).
4. **Write or extend the rule** in `src/rules/<type>/<institution>.ts` and register it in `src/rules/index.ts`. Reuse the extractors in `src/extract/`. If you change an existing rule's behaviour, bump its `version`.
5. **Run all parser tests.** Every fixture must pass, and every rule needs at least one positive fixture.
6. Try it manually: `pnpm parser:try "<sms>" --sender VM-HDFCBK-S`.

**Never commit an un-anonymised SMS**, including in issues, PR descriptions or test names.

## Native modules

- Native code lives only in `apps/mobile/modules/*` (Expo Modules API). Don't edit or commit `android/` or `ios/`; they are generated.
- Manifest, entitlement and Info.plist changes go through the module's config plugin.
- After a native change, run prebuild, rebuild the dev client, and test on a real device. Describe the device and OS version in the PR.

## Database changes

- Change the Drizzle schema, then generate a migration. Don't hand-edit applied migrations.
- Test the migration against a seeded DB that has existing data.
- Amounts are integer paise. Transactions with `userEdited = true` must never be overwritten by automation.

## Pull request checklist

- [ ] `pnpm typecheck`, `pnpm lint` and `pnpm test` pass
- [ ] Parser changes include positive and negative fixtures; all samples are anonymised
- [ ] No new network calls involving user data (or explicit opt-in consent is in place)
- [ ] The app still works with SMS permission denied
- [ ] Native changes were tested on a real device (device and OS listed)
- [ ] CLAUDE.md is updated if a decision or convention changed

## Reporting an unrecognised SMS

Open an issue titled `SMS: <institution> <type>` (e.g. `SMS: Kotak UPI credit`) with the **anonymised** text, the sender ID, and what you expected (debit or credit, amount, account).
