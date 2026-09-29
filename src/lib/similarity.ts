// Lightweight text-similarity utilities used to stand in for Hindsight's
// semantic (embedding-based) recall, so the whole demo runs with zero
// external signup / API keys. Given a small corpus of memories per org this
// TF-IDF-ish cosine score behaves reasonably close to semantic recall for
// short security-finding summaries.

const STOPWORDS = new Set([
  "the", "a", "an", "in", "on", "of", "to", "for", "and", "or", "is", "are",
  "was", "were", "be", "been", "this", "that", "with", "as", "by", "at",
  "it", "from", "via", "into", "not", "can", "which", "when", "if", "has",
  "have", "had", "but", "than", "then", "so", "we", "our", "their", "its",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s#./_-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function termFreq(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

/** Cosine similarity between the raw (unweighted) term-frequency vectors of two texts. */
export function textSimilarity(a: string, b: string): number {
  const tfa = termFreq(tokenize(a));
  const tfb = termFreq(tokenize(b));
  if (tfa.size === 0 || tfb.size === 0) return 0;

  let dot = 0;
  for (const [term, freqA] of tfa) {
    const freqB = tfb.get(term);
    if (freqB) dot += freqA * freqB;
  }
  const magA = Math.sqrt([...tfa.values()].reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt([...tfb.values()].reduce((s, v) => s + v * v, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

/** Deterministic pseudo-random-looking float in [min,max) derived from a string seed. */
export function seededFloat(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const normalized = (Math.abs(hash) % 10000) / 10000;
  return min + normalized * (max - min);
}
