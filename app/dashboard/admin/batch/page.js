"use client";

import { useMemo, useState } from "react";

export default function AdminBatchPage() {
  const [branch, setBranch] = useState("");
  const [batch, setBatch] = useState("");
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setMessage(""); setError(""); setRows([]); setCount(0);
    try {
      setLoading(true);
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch, batch })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No data found");
      const records = data.records || data.result || [];
      setRows(records);
      setCount(records.length);
      setMessage(data.message || `${records.length} records loaded`);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  function exportCSV() {
    if (rows.length === 0) return;
    const keys = ["Reg_No","Name","Sem","Subject_Code","Subject_Name","Credits","Grade"];
    const csv = [keys.join(",")]
      .concat(rows.map(r => {
        const record = { ...r, Credits: computeCreditsSum(r.Credits) };
        return keys.map(k => escapeCsv(record[k] ?? "")).join(",");
      }))
      .join("\n");
    downloadBlob(csv, `batch_${branch || "all"}_${batch || "all"}.csv`, "text/csv;charset=utf-8;");
  }

  function exportExcel() {
    if (rows.length === 0) return;
    const header = ["Reg No","Name","Semester","Subject Code","Subject Name","Credits","Grade"];
    const table = [header].concat(rows.map(r => [r.Reg_No,r.Name,r.Sem,r.Subject_Code,r.Subject_Name,computeCreditsSum(r.Credits),r.Grade]));
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><table>${table.map(row => `<tr>${row.map(c => `<td>${String(c ?? "").toString().replace(/&/g,'&amp;').replace(/</g,'&lt;')}</td>`).join("")}</tr>`).join("")}</table></body></html>`;
    downloadBlob(html, `batch_${branch || "all"}_${batch || "all"}.xls`, "application/vnd.ms-excel");
  }

  async function exportPDF() {
    if (rows.length === 0) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const rowsHtml = rows.map(r => `<tr><td>${r.Reg_No}</td><td>${r.Name}</td><td>${r.Sem}</td><td>${r.Subject_Code}</td><td>${r.Subject_Name}</td><td>${computeCreditsSum(r.Credits)}</td><td>${r.Grade}</td></tr>`).join("");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Batch Export</title><style>table{width:100%;border-collapse:collapse}td,th{border:1px solid #000;padding:6px;text-align:left}th{background:#eee}</style></head><body><h2>Batch Data</h2><p>Generated: ${new Date().toLocaleString()}</p><table><thead><tr><th>Reg No</th><th>Name</th><th>Sem</th><th>Subject Code</th><th>Subject Name</th><th>Credits</th><th>Grade</th></tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div 
      className="min-h-screen pb-8 sm:pb-12"
      style={{
        background: "linear-gradient(to bottom, #F5F8FA 0%, #E8F4F8 50%, #D1E9F6 100%)",
      }}
    >
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 pt-6 sm:pt-8 lg:pt-12">
        {/* Header */}
        <div className="mb-4 sm:mb-6 text-center">
          <h1 
            className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black inline-flex items-center justify-center gap-2 sm:gap-3"
            style={{
              background: "linear-gradient(135deg, #05A3C7 0%, #04748F 50%, #023945 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Batch Data Portal
          </h1>
        </div>

        {/* Main Card */}
        <div className="rounded-xl sm:rounded-2xl overflow-hidden shadow-xl bg-white border-2" style={{ borderColor: "rgba(5,163,199,0.2)" }}>
          {/* Card Header */}
          <div 
            className="p-4 sm:p-6 text-white"
            style={{
              background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
            }}
          >
            <h2 className="text-lg sm:text-xl font-black">Search Student Records</h2>
            <p className="opacity-90 text-xs sm:text-sm mt-1">View student data by branch and batch</p>
          </div>
          
          {/* Content */}
          <div className="p-4 sm:p-6">
            {/* Search Form */}
            <form onSubmit={onSubmit} className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block font-bold mb-1.5 sm:mb-2 text-sm sm:text-base text-[#1A1F29]">
                    Branch
                  </label>
                  <select 
                    className="w-full border-2 rounded-xl bg-white px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-[#1A1F29] font-medium outline-none focus:ring-4 focus:ring-[#05A3C7]/20 transition-all min-h-[44px]" 
                    style={{ borderColor: "rgba(5,163,199,0.3)" }}
                    value={branch} 
                    onChange={e => setBranch(e.target.value)}
                  >
                    <option value="">Select Branch</option>
                    <option value="Civil">Civil Engineering</option>
                    <option value="CSE">Computer Science Engineering</option>
                    <option value="ECE">Electronics & Communication Engineering</option>
                    <option value="EEE">Electrical & Electronics Engineering</option>
                    <option value="Mechanical">Mechanical Engineering</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1.5 sm:mb-2 text-sm sm:text-base text-[#1A1F29]">
                    Batch (Year)
                  </label>
                  <input 
                    className="w-full border-2 rounded-xl bg-white px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-[#1A1F29] font-medium outline-none focus:ring-4 focus:ring-[#05A3C7]/20 transition-all min-h-[44px]" 
                    style={{ borderColor: "rgba(5,163,199,0.3)" }}
                    placeholder="e.g., 2021 or 21" 
                    value={batch} 
                    onChange={e => setBatch(e.target.value)} 
                  />
                </div>
              </div>
              <div className="text-center">
                <button 
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl text-white font-black hover:shadow-lg active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 text-sm sm:text-base min-h-[44px] w-full sm:w-auto" 
                  style={{
                    background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                  }}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="inline-block w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    "Get Batch Data"
                  )}
                </button>
              </div>
            </form>

            {/* Alerts */}
            {error && (
              <div className="mt-3 sm:mt-4 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 px-3 sm:px-4 py-2.5 sm:py-3 font-medium flex items-center gap-3 text-sm sm:text-base">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0">
                  <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}
            {message && (
              <div className="mt-3 sm:mt-4 rounded-xl border-2 border-green-200 bg-green-50 text-green-700 px-3 sm:px-4 py-2.5 sm:py-3 font-medium flex items-center gap-3 text-sm sm:text-base">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0">
                  <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                </svg>
                {message}
              </div>
            )}

            {/* Results Section */}
            {rows.length > 0 && (
              <div className="mt-4 sm:mt-6">
                {/* Export Buttons */}
                <div className="rounded-xl sm:rounded-2xl p-3 sm:p-4 border-2 shadow-sm mb-4" style={{ borderColor: "rgba(5,163,199,0.2)", background: "rgba(5,163,199,0.05)" }}>
                  <h5 className="font-black mb-3 text-center text-sm sm:text-base" style={{ color: "#04748F" }}>
                    📥 Export Results ({count} records)
                  </h5>
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-center gap-2 sm:gap-3">
                    <button 
                      onClick={exportCSV} 
                      className="export-btn px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-white font-bold text-xs sm:text-sm hover:shadow-lg active:scale-95 transition-all min-h-[44px]" 
                      style={{ background: "linear-gradient(135deg,#28a745,#20c997)" }}
                    >
                      <span className="hidden xs:inline">💾 </span>CSV
                    </button>
                    <button 
                      onClick={exportExcel} 
                      className="export-btn px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-white font-bold text-xs sm:text-sm hover:shadow-lg active:scale-95 transition-all min-h-[44px]" 
                      style={{ background: "linear-gradient(135deg,#fd7e14,#ffc107)" }}
                    >
                      <span className="hidden xs:inline">📊 </span>Excel
                    </button>
                    <button 
                      onClick={exportPDF} 
                      className="export-btn px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-white font-bold text-xs sm:text-sm hover:shadow-lg active:scale-95 transition-all min-h-[44px]" 
                      style={{ background: "linear-gradient(135deg,#dc3545,#e83e8c)" }}
                    >
                      <span className="hidden xs:inline">📄 </span>PDF
                    </button>
                    <button 
                      onClick={() => window.print()} 
                      className="export-btn px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-white font-bold text-xs sm:text-sm hover:shadow-lg active:scale-95 transition-all min-h-[44px] col-span-2 sm:col-span-1" 
                      style={{ background: "linear-gradient(135deg,#6c757d,#495057)" }}
                    >
                      <span className="hidden xs:inline">🖨️ </span>Print
                    </button>
                  </div>
                </div>

                {/* Mobile Card View */}
                <div className="block lg:hidden space-y-3">
                  {rows.map((r, i) => (
                    <div 
                      key={i} 
                      className="rounded-xl border-2 bg-white p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow"
                      style={{ borderColor: "rgba(5,163,199,0.2)" }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm sm:text-base mb-0.5" style={{ color: "#05A3C7" }}>
                            {r.Reg_No}
                          </div>
                          <div className="text-[#1A1F29] font-semibold text-xs sm:text-sm truncate">
                            {r.Name}
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-2">
                          <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold text-white" style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}>
                            Sem {r.Sem}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-2 pt-2 border-t-2" style={{ borderColor: "rgba(5,163,199,0.1)" }}>
                        <div className="text-[#1A1F29] font-medium text-xs sm:text-sm mb-1.5">
                          {r.Subject_Name}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <code className="text-[#05A3C7] bg-[#05A3C7]/10 px-2 py-1 rounded font-bold">
                            {r.Subject_Code}
                          </code>
                          <span className="text-[#5A6C7D]">
                            Credits: <span className="font-bold text-[#1A1F29]">{computeCreditsSum(r.Credits)}</span>
                          </span>
                          <span className="ml-auto px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-bold">
                            {r.Grade}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-auto rounded-xl sm:rounded-2xl border-2 shadow-sm" style={{ borderColor: "rgba(5,163,199,0.2)" }}>
                  <table className="w-full min-w-[900px]">
                    <thead>
                      <tr style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}>
                        {['Reg No','Name','Semester','Subject Code','Subject Name','Credits','Grade'].map(h => (
                          <th key={h} className="px-3 sm:px-4 py-3 text-white text-left text-xs sm:text-sm font-black uppercase tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className="border-b-2 hover:bg-[#05A3C7]/5 transition-colors" style={{ borderColor: "rgba(5,163,199,0.1)" }}>
                          <td className="px-3 sm:px-4 py-3 font-bold text-sm" style={{ color: "#05A3C7" }}>{r.Reg_No}</td>
                          <td className="px-3 sm:px-4 py-3 text-[#1A1F29] font-medium text-sm">{r.Name}</td>
                          <td className="px-3 sm:px-4 py-3 text-sm text-center">
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white" style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}>
                              {r.Sem}
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-sm">
                            <code className="bg-[#05A3C7]/10 text-[#05A3C7] px-2 py-1 rounded text-xs font-bold">
                              {r.Subject_Code}
                            </code>
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-[#1A1F29] font-medium text-sm">{r.Subject_Name}</td>
                          <td className="px-3 sm:px-4 py-3 text-sm text-center font-bold text-[#1A1F29]">{computeCreditsSum(r.Credits)}</td>
                          <td className="px-3 sm:px-4 py-3 text-center">
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
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
              <span className="text-white font-bold text-sm sm:text-base">Loading batch data...</span>
            </div>
          </div>
        )}
      </div>
      
      <style jsx global>{`
        @media print {
          a[href], button { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function computeCreditsSum(credits) {
  if (credits === null || credits === undefined) return "";
  const s = String(credits).trim();
  if (s === "") return "";
  if (/^\d+(\.\d+)?$/.test(s)) {
    const num = parseFloat(s);
    return Number.isInteger(num) ? String(Math.floor(num)) : String(num);
  }
  const parts = s.split(/[+\s]+/).map(p => p.trim()).filter(Boolean);
  const sum = parts.reduce((acc, p) => acc + (parseFloat(p) || 0), 0);
  return Number.isFinite(sum) ? (Number.isInteger(sum) ? String(Math.floor(sum)) : String(sum)) : s;
}

function escapeCsv(val) {
  const s = String(val ?? "");
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
  return s;
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
