# GitHub Branch Protection Setup

Go to **Settings → Rules → Rulesets → New ruleset → New branch ruleset** and configure:

## Ruleset: Protect main

- **Ruleset name:** Protect main
- **Enforcement status:** Active
- **Target branches:** Add target → Include default branch

### Rules to enable:

1. **Restrict deletions** — on
2. **Require a pull request before merging** — on
   - Required approvals: **1**
   - Require review from Code Owners: **on**
   - Dismiss stale pull request approvals when new commits are pushed: **on**
   - Require approval of the most recent reviewable push: **on**
3. **Require status checks to pass** — on
   - Add these required checks:
     - `All Frontend Checks Passed` (from frontend-tests.yml)
     - `test` (from backend-tests.yml)
   - Require branches to be up to date before merging: **on**
4. **Block force pushes** — on
5. **Require linear history** — on (optional, keeps history clean)

### Bypass list (only you can merge without a PR):

- Click **Add bypass** → Add yourself (`Sharkywrecks`) with **Always** bypass

This means:
- External contributors must open a PR and get your approval
- Status checks (backend tests + frontend tests + lint) must pass
- You can bypass all rules when needed (direct push, merge without review)
- Nobody else can push directly to main or force-push