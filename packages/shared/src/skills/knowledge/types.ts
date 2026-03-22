/**
 * Knowledge Fabric — Type Definitions
 *
 * Shared types for the structured knowledge store that enables
 * domain-expert agents to accumulate deep knowledge over time.
 */

// ============================================================
// Entity Types
// ============================================================

/** A structured entity in the knowledge store */
export interface KnowledgeEntity {
  id: string;
  type: string;
  name: string;
  domain: string;
  properties: Record<string, unknown> | null;
  confidence: number;
  firstSeen: number;
  lastSeen: number;
  sourceSessionId: string | null;
  archived: boolean;
}

/** A typed relationship between two entities */
export interface KnowledgeRelationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType: string;
  properties: Record<string, unknown> | null;
  confidence: number;
  firstSeen: number;
  lastSeen: number;
  archived: boolean;
}

/** A pattern observed across entities */
export interface KnowledgePattern {
  id: string;
  description: string;
  entityIds: string[];
  patternType: 'recurring' | 'correlation' | 'trend' | 'anomaly' | null;
  confidence: number;
  occurrenceCount: number;
  firstSeen: number;
  lastSeen: number;
}

/** A raw observation record */
export interface KnowledgeObservation {
  id: string;
  sessionId: string;
  rawContent: string;
  timestamp: number;
  observationType: 'manual' | 'scheduled' | 'consolidation';
}

// ============================================================
// Tool Input Types
// ============================================================

/** Input for saving entities via the save_knowledge tool */
export interface SaveEntityInput {
  type: string;
  name: string;
  domain: string;
  properties?: Record<string, unknown>;
  tags?: string[];
}

/** Input for saving relationships via the save_knowledge tool */
export interface SaveRelationshipInput {
  source: string;
  target: string;
  sourceDomain?: string;
  targetDomain?: string;
  relation: string;
  properties?: Record<string, unknown>;
}

/** Input for saving patterns via the save_knowledge tool */
export interface SavePatternInput {
  description: string;
  relatedEntities?: string[];
  patternType?: 'recurring' | 'correlation' | 'trend' | 'anomaly';
}

/** Full input to the save_knowledge tool */
export interface SaveKnowledgeInput {
  entities?: SaveEntityInput[];
  relationships?: SaveRelationshipInput[];
  patterns?: SavePatternInput[];
  observations?: string[];
}

/** Input to the query_knowledge tool */
export interface QueryKnowledgeInput {
  domain?: string;
  entityType?: string;
  tags?: string[];
  query?: string;
  includeRelationships?: boolean;
  limit?: number;
}

/** Input to the reset_knowledge tool */
export interface ResetKnowledgeInput {
  confirm: true;
  domain?: string;
}

// ============================================================
// Knowledge Store Stats
// ============================================================

export type ObservationHealth = 'green' | 'yellow' | 'red' | 'gray';

/** Stats returned by the GET_KNOWLEDGE_STATS RPC */
export interface KnowledgeStats {
  entityCount: number;
  relationshipCount: number;
  patternCount: number;
  lastObservation: number | null;
  observationHealth: ObservationHealth;
}

// ============================================================
// Manifest Types
// ============================================================

/** Knowledge configuration from depot.yaml v3 */
export interface KnowledgeManifestConfig {
  enabled: boolean;
  observationSchedule?: string;
  consolidationSchedule?: string;
  observationPrompt?: string;
  observationPermissionMode?: 'safe' | 'ask' | 'allow-all';
  tokenBudget?: {
    perDay: number;
  };
  maxObservationTurns?: number;
  domains?: string[];
}

// ============================================================
// Constants
// ============================================================

/** Confidence threshold — entities below this are archived */
export const CONFIDENCE_ARCHIVE_THRESHOLD = 0.1;

/** Days before confidence starts decaying */
export const CONFIDENCE_DECAY_AFTER_DAYS = 30;

/** Confidence multiplier per consolidation run for stale entities */
export const CONFIDENCE_DECAY_MULTIPLIER = 0.9;

/** Days after archival before permanent deletion */
export const ARCHIVE_PURGE_AFTER_DAYS = 90;

/** Soft entity limit — show dashboard warning above this */
export const ENTITY_SOFT_LIMIT_WARNING = 5_000;

/** Hard entity limit — block observation loops above this */
export const ENTITY_HARD_LIMIT_BLOCK = 10_000;

/** Consolidation batch size for event loop yielding */
export const CONSOLIDATION_BATCH_SIZE = 500;

/** Default max turns per observation session */
export const DEFAULT_MAX_OBSERVATION_TURNS = 20;

/** Default daily token budget */
export const DEFAULT_DAILY_TOKEN_BUDGET = 50_000;

/** Default consolidation schedule (daily at 2am) */
export const DEFAULT_CONSOLIDATION_SCHEDULE = '0 2 * * *';

/** Current schema version */
export const SCHEMA_VERSION = 1;
