import { db } from "@/db";
import { evalFindings, findings } from "@/db/schema";
import { dryRunTriage } from "@/lib/triageEngine";
import { eq } from "drizzle-orm";

export async function computeAccuracy(orgId: string) {
  const evalRows = await db.select().from(evalFindings).where(eq(evalFindings.orgId, orgId));

  const breakdown = [];
  let memoryOnCorrectDecision = 0;
  let memoryOffCorrectDecision = 0;
  let memoryOnCorrectSeverity = 0;
  let memoryOffCorrectSeverity = 0;

  for (const evalRow of evalRows) {
    const findingRows = await db.select().from(findings).where(eq(findings.id, evalRow.findingId!));
    const finding = findingRows[0];
    if (!finding) continue;

    const [withMemory, withoutMemory] = await Promise.all([
      dryRunTriage(finding, true),
      dryRunTriage(finding, false),
    ]);

    const memOnDecisionOk = withMemory.decision === evalRow.groundTruthDecision;
    const memOffDecisionOk = withoutMemory.decision === evalRow.groundTruthDecision;
    const memOnSeverityOk = withMemory.severity === evalRow.groundTruthSeverity;
    const memOffSeverityOk = withoutMemory.severity === evalRow.groundTruthSeverity;

    if (memOnDecisionOk) memoryOnCorrectDecision += 1;
    if (memOffDecisionOk) memoryOffCorrectDecision += 1;
    if (memOnSeverityOk) memoryOnCorrectSeverity += 1;
    if (memOffSeverityOk) memoryOffCorrectSeverity += 1;

    breakdown.push({
      findingId: finding.id,
      title: finding.title,
      cweType: finding.cweType,
      groundTruthDecision: evalRow.groundTruthDecision,
      groundTruthSeverity: evalRow.groundTruthSeverity,
      memoryOn: { decision: withMemory.decision, severity: withMemory.severity, correct: memOnDecisionOk && memOnSeverityOk },
      memoryOff: { decision: withoutMemory.decision, severity: withoutMemory.severity, correct: memOffDecisionOk && memOffSeverityOk },
    });
  }

  const total = evalRows.length || 1;
  return {
    totalEvalFindings: evalRows.length,
    memoryOn: {
      decisionAccuracy: Math.round((memoryOnCorrectDecision / total) * 1000) / 10,
      severityAccuracy: Math.round((memoryOnCorrectSeverity / total) * 1000) / 10,
    },
    memoryOff: {
      decisionAccuracy: Math.round((memoryOffCorrectDecision / total) * 1000) / 10,
      severityAccuracy: Math.round((memoryOffCorrectSeverity / total) * 1000) / 10,
    },
    breakdown,
  };
}
