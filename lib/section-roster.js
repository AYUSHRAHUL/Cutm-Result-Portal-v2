/**
 * The students of one SOET batch - optionally narrowed to one branch - for
 * section allotment.
 *
 * Sections belong to the batch and can combine branches (e.g. 2024 Section A =
 * Mechanical + Civil, B = part of ECE, C = the rest of ECE + EEE), so the roster
 * can be viewed per branch or for the whole batch at once.
 *
 * Built from BOTH the result and RegistrationData collections, so a new intake
 * that has registrations but no results yet is not missed. Branch and batch are
 * the student's *effective* ones: an admin's override wins over what the
 * registration number implies.
 */

import { loadBranchOverrides, isSameBranch } from "@/lib/branch-overrides";
import { loadStudentSections, normalizeBatch, resolveSection } from "@/lib/sections";

/** True when no single branch was asked for */
export function isAllBranches(branch) {
  return !branch || branch === "All" || branch === "all";
}

/** Registrations as both strings and numbers - Reg_No is stored both ways */
function withNumericVariants(regs) {
  const out = [];
  for (const r of regs) {
    const s = String(r || "").trim();
    if (!s) continue;
    out.push(s);
    const n = Number(s);
    if (Number.isSafeInteger(n) && String(n) === s) out.push(n);
  }
  return out;
}

/**
 * Distinct registrations (with a name) in one collection for a batch, plus any
 * registration carrying an override, since an override can move a student into a
 * batch their registration number does not imply.
 */
async function distinctRegs(collection, yy, overrideRegs) {
  const yyNum = Number(yy);
  const pipeline = [
    // Narrow first, in a form that can use an index: string prefix, numeric range,
    // or an explicit override registration
    {
      $match: {
        $or: [
          { Reg_No: { $regex: `^${yy}` } },
          { Reg_No: { $gte: yyNum * 1e10, $lt: (yyNum + 1) * 1e10 } },
          ...(overrideRegs.length ? [{ Reg_No: { $in: withNumericVariants(overrideRegs) } }] : []),
        ],
      },
    },
    { $project: { reg: { $toUpper: { $trim: { input: { $toString: "$Reg_No" } } } }, Name: 1 } },
    { $group: { _id: "$reg", name: { $first: "$Name" } } },
  ];

  try {
    return await collection.aggregate(pipeline, { allowDiskUse: true }).toArray();
  } catch (e) {
    console.warn("section roster: query failed -", e?.message);
    return [];
  }
}

/**
 * @param branch  one branch, or "All" / empty for the whole batch
 * @returns {Promise<{ students: object[], batch: string|null }>}
 *   Each student: { reg, name, branch, section, stale, previousSection,
 *                   inactive, overridden, originalBranch }
 */
export async function buildSectionRoster(db, branch, batch) {
  const batchYear = normalizeBatch(batch);
  if (!batchYear) return { students: [], batch: null };

  const allBranches = isAllBranches(branch);
  const yy = batchYear.slice(2);
  const { parseBTechRegistration } = await import("@/app/api/soet/parse-registration/route");

  const [overrides, sectionsMap, inactiveDocs] = await Promise.all([
    loadBranchOverrides(db),
    loadStudentSections(db),
    db
      .collection("student_status")
      .find({ isActive: { $in: [false, "false"] } }, { projection: { _id: 0, Reg_No: 1 } })
      .toArray()
      .catch(() => []),
  ]);

  const inactive = new Set(inactiveDocs.map(d => String(d.Reg_No || "").trim().toUpperCase()));
  const overrideRegs = Array.from(overrides.keys());

  const [fromResult, fromRegData] = await Promise.all([
    distinctRegs(db.collection("result"), yy, overrideRegs),
    distinctRegs(db.collection("RegistrationData"), yy, overrideRegs),
  ]);

  // Merge, preferring whichever source actually has a name
  const names = new Map();
  for (const row of [...fromResult, ...fromRegData]) {
    const reg = row._id;
    if (!reg) continue;
    if (!names.get(reg) && row.name) names.set(reg, String(row.name).trim());
    else if (!names.has(reg)) names.set(reg, "");
  }

  const students = [];
  for (const [reg, name] of names.entries()) {
    const ov = overrides.get(reg);
    const parsed = parseBTechRegistration(reg);
    const parsedBranch = parsed && parsed.isValid && parsed.isBTech ? parsed.branch : null;

    // Effective branch: the override wins. A student with neither is still listed
    // in the whole-batch view - with branch null - so they can be allotted rather
    // than silently left out; they just cannot match a single-branch view.
    const effectiveBranch = ov?.branch || parsedBranch || null;
    if (!allBranches && !(effectiveBranch && isSameBranch(effectiveBranch, branch))) continue;

    const effectiveBatch = normalizeBatch(ov?.batch) || normalizeBatch(reg.slice(0, 2));
    if (effectiveBatch !== batchYear) continue;

    const resolved = resolveSection(reg, effectiveBatch, sectionsMap);

    students.push({
      reg,
      name,
      branch: effectiveBranch,
      section: resolved.section,
      stale: resolved.stale,
      previousSection: resolved.previous ? resolved.previous.section : null,
      inactive: inactive.has(reg),
      // True when the student sits in this branch only because of an override
      overridden: Boolean(ov?.branch) && !(parsedBranch && isSameBranch(parsedBranch, ov.branch)),
      // What the registration number itself says; null if it cannot be read (e.g. code 132)
      originalBranch: parsedBranch,
    });
  }

  // Serial order (last four digits), matching the registration dropdowns elsewhere
  students.sort((a, b) =>
    a.reg.slice(-4).localeCompare(b.reg.slice(-4), undefined, { numeric: true }) ||
    a.reg.localeCompare(b.reg)
  );

  return { students, batch: batchYear };
}
