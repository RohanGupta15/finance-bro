# Local ledger

The storage foundation for #8 uses Expo SQLite and Drizzle on Android, iOS and web. It is local to each device/browser; there is no sync or backend. Manual-entry and ledger screens are separate work.

Queries use Drizzle's `sqlite-proxy` adapter with a local async Expo SQLite executor. Despite the adapter name, it makes no network requests. The SDK 58.0.10 synchronous web bridge truncates the encoded length of results above 255 bytes; a browser check exposed this failure. Using async operations avoids that bridge on every platform. Database operations return promises; always await them. Live-query hooks tied to Drizzle's synchronous Expo driver are not integrated.

## Shared contract

Only accounts, categories and transactions are implemented. IDs are caller-supplied stable strings. Amounts are positive safe integer paise; direction carries debit/credit. Dates use `Date` values at the TypeScript boundary and epoch milliseconds in SQLite. Nullable account/category references allow uncategorized entries. Enum values follow CLAUDE.md; raw message text is never a ledger field.

User changes set `userEdited`; deletion retains a tombstone. Automatic updates must use the guarded ledger operation rather than unrestricted database updates. The same transaction ID cannot overwrite a correction or resurrect a deletion. Cross-source identity matching and cryptographically keyed import fingerprints remain import work; the storage API alone does not deduplicate messages with different IDs.

## Migrations and checks

Change `src/db/schema.ts`, then run `pnpm --dir apps/mobile db:generate`. Register the new SQL import in `src/db/migrations.ts` under its matching `m0001` (etc.) key. Commit the generated SQL and snapshot/journal files; never edit an applied migration. SQL is bundled with Babel inline-import. Startup migrations are atomic and fail without resetting the database. A database from a newer app version must be opened by that version, not silently downgraded.

`pnpm check` includes the ledger's Node SQLite checks. They exercise generated migrations and the shared operations with fictional records, including reopen persistence, corrections, deletion markers and rollback. They do not replace real Android/iOS checks.

## Web persistence

Web uses Expo SQLite's WebAssembly/OPFS implementation. Run `pnpm --dir apps/mobile web:preview` and open `http://127.0.0.1:8082`. The local preview sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless`. A deployed host must send the same headers and serve `.wasm` as `application/wasm`; router header configuration is included for compatible Expo hosting, without provisioning a host.

The browser must support cross-origin isolation and OPFS on a secure origin (localhost is suitable for local checks). Unsupported browsers must fail visibly when a consuming screen opens storage; there is no in-memory fallback that pretends to save. Clearing site data, private browsing, browser eviction or a different origin can remove or separate the ledger. Export/backup remain separate roadmap work. Browser persistence is not shared with the phone.

## Native builds and dependencies

Adding Expo SQLite requires rebuilding the development client. Existing clients cannot acquire the native module through Metro alone. Signing/build-service setup is separate from local storage work.

Expo SQLite and await-lock use MIT licenses; Drizzle ORM is Apache-2.0; Drizzle Kit and inline-import use MIT. The SQLite Android build compiles bundled SQLite source by default and does not add Firebase Messaging. These scoped checks do not establish that the complete app meets F-Droid's clean-source/transitive build requirements; that remains #27. The explicit workspace build-script allowlist is unchanged.
