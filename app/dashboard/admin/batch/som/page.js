"use client";

import React, { useMemo, useState } from "react";
import { appendSchoolParams, getSchoolApiUrl } from "@/lib/api-helper";

export default function SOMBatchPage() {
  const [branch, setBranch] = useState("");
  const [batch, setBatch] = useState("");
  const [rows, setRows] = useState([]);
  const [studentSummaryData, setStudentSummaryData] = useState([]);
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState(new Set());
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({
    Reg_No: "",
    Subject_Code: "",
    Subject_Name: "",
    Credits: "",
    Sem: "",
    Grade: ""
  });

  async function onSubmit(e) {
    e.preventDefault();
    setMessage(""); setError(""); setRows([]); setCount(0); setStudentSummaryData([]);
    setExpandedStudents(new Set());
    try {
      setLoading(true);
      const baseUrl = getSchoolApiUrl("batch");
      const batchUrl = baseUrl.includes("?") ? `${baseUrl}&mode=summary` : `${baseUrl}?mode=summary`;
      const res = await fetch(batchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch, batch })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No data found");
      const students = data.students || [];
      const records = data.records || data.result || [];
      setRows(records);
      setStudentSummaryData(students);
      setCount(records.length);
      setMessage(data.message || `${records.length} records loaded`);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  const studentSummary = useMemo(() => {
    if (studentSummaryData.length > 0) {
      return studentSummaryData;
    }
    const grouped = {};
    rows.forEach(record => {
      const regNo = record.Reg_No;
      if (!grouped[regNo]) {
        grouped[regNo] = {
          Reg_No: regNo,
          Name: record.Name || "",
          subjects: [],
          totalSubjects: 0,
          totalCredits: 0
        };
      }
      grouped[regNo].subjects.push(record);
      grouped[regNo].totalSubjects++;
      const credits = computeCreditsSum(record.Credits);
      grouped[regNo].totalCredits += parseFloat(credits) || 0;
    });

    const sorted = Object.values(grouped).sort((a, b) =>
      String(a.Reg_No || "").localeCompare(String(b.Reg_No || ""), undefined, { numeric: true })
    );

    // Sort subjects inside each student for consistent display
    sorted.forEach(student => {
      student.subjects = student.subjects
        .slice()
        .sort((x, y) => {
          const regCmp = String(x.Reg_No || "").localeCompare(String(y.Reg_No || ""), undefined, { numeric: true });
          if (regCmp !== 0) return regCmp;
          const semCmp = String(x.Sem || "").localeCompare(String(y.Sem || ""), undefined, { numeric: true });
          if (semCmp !== 0) return semCmp;
          return String(x.Subject_Code || "").localeCompare(String(y.Subject_Code || ""), undefined, { numeric: true });
        });
    });

    return sorted;
  }, [rows, studentSummaryData]);

  const toggleExpand = (regNo) => {
    setExpandedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(regNo)) {
        newSet.delete(regNo);
      } else {
        newSet.add(regNo);
      }
      return newSet;
    });
  };

  const openEditModal = (record) => {
    setEditingRecord(record);
    setEditForm({
      Reg_No: record.Reg_No || "",
      Subject_Code: record.Subject_Code || "",
      Subject_Name: record.Subject_Name || "",
      Credits: record.Credits || "",
      Sem: record.Sem || "",
      Grade: record.Grade || ""
    });
  };

  const closeEditModal = () => {
    setEditingRecord(null);
    setEditForm({
      Reg_No: "",
      Subject_Code: "",
      Subject_Name: "",
      Credits: "",
      Sem: "",
      Grade: ""
    });
  };

  const refreshData = async () => {
    if (!branch && !batch) return;
    setMessage(""); setError(""); setRows([]); setCount(0); setStudentSummaryData([]);
    setExpandedStudents(new Set());
    try {
      setLoading(true);
      const baseUrl = getSchoolApiUrl("batch");
      const batchUrl = baseUrl.includes("?") ? `${baseUrl}&mode=summary` : `${baseUrl}?mode=summary`;
      const res = await fetch(batchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch, batch })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No data found");
      const students = data.students || [];
      const records = data.records || data.result || [];
      setRows(records);
      setStudentSummaryData(students);
      setCount(records.length);
      setMessage(data.message || `${records.length} records loaded`);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const handleUpdateRecord = async (e) => {
    e.preventDefault();
    if (!editingRecord) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const studentsUrl = getSchoolApiUrl("students");
      const res = await fetch(studentsUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Reg_No: editForm.Reg_No,
          Subject_Code: editForm.Subject_Code,
          Sem: editForm.Sem,
          Grade: editForm.Grade
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update record");
      setMessage("Record updated successfully");
      closeEditModal();
      await refreshData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async (record) => {
    if (!confirm(`Are you sure you want to delete this record?\n${record.Subject_Code} - ${record.Subject_Name}`)) {
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const studentsUrl = getSchoolApiUrl("students");
      const res = await fetch(studentsUrl, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Reg_No: record.Reg_No,
          Subject_Code: record.Subject_Code,
          Sem: record.Sem
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete record");
      setMessage("Record deleted successfully");
      await refreshData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStudent = async (student) => {
    if (!confirm(`Are you sure you want to delete ALL records for ${student.Name} (${student.Reg_No})?\n\nThis will delete ${student.totalSubjects} subject record(s). This action cannot be undone.`)) {
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const deletePromises = student.subjects.map(subject => {
        const studentsUrl = getSchoolApiUrl("students");
        return fetch(studentsUrl, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            Reg_No: subject.Reg_No,
            Subject_Code: subject.Subject_Code,
            Sem: subject.Sem
          })
        });
      });
      const results = await Promise.all(deletePromises);
      const errors = results.filter(r => !r.ok);
      if (errors.length > 0) {
        throw new Error(`Failed to delete some records. ${errors.length} record(s) could not be deleted.`);
      }
      setMessage(`Successfully deleted all ${student.totalSubjects} record(s) for ${student.Name}`);
      await refreshData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  function computeCreditsSum(credits) {
    return credits;
  }

  function escapeCsv(s) {
    if (s == null) return "";
    if (typeof s === "number") return String(s);
    s = String(s);
    if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
      return "\"" + s.replace(/"/g, "\"\"") + "\"";
    }
    return s;
  }

  function downloadBlob(text, filename, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    downloadBlob(csv, `soet_batch_${branch || "all"}_${batch || "all"}.csv`, "text/csv;charset=utf-8;");
  }

  function exportExcel() {
    if (rows.length === 0) return;
    const header = ["Reg No","Name","Semester","Subject Code","Subject Name","Credits","Grade"];
    const table = [header].concat(rows.map(r => [r.Reg_No,r.Name,r.Sem,r.Subject_Code,r.Subject_Name,computeCreditsSum(r.Credits),r.Grade]));
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><table>${table.map(row => `<tr>${row.map(c => `<td>${String(c ?? "").toString().replace(/&/g,'&amp;').replace(/</g,'&lt;')}</td>`).join("")}</tr>`).join("")}</table></body></html>`;
    downloadBlob(html, `soet_batch_${branch || "all"}_${batch || "all"}.xls`, "application/vnd.ms-excel");
  }

  async function exportPDF() {
    if (rows.length === 0) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const rowsHtml = rows.map(r => `<tr><td>${r.Reg_No}</td><td>${r.Name}</td><td>${r.Sem}</td><td>${r.Subject_Code}</td><td>${r.Subject_Name}</td><td>${computeCreditsSum(r.Credits)}</td><td>${r.Grade}</td></tr>`).join("");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>SOET Batch Export</title><style>table{width:100%;border-collapse:collapse}td,th{border:1px solid #000;padding:6px;text-align:left}th{background:#eee}</style></head><body><h2>SOET Batch Data</h2><p>Generated: ${new Date().toLocaleString()}</p><table><thead><tr><th>Reg No</th><th>Name</th><th>Sem</th><th>Subject Code</th><th>Subject Name</th><th>Credits</th><th>Grade</th></tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`);
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
            🏫 SOM Batch Data Portal
          </h1>
          <p className="text-gray-600 mt-2">School of Management</p>
        </div>

        <div className="rounded-xl sm:rounded-2xl overflow-hidden shadow-xl bg-white border-2" style={{ borderColor: "rgba(5,163,199,0.2)" }}>
          <div 
            className="p-4 sm:p-6 text-white"
            style={{
              background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
            }}
          >
            <h2 className="text-lg sm:text-xl font-black">Search SOM Student Records</h2>
            <p className="opacity-90 text-xs sm:text-sm mt-1">View SOM student data by branch and batch</p>
          </div>
          
          <div className="p-4 sm:p-6">
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
                    <option value="BBA">BBA</option>
                    <option value="MBA">MBA</option>
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
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl text-white font-black hover:shadow-lg active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 text-sm sm:text-base min-h-[44px] w-full sm:w-auto" 
                  style={{
                    background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                  }}
                >
                  {loading ? "Loading..." : "Get SOM Batch Data"}
                </button>
              </div>
            </form>

            {message && (
              <div className="mb-4 p-3 sm:p-4 rounded-lg bg-green-50 border-l-4 border-green-500 text-green-800 text-sm sm:text-base">
                ✓ {message}
              </div>
            )}
            {error && (
              <div className="mb-4 p-3 sm:p-4 rounded-lg bg-red-50 border-l-4 border-red-500 text-red-800 text-sm sm:text-base">
                ✗ {error}
              </div>
            )}

            {studentSummary.length > 0 && (
              <div className="mt-6">
                <div className="flex flex-wrap gap-2 sm:gap-3 mb-4 justify-center sm:justify-start">
                  <button onClick={exportCSV} className="px-3 sm:px-4 py-2 bg-blue-500 text-white rounded-lg text-xs sm:text-sm font-bold hover:bg-blue-600">📥 CSV</button>
                  <button onClick={exportExcel} className="px-3 sm:px-4 py-2 bg-green-500 text-white rounded-lg text-xs sm:text-sm font-bold hover:bg-green-600">📊 Excel</button>
                  <button onClick={exportPDF} className="px-3 sm:px-4 py-2 bg-red-500 text-white rounded-lg text-xs sm:text-sm font-bold hover:bg-red-600">📄 PDF</button>
                  <button onClick={refreshData} disabled={loading} className="px-3 sm:px-4 py-2 bg-gray-500 text-white rounded-lg text-xs sm:text-sm font-bold hover:bg-gray-600 disabled:opacity-50">🔄 Refresh</button>
                </div>

                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
                  📊 {count} Records from {studentSummary.length} Students
                </h3>

                <div className="space-y-3">
                  {studentSummary.map(student => (
                    <div key={student.Reg_No} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition">
                      <button
                        onClick={() => toggleExpand(student.Reg_No)}
                        className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 transition flex justify-between items-center"
                      >
                        <div className="text-left">
                          <p className="font-bold text-gray-900 text-sm sm:text-base">{student.Name}</p>
                          <p className="text-xs sm:text-sm text-gray-600">
                            {student.Reg_No} • Batch {student.Batch}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
                            {student.totalSubjects} Subjects
                          </span>
                          <span className="text-lg sm:text-xl">
                            {expandedStudents.has(student.Reg_No) ? "▼" : "▶"}
                          </span>
                        </div>
                      </button>

                      {expandedStudents.has(student.Reg_No) && (
                        <div className="p-4 sm:p-6 bg-white border-t border-gray-200">
                          <table className="w-full text-xs sm:text-sm">
                            <thead>
                              <tr className="border-b-2 border-gray-200">
                                <th className="text-left py-2 px-2 font-semibold text-gray-700">Code</th>
                                <th className="text-left py-2 px-2 font-semibold text-gray-700">Subject</th>
                                <th className="text-center py-2 px-2 font-semibold text-gray-700">Sem</th>
                                <th className="text-center py-2 px-2 font-semibold text-gray-700">Credits</th>
                                <th className="text-center py-2 px-2 font-semibold text-gray-700">Grade</th>
                                <th className="text-center py-2 px-2 font-semibold text-gray-700">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {student.subjects.map((subj, idx) => (
                                <tr key={idx} className="border-b hover:bg-gray-50">
                                  <td className="py-2 px-2 font-mono text-gray-900">{subj.Subject_Code}</td>
                                  <td className="py-2 px-2 text-gray-700">{subj.Subject_Name}</td>
                                  <td className="text-center py-2 px-2 text-gray-700">{subj.Sem}</td>
                                  <td className="text-center py-2 px-2 text-gray-700">{subj.Credits}</td>
                                  <td className="text-center py-2 px-2">
                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-bold text-xs">
                                      {subj.Grade}
                                    </span>
                                  </td>
                                  <td className="text-center py-2 px-2 space-x-1">
                                    <button onClick={() => openEditModal(subj)} className="text-blue-600 hover:text-blue-800 text-xs">✏️</button>
                                    <button onClick={() => handleDeleteRecord(subj)} className="text-red-600 hover:text-red-800 text-xs">🗑️</button>
                                  </td>
                                </tr>
                              ))}
                              <tr className="bg-gray-50 font-bold">
                                <td colSpan="3" className="text-right py-2 px-2">Total Credits:</td>
                                <td className="text-center py-2 px-2">{student.totalCredits}</td>
                                <td colSpan="2" className="text-center py-2 px-2">
                                  <button onClick={() => handleDeleteStudent(student)} className="text-red-600 hover:text-red-800 font-bold text-xs">Delete All</button>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && rows.length === 0 && message && (
              <div className="text-center py-8 text-gray-500">
                No records found. Try different filters.
              </div>
            )}
          </div>
        </div>
      </div>

      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
            <div 
              className="p-5 sm:p-6 text-white"
              style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black">Edit Grade</h3>
                <button onClick={closeEditModal} className="text-white hover:text-red-200 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
              <p className="opacity-90 text-sm mt-1">{editForm.Reg_No} - {editForm.Subject_Name}</p>
            </div>
            
            <form onSubmit={handleUpdateRecord} className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Subject Code</label>
                <input 
                  type="text" 
                  className="w-full border-2 border-gray-200 rounded-xl bg-gray-50 px-4 py-2.5 text-gray-600 font-mono text-sm cursor-not-allowed" 
                  value={editForm.Subject_Code} 
                  disabled 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Semester</label>
                  <input 
                    type="text" 
                    className="w-full border-2 border-gray-200 rounded-xl bg-gray-50 px-4 py-2.5 text-gray-600 font-bold text-sm cursor-not-allowed" 
                    value={editForm.Sem} 
                    disabled 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Credits</label>
                  <input 
                    type="text" 
                    className="w-full border-2 border-gray-200 rounded-xl bg-gray-50 px-4 py-2.5 text-gray-600 font-bold text-sm cursor-not-allowed" 
                    value={editForm.Credits} 
                    disabled 
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Grade</label>
                <input 
                  type="text" 
                  className="w-full border-2 border-[#05A3C7]/30 focus:border-[#05A3C7] rounded-xl bg-white px-4 py-2.5 text-gray-900 font-bold outline-none focus:ring-4 focus:ring-[#05A3C7]/10 transition-all uppercase" 
                  value={editForm.Grade}
                  onChange={(e) => setEditForm({...editForm, Grade: e.target.value.toUpperCase()})}
                  placeholder="e.g. O, E, A, B, C, D, F, S, M, I, R"
                  pattern="^[OEABCDFSMIRoeabcdfsmir]$"
                  title="Valid grades: O, E, A, B, C, D, F, S, M, I, R"
                  required
                />
              </div>
              
              <div className="pt-4 flex flex-col-reverse sm:flex-row justify-end gap-3">
                <button 
                  type="button" 
                  onClick={closeEditModal}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-gray-600 font-bold hover:bg-gray-100 transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-white font-bold disabled:opacity-50 hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : "Save Grade"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
