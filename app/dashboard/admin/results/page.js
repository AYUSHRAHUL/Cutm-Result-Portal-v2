"use client";

import { useEffect, useRef, useState } from "react";

export default function AdminResultsPage() {
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

  // Helpers: credits parser, grade mapping, SGPA calculator
  function parseCredits(val) {
    if (val === null || val === undefined) return 0;
    const s = String(val).trim();
    if (s === "") return 0;
    if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
    return s
      .split(/[+\s]+/)
      .map(p => parseFloat(p) || 0)
      .reduce((a, b) => a + b, 0);
  }
// TODAT E: Improve grade mapping as per institution's grading system
  function gradeToPoints(grade) {
    const g = String(grade || "").toUpperCase().trim();
    const map = { "O": 10, "E": 9, "A": 8, "B": 7, "C": 6, "D": 5, "S": 0, "F": 2, "I": 0, "M": 0, "R": 0 };
    return map[g] ?? 0;
  }

  function isRedGrade(grade) {
    const g = String(grade || "").toUpperCase().trim();
    return g === "F" || g === "S";
  }

  function computeSgpa(subjectsList) {
    const totals = (subjectsList || []).reduce((acc, s) => {
      const c = parseCredits(s?.Credits);
      const p = gradeToPoints(s?.Grade);
      acc.credits += c;
      acc.points += c * p;
      return acc;
    }, { credits: 0, points: 0 });
    if (totals.credits === 0) return null;
    return Number((totals.points / totals.credits).toFixed(2));
  }

  function displayCredits(val) {
    const n = parseCredits(val);
    return Number.isFinite(n) ? (Number.isInteger(n) ? String(n) : String(n)) : String(val ?? "");
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
    setError("");
    if (!registration || !semester) { 
      setError("Enter registration and choose a semester"); 
      return; 
    }
    
    try {
      setLoading(true);
      
      // Redirect to results view page
      // If semester is "ALL", pass all semesters as comma-separated string
      let semesterParam = semester;
      if (semester === "ALL" && semesters.length > 0) {
        semesterParam = semesters.join(',');
      }
      
      const params = new URLSearchParams({
        reg: registration,
        sem: semesterParam
      });
      
      window.location.href = `/dashboard/admin/results/view?${params.toString()}`;
      
    } catch (err) { 
      setError(err.message); 
    } finally { 
      setLoading(false); 
    }
  }

  function exportCSV() {
    let rows = [];
    let header = [];
    if (allResults.length > 0) {
      header = ["Semester","Code","Subject","Credits","Grade"];
      allResults.forEach(r => {
        (r.subjects || []).forEach(s => {
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
    a.download = `result_${registration}_${semester || 'ALL'}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-6 sm:pt-8 lg:pt-12">
        {/* Header */}
       <div className="mb-4 sm:mb-6 text-center">
  <h1 
    className="text-2xl sm:text-3xl md:text-4xl font-black"
    style={{
      background: "linear-gradient(135deg, #05A3C7 0%, #04748F 50%, #023945 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
    }}
  >
    Results Viewer
  </h1>
</div>


        {/* Search Form */}
        <form 
          ref={formRef} 
          onSubmit={loadResult} 
          className="rounded-xl sm:rounded-2xl border-2 bg-white p-4 sm:p-5 mb-4 sm:mb-6 shadow-lg"
          style={{ borderColor: "rgba(5,163,199,0.2)" }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto] gap-3">
            <input 
              name="registration" 
              className="rounded-xl border-2 bg-white px-3 sm:px-4 py-2.5 sm:py-3 outline-none focus:ring-4 focus:ring-[#05A3C7]/20 text-[#1A1F29] font-medium text-sm sm:text-base min-h-[44px]" 
              style={{ borderColor: "rgba(5,163,199,0.3)" }}
              placeholder="Registration (e.g., 220101130056)" 
              value={registration} 
              onChange={e => { const v = e.target.value.toUpperCase(); setRegistration(v); if (v.length >= 6) loadSemesters(v); }} 
            />
            <select 
              className="rounded-xl border-2 bg-white px-3 py-2.5 sm:py-3 text-[#1A1F29] font-medium text-sm sm:text-base outline-none focus:ring-4 focus:ring-[#05A3C7]/20 min-h-[44px]" 
              style={{ borderColor: "rgba(5,163,199,0.3)" }}
              value={semester} 
              onChange={e => setSemester(e.target.value)}
            >
              <option value="">Select Semester</option>
              <option value="ALL" disabled={semesters.length === 0}>ALL Semesters</option>
              {semesters.map(s => <option key={s} value={s}> {s}</option>)}
            </select>
            <button 
              type="submit"
              className="rounded-xl text-white font-bold px-4 sm:px-5 py-2.5 sm:py-3 transition-all hover:shadow-lg active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed text-sm sm:text-base min-h-[44px]"
              style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
              disabled={loading}
            >
              {loading ? "Loading..." : "View Result"}
            </button>
             
          </div>
        </form>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 px-3 sm:px-4 py-2.5 sm:py-3 font-medium flex items-center gap-3 text-sm sm:text-base">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Single Semester Results */}
        {subjects.length > 0 && (
          <div className="rounded-xl sm:rounded-2xl overflow-hidden border-2 bg-white shadow-lg" style={{ borderColor: "rgba(5,163,199,0.2)" }}>
            <div 
              className="text-white px-4 sm:px-5 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4"
              style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
            >
              <span className="font-black text-sm sm:text-base">
                Results — {registration} — Semester {semester}
              </span>
              <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm">
                <span>SGPA: <strong className="text-base sm:text-lg">{sgpa}</strong></span>
                <span>CGPA: <strong className="text-base sm:text-lg">{cgpa}</strong></span>
              </div>
            </div>
            
            {/* Mobile Card View */}
            <div className="block lg:hidden divide-y-2" style={{ borderColor: "rgba(5,163,199,0.1)" }}>
              {subjects.map((r, i) => (
                <div key={i} className="p-3 sm:p-4 hover:bg-[#05A3C7]/5 transition-colors">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <code className="text-[#05A3C7] bg-[#05A3C7]/10 px-2 py-1 rounded font-bold text-xs sm:text-sm">
                      {r.Subject_Code}
                    </code>
                    <span className={`px-2.5 py-1 rounded-full text-xs sm:text-sm font-bold ${isRedGrade(r.Grade) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {r.Grade}
                    </span>
                  </div>
                  <div className="text-[#1A1F29] font-medium text-sm sm:text-base mb-2">
                    {r.Subject_Name}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs bg-[#05A3C7]/10 font-bold" style={{ color: "#04748F" }}>
                      Credits: {displayCredits(r.Credits)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }} className="text-white">
                    {['Code','Subject','Credits','Grade'].map(h => (
                      <th key={h} className="px-4 py-3 text-left uppercase tracking-wider font-black text-xs">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((r, i) => (
                    <tr key={i} className="border-t-2 hover:bg-[#05A3C7]/5 transition-colors" style={{ borderColor: "rgba(5,163,199,0.1)" }}>
                      <td className="px-4 py-3">
                        <code className="text-[#05A3C7] bg-[#05A3C7]/10 px-2 py-1 rounded font-bold text-sm">
                          {r.Subject_Code}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-[#1A1F29] font-medium">{r.Subject_Name}</td>
                      <td className="px-4 py-3">
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#05A3C7]/10" style={{ color: "#04748F" }}>
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
        {allResults.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 sm:gap-6">
            {/* Sidebar */}
            <aside className="rounded-xl sm:rounded-2xl border-2 bg-white p-3 sm:p-4 shadow-lg max-h-[70vh] overflow-auto" style={{ borderColor: "rgba(5,163,199,0.2)" }}>
              <h3 className="text-[#1A1F29] font-black mb-3 text-sm sm:text-base flex items-center gap-2">
                <span>📊</span> Semesters
              </h3>
              <ul className="space-y-2">
                {allResults.map((r) => (
                  <li 
                    key={r.semester} 
                    className="rounded-lg border-2 bg-white p-2 sm:p-3 hover:bg-[#05A3C7]/5 transition-colors"
                    style={{ borderColor: "rgba(5,163,199,0.2)" }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[#1A1F29] font-bold text-xs sm:text-sm">Sem {r.semester}</span>
                      <span className="text-[10px] sm:text-xs font-bold" style={{ color: "#05A3C7" }}>
                        SGPA: {r.sgpa ?? '-'}
                      </span>
                    </div>
                    <div className="text-[10px] sm:text-xs text-[#5A6C7D]">
                      {r.subjects.length} subjects • CGPA: {r.cgpa}
                    </div>
                  </li>
                ))}
              </ul>
            </aside>

            {/* Results List */}
            <div className="space-y-4 sm:space-y-6">
              {allResults.map((r) => (
                <div key={r.semester} className="rounded-xl sm:rounded-2xl overflow-hidden border-2 bg-white shadow-lg" style={{ borderColor: "rgba(5,163,199,0.2)" }}>
                  <div 
                    className="text-white px-4 sm:px-5 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                  >
                    <span className="font-black text-sm sm:text-base">Semester {r.semester}</span>
                    <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm">
                      <span>SGPA: <strong className="text-base sm:text-lg">{r.sgpa}</strong></span>
                      <span>CGPA: <strong className="text-base sm:text-lg">{r.cgpa}</strong></span>
                    </div>
                  </div>
                  
                  {/* Mobile Cards */}
                  <div className="block lg:hidden divide-y-2" style={{ borderColor: "rgba(5,163,199,0.1)" }}>
                    {r.subjects.map((s, i) => (
                      <div key={i} className="p-3 sm:p-4 hover:bg-[#05A3C7]/5 transition-colors">
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <code className="text-[#05A3C7] bg-[#05A3C7]/10 px-2 py-1 rounded font-bold text-xs sm:text-sm">
                            {s.Subject_Code}
                          </code>
                          <span className={`px-2.5 py-1 rounded-full text-xs sm:text-sm font-bold ${isRedGrade(s.Grade) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {s.Grade}
                          </span>
                        </div>
                        <div className="text-[#1A1F29] font-medium text-sm sm:text-base mb-2">
                          {s.Subject_Name}
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-xs bg-[#05A3C7]/10 font-bold" style={{ color: "#04748F" }}>
                          Credits: {displayCredits(s.Credits)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }} className="text-white">
                          {['Code','Subject','Credits','Grade'].map(h => (
                            <th key={h} className="px-4 py-3 text-left uppercase tracking-wider font-black text-xs">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {r.subjects.map((s, i) => (
                          <tr key={i} className="border-t-2 hover:bg-[#05A3C7]/5 transition-colors" style={{ borderColor: "rgba(5,163,199,0.1)" }}>
                            <td className="px-4 py-3">
                              <code className="text-[#05A3C7] bg-[#05A3C7]/10 px-2 py-1 rounded font-bold text-sm">
                                {s.Subject_Code}
                              </code>
                            </td>
                            <td className="px-4 py-3 text-[#1A1F29] font-medium">{s.Subject_Name}</td>
                            <td className="px-4 py-3">
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#05A3C7]/10" style={{ color: "#04748F" }}>
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

        {/* Loading Overlayf*/}
        {loading && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <div 
              className="rounded-xl sm:rounded-2xl p-4 sm:p-6 flex items-center gap-3 shadow-2xl max-w-sm w-full"
              style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
            >
              <div className="w-5 h-5 sm:w-6 sm:h-6 border-3 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0"></div>
              <span className="text-white font-bold text-sm sm:text-base">Loading results...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function escapeCsv(val) {
  const s = String(val ?? "");
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
  return s;
}
