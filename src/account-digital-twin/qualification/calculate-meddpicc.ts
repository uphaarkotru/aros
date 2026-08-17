import type {
  MEDDPICCField,
  MEDDPICCKey,
  MEDDPICCProfile,
} from "@/domain/accounts/account-digital-twin";
export const meddpiccKeys: MEDDPICCKey[] = [
  "metrics",
  "economic-buyer",
  "decision-criteria",
  "decision-process",
  "paper-process",
  "identify-pain",
  "champion",
  "competition",
];
export function calculateMEDDPICC(
  input: MEDDPICCField[],
  now: string,
): MEDDPICCProfile {
  const fields = meddpiccKeys.map(
    (key) =>
      input.find((f) => f.key === key) ?? {
        key,
        status: "missing" as const,
        value: "",
        confidence: 0,
        evidenceIds: [],
        lastUpdatedAt: now,
        owner: "Unassigned",
        gaps: [`${key} is not documented`],
        recommendedNextStep: `Validate ${key}`,
      },
  );
  const complete = fields.filter(
      (field) =>
        field.status === "confirmed" || field.status === "not-applicable",
    ).length,
    completenessScore = Math.round((complete / fields.length) * 100);
  const criticalGaps = fields
    .filter((f) => ["missing", "stale", "assumed"].includes(f.status))
    .map((f) => `${f.key}: ${f.gaps[0] ?? "requires validation"}`);
  return {
    fields,
    completenessScore,
    confirmedCount: fields.filter((f) => f.status === "confirmed").length,
    missingCount: fields.filter((f) => f.status === "missing").length,
    staleCount: fields.filter((f) => f.status === "stale").length,
    criticalGaps,
    recommendedActions: fields
      .filter((f) => f.status !== "confirmed" && f.status !== "not-applicable")
      .map((f) => f.recommendedNextStep),
  };
}
