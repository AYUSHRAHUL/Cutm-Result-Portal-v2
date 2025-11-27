"use client";

import React, { useMemo, useState } from "react";

export default function AdminBatchPage() {
  const [branch, setBranch] = useState("");
  const [batch, setBatch] = useState("");
  const [rows, setRows] = useState([]);
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
    setMessage(""); setError(""); setRows([]); setCount(0);
    setExpandedStudents(new Set());
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

  // Group records by student
  const studentSummary = useMemo(() => {
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
    return Object.values(grouped);
  }, [rows]);

  // Toggle expand/collapse
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

  // Open edit modal
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

  // Close edit modal
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

  // Refresh data
  const refreshData = async () => {
    if (!branch && !batch) return;
    setMessage(""); setError(""); setRows([]); setCount(0);
    setExpandedStudents(new Set());
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
  };

  // Update record
  const handleUpdateRecord = async (e) => {
    e.preventDefault();
    if (!editingRecord) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/students", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Reg_No: editForm.Reg_No,
          Subject_Code: editForm.Subject_Code,
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

  // Delete record
  const handleDeleteRecord = async (record) => {
    if (!confirm(`Are you sure you want to delete this record?\n${record.Subject_Code} - ${record.Subject_Name}`)) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/students", {
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

  // Delete all records for a student
  const handleDeleteStudent = async (student) => {
    if (!confirm(`Are you sure you want to delete ALL records for ${student.Name} (${student.Reg_No})?\n\nThis will delete ${student.totalSubjects} subject record(s). This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      // Delete all subjects for this student
      const deletePromises = student.subjects.map(subject =>
        fetch("/api/students", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            Reg_No: subject.Reg_No,
            Subject_Code: subject.Subject_Code,
            Sem: subject.Sem
          })
        })
      );

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
                    <option value="AIML">AIML</option>
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

            {/* Results Section - Summary View */}
            {studentSummary.length > 0 && (
              <div className="mt-4 sm:mt-6">
                {/* Summary Table */}
                <div className="overflow-auto rounded-xl sm:rounded-2xl border-2 shadow-sm" style={{ borderColor: "rgba(5,163,199,0.2)" }}>
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}>
                        <th className="px-3 sm:px-4 py-3 text-white text-left text-xs sm:text-sm font-black uppercase tracking-wider">Reg No</th>
                        <th className="px-3 sm:px-4 py-3 text-white text-left text-xs sm:text-sm font-black uppercase tracking-wider">Name</th>
                        <th className="px-3 sm:px-4 py-3 text-white text-center text-xs sm:text-sm font-black uppercase tracking-wider">Total Subjects</th>
                        <th className="px-3 sm:px-4 py-3 text-white text-center text-xs sm:text-sm font-black uppercase tracking-wider">Total Credits</th>
                        <th className="px-3 sm:px-4 py-3 text-white text-center text-xs sm:text-sm font-black uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentSummary.map((student, i) => (
                        <React.Fragment key={student.Reg_No}>
                          <tr 
                            className="border-b-2 hover:bg-[#05A3C7]/5 transition-colors cursor-pointer" 
                            style={{ borderColor: "rgba(5,163,199,0.1)" }}
                            onClick={() => toggleExpand(student.Reg_No)}
                          >
                            <td className="px-3 sm:px-4 py-3 font-bold text-sm" style={{ color: "#05A3C7" }}>{student.Reg_No}</td>
                            <td className="px-3 sm:px-4 py-3 text-[#1A1F29] font-medium text-sm">{student.Name}</td>
                            <td className="px-3 sm:px-4 py-3 text-sm text-center font-bold text-[#1A1F29]">{student.totalSubjects}</td>
                            <td className="px-3 sm:px-4 py-3 text-sm text-center font-bold text-[#1A1F29]">{student.totalCredits.toFixed(1)}</td>
                            <td className="px-3 sm:px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-xs text-[#5A6C7D] cursor-pointer">
                                  {expandedStudents.has(student.Reg_No) ? "▼" : "▶"}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteStudent(student);
                                  }}
                                  className="px-2 py-1 rounded bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-all"
                                  title="Delete all records for this student"
                                  disabled={loading}
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expandedStudents.has(student.Reg_No) && (
                            <tr key={`${student.Reg_No}-expanded`}>
                              <td colSpan="5" className="px-0 py-0 bg-gray-50">
                                <div className="p-4">
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs sm:text-sm">
                                      <thead>
                                        <tr style={{ background: "rgba(5,163,199,0.1)" }}>
                                          <th className="px-2 py-2 text-left font-bold">Sem</th>
                                          <th className="px-2 py-2 text-left font-bold">Subject Code</th>
                                          <th className="px-2 py-2 text-left font-bold">Subject Name</th>
                                          <th className="px-2 py-2 text-center font-bold">Credits</th>
                                          <th className="px-2 py-2 text-center font-bold">Grade</th>
                                          <th className="px-2 py-2 text-center font-bold">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {student.subjects.map((subject, idx) => (
                                          <tr key={`${student.Reg_No}-${subject.Subject_Code}-${subject.Sem || idx}`} className="border-b hover:bg-white">
                                            <td className="px-2 py-2">
                                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}>
                                                {subject.Sem}
                            </span>
                          </td>
                                            <td className="px-2 py-2 font-mono text-green-600 font-bold">{subject.Subject_Code}</td>
                                            <td className="px-2 py-2 text-[#1A1F29]">{subject.Subject_Name}</td>
                                            <td className="px-2 py-2 text-center font-bold">{computeCreditsSum(subject.Credits)}</td>
                                            <td className="px-2 py-2 text-center">
                                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                                                {subject.Grade}
                            </span>
                                            </td>
                                            <td className="px-2 py-2">
                                              <div className="flex items-center justify-center gap-1">
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    openEditModal(subject);
                                                  }}
                                                  className="px-2 py-1 rounded text-white text-[10px] font-bold hover:shadow-md transition-all"
                                                  style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                                                >
                                                  ✏️
                                                </button>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteRecord(subject);
                                                  }}
                                                  className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-bold hover:bg-red-700 transition-all"
                                                >
                                                  🗑️
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                          </td>
                        </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Edit Modal */}
        {editingRecord && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h3 className="text-lg sm:text-xl font-black text-[#1A1F29] flex items-center gap-2">
                  ✏️ Edit Record
                </h3>
                <button
                  onClick={closeEditModal}
                  className="text-[#5A6C7D] hover:text-[#1A1F29] text-2xl sm:text-3xl font-bold w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleUpdateRecord} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-[#1A1F29] mb-2">Registration Number</label>
                    <input
                      type="text"
                      disabled
                      className="w-full rounded-xl border-2 bg-gray-100 px-3 sm:px-4 py-2.5 sm:py-3 outline-none text-[#5A6C7D] font-medium text-sm sm:text-base min-h-[44px] cursor-not-allowed"
                      style={{ borderColor: "rgba(5,163,199,0.3)" }}
                      value={editForm.Reg_No}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#1A1F29] mb-2">Subject Code</label>
                    <input
                      type="text"
                      disabled
                      className="w-full rounded-xl border-2 bg-gray-100 px-3 sm:px-4 py-2.5 sm:py-3 outline-none text-[#5A6C7D] font-medium text-sm sm:text-base min-h-[44px] cursor-not-allowed"
                      style={{ borderColor: "rgba(5,163,199,0.3)" }}
                      value={editForm.Subject_Code}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-bold text-[#1A1F29] mb-2">Subject Name</label>
                    <input
                      type="text"
                      disabled
                      className="w-full rounded-xl border-2 bg-gray-100 px-3 sm:px-4 py-2.5 sm:py-3 outline-none text-[#5A6C7D] font-medium text-sm sm:text-base min-h-[44px] cursor-not-allowed"
                      style={{ borderColor: "rgba(5,163,199,0.3)" }}
                      value={editForm.Subject_Name}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#1A1F29] mb-2">Semester</label>
                    <input
                      type="text"
                      disabled
                      className="w-full rounded-xl border-2 bg-gray-100 px-3 sm:px-4 py-2.5 sm:py-3 outline-none text-[#5A6C7D] font-medium text-sm sm:text-base min-h-[44px] cursor-not-allowed"
                      style={{ borderColor: "rgba(5,163,199,0.3)" }}
                      value={editForm.Sem}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#1A1F29] mb-2">Grade *</label>
                    <select
                      required
                      className="w-full rounded-xl border-2 bg-white px-3 sm:px-4 py-2.5 sm:py-3 outline-none focus:ring-4 focus:ring-[#05A3C7]/20 text-[#1A1F29] font-medium text-sm sm:text-base min-h-[44px]"
                      style={{ borderColor: "rgba(5,163,199,0.3)" }}
                      value={editForm.Grade}
                      onChange={e => setEditForm({ ...editForm, Grade: e.target.value })}
                    >
                      <option value="">Select Grade</option>
                      {["O","E","A","B","C","D","F","S","M","I","R"].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {message && message.includes("updated") && (
                  <div className="rounded-lg p-3 sm:p-4 bg-green-50 border-2 border-green-200 text-green-700">
                    <div className="font-bold text-sm sm:text-base">✅ Success</div>
                    <div className="text-xs sm:text-sm mt-1">{message}</div>
                  </div>
                )}
                {error && (
                  <div className="rounded-lg p-3 sm:p-4 bg-red-50 border-2 border-red-200 text-red-700">
                    <div className="font-bold text-sm sm:text-base">⚠️ Error</div>
                    <div className="text-xs sm:text-sm mt-1">{error}</div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="flex-1 px-4 py-2.5 rounded-xl border-2 text-[#1A1F29] font-bold text-sm sm:text-base hover:bg-gray-50 transition-all min-h-[44px]"
                    style={{ borderColor: "rgba(5,163,199,0.3)" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2.5 rounded-xl text-white font-bold text-sm sm:text-base hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                    style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                  >
                    {loading ? "Updating..." : "Update Record"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && !editingRecord && (
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
