# Manual-first MVP roadmap

Suvo approved this delivery sequence on 2026-10-06 after Rohan offered to take design. [PRODUCT.md](../PRODUCT.md) is the product authority; [CLAUDE.md](../CLAUDE.md) supplies technical conventions. This roadmap records build order; current implementation and scoped validation are in [the UI record](v1-ui.md) and [data contract](v1-data-layer.md). Track acceptance and remaining work in [issue #7](https://github.com/Starforge-lab/finance-bro/issues/7).

## Delivery stages

| Stage | Outcome | Completion gate |
| --- | --- | --- |
| 1. Foundation and design | Verified repo; approved transaction, entry, budget and bill flows | Foundation PR #6 merged; designs under #4 approved before dependent UI work |
| 2. Working ledger | Local storage, categories, manual expenses/income, feed/totals, edit/delete | Entries survive reopening; valid money and correct totals; corrections remain protected |
| 3. First usable MVP | Reviewed paste SMS import, monthly category budgets, bill due/paid tracking, CSV export | Everyday tracking works without message permissions; duplicate imports cannot overwrite edits or resurrect deletions |
| 4. Automatic imports | Optional proven Android and iOS import paths | Real-device experiments justify implementation; denied/revoked-permission fallback works |
| 5. Later entry and recovery | Receipt OCR, connected email, encrypted backup/restore | Provider, consent and privacy decisions agreed before dependent implementation |

Run native feasibility experiments during stage 2. Neither automatic SMS nor a store release is a prerequisite for the first usable MVP. No time estimates are agreed. Manual entry remains available when any import is unavailable.

## Issues and dependencies

Rohan owns design. Implementation issues remain unassigned until a maintainer picks them; choose one owner per issue. The storage owner establishes the shared transaction contract before consumers build against it.

| Issue | Work | Depends on |
| --- | --- | --- |
| [#4](https://github.com/Starforge-lab/finance-bro/issues/4) | Rohan's approved designs and states | Existing shell and product requirements |
| [#8](https://github.com/Starforge-lab/finance-bro/issues/8) | Local ledger schema and migrations | Foundation #1 / merged PR #6 |
| [#9](https://github.com/Starforge-lab/finance-bro/issues/9) | Manual expense/income entry | #8, approved entry design in #4 |
| [#10](https://github.com/Starforge-lab/finance-bro/issues/10) | Transaction feed and monthly totals | #8, approved ledger design in #4; integrate #9 |
| [#11](https://github.com/Starforge-lab/finance-bro/issues/11) | Edit/delete/category changes | #8, #9, #10, approved edit design in #4 |
| [#12](https://github.com/Starforge-lab/finance-bro/issues/12) | Review and save pasted SMS | #8, #9, #11, approved import design in #4 |
| [#13](https://github.com/Starforge-lab/finance-bro/issues/13) | Monthly category budgets | #8, #10, approved budget design in #4 |
| [#14](https://github.com/Starforge-lab/finance-bro/issues/14) | Bill due dates and paid status | #8, approved bill design in #4 |
| [#15](https://github.com/Starforge-lab/finance-bro/issues/15) | Local CSV export | #8, #11; custom export UI follows #4 |
| [#16](https://github.com/Starforge-lab/finance-bro/issues/16) | Android SMS feasibility | Matching development build and consenting device access; #5 and #3 |
| [#17](https://github.com/Starforge-lab/finance-bro/issues/17) | iOS Shortcuts/App Intent feasibility | Matching build and real iPhone access; #5 and #3 |

Each issue defines acceptance criteria and validation. Native experiments may use isolated fictional data before the ledger is ready; integrating automatic writes depends on the shared storage contract. Keep provider decisions under the existing import umbrella [#5](https://github.com/Starforge-lab/finance-bro/issues/5), toolchain advisories under [#3](https://github.com/Starforge-lab/finance-bro/issues/3), and owner-only repository settings under [#2](https://github.com/Starforge-lab/finance-bro/issues/2).

## Shared Expo project and builds

The app is linked to `@starforge-lab/finance-bro` through `apps/mobile/app.config.ts`. Keep shared EAS builds under that project. The free GitHub Actions Android development build and EAS commands are documented in [CONTRIBUTING.md](../CONTRIBUTING.md); build success does not prove device behavior. Signing, account changes and publication require authorization.

## Deliberate scope boundaries

- The first MVP includes expenses/income, simple monthly category budgets and bills. Budget rollover, recurring bill generation, scheduled notifications and automatic paid detection are later work. Marking a bill paid does not silently add a transaction.
- Preserve the shared Expo SQLite/Drizzle contract on Android, iOS and web. No backend, app accounts, sync, analytics or ads.
- Preserve safe integer paise, import provenance, user corrections and deletion markers. Keep the parser deterministic. Do not make raw message content a durable ledger record or log it.
- CSV is user-initiated export, not encrypted recovery. Receipt/email providers, permissions and local-only compatibility require separate agreement.
- Do not promise automatic imports, bank coverage, background behavior or store approval based on parser tests or bundle exports. Native access requires consent and real-device evidence. Signing/account setup, paid services and publishing require separate authorization.

## Pick, implement, review, merge

1. Pick an unblocked issue and claim ownership. Confirm its acceptance criteria; unresolved material choices must be settled before dependent code.
2. Fetch and branch from `dev`; preserve concurrent edits. Design and platform experiments can proceed independently of storage, while shared schema changes stay coordinated with its owner.
3. Implement only the issue's slice; link its PR and list actual validation. Follow [CONTRIBUTING.md](../CONTRIBUTING.md) and [the branch guide](branching.md).
4. Obtain peer review, pass required CI and resolve comments before merging into `dev`. Do not close unfinished issues or treat plans as capabilities.

## Android readiness observed on 2026-10-06 (historical)

Windows detected the USB device and Android debugging interface. After Suvo accepted the debugging prompt, ADB authorized the Motorola Edge 60 Pro. Device properties reported Android 17 / API 37. The app package query found no Finance Bro installation.

That check established connection readiness only. Later ledger and UI device checks are recorded in [Android ledger validation](android-ledger-validation.md) and [UI validation](v1-ui.md). They do not establish SMS capture/catch-up or iOS App Intent behavior. Device identifiers and financial content are excluded from this record.
