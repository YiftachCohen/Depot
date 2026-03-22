/**
 * Knowledge Fabric — Public API
 *
 * Structured knowledge store for domain-expert agents.
 */

export * from './types.ts';
export { KnowledgeStore, KnowledgeStoreManager } from './store.ts';
export { runConsolidation, type ConsolidationResult } from './consolidation.ts';
export { buildKnowledgeContext, buildBriefingContext } from './context.ts';
export { extractKeywords, stripPii, extractEntitiesHeuristic } from './extraction.ts';
