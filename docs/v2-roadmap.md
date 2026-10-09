# Finance Bro 2.0 — effortless, private financial understanding

Approved direction: Suvo's 2026-10-09 request authorizes this roadmap, feature decisions and task assignment. This is a delivery plan, not a claim that these capabilities exist. [PRODUCT.md](../PRODUCT.md) remains the scope authority. Current implementation is the connected manual-first ledger; automatic capture, recovery, reconciliation, forecasts, receipts and email require the gates below.

## The product we will ship

Open Finance Bro and understand three things: what was spent, what needs attention, and what can safely be spent next. Supported financial messages become transactions with minimal effort; uncertainty becomes visible review. Every number has an explanation, every correction survives re-import, and every important record can be recovered. Manual entry remains fast and usable offline with every optional permission denied.

The differentiator is trustworthy automation plus useful decisions on the device. A futuristic interface or a newer package version cannot substitute for exact totals, capture recovery or understandable forecasts. Keep Rohan's Ink and Stamps identity and progressively disclose complexity.

## Settled choices

| Area | Selected implementation | Boundary / completion evidence |
| --- | --- | --- |
| App and storage | Existing Expo monorepo, one Expo SQLite/Drizzle ledger contract on Android/iOS/web | Versioned migrations, integer paise and protected edits/tombstones; no second app, server or app account |
| Distribution | Apache-2.0, main F-Droid first; iOS delivery owned by Rohan | Licensing decision is confirmed but LICENSE adoption is pending PR #28. Entire runtime/build graph and clean source build must pass #27; no claim of F-Droid acceptance |
| Automatic Android messages | Native Kotlin SMS receiver + READ_SMS inbox catch-up, WorkManager for best-effort deferred work, catch-up on every app open | Opt-in history window defaults to 90 days after preview; source references/cursors survive, message bodies do not. Force-stop, OEM restrictions, inbox deletion and locked keys are explicit recovery cases |
| Automatic iOS messages | User-created Shortcuts Message automation invoking a Swift App Intent; same parser bundle in JavaScriptCore | Future trigger-matching messages only. No general inbox access or historical SMS backfill. #17 must prove filters, broad-trigger feasibility, actual text input and locked execution on an iPhone before advertising automation |
| Import safety | One coordinated ingestion API, keyed HMAC fingerprints and transactional source cursors | Stable source identity first; strong transaction evidence for cross-source matching. Weak identity/unknown account/amount ambiguity stays review. Auto-save only verified high-confidence rules after consent |
| Merchant categorization | Explicit local correction rules + curated on-device catalog | User edits outrank rules. Save a future rule only with a deliberate action; parser stays deterministic |
| Money understanding | Dated opening balances, reconciliation checkpoints, linked transfers/card settlements | Recorded cash flow is distinct from calculated or verified account balance; missing coverage suppresses totals that cannot be known |
| Planning | Recurring expected income/bills, opt-in local due reminders, explicit budget rollover and savings allocations | Schedules are expectations, not posted transactions; actual payment links prevent double counting |
| Forecast | Deterministic conservative safe-to-spend and scenario-based month-end estimate | Disclose inputs/history/date/reserve; separate liquid assets, liabilities and monthly income remainder; incomplete data stays visible |
| Insights | Local, explainable spending-change, recurring-charge and shortfall detection | At most three actionable findings; each links to supporting entries. No cloud model or unsupported financial advice |
| Recovery | Password-encrypted versioned archive using libsodium Argon2id + XChaCha20-Poly1305; validated temporary restore and atomic replacement | Binding/source-build compatibility gate before code; maintained audited crypto, no custom implementation. Wrong password, corruption or interruption preserves the old ledger. Password loss has no recovery service |
| Receipt OCR | Bundled source-buildable Tesseract on Android; native Apple Vision adapter on iOS | Engine/binding/model license, accuracy, latency and size gate first. Always review extracted money; images/raw OCR are transient |
| Connected email | Direct native Gmail OAuth with PKCE + gmail.readonly, local parsing and bounded sync | [#52](https://github.com/Starforge-lab/finance-bro/issues/52) must prove native-client/distribution feasibility and restricted-scope obligations. Provider setup is separate authorization; no proxy/server fallback or hidden mailbox-scope narrowing claim |
| Native convenience | Privacy-redacted widgets, quick-add, share import, biometric app access lock | Widget/notification amounts hidden by default; UI app lock is not a claim of database-at-rest encryption |
| Toolchain | Newest compatible Expo-managed versions, SDK-versioned docs and measured hardware behavior | Keep #3 advisories visible; failing compiler/lint/SDK upgrades do not qualify as bleeding-edge functionality |

Notification-listener capture is excluded from the 2.0 critical path: it has broad access, redaction/truncation and no reliable historical backfill. No cloud sync, bank linking, social/shared finances, paid AI service or multi-currency accounting is added. These increase scope without solving the current India/INR workflow better.

## Privacy and identity contract

1. Request source-specific consent before native message access, mailbox connection or photo/camera use. Planning and issue assignment grant no access to real messages or account credentials.
2. Process SMS, Shortcut input, emails, receipt images and OCR text transiently. Never put raw content in SQLite, durable queues, logs, telemetry, crash reports or GitHub. Structured financial records and minimal provenance are permitted.
3. Android can re-read a system inbox reference while permission and source exist. Other sources have structured review or unavailable counts with manual/paste recovery; never promise reopening unavailable content.
4. Preserve corrections and deletion markers through replay, new rules, retries and backup restore. Two genuine identical no-reference purchases must not disappear as a duplicate; unresolved identity needs explicit review.
5. Backup key recovery respects existing key protections. Native exportable HMAC material belongs only inside the encrypted archive and is reinstalled in protected storage. WebCrypto's existing nonextractable key is not made extractable: fresh-origin restore declares a changed key epoch, retains identities/tombstones and requires duplicate review. Same-origin key reuse must be validated. CSV remains an unencrypted transaction export, not recovery.
6. Source connections and parsing are local. Gmail necessarily communicates with the selected provider under consent; financial content is never uploaded to a Finance Bro backend, analytics or cloud AI.

## Delivery order and ownership

Tracked in [2.0 epic #58](https://github.com/Starforge-lab/finance-bro/issues/58). Current PR repairs are assigned to Rohan in [#57](https://github.com/Starforge-lab/finance-bro/issues/57).

Suvo (`suvodeep12`) owns shared domain/data/parser work, Android, web and final integration. Rohan (`RohanGupta15`) owns **all iOS implementation, adapters and device checks**, plus the design contract and current UI review repairs. An issue's primary assignee is accountable for shared delivery; iOS subtasks remain Rohan's responsibility, recorded in each issue and consolidated in [#55](https://github.com/Starforge-lab/finance-bro/issues/55). Neither is assigned an artificial deadline.

| Phase / milestone | Deliverables and dependencies | Exit gate |
| --- | --- | --- |
| 0 — Safety and recovery | Complete remaining manual-first acceptance (#8–#15), iOS baseline #34, encrypted recovery [#42](https://github.com/Starforge-lab/finance-bro/issues/42); fix UI review blockers | Migration/write/restore failures preserve data; verified fresh-install recovery. Manual flows usable without import permissions |
| 1 — Automatic capture | Device feasibility #16/#17 → shared ingestion [#43](https://github.com/Starforge-lab/finance-bro/issues/43) → Android [#44](https://github.com/Starforge-lab/finance-bro/issues/44) / iOS [#45](https://github.com/Starforge-lab/finance-bro/issues/45); verified bank and merchant rules [#46](https://github.com/Starforge-lab/finance-bro/issues/46) | Consented real-device capture and replay matrix; visible misses/review; no raw-text retention, duplicates or lost corrections. No iOS automation claim without #17 evidence |
| 2 — Financial understanding | Reconciliation [#47](https://github.com/Starforge-lab/finance-bro/issues/47) → recurring planning [#48](https://github.com/Starforge-lab/finance-bro/issues/48) → safe-to-spend/forecast [#49](https://github.com/Starforge-lab/finance-bro/issues/49) → actionable insights [#50](https://github.com/Starforge-lab/finance-bro/issues/50) | Exact money and recorded/projected separation; incomplete history and missing accounts handled truthfully; every insight traceable |
| 3 — Complete product and release | Offline receipts [#51](https://github.com/Starforge-lab/finance-bro/issues/51); Gmail feasibility [#52](https://github.com/Starforge-lab/finance-bro/issues/52) → gated Gmail import [#53](https://github.com/Starforge-lab/finance-bro/issues/53); Android surfaces [#54](https://github.com/Starforge-lab/finance-bro/issues/54) / iOS integrations [#55](https://github.com/Starforge-lab/finance-bro/issues/55); F-Droid #27 and release matrix [#56](https://github.com/Starforge-lab/finance-bro/issues/56) | All mandatory feature/platform/provider gates pass at a recorded revision. A blocked iOS/email gate keeps 2.0 incomplete; signing and publication are separately authorized |

Start #16 (Suvo), #17/#34 (Rohan) and [#42](https://github.com/Starforge-lab/finance-bro/issues/42)'s format/crypto design in parallel. Shared schema changes have one owner and integrate sequentially. Android hardware experiments can use an isolated fictional database before all-platform recovery is complete; production automatic writes wait for the ingestion/recovery gates. iOS feasibility must produce an explicit input/output/concurrency contract before the shared automatic ingestion API is finalized.

Existing #3 remains the compatibility/advisory owner task; #4/#35/#36 remain Rohan's design/theme tasks. #5 remains the import umbrella; #7 remains the v1 delivery tracker. Existing v1 issues are assigned and retained until their acceptance evidence is complete; code being merged does not automatically close platform-verification gaps.

## Definition of 2.0 readiness

- Mandatory automatic Android SMS capture and a proven iOS Shortcuts path, with supported formats/platform limitations published. Direct Gmail and receipt import meet their provider/source-build gates. Missing feasibility is a blocker, not a completed feature.
- For the labelled acceptance corpus: zero false-positive auto-saves; ambiguous cases go to review. Report corpus size, supported institutions and exact parser versions so a passing set is not advertised as universal bank coverage.
- For replay/recovery scenarios: zero duplicate accepted transactions, protected-edit overwrite, deleted-record resurrection, silent write loss or exact-money discrepancy. Include simultaneous sources, two genuine same-amount purchases, upgrades and key loss.
- Reconciliation, bills and forecasts share the same documented posted/failed/pending/refund/transfer rules. Expected events do not become spending until a real transaction is linked or entered.
- Encrypted archive restores on a fresh install, with archive authentication/migrations/key epochs checked. Failure leaves existing data intact; sensitive intermediates and destination cancellation are checked on each platform.
- All core flows work offline with SMS/mail/photo/notification permissions denied. Background jobs are best effort with visible last-success/catch-up recovery; app-open recovery is tested.
- Test 10k/50k fictional ledgers, pagination/indexes and list virtualization where needed. Measure startup, query/import latency, scroll smoothness, catch-up energy and OCR latency on actual hardware. Pin performance budgets from that measured baseline before optimization; do not invent device-independent numbers.
- Android and iPhone physical checks, responsive web/keyboard checks, light/dark, TalkBack/VoiceOver, large text, reduced motion and interruption tests recorded against exact builds. Exports/APK compilation are separate evidence.
- CONTRIBUTING.md checks and `git diff --check` pass, free GitHub CI is green, peer approval and resolved discussions are present. A clean FLOSS source build and dependency/license audit pass before F-Droid submission.
- Small manual usability study with Suvo, Rohan and willing testers records completion, taps/time and wrong interpretations for adding, reviewing, correcting, understanding safe-to-spend and restoring. Use fictional records; no analytics SDK. Set improvement targets from the baseline, not competitor marketing.

Live delivery status and validation evidence belong in [#57](https://github.com/Starforge-lab/finance-bro/issues/57) and [#58](https://github.com/Starforge-lab/finance-bro/issues/58), rather than this plan.

## Evidence

Read [the platform feasibility research](research/2026-10-09-v2-platform-feasibility.md) before automatic import, OCR or email implementation; it links current primary sources and identifies device/provider uncertainties. The [existing personal-finance benchmark](https://github.com/Starforge-lab/finance-bro/pull/32) informs correction, recovery and low-friction workflows but does not prove Finance Bro outcomes. [docs/v1-ui.md](v1-ui.md), [the data contract](v1-data-layer.md) and [Android validation](android-ledger-validation.md) separate implemented behavior from outstanding verification.
