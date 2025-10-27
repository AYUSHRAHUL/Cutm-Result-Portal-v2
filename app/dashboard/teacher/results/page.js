"use client";

import { useEffect, useRef, useState } from "react";

export default function TeacherResultsPage() {
  const [registration, setRegistration] = useState("");
  const [semesters, setSemesters] = useState([]);
  const [semester, setSemester] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [sgpa, setSgpa] = useState(null);
  const [cgpa, setCgpa] = useState(null);
  const [allResults, setAllResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef(null);

  // Helpers copied from Admin for parity
  function parseCredits(val) {
    if (val === null || val === undefined) return 0;
    const s = String(val).trim();
    if (s === "") return 0;
    if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
    return s.split(/[+\s]+/).map(p => parseFloat(p) || 0).reduce((a,b)=>a+b,0);
  }
  
  function gradeToPoints(grade) {
    const g = String(grade || "").toUpperCase().trim();
    const map = { "O":10, "A+":9, "A":8, "B+":7, "B":6, "C":5, "P":4, "D":4, "F":0, "E":0, "NA":0 };
    return map[g] ?? 0;
  }
  
  function computeSgpa(list) {
    const t = (list||[]).reduce((acc,s)=>{ const c=parseCredits(s.Credits); const p=gradeToPoints(s.Grade); acc.c+=c; acc.p+=c*p; return acc; }, {c:0,p:0});
    return t.c>0 ? Number((t.p/t.c).toFixed(2)) : null;
  }
  
  function displayCredits(val) { const n=parseCredits(val); return Number.isFinite(n)?String(n):String(val??""); }
  
  function isRedGrade(grade) { const g=String(grade||"").toUpperCase().trim(); return g==="F" || g==="S"; }

  function escapeCsv(val) { const s=String(val ?? ""); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }

  function exportCSV() {
    let rows = [];
    let header = [];
    if (allResults.length > 0) {
      header = ["Semester","Code","Subject","Credits","Grade"];
      allResults.forEach(r => {
        (r.subjects||[]).forEach(s => {
          rows.push([
            escapeCsv(String(r.semester)),
            escapeCsv(s.Subject_Code ?? ""),
            escapeCsv(s.Subject_Name ?? ""),
            escapeCsv(displayCredits(s.Credits)),
            escapeCsv(s.Grade ?? ""),
          ].join(","));
        });
      });
    } else {
      if (subjects.length === 0) return;
      header = ["Code","Subject","Credits","Grade"];
      rows = subjects.map(r => [
        escapeCsv(r.Subject_Code ?? ""),
        escapeCsv(r.Subject_Name ?? ""),
        escapeCsv(displayCredits(r.Credits)),
        escapeCsv(r.Grade ?? ""),
      ].join(","));
    }
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teacher_result_${registration}_${semester || 'ALL'}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function loadSemesters(reg) {
    setError(""); setSemesters([]); setSemester(""); setAllResults([]); setSubjects([]); setSgpa(null); setCgpa(null);
    try {
      const res = await fetch("/api/semesters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registration: reg }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No semesters found");
      setSemesters(data.semesters || []);
    } catch (err) { setError(err.message); }
  }

  async function loadResult(e) {
    e.preventDefault();
    setError(""); setSubjects([]); setSgpa(null); setCgpa(null); setAllResults([]);
    if (!registration || !semester) { setError("Enter registration and choose a semester"); return; }
    try {
      setLoading(true);
      if (semester === "ALL") {
        const fetched = [];
        for (const sem of semesters) {
          const r = await fetch("/api/result", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registration, semester: sem }) });
          const d = await r.json();
          if (r.ok && d?.subjects?.length) {
            const termCr = (d.subjects||[]).reduce((acc,s)=>acc+parseCredits(s.Credits),0);
            const termSg = d.sgpa ?? computeSgpa(d.subjects);
            fetched.push({ semester: sem, subjects: d.subjects, sgpa: termSg, termCredits: termCr });
          }
        }
        if (fetched.length === 0) throw new Error("No results found for any semester");
        const semNum = (s)=>{ const m=String(s).match(/\d+/); return m?Number(m[0]):Number(s); };
        fetched.sort((a,b)=>(semNum(a.semester)||0)-(semNum(b.semester)||0));
        let cumC=0, cumP=0;
        const results = fetched.map(row=>{ cumC+=row.termCredits; cumP+=row.termCredits*(row.sgpa||0); const cg=cumC>0?Number((cumP/cumC).toFixed(2)):row.sgpa; return { semester: row.semester, subjects: row.subjects, sgpa: row.sgpa, cgpa: cg }; });
        setAllResults(results);
      } else {
        const res = await fetch("/api/result", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registration, semester }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No result found");
        const list = data.subjects || [];
        setSubjects(list);
        const currentSg = data.sgpa ?? computeSgpa(list);
        setSgpa(currentSg);
        const target = (()=>{ const m=String(semester).match(/\d+/); return m?Number(m[0]):Number(semester); })();
        let cumC=0, cumP=0;
        for (const sem of semesters) {
          const n = (()=>{ const m=String(sem).match(/\d+/); return m?Number(m[0]):Number(sem); })();
          if (!Number.isFinite(n) || !Number.isFinite(target) || n>target) continue;
          const rr = await fetch("/api/result", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registration, semester: sem }) });
          const dd = await rr.json();
          if (rr.ok && dd?.subjects?.length) {
            const termCr = (dd.subjects||[]).reduce((acc,s)=>acc+parseCredits(s.Credits),0);
            const termSg = dd.sgpa ?? computeSgpa(dd.subjects);
            cumC += termCr; cumP += termCr * termSg;
          }
        }
        setCgpa(cumC>0 ? Number((cumP/cumC).toFixed(2)) : currentSg);
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const el = formRef.current?.querySelector('input[name="registration"]');
    el?.focus();
  }, []);

  return (
    <div 
      className="min-h-screen pb-10"
      style={{
        background: "linear-gradient(to bottom, #F5F8FA 0%, #E8F4F8 50%, #D1E9F6 100%)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
      {/* Header */}
<div className="mb-6 sm:mb-8 text-center">
  <h1 
    className="text-2xl sm:text-3xl md:text-4xl font-black mb-2"
    style={{
      background: "linear-gradient(135deg, #05A3C7 0%, #04748F 50%, #023945 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
    }}
  >
    Student Result Viewer
  </h1>
  <p className="text-sm sm:text-base text-[#5A6C7D] font-medium">
    View and export student academic results
  </p>
</div>


        {/* Search Form */}
        <form 
          ref={formRef} 
          onSubmit={loadResult} 
          className="rounded-2xl border-2 bg-white p-4 sm:p-6 mb-6 shadow-lg"
          style={{ borderColor: "rgba(5,163,199,0.2)" }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <input 
              name="registration" 
              className="rounded-xl border-2 bg-white px-4 py-3 outline-none focus:ring-4 focus:ring-[#05A3C7]/20 text-[#1A1F29] font-medium transition-all touch-manipulation"
              style={{ 
                borderColor: "rgba(5,163,199,0.3)",
                minHeight: "48px"
              }}
              placeholder="Registration (e.g., 220101130056)" 
              value={registration} 
              onChange={e => { 
                const v = e.target.value.toUpperCase(); 
                setRegistration(v); 
                if (v.length >= 6) loadSemesters(v); 
              }} 
            />
            
            <select 
              className="rounded-xl border-2 bg-white px-4 py-3 text-[#1A1F29] font-medium focus:ring-4 focus:ring-[#05A3C7]/20 outline-none transition-all touch-manipulation" 
              style={{ 
                borderColor: "rgba(5,163,199,0.3)",
                minHeight: "48px"
              }}
              value={semester} 
              onChange={e => setSemester(e.target.value)}
            >
              <option value="">Select Semester</option>
              <option value="ALL" disabled={semesters.length===0}>ALL</option>
              {semesters.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            
            <button 
              className="rounded-xl text-white font-black px-5 py-3 transition-all duration-300 hover:shadow-lg hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed touch-manipulation flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                minHeight: "48px"
              }}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Loading...
                </span>
              ) : "View Result"}
            </button>
            
            <button 
              type="button" 
              onClick={exportCSV} 
              className="rounded-xl border-2 text-[#05A3C7] font-black px-4 py-3 hover:bg-[#05A3C7]/5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation" 
              style={{ 
                borderColor: "rgba(5,163,199,0.3)",
                minHeight: "48px"
              }}
              disabled={subjects.length===0 && allResults.length===0}
            >
              📥 Export CSV
            </button>
          </div>
        </form>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 px-4 py-3 font-medium flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Single Semester Results */}
        {subjects.length > 0 && (
          <div className="rounded-2xl overflow-hidden border-2 bg-white shadow-lg mb-6" style={{ borderColor: "rgba(5,163,199,0.2)" }}>
            <div 
              className="text-white px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              style={{
                background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
              }}
            >
              <span className="font-black text-base sm:text-lg">
                Results — {registration} — {semester}
              </span>
              <div className="flex flex-wrap gap-3 sm:gap-4 text-sm sm:text-base">
                <span className="px-3 py-1.5 rounded-lg bg-white/20 backdrop-blur-sm font-bold">
                  SGPA: <strong>{sgpa}</strong>
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-white/20 backdrop-blur-sm font-bold">
                  CGPA: <strong>{cgpa}</strong>
                </span>
              </div>
            </div>
            
            {/* Mobile Card View */}
            <div className="block sm:hidden">
              {subjects.map((r,i) => (
                <div key={i} className="border-b-2 border-[#05A3C7]/10 p-4 hover:bg-[#05A3C7]/5 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <code className="text-[#05A3C7] bg-[#05A3C7]/10 px-2 py-1 rounded font-bold text-sm">
                      {r.Subject_Code}
                    </code>
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${isRedGrade(r.Grade) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {r.Grade}
                    </span>
                  </div>
                  <div className="text-[#1A1F29] font-bold mb-1 text-sm">{r.Subject_Name}</div>
                  <div className="text-[#5A6C7D] text-xs font-medium">
                    Credits: <span className="px-2 py-0.5 rounded-full bg-[#05A3C7]/10 text-[#05A3C7] font-bold">{displayCredits(r.Credits)}</span>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr 
                    className="text-white"
                    style={{
                      background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                    }}
                  >
                    {['Code','Subject','Credits','Grade'].map(h => (
                      <th key={h} className="px-4 py-3 text-left uppercase tracking-wider font-black text-xs">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((r,i) => (
                    <tr key={i} className="border-t-2 border-[#05A3C7]/10 hover:bg-[#05A3C7]/5 transition-colors">
                      <td className="px-4 py-3">
                        <code className="text-[#05A3C7] bg-[#05A3C7]/10 px-2 py-1 rounded font-bold">
                          {r.Subject_Code}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-[#1A1F29] font-medium">{r.Subject_Name}</td>
                      <td className="px-4 py-3">
                        <span className="px-3 py-1 rounded-full text-xs bg-[#05A3C7]/10 text-[#05A3C7] font-bold">
                          {displayCredits(r.Credits)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${isRedGrade(r.Grade) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {r.Grade}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* All Semesters Results */}
        {allResults.length>0 && (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 sm:gap-6">
            {/* Sidebar */}
            <aside className="rounded-2xl border-2 bg-white p-4 max-h-[70vh] overflow-auto shadow-lg" style={{ borderColor: "rgba(5,163,199,0.2)" }}>
              <h3 className="text-[#1A1F29] font-black mb-4 text-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#05A3C7]">
                  <path d="M11.25 4.533A9.707 9.707 0 006 3a9.735 9.735 0 00-3.25.555.75.75 0 00-.5.707v14.25a.75.75 0 001 .707A8.237 8.237 0 016 18.75c1.995 0 3.823.707 5.25 1.886V4.533zM12.75 20.636A8.214 8.214 0 0118 18.75c.966 0 1.89.166 2.75.47a.75.75 0 001-.708V4.262a.75.75 0 00-.5-.707A9.735 9.735 0 0018 3a9.707 9.707 0 00-5.25 1.533v16.103z" />
                </svg>
                Semesters
              </h3>
              <ul className="space-y-2">
                {allResults.map(r => (
                  <li key={r.semester} className="rounded-xl border-2 bg-[#05A3C7]/5 p-3 hover:bg-[#05A3C7]/10 transition-colors" style={{ borderColor: "rgba(5,163,199,0.2)" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-[#1A1F29] text-sm">Semester {r.semester}</span>
                      <span className="text-xs text-[#5A6C7D] font-bold">
                        SGPA: <strong className="text-[#05A3C7]">{r.sgpa ?? '-'}</strong>
                      </span>
                    </div>
                    <div className="text-xs text-[#5A6C7D] font-medium">
                      Subjects: {r.subjects.length}
                    </div>
                  </li>
                ))}
              </ul>
            </aside>
            
            {/* Results Cards */}
            <div className="space-y-6">
              {allResults.map(r => (
                <div key={r.semester} className="rounded-2xl overflow-hidden border-2 bg-white shadow-lg" style={{ borderColor: "rgba(5,163,199,0.2)" }}>
                  <div 
                    className="text-white px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    style={{
                      background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                    }}
                  >
                    <span className="font-black text-base sm:text-lg">
                      Results — {registration} — {r.semester}
                    </span>
                    <div className="flex flex-wrap gap-3 sm:gap-4 text-sm sm:text-base">
                      <span className="px-3 py-1.5 rounded-lg bg-white/20 backdrop-blur-sm font-bold">
                        SGPA: <strong>{r.sgpa}</strong>
                      </span>
                      <span className="px-3 py-1.5 rounded-lg bg-white/20 backdrop-blur-sm font-bold">
                        CGPA: <strong>{r.cgpa}</strong>
                      </span>
                    </div>
                  </div>
                  
                  {/* Mobile Card View */}
                  <div className="block sm:hidden">
                    {r.subjects.map((s,i) => (
                      <div key={i} className="border-b-2 border-[#05A3C7]/10 p-4 hover:bg-[#05A3C7]/5 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <code className="text-[#05A3C7] bg-[#05A3C7]/10 px-2 py-1 rounded font-bold text-sm">
                            {s.Subject_Code}
                          </code>
                          <span className={`px-2 py-1 rounded-lg text-xs font-bold ${isRedGrade(s.Grade) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {s.Grade}
                          </span>
                        </div>
                        <div className="text-[#1A1F29] font-bold mb-1 text-sm">{s.Subject_Name}</div>
                        <div className="text-[#5A6C7D] text-xs font-medium">
                          Credits: <span className="px-2 py-0.5 rounded-full bg-[#05A3C7]/10 text-[#05A3C7] font-bold">{displayCredits(s.Credits)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr 
                          className="text-white"
                          style={{
                            background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                          }}
                        >
                          {['Code','Subject','Credits','Grade'].map(h => (
                            <th key={h} className="px-4 py-3 text-left uppercase tracking-wider font-black text-xs">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {r.subjects.map((s,i) => (
                          <tr key={i} className="border-t-2 border-[#05A3C7]/10 hover:bg-[#05A3C7]/5 transition-colors">
                            <td className="px-4 py-3">
                              <code className="text-[#05A3C7] bg-[#05A3C7]/10 px-2 py-1 rounded font-bold">
                                {s.Subject_Code}
                              </code>
                            </td>
                            <td className="px-4 py-3 text-[#1A1F29] font-medium">{s.Subject_Name}</td>
                            <td className="px-4 py-3">
                              <span className="px-3 py-1 rounded-full text-xs bg-[#05A3C7]/10 text-[#05A3C7] font-bold">
                                {displayCredits(s.Credits)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${isRedGrade(s.Grade) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {s.Grade}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
