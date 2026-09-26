// Builds the roster from two collections; give it room on a cold start
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { getCampusSchoolDatabase } from "@/lib/campus";
import { requireRole } from "@/lib/api-auth";
import { loadSectionDefinitions, normalizeBatch } from "@/lib/sections";
import { buildSectionRoster, isAllBranches } from "@/lib/section-roster";

/**
 * GET ?batch=&branch=   admin only. branch is optional; omit it, or pass "All",
 * for the whole batch.
 *
 * The students with their current section, for the Section Allotment page.
 * Includes inactive students (flagged, shown greyed out), students moved by a
 * branch override (flagged `overridden`, so they can be reviewed), and students
 * whose stored section was allotted in a different batch (flagged `stale`).
 */
export async function GET(req) {
  try {
    const { payload, error } = await requireRole(req, ["admin"]);
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const batch = normalizeBatch(searchParams.get("batch"));
    const branch = searchParams.get("branch");
    if (!batch) {
      return NextResponse.json({ error: "batch is required" }, { status: 400 });
    }

    const campus = searchParams.get("campus") || payload.campus || null;
    const db = (await clientPromise).db(getCampusSchoolDatabase(campus, "SOET"));

    const [sections, roster, totals] = await Promise.all([
      loadSectionDefinitions(db, batch),
      buildSectionRoster(db, branch, batch),
      // Batch-wide totals per section, across every branch - a combined section's
      // size is not visible from any single-branch view
      db.collection("student_sections")
        .aggregate([
          { $match: { batch } },
          { $group: { _id: "$section", count: { $sum: 1 } } },
        ])
        .toArray()
        .catch(() => []),
    ]);

    // Counts within this view. Inactive students are counted separately so the
    // headline numbers reflect who is actually studying.
    const counts = Object.fromEntries(sections.map(s => [s, 0]));
    let unassigned = 0, inactive = 0, stale = 0, branchChanged = 0;
    for (const s of roster.students) {
      if (s.overridden) branchChanged++;
      if (s.inactive) { inactive++; continue; }
      if (s.stale) stale++;
      if (s.section && s.section in counts) counts[s.section]++;
      else unassigned++;
    }

    const sectionTotals = Object.fromEntries(sections.map(s => [s, 0]));
    for (const t of totals) {
      if (t._id in sectionTotals) sectionTotals[t._id] = t.count;
    }

    return NextResponse.json({
      success: true,
      batch,
      branch: isAllBranches(branch) ? "All" : branch,
      sections,
      counts,
      sectionTotals,
      unassigned,
      inactive,
      stale,
      branchChanged,
      total: roster.students.length,
      students: roster.students,
    });
  } catch (e) {
    console.error("sections/students GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
