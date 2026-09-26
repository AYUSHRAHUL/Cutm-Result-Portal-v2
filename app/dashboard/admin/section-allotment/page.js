"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { appendSchoolParams } from "@/lib/api-helper";

/**
 * Section Allotment (SOET, admin only).
 *
 * Sections belong to a batch and may combine branches - e.g. 2024 Section A =
 * Mechanical + Civil, B = part of ECE, C = the rest of ECE + EEE - so the list can
 * be viewed per branch or for the whole batch. Students are allotted by ticking
 * several and applying one section to all of them.
 */

const SHOW_ALL = "all";
const SHOW_UNASSIGNED = "unassigned";
const SHOW_CHANGED = "changed";
const SHOW_STALE = "stale";
const SHOW_INACTIVE = "inactive";
const SECTION_PREFIX = "sec:";

async function readJson(res) {
  return res.json().catch(() => ({}));
}

function SectionAllotmentContent() {
  const searchParams = useSearchParams();
  const campus = searchParams.get("campus");

  const [batches, setBatches] = useState([]);
  const [branches, setBranches] = useState([]);
  const [batch, setBatch] = useState("");
  const [branch, setBranch] = useState("All");

  const [data, setData] = useState(null); // response from /sections/students
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [showOnly, setShowOnly] = useState(SHOW_ALL);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [targetSection, setTargetSection] = useState("");
  const [newSection, setNewSection] = useState("");

  // Batch and branch pickers
  useEffect(() => {
    (async () => {
      try {
        const [bRes, dRes] = await Promise.all([
          fetch(appendSchoolParams("/api/metadata/batches")),
          fetch(appendSchoolParams("/api/metadata/departments")),
        ]);
        const bData = await readJson(bRes);
        const dData = await readJson(dRes);
        setBatches(Array.isArray(bData.batches) ? bData.batches : []);
        setBranches(Array.isArray(dData.departments) ? dData.departments : []);
      } catch (e) {
        setErr(`Could not load batches and branches: ${e.message}`);
      }
    })();
  }, []);

  const loadStudents = useCallback(async () => {
    if (!batch) return;
    setLoading(true);
    setErr("");
    try {
      const qs = new URLSearchParams({ batch, branch }).toString();
      const res = await fetch(appendSchoolParams(`/api/soet/sections/students?${qs}`));
      const json = await readJson(res);
      if (!res.ok) throw new Error(json.error || `Failed to load students (${res.status})`);
      setData(json);
      setSelected(new Set());
    } catch (e) {
      setErr(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [batch, branch]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const sections = useMemo(() => data?.sections || [], [data]);
  const students = useMemo(() => data?.students || [], [data]);

  const visible = useMemo(() => {
    const q = search.trim().toUpperCase();
    return students.filter(s => {
      if (q && !s.reg.includes(q) && !String(s.name || "").toUpperCase().includes(q)) return false;
      if (showOnly === SHOW_ALL) return true;
      if (showOnly === SHOW_UNASSIGNED) return !s.section && !s.inactive;
      if (showOnly === SHOW_CHANGED) return s.overridden;
      if (showOnly === SHOW_STALE) return s.stale;
      if (showOnly === SHOW_INACTIVE) return s.inactive;
      if (showOnly.startsWith(SECTION_PREFIX)) return s.section === showOnly.slice(SECTION_PREFIX.length);
      return true;
    });
  }, [students, search, showOnly]);

  const allVisibleSelected = visible.length > 0 && visible.every(s => selected.has(s.reg));

  function toggle(reg) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(reg)) next.delete(reg);
      else next.add(reg);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach(s => next.delete(s.reg));
      else visible.forEach(s => next.add(s.reg));
      return next;
    });
  }

  function selectAllUnassigned() {
    setSelected(new Set(students.filter(s => !s.section && !s.inactive).map(s => s.reg)));
  }

  async function apply() {
    setErr(""); setMsg("");
    if (selected.size === 0) { setErr("Tick at least one student first."); return; }
    if (!targetSection) { setErr("Choose a section to apply."); return; }

    const unassign = targetSection === "__remove__";
    setWorking(true);
    try {
      const res = await fetch(appendSchoolParams("/api/soet/sections/assign"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch,
          regs: Array.from(selected),
          section: unassign ? null : targetSection,
        }),
      });
      const json = await readJson(res);
      if (!res.ok) throw new Error(json.error || `Assign failed (${res.status})`);
      setMsg(
        (unassign
          ? `Removed ${json.updated} student(s) from their section.`
          : `Put ${json.updated} student(s) in Section ${json.section}.`) +
        (json.warning ? ` ${json.warning}` : "")
      );
      await loadStudents();
    } catch (e) {
      setErr(e.message);
    } finally {
      setWorking(false);
    }
  }

  async function sectionAction(body) {
    setErr(""); setMsg("");
    setWorking(true);
    try {
      const res = await fetch(appendSchoolParams("/api/soet/sections/definitions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch, ...body }),
      });
      const json = await readJson(res);
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      return json;
    } catch (e) {
      setErr(e.message);
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function addSection(e) {
    e.preventDefault();
    if (!newSection.trim()) return;
    const json = await sectionAction({ action: "add", name: newSection });
    if (json) {
      setMsg(`Section ${newSection.trim().toUpperCase()} added to ${batch}.`);
      setNewSection("");
      await loadStudents();
    }
  }

  async function renameSection(from) {
    const to = window.prompt(`Rename Section ${from} to:`, from);
    if (!to || to.trim().toUpperCase() === from) return;
    const json = await sectionAction({ action: "rename", from, to });
    if (json) {
      setMsg(`Section ${from} renamed to ${to.trim().toUpperCase()}; ${json.studentsMoved ?? 0} student(s) moved with it.`);
      await loadStudents();
    }
  }

  async function removeSection(name) {
    if (!window.confirm(`Remove Section ${name} from ${batch}?`)) return;
    const json = await sectionAction({ action: "remove", name });
    if (json) {
      setMsg(`Section ${name} removed.`);
      await loadStudents();
    }
  }

  const showBranchColumn = branch === "All";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#0a4b78]">Section Allotment</h1>
            <p className="text-sm text-gray-500">
              SOET{campus ? ` · ${campus.toUpperCase()}` : ""} · sections belong to a batch and may combine branches
            </p>
          </div>
          <Link href="/dashboard/admin" className="text-sm text-blue-600 hover:underline">← Back</Link>
        </div>

        {err && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        {msg && <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{msg}</div>}

        {/* Batch / branch */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Batch</label>
            <select value={batch} onChange={e => setBatch(e.target.value)} className="w-full rounded-md border px-3 py-2">
              <option value="">Select batch…</option>
              {batches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Branch</label>
            <select value={branch} onChange={e => setBranch(e.target.value)} className="w-full rounded-md border px-3 py-2">
              <option value="All">All branches</option>
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={loadStudents} disabled={!batch || loading} className="rounded-md bg-blue-600 text-white px-4 py-2 disabled:opacity-50">
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {!batch && (
          <div className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
            Choose a batch to start. Section names are set per batch; the branch picker only narrows the list.
          </div>
        )}

        {batch && data && (
          <>
            {/* Manage sections */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#0a4b78]">Sections in {batch}</h2>
                <span className="text-xs text-gray-500">"here" = in this view · "batch" = across every branch</span>
              </div>

              {sections.length === 0 ? (
                <p className="text-sm text-gray-500">No sections defined for {batch} yet. Add the first one below.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {sections.map(s => (
                    <div key={s} className="flex items-center gap-2 rounded-full border border-[#0a4b78]/20 bg-[#0a4b78]/5 pl-3 pr-1 py-1 text-sm">
                      <span className="font-semibold text-[#0a4b78]">{s}</span>
                      <span className="text-gray-600">{data.counts?.[s] ?? 0} here · {data.sectionTotals?.[s] ?? 0} batch</span>
                      <button onClick={() => renameSection(s)} disabled={working} className="rounded px-1.5 text-xs text-blue-600 hover:bg-blue-50" title="Rename">✎</button>
                      <button onClick={() => removeSection(s)} disabled={working} className="rounded px-1.5 text-xs text-red-600 hover:bg-red-50" title="Remove">✕</button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={addSection} className="flex gap-2">
                <input
                  value={newSection}
                  onChange={e => setNewSection(e.target.value)}
                  placeholder="New section name, e.g. A"
                  maxLength={12}
                  className="flex-1 rounded-md border px-3 py-2 text-sm"
                />
                <button disabled={working || !newSection.trim()} className="rounded-md bg-[#0a4b78] text-white px-4 py-2 text-sm disabled:opacity-50">
                  Add section
                </button>
              </form>
            </div>

            {/* Summary */}
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-md bg-gray-100 px-3 py-1">Students: <b>{data.total}</b></span>
              <span className={`rounded-md px-3 py-1 ${data.unassigned > 0 ? "bg-amber-100 text-amber-800" : "bg-gray-100"}`}>
                Unassigned: <b>{data.unassigned}</b>
              </span>
              {data.branchChanged > 0 && (
                <span className="rounded-md bg-purple-100 text-purple-800 px-3 py-1">Branch changed: <b>{data.branchChanged}</b></span>
              )}
              {data.stale > 0 && (
                <span className="rounded-md bg-red-100 text-red-800 px-3 py-1">Needs reassignment: <b>{data.stale}</b></span>
              )}
              {data.inactive > 0 && (
                <span className="rounded-md bg-gray-200 text-gray-600 px-3 py-1">Inactive: <b>{data.inactive}</b></span>
              )}
            </div>

            {/* Filters and bulk assign */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="flex flex-wrap gap-2 items-center">
                <select value={showOnly} onChange={e => setShowOnly(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
                  <option value={SHOW_ALL}>Show: everyone</option>
                  <option value={SHOW_UNASSIGNED}>Show only: unassigned</option>
                  <option value={SHOW_CHANGED}>Show only: branch changed</option>
                  <option value={SHOW_STALE}>Show only: needs reassignment</option>
                  <option value={SHOW_INACTIVE}>Show only: inactive</option>
                  {sections.map(s => <option key={s} value={`${SECTION_PREFIX}${s}`}>Show only: Section {s}</option>)}
                </select>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search reg no or name"
                  className="flex-1 min-w-[10rem] rounded-md border px-3 py-2 text-sm"
                />
              </div>

              <div className="flex flex-wrap gap-2 items-center lg:justify-end">
                <button onClick={selectAllUnassigned} disabled={working} className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
                  Select all unassigned
                </button>
                <span className="text-sm text-gray-600">{selected.size} selected →</span>
                <select value={targetSection} onChange={e => setTargetSection(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
                  <option value="">Choose section…</option>
                  {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
                  <option value="__remove__">Remove from section</option>
                </select>
                <button
                  onClick={apply}
                  disabled={working || selected.size === 0 || !targetSection}
                  className="rounded-md bg-green-600 text-white px-4 py-2 text-sm disabled:opacity-50"
                >
                  {working ? "Saving…" : "Apply"}
                </button>
              </div>
            </div>

            {sections.length === 0 && (
              <p className="text-sm text-amber-700">Add at least one section above before assigning students.</p>
            )}

            {/* Student list */}
            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="px-3 py-2 w-10">
                      <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Select all shown" />
                    </th>
                    <th className="px-3 py-2 text-left">Reg No</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    {showBranchColumn && <th className="px-3 py-2 text-left">Branch</th>}
                    <th className="px-3 py-2 text-left">Section</th>
                    <th className="px-3 py-2 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={showBranchColumn ? 6 : 5} className="px-3 py-4 text-center text-gray-500">
                        {loading ? "Loading…" : students.length === 0 ? "No students found for this batch and branch." : "No students match this filter."}
                      </td>
                    </tr>
                  ) : (
                    visible.map(s => (
                      <tr
                        key={s.reg}
                        className={`border-t ${s.inactive ? "bg-gray-50 text-gray-400" : ""} ${selected.has(s.reg) ? "bg-blue-50" : ""}`}
                      >
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={selected.has(s.reg)} onChange={() => toggle(s.reg)} aria-label={`Select ${s.reg}`} />
                        </td>
                        <td className="px-3 py-2 font-mono">{s.reg}</td>
                        <td className="px-3 py-2">{s.name || "—"}</td>
                        {showBranchColumn && <td className="px-3 py-2">{s.branch || <span className="text-amber-700">Unknown</span>}</td>}
                        <td className="px-3 py-2">
                          {s.section
                            ? <span className="rounded-full bg-[#0a4b78] text-white px-2.5 py-0.5 text-xs font-semibold">{s.section}</span>
                            : <span className="text-amber-700 text-xs">Unassigned</span>}
                        </td>
                        <td className="px-3 py-2 space-x-1">
                          {s.inactive && <span className="rounded bg-gray-200 text-gray-600 px-2 py-0.5 text-xs">Inactive</span>}
                          {s.overridden && (
                            <span className="rounded bg-purple-100 text-purple-800 px-2 py-0.5 text-xs">
                              Branch changed: {s.originalBranch || "unrecognised"} → {s.branch}
                            </span>
                          )}
                          {s.stale && (
                            <span className="rounded bg-red-100 text-red-800 px-2 py-0.5 text-xs">
                              Was Section {s.previousSection} in another batch
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500">
              Showing {visible.length} of {students.length}. Apply saves straight away for every ticked student.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function SectionAllotmentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Loading…</div>}>
      <SectionAllotmentContent />
    </Suspense>
  );
}
