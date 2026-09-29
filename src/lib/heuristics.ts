import type { Decision, ParsedFinding, Severity } from "@/lib/types";

export interface BaseCall {
  decision: Decision;
  severity: Severity;
  severityReasoning: string;
  suggestedFix: string;
}

interface Rule {
  match: (f: ParsedFinding) => boolean;
  call: (f: ParsedFinding) => BaseCall;
}

function hasAny(haystack: string, needles: string[]): boolean {
  const h = haystack.toLowerCase();
  return needles.some((n) => h.includes(n));
}

const rules: Rule[] = [
  {
    // Hardcoded credentials — naive heuristic flags anything, including test fixtures.
    match: (f) => f.cweType === "CWE-798",
    call: (f) => ({
      decision: "true_positive",
      severity: "High",
      severityReasoning:
        "Hardcoded credential/secret detected in source. Treated as High by default because leaked static secrets are directly exploitable if the repository or artifact is exposed.",
      suggestedFix:
        "Revoke/rotate the exposed credential immediately, move secrets to a managed vault (e.g. env vars + secrets manager), and add a pre-commit secret scanner.",
    }),
  },
  {
    match: (f) => f.cweType === "CWE-89",
    call: () => ({
      decision: "true_positive",
      severity: "Critical",
      severityReasoning:
        "Unsanitized user input appears to reach SQL query construction directly, allowing arbitrary query manipulation.",
      suggestedFix: "Use parameterized queries / an ORM query builder; never concatenate user input into SQL strings.",
    }),
  },
  {
    match: (f) => f.cweType === "CWE-79",
    call: () => ({
      decision: "true_positive",
      severity: "High",
      severityReasoning:
        "Reflected/stored user input is rendered without output encoding, enabling script injection in the victim's browser context.",
      suggestedFix: "Contextually encode output, adopt a strict Content-Security-Policy, and use templating engines with auto-escaping enabled.",
    }),
  },
  {
    match: (f) => f.cweType === "CWE-22",
    call: () => ({
      decision: "true_positive",
      severity: "High",
      severityReasoning: "User-controlled path segments reach filesystem APIs without canonicalization, allowing traversal outside the intended directory.",
      suggestedFix: "Canonicalize paths and validate against an allow-list of permitted directories/files before file access.",
    }),
  },
  {
    match: (f) => f.cweType === "CWE-352",
    call: () => ({
      decision: "true_positive",
      severity: "High",
      severityReasoning: "State-changing endpoint lacks anti-CSRF protections and relies on ambient cookie auth, making it forgeable from a third-party origin.",
      suggestedFix: "Add anti-CSRF tokens (or SameSite=strict cookies) to all state-changing requests.",
    }),
  },
  {
    match: (f) => f.cweType === "CWE-611",
    call: () => ({
      decision: "true_positive",
      severity: "Critical",
      severityReasoning: "XML parser resolves external entities from untrusted input, enabling SSRF/local file disclosure.",
      suggestedFix: "Disable DTD processing and external entity resolution in the XML parser configuration.",
    }),
  },
  {
    match: (f) => f.cweType === "CWE-502",
    call: () => ({
      decision: "true_positive",
      severity: "Critical",
      severityReasoning: "Untrusted data is passed to a native deserializer, which can lead to remote code execution via gadget chains.",
      suggestedFix: "Avoid deserializing untrusted input with native serializers; use a schema-validated format such as JSON with strict typing.",
    }),
  },
  {
    match: (f) => f.cweType === "CWE-916",
    call: () => ({
      decision: "true_positive",
      severity: "Medium",
      severityReasoning: "Passwords are hashed with a fast/legacy algorithm lacking adequate work factor, making offline cracking feasible if the hash store leaks.",
      suggestedFix: "Migrate to bcrypt/scrypt/argon2id with a tuned work factor, and rehash on next successful login.",
    }),
  },
  {
    match: (f) => f.cweType === "CWE-601",
    call: () => ({
      decision: "true_positive",
      severity: "Medium",
      severityReasoning: "Redirect target is derived from user input without validation against an allow-list, enabling phishing via open redirect.",
      suggestedFix: "Validate redirect targets against an allow-list of known-safe relative paths or registered domains.",
    }),
  },
  {
    match: (f) => f.cweType === "CVE" || f.source === "dependency_scan",
    call: (f) => {
      const cvssMatch = f.summary.match(/cvss[:\s]*([0-9]+(?:\.[0-9]+)?)/i);
      const cvss = cvssMatch ? parseFloat(cvssMatch[1]) : 7.0;
      let severity: Severity = "Medium";
      if (cvss >= 9) severity = "Critical";
      else if (cvss >= 7) severity = "High";
      else if (cvss >= 4) severity = "Medium";
      else severity = "Low";
      return {
        decision: "true_positive",
        severity,
        severityReasoning: `Vulnerable dependency version detected (approx. CVSS ${cvss.toFixed(1)}). Severity derived directly from the advisory score without yet accounting for actual reachability in this codebase.`,
        suggestedFix: "Upgrade the dependency to the patched version indicated by the advisory; pin and re-run the scan to confirm.",
      };
    },
  },
];

const fallback: BaseCall = {
  decision: "needs_human_review",
  severity: "Medium",
  severityReasoning: "No confident heuristic pattern matched this finding type; routing to human review rather than guessing.",
  suggestedFix: "Manual triage required to determine remediation.",
};

/**
 * The "fresh reasoning" baseline an LLM would produce with no memory context.
 * Deliberately naive/context-blind on purpose — it mirrors what a triage
 * analyst (or a memory-less LLM) would conclude from the finding text alone,
 * which is exactly the gap Hindsight-style recall is meant to close.
 */
export function baseHeuristicCall(f: ParsedFinding): BaseCall {
  for (const rule of rules) {
    if (rule.match(f)) return rule.call(f);
  }
  return fallback;
}

export function parseFindingText(f: {
  id: string;
  orgId: string | null;
  cweType: string | null;
  title: string;
  description: string | null;
  evidence: string | null;
  filePath: string | null;
  source: string;
}): ParsedFinding {
  const summary = [f.title, f.description, f.evidence, f.filePath]
    .filter(Boolean)
    .join(". ");
  return {
    id: f.id,
    orgId: f.orgId,
    cweType: f.cweType ?? "unknown",
    title: f.title,
    summary,
    filePath: f.filePath,
    source: f.source,
    keywords: summary
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  };
}

export function hasContext(f: ParsedFinding, needles: string[]): boolean {
  return hasAny(f.summary + " " + (f.filePath ?? ""), needles);
}
