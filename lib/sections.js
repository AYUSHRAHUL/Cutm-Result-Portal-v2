/**
 * Section allotment - which section a student belongs to within their batch.
 *
 * Nothing is uploaded: an admin allots sections in the Section Allotment module.
 * Two collections, both in the campus/school database:
 *
 *   section_definitions  { batch, sections: ["A","B",...], updatedAt, updatedBy }
 *       The section names that exist in one batch. A name is unique within its
 *       batch, and a section may hold students from ANY branch - some sections
 *       combine branches (e.g. Civil and Mechanical taught together), others are
 *       single-branch. The model does not need to know which.
 *
 *   student_sections     { reg, section, batch, branchKey, updatedAt, updatedBy }
 *       One entry per student. Permanent for the programme, but can be changed.
 *       branchKey records the student's branch when allotted - informational only.
 *
 * A student's section is honoured while it still matches their *current* batch.
 * A branch override does not affect it: the student is still in the same batch
 * and the same class. Only a batch change leaves the old section behind, in which
 * case they read as Unassigned and are flagged for reassignment.
 */

import { normalizeBranchKey } from "@/lib/branch-overrides";

/** Filter value meaning "students with no section" */
export const UNASSIGNED = "__UNASSIGNED__";

/** Names that cannot be used for a section, because filters use them */
const RESERVED_SECTION_NAMES = new Set(["ALL", "UNASSIGNED", UNASSIGNED]);

/**
 * "25" or "2025" -> "2025". Returns null for anything that is not a batch year.
 */
export function normalizeBatch(value) {
  const s = String(value ?? "").trim();
  if (/^\d{2}$/.test(s)) return `20${s}`;
  if (/^20\d{2}$/.test(s)) return s;
  return null;
}

/**
 * Tidy a section name for storage: trimmed, single-spaced, upper-case.
 * Returns null if it is empty, too long, reserved, or uses odd characters.
 */
export function normalizeSectionName(value) {
  const s = String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  if (!s || s.length > 12) return null;
  if (!/^[A-Z0-9][A-Z0-9 \-]*$/.test(s)) return null;
  if (RESERVED_SECTION_NAMES.has(s)) return null;
  return s;
}

/** Canonical key for a branch, so spelling variants compare equal */
export function sectionBranchKey(branch) {
  return normalizeBranchKey(branch);
}

/**
 * Section names defined for one batch, in their saved order.
 */
export async function loadSectionDefinitions(db, batch) {
  const batchYear = normalizeBatch(batch);
  if (!batchYear) return [];

  const doc = await db
    .collection("section_definitions")
    .findOne({ batch: batchYear }, { projection: { _id: 0, sections: 1 } });
  return Array.isArray(doc?.sections) ? doc.sections : [];
}

/**
 * Every student's stored section, keyed by upper-case registration.
 * Never throws: a missing collection yields an empty map, so screens that filter
 * by section degrade to "everyone unassigned" rather than failing.
 *
 * @returns {Promise<Map<string, {section: string, batch: string|null}>>}
 */
export async function loadStudentSections(db) {
  const map = new Map();
  try {
    const docs = await db
      .collection("student_sections")
      .find({}, { projection: { _id: 0, reg: 1, section: 1, batch: 1 } })
      .toArray();
    for (const d of docs) {
      const reg = String(d.reg || "").trim().toUpperCase();
      if (!reg || !d.section) continue;
      map.set(reg, { section: d.section, batch: d.batch || null });
    }
  } catch (e) {
    console.warn("loadStudentSections: could not read student_sections -", e?.message);
  }
  return map;
}

/**
 * The section a student is in, given their CURRENT effective batch.
 *
 * @returns {{ section: string|null, stale: boolean, previous: object|null }}
 *   section  - the section to use, or null if unassigned
 *   stale    - true when a section is stored but was allotted in a different batch
 *              (the student was moved by a batch override)
 *   previous - the stored entry when stale, so the page can say what it was
 */
export function resolveSection(reg, effectiveBatch, sectionsMap) {
  const entry = sectionsMap?.get(String(reg || "").trim().toUpperCase());
  if (!entry) return { section: null, stale: false, previous: null };

  const batchYear = normalizeBatch(effectiveBatch);
  if (!entry.batch || entry.batch === batchYear) {
    return { section: entry.section, stale: false, previous: null };
  }
  return { section: null, stale: true, previous: entry };
}

/**
 * Whether a resolved section passes a Section filter value.
 * wanted: "" / "All" / null -> everyone; UNASSIGNED -> no section; otherwise that name.
 */
export function sectionMatchesFilter(section, wanted) {
  if (!wanted || wanted === "All" || wanted === "all") return true;
  if (wanted === UNASSIGNED) return !section;
  return section === normalizeSectionName(wanted);
}
