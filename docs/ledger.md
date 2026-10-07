# Local ledger

The local data layer uses Expo SQLite and Drizzle on Android, iOS and web. It is local to each device/browser; there is no sync or hosted backend. See [the v1 API contract](v1-data-layer.md) for manual entry, queries/totals, budgets, bills, CSV and key-recovery rules. Custom screens remain separate work.

Queries use Drizzle's `sqlite-proxy` adapter with a local async Expo SQLite executor. Despite the adapter name, it makes no network requests. The SDK 58.0.10 synchronous web bridge truncates the encoded length of results above 255 bytes; a browser check exposed this failure. Using async operations avoids that bridge on every platform. Database operations return promises; always await them. Live-query hooks tied to Drizzle's synchronous Expo driver are not integrated.

## Shared contract

Accounts, categories, transactions, monthly category budgets, bills and public import-key identifiers are implemented. IDs are caller-supplied stable strings. Amounts are positive safe integer paise; direction carries debit/credit. Transaction dates use `Date` values at the TypeScript boundary and epoch milliseconds in SQLite; budgets use `YYYY-MM` and bills actual calendar `YYYY-MM-DD` dates. Nullable account/category references allow uncategorized entries. Transactions can retain parser rule ID/version. Raw message text and fingerprint secrets are never ledger fields.

User changes set `userEdited`; deletion retains a tombstone. Automatic updates must use the guarded ledger operation rather than unrestricted database updates. The same transaction ID cannot overwrite a correction or resurrect a deletion. General cross-source identity matching and cryptographically keyed import fingerprints remain import work; the storage API alone does not deduplicate messages with different IDs.

## Pasted message review/save contract (#12 data layer)

Screens use `preparePaste` and `saveReviewedPaste` on `await getLedger()`. Preparation uses the shared deterministic parser and the platform-keyed fingerprint provider; it may initialize the public key marker, but never writes a transaction. Both confident transactions and ambiguous candidates require review. Ignored messages return a reason and cannot be saved. A review with no candidate requires the user to supply missing transaction fields. Low-level `preparePastedSms(raw, fingerprinter)` is asynchronous and requires an explicit provider.

Call the service's `saveReviewedPaste(prepared, corrections)` only after explicit user confirmation. Corrections use ledger types, including integer paise and `Date` timestamps. The save validates through the shared ledger and returns `inserted` or `duplicate`. It atomically inserts a user-protected transaction, preserving parser provenance; it never updates an existing transaction, including tombstones. Correcting transaction values does not change the prepared identity. Key changes/legacy imports require explicit duplicate-risk acknowledgement; see the v1 contract.

Repeated pastes use an identity independent of the paste time. Matching UPI references can identify differently worded alerts, while distinct directions/statuses/kinds remain separate money movements. Without a reference, identical sender/body content is treated conservatively as a replay, even on another day. Two genuine identical messages without a unique reference cannot be distinguished by this paste flow; use manual entry for the second transaction. General fuzzy matching, transfer pairing and legacy rows saved with caller-selected IDs are outside this contract.

New persistent paste identities/body fingerprints use device-keyed HMAC-SHA256. The pure parser's non-cryptographic helper is not used at this storage boundary. Native secrets use SecureStore and browser secrets use nonextractable WebCrypto keys in IndexedDB. SQLite retains only a public key identifier. Key-store failure rejects; key loss/legacy rows require duplicate review rather than silently regenerating equivalent identity. Encrypted key backup/restore is deferred.

Preparation retains parsed fields and identity metadata, never the full raw body. Rohan's screen owns the transient input: clear it after completion or dismissal, and display save errors without logging the message. The review UI is not connected yet; this contract does not complete the screen acceptance criteria of #12. No inbox permission, network service, or new dependency is required.

## Migrations and checks

Change `src/db/schema.ts`, then run `pnpm --dir apps/mobile db:generate`. Register the new SQL import in `src/db/migrations.ts` under its matching `m0001` (etc.) key. Commit the generated SQL and snapshot/journal files; never edit an applied migration. SQL is bundled with Babel inline-import. Startup migrations are atomic and fail without resetting the database. A database from a newer app version must be opened by that version, not silently downgraded.

`pnpm check` includes the ledger's Node SQLite checks. They exercise generated migrations and the shared operations with fictional records, including reopen persistence, corrections, deletion markers and rollback. They do not replace real Android/iOS checks.

## Web persistence

Web uses Expo SQLite's WebAssembly/OPFS implementation. Run `pnpm --dir apps/mobile web:preview` and open `http://127.0.0.1:8082`. The local preview sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless`. A deployed host must send the same headers and serve `.wasm` as `application/wasm`; router header configuration is included for compatible Expo hosting, without provisioning a host.

The browser must support cross-origin isolation and OPFS on a secure origin (localhost is suitable for local checks). Unsupported browsers must fail visibly when a consuming screen opens storage; there is no in-memory fallback that pretends to save. Clearing site data, private browsing, browser eviction or a different origin can remove or separate the ledger. Export/backup remain separate roadmap work. Browser persistence is not shared with the phone.

## Native builds and dependencies

On 2026-10-07, an installed development client on a Motorola Edge 60 Pro running Android 17 passed isolated native ledger checks, including migration, validated writes, corrections, tombstones, concurrent paste saves and persistence after an app process restart. The visible fictional paste demo also passed. See [the validation record](android-ledger-validation.md) for evidence and limits. Connected ledger/review screens and iOS behavior remain unverified.

Adding Expo SQLite requires rebuilding the development client. Existing clients cannot acquire the native module through Metro alone. Signing/build-service setup is separate from local storage work.

Expo SQLite and await-lock use MIT licenses; Drizzle ORM is Apache-2.0; Drizzle Kit and inline-import use MIT. The SQLite Android build compiles bundled SQLite source by default and does not add Firebase Messaging. These scoped checks do not establish that the complete app meets F-Droid's clean-source/transitive build requirements; that remains #27. The explicit workspace build-script allowlist is unchanged.
