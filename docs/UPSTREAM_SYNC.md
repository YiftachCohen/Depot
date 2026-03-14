# Upstream Sync: Rebase-on-Tagged-Releases

## Overview

Depot is a fork of Depot Agents. We track the upstream repository via tagged releases, rebasing periodically rather than tracking every commit. This keeps our history clean and limits the frequency of conflict resolution to well-defined release points.

## Strategy

We use a **rebase-on-tagged-releases** approach:

- An `upstream` remote points to the Depot Agents repository.
- When upstream publishes a new tagged release (e.g., `v0.8.0`), we rebase Depot's branch on top of that tag.
- Depot's additions are predominantly in **new files** (e.g., `depot-manifest.ts`, `SkillDashboard.tsx`, `skill-search.ts`) to minimize merge conflicts with upstream changes.
- A small number of upstream files carry Depot modifications. These require careful merge review during each rebase.

## Step-by-Step Rebase Process

### 1. Add the upstream remote (first time only)

```bash
git remote add upstream <craft-agents-repo-url>
```

### 2. Fetch upstream tags

```bash
git fetch upstream --tags
```

### 3. Rebase onto the new release tag

```bash
git checkout depot-main
git rebase upstream/v0.8.0
```

### 4. Resolve conflicts

If conflicts arise, resolve them file by file. Pay special attention to the conflict hotspots listed below.

```bash
# After resolving each file:
git add <resolved-file>
git rebase --continue
```

### 5. Verify the build

```bash
bun install    # upstream may have changed dependencies
bun test       # confirm nothing is broken
```

### 6. Push the rebased branch

```bash
git push --force-with-lease
```

`--force-with-lease` is safer than `--force` because it refuses to overwrite the remote if someone else has pushed in the meantime.

## Cherry-Picking Security Fixes

Between releases, critical security patches may need to be pulled individually without waiting for the next tagged release.

```bash
git fetch upstream
git cherry-pick <commit-hash>
bun test
```

If the cherry-pick conflicts, resolve manually, then:

```bash
git add <resolved-file>
git cherry-pick --continue
bun test
```

Always run the full test suite after cherry-picking to verify the patch applies cleanly in the Depot context.

## Conflict Hotspots

These are upstream files that Depot has modified. They are the most likely sources of merge conflicts during a rebase.

| File | Depot modification |
|---|---|
| `packages/shared/src/sessions/types.ts` | Added `skillSlug` field |
| `packages/shared/src/skills/storage.ts` | Modified `loadAllSkills` |
| `packages/server-core/src/sessions/SessionManager.ts` | Added `skillSlug` passthrough |
| `packages/shared/src/protocol/dto.ts` | Added fields |
| `packages/shared/src/protocol/channels.ts` | Added channels |
| `apps/electron/src/shared/types.ts` | Added ElectronAPI methods |

When resolving conflicts in these files, ensure that both the upstream changes and Depot's additions are preserved. If upstream has refactored an area that Depot also modified, manual integration is required rather than blindly accepting either side.

## Files We Own

These files are new to Depot and have no upstream equivalent. They will never conflict during a rebase.

- `packages/shared/src/skills/depot-manifest.ts`
- `packages/shared/src/skills/session-helpers.ts`
- `packages/server-core/src/services/skill-search.ts`
- `apps/electron/src/renderer/components/app-shell/SkillDashboard.tsx`
- `apps/electron/src/renderer/components/app-shell/TemplateVariableModal.tsx`
- `examples/skills/*`
- `.github/workflows/*`

## Release Cadence

- **Monthly**: Check upstream for new tagged releases.
- **Minor/patch releases** (e.g., `v0.7.x`, `v0.8.0`): Rebase promptly. These are typically safe and routine.
- **Major releases** (e.g., `v1.0.0`): Expect breaking changes. Allocate time for a thorough review of upstream changelog, dependency updates, and potential architectural shifts before rebasing.

## Checklist Template

Use this checklist when performing a sync:

```
- [ ] `git fetch upstream --tags`
- [ ] Identify the target tag (e.g., `v0.8.0`)
- [ ] Read upstream release notes / changelog for the tag
- [ ] `git rebase upstream/<tag>`
- [ ] Resolve conflicts in hotspot files
- [ ] `bun install`
- [ ] `bun test` passes
- [ ] Manual smoke test of skill dashboard and session creation
- [ ] `git push --force-with-lease`
- [ ] Update this document if new conflict hotspots or owned files have changed
```
