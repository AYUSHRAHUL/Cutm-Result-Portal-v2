// Validates against the roster, which reads two collections
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { getCampusSchoolDatabase } from "@/lib/campus";
import { requireRole } from "@/lib/api-auth";
import {
  loadSectionDefinitions,
  normalizeBatch,
  normalizeSectionName,
  sectionBranchKey,
} from "@/lib/sections";
import { buildSectionRoster } from "@/lib/section-roster";

/**
 * POST { batch, regs: [...], section }   admin only
 *
 * Put the given students into `section`, or take them out of any section when
 * `section` is null or "". Used for tick-and-assign: many students, one section.
 * Also how an admin changes a student's section - including after a branch
 * override, which leaves the section in place until changed here.
 *
 * A section may combine branches, so students are validated against the whole
 * batch, not one branch. Registrations not in this batch are reported back
 * rather than silently stored.
 */
export async function POST(req) {
  try {
    const { payload, error } = await requireRole(req, ["admin"]);
    if (error) return error;

    const body = await req.json().catch(() => ({}));
    const batch = normalizeBatch(body?.batch);
    const regs = Array.isArray(body?.regs)
      ? [...new Set(body.regs.map(r => String(r || "").trim().toUpperCase()).filter(Boolean))]
      : [];

    if (!batch) {
      return NextResponse.json({ error: "batch is required" }, { status: 400 });
    }
    if (regs.length === 0) {
      return NextResponse.json({ error: "No students selected" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const campus = searchParams.get("campus") || payload.campus || null;
    const db = (await clientPromise).db(getCampusSchoolDatabase(campus, "SOET"));

    // Unassigning is allowed without a section; assigning needs a defined one
    const unassign = body?.section === null || body?.section === undefined || body?.section === "";
    let section = null;
    if (!unassign) {
      section = normalizeSectionName(body.section);
      const defined = await loadSectionDefinitions(db, batch);
      if (!section || !defined.includes(section)) {
        return NextResponse.json({
          error: `Section ${body.section} is not defined for ${batch}`
        }, { status: 400 });
      }
    }

    // Only write students who genuinely belong to this batch (any branch)
    const roster = await buildSectionRoster(db, "All", batch);
    const byReg = new Map(roster.students.map(s => [s.reg, s]));
    const valid = regs.filter(r => byReg.has(r));
    const rejected = regs.filter(r => !byReg.has(r));

    const collection = db.collection("student_sections");
    await collection.createIndex({ reg: 1 }, { unique: true });

    if (valid.length > 0) {
      if (unassign) {
        await collection.deleteMany({ reg: { $in: valid } });
      } else {
        const now = new Date();
        await collection.bulkWrite(
          valid.map(reg => ({
            updateOne: {
              filter: { reg },
              update: {
                $set: {
                  reg,
                  section,
                  batch,
                  // The student's branch at the time of allotment - informational
                  branchKey: sectionBranchKey(byReg.get(reg).branch) || null,
                  updatedAt: now,
                  updatedBy: payload.email,
                },
              },
              upsert: true,
            },
          })),
          { ordered: false }
        );
      }
    }

    return NextResponse.json({
      success: true,
      section: unassign ? null : section,
      updated: valid.length,
      ...(rejected.length > 0 && {
        rejected,
        warning: `${rejected.length} registration(s) are not in batch ${batch} and were not changed`
      }),
    });
  } catch (e) {
    console.error("sections/assign POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
