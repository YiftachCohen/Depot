# Depot — Fork Implementation Plan

## Context

Depot is a fork of Craft Agents v0.7.5 (Apache 2.0) that transforms the app from **session-centric** to **skill-centric**. The motivation: enterprise developers who run Claude through AWS Bedrock need visual, one-click skill dispatching — not a generic chat inbox. The codebase already has substantial Bedrock scaffolding (`LlmProviderType = 'bedrock'`, IAM credential storage, `BedrockVertexModelFetcher` stub) and a full skill system (SKILL.md + YAML frontmatter, 3-tier loading).

**Ruflo workflow**: `workflow-1773424980210-6doiaw`
**Ruflo tasks**: `task-...-t750su` (Bedrock), `task-...-389wr4` (Dashboard), `task-...-qraicn` (History), `task-...-2egkbq` (Rebrand)

---

## Sprint 1: Bedrock Provider (Week 1-2)

### 1.1 Bedrock Auth Env Resolution
**Modify**: `packages/shared/src/config/llm-connections.ts` — `resolveAuthEnvVars()` (line ~653)
- Add Bedrock branch inside `isAnthropicProvider` block
- For `iam_credentials`: retrieve via `credentialManager.getLlmIamCredentials()`, set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- For `environment` auth: pass through (SDK uses default credential chain)
- Set `CLAUDE_CODE_USE_BEDROCK=1` to route SDK subprocess through Bedrock

### 1.2 Bedrock Env Helper (new file)
**Create**: `packages/shared/src/agent/backend/internal/drivers/bedrock-env.ts`
- Export `getBedrockEnvOverrides(connection, credentials)` → env var map
- Imported by anthropic driver when `connection.providerType === 'bedrock'`

### 1.3 Model Discovery
**Modify**: `packages/server-core/src/model-fetchers/bedrock-vertex.ts`
- Replace stub with `@aws-sdk/client-bedrock` `ListFoundationModels` API
- Filter for Anthropic Claude models
- **Dep**: add `@aws-sdk/client-bedrock` + `@aws-sdk/client-bedrock-runtime`

### 1.4 Connection Setup UI
**Modify**: `apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx`
- Add Bedrock form: region dropdown, IAM fields, "Use SSO/Environment" toggle

**Modify**: `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx`
- Surface Bedrock as visible provider option

### Verification
- Unit test `resolveAuthEnvVars()` with bedrock configs
- Integration: create Bedrock connection, verify env vars before SDK subprocess launch
- Manual: run session against actual Bedrock endpoint

---

## Sprint 2: Skill Model + Session Metadata (Week 3-4)

### 2.1 Add skillSlug to Session Model
**Modify**: `packages/shared/src/sessions/types.ts`
- Add `skillSlug` to `SESSION_PERSISTENT_FIELDS`, `SessionConfig`, `SessionHeader`, `SessionMetadata`

**Modify**: `apps/electron/src/renderer/atoms/sessions.ts`
- Add `skillSlug?: string` to `SessionMeta`

### 2.2 depot.yaml Manifest
**Create**: `packages/shared/src/skills/depot-manifest.ts`
- `DepotManifest` interface: `quickCommands[]`, `defaultProvider`, `tags`
- `QuickCommand`: `{ label, prompt, icon?, variables? }`

**Modify**: `packages/shared/src/skills/types.ts`
- Add `depotManifest?: DepotManifest` to `LoadedSkill`

**Modify**: `packages/shared/src/skills/storage.ts`
- In `loadSkillFromDir()`, check for `depot.yaml` alongside SKILL.md, parse with `js-yaml`

### 2.3 Skill-Scoped Session Creation
**Modify**: `apps/electron/src/shared/routes.ts`
- Add `skill` param to `newSession` route

**Modify**: `apps/electron/src/renderer/App.tsx`
- When `skill` param present, set `skillSlug` on session config

### 2.4 Session Skill Badge
**Modify**: `apps/electron/src/renderer/components/app-shell/SessionItem.tsx`
- Render small skill badge (icon + name) when `skillSlug` is set

### Verification
- Unit test YAML parsing with valid/invalid manifests
- Verify session serialization roundtrip with `skillSlug`
- Verify old sessions without `skillSlug` load without errors

---

## Sprint 3: Skill Dashboard + Filtering (Week 5-6)

### 3.1 Skill Dashboard Component
**Create**: `apps/electron/src/renderer/components/app-shell/SkillDashboard.tsx`
- Grid of skill cards using existing `skillsAtom`
- Each card: icon (via `SkillAvatar`), name, description, quick command buttons, last used, session count
- Quick command click → `routes.action.newSession({ input: prompt, skill: slug })`
- "Recent Sessions" section below the grid

### 3.2 Dashboard Route + Default Landing
**Modify**: `apps/electron/src/shared/routes.ts`
- Add `skillDashboard: () => 'skill-dashboard'`
- Add `skillSessions: (skillSlug, sessionId?) => ...`

**Modify**: `apps/electron/src/renderer/components/app-shell/AppShell.tsx`
- Default to `skill-dashboard` when skills exist; fallback to `allSessions`
- In sidebar, make skill items navigable to filtered session list

### 3.3 Session List Grouping
**Modify**: `apps/electron/src/renderer/components/app-shell/SessionList.tsx`
- Add "Group by Skill" to `ChatGroupingMode`
- Group sessions under skill headers with icon

### Verification
- Component renders correctly with 0, 1, and 10+ skills
- Quick command creates session with correct skillSlug and pre-filled prompt
- Skill filter shows only matching sessions
- Dashboard gracefully degrades when no skills exist

---

## Sprint 4: Rebrand & Polish (Week 7)

### 4.1 User-Facing Strings
- Keep `@depot/` import scope internally (minimizes diff, eases upstream sync)
- Only rebrand user-facing strings: window title, about dialog, error messages
- **Create**: `packages/shared/src/depot-branding.ts` with Depot constants

### 4.2 Assets
- Replace app icons in `apps/electron/src/renderer/assets/`
- Update `apps/electron/electron-builder.yml` (product name, app ID)

### 4.3 Example Skill Packs
- PM skill (Jira/Confluence integration, sprint planning commands)
- DevOps skill (log checking, deployment status commands)
- Code Review skill (PR review, test analysis commands)
- Place in `examples/skills/` directory

### 4.4 CI/CD + Docs
- GitHub Actions for macOS/Linux/Windows builds
- README with "Why Fork?" section, attribution, getting started

---

## Key Risks

| Risk | Mitigation |
|---|---|
| SDK env vars for Bedrock routing unclear | Verify exact flag names from claude-agent-sdk source before implementing |
| Session model migration (new field) | `skillSlug` is optional; `pickSessionFields()` is additive — old sessions safe |
| Default route change confuses users | Fallback to session inbox when no skills configured |
| Upstream sync friction | Prefer new files over modifications; keep internal package scope unchanged |
| AWS SSO credential chain in subprocess | Verify subprocess inherits env for `aws sso login` tokens |

---

## Design Principles
- **Additive over modificative**: new files > changed files for upstream sync
- **depot.yaml is optional**: SKILL.md still works standalone
- **Backward compatible sessions**: old sessions load fine without `skillSlug`
- **Conservative rebrand**: internal package names unchanged, only user-facing strings change
