# finance-bro

> Working name. The product name will be decided after v1.

A mobile-first personal expense tracker for India that **logs your spending for you**. It reads bank, UPI, credit card and wallet transaction SMS on your phone and records every debit and credit automatically. You only step in to fix something.

**Status:** early development. The monorepo, app shell and SMS parser core are in place; SMS capture, the ledger and the iOS intent are next.

## Why

Expense trackers fail because logging is a chore. In India almost every payment (UPI, card, netbanking, wallet) already produces an SMS. This app turns those messages into a clean ledger with no setup and no bank linking.

## Features

**v1**
- Automatic logging from transaction SMS on Android, including in the background, plus a one-time import of the last 90 days
- iOS: a "Log transaction from SMS" App Intent, triggered by a one-time Shortcuts automation, with a paste fallback
- One-tap category fixes from a notification; swipe to edit or delete
- Merchant auto-categorisation (Swiggy, Zomato, Uber, BigBasket, …) that learns from your corrections
- Correct totals: transfers between your own accounts, card bill payments and wallet top-ups don't count as spending; refunds link to the original purchase; failed transactions are excluded; duplicate SMS are merged
- A Review inbox for messages that look financial but weren't recognised
- Fast manual entry: amount, category, save
- Month summary and category breakdown, biometric app lock, CSV export

**Later:** budgets, encrypted backup, home-screen widget, iOS share extension (v1.1); recurring payment detection, insights, search and filters (v2).

**Deliberately not included:** accounts or sign-in, a backend, bank linking, AI/ML, investments, ads.

## Privacy

- Everything is parsed **on your device**. There is no server.
- SMS are **read only**. The app never sends, deletes or changes a message, and it does not copy message text into its database. Unrecognised messages are held only until you review them.
- Nothing leaves your phone unless you export it yourself.

## Platforms and distribution

| | How transactions arrive | Distribution |
|---|---|---|
| Android (Play Store) | SMS, if Google approves the SMS permission declaration; otherwise manual entry, paste and share | Google Play |
| Android (sideload) | SMS, automatic and in the background | APK on GitHub Releases |
| iOS | Shortcuts automation → App Intent, or paste | App Store |

Google Play restricts SMS permissions, so the app is built to work fully without them. See [CLAUDE.md](CLAUDE.md#store-distribution-play-store--app-store-sms-may-be-denied) for details.

## Tech

Expo SDK 58 (beta) with a development build · React Native 0.88 · TypeScript · Expo Router · expo-sqlite + Drizzle · pnpm workspaces + Turborepo · local Expo modules in Kotlin (SMS) and Swift (App Intent). The SMS parser is a separate, pure-TypeScript package with fixture-driven tests.

```
apps/mobile/               the Expo app (+ native modules in apps/mobile/modules)
packages/sms-parser/       SMS → transaction rules, with anonymised fixtures
packages/config/           shared tooling config
packages/merchant-catalog/ merchant / UPI ID → category data (planned)
```

## Getting started

```bash
pnpm install
pnpm test
pnpm parser:try "Rs.450 debited from A/c XX1234 to VPA shop@ybl" --sender VM-HDFCBK-S
```

Running the app on a phone needs a development build. See [CONTRIBUTING.md](CONTRIBUTING.md#setup).

## Contributing

The most valuable contribution is **an SMS format we don't recognise yet**. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to anonymise and submit samples.

## Acknowledgements

UX inspired by [Sushi – Personal Finance](https://github.com/jerameel/sushi).
