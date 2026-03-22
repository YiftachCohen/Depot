/**
 * Knowledge Fabric — Keyword Extraction & PII Filtering
 *
 * Lightweight heuristic utilities for extracting keywords and entities
 * from text and MCP tool responses, plus PII stripping for safe storage.
 */

// ============================================================
// Stopwords
// ============================================================

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "but",
  "not",
  "you",
  "all",
  "can",
  "had",
  "her",
  "was",
  "one",
  "our",
  "out",
  "has",
  "have",
  "that",
  "this",
  "with",
  "from",
  "they",
  "been",
  "said",
  "each",
  "which",
  "their",
  "will",
  "other",
  "about",
  "many",
  "then",
  "them",
  "these",
  "some",
  "would",
  "make",
  "like",
  "into",
  "could",
  "time",
  "very",
  "when",
  "come",
  "made",
  "find",
  "more",
  "after",
  "also",
  "what",
  "most",
  "only",
  "over",
  "such",
  "take",
  "than",
  "just",
  "know",
  "does",
  "well",
  "back",
  "your",
  "much",
  "good",
  "give",
  "want",
]);

// ============================================================
// PII Patterns
// ============================================================

const PII_PATTERNS: { regex: RegExp; replacement: string }[] = [
  {
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: "[EMAIL]",
  },
  {
    regex:
      /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
    replacement: "[PHONE]",
  },
  {
    regex: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
    replacement: "[SSN]",
  },
  {
    regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: "[CARD]",
  },
];

// ============================================================
// extractKeywords
// ============================================================

/**
 * Lightweight heuristic keyword extraction (no LLM call).
 *
 * Splits text on whitespace/punctuation, filters stopwords and short
 * tokens, and optionally matches against known domain patterns.
 */
export function extractKeywords(
  text: string,
  knownDomains?: string[],
): string[] {
  // Split on whitespace and punctuation
  const tokens = text.split(/[\s,;:!?()\[\]{}"'`<>|/\\]+/);

  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of tokens) {
    // Strip leading/trailing punctuation residue (e.g., periods, hyphens)
    const token = raw.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "").toLowerCase();

    if (token.length <= 3) continue;
    if (STOPWORDS.has(token)) continue;
    if (seen.has(token)) continue;

    seen.add(token);
    result.push(token);
  }

  // Check for domain pattern matches if knownDomains provided
  if (knownDomains && knownDomains.length > 0) {
    for (const domain of knownDomains) {
      // Domain patterns like "aws:cloudwatch" — extract the suffix
      const parts = domain.split(":");
      for (const part of parts) {
        const lower = part.toLowerCase();
        if (lower.length > 3 && !seen.has(lower)) {
          // Check if any token in the original text matches this domain part
          const textLower = text.toLowerCase();
          if (textLower.includes(lower)) {
            seen.add(lower);
            result.push(lower);
          }
        }
      }
    }
  }

  return result;
}

// ============================================================
// stripPii
// ============================================================

/**
 * Apply regex filters to strip common PII patterns from text.
 * Replaces emails, phone numbers, SSNs, and credit card numbers
 * with placeholder tokens.
 */
export function stripPii(text: string): string {
  let cleaned = text;
  for (const { regex, replacement } of PII_PATTERNS) {
    cleaned = cleaned.replace(regex, replacement);
  }
  return cleaned;
}

// ============================================================
// extractEntitiesHeuristic
// ============================================================

/** An extracted entity with inferred type and domain. */
interface ExtractedEntity {
  type: string;
  name: string;
  domain: string;
}

/** Common field names that indicate an entity name. */
const NAME_FIELDS = ["name", "id", "title", "key"];

/** Regex for Jira-style keys (e.g., PROJ-123). */
const JIRA_KEY_REGEX = /\b[A-Z]{2,10}-\d+\b/g;

/** Regex for ARN-like strings. */
const ARN_REGEX = /\barn:[\w:*/-]+\b/g;

/** Regex for capitalized multi-word phrases (potential entity names). */
const CAPITALIZED_PHRASE_REGEX = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;

