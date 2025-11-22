"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";

export default function HonoursStudentsPage() {
  // Core state
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Filters
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("");
  const [batch, setBatch] = useState("");
  const [availableBranches, setAvailableBranches] = useState([]);
  const [availableBatches, setAvailableBatches] = useState([]);
  const [filterStatus, setFilterStatus] = useState("all"); // "all", "eligible", "notEligible"

  // Results
  const [checkResults, setCheckResults] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // Auto-dismiss messages
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Fetch saved students
  const fetchStudents = useCallback(async () => {
    setError("");
    try {
      setLoading(true);
      const qs = new URLSearchParams({ 
        branch, 
        search, 
        limit: "0" 
      }).toString();
      const res = await fetch(`/api/honours/students?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setStudents(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally { 
      setLoading(false); 
    }
  }, [branch, search]);

  // Fetch filter options
  const fetchFilters = useCallback(async () => {
    try {
      const res = await fetch("/api/honours/students/filters");
      const data = await res.json();
      if (res.ok && data.success) {
        setAvailableBranches(data.branches || []);
        setAvailableBatches(data.batches || []);
      }
    } catch (err) {
      console.error("Error fetching filters:", err);
    }
  }, []);

  // Check eligibility
  const checkEligibility = useCallback(async () => {
    setError("");
    setSuccess("");
    setCheckResults(null);
    setCurrentPage(1);
    
    if (!branch && !batch) {
      setError("Please select at least Branch or Batch to check eligibility");
      return;
    }
    
    try {
      setChecking(true);
      const res = await fetch("/api/honours/students/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch, batch })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Check failed");
      
      setCheckResults(data);
      setSuccess(
        `✅ Checked ${data.stats?.totalChecked || 0} students: ` +
        `${data.stats?.eligible || 0} eligible, ` +
        `${data.stats?.notEligible || 0} not eligible`
      );
      
      fetchStudents();
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }, [branch, batch, fetchStudents]);

  // Initial load
  useEffect(() => { 
    fetchStudents(); 
    fetchFilters();
  }, [fetchStudents, fetchFilters]);

  // Filtered and paginated results
  const filteredResults = useMemo(() => {
    if (!checkResults?.allResults) return [];
    
    return checkResults.allResults.filter(student => {
      // Filter by status
      if (filterStatus === "eligible" && student.EligibilityStatus !== "Eligible") return false;
      if (filterStatus === "notEligible" && student.EligibilityStatus !== "Not Eligible") return false;
      
      // Filter by search
      if (search && search.trim()) {
        const searchTerm = search.toLowerCase().trim();
        const regNo = (student.RegistrationNo || student.Registration_No || "").toLowerCase();
        const name = (student.Name || "").toLowerCase();
        const branchName = (student.Branch || "").toLowerCase();
        const batchName = (student.Batch || "").toLowerCase();
        
        if (!regNo.includes(searchTerm) && 
            !name.includes(searchTerm) && 
            !branchName.includes(searchTerm) &&
            !batchName.includes(searchTerm)) {
          return false;
        }
      }
      
      return true;
    });
  }, [checkResults, filterStatus, search]);

  // Pagination
  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredResults.slice(start, end);
  }, [filteredResults, currentPage, itemsPerPage]);

  // Stats
  const stats = useMemo(() => {
    const eligible = filteredResults.filter(s => s.EligibilityStatus === "Eligible").length;
    const notEligible = filteredResults.filter(s => s.EligibilityStatus === "Not Eligible").length;
    return { total: filteredResults.length, eligible, notEligible };
  }, [filteredResults]);

  // Selection handlers
  const toggleSelect = useCallback((id, checked) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  }, []);

  const toggleSelectAll = useCallback((checked) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedIds(new Set(paginatedResults.map((_, idx) => idx)));
    } else {
      setSelectedIds(new Set());
    }
  }, [paginatedResults]);

  // Remove handlers
  const removeOne = useCallback(async (id) => {
    if (!confirm("Remove this student from honours list?")) return;
    setError("");
    try {
      const res = await fetch(`/api/honours/students/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      fetchStudents();
      setSuccess("Student removed successfully!");
    } catch (err) {
      setError(err.message);
    }
  }, [fetchStudents]);

  const removeSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Remove ${selectedIds.size} student(s) from honours list?`)) return;
    setError("");
    try {
      const promises = Array.from(selectedIds).map(id => 
        fetch(`/api/honours/students/${id}`, { method: "DELETE" })
      );
      await Promise.all(promises);
      fetchStudents();
      setSelectedIds(new Set());
      setSelectAll(false);
      setSuccess(`${selectedIds.size} student(s) removed successfully!`);
    } catch (err) {
      setError(err.message);
    }
  }, [selectedIds, fetchStudents]);

  // Export to CSV
  const exportToCSV = useCallback(() => {
    if (!filteredResults.length) {
      setError("No data to export");
      return;
    }

    const headers = ["Reg No", "Name", "Branch", "Batch", "CGPA", "Basket 5 Status", "Eligibility Status", "Reasons"];
    const rows = filteredResults.map(student => [
      student.RegistrationNo || student.Registration_No || "",
      student.Name || "",
      student.Branch || "",
      student.Batch || "",
      student.CGPA?.toFixed(2) || "N/A",
      student.Basket5Status || "Not Checked",
      student.EligibilityStatus || "Pending",
      (student.EligibilityReasons || []).join("; ")
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `honours_students_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSuccess("Data exported successfully!");
  }, [filteredResults]);

  return (
    <div 
      className="min-h-screen pb-10"
      style={{
        background: "linear-gradient(to bottom, #F5F8FA 0%, #E8F4F8 50%, #D1E9F6 100%)",
      }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-6 sm:pt-8 lg:pt-12">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
            <div>
              <h2 
                className="text-2xl sm:text-3xl md:text-4xl font-black mb-2"
                style={{
                  background: "linear-gradient(135deg, #05A3C7 0%, #04748F 50%, #023945 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                👥 Honours Degree Eligibility Checker
              </h2>
              <p className="text-[#5A6C7D] text-sm sm:text-base font-medium">
                Check and manage students eligible for honours degree
              </p>
            </div>
            <Link
              href="/dashboard/admin/honours"
              className="px-4 py-2 rounded-lg text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95"
              style={{ background: "linear-gradient(135deg, #6b7280, #4b5563)" }}
            >
              ← Back
            </Link>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div 
            className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg text-red-700 text-sm flex items-start gap-2 animate-slide-in"
            role="alert"
          >
            <span className="text-lg">⚠️</span>
            <div className="flex-1">
              <strong className="font-bold">Error:</strong> {error}
            </div>
            <button
              onClick={() => setError("")}
              className="text-red-700 hover:text-red-900 font-bold"
              aria-label="Close error"
            >
              ×
            </button>
          </div>
        )}
        {success && (
          <div 
            className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg text-green-700 text-sm flex items-start gap-2 animate-slide-in"
            role="alert"
          >
            <span className="text-lg">✅</span>
            <div className="flex-1">{success}</div>
            <button
              onClick={() => setSuccess("")}
              className="text-green-700 hover:text-green-900 font-bold"
              aria-label="Close success"
            >
              ×
            </button>
          </div>
        )}

        {/* Filters & Actions */}
        <div 
          className="rounded-xl border-2 p-4 sm:p-6 mb-6 shadow-sm"
          style={{ borderColor: "rgba(5,163,199,0.2)", background: "white" }}
        >
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold text-[#1A1F29] mb-2">
                  Branch <span className="text-red-500">*</span>
                </label>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full px-3 py-2.5 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-sm transition-all"
                  style={{ borderColor: "rgba(5,163,199,0.3)" }}
                  aria-label="Select branch"
                >
                  <option value="">All Branches</option>
                  {availableBranches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-[#1A1F29] mb-2">
                  Batch <span className="text-red-500">*</span>
                </label>
                <select
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  className="w-full px-3 py-2.5 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-sm transition-all"
                  style={{ borderColor: "rgba(5,163,199,0.3)" }}
                  aria-label="Select batch"
                >
                  <option value="">All Batches</option>
                  {availableBatches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-[#1A1F29] mb-2">
                  Search
                  <span className="text-xs font-normal text-[#5A6C7D] ml-1">
                    (Name, Reg No, Branch, Batch)
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search students..."
                    className="w-full px-3 py-2.5 pr-10 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-sm transition-all"
                    style={{ borderColor: "rgba(5,163,199,0.3)" }}
                    aria-label="Search students"
                  />
                  {search && (
                    <button
                      onClick={() => {
                        setSearch("");
                        setCurrentPage(1);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5A6C7D] hover:text-[#05A3C7] transition-all p-1"
                      title="Clear search"
                      aria-label="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={checkEligibility}
                disabled={checking || (!branch && !batch)}
                className="px-6 py-2.5 rounded-lg text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
                aria-label="Check eligibility"
              >
                {checking ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Checking...
                  </>
                ) : (
                  <>
                    🔍 Check Eligibility
                  </>
                )}
              </button>
              {checkResults && filteredResults.length > 0 && (
                <button
                  onClick={exportToCSV}
                  className="px-6 py-2.5 rounded-lg text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95 flex items-center gap-2"
                  style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)" }}
                  aria-label="Export to CSV"
                >
                  📥 Export CSV
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Eligibility Criteria */}
        <div 
          className="rounded-xl border-2 p-4 mb-6 shadow-sm"
          style={{ borderColor: "rgba(5,163,199,0.2)", background: "rgba(5,163,199,0.05)" }}
        >
          <h3 className="font-bold text-[#1A1F29] mb-3 flex items-center gap-2">
            <span className="text-xl">📋</span>
            Eligibility Criteria
          </h3>
          <ul className="text-sm text-[#5A6C7D] space-y-2 list-disc list-inside ml-2">
            <li><strong>CGPA:</strong> Must be {">="} 8.0</li>
            <li><strong>Basket 5 (Before 2024):</strong> 2 complete domains (all subjects from those domains)</li>
            <li><strong>Basket 5 (2024 onwards):</strong> 66 credits from Basket 5 + 2 complete domains</li>
          </ul>
        </div>

        {/* Results Section */}
        {checkResults && checkResults.allResults && checkResults.allResults.length > 0 ? (
          <div className="mb-6">
            {/* Header with Filters */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h3 className="text-lg font-bold text-[#1A1F29]">
                  📊 Eligibility Check Results
                </h3>
                {search && (
                  <p className="text-xs text-[#5A6C7D] mt-1">
                    Filtered by: <strong>"{search}"</strong>
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setFilterStatus("all");
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    filterStatus === "all"
                      ? "bg-[#05A3C7] text-white shadow-md"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                  aria-label="Show all students"
                >
                  All ({stats.total})
                </button>
                <button
                  onClick={() => {
                    setFilterStatus("eligible");
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    filterStatus === "eligible"
                      ? "bg-green-600 text-white shadow-md"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                  aria-label="Show eligible students"
                >
                  Eligible ({stats.eligible})
                </button>
                <button
                  onClick={() => {
                    setFilterStatus("notEligible");
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    filterStatus === "notEligible"
                      ? "bg-red-600 text-white shadow-md"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                  aria-label="Show not eligible students"
                >
                  Not Eligible ({stats.notEligible})
                </button>
              </div>
            </div>
            
            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div className="rounded-lg border-2 p-4 text-center shadow-sm transition-all hover:shadow-md" style={{ borderColor: "rgba(5,163,199,0.2)", background: "rgba(5,163,199,0.05)" }}>
                <div className="text-3xl font-bold text-[#05A3C7] mb-1">{stats.total}</div>
                <div className="text-xs text-[#5A6C7D] font-medium">
                  {search ? "Filtered Results" : "Total Checked"}
                </div>
              </div>
              <div className="rounded-lg border-2 p-4 text-center shadow-sm transition-all hover:shadow-md" style={{ borderColor: "rgba(34,197,94,0.2)", background: "rgba(34,197,94,0.05)" }}>
                <div className="text-3xl font-bold text-green-600 mb-1">{stats.eligible}</div>
                <div className="text-xs text-[#5A6C7D] font-medium">Eligible</div>
              </div>
              <div className="rounded-lg border-2 p-4 text-center shadow-sm transition-all hover:shadow-md" style={{ borderColor: "rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)" }}>
                <div className="text-3xl font-bold text-red-600 mb-1">{stats.notEligible}</div>
                <div className="text-xs text-[#5A6C7D] font-medium">Not Eligible</div>
              </div>
            </div>

            {/* Results Table */}
            <div 
              className="rounded-xl border-2 overflow-hidden shadow-sm"
              style={{ borderColor: "rgba(5,163,199,0.2)", background: "white" }}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr 
                      className="text-white"
                      style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                    >
                      <th className="px-4 py-3 text-left font-semibold">Reg No</th>
                      <th className="px-4 py-3 text-left font-semibold">Name</th>
                      <th className="px-4 py-3 text-left font-semibold">Branch</th>
                      <th className="px-4 py-3 text-left font-semibold">Batch</th>
                      <th className="px-4 py-3 text-left font-semibold">CGPA</th>
                      <th className="px-4 py-3 text-left font-semibold">Basket 5</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-left font-semibold">Reasons</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedResults.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-4 py-12 text-center text-[#5A6C7D]">
                          <div className="flex flex-col items-center gap-3">
                            <span className="text-5xl">🔍</span>
                            <p className="font-medium text-base">No students found</p>
                            <p className="text-xs">
                              {search ? `Try adjusting your search term "${search}"` : "No results match the current filters"}
                            </p>
                            {(search || filterStatus !== "all") && (
                              <button
                                onClick={() => {
                                  setSearch("");
                                  setFilterStatus("all");
                                  setCurrentPage(1);
                                }}
                                className="mt-2 px-4 py-2 text-sm rounded-lg bg-[#05A3C7] text-white hover:bg-[#04748F] transition-all"
                              >
                                Clear Filters
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedResults.map((student, idx) => {
                        const isEligible = student.EligibilityStatus === "Eligible";
                        return (
                          <tr 
                            key={`${student.RegistrationNo || student.Registration_No || idx}-${idx}`}
                            className={`border-b transition-colors ${isEligible ? 'bg-green-50/50 hover:bg-green-50' : 'bg-red-50/50 hover:bg-red-50'}`}
                            style={{ borderColor: "rgba(5,163,199,0.1)" }}
                          >
                            <td className="px-4 py-3 font-bold" style={{ color: "#05A3C7" }}>
                              {student.RegistrationNo || student.Registration_No || "N/A"}
                            </td>
                            <td className="px-4 py-3">{student.Name || "N/A"}</td>
                            <td className="px-4 py-3">{student.Branch || "N/A"}</td>
                            <td className="px-4 py-3">{student.Batch || "N/A"}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                (student.CGPA || 0) >= 8 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {student.CGPA?.toFixed(2) || "N/A"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                  student.Basket5Status === "Complete"
                                    ? 'bg-green-100 text-green-700'
                                    : student.Basket5Status === "In Progress"
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  {student.Basket5Status || "Not Checked"}
                                </span>
                                {student.Basket5Details && (
                                  <div className="text-xs text-[#5A6C7D]">
                                    {student.Basket5Details.completedCount}/2 domains
                                    {student.Basket5Details.basket5Credits !== undefined && (
                                      <span> | {student.Basket5Details.basket5Credits}/66 credits</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                isEligible
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {student.EligibilityStatus || "Pending"}
                              </span>
                            </td>
                            <td className="px-4 py-3 max-w-xs">
                              {student.EligibilityReasons && student.EligibilityReasons.length > 0 ? (
                                <ul className="text-xs text-red-600 list-disc list-inside space-y-0.5">
                                  {student.EligibilityReasons.map((reason, i) => (
                                    <li key={i}>{reason}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-xs text-green-600 font-medium">✓ All criteria met</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor: "rgba(5,163,199,0.1)" }}>
                  <div className="text-sm text-[#5A6C7D]">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredResults.length)} of {filteredResults.length} results
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ 
                        background: currentPage === 1 ? "rgba(5,163,199,0.2)" : "rgba(5,163,199,0.1)",
                        color: currentPage === 1 ? "#5A6C7D" : "#05A3C7"
                      }}
                      aria-label="Previous page"
                    >
                      ← Prev
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                              currentPage === pageNum
                                ? "bg-[#05A3C7] text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                            aria-label={`Go to page ${pageNum}`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ 
                        background: currentPage === totalPages ? "rgba(5,163,199,0.2)" : "rgba(5,163,199,0.1)",
                        color: currentPage === totalPages ? "#5A6C7D" : "#05A3C7"
                      }}
                      aria-label="Next page"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div 
            className="rounded-xl border-2 p-12 text-center mb-6 shadow-sm"
            style={{ borderColor: "rgba(5,163,199,0.2)", background: "white" }}
          >
            <div className="flex flex-col items-center gap-4">
              <span className="text-6xl">🔍</span>
              <div>
                <p className="text-[#1A1F29] font-bold text-lg mb-2">No students checked yet</p>
                <p className="text-sm text-[#5A6C7D] max-w-md">
                  Select Branch and/or Batch from the filters above, then click "Check Eligibility" to see both eligible and not eligible students with detailed reasons.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
