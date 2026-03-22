# TODOS

Deferred work from plan reviews and design sessions.

---

## Knowledge Fabric — Deferred Items

### TODO-KF-001: Knowledge Bridge (Cross-Agent Read-Only Queries)
**Priority:** P2 | **Effort:** L (human) → M (CC+gstack) | **Status:** Deferred
**Depends on:** Phase 1 shipping (core knowledge fabric)
**Source:** CEO Review 2026-03-22, cherry-pick ceremony

Allow agents to query other agents' knowledge stores read-only. Example: PM agent asks Log Analyzer "what services had incidents this week?" without duplicating the knowledge.

**Why:** The "team of 5 doing what 30 can" vision requires agents that collaborate — not just accumulate knowledge in silos. Cross-agent queries turn individual domain experts into a connected team.

**Cons:** Authorization model needed (which agents can read which?), query routing complexity, potential for noisy/irrelevant cross-agent results. Risk of tight coupling between agent knowledge schemas.

**Where to start:** Add a `query_knowledge` tool that accepts an `agent_id` parameter. Open the target agent's SQLite DB read-only, run the same tag-based retrieval, return results scoped to the requesting agent's prompt context.

---

### TODO-KF-002: Embedding-Based Retrieval Upgrade
**Priority:** P3 | **Effort:** L (human) → M (CC+gstack) | **Status:** Deferred
**Depends on:** Phase 1 shipping, Bedrock embedding API availability
**Source:** CEO Review 2026-03-22, TODOS proposal

Add optional vector embedding column to entities table + cosine similarity retrieval path. Tag-based retrieval works for precise queries but degrades on vague/semantic ones like "what's been causing issues lately?"

**Why:** Embeddings would be a 10x retrieval quality improvement for fuzzy queries. Enables "similar entity" discovery and semantic search across the knowledge graph.

**Cons:** Requires embedding API access (Bedrock Titan or local model), increases storage per entity, adds indexing complexity. Only viable when Bedrock exposes embedding endpoints or enterprise constraint relaxes.

**Where to start:** Add nullable `embedding BLOB` column to entities table. Implement cosine similarity in sql.js (pure SQL or JS UDF). Gate behind `knowledge.embedding_model` manifest field. Fall back to tag retrieval when embeddings unavailable.

---

### TODO-KF-003: Knowledge Export & Portability
**Priority:** P2 | **Effort:** M (human) → S (CC+gstack) | **Status:** Deferred
**Depends on:** Phase 1 shipping
**Source:** CEO Review 2026-03-22, TODOS proposal

Export/import agent knowledge as portable JSON bundles. Enables migrating agents between machines, sharing knowledge with teammates, backup/restore, and agent cloning.

**Why:** Enterprise teams need portability. "Set up the Log Analyzer on my colleague's machine with the same knowledge" is a real use case for the team productivity vision.

**Cons:** Merge conflicts on import (entity name+domain collisions need dedup strategy). Exported data may contain PII — needs warning/scrubbing option. Schema version compatibility across Depot versions.

**Where to start:** Add `export_knowledge` and `import_knowledge` RPC handlers. Export dumps entities/relationships/patterns/observations as JSON with schema version header. Import merges by (name, domain) dedup — existing entities get confidence boost, new ones insert. Add PII warning dialog on export.

---

### TODO-KF-004: Knowledge Conflict Resolution UI
**Priority:** P3 | **Effort:** M (human) → S (CC+gstack) | **Status:** Deferred
**Depends on:** Knowledge browser UI (Phase 2)
**Source:** CEO Review 2026-03-22, TODOS proposal

Surface contradictory knowledge (e.g., same entity, same property key, different values from different observation sessions) in a "Conflicts" tab in the knowledge browser. Let users resolve by picking the correct version.

**Why:** Without conflict resolution, stale/wrong knowledge accumulates silently. The agent may give answers based on outdated facts, eroding user trust.

**Cons:** Defining "contradiction" is fuzzy — needs heuristics (same entity, same property key, different values). UI design effort for the resolution flow. May surface false positives that annoy users.

**Where to start:** Query for entity pairs sharing (name, domain) with differing property values or conflicting relationships. Surface in knowledge browser with side-by-side comparison. User picks winner → loser gets archived with `archived=1`.

---

### TODO-KF-005: Knowledge Store Backup/Recovery
**Priority:** P2 | **Effort:** S (human) → S (CC+gstack) | **Status:** Deferred
**Depends on:** Phase 1 shipping
**Source:** Eng Review 2026-03-22, TODOS proposal

Periodic backup of `agent-knowledge.db` to `agent-knowledge.db.bak` before each consolidation run. On corruption detection, offer restore from backup.

**Why:** Knowledge accumulates over days/weeks of observation loops. Losing it to SQLite corruption (power loss mid-write, disk full) means re-running all observations from scratch — potentially weeks of learning.

**Cons:** Doubles disk usage per agent (~10-50MB extra). Backup could also be corrupt if corruption predates the backup. Need to handle the case where backup is also invalid.

**Where to start:** Add `fs.copyFileSync(dbPath, dbPath + '.bak')` at the start of each consolidation run in `knowledge/consolidation.ts`. On `KnowledgeStoreManager.open()`, if the DB fails integrity check (`PRAGMA integrity_check`), check for `.bak` file and offer restore via a notification event.
