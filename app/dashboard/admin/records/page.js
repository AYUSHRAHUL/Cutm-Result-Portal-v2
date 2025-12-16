"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { appendSchoolParams, getSchoolApiUrl } from "@/lib/api-helper";

export default function AdminRecordsPage() {
  const [registration, setRegistration] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const totalCredits = rows.reduce((acc, r) => acc + sumCredits(r.Credits), 0);
  const formRef = useRef(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });

  // Sort function for table columns
  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // Apply sorting to the rows
  const sortedRows = useMemo(() => {
    if (!sortConfig.key) return rows;
    
    return [...rows].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'ascending' ? 1 : -1;
      }
      return 0;
    });
  }, [rows, sortConfig]);

  async function search(e) {
    e?.preventDefault();
    setMessage(""); setError(""); setRows([]);
    const reg = registration.trim().toUpperCase();
    if (!reg) { 
      setError("Please enter a registration number."); 
      return; 
    }
    
    const isCUTM = /^[0-9]{2}CUTM[0-9]{10}$/.test(reg);
    const isPlain = /^[A-Z0-9\-]{6,20}$/.test(reg);
    if (!isCUTM && !isPlain) {
      setError("Invalid registration. Enter CUTM format (21CUTMXXXXXXXXXX).");
      return;
    }
    
    try {
      setLoading(true);
      const studentsUrl = getSchoolApiUrl("students");
      const res = await fetch(studentsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: reg })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No records found");
      setRows(data.records || []);
      if (data.records && data.records.length > 0) {
        setMessage(`Found ${data.records.length} academic records for ${reg}`);
      }
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  async function updateGrade(row, newGrade) {
    const grade = String(newGrade || "").trim().toUpperCase();
    if (!grade) return;
    
    const validGrades = ["O","E","A","B","C","D","F","S","M","I","R"];
    if (!validGrades.includes(grade)) {
      setError("Invalid grade. Please select a valid grade.");
      return;
    }
    
    if (!confirm(`Update grade for ${row.Subject_Name} (${row.Subject_Code}) to ${grade}?`)) return;
    try {
      setLoading(true); setError(""); setMessage("");
      const payload = { ...row, Grade: grade };
      let studentsUrl = getSchoolApiUrl("students");
      const res = await fetch(studentsUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setMessage(`Grade updated successfully for ${row.Subject_Name} (${row.Subject_Code}) to ${grade}`);
      await search();
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    const el = formRef.current?.querySelector('input[name="registration"]');
    if (el) el.focus();
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        search();
      }
    };
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [registration]);

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
    Student Records
  </h1>
  <p className="text-[#5A6C7D] text-sm sm:text-base font-medium mt-2">
    View and manage academic records
  </p>
</div>


        {/* Search Form */}
        <div 
          className="rounded-xl sm:rounded-2xl border-2 bg-white p-4 sm:p-5 mb-4 sm:mb-6 shadow-lg"
          style={{ borderColor: "rgba(5,163,199,0.2)" }}
        >
          <h2 className="text-[#1A1F29] font-black mb-3 flex items-center gap-2 text-sm sm:text-base">
            🔎 Search Student Records
          </h2>
          <form ref={formRef} onSubmit={search} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <input
              name="registration"
              className="rounded-xl border-2 bg-white px-3 sm:px-4 py-2.5 sm:py-3 outline-none focus:ring-4 focus:ring-[#05A3C7]/20 text-[#1A1F29] font-medium text-sm sm:text-base min-h-[44px]"
              style={{ borderColor: "rgba(5,163,199,0.3)" }}
              placeholder="Enter registration number"
              value={registration}
              onChange={e => setRegistration(e.target.value.toUpperCase())}
            />
            <button 
              className="rounded-xl text-white font-bold px-4 sm:px-5 py-2.5 sm:py-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg active:scale-95 text-sm sm:text-base min-h-[44px]"
              style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
              disabled={loading}
            >
              {loading ? "Searching..." : "Search Records"}
            </button>
          </form>
        </div>

        {/* Alerts */}
        {message && (
          <div className="mb-4 rounded-xl border-2 border-green-200 bg-green-50 text-green-700 px-3 sm:px-4 py-2.5 sm:py-3 font-medium flex items-center gap-3 text-sm sm:text-base">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
            </svg>
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 px-3 sm:px-4 py-2.5 sm:py-3 font-medium flex items-center gap-3 text-sm sm:text-base">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Table / Cards */}
        {rows.length > 0 ? (
          <div 
            className="rounded-xl sm:rounded-2xl overflow-hidden border-2 bg-white shadow-lg"
            style={{ borderColor: "rgba(5,163,199,0.2)" }}
          >
            <div 
              className="text-white px-4 sm:px-5 lg:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
            >
              <div className="flex items-center gap-2">
                <span className="p-1 sm:p-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }}>📊</span>
                <span className="font-black text-sm sm:text-base">Academic Records — {registration}</span>
              </div>
              <div className="text-xs sm:text-sm px-2.5 sm:px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }}>
                {rows.length} Records
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="block lg:hidden divide-y-2" style={{ borderColor: "rgba(5,163,199,0.1)" }}>
              {sortedRows.map((r, i) => (
                <div key={i} className="p-3 sm:p-4 hover:bg-[#05A3C7]/5 transition-colors">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[#1A1F29] font-bold text-sm sm:text-base mb-0.5">{r.Name}</div>
                      <div className="text-[#5A6C7D] text-xs sm:text-sm font-medium">{r.Reg_No}</div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs sm:text-sm font-bold flex-shrink-0 ${badgeClass(r.Grade)}`}>
                      {r.Grade}
                    </span>
                  </div>
                  
                  <div className="text-[#1A1F29] font-medium text-sm mb-2 leading-snug">{r.Subject_Name}</div>
                  
                  <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
                    <code className="text-[#05A3C7] bg-[#05A3C7]/10 px-2 py-1 rounded font-bold">
                      {r.Subject_Code}
                    </code>
                    <span className="px-2 py-1 rounded-full font-bold text-white" style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}>
                      Sem {r.Sem}
                    </span>
                    <span className="px-2 py-1 rounded-full text-[#04748F] bg-[#05A3C7]/10 font-bold">
                      {sumCredits(r.Credits)} Credits
                    </span>
                  </div>
                  
                  <select 
                    defaultValue="" 
                    className="w-full rounded-lg border-2 bg-white px-3 py-2 text-[#1A1F29] text-sm font-medium outline-none focus:ring-4 focus:ring-[#05A3C7]/20 min-h-[44px]"
                    style={{ borderColor: "rgba(5,163,199,0.3)" }}
                    onChange={e => { const v = e.target.value; e.target.value = ""; updateGrade(r, v); }}
                  >
                    <option value="">Update Grade</option>
                    {["O","E","A","B","C","D","F","S","M","I","R"].map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto max-h-[70vh]">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }} className="text-white">
                    {[
                      {label: 'Reg No', key: 'Reg_No'},
                      {label: 'Name', key: 'Name'},
                      {label: 'Sem', key: 'Sem'},
                      {label: 'Code', key: 'Subject_Code'},
                      {label: 'Subject', key: 'Subject_Name'},
                      {label: 'Credits', key: 'Credits'},
                      {label: 'Grade', key: 'Grade'},
                      {label: 'Update', key: null}
                    ].map(({label, key}) => (
                      <th 
                        key={label} 
                        className="px-3 sm:px-4 py-3 text-left uppercase tracking-wider font-black text-xs cursor-pointer hover:bg-white/10 transition-colors"
                        onClick={() => key && requestSort(key)}
                      >
                        <div className="flex items-center gap-1">
                          {label}
                          {sortConfig.key === key && (
                            <span className="ml-1">
                              {sortConfig.direction === 'ascending' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((r, i) => (
                    <tr key={i} className="border-t-2 hover:bg-[#05A3C7]/5 transition-colors" style={{ borderColor: "rgba(5,163,199,0.1)" }}>
                      <td className="px-3 sm:px-4 py-3 font-bold text-[#05A3C7]">{r.Reg_No}</td>
                      <td className="px-3 sm:px-4 py-3 text-[#1A1F29] font-medium">{r.Name}</td>
                      <td className="px-3 sm:px-4 py-3">
                        <span className="px-2.5 py-1 rounded-full text-xs text-white font-bold" style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}>
                          {r.Sem}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <code className="text-[#05A3C7] bg-[#05A3C7]/10 px-2 py-1 rounded font-bold text-xs">
                          {r.Subject_Code}
                        </code>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-[#1A1F29] font-medium max-w-xs truncate">{r.Subject_Name}</td>
                      <td className="px-3 sm:px-4 py-3">
                        <span className="px-2.5 py-1 rounded-full text-xs text-[#04748F] bg-[#05A3C7]/10 font-bold">
                          {sumCredits(r.Credits)}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${badgeClass(r.Grade)}`}>
                          {r.Grade}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <select 
                          defaultValue="" 
                          className="rounded-lg border-2 bg-white px-3 py-1.5 text-[#1A1F29] text-xs font-medium outline-none focus:ring-2 focus:ring-[#05A3C7]/20"
                          style={{ borderColor: "rgba(5,163,199,0.3)" }}
                          onChange={e => { const v = e.target.value; e.target.value = ""; updateGrade(r, v); }}
                        >
                          <option value="">Update</option>
                          {["O","E","A","B","C","D","F","S","M","I","R"].map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }} className="text-white font-bold">
                    <td className="px-3 sm:px-4 py-3 text-right" colSpan={5}>TOTAL CREDITS:</td>
                    <td className="px-3 sm:px-4 py-3">
                      <span className="px-3 py-1.5 rounded-lg bg-white text-[#05A3C7] font-black shadow-sm">
                        {totalCredits.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-3" colSpan={2}>
                      <span className="text-xs sm:text-sm opacity-90">Cumulative credits earned</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer Stats */}
            <div 
              className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 border-t-2 text-[#1A1F29] text-xs sm:text-sm grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-center"
              style={{ borderColor: "rgba(5,163,199,0.1)", background: "rgba(5,163,199,0.05)" }}
            >
              <FooterStat label="Total Subjects" value={rows.length} />
              <FooterStat label="Total Credits" value={totalCredits.toFixed(1)} />
              <FooterStat label="Passed" value={rows.filter(r => !["F","M","S"].includes(r.Grade)).length} color="text-green-600" />
              <FooterStat label="Failed" value={rows.filter(r => ["F","M","S"].includes(r.Grade)).length} color="text-red-600" />
            </div>
          </div>
        ) : loading ? (
          <div 
            className="rounded-xl sm:rounded-2xl border-2 bg-white p-8 sm:p-10 text-center shadow-lg"
            style={{ borderColor: "rgba(5,163,199,0.2)" }}
          >
            <div 
              className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ background: "rgba(5,163,199,0.1)" }}
            >
              <div className="animate-spin rounded-full h-10 h-10 sm:h-12 sm:w-12 border-b-2 border-t-2" style={{ borderColor: "#05A3C7" }}></div>
            </div>
            <h3 className="text-base sm:text-lg font-black mb-1 text-[#1A1F29]">Searching Records...</h3>
            <p className="text-[#5A6C7D] text-sm">Please wait while we fetch the academic records.</p>
          </div>
        ) : (
          <div 
            className="rounded-xl sm:rounded-2xl border-2 bg-white p-10 sm:p-12 text-center shadow-lg"
            style={{ borderColor: "rgba(5,163,199,0.2)" }}
          >
            <div 
              className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ background: "rgba(5,163,199,0.1)" }}
            >
              <span className="text-3xl sm:text-4xl animate-pulse">🔍</span>
            </div>
            <h3 className="text-base sm:text-lg font-black mb-1 text-[#1A1F29]">Search Student Academic Records</h3>
            <p className="text-[#5A6C7D] text-sm">Enter a registration number above to view and manage grades.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function sumCredits(creditStr) {
  if (!creditStr) return 0;
  const str = String(creditStr).replace(/--/g, "+");
  return str.split("+").filter(Boolean).map(Number).filter(n => !Number.isNaN(n)).reduce((a,b)=>a+b,0);
}

function badgeClass(grade) {
  if (["O","E","A"].includes(grade)) return "bg-green-100 text-green-700";
  if (["B","C","D"].includes(grade)) return "bg-amber-100 text-amber-700";
  if (["F","M","S"].includes(grade)) return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-700";
}

function FooterStat({ label, value, color = "text-[#1A1F29]" }) {
  return (
    <div>
      <small className="block text-[#5A6C7D] font-medium text-[10px] sm:text-xs uppercase tracking-wide">{label}</small>
      <strong className={`text-base sm:text-lg font-black ${color}`}>{value}</strong>
    </div>
  );
}
