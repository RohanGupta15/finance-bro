# Android CSV destination validation

PR #66 implements one-document save-as for #15. This check uses fictional CSV
content only; it does not open the user's ledger or request folder access.

## Observed failure

On the Motorola Edge 60 Pro, Android 17, the development client built before the
patch opened the system picker, but saving failed. Both `File.write` and
`File.delete` rejected the destination because it was an Android `Intent`
description rather than a `content://` URI. A temporary blank QA route made the
failed test appear as a black screen; the app process remained running.

The installed `expo-intent-launcher@58.0.3` bridge calls `toString()` on
`OnActivityResultPayload.data`, which is an `Intent`. The pinned pnpm patch calls
`toString()` on that intent's `data` URI instead, preserving extras and result
codes. Remove the patch when a compatible upstream release includes this fix.
This changes native code: existing development clients must be rebuilt.

The first rebuilt client (`c6db4d4`, APK run `37967460598`) passed cancellation
but saving still returned an invalid destination. Its Gradle log linked
`expo-intent-launcher` as a precompiled publication, so the source patch did not
reach that binary. The application now opts just this module into
`expo.autolinking.android.buildFromSource`. This is required for patched native
source under SDK 58; a successful APK build alone did not prove the fix shipped.
See [Expo's precompiled-module guidance](https://docs.expo.dev/guides/prebuilt-expo-modules/).

The shared destination helper also rejects malformed or non-content destinations
before any write or cleanup operation. Its regression test failed before the
guard and passed after it. The patch is version-specific and recorded in the
lockfile; no dependencies or build-script permissions were upgraded.

## Remaining physical check

A rebuilt client must pass all three user-driven picker cases:

1. Cancel: `saveCsv` returns `cancelled` without touching a document.
2. Save: the single chosen document reads back the exact fictional CSV bytes.
3. Injected write failure: only that incomplete document is removed, and the
   original write error propagates. Provider refusal to delete must retain the
   existing explicit cleanup-failure message.

These cases remain unverified on the patched client. PR #66 stays draft until
they pass; the earlier successful APK build and mocked tests do not prove them.
iOS CSV export is a separate remaining gate.
