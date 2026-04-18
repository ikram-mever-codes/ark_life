// ═══════════════════════════════════════════════════════════════════════
// services/keywordSearchService.ts
// ═══════════════════════════════════════════════════════════════════════
//
// Replacement for embedding-based RAG. Uses TF-IDF scoring entirely in
// JavaScript — no OpenAI, no vector DB, no external dependencies.
//
// How it works:
//   1. Extract keywords from user's query (remove stopwords, normalize)
//   2. Fetch all chunks for the user's scope (vault + optional avatar)
//   3. Score each chunk: count query-term matches, weight by term rarity
//   4. Return top N chunks for GPT context
//
// Quality is "good enough for demo" — it handles:
//   - Multi-word queries ("tell me about my education")
//   - Partial matches (case-insensitive, word-boundary aware)
//   - Ranking by relevance (chunks with more rare matches rank higher)
//
// Does NOT handle:
//   - Semantic similarity ("car" ≠ "automobile" here; use embeddings for that)
//   - Typo tolerance (exact keyword match only)

import mongoose from "mongoose";
import MemoryChunk from "../models/MemoryChunk";

// Common English stopwords that hurt retrieval if we match on them.
// Kept small intentionally — over-filtering can be worse than under-filtering.
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "should",
  "could",
  "may",
  "might",
  "must",
  "can",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "with",
  "by",
  "from",
  "up",
  "about",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "under",
  "this",
  "that",
  "these",
  "those",
  "i",
  "me",
  "my",
  "you",
  "your",
  "he",
  "him",
  "his",
  "she",
  "her",
  "it",
  "its",
  "we",
  "us",
  "our",
  "they",
  "them",
  "their",
  "what",
  "which",
  "who",
  "when",
  "where",
  "why",
  "how",
  "all",
  "each",
  "every",
  "both",
  "few",
  "more",
  "most",
  "some",
  "such",
  "no",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "just",
  "as",
  "if",
  "then",
  "now",
  "also",
]);

/**
 * Tokenize text into searchable keywords.
 * Lowercases, strips punctuation, removes stopwords, drops very short tokens.
 */
function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // strip punctuation
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/**
 * Tokenize into a multiset (term → count) for TF calculations.
 */
function tokenizeToCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tok of tokenize(text)) {
    counts.set(tok, (counts.get(tok) || 0) + 1);
  }
  return counts;
}

/**
 * Score one chunk against a query using a TF-IDF-inspired formula.
 *
 * score = Σ (termCountInChunk × log(totalChunks / chunksContainingTerm))
 *
 * Chunks containing rare query terms rank higher. Chunks mentioning
 * terms repeatedly rank higher. Common terms contribute less.
 */
function scoreChunk(
  chunkText: string,
  queryTerms: string[],
  totalChunks: number,
  docFrequency: Map<string, number>,
): number {
  const chunkCounts = tokenizeToCounts(chunkText);
  let score = 0;

  for (const term of queryTerms) {
    const tf = chunkCounts.get(term) || 0;
    if (tf === 0) continue;

    const df = docFrequency.get(term) || 1;
    // IDF smoothed so even common terms contribute a tiny amount
    const idf = Math.log((totalChunks + 1) / (df + 1)) + 1;

    score += tf * idf;
  }

  return score;
}

/**
 * Build document-frequency map: for each unique query term,
 * how many chunks in the corpus contain that term at least once?
 * We only need this for query terms (not the whole vocabulary).
 */
function buildDocFrequency(
  chunks: Array<{ text: string }>,
  queryTerms: string[],
): Map<string, number> {
  const df = new Map<string, number>();

  for (const term of queryTerms) {
    df.set(term, 0);
  }

  for (const chunk of chunks) {
    const seen = new Set<string>();
    for (const tok of tokenize(chunk.text)) {
      if (df.has(tok) && !seen.has(tok)) {
        df.set(tok, (df.get(tok) || 0) + 1);
        seen.add(tok);
      }
    }
  }

  return df;
}

/**
 * Main search function. Finds the top K chunks from the user's memory
 * vault that best match the given query via keyword scoring.
 *
 * Scoped by userId and optionally avatarId — chunks tagged for a specific
 * avatar are returned when that avatar is provided, along with any
 * general (untagged) chunks.
 */
export async function findTopChunksByKeyword(
  userId: string,
  query: string,
  avatarId?: string,
  topK: number = 3,
): Promise<Array<{ text: string; score: number; source?: string }>> {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) {
    console.log("[KeywordSearch] Query tokenized to nothing, skipping");
    return [];
  }

  // Build MongoDB query with avatar scoping
  const mongoQuery: any = {
    userId: new mongoose.Types.ObjectId(userId),
  };
  if (avatarId) {
    mongoQuery.$or = [
      { avatarId: new mongoose.Types.ObjectId(avatarId) },
      { avatarId: null },
      { avatarId: { $exists: false } },
    ];
  }

  // Only fetch the text field (not embedding vectors) to keep memory small
  const chunks = await MemoryChunk.find(mongoQuery, {
    text: 1,
    source: 1,
    _id: 0,
  }).lean();

  if (chunks.length === 0) {
    console.log(
      `[KeywordSearch] No chunks found for user=${userId} avatar=${avatarId || "any"}`,
    );
    return [];
  }

  console.log(
    `[KeywordSearch] Scoring ${chunks.length} chunks against query "${query}" (terms: ${queryTerms.join(", ")})`,
  );

  // Compute document frequency for IDF weighting
  const docFreq = buildDocFrequency(chunks, queryTerms);

  // Score all chunks
  const scored = chunks
    .map((chunk: any) => ({
      text: chunk.text,
      source: chunk.source,
      score: scoreChunk(chunk.text, queryTerms, chunks.length, docFreq),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  console.log(
    `[KeywordSearch] Top ${scored.length} chunks (scores: ${scored.map((s) => s.score.toFixed(2)).join(", ")})`,
  );

  return scored;
}
