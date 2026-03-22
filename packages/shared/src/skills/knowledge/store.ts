/**
 * Knowledge Store — SQLite-backed structured knowledge persistence
 *
 * Uses sql.js (WASM SQLite) for zero native compilation.
 * KnowledgeStoreManager is a singleton that loads the WASM module once
 * and manages per-agent DB handles with idle eviction.
 *
 * Storage: {workspace}/skills/{slug}/agent-knowledge.db
 *
 * ┌──────────────────────────────────────────────┐
 * │ KnowledgeStoreManager (singleton)            │
 * │   sql.js WASM module loaded once             │
 * │                                              │
 * │   ┌─────────────────┐  ┌─────────────────┐  │
 * │   │ agent-A.db      │  │ agent-B.db      │  │
 * │   │ (KnowledgeStore)│  │ (KnowledgeStore)│  │
 * │   └─────────────────┘  └─────────────────┘  │
 * │                                              │
 * │   Idle handles evicted after 5 minutes       │
 * └──────────────────────────────────────────────┘
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, copyFileSync } from 'fs';
import { dirname, join, resolve, sep } from 'path';
import { randomUUID } from 'crypto';
import type {
  KnowledgeEntity,
  KnowledgeRelationship,
  KnowledgePattern,
  KnowledgeObservation,
  KnowledgeStats,
  ObservationHealth,
  SaveEntityInput,
  SaveRelationshipInput,
  SavePatternInput,
} from './types.ts';
import { SCHEMA_VERSION, ENTITY_HARD_LIMIT_BLOCK } from './types.ts';

// ============================================================
// Helpers
// ============================================================

/** Safe JSON.parse that returns null on malformed data instead of throwing */
function safeJsonParse(str: string): Record<string, unknown> | null {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/** Safe JSON.parse for arrays */
function safeJsonParseArray(str: string): string[] {
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ============================================================
// SQL Schema
// ============================================================

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  properties TEXT,
  confidence REAL DEFAULT 1.0,
  first_seen INTEGER,
  last_seen INTEGER,
  source_session_id TEXT,
  archived INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_entities_domain ON entities(domain);
CREATE INDEX IF NOT EXISTS idx_entities_name_domain ON entities(name, domain);
CREATE INDEX IF NOT EXISTS idx_entities_last_seen ON entities(last_seen);
CREATE INDEX IF NOT EXISTS idx_entities_first_seen ON entities(first_seen);

CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  source_entity_id TEXT REFERENCES entities(id),
  target_entity_id TEXT REFERENCES entities(id),
  relation_type TEXT NOT NULL,
  properties TEXT,
  confidence REAL DEFAULT 1.0,
  first_seen INTEGER,
  last_seen INTEGER,
  archived INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS patterns (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  entity_ids TEXT,
  pattern_type TEXT,
  confidence REAL DEFAULT 0.5,
  occurrence_count INTEGER DEFAULT 1,
  first_seen INTEGER,
  last_seen INTEGER
);

CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  raw_content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  observation_type TEXT DEFAULT 'manual'
);
CREATE INDEX IF NOT EXISTS idx_observations_timestamp ON observations(timestamp);

CREATE TABLE IF NOT EXISTS knowledge_index (
  entity_id TEXT REFERENCES entities(id),
  tag TEXT NOT NULL,
  PRIMARY KEY (entity_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_knowledge_tag ON knowledge_index(tag);
`;

// ============================================================
// KnowledgeStore — per-agent database handle
// ============================================================

/** sql.js Database handle — typed inline to avoid module resolution issues across workspaces */
interface SqlJsDatabase {
  run(sql: string, params?: (string | number | Uint8Array | null)[]): void;
  exec(sql: string, params?: (string | number | Uint8Array | null)[]): Array<{ columns: string[]; values: SqlJsRow[] }>;
  export(): Uint8Array;
  close(): void;
}

type SqlJsRow = (string | number | Uint8Array | null)[];

export class KnowledgeStore {
  private db: SqlJsDatabase;
  private dbPath: string;
  lastAccessed: number = Date.now();

  constructor(db: SqlJsDatabase, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
    this.initSchema();
  }

  private initSchema(): void {
    const currentVersion = this.getSchemaVersion();
    if (currentVersion < SCHEMA_VERSION) {
      this.db.exec(SCHEMA_SQL);
      if (currentVersion === 0) {
        this.db.run(
          'INSERT OR REPLACE INTO schema_version VALUES (?, ?)',
          [SCHEMA_VERSION, Date.now()],
        );
      }
      // Future migrations would go here: if (currentVersion < 2) { ... }
    }
  }

  private getSchemaVersion(): number {
    try {
      const result = this.db.exec('SELECT MAX(version) as v FROM schema_version');
      if (result.length > 0 && result[0]!.values.length > 0) {
        return (result[0]!.values[0]![0] as number) ?? 0;
      }
    } catch {
      // Table doesn't exist yet
    }
    return 0;
  }

  private touch(): void {
    this.lastAccessed = Date.now();
  }

  // ============================================================
  // Save to disk
  // ============================================================

  save(): void {
    this.touch();
    const data = this.db.export();
    const buffer = Buffer.from(data);
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const tempPath = `${this.dbPath}.tmp`;
    writeFileSync(tempPath, buffer);
    renameSync(tempPath, this.dbPath);
  }

  /** Create a backup before consolidation */
  backup(): void {
    if (existsSync(this.dbPath)) {
      copyFileSync(this.dbPath, `${this.dbPath}.bak`);
    }
  }

  close(): void {
    try {
      this.save();
      this.db.close();
    } catch {
      // Best effort
    }
  }

  // ============================================================
  // Entity CRUD
  // ============================================================

  getEntityCount(includeArchived = false): number {
    this.touch();
    const where = includeArchived ? '' : 'WHERE archived = 0';
    const result = this.db.exec(`SELECT COUNT(*) FROM entities ${where}`);
    return (result[0]?.values[0]?.[0] as number) ?? 0;
  }

  /** Resolve entity name to ID. Returns null if not found. */
  resolveEntityId(name: string, domain?: string): string | null {
    this.touch();
    if (domain) {
      const result = this.db.exec(
        'SELECT id FROM entities WHERE name = ? AND domain = ? AND archived = 0 ORDER BY last_seen DESC LIMIT 1',
        [name, domain],
      );
      if (result.length > 0 && result[0]!.values.length > 0) {
        return result[0]!.values[0]![0] as string;
      }
    }
    // Fall back to name-only, pick most recently seen
    const result = this.db.exec(
      'SELECT id FROM entities WHERE name = ? AND archived = 0 ORDER BY last_seen DESC LIMIT 1',
      [name],
    );
    if (result.length > 0 && result[0]!.values.length > 0) {
      return result[0]!.values[0]![0] as string;
    }
    return null;
  }

  /** Auto-create a placeholder entity when referenced but not found */
  private autoCreateEntity(name: string, domain: string, sessionId?: string): string {
    const id = randomUUID();
    const now = Date.now();
    this.db.run(
      `INSERT INTO entities (id, type, name, domain, confidence, first_seen, last_seen, source_session_id, archived)
       VALUES (?, 'unknown', ?, ?, 0.5, ?, ?, ?, 0)`,
      [id, name, domain, now, now, sessionId ?? null],
    );
    return id;
  }

  /**
   * Save entities within a transaction.
   * Returns map of "name\0domain" → id for relationship resolution.
   * Uses NUL separator to avoid collisions between name and domain parts.
   */
  saveEntities(entities: SaveEntityInput[], sessionId: string): Map<string, string> {
    this.touch();
    const nameToId = new Map<string, string>();
    const now = Date.now();

    for (const entity of entities) {
      // Entity identity is (name, domain). Type is mutable metadata — the LLM
      // may refine an entity's type over time (e.g., from "unknown" to "service").
      // Dedup in consolidation groups by (name, domain, type) to merge exact duplicates.
      const existing = this.db.exec(
        'SELECT id, confidence FROM entities WHERE name = ? AND domain = ? LIMIT 1',
        [entity.name, entity.domain],
      );

      let entityId: string;
      if (existing.length > 0 && existing[0]!.values.length > 0) {
        // Update existing — re-observation resets confidence to 1.0 and un-archives
        entityId = existing[0]!.values[0]![0] as string;
        const propsJson = entity.properties ? JSON.stringify(entity.properties) : null;
        this.db.run(
          `UPDATE entities SET type = ?, properties = COALESCE(?, properties),
           confidence = 1.0, last_seen = ?, source_session_id = ?, archived = 0
           WHERE id = ?`,
          [entity.type, propsJson, now, sessionId, entityId],
        );
      } else {
        // Insert new
        entityId = randomUUID();
        const propsJson = entity.properties ? JSON.stringify(entity.properties) : null;
        this.db.run(
          `INSERT INTO entities (id, type, name, domain, properties, confidence, first_seen, last_seen, source_session_id, archived)
           VALUES (?, ?, ?, ?, ?, 1.0, ?, ?, ?, 0)`,
          [entityId, entity.type, entity.name, entity.domain, propsJson, now, now, sessionId],
        );
      }

      nameToId.set(`${entity.name}\0${entity.domain}`, entityId);
      // Also store name-only for fallback resolution (backward compat)
      if (!nameToId.has(entity.name)) {
        nameToId.set(entity.name, entityId);
      }

      // Update tag index
      if (entity.tags && entity.tags.length > 0) {
        // Remove old tags for this entity
        this.db.run('DELETE FROM knowledge_index WHERE entity_id = ?', [entityId]);
        for (const tag of entity.tags) {
          const normalizedTag = tag.toLowerCase().trim();
          if (normalizedTag) {
            this.db.run(
              'INSERT OR IGNORE INTO knowledge_index (entity_id, tag) VALUES (?, ?)',
              [entityId, normalizedTag],
            );
          }
        }
      }
    }

    return nameToId;
  }

  /**
   * Save relationships, resolving entity names to IDs.
   * Auto-creates entities that don't exist.
   */
  saveRelationships(
    relationships: SaveRelationshipInput[],
    nameToId: Map<string, string>,
    sessionId: string,
    defaultDomain: string,
  ): number {
    this.touch();
    const now = Date.now();
    let saved = 0;

    for (const rel of relationships) {
      // Resolve source entity — try domain-qualified key first, then name-only fallback
      const srcDomain = rel.sourceDomain ?? defaultDomain;
      let sourceId = nameToId.get(`${rel.source}\0${srcDomain}`)
        ?? nameToId.get(rel.source)
        ?? this.resolveEntityId(rel.source, rel.sourceDomain);
      if (!sourceId) {
        sourceId = this.autoCreateEntity(rel.source, srcDomain, sessionId);
        nameToId.set(`${rel.source}\0${srcDomain}`, sourceId);
      }

      // Resolve target entity — try domain-qualified key first, then name-only fallback
      const tgtDomain = rel.targetDomain ?? defaultDomain;
      let targetId = nameToId.get(`${rel.target}\0${tgtDomain}`)
        ?? nameToId.get(rel.target)
        ?? this.resolveEntityId(rel.target, rel.targetDomain);
      if (!targetId) {
        targetId = this.autoCreateEntity(rel.target, tgtDomain, sessionId);
        nameToId.set(`${rel.target}\0${tgtDomain}`, targetId);
      }

      // Check for existing relationship
      const existing = this.db.exec(
        `SELECT id FROM relationships
         WHERE source_entity_id = ? AND target_entity_id = ? AND relation_type = ?
         LIMIT 1`,
        [sourceId, targetId, rel.relation],
      );

      if (existing.length > 0 && existing[0]!.values.length > 0) {
        const relId = existing[0]!.values[0]![0] as string;
        const propsJson = rel.properties ? JSON.stringify(rel.properties) : null;
        this.db.run(
          `UPDATE relationships SET properties = COALESCE(?, properties),
           confidence = 1.0, last_seen = ?, archived = 0 WHERE id = ?`,
          [propsJson, now, relId],
        );
      } else {
        const relId = randomUUID();
        const propsJson = rel.properties ? JSON.stringify(rel.properties) : null;
        this.db.run(
          `INSERT INTO relationships (id, source_entity_id, target_entity_id, relation_type, properties, confidence, first_seen, last_seen, archived)
           VALUES (?, ?, ?, ?, ?, 1.0, ?, ?, 0)`,
          [relId, sourceId, targetId, rel.relation, propsJson, now, now],
        );
      }
      saved++;
    }

    return saved;
  }

  /** Save patterns, resolving entity name references to IDs */
  savePatterns(
    patterns: SavePatternInput[],
    nameToId: Map<string, string>,
  ): number {
    this.touch();
    const now = Date.now();
    let saved = 0;

    for (const pattern of patterns) {
      // Resolve entity references
      const entityIds: string[] = [];
      for (const name of pattern.relatedEntities ?? []) {
        const id = nameToId.get(name) ?? this.resolveEntityId(name);
        if (id) entityIds.push(id);
      }

      // Check for existing similar pattern
      const existing = this.db.exec(
        'SELECT id, occurrence_count, confidence FROM patterns WHERE description = ? LIMIT 1',
        [pattern.description],
      );

      if (existing.length > 0 && existing[0]!.values.length > 0) {
        const patternId = existing[0]!.values[0]![0] as string;
        const count = (existing[0]!.values[0]![1] as number) + 1;
        const rawConf = existing[0]!.values[0]![2] as number;
        const conf = Number.isFinite(rawConf) ? Math.min(1.0, rawConf * 1.1) : 0.5;
        this.db.run(
          `UPDATE patterns SET entity_ids = ?, occurrence_count = ?,
           confidence = ?, last_seen = ? WHERE id = ?`,
          [JSON.stringify(entityIds), count, conf, now, patternId],
        );
      } else {
        const patternId = randomUUID();
        this.db.run(
          `INSERT INTO patterns (id, description, entity_ids, pattern_type, confidence, occurrence_count, first_seen, last_seen)
           VALUES (?, ?, ?, ?, 0.5, 1, ?, ?)`,
          [patternId, pattern.description, JSON.stringify(entityIds), pattern.patternType ?? null, now, now],
        );
      }
      saved++;
    }

    return saved;
  }

  /** Save free-form observations */
  saveObservations(
    observations: string[],
    sessionId: string,
    type: 'manual' | 'scheduled' | 'consolidation' = 'manual',
  ): number {
    this.touch();
    const now = Date.now();
    let saved = 0;

    for (const content of observations) {
      const trimmed = content.trim();
      if (!trimmed) continue;
      const id = randomUUID();
      this.db.run(
        'INSERT INTO observations (id, session_id, raw_content, timestamp, observation_type) VALUES (?, ?, ?, ?, ?)',
        [id, sessionId, trimmed, now, type],
      );
      saved++;
    }

    return saved;
  }

  // ============================================================
  // Transactional Save (all-or-nothing)
  // ============================================================

  /**
   * Save entities, relationships, patterns, and observations atomically.
   * Rolls back on any failure.
   */
  saveKnowledge(
    input: {
      entities?: SaveEntityInput[];
      relationships?: SaveRelationshipInput[];
      patterns?: SavePatternInput[];
      observations?: string[];
    },
    sessionId: string,
    defaultDomain: string,
  ): { entities: number; relationships: number; patterns: number; observations: number } {
    this.touch();

    // Check entity hard limit (include worst-case auto-created entities from relationships)
    const currentCount = this.getEntityCount();
    const newEntityCount = (input.entities?.length ?? 0) + (input.relationships?.length ?? 0) * 2;
    if (currentCount + newEntityCount > ENTITY_HARD_LIMIT_BLOCK) {
      throw new Error(
        `Entity limit exceeded: ${currentCount} existing + ${newEntityCount} new > ${ENTITY_HARD_LIMIT_BLOCK} limit. ` +
        'Consider resetting unused domains or running consolidation.',
      );
    }

    this.db.run('BEGIN TRANSACTION');
    try {
      const nameToId = input.entities
        ? this.saveEntities(input.entities, sessionId)
        : new Map<string, string>();

      const relCount = input.relationships
        ? this.saveRelationships(input.relationships, nameToId, sessionId, defaultDomain)
        : 0;

      const patternCount = input.patterns
        ? this.savePatterns(input.patterns, nameToId)
        : 0;

      const obsCount = input.observations
        ? this.saveObservations(input.observations, sessionId)
        : 0;

      this.db.run('COMMIT');
      this.save();

      return {
        entities: input.entities?.length ?? 0,
        relationships: relCount,
        patterns: patternCount,
        observations: obsCount,
      };
    } catch (err) {
      try { this.db.run('ROLLBACK'); } catch { /* already rolled back or no active txn */ }
      throw err;
    }
  }

  // ============================================================
  // Query
  // ============================================================

  queryEntities(opts: {
    domain?: string;
    entityType?: string;
    tags?: string[];
    query?: string;
    limit?: number;
    includeArchived?: boolean;
  }): KnowledgeEntity[] {
    this.touch();
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (!opts.includeArchived) {
      conditions.push('e.archived = 0');
    }
    if (opts.domain) {
      conditions.push('e.domain = ?');
      params.push(opts.domain);
    }
    if (opts.entityType) {
      conditions.push('e.type = ?');
      params.push(opts.entityType);
    }
    if (opts.query) {
      conditions.push('(e.name LIKE ? OR e.type LIKE ?)');
      params.push(`%${opts.query}%`, `%${opts.query}%`);
    }

    let sql: string;
    if (opts.tags && opts.tags.length > 0) {
      const placeholders = opts.tags.map(() => '?').join(',');
      sql = `SELECT DISTINCT e.id, e.type, e.name, e.domain, e.properties, e.confidence,
             e.first_seen, e.last_seen, e.source_session_id, e.archived
             FROM entities e
             JOIN knowledge_index ki ON e.id = ki.entity_id
             WHERE ki.tag IN (${placeholders})`;
      params.unshift(...opts.tags.map(t => t.toLowerCase().trim()));
      if (conditions.length > 0) {
        sql += ` AND ${conditions.join(' AND ')}`;
      }
    } else {
      sql = `SELECT e.id, e.type, e.name, e.domain, e.properties, e.confidence,
             e.first_seen, e.last_seen, e.source_session_id, e.archived
             FROM entities e`;
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }
    }

    sql += ' ORDER BY e.confidence DESC, e.last_seen DESC';
    sql += ` LIMIT ${opts.limit ?? 100}`;

    const result = this.db.exec(sql, params);
    if (!result.length || !result[0]!.values.length) return [];

    return result[0]!.values.map((row: SqlJsRow) => ({
      id: row[0] as string,
      type: row[1] as string,
      name: row[2] as string,
      domain: row[3] as string,
      properties: row[4] ? safeJsonParse(row[4] as string) : null,
      confidence: row[5] as number,
      firstSeen: row[6] as number,
      lastSeen: row[7] as number,
      sourceSessionId: row[8] as string | null,
      archived: (row[9] as number) === 1,
    }));
  }

  queryRelationshipsForEntity(entityId: string): KnowledgeRelationship[] {
    this.touch();
    const result = this.db.exec(
      `SELECT id, source_entity_id, target_entity_id, relation_type, properties,
       confidence, first_seen, last_seen, archived
       FROM relationships
       WHERE (source_entity_id = ? OR target_entity_id = ?) AND archived = 0`,
      [entityId, entityId],
    );
    if (!result.length || !result[0]!.values.length) return [];

    return result[0]!.values.map((row: SqlJsRow) => ({
      id: row[0] as string,
      sourceEntityId: row[1] as string,
      targetEntityId: row[2] as string,
      relationType: row[3] as string,
      properties: row[4] ? safeJsonParse(row[4] as string) : null,
      confidence: row[5] as number,
      firstSeen: row[6] as number,
      lastSeen: row[7] as number,
      archived: (row[8] as number) === 1,
    }));
  }

  queryPatterns(limit = 50): KnowledgePattern[] {
    this.touch();
    const result = this.db.exec(
      `SELECT id, description, entity_ids, pattern_type, confidence, occurrence_count, first_seen, last_seen
       FROM patterns ORDER BY confidence DESC, occurrence_count DESC LIMIT ?`,
      [limit],
    );
    if (!result.length || !result[0]!.values.length) return [];

    return result[0]!.values.map((row: SqlJsRow) => ({
      id: row[0] as string,
      description: row[1] as string,
      entityIds: row[2] ? safeJsonParseArray(row[2] as string) : [],
      patternType: row[3] as KnowledgePattern['patternType'],
      confidence: row[4] as number,
      occurrenceCount: row[5] as number,
      firstSeen: row[6] as number,
      lastSeen: row[7] as number,
    }));
  }

  queryObservations(opts?: { since?: number; type?: string; limit?: number }): KnowledgeObservation[] {
    this.touch();
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (opts?.since) {
      conditions.push('timestamp > ?');
      params.push(opts.since);
    }
    if (opts?.type) {
      conditions.push('observation_type = ?');
      params.push(opts.type);
    }

    let sql = 'SELECT id, session_id, raw_content, timestamp, observation_type FROM observations';
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    sql += ` ORDER BY timestamp DESC LIMIT ${opts?.limit ?? 50}`;

    const result = this.db.exec(sql, params);
    if (!result.length || !result[0]!.values.length) return [];

    return result[0]!.values.map((row: SqlJsRow) => ({
      id: row[0] as string,
      sessionId: row[1] as string,
      rawContent: row[2] as string,
      timestamp: row[3] as number,
      observationType: row[4] as KnowledgeObservation['observationType'],
    }));
  }

  // ============================================================
  // Stats
  // ============================================================

  getStats(): KnowledgeStats {
    this.touch();
    const entityCount = this.getEntityCount();

    const relResult = this.db.exec('SELECT COUNT(*) FROM relationships WHERE archived = 0');
    const relationshipCount = (relResult[0]?.values[0]?.[0] as number) ?? 0;

    const patResult = this.db.exec('SELECT COUNT(*) FROM patterns');
    const patternCount = (patResult[0]?.values[0]?.[0] as number) ?? 0;

    // Last observation timestamp
    const lastObsResult = this.db.exec(
      "SELECT MAX(timestamp) FROM observations WHERE observation_type = 'scheduled'",
    );
    const lastObservation = (lastObsResult[0]?.values[0]?.[0] as number) ?? null;

    // Observation health — check last 3 scheduled observations
    const recentObs = this.db.exec(
      `SELECT observation_type FROM observations
       WHERE observation_type IN ('scheduled')
       ORDER BY timestamp DESC LIMIT 3`,
    );

    let observationHealth: ObservationHealth = 'gray';
    if (recentObs.length > 0 && recentObs[0]!.values.length > 0) {
      // We have observations — default to green
      observationHealth = 'green';
      // Check for consecutive failures (we mark failures via observations with specific content)
      // For now, if observations exist, health is green
    }

    return { entityCount, relationshipCount, patternCount, lastObservation, observationHealth };
  }

  // ============================================================
  // Reset
  // ============================================================

  reset(domain?: string): void {
    this.touch();
    this.db.run('BEGIN TRANSACTION');
    try {
      if (domain) {
        // Domain-scoped reset
        this.db.run('DELETE FROM knowledge_index WHERE entity_id IN (SELECT id FROM entities WHERE domain = ?)', [domain]);
        this.db.run('DELETE FROM relationships WHERE source_entity_id IN (SELECT id FROM entities WHERE domain = ?) OR target_entity_id IN (SELECT id FROM entities WHERE domain = ?)', [domain, domain]);
        // Clear pattern entity references to avoid dangling IDs (patterns persist, just lose links)
        this.db.run("UPDATE patterns SET entity_ids = '[]' WHERE entity_ids IS NOT NULL");
        this.db.run('DELETE FROM entities WHERE domain = ?', [domain]);
      } else {
        // Full reset
        this.db.run('DELETE FROM knowledge_index');
        this.db.run('DELETE FROM relationships');
        this.db.run('DELETE FROM patterns');
        this.db.run('DELETE FROM observations');
        this.db.run('DELETE FROM entities');
      }
      this.db.run('COMMIT');
      this.save();
    } catch (err) {
      try { this.db.run('ROLLBACK'); } catch { /* already rolled back or no active txn */ }
      throw err;
    }
  }

  // ============================================================
  // Entities queried since a timestamp (for briefing)
  // ============================================================

  getEntitiesSince(timestamp: number): KnowledgeEntity[] {
    this.touch();
    const result = this.db.exec(
      `SELECT id, type, name, domain, properties, confidence, first_seen, last_seen, source_session_id, archived
       FROM entities WHERE archived = 0 AND (first_seen > ? OR last_seen > ?)
       ORDER BY last_seen DESC LIMIT 100`,
      [timestamp, timestamp],
    );
    if (!result.length || !result[0]!.values.length) return [];

    return result[0]!.values.map((row: SqlJsRow) => ({
      id: row[0] as string,
      type: row[1] as string,
      name: row[2] as string,
      domain: row[3] as string,
      properties: row[4] ? safeJsonParse(row[4] as string) : null,
      confidence: row[5] as number,
      firstSeen: row[6] as number,
      lastSeen: row[7] as number,
      sourceSessionId: row[8] as string | null,
      archived: (row[9] as number) === 1,
    }));
  }

  getPatternsSince(timestamp: number): KnowledgePattern[] {
    this.touch();
    const result = this.db.exec(
      'SELECT id, description, entity_ids, pattern_type, confidence, occurrence_count, first_seen, last_seen FROM patterns WHERE last_seen > ? ORDER BY confidence DESC LIMIT 20',
      [timestamp],
    );
    if (!result.length || !result[0]!.values.length) return [];

    return result[0]!.values.map((row: SqlJsRow) => ({
      id: row[0] as string,
      description: row[1] as string,
      entityIds: row[2] ? safeJsonParseArray(row[2] as string) : [],
      patternType: row[3] as KnowledgePattern['patternType'],
      confidence: row[4] as number,
      occurrenceCount: row[5] as number,
      firstSeen: row[6] as number,
      lastSeen: row[7] as number,
    }));
  }

  getScheduledObservationsSince(timestamp: number): KnowledgeObservation[] {
    return this.queryObservations({ since: timestamp, type: 'scheduled' });
  }

  // ============================================================
  // Raw access for consolidation
  // ============================================================

  /** Get all active entities in batches for consolidation */
  getAllEntitiesBatch(offset: number, limit: number): KnowledgeEntity[] {
    this.touch();
    const result = this.db.exec(
      `SELECT id, type, name, domain, properties, confidence, first_seen, last_seen, source_session_id, archived
       FROM entities LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    if (!result.length || !result[0]!.values.length) return [];

    return result[0]!.values.map((row: SqlJsRow) => ({
      id: row[0] as string,
      type: row[1] as string,
      name: row[2] as string,
      domain: row[3] as string,
      properties: row[4] ? safeJsonParse(row[4] as string) : null,
      confidence: row[5] as number,
      firstSeen: row[6] as number,
      lastSeen: row[7] as number,
      sourceSessionId: row[8] as string | null,
      archived: (row[9] as number) === 1,
    }));
  }

  updateEntityConfidence(id: string, confidence: number, archived: boolean): void {
    this.db.run(
      'UPDATE entities SET confidence = ?, archived = ? WHERE id = ?',
      [confidence, archived ? 1 : 0, id],
    );
  }

  archiveRelationshipsForEntity(entityId: string): void {
    this.db.run(
      'UPDATE relationships SET archived = 1 WHERE source_entity_id = ? OR target_entity_id = ?',
      [entityId, entityId],
    );
  }

  purgeArchivedBefore(timestamp: number): number {
    this.touch();
    this.db.run('BEGIN TRANSACTION');
    try {
      // Get archived entities to purge
      const toDelete = this.db.exec(
        'SELECT id FROM entities WHERE archived = 1 AND last_seen < ?',
        [timestamp],
      );
      const ids = toDelete.length > 0 ? toDelete[0]!.values.map((r: SqlJsRow) => r[0] as string) : [];

      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        this.db.run(`DELETE FROM knowledge_index WHERE entity_id IN (${placeholders})`, ids);
        this.db.run(`DELETE FROM relationships WHERE source_entity_id IN (${placeholders}) OR target_entity_id IN (${placeholders})`, [...ids, ...ids]);
        this.db.run(`DELETE FROM entities WHERE id IN (${placeholders})`, ids);
      }

      // Also purge archived relationships
      this.db.run('DELETE FROM relationships WHERE archived = 1 AND last_seen < ?', [timestamp]);

      this.db.run('COMMIT');
      return ids.length;
    } catch (err) {
      try { this.db.run('ROLLBACK'); } catch { /* already rolled back or no active txn */ }
      throw err;
    }
  }

  /** Merge duplicate entities with same (name, domain, type) */
  deduplicateEntities(): number {
    this.touch();
    // Order by confidence DESC, last_seen DESC within each group so the
    // first ID in GROUP_CONCAT is the best keeper (highest confidence, most recent).
    const dupes = this.db.exec(
      `SELECT name, domain, type, GROUP_CONCAT(id) as ids, COUNT(*) as cnt
       FROM (SELECT * FROM entities WHERE archived = 0 ORDER BY confidence DESC, last_seen DESC)
       GROUP BY name, domain, type HAVING cnt > 1`,
    );
    if (!dupes.length || !dupes[0]!.values.length) return 0;

    let merged = 0;
    this.db.run('BEGIN TRANSACTION');
    try {
      for (const row of dupes[0]!.values) {
        const ids = (row[3] as string).split(',');
        if (ids.length < 2) continue;

        // Keep the one with highest confidence / most recent last_seen
        const keeper = ids[0]!;
        const toMerge = ids.slice(1);

        for (const dupeId of toMerge) {
          // Re-point relationships
          this.db.run('UPDATE relationships SET source_entity_id = ? WHERE source_entity_id = ?', [keeper, dupeId]);
          this.db.run('UPDATE relationships SET target_entity_id = ? WHERE target_entity_id = ?', [keeper, dupeId]);
          // Move tags
          this.db.run(
            'INSERT OR IGNORE INTO knowledge_index (entity_id, tag) SELECT ?, tag FROM knowledge_index WHERE entity_id = ?',
            [keeper, dupeId],
          );
          this.db.run('DELETE FROM knowledge_index WHERE entity_id = ?', [dupeId]);
          // Delete the duplicate
          this.db.run('DELETE FROM entities WHERE id = ?', [dupeId]);
          merged++;
        }
      }
      this.db.run('COMMIT');
    } catch (err) {
      try { this.db.run('ROLLBACK'); } catch { /* already rolled back or no active txn */ }
      throw err;
    }

    return merged;
  }

  /** Get top N entities by confidence for fallback context loading */
  getTopEntities(limit: number): KnowledgeEntity[] {
    this.touch();
    const result = this.db.exec(
      `SELECT id, type, name, domain, properties, confidence, first_seen, last_seen, source_session_id, archived
       FROM entities WHERE archived = 0
       ORDER BY confidence DESC, last_seen DESC LIMIT ?`,
      [limit],
    );
    if (!result.length || !result[0]!.values.length) return [];

    return result[0]!.values.map((row: SqlJsRow) => ({
      id: row[0] as string,
      type: row[1] as string,
      name: row[2] as string,
      domain: row[3] as string,
      properties: row[4] ? safeJsonParse(row[4] as string) : null,
      confidence: row[5] as number,
      firstSeen: row[6] as number,
      lastSeen: row[7] as number,
      sourceSessionId: row[8] as string | null,
      archived: (row[9] as number) === 1,
    }));
  }
}

