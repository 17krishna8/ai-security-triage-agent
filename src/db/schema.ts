import {
  pgTable,
  uuid,
  text,
  boolean,
  jsonb,
  timestamp,
  real,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Organizations — memory is scoped per-organization (multi-tenant isolation).
// `memoryBankId` mirrors the idea of a dedicated Hindsight memory bank per org.
// ---------------------------------------------------------------------------
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  memoryBankId: text("memory_bank_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("analyst"), // analyst | admin
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Raw findings ingested from any source (SAST, dependency scan, bug bounty, manual)
export const findings = pgTable("findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id),
  source: text("source").notNull(), // sast | dependency_scan | bug_bounty | manual
  cweType: text("cwe_type"),
  title: text("title").notNull(),
  description: text("description"),
  evidence: text("evidence"),
  filePath: text("file_path"),
  rawPayload: jsonb("raw_payload"),
  status: text("status").notNull().default("pending"), // pending | triaged | resolved | needs_human_review
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Agent-generated verdicts — one row per triage run (a finding can be re-triaged,
// and is triaged once with memory on and once with memory off for comparison).
export const verdicts = pgTable("verdicts", {
  id: uuid("id").primaryKey().defaultRandom(),
  findingId: uuid("finding_id").references(() => findings.id),
  memoryEnabled: boolean("memory_enabled").notNull(),
  decision: text("decision").notNull(), // true_positive | false_positive | needs_human_review
  severity: text("severity"), // Critical | High | Medium | Low | Info
  severityReasoning: text("severity_reasoning"),
  suggestedFix: text("suggested_fix"),
  confidence: real("confidence"),
  decisionSource: text("decision_source").notNull().default("heuristic"), // heuristic | memory | llm | failsafe
  requiresHumanSignoff: boolean("requires_human_signoff").notNull().default(false),
  memoriesRecalled: jsonb("memories_recalled"), // every memory retrieved, with similarity
  memoriesUsed: jsonb("memories_used"), // subset actually used to steer the verdict
  llmRawResponse: jsonb("llm_raw_response"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Human review outcomes
export const humanOutcomes = pgTable("human_outcomes", {
  id: uuid("id").primaryKey().defaultRandom(),
  findingId: uuid("finding_id").references(() => findings.id),
  verdictId: uuid("verdict_id").references(() => verdicts.id),
  reviewerId: uuid("reviewer_id").references(() => users.id),
  finalDecision: text("final_decision").notNull(),
  finalSeverity: text("final_severity"),
  outcome: text("outcome").notNull(), // confirmed | overridden
  overrideReason: text("override_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Fix outcomes tracked after remediation
export const fixOutcomes = pgTable("fix_outcomes", {
  id: uuid("id").primaryKey().defaultRandom(),
  findingId: uuid("finding_id").references(() => findings.id),
  fixDescription: text("fix_description"),
  result: text("result").notNull(), // success | regression | partial
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Poisoning / suspicious-pattern alerts
export const memoryAlerts = pgTable("memory_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id),
  description: text("description"),
  severity: text("severity"),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Evaluation set for the accuracy dashboard (labeled ground truth)
export const evalFindings = pgTable("eval_findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id),
  findingId: uuid("finding_id").references(() => findings.id),
  groundTruthDecision: text("ground_truth_decision").notNull(),
  groundTruthSeverity: text("ground_truth_severity"),
});

// ---------------------------------------------------------------------------
// The Hindsight-style memory bank. In this build it is implemented on top of
// Postgres (retain = insert row, recall = lexical/keyword similarity search)
// so the whole app runs with zero external signup. The `memoryBank.ts` module
// is the ONLY module that reads/writes this table, mirroring the spec's
// requirement that a single wrapper own all Hindsight interaction.
// ---------------------------------------------------------------------------
export const memories = pgTable("memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id),
  findingId: uuid("finding_id").references(() => findings.id),
  memoryType: text("memory_type").notNull(), // verdict | severity | fix | override | reflection
  cweType: text("cwe_type"),
  summary: text("summary").notNull(),
  content: jsonb("content").notNull(),
  weight: text("weight").notNull().default("normal"), // normal | high
  sourceUserId: uuid("source_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
