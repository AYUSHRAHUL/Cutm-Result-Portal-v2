"use client";

import { useEffect, useRef, useState } from "react";

export default function AdminBacklogPage() {
  const [registration, setRegistration] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [branch, setBranch] = useState("");
  const [year, setYear] = useState("");
  const [regList, setRegList] = useState([]);
  const [regMode, setRegMode] = useState("manual");
  const [selectedReg, setSelectedReg] = useState("");
  const [subjectMode, setSubjectMode] = useState("manual");
  const [subjectList, setSubjectList] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const formRef = useRef(null);

  // CSV Export Function
  function exportCSV() {
    if (rows.length === 0) return;
    
    const headers = ["Reg No", "Name", "Branch", "Batch", "Semester", "Subject Code", "Subject Name", "Grade"];
    const csvRows = rows.map(b => [
      b.Reg_No || b.registration || '',
      b.Name || '',
      b.Branch || '',
      b.Batch || '',
      b.Sem || '',
      b.Subject_Code || b.subject_code || '',
      b.Subject_Name || '',
      b.Grade || ''
    ].map(field => {
      const str = String(field).replace(/"/g, '""');
      return /[",\n]/.test(str) ? `"${str}"` : str;
    }).join(','));
    
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backlogs_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

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
      const list = data.backlogs || data.result || [];
      setRows(list);
      setCount(list.length);
      setMessage(data.message || "Results loaded");
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    formRef.current?.querySelector('input[name="registration"]')?.focus();
  }, []);

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
        
        const res = await fetch("/api/students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ department: "All", batch: "All" })
        });
        const data = await res.json();
        
        if (res.ok) {
          let students = data.students || data.records || data.result || [];
          
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
            .sort();
          
          setRegList(Array.from(new Set(list)));
          setSelectedReg("");
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

  useEffect(() => {
    if (regMode === "list" && selectedReg) {
      search();
    }
  }, [selectedReg, regMode]);

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

  const getFilteredRows = () => {
    let filtered = [...rows];
    if (filterGrade) {
      filtered = filtered.filter(b => b.Grade === filterGrade);
    }
    if (sortBy === "name") {
      filtered.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
    } else if (sortBy === "reg") {
      filtered.sort((a, b) => (a.Reg_No || a.registration || '').localeCompare(b.Reg_No || b.registration || ''));
    }
    return filtered;
  };

  const filteredRows = getFilteredRows();
  const uniqueGrades = Array.from(new Set(rows.map(r => r.Grade).filter(Boolean)));

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
            className="text-2xl sm:text-3xl md:text-4xl font-black inline-flex items-center justify-center gap-2 sm:gap-3"
            style={{
              background: "linear-gradient(135deg, #05A3C7 0%, #04748F 50%, #023945 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Backlog Management
          </h1>
          <p className="text-[#5A6C7D] text-sm sm:text-base font-medium mt-2">
            Track and manage student backlogs
          </p>
        </div>

        {/* Search Forms */}
        <form ref={formRef} onSubmit={search} className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="rounded-xl sm:rounded-2xl border-2 bg-white p-3 sm:p-4 lg:p-5 shadow-lg" style={{ borderColor: "rgba(5,163,199,0.2)" }}>
            <h2 className="text-[#1A1F29] font-black mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base lg:text-lg">
              🔎 Search by Registration
            </h2>
            <div className="mb-2 sm:mb-3">
              <select 
                className="w-full rounded-lg sm:rounded-xl border-2 bg-white px-3 py-2 sm:py-2.5 text-sm sm:text-base text-[#1A1F29] font-medium outline-none focus:ring-4 focus:ring-[#05A3C7]/20 transition-all min-h-[44px]" 
                style={{ borderColor: "rgba(5,163,199,0.3)" }}
                value={regMode} 
                onChange={e=>setRegMode(e.target.value)}
              >
                <option value="manual">Enter Manually</option>
                <option value="list">Choose from List</option>
              </select>
            </div>
            {regMode === "manual" ? (
              <div className="flex flex-col gap-2 sm:gap-3">
                <input 
                  name="registration" 
                  className="w-full rounded-lg sm:rounded-xl border-2 bg-white px-3 sm:px-4 py-2.5 sm:py-3 outline-none focus:ring-4 focus:ring-[#05A3C7]/20 text-[#1A1F29] font-medium transition-all text-sm sm:text-base min-h-[44px]" 
                  style={{ borderColor: "rgba(5,163,199,0.3)" }}
                  placeholder="e.g., 220101130056" 
                  value={registration} 
                  onChange={e => setRegistration(e.target.value.toUpperCase())} 
                />
                <button 
                  type="submit"
                  className="w-full rounded-lg sm:rounded-xl text-white font-black px-4 sm:px-5 py-3 sm:py-3.5 transition-all duration-300 hover:shadow-lg active:scale-95 text-sm sm:text-base min-h-[44px]"
                  style={{
                    background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                  }}
                >
                  Search
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <select 
                    className="w-full rounded-lg sm:rounded-xl border-2 bg-white px-3 py-2 sm:py-2.5 text-sm sm:text-base text-[#1A1F29] font-medium outline-none focus:ring-4 focus:ring-[#05A3C7]/20 transition-all min-h-[44px]" 
                    style={{ borderColor: "rgba(5,163,199,0.3)" }}
                    value={year} 
                    onChange={e=>setYear(e.target.value)}
                  >
                    <option value="">Batch (Year)</option>
                    {["2020","2021","2022","2023","2024","2025"].map(y=> <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select 
                    className="w-full rounded-lg sm:rounded-xl border-2 bg-white px-3 py-2 sm:py-2.5 text-sm sm:text-base text-[#1A1F29] font-medium outline-none focus:ring-4 focus:ring-[#05A3C7]/20 transition-all min-h-[44px]" 
                    style={{ borderColor: "rgba(5,163,199,0.3)" }}
                    value={branch} 
                    onChange={e=>setBranch(e.target.value)}
                  >
                    <option value="">Branch</option>
                    <option value="Civil">Civil</option>
                    <option value="CSE">CSE</option>
                    <option value="ECE">ECE</option>
                    <option value="EEE">EEE</option>
                    <option value="Mechanical">Mechanical</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2 sm:gap-3">
                  <select 
                    className="w-full rounded-lg sm:rounded-xl border-2 bg-white px-3 py-2 sm:py-2.5 text-sm sm:text-base text-[#1A1F29] font-medium outline-none focus:ring-4 focus:ring-[#05A3C7]/20 transition-all min-h-[44px]" 
                    style={{ borderColor: "rgba(5,163,199,0.3)" }}
                    value={selectedReg} 
                    onChange={e=>setSelectedReg(e.target.value)}
                  >
                    <option value="">
                      {regList.length === 0 
                        ? (branch && year ? "No students found" : "Select batch & branch")
                        : `Select Registration (${regList.length})`
                      }
                    </option>
                    {regList.map(r=> <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button 
                    type="submit"
                    className="w-full rounded-lg sm:rounded-xl text-white font-black px-4 sm:px-5 py-3 sm:py-3.5 transition-all duration-300 hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base min-h-[44px]"
                    style={{
                      background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                    }}
                    disabled={!selectedReg}
                  >
                    {selectedReg ? "Search" : "Select First"}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="rounded-xl sm:rounded-2xl border-2 bg-white p-3 sm:p-4 lg:p-5 shadow-lg" style={{ borderColor: "rgba(5,163,199,0.2)" }}>
            <h2 className="text-[#1A1F29] font-black mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base lg:text-lg">
              🎯 Search by Subject + Filters
            </h2>
            <div className="mb-2 sm:mb-3">
              <select 
                className="w-full rounded-lg sm:rounded-xl border-2 bg-white px-3 py-2 sm:py-2.5 text-sm sm:text-base text-[#1A1F29] font-medium outline-none focus:ring-4 focus:ring-[#05A3C7]/20 transition-all min-h-[44px]" 
                style={{ borderColor: "rgba(5,163,199,0.3)" }}
                value={subjectMode} 
                onChange={e=>setSubjectMode(e.target.value)}
              >
                <option value="manual">Enter Subject Manually</option>
                <option value="list">Choose Subject from List</option>
              </select>
            </div>
            <div className="space-y-2 sm:space-y-3">
              {subjectMode === "manual" ? (
                <input 
                  className="w-full rounded-lg sm:rounded-xl border-2 bg-white px-3 sm:px-4 py-2.5 sm:py-3 outline-none focus:ring-4 focus:ring-[#05A3C7]/20 text-[#1A1F29] font-medium transition-all text-sm sm:text-base min-h-[44px]" 
                  style={{ borderColor: "rgba(5,163,199,0.3)" }}
                  placeholder="Subject code (e.g., CS101)" 
                  value={subjectCode} 
                  onChange={e => setSubjectCode(e.target.value.toUpperCase())} 
                />
              ) : (
                <select 
                  className="w-full rounded-lg sm:rounded-xl border-2 bg-white px-3 py-2 sm:py-2.5 text-sm sm:text-base text-[#1A1F29] font-medium outline-none focus:ring-4 focus:ring-[#05A3C7]/20 transition-all min-h-[44px]" 
                  style={{ borderColor: "rgba(5,163,199,0.3)" }}
                  value={selectedSubject} 
                  onChange={e=>setSelectedSubject(e.target.value)}
                >
                  <option value="">Select Subject from CBCS</option>
                  {subjectList.map(s=> <option key={s.code} value={s.code}>{`${s.code}${s.name?` — ${s.name}`:''}`}</option>)}
                </select>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <select 
                  className="w-full rounded-lg sm:rounded-xl border-2 bg-white px-3 py-2 sm:py-2.5 text-sm sm:text-base text-[#1A1F29] font-medium outline-none focus:ring-4 focus:ring-[#05A3C7]/20 transition-all min-h-[44px]" 
                  style={{ borderColor: "rgba(5,163,199,0.3)" }}
                  value={branch} 
                  onChange={e => setBranch(e.target.value)}
                >
                  <option value="">All Branches</option>
                  <option value="Civil">Civil</option>
                  <option value="CSE">CSE</option>
                  <option value="ECE">ECE</option>
                  <option value="EEE">EEE</option>
                  <option value="Mechanical">Mechanical</option>
                </select>
                <select 
                  className="w-full rounded-lg sm:rounded-xl border-2 bg-white px-3 py-2 sm:py-2.5 text-sm sm:text-base text-[#1A1F29] font-medium outline-none focus:ring-4 focus:ring-[#05A3C7]/20 transition-all min-h-[44px]" 
                  style={{ borderColor: "rgba(5,163,199,0.3)" }}
                  value={year} 
                  onChange={e => setYear(e.target.value)}
                >
                  <option value="">All Batches</option>
                  {["2020","2021","2022","2023","2024","2025"].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <button 
                type="button"
                onClick={search} 
                className="w-full rounded-lg sm:rounded-xl text-white font-black px-4 sm:px-5 py-3 sm:py-3.5 transition-all duration-300 hover:shadow-lg active:scale-95 text-sm sm:text-base min-h-[44px]"
                style={{
                  background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                }}
              >
                Search with Filters
              </button>
            </div>
          </div>
        </form>

        {/* Alerts */}
        {message && (
          <div className="mb-3 sm:mb-4 rounded-lg sm:rounded-xl border-2 border-green-200 bg-green-50 text-green-700 px-3 sm:px-4 py-2.5 sm:py-3 font-medium flex items-center gap-2 sm:gap-3 text-sm sm:text-base">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
            </svg>
            {message}
          </div>
        )}
        {error && (
          <div className="mb-3 sm:mb-4 rounded-lg sm:rounded-xl border-2 border-red-200 bg-red-50 text-red-700 px-3 sm:px-4 py-2.5 sm:py-3 font-medium flex items-center gap-2 sm:gap-3 text-sm sm:text-base">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Filter and Sort */}
        {rows.length > 0 && (
          <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <select 
              className="w-full sm:w-auto rounded-lg border-2 bg-white px-3 py-2 sm:py-2.5 text-[#1A1F29] text-sm font-medium outline-none focus:ring-4 focus:ring-[#05A3C7]/20 transition-all min-h-[44px]"
              style={{ borderColor: "rgba(5,163,199,0.3)" }}
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
            >
              <option value="">Sort by...</option>
              <option value="name">Name</option>
              <option value="reg">Registration</option>
            </select>
            
            <select 
              className="w-full sm:w-auto rounded-lg border-2 bg-white px-3 py-2 sm:py-2.5 text-[#1A1F29] text-sm font-medium outline-none focus:ring-4 focus:ring-[#05A3C7]/20 transition-all min-h-[44px]"
              style={{ borderColor: "rgba(5,163,199,0.3)" }}
              value={filterGrade}
              onChange={e => setFilterGrade(e.target.value)}
            >
              <option value="">All Grades</option>
              {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        )}

        {/* Results Table */}
        <div className="rounded-xl sm:rounded-2xl overflow-hidden border-2 bg-white shadow-lg" style={{ borderColor: "rgba(5,163,199,0.2)" }}>
          <div 
            className="text-white px-3 sm:px-4 lg:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3"
            style={{
              background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
            }}
          >
            <span className="font-black text-sm sm:text-base lg:text-lg">Backlog Results</span>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm lg:text-base">
              <span className="font-bold">{filteredRows.length} record{filteredRows.length === 1 ? "" : "s"}</span>
              {count > 0 && (
                <button 
                  onClick={exportCSV}
                  className="px-3 py-1.5 sm:py-2 rounded-lg bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors flex items-center gap-1.5 font-bold min-h-[36px]"
                >
                  <span className="text-base sm:text-lg">📥</span>
                  <span className="hidden xs:inline">Export CSV</span>
                  <span className="xs:hidden">Export</span>
                </button>
              )}
            </div>
          </div>
          
          {/* Mobile Card View */}
          <div className="block md:hidden">
            {filteredRows.length === 0 ? (
              <div className="px-3 py-8 sm:py-10 text-center text-[#5A6C7D] font-medium text-sm">
                {rows.length === 0 ? "No backlog results" : "No results match filters"}
              </div>
            ) : (
              <div className="divide-y-2 divide-[#05A3C7]/10">
                {filteredRows.map((b, i) => (
                  <div key={i} className="p-3 sm:p-4 hover:bg-[#05A3C7]/5 active:bg-[#05A3C7]/10 transition-colors">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-[#1A1F29] font-bold text-sm sm:text-base truncate">{b.Name || '-'}</div>
                        <div className="text-[#5A6C7D] text-xs sm:text-sm font-medium">{b.Reg_No || b.registration || '-'}</div>
                      </div>
                      <span className="px-2 sm:px-2.5 py-1 rounded-lg text-xs sm:text-sm font-bold bg-red-100 text-red-700 flex-shrink-0">
                        {b.Grade || '-'}
                      </span>
                    </div>
                    <div className="text-[#1A1F29] font-medium mb-2 text-xs sm:text-sm leading-snug">{b.Subject_Name || '-'}</div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <code className="text-[#05A3C7] bg-[#05A3C7]/10 px-2 py-1 rounded font-bold">
                        {b.Subject_Code || b.subject_code}
                      </code>
                      <span className="px-2 py-1 rounded-full bg-[#05A3C7]/10 text-[#05A3C7] font-bold">
                        Sem {b.Sem || '-'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr 
                  className="text-white"
                  style={{
                    background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                  }}
                >
                  {["Reg No","Name","Branch","Batch","Semester","Subject Code","Subject Name","Grade"].map(h => (
                    <th key={h} className="px-4 py-3 text-left uppercase tracking-wider font-black text-xs whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 lg:py-10 text-center text-[#5A6C7D] font-medium">
                      {rows.length === 0 ? "No backlog results" : "No results match filters"}
                    </td>
                  </tr>
                )}
                {filteredRows.map((b, i) => (
                  <tr key={i} className="border-t-2 border-[#05A3C7]/10 hover:bg-[#05A3C7]/5 transition-colors">
                    <td className="px-4 py-3 text-[#1A1F29] font-medium whitespace-nowrap">{b.Reg_No || b.registration || '-'}</td>
                    <td className="px-4 py-3 text-[#1A1F29] font-medium">{b.Name || '-'}</td>
                    <td className="px-4 py-3 text-[#1A1F29] font-medium">{b.Branch || '-'}</td>
                    <td className="px-4 py-3 text-[#1A1F29] font-medium whitespace-nowrap">{b.Batch || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="px-3 py-1 rounded-full text-xs bg-[#05A3C7]/10 text-[#05A3C7] font-bold whitespace-nowrap">
                        {b.Sem || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-[#05A3C7] bg-[#05A3C7]/10 px-2 py-1 rounded font-bold whitespace-nowrap">
                        {b.Subject_Code || b.subject_code || '-'}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-[#1A1F29] font-medium">{b.Subject_Name || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 whitespace-nowrap">
                        {b.Grade || '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <div 
              className="rounded-xl sm:rounded-2xl p-4 sm:p-6 flex items-center gap-3 shadow-2xl max-w-sm w-full"
              style={{
                background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
              }}
            >
              <div className="w-5 h-5 sm:w-6 sm:h-6 border-3 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0"></div>
              <span className="text-white font-bold text-sm sm:text-base">Loading backlog data...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
