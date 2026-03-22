/**
 * Knowledge Fabric — Consolidation Engine
 *
 * Handles periodic maintenance of the knowledge store:
 * 1. Deduplication: merge entities with same (name, domain, type)
 * 2. Confidence decay: entities not seen in 30+ days get confidence *= 0.9
 * 3. Archive: entities with confidence < 0.1 are marked archived
 * 4. Relationship pruning: relationships for archived entities get archived
 * 5. Purge: archived entities older than 90 days are permanently deleted
 *
 * Processes entities in batches, yielding the event loop between batches
 * to prevent UI jank in the Electron renderer.
 */

import type { KnowledgeStore } from './store.ts';
import {
  CONFIDENCE_ARCHIVE_THRESHOLD,
  CONFIDENCE_DECAY_AFTER_DAYS,
  CONFIDENCE_DECAY_MULTIPLIER,
  ARCHIVE_PURGE_AFTER_DAYS,
  CONSOLIDATION_BATCH_SIZE,
} from './types.ts';

// ============================================================
// Result type
// ============================================================

export interface ConsolidationResult {
  deduplicated: number;
  decayed: number;
  archived: number;
  purged: number;
}

// ============================================================
// Helpers
// ============================================================

const DAYS_MS = 24 * 60 * 60 * 1000;

/** Yield the event loop so long-running consolidation doesn't block the UI */
function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ============================================================
// Main entry point
// ============================================================

/**
 * Run a full consolidation pass on the knowledge store.
 *
 * Caller should persist the store after this returns (save() is called internally).
 * A backup is created before any mutations.
 */
export async function runConsolidation(store: KnowledgeStore): Promise<ConsolidationResult> {
  const now = Date.now();
  const decayThresholdMs = now - CONFIDENCE_DECAY_AFTER_DAYS * DAYS_MS;
  const purgeThresholdMs = now - ARCHIVE_PURGE_AFTER_DAYS * DAYS_MS;

  // Step 0: backup before any mutations
  store.backup();

  // Step 1: deduplication
  const deduplicated = store.deduplicateEntities();

  // Step 2: decay, archive, and relationship pruning in batches
  let decayed = 0;
  let archived = 0;
  let offset = 0;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const batch = store.getAllEntitiesBatch(offset, CONSOLIDATION_BATCH_SIZE);
    if (batch.length === 0) break;

    for (const entity of batch) {
      // Skip already-archived entities
      if (entity.archived) continue;

      // Check if the entity is stale (not seen in CONFIDENCE_DECAY_AFTER_DAYS)
      if (entity.lastSeen < decayThresholdMs) {
        const newConfidence = entity.confidence * CONFIDENCE_DECAY_MULTIPLIER;
        const shouldArchive = newConfidence < CONFIDENCE_ARCHIVE_THRESHOLD;

        store.updateEntityConfidence(entity.id, newConfidence, shouldArchive);
        decayed++;

        if (shouldArchive) {
          store.archiveRelationshipsForEntity(entity.id);
          archived++;
        }
      }
    }

    offset += CONSOLIDATION_BATCH_SIZE;

    // Yield the event loop between batches to prevent UI jank
    await yieldEventLoop();
  }

  // Step 3: purge archived entities older than 90 days
  const purged = store.purgeArchivedBefore(purgeThresholdMs);

  // Step 4: persist
  store.save();

  return { deduplicated, decayed, archived, purged };
}