/**
 * Lightweight heuristic entity extraction from MCP tool responses.
 *
 * Tries JSON parsing first for structured extraction, then falls back
 * to regex-based extraction for plain text. All extracted names are
 * run through stripPii before returning.
 *
 * False positives are acceptable — entities start at confidence 0.5
 * and decay if not re-observed.
 */
export function extractEntitiesHeuristic(
  toolResponse: string,
  knownDomains: string[],
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const seen = new Set<string>();

  const addEntity = (type: string, name: string, domain: string) => {
    const cleaned = stripPii(name);
    // Skip if PII was the entire name
    if (cleaned.startsWith("[") && cleaned.endsWith("]")) return;
    const key = `${type}:${cleaned}:${domain}`;
    if (seen.has(key)) return;
    seen.add(key);
    entities.push({ type, name: cleaned, domain });
  };

  const inferDomain = (text: string): string => {
    const lower = text.toLowerCase();
    for (const domain of knownDomains) {
      const parts = domain.split(":");
      for (const part of parts) {
        if (part.length > 2 && lower.includes(part.toLowerCase())) {
          return domain;
        }
      }
    }
    return knownDomains[0] ?? "unknown";
  };

  // Attempt structured JSON extraction
  let parsed: unknown;
  try {
    parsed = JSON.parse(toolResponse);
  } catch {
    // Not JSON — fall through to regex extraction
  }

  if (parsed !== undefined) {
    extractFromJson(parsed, "", addEntity, inferDomain, 0);
  } else {
    // Regex-based extraction for plain text
    extractFromText(toolResponse, addEntity, inferDomain);
  }

  return entities;
}

/**
 * Recursively walk a parsed JSON value and extract entities from
 * objects that have recognizable name/id/title/key fields.
 */
const MAX_JSON_DEPTH = 20;

function extractFromJson(
  value: unknown,
  parentKey: string,
  addEntity: (type: string, name: string, domain: string) => void,
  inferDomain: (text: string) => string,
  depth: number,
): void {
  if (depth > MAX_JSON_DEPTH) return;

  if (Array.isArray(value)) {
    for (const item of value) {
      extractFromJson(item, parentKey, addEntity, inferDomain, depth + 1);
    }
    return;
  }

  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;

    // Check for entity-like objects
    for (const field of NAME_FIELDS) {
      const val = obj[field];
      if (typeof val === "string" && val.length > 0) {
        const type = inferType(parentKey, obj);
        const domain = inferDomain(val);
        addEntity(type, val, domain);
      }
    }

    // Recurse into nested objects
    for (const [key, child] of Object.entries(obj)) {
      if (typeof child === "object" && child !== null) {
        extractFromJson(child, key, addEntity, inferDomain, depth + 1);
      }
    }
  }
}

/**
 * Infer an entity type from the parent key name or object structure.
 */
function inferType(parentKey: string, obj: Record<string, unknown>): string {
  // Use parent key as type hint if available
  if (parentKey) {
    // Singularize simple plurals
    const singular = parentKey.endsWith("s")
      ? parentKey.slice(0, -1)
      : parentKey;
    return singular.toLowerCase();
  }

  // Infer from object fields
  if ("arn" in obj) return "resource";
  if ("email" in obj) return "user";
  if ("url" in obj || "href" in obj) return "link";
  if ("path" in obj) return "file";

  return "entity";
}

/**
 * Extract potential entity names from plain text using regex patterns.
 */
function extractFromText(
  text: string,
  addEntity: (type: string, name: string, domain: string) => void,
  inferDomain: (text: string) => string,
): void {
  // Jira-style keys (e.g., PROJ-123)
  for (const match of text.matchAll(JIRA_KEY_REGEX)) {
    addEntity("ticket", match[0], inferDomain(match[0]));
  }

  // ARN-like strings
  for (const match of text.matchAll(ARN_REGEX)) {
    addEntity("resource", match[0], inferDomain(match[0]));
  }

  // Capitalized multi-word phrases
  for (const match of text.matchAll(CAPITALIZED_PHRASE_REGEX)) {
    addEntity("entity", match[0], inferDomain(match[0]));
  }
}
