// Builds the roster from two collections; give it room on a cold start
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { getCampusSchoolDatabase } from "@/lib/campus";
import { requireRole } from "@/lib/api-auth";
import { loadSectionDefinitions, normalizeBatch } from "@/lib/sections";
import { buildSectionRoster } from "@/lib/section-roster";

/**
 * GET ?branch=&batch=   admin only
 *
 * The students of one SOET branch + batch with their current section, for the
 * Section Allotment page. Includes inactive students (flagged, shown greyed out)
 * and students whose stored section was allotted under a different branch or
 * batch (flagged `stale`, shown as needing reassignment).
 */
export async function GET(req) {
  try {
    const { payload, error } = await requireRole(req, ["admin"]);
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const branch = searchParams.get("branch");
    const batch = normalizeBatch(searchParams.get("batch"));
    if (!branch || !batch) {
      return NextResponse.json({ error: "branch and batch are required" }, { status: 400 });
    }

    const campus = searchParams.get("campus") || payload.campus || null;
    const db = (await clientPromise).db(getCampusSchoolDatabase(campus, "SOET"));

    const [sections, roster] = await Promise.all([
      loadSectionDefinitions(db, branch, batch),
      buildSectionRoster(db, branch, batch),
    ]);

    // Counts per section, plus unassigned; inactive students counted separately so
    // the headline numbers reflect who is actually studying
    const counts = Object.fromEntries(sections.map(s => [s, 0]));
    let unassigned = 0;
    let inactive = 0;
    let stale = 0;
    for (const s of roster.students) {
      if (s.inactive) { inactive++; continue; }
      if (s.stale) stale++;
      if (s.section && s.section in counts) counts[s.section]++;
      else unassigned++;
    }

    return NextResponse.json({
      success: true,
      branch,
      branchKey: roster.branchKey,
      batch,
      sections,
      counts,
      unassigned,
      inactive,
      stale,
      total: roster.students.length,
      students: roster.students,
    });
  } catch (e) {
    console.error("sections/students GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
