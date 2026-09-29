import { HindsightClient } from "@vectorize-io/hindsight-client";

/**
 * Singleton Hindsight client. Returns null when HINDSIGHT_BASE_URL is not
 * configured — callers should check for null and fall back to the Postgres
 * memory bank implementation.
 */
let _client: HindsightClient | null | undefined;

export function getHindsightClient(): HindsightClient | null {
  if (_client !== undefined) return _client;

  const baseUrl = process.env.HINDSIGHT_BASE_URL;
  if (!baseUrl) {
    console.log("[hindsight] HINDSIGHT_BASE_URL not set — using Postgres fallback memory bank");
    _client = null;
    return null;
  }

  const apiKey = process.env.HINDSIGHT_API_KEY;

  _client = new HindsightClient({
    baseUrl,
    ...(apiKey ? { apiKey } : {}),
  });
  console.log(`[hindsight] Connected to Hindsight at ${baseUrl} (auth: ${apiKey ? "API key" : "none"})`);
  return _client;
}

/**
 * Derive a Hindsight memory-bank ID from the org's memoryBankId field.
 * Hindsight bank IDs should be URL-safe slugs.
 */
export function orgBankId(memoryBankId: string): string {
  return `security-triage-${memoryBankId}`.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
}
