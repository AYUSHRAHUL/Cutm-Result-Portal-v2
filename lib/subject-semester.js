/**
 * CBCS track API (`/api/cbcs/track`) stores semester on subject rows as `Sem`.
 * Older export/UI code only read `semester`, which left semester grids empty.
 */

export function getSubjectSemesterRaw(subject) {
  if (!subject || typeof subject !== "object") return "";
  const v = subject.semester ?? subject.Semester ?? subject.Sem ?? subject.sem;
  if (v == null || v === "") return "";
  return String(v).trim();
}

export function normalizeSemesterBucket(subject) {
  let sem = getSubjectSemesterRaw(subject);
  if (!sem) return "Unknown";
  sem = sem.replace(/semester\s*/i, "Sem ").replace(/sem\s*/i, "Sem ").trim();
  if (!sem.match(/^Sem\s*\d+$/i) && sem.match(/^\d+$/)) {
    sem = `Sem ${sem}`;
  }
  if (!sem.match(/^Sem\s*\d+$/i)) {
    const numMatch = sem.match(/\d+/);
    if (numMatch) sem = `Sem ${numMatch[0]}`;
  }
  return sem;
}

/** Table cell: show N/A when semester is missing after normalization. */
export function formatSemesterDisplay(subject) {
  const s = normalizeSemesterBucket(subject);
  return s === "Unknown" ? "N/A" : s;
}
