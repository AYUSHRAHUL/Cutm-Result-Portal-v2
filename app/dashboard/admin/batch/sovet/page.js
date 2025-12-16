"use client";

import { useState, useMemo } from "react";
import { getSchoolApiUrl } from "@/lib/api-helper";

export default function SOVETBatchPage() {
  const [branch, setBranch] = useState("");
  const [batch, setBatch] = useState("");
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
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
    
    if (!branch || !batch) {
      setError("Please select both branch and batch");
      return;
    }
    
    try {
      setLoading(true);
      const batchUrl = getSchoolApiUrl("batch");
      const res = await fetch(batchUrl, {
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
      const credits = record.Credits || 0;
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
    
    // Note: Diploma branches are now handled by the backend API
    
    try {
      setLoading(true);
      const res = await fetch(getSchoolApiUrl("batch"), {
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
      const res = await fetch(getSchoolApiUrl("students"), {
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
  const handleDeleteRecord = async (regNo, subjectCode, sem) => {
    if (!confirm("Are you sure you want to delete this subject record?")) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(getSchoolApiUrl("students"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Reg_No: regNo, Subject_Code: subjectCode, Sem: sem })
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

  // Delete student
  const handleDeleteStudent = async (regNo) => {
    if (!confirm(`Are you sure you want to delete all records for ${regNo}?`)) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(getSchoolApiUrl("students"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Reg_No: regNo })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete student");

      setMessage("Student deleted successfully");
      await refreshData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Export functions
  const exportCSV = () => {
    if (rows.length === 0) return;
    const headers = ["Reg_No", "Name", "Program", "Batch", "Sem", "Subject_Code", "Subject_Name", "Credits", "Grade"];
    const csv = [
      headers.join(","),
      ...rows.map(r => headers.map(h => `"${r[h] || ""}"`).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sovet_batch_${branch}_${batch}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    if (rows.length === 0) return;
    const headers = ["Reg_No", "Name", "Program", "Batch", "Sem", "Subject_Code", "Subject_Name", "Credits", "Grade"];
    let html = "<table><tr>" + headers.map(h => `<th>${h}</th>`).join("") + "</tr>";
    rows.forEach(r => {
      html += "<tr>" + headers.map(h => `<td>${r[h] || ""}</td>`).join("") + "</tr>";
    });
    html += "</table>";
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sovet_batch_${branch}_${batch}.xls`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    if (rows.length === 0) return;
    let text = `SOVET Batch Data - ${branch} (${batch})\n\n`;
    rows.forEach(r => {
      text += `${r.Reg_No} - ${r.Name} - ${r.Subject_Name} - Grade: ${r.Grade}\n`;
    });
    const blob = new Blob([text], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sovet_batch_${branch}_${batch}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-3 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div 
            className="p-4 sm:p-6 text-white"
            style={{
              background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
            }}
          >
            <h2 className="text-lg sm:text-xl font-black">🏫 SOVET Batch Data Portal</h2>
            <p className="opacity-90 text-xs sm:text-sm mt-1">School of Vocational Engineering Technology</p>
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
                    <optgroup label="Diploma Programs">
                      <option value="Electrical">Diploma in Electrical Engineering</option>
                      <option value="Mechanical">Diploma in Mechanical Engineering</option>
                      <option value="Civil">Diploma in Civil Engineering</option>
                      <option value="CSE">Diploma in Computer Science Engineering</option>
                      <option value="Automobile">Diploma in Automobile Engineering</option>
                      <option value="Mining">Diploma in Mining Engineering</option>
                    </optgroup>
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
            {studentSummary.length > 0 && (
              <div className="mt-4 sm:mt-6">
                <div className="flex justify-between items-center mb-3 sm:mb-4">
                  <h3 className="font-bold text-sm sm:text-base text-[#1A1F29]">
                    Results: {count} Records, {studentSummary.length} Students
                  </h3>
                  <div className="flex gap-2 flex-wrap justify-end">
                    <button onClick={exportCSV} className="px-3 sm:px-4 py-2 text-xs sm:text-sm bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600">
                      Export CSV
                    </button>
                    <button onClick={exportExcel} className="px-3 sm:px-4 py-2 text-xs sm:text-sm bg-green-500 text-white rounded-lg font-bold hover:bg-green-600">
                      Export Excel
                    </button>
                    <button onClick={exportPDF} className="px-3 sm:px-4 py-2 text-xs sm:text-sm bg-red-500 text-white rounded-lg font-bold hover:bg-red-600">
                      Export PDF
                    </button>
                    <button onClick={refreshData} className="px-3 sm:px-4 py-2 text-xs sm:text-sm bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600">
                      Refresh
                    </button>
                  </div>
                </div>

                {/* Students List */}
                <div className="space-y-2 sm:space-y-3">
                  {studentSummary.map(student => (
                    <div key={student.Reg_No} className="border-2 border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                      <button
                        type="button"
                        onClick={() => toggleExpand(student.Reg_No)}
                        className="w-full text-left p-3 sm:p-4 hover:bg-slate-100 transition-colors flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-sm sm:text-base text-[#1A1F29]">
                            {student.Reg_No} - {student.Name}
                          </p>
                          <p className="text-xs sm:text-sm text-slate-600">
                            {student.totalSubjects} Subjects | Total Credits: {student.totalCredits}
                          </p>
                        </div>
                        <span className="text-2xl text-slate-400">
                          {expandedStudents.has(student.Reg_No) ? "−" : "+"}
                        </span>
                      </button>

                      {expandedStudents.has(student.Reg_No) && (
                        <div className="border-t-2 border-slate-200 bg-white">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs sm:text-sm">
                              <thead>
                                <tr className="bg-slate-100">
                                  <th className="p-2 sm:p-3 text-left font-bold">Subject Code</th>
                                  <th className="p-2 sm:p-3 text-left font-bold">Subject Name</th>
                                  <th className="p-2 sm:p-3 text-left font-bold">Credits</th>
                                  <th className="p-2 sm:p-3 text-left font-bold">Grade</th>
                                  <th className="p-2 sm:p-3 text-left font-bold">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {student.subjects.map((subject, idx) => (
                                  <tr key={idx} className="border-t border-slate-200 hover:bg-slate-50">
                                    <td className="p-2 sm:p-3">{subject.Subject_Code}</td>
                                    <td className="p-2 sm:p-3">{subject.Subject_Name}</td>
                                    <td className="p-2 sm:p-3">{subject.Credits}</td>
                                    <td className="p-2 sm:p-3 font-bold">{subject.Grade}</td>
                                    <td className="p-2 sm:p-3">
                                      <button
                                        onClick={() => openEditModal(subject)}
                                        className="text-blue-600 hover:underline mr-2 font-bold"
                                      >
                                        Edit
                                      </button>
                                      <button
                                      onClick={() => handleDeleteRecord(student.Reg_No, subject.Subject_Code, subject.Sem)}
                                        className="text-red-600 hover:underline font-bold"
                                      >
                                        Delete
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="p-3 sm:p-4 border-t border-slate-200 flex justify-end">
                            <button
                              onClick={() => handleDeleteStudent(student.Reg_No)}
                              className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-red-600 text-white rounded-lg font-bold hover:bg-red-700"
                            >
                              Delete All Records
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rows.length === 0 && message && (
              <div className="mt-4 sm:mt-6 text-center p-4 sm:p-6 bg-slate-50 rounded-xl">
                <p className="text-slate-600 text-sm sm:text-base">Select branch and batch, then click "Get Batch Data" to view records</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Edit Record</h3>
            <form onSubmit={handleUpdateRecord} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1">Registration Number</label>
                <input
                  type="text"
                  value={editForm.Reg_No}
                  disabled
                  className="w-full border-2 rounded-lg px-3 py-2 bg-gray-100 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Subject Code</label>
                <input
                  type="text"
                  value={editForm.Subject_Code}
                  disabled
                  className="w-full border-2 rounded-lg px-3 py-2 bg-gray-100 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Grade</label>
                <select
                  value={editForm.Grade}
                  onChange={e => setEditForm({ ...editForm, Grade: e.target.value })}
                  className="w-full border-2 rounded-lg px-3 py-2"
                >
                  <option value="">Select Grade</option>
                  <option value="O">O</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="F">F</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 rounded-lg bg-gray-300 font-bold hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-500 text-white font-bold hover:bg-blue-600"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
