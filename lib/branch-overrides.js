/**
 * Branch overrides - the admin's explicit statement of which branch a student
 * belongs to, stored in the `branch_overrides` collection as { reg, branch, batch }.
 *
 * They exist because parseBTechRegistration only recognises branch codes
 * 111/112/113/115/116/137. A genuine B.Tech student on any other code (253001320002
 * is B.Tech Phyto Pharma, code 132) cannot be read from the registration number at
 * all, so an admin assigns the branch by hand in Branch Change.
 *
 * Any endpoint that derives a branch from a registration number should resolve it
 * through here, otherwise the same student appears under different branches on
 * different screens.
 */

/**
 * Reduce any spelling of a branch to one comparison key.
 *
 * The same branch is written several ways across the code and the data - "AIML" /
 * "CSE AIML" / "CSE-AIML", "ME" / "Mechanical" / "Mechanical Engineering" - so
 * comparing with === silently fails. Unknown branches return their stripped
 * upper-case form, which still compares equal to themselves.
 */
export function normalizeBranchKey(value) {
  const up = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!up) return null;

  // AIML first, so "CSE AIML" is not captured by the CSE rule below
  if (up.includes("AIML") || up.includes("ARTIFICIALINTELLIGENCE")) return "AIML";
  if (up === "CSE" || up.includes("COMPUTER")) return "CSE";
  if (up === "ECE" || up.includes("ELECTRONICSCOMMUNICATION")) return "ECE";
  if (up === "EEE" || up === "EE" || up.includes("ELECTRICAL")) return "EEE";
  if (up === "ME" || up === "MECH" || up.includes("MECHANICAL")) return "MECH";
  if (up.includes("CIVIL")) return "CIVIL";
  if (up.includes("MINING")) return "MINING";
  if (up.includes("AUTOMOBILE")) return "AUTOMOBILE";

  // SOM programmes, which reach this function via the same department filters
  if (up === "BBA" || up.includes("BACHELOROFBUSINESS")) return "BBA";
  if (up === "MBA" || up.includes("MASTEROFBUSINESS")) return "MBA";

  return up;
}

/** True when two branch names mean the same branch, whatever their spelling. */
export function isSameBranch(a, b) {
  const ka = normalizeBranchKey(a);
  const kb = normalizeBranchKey(b);
  return ka !== null && ka === kb;
}

/**
 * Load every override for a database, keyed by upper-case registration.
 * Never throws: a missing collection yields an empty map, so callers degrade to
 * their existing registration-derived behaviour.
 *
 * @returns {Promise<Map<string, {branch: string|null, batch: string|null}>>}
 */
export async function loadBranchOverrides(db) {
  const map = new Map();
  try {
    const docs = await db
      .collection("branch_overrides")
      .find({}, { projection: { _id: 0, reg: 1, branch: 1, batch: 1 } })
      .toArray();

    for (const d of docs) {
      const reg = String(d.reg || "").trim().toUpperCase();
      if (!reg) continue;
      map.set(reg, {
        branch: d.branch ? String(d.branch).trim() : null,
        batch: d.batch ? String(d.batch).trim() : null,
      });
    }
  } catch (e) {
    console.warn("loadBranchOverrides: could not read branch_overrides -", e?.message);
  }
  return map;
}

/** The branch a student should be treated as, preferring the admin's override. */
export function effectiveBranch(reg, derivedBranch, overrides) {
  const o = overrides?.get(String(reg || "").trim().toUpperCase());
  return o?.branch || derivedBranch || null;
}

/** The batch a student should be treated as, preferring the admin's override. */
export function effectiveBatch(reg, derivedBatch, overrides) {
  const o = overrides?.get(String(reg || "").trim().toUpperCase());
  return o?.batch || derivedBatch || null;
}

/**
 * Split overrides against one target branch.
 *
 * Filtering by branch needs both halves: students overridden INTO the branch must be
 * added even though their registration says otherwise, and students overridden OUT of
 * it must be removed even though their registration still matches. Using only the
 * first half double-counts them.
 *
 * @returns {{ include: string[], exclude: string[] }} upper-case registrations
 */
export function partitionOverridesForBranch(overrides, branch) {
  const include = [];
  const exclude = [];
  if (!overrides || !branch) return { include, exclude };

  for (const [reg, o] of overrides.entries()) {
    if (!o?.branch) continue;
    if (isSameBranch(o.branch, branch)) include.push(reg);
    else exclude.push(reg);
  }
  return { include, exclude };
}
