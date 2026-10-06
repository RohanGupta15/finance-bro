# Branching and releases

Keep two long-lived branches. `dev` is the integration line and intended GitHub default branch; `main` is the stable release line. The owner must apply the default-branch setting below.

- `dev` receives everyday work and holds the next release.
- `main` contains the latest promoted release.

## Everyday changes

Start short-lived `feat/<name>`, `fix/<name>`, `parser/<institution>-<change>`, or `chore/<name>` branches from `dev`. Open a pull request into `dev` and squash-merge it. Delete the short-lived branch after merging.

## Releasing

Open a pull request from `dev` into `main` and merge it with a merge commit. Do not squash permanent-branch promotions; the merge commit records which integration state was released. After each promotion, open a pull request from `main` back into `dev` and merge it with a merge commit. This keeps the permanent branches' ancestry in sync for the next release's up-to-date check.

For an urgent fix, branch `hotfix/<name>` from `main`, open a pull request into `main`, and merge it with a merge commit. Then sync `main` back into `dev` with a merge-commit pull request so the fix is included in the next release.

## GitHub protection

Once an administrator applies the repository rulesets below, GitHub will require changes to reach `main` and `dev` through pull requests. The rulesets require one approval from a code owner, approval after the latest push, resolved review comments, and the `Validate and bundle` check on an up-to-date branch. They block force pushes and branch deletion. This also protects `main` and `dev` from the automatic deletion of merged head branches. The `main` ruleset permits merge commits only. The `dev` ruleset permits both merge commits and squash merges so release and sync PRs can preserve ancestry while everyday changes stay compact.

The source-branch names and feature-to-`dev` routing above are team conventions; the target-branch rulesets do not enforce them. GitHub applies the merge-method restrictions by target branch.

## Security analysis

The CodeQL workflow scans JavaScript and TypeScript on pushes and pull requests to `dev` and `main`, with an additional weekly scan. Review results in the repository's **Security → Code scanning** tab. `Validate and bundle` is the required branch check; CodeQL currently reports findings separately.

## Apply the repository settings

These files describe the desired GitHub settings; no branch protections are active until an administrator applies the rulesets. The current `suvodeep12` GitHub session has write access but not admin access. Make sure `main` and `dev` exist and CI has run before requiring its status check. From the repository root, sign in as `RohanGupta15` or another repository administrator and run this PowerShell block. It updates rulesets by name when they already exist, creates missing ones, and enables automatic branch deletion only after both protections are in place:

```powershell
$rulesets = @(gh api repos/RohanGupta15/finance-bro/rulesets | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0) { throw 'Could not list repository rulesets.' }

$desiredRulesets = @(
  @{ Name = 'Protect main'; File = '.github/rulesets/main.json' },
  @{ Name = 'Protect dev'; File = '.github/rulesets/dev.json' }
)

foreach ($desired in $desiredRulesets) {
  $existing = @($rulesets | Where-Object { $_.name -eq $desired.Name })
  if ($existing.Count -gt 1) { throw "Resolve duplicate rulesets named $($desired.Name) first." }

  if ($existing.Count -eq 1) {
    gh api --method PUT "repos/RohanGupta15/finance-bro/rulesets/$($existing[0].id)" --input $desired.File
  } else {
    gh api --method POST repos/RohanGupta15/finance-bro/rulesets --input $desired.File
  }
  if ($LASTEXITCODE -ne 0) { throw "Could not apply ruleset $($desired.Name)." }
}

gh api --method PATCH repos/RohanGupta15/finance-bro --input .github/repository-settings.json
if ($LASTEXITCODE -ne 0) { throw 'Could not update repository merge settings.' }
gh api repos/RohanGupta15/finance-bro/rulesets --jq '.[] | {id, name, enforcement}'
```

GitHub requires repository administration write access to manage rulesets. If the repository settings update rejects `delete_branch_on_merge`, enable that option in Settings → General after confirming both protections are active. See [GitHub's repository ruleset API](https://docs.github.com/en/rest/repos/rules) and [repository settings API](https://docs.github.com/en/rest/repos/repos#update-a-repository).


## GitHub Free and ownership

This repository is public, so repository-level branch rulesets and CodeQL are available with GitHub Free. Keep workflows on standard hosted runners; this setup requires no paid GitHub feature. See [ruleset availability](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets).

Personal repositories have an owner and collaborators; collaborators cannot be promoted to a separate admin role. Rohan can apply the settings as owner. Shared administration would require a separately agreed transfer to a GitHub Free organization and repository Admin roles for both maintainers.

After merging the foundation, the owner should enable available free Dependabot alerts, secret scanning/push protection and private vulnerability reporting in Settings → Security. Confirm the CodeQL workflow is the active setup and avoid running conflicting default and advanced configurations. The collaborator could not inspect that setting due insufficient permissions. Track activation in [issue #2](https://github.com/RohanGupta15/finance-bro/issues/2).
