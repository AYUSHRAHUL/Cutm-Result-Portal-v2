import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";
import { getCampusSchoolDatabase } from "@/lib/campus";
import { requireRole } from "@/lib/api-auth";
import { loadSectionDefinitions, normalizeBatch, normalizeSectionName } from "@/lib/sections";

/**
 * Section names for one SOET batch. Sections belong to the batch and may combine
 * branches, so they are not keyed by branch.
 *
 * GET  ?batch=   admin or teacher - teachers need the names for filters
 * POST { action, batch, ... }   admin only
 *        action "add"     { name }
 *        action "rename"  { from, to }   - students in `from` move to `to`
 *        action "remove"  { name }       - refused while any student is in it
 */

function getDb(client, req, payload) {
  const { searchParams } = new URL(req.url);
  const campus = searchParams.get("campus") || payload.campus || null;
  return client.db(getCampusSchoolDatabase(campus, "SOET"));
}

export async function GET(req) {
  try {
    const { payload, error } = await requireRole(req, ["admin", "teacher"]);
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const batch = normalizeBatch(searchParams.get("batch"));
    if (!batch) {
      return NextResponse.json({ error: "batch is required" }, { status: 400 });
    }

    const db = getDb(await clientPromise, req, payload);
    const sections = await loadSectionDefinitions(db, batch);

    return NextResponse.json({ success: true, batch, sections });
  } catch (e) {
    console.error("sections/definitions GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { payload, error } = await requireRole(req, ["admin"]);
    if (error) return error;

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const batch = normalizeBatch(body?.batch);
    if (!batch) {
      return NextResponse.json({ error: "batch is required" }, { status: 400 });
    }

    const db = getDb(await clientPromise, req, payload);
    const definitions = db.collection("section_definitions");
    const studentSections = db.collection("student_sections");
    await definitions.createIndex({ batch: 1 }, { unique: true });

    const current = await loadSectionDefinitions(db, batch);
    const stamp = { updatedAt: new Date(), updatedBy: payload.email };
    const save = (sections) =>
      definitions.updateOne(
        { batch },
        { $set: { batch, sections, ...stamp } },
        { upsert: true }
      );

    if (action === "add") {
      const name = normalizeSectionName(body.name);
      if (!name) {
        return NextResponse.json({
          error: "Section name must be 1-12 letters, digits, spaces or hyphens, and not ALL or UNASSIGNED"
        }, { status: 400 });
      }
      if (current.includes(name)) {
        return NextResponse.json({ error: `Section ${name} already exists in ${batch}` }, { status: 409 });
      }
      await save([...current, name]);
      return NextResponse.json({ success: true, sections: [...current, name] });
    }

    if (action === "rename") {
      const from = normalizeSectionName(body.from);
      const to = normalizeSectionName(body.to);
      if (!from || !current.includes(from)) {
        return NextResponse.json({ error: `Section ${body.from} does not exist in ${batch}` }, { status: 404 });
      }
      if (!to) {
        return NextResponse.json({ error: "New section name is not valid" }, { status: 400 });
      }
      if (from === to) return NextResponse.json({ success: true, sections: current });
      if (current.includes(to)) {
        return NextResponse.json({ error: `Section ${to} already exists in ${batch}` }, { status: 409 });
      }

      const sections = current.map(s => (s === from ? to : s));
      await save(sections);
      // Students move with the section, so nobody is left pointing at the old name
      const moved = await studentSections.updateMany(
        { batch, section: from },
        { $set: { section: to, ...stamp } }
      );
      return NextResponse.json({ success: true, sections, studentsMoved: moved.modifiedCount });
    }

    if (action === "remove") {
      const name = normalizeSectionName(body.name);
      if (!name || !current.includes(name)) {
        return NextResponse.json({ error: `Section ${body.name} does not exist in ${batch}` }, { status: 404 });
      }
      // Refuse rather than silently unassign students
      const inUse = await studentSections.countDocuments({ batch, section: name });
      if (inUse > 0) {
        return NextResponse.json({
          error: `Section ${name} still has ${inUse} student(s). Move them to another section first.`,
          studentsInSection: inUse
        }, { status: 409 });
      }
      const sections = current.filter(s => s !== name);
      await save(sections);
      return NextResponse.json({ success: true, sections });
    }

    return NextResponse.json({ error: "action must be add, rename or remove" }, { status: 400 });
  } catch (e) {
    console.error("sections/definitions POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