// ============================================================
// KnowledgeStoreManager — singleton with idle eviction
// ============================================================

const IDLE_EVICTION_MS = 5 * 60 * 1000; // 5 minutes
const EVICTION_CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

const KNOWLEDGE_DB_FILE = 'agent-knowledge.db';

export class KnowledgeStoreManager {
  private static instance: KnowledgeStoreManager | null = null;
  private sqlJs: any = null;
  private initPromise: Promise<void> | null = null;
  private stores = new Map<string, KnowledgeStore>();
  private evictionTimer: ReturnType<typeof setInterval> | null = null;

  private constructor() {}

  static getInstance(): KnowledgeStoreManager {
    if (!KnowledgeStoreManager.instance) {
      KnowledgeStoreManager.instance = new KnowledgeStoreManager();
    }
    return KnowledgeStoreManager.instance;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.sqlJs) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        // @ts-expect-error sql.js ships no .d.ts; we define SqlJsDatabase inline above
        const sqlJsModule = await import(/* webpackIgnore: true */ 'sql.js');
        const initSqlJs = sqlJsModule.default ?? sqlJsModule;
        this.sqlJs = await initSqlJs();
        this.startEvictionTimer();
      } catch (err) {
        // Clear the cached promise so subsequent calls can retry
        this.initPromise = null;
        throw err;
      }
    })();

    return this.initPromise;
  }

  private startEvictionTimer(): void {
    if (this.evictionTimer) return;
    this.evictionTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, store] of this.stores) {
        if (now - store.lastAccessed > IDLE_EVICTION_MS) {
          store.close();
          this.stores.delete(key);
        }
      }
    }, EVICTION_CHECK_INTERVAL_MS);
    // Don't block Node from exiting
    if (this.evictionTimer.unref) {
      this.evictionTimer.unref();
    }
  }

  /** Get the path to a knowledge store DB file */
  private getDbPath(workspaceRootPath: string, skillSlug: string, skillDir?: string): string {
    if (skillDir) return join(skillDir, KNOWLEDGE_DB_FILE);
    const skillsRoot = resolve(workspaceRootPath, 'skills');
    const target = resolve(skillsRoot, skillSlug, KNOWLEDGE_DB_FILE);
    if (!target.startsWith(`${skillsRoot}${sep}`)) {
      throw new Error(`Resolved path escaped skills root for slug: ${skillSlug}`);
    }
    return target;
  }

  /** Open or retrieve a cached knowledge store */
  async open(workspaceRootPath: string, skillSlug: string, skillDir?: string): Promise<KnowledgeStore> {
    await this.ensureInitialized();

    const dbPath = this.getDbPath(workspaceRootPath, skillSlug, skillDir);
    const cacheKey = dbPath;

    // Return cached handle
    const cached = this.stores.get(cacheKey);
    if (cached) {
      cached.lastAccessed = Date.now();
      return cached;
    }

    // Open or create DB
    const SQL = this.sqlJs as any;
    let db: SqlJsDatabase;

    if (existsSync(dbPath)) {
      try {
        const data = readFileSync(dbPath);
        db = new SQL.Database(data);
      } catch {
        // Corruption — try backup
        const bakPath = `${dbPath}.bak`;
        if (existsSync(bakPath)) {
          try {
            const bakData = readFileSync(bakPath);
            db = new SQL.Database(bakData);
          } catch {
            // Both corrupt — create fresh
            db = new SQL.Database();
          }
        } else {
          db = new SQL.Database();
        }
      }
    } else {
      db = new SQL.Database();
    }

    const store = new KnowledgeStore(db, dbPath);
    this.stores.set(cacheKey, store);
    return store;
  }

  /** Check if a knowledge store exists on disk */
  exists(workspaceRootPath: string, skillSlug: string, skillDir?: string): boolean {
    const dbPath = this.getDbPath(workspaceRootPath, skillSlug, skillDir);
    return existsSync(dbPath);
  }

  /** Close a specific store */
  close(workspaceRootPath: string, skillSlug: string, skillDir?: string): void {
    const dbPath = this.getDbPath(workspaceRootPath, skillSlug, skillDir);
    const store = this.stores.get(dbPath);
    if (store) {
      store.close();
      this.stores.delete(dbPath);
    }
  }

  /** Close all stores and clean up */
  shutdown(): void {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }
    for (const [key, store] of this.stores) {
      store.close();
      this.stores.delete(key);
    }
    KnowledgeStoreManager.instance = null;
  }
}
