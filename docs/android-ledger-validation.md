# Android ledger validation — 2026-10-07

Device: Motorola Edge 60 Pro, Android 17. Installed client: `com.rohangupta.financebro.dev`. JavaScript source: `1253a71` plus a temporary test harness served through Metro. The installed APK's build revision was not independently identified; Expo SQLite loaded and executed successfully in this client.

The harness used `native-ledger-check-20261007.db`, separate from the app's `finance-bro.db`, with six fictional records. It exercised the existing ledger API, generated migrations, Drizzle async executor and paste preparation/save API on the physical phone.

Observed passes:

- Upgraded schema version 1 to the current schema while retaining a correction and deletion tombstone.
- Saved expense and income records; linked a fictional account/category; edited an expense and soft-deleted an imported record.
- Rejected zero, negative, fractional, non-finite and unsafe money at the API boundary, a missing account reference, and fractional paise through direct SQLite insertion.
- Two simultaneous reviewed paste saves produced one insertion and one duplicate.
- Paste replay preserved a user correction, and replay after deletion retained the tombstone.
- Read back six rows, including a 600-character note, dates, account/category links and parser provenance. Imported updates could not overwrite a manual correction or resurrect a deleted record.

Process restart persistence passed after the user fully closed and reopened the app. ADB confirmed a different app process; the harness read all six records and rechecked corrections, tombstones, provenance, long results and replay protection. This check passed on two subsequent harness executions.

The visible paste demo also parsed a fictional INR 450 debit to Swiggy and displayed `−₹450.00 · Swiggy · expense`. This demo does not save transactions.

The isolated test database was deleted successfully through Expo SQLite after validation. The temporary harness and entry-point changes were removed; the original app shell was restored.

`pnpm check` passed typechecking, lint, eight ledger tests and 31 parser tests (parser results were served from Turbo's existing cache). These Node checks are separate from the observed native checks above.

Metro initially listened only on IPv6 localhost, which failed through the IPv4 USB reverse connection. Starting with `--lan` and `REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1` resolved it. No dependency or native configuration change was needed.

This validates storage APIs through a test harness. Manual-entry, feed and paste-review screens are not connected, so their user flows remain unverified. iOS, automatic SMS capture, background processing, backups and signed release builds were not exercised. No message inbox was read, and the app's main ledger was not changed.
