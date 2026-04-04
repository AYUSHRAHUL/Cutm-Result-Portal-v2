/** Parse "Sem 6" -> 6 */
export function semKeyToNum(key) {
  const m = String(key || "").match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

export function getProgramSemesterKeys({ isMba, isDiploma, isBba, bbaDegreeType }) {
  if (isMba) return ["Sem 1", "Sem 2", "Sem 3", "Sem 4"];
  if (isDiploma || (isBba && bbaDegreeType !== "4year"))
    return ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6"];
  return ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6", "Sem 7", "Sem 8"];
}

/**
 * If user picks a specific semester (not "All"), CBCS exports only show Sem 1 … Sem N.
 * N is rounded up to an even number when needed so the left/right semester layout stays paired,
 * unless N is already the program maximum.
 */
export function capSemesterKeysForReport(fullKeys, semesterValues) {
  const vals = (Array.isArray(semesterValues) ? semesterValues : []).filter(
    (v) => v && String(v).trim() !== "" && v !== "All"
  );
  if (vals.length === 0 || !fullKeys.length) return fullKeys;
  let maxN = 0;
  for (const v of vals) {
    const m = String(v).match(/\d+/);
    if (m) maxN = Math.max(maxN, parseInt(m[0], 10));
  }
  if (maxN <= 0) return fullKeys;
  const programMax = semKeyToNum(fullKeys[fullKeys.length - 1]);
  let cap = Math.min(maxN, programMax);
  if (cap % 2 === 1 && cap < programMax) cap += 1;
  return fullKeys.filter((k) => semKeyToNum(k) <= cap);
}
