# Security

Do not include financial records, account details, message or email contents, receipts, credentials, or other sensitive data in public issues or pull requests.

Check the repository's **Security** tab for a **Report a vulnerability** option and use it if available. Private vulnerability reporting has not been confirmed as enabled, and no separate security contact or response timeline is published. If private reporting is unavailable, do not post vulnerability details publicly; contact a maintainer through GitHub and ask for a private reporting route.

## Known development-tooling advisories

A `pnpm audit` on 2026-10-06 reported three transitive advisories (two high, one moderate). These findings were in development/build tooling:

- `braces@3.0.3` — [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). No patched version was listed at the time of the audit.
- `node-forge@1.4.0` — [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), which concerns RSA PKCS#1 v1.5 signature verification accepting extra nested `DigestAlgorithm` elements. No patched version was listed at the time of the audit. The affected dependency path reaches Expo CLI's code-signing helper, which verifies configured certificates through `validateSelfSignedCertificate`; keep this finding visible rather than dismissing it.
- `uuid@7.0.3`, through the `xcode` dependency path — [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) concerns v3, v5, and v6 calls with caller-provided buffers. The reviewed path used the v4 API; no affected call was observed there.

No forced major upgrade or override was applied. Coordinate toolchain fixes with the maintainers and validate the supported SDK dependency set. Recheck the audit as the SDK toolchain changes; this status may become outdated.
