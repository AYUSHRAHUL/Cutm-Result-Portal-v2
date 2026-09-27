"use client";

import { useEffect, useState } from "react";
import { appendSchoolParams, getSchoolAndCampus, getSchoolApiUrl } from "@/lib/api-helper";
import { UNASSIGNED } from "@/lib/sections";

/**
 * Pick a student by Batch -> Branch -> Section instead of typing their registration
 * number. Used on the admin and teacher Results pages; kept as one shared component
 * so the two copies cannot drift apart.
 *
 * SOET only (section allotment exists only there); renders nothing for other schools.
 * Sections belong to a batch and can combine branches, so Branch "All" plus a
 * section lists a combined section whole. With a branch chosen, only the sections
 * holding that branch's students are offered.
 *
 * @param {(registration: string) => void} onPick  called when a student is chosen
 */
export default function SectionStudentPicker({ onPick }) {
  const [isSoet, setIsSoet] = useState(false);
  const [batches, setBatches] = useState([]);
  const [branches, setBranches] = useState([]);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);

  const [batch, setBatch] = useState("");
  const [branch, setBranch] = useState("All");
  const [section, setSection] = useState("All");
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [note, setNote] = useState("");

  const sectionChosen = section !== "All";
  const branchChosen = branch !== "All";

  // School comes from the URL / localStorage, which is only readable client-side
  useEffect(() => {
    const school = String(getSchoolAndCampus().school || "soet").toLowerCase();
    setIsSoet(school === "soet" || school === "soe");
  }, []);

  // Batches and branches
  useEffect(() => {
    if (!isSoet) return;
    (async () => {
      try {
        const [bRes, dRes] = await Promise.all([
          fetch(appendSchoolParams("/api/metadata/batches")),
          fetch(appendSchoolParams("/api/metadata/departments")),
        ]);
        const b = await bRes.json().catch(() => ({}));
        const d = await dRes.json().catch(() => ({}));
        setBatches(Array.isArray(b.batches) ? b.batches : []);
        setBranches(Array.isArray(d.departments) ? d.departments : []);
      } catch {
        setNote("Could not load batches and branches.");
      }
    })();
  }, [isSoet]);

  // Section names - only those holding the chosen branch's students
  useEffect(() => {
    setSections([]);
    if (!isSoet || !batch) return;
    let cancelled = false;
    (async () => {
      try {
        const base = getSchoolApiUrl("sections/definitions");
        const qs = new URLSearchParams({ batch, ...(branchChosen ? { branch } : {}) }).toString();
        const res = await fetch(`${base}${base.includes("?") ? "&" : "?"}${qs}`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && Array.isArray(data.sections)) setSections(data.sections);
      } catch {
        // No sections yet is a normal state
      }
    })();
    return () => { cancelled = true; };
  }, [isSoet, batch, branch, branchChosen]);

  // Students. Needs a batch plus a branch or a section, so the list stays usable
  // rather than dumping an entire batch into one dropdown.
  useEffect(() => {
    setStudents([]);
    setNote("");
    if (!isSoet || !batch || (!branchChosen && !sectionChosen)) return;
    let cancelled = false;
    (async () => {
      setLoadingStudents(true);
      try {
        const base = getSchoolApiUrl("batch");
        const url = `${base}${base.includes("?") ? "&" : "?"}mode=list`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            batch,
            ...(branchChosen ? { branch } : {}),
            ...(sectionChosen ? { section } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Could not load students");
        const seen = new Set();
        const list = [];
        for (const r of data.records || []) {
          const reg = String(r.Reg_No || "").toUpperCase();
          if (!reg || seen.has(reg)) continue;
          seen.add(reg);
          list.push({ reg, name: r.Name || "" });
        }
        list.sort((a, b) => a.reg.slice(-4).localeCompare(b.reg.slice(-4), undefined, { numeric: true }));
        setStudents(list);
        if (list.length === 0) setNote("No students found for this selection.");
      } catch (e) {
        if (!cancelled) setNote(e.message);
      } finally {
        if (!cancelled) setLoadingStudents(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isSoet, batch, branch, section, branchChosen, sectionChosen]);

  if (!isSoet) return null;

  const selectClass =
    "rounded-xl border-2 bg-white px-3 py-2.5 text-[#1A1F29] font-medium text-sm outline-none focus:ring-4 focus:ring-[#05A3C7]/20 min-h-[44px] disabled:bg-gray-100 disabled:text-gray-400";
  const border = { borderColor: "rgba(5,163,199,0.3)" };

  return (
    <div className="mb-3 rounded-xl border border-dashed p-3" style={{ borderColor: "rgba(5,163,199,0.35)" }}>
      <div className="mb-2 text-xs font-semibold text-[#04748F]">
        Find a student by section — or type a registration number below
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <select className={selectClass} style={border} value={batch}
          onChange={e => { setBatch(e.target.value); setSection("All"); }}>
          <option value="">Batch</option>
          {batches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <select className={selectClass} style={border} value={branch} disabled={!batch}
          onChange={e => { setBranch(e.target.value); setSection("All"); }}>
          <option value="All">All Branches</option>
          {branches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <select className={selectClass} style={border} value={section}
          disabled={!batch || sections.length === 0}
          onChange={e => setSection(e.target.value)}>
          <option value="All">
            {!batch ? "Section" : sections.length === 0 ? "No sections" : "All Sections"}
          </option>
          {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
          <option value={UNASSIGNED}>Unassigned</option>
        </select>

        <select className={selectClass} style={border} value=""
          disabled={students.length === 0}
          onChange={e => { if (e.target.value) onPick(e.target.value); }}>
          <option value="">
            {loadingStudents
              ? "Loading students…"
              : !batch
                ? "Choose a batch"
                : !branchChosen && !sectionChosen
                  ? "Choose a branch or section"
                  : `Student (${students.length})`}
          </option>
          {students.map(s => <option key={s.reg} value={s.reg}>{s.reg}{s.name ? ` - ${s.name}` : ""}</option>)}
        </select>
      </div>
      {note && <div className="mt-2 text-xs text-amber-700">{note}</div>}
    </div>
  );
}
