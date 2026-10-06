# Finance Bro — agent guide

## Start here

1. Inspect git status and the relevant callers before editing. Suvo and Rohan work concurrently; preserve their changes and fetch before preparing a PR. Ask before resolving a material conflict between their requirements or implementations.
2. For scope or architecture changes, read PRODUCT.md as the authority for confirmed requirements; CLAUDE.md supplies technical plans. Plans are not implemented capabilities. Reuse settled decisions and ask only about unresolved material choices before dependent work.
3. For changes, follow CONTRIBUTING.md. For branch creation, promotion, hotfixes or merging, read docs/branching.md. Use the smallest solution that meets the agreed scope.

## Architecture boundaries

- apps/mobile is the shared Expo app. src/app contains routes; screen bodies belong in src/screens, shared UI in src/components, and visual tokens in src/constants/theme.ts.
- packages/sms-parser is deterministic TypeScript consumed as source. Keep it independent of Expo, React Native, storage, network and wall-clock time; pass timestamps explicitly.
- packages/config contains shared TypeScript configuration. Preserve the existing pnpm workspace rather than adding a second app or package manager.
- The implemented app is a tab shell and paste-to-parse demo. Ledger persistence, native SMS capture, iOS App Intents, receipt OCR and connected email are future work. Ask before adding a backend, accounts, retention policies or new import providers.
- Validate imported money as safe integer paise before accepting it; send invalid or ambiguous inputs to review. Formatting belongs at the UI edge. Future imports must preserve user corrections and avoid duplicate transactions. Read CLAUDE.md before changing matching, import or storage behavior; follow PRODUCT.md's privacy/recovery requirements and keep device secrets outside the pure parser.

## Changes and dependencies

Use the pnpm version in package.json and commit pnpm-lock.yaml. For Expo dependencies, run pnpm --dir apps/mobile exec expo install <package> and consult the docs for the installed SDK major at https://docs.expo.dev/versions/v58.0.0/.

Use the newest compatible releases, including the selected SDK beta. Read SECURITY.md and issue #3 before changing toolchain versions: some newer compiler/lint APIs are not yet supported. Review lockfile and build-script approval changes; preserve the explicit allowBuilds list instead of approving all dependencies.

F-Droid dependency changes: read CLAUDE.md's clean source-build and transitive dependency gates before adding packages.

Keep generated android/ and ios/ folders out of commits. Native configuration belongs in app.config.ts and config plugins. Changing native dependencies requires rebuilding the development client; EAS account linking, signing and paid services need explicit authorization.

For parser changes, follow CONTRIBUTING.md's fixture format: add positive and negative anonymised cases, register rules in src/rules/index.ts, and bump a changed rule's version. Parser bug fixes start with a failing fixture. The existing fixture suite checks rule coverage.

For UI work, use exactly one design skill: impeccable for product screens; design-taste-frontend for a separate marketing surface. Custom finance screens follow approved mockups. Preserve accessible labels, disabled states, readable text, dark mode and responsive web behavior.

## Verification and completion

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm --dir apps/mobile exec expo install --check
pnpm --dir apps/mobile dlx expo-doctor
pnpm build
```

For visible changes, exercise the affected browser flow with fictional data. Native changes also need the relevant real-device check; state when device access is unavailable. Exporting bundles does not create signed apps or prove native behavior.

Finish by reviewing the combined diff against the request and checking git diff --check. Report checks actually observed, existing failures, unresolved advisories and unverified device behavior. Update the relevant scope/workflow document when behavior changes; keep command definitions in package.json authoritative.

## GitHub collaboration

Use gh for issues, PRs, checks and repository inspection. For substantial work, reuse an existing issue with acceptance criteria and link its PR. Create issues within the user-authorized GitHub scope; otherwise record acceptance criteria in the task. Keep reviews read-only unless fixes are requested. Commit with Conventional Commits, publish an authorized PR, and wait for CI. Do not merge or close unfinished work without authorization.

Start short-lived branches from dev; main is the stable release line. Follow the branch guide for review and merge methods. Protection files describe desired settings until the owner applies them. Use GitHub Free features only; confirm availability before adding a feature or service.

## Financial privacy

Use fictional or fully anonymised examples in code, fixtures, screenshots, logs, issues and PRs. Keep credentials, financial records, receipts and message bodies out of GitHub. Keep raw message/receipt content out of runtime logs, telemetry and crash reports. SMS access is read-only. Sending user data or connecting message sources requires explicit opt-in consent; introduce no analytics or ads by default.
