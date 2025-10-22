"use client";

import { useEffect, useRef, useState } from "react";

export default function AdminBacklogPage() {
  const [registration, setRegistration] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [branch, setBranch] = useState("");
  const [year, setYear] = useState("");
  const [regList, setRegList] = useState([]);
  const [regMode, setRegMode] = useState("manual"); // manual | list
  const [selectedReg, setSelectedReg] = useState("");
  const [subjectMode, setSubjectMode] = useState("manual"); // manual | list
  const [subjectList, setSubjectList] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const formRef = useRef(null);

  async function search(e) {
    e?.preventDefault();
    setMessage(""); setError(""); setRows([]); setCount(0);
    try {
      setLoading(true);
      const regValue = regMode === "list" ? selectedReg : registration;
      const subjValue = subjectMode === "list" ? selectedSubject : subjectCode;
      const body = regValue
        ? { registration: regValue }
        : { subject_code: (subjValue || "").toUpperCase(), branch, year };
      const res = await fetch("/api/backlogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No backlog found");
      setRows(data.backlogs || data.result || []);
      setCount((data.backlogs || data.result || []).length);
      setMessage(data.message || "Results loaded");
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  // Clear action removed for admin backlog view as requested

  useEffect(() => {
    formRef.current?.querySelector('input[name="registration"]').focus();
  }, []);

  // Load registration list when branch/year change
  useEffect(() => {
    (async () => {
      try {
        if (regMode !== "list") { 
          setRegList([]); 
          setSelectedReg("");
          return; 
        }
        if (!branch && !year) { 
          setRegList([]); 
          setSelectedReg("");
          return; 
        }
        
        // Always try to load all students first, then filter client-side
        // This ensures we get all data and can filter properly
        const res = await fetch("/api/students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ department: "All", batch: "All" })
        });
        const data = await res.json();
        
        if (res.ok) {
          let students = data.students || data.records || data.result || [];
          
          // Apply branch filtering using 8th character logic
          if (branch && branch !== "") {
            const branchCodeMap = {
              "Civil": "1",
              "CSE": "2", 
              "ECE": "3",
              "EEE": "5",
              "Mechanical": "6"
            };
            
            const expectedBranchCode = branchCodeMap[branch];
            students = students.filter(student => {
              const regNo = student.Reg_No || student.registration;
              if (!regNo || regNo.length < 8) return false;
              
              const regBranchCode = regNo.charAt(7);
              return regBranchCode === expectedBranchCode;
            });
          }
          
          // Apply batch filtering using first 2 digits
          if (year && year !== "") {
            const yearPattern = year.slice(-2);
            students = students.filter(student => {
              const regNo = student.Reg_No || student.registration;
              if (!regNo || regNo.length < 2) return false;
              
              const regYear = regNo.slice(0, 2);
              return regYear === yearPattern;
            });
          }
          
          const list = students
            .map(r => r.Reg_No || r.registration)
            .filter(Boolean)
            .sort(); // Sort for better UX
          
          setRegList(Array.from(new Set(list)));
          setSelectedReg(""); // Reset selection when list changes
        } else {
          setRegList([]);
          setSelectedReg("");
        }
      } catch (err) {
        setRegList([]);
        setSelectedReg("");
      }
    })();
  }, [branch, year, regMode]);

  // Auto-search when registration is selected
  useEffect(() => {
    if (regMode === "list" && selectedReg) {
      search();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReg, regMode]);

  // Load subjects when in list mode
  useEffect(() => {
    (async () => {
      try {
        if (subjectMode !== "list") { setSubjectList([]); return; }
        const params = new URLSearchParams();
        if (branch) params.set("branch", branch);
        params.set("limit", "0");
        const res = await fetch(`/api/cbcs?${params.toString()}`);
        const data = await res.json();
        if (res.ok) {
          const items = data.items || [];
          const list = items.map(it => ({ code: it["Subject Code"] || it.SubjectCode, name: it.Subject_name || it.Subject_Name || "" })).filter(s => s.code);
          const uniq = Array.from(new Map(list.map(s => [s.code, s])).values());
          setSubjectList(uniq);
        } else {
          setSubjectList([]);
        }
      } catch {
        setSubjectList([]);
      }
    })();
  }, [subjectMode, branch]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_25%_25%,rgba(99,102,241,.15),transparent_50%),radial-gradient(circle_at_75%_25%,rgba(168,85,247,.15),transparent_50%)] pb-10">
      <div className="max-w-7xl mx-auto px-6 pt-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center shadow">🕓</span>
            Backlog Management
          </h1>
          <a href="/dashboard/admin" className="px-3 py-2 rounded-full border border-white/15 text-white/90 hover:bg-white/10">Admin Panel</a>
        </div>

        {/* Search Forms */}
        <form ref={formRef} onSubmit={search} className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur-xl p-5">
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2">🔎 Search by Registration</h2>
            <div className="mb-3">
              <select className="rounded-xl border border-white/15 bg-white/90 px-3 py-2 text-gray-900" value={regMode} onChange={e => setRegMode(e.target.value)}>
                <option value="manual">Enter Manually</option>
                <option value="list">Choose from List</option>
              </select>
            </div>
            {regMode === "manual" ? (
              <div className="flex gap-3">
                <input name="registration" className="flex-1 rounded-xl border border-white/15 bg-white/90 px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-400 text-gray-900" placeholder="e.g., 220101130056" value={registration} onChange={e => setRegistration(e.target.value.toUpperCase())} />
                <button className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold px-4">Search</button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <select className="rounded-xl border border-white/15 bg-white/90 px-3 py-2 text-gray-900" value={year} onChange={e => setYear(e.target.value)}>
                    <option value="">Select Batch (Year)</option>
                    {["2020","2021","2022","2023","2024","2025"].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select className="rounded-xl border border-white/15 bg-white/90 px-3 py-2 text-gray-900" value={branch} onChange={e => setBranch(e.target.value)}>
                    <option value="">Select Branch</option>
                    <option value="Civil">Civil</option>
                    <option value="CSE">CSE</option>
                    <option value="ECE">ECE</option>
                    <option value="EEE">EEE</option>
                    <option value="Mechanical">Mechanical</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <select className="flex-1 rounded-xl border border-white/15 bg-white/90 px-3 py-2 text-gray-900" value={selectedReg} onChange={e => setSelectedReg(e.target.value)}>
                    <option value="">
                      {regList.length === 0 
                        ? (branch && year ? "No students found for selected criteria" : "Select batch and branch first")
                        : `Select Registration (${regList.length} students)`
                      }
                    </option>
                    {regList.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold px-4" disabled={!selectedReg}>
                    {selectedReg ? "Search" : "Select First"}
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur-xl p-5">
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2">🎯 Search by Subject + Filters</h2>
            <div className="mb-3">
              <select className="rounded-xl border border-white/15 bg-white/90 px-3 py-2 text-gray-900" value={subjectMode} onChange={e => setSubjectMode(e.target.value)}>
                <option value="manual">Enter Subject Manually</option>
                <option value="list">Choose Subject from List</option>
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {subjectMode === "manual" ? (
                <input className="md:col-span-2 rounded-xl border border-white/15 bg-white/90 px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-400 text-gray-900" placeholder="Subject code (e.g., CS101)" value={subjectCode} onChange={e => setSubjectCode(e.target.value.toUpperCase())} />
              ) : (
                <select className="md:col-span-2 rounded-xl border border-white/15 bg-white/90 px-3 py-2 text-gray-900" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
                  <option value="">Select Subject from CBCS</option>
                  {subjectList.map(s => (
                    <option key={s.code} value={s.code}>{`${s.code}${s.name ? ` — ${s.name}` : ''}`}</option>
                  ))}
                </select>
              )}
              <select className="rounded-xl border border-white/15 bg-white/90 px-3 py-2 text-gray-900" value={branch} onChange={e => setBranch(e.target.value)}>
                <option value="">All Branches</option>
                <option value="Civil">Civil</option>
                <option value="CSE">CSE</option>
                <option value="ECE">ECE</option>
                <option value="EEE">EEE</option>
                <option value="Mechanical">Mechanical</option>
              </select>
              <select className="rounded-xl border border-white/15 bg-white/90 px-3 py-2 text-gray-900" value={year} onChange={e => setYear(e.target.value)}>
                <option value="">All Batches</option>
                {["2020","2021","2022","2023","2024","2025"].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="mt-3 text-right">
              <button onClick={search} className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold px-4">Search with Filters</button>
            </div>
          </div>
        </form>

        {/* Alerts */}
        {message && <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 px-4 py-3">✅ {message}</div>}
        {error && <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 px-4 py-3">⚠️ {error}</div>}

        {/* Results */}
        <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur-xl overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-3 text-sm font-bold flex items-center justify-between">
            <span>Backlog Results</span>
            <span>{count} record{count === 1 ? "" : "s"}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                  {["Reg","Name","Subject","Code","Sem","Grade"].map(h => <th key={h} className="px-3 py-2 text-left uppercase tracking-wider">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-white/80">No backlog results</td></tr>
                )}
                {rows.map((b, i) => (
                  <tr key={i} className="border-t border-white/10 hover:bg-white/10">
                    <td className="px-3 py-2 text-white/90">{b.Reg_No || b.registration || '-'}</td>
                    <td className="px-3 py-2 text-white/90">{b.Name || '-'}</td>
                    <td className="px-3 py-2 text-white/90">{b.Subject_Name || '-'}</td>
                    <td className="px-3 py-2"><code className="text-indigo-200 bg-indigo-900/30 px-1.5 py-0.5 rounded">{b.Subject_Code || b.subject_code}</code></td>
                    <td className="px-3 py-2"><span className="px-2 py-1 rounded-full text-xs bg-cyan-500/20 text-cyan-200">{b.Sem || '-'}</span></td>
                    <td className="px-3 py-2"><span className="px-2 py-1 rounded-full text-xs bg-amber-500/20 text-amber-200">{b.Grade || '-'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {loading && <div className="mt-4 text-white/80">Loading...</div>}
      </div>
    </div>
  );
}


