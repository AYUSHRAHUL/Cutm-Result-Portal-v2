"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { appendSchoolParams, getSchoolApiUrl } from "@/lib/api-helper";
import { useSearchParams, useRouter } from "next/navigation";

function RegistrationDataViewerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isDiploma = searchParams.get("school") === "SOVET";
  const [registrationData, setRegistrationData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataStats, setDataStats] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");

  // Filters
  const [semesterFilter, setSemesterFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [studentFilter, setStudentFilter] = useState("");

  // OTP modal state for destructive delete
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpStep, setOtpStep] = useState("idle"); // idle | sent | verifying
  const [otpMessage, setOtpMessage] = useState("");

  // Edit and delete states
  const [selectedRecords, setSelectedRecords] = useState([]);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({
    Reg_No: "",
    Name: "",
    Subject_Code: "",
    Subject_Name: "",
    Credits: "",
    Sem: ""
  });

  // Available semesters
  const semesters = [
    'Sem 1', 'Sem 2', 'Sem 3', 'Sem 4',
    'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8'
  ];

  // Fetch registration data
  const fetchRegistrationData = async () => {
    setLoading(true);
    setUploadMessage("");

    try {
      const url = appendSchoolParams('/api/registration-data');
      const response = await fetch(url);
      const result = await response.json();

      if (response.ok) {
        setRegistrationData(result.data || []);
        setFilteredData(result.data || []);
        setDataStats(result.stats || null);

        if (!result.data || result.data.length === 0) {
          setUploadMessage("No registration data found. Upload some data first.");
        }
      } else {
        setUploadMessage(`Error: ${result.error}`);
      }
    } catch (error) {
      setUploadMessage(`Error fetching data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Clear all registration data
  const clearAllRegistrationData = () => {
    setOtpCode("");
    setOtpMessage("");
    setOtpStep("idle");
    setShowOtpModal(true);
  };

  const requestOtp = async () => {
    setOtpStep("idle");
    setLoading(true);
    setOtpMessage("");
    try {
      const url = appendSchoolParams("/api/registration-data");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request-otp" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpMessage(data.error || "Failed to send OTP");
      } else {
        setOtpMessage("OTP sent to your email. It is valid for 10 minutes.");
        setOtpStep("sent");
      }
    } catch (err) {
      setOtpMessage(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtpAndDelete = async () => {
    if (!otpCode) {
      setOtpMessage("Please enter OTP");
      return;
    }
    setOtpStep("verifying");
    setLoading(true);
    setOtpMessage("");
    try {
      const url = appendSchoolParams("/api/registration-data");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify-otp", otp: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpMessage(data.error || "OTP verification failed");
        setOtpStep("sent");
      } else {
        setUploadMessage(`Successfully cleared ${data.deletedCount} registration records`);
        setShowOtpModal(false);
        setRegistrationData([]);
        setFilteredData([]);
        setDataStats(null);
        setSelectedRecords([]);
      }
    } catch (err) {
      setOtpMessage(err.message || "Failed to verify OTP");
      setOtpStep("sent");
    } finally {
      setLoading(false);
    }
  };

  // Toggle record selection
  const toggleRecordSelection = (recordId) => {
    setSelectedRecords(prev =>
      prev.includes(recordId)
        ? prev.filter(id => id !== recordId)
        : [...prev, recordId]
    );
  };

  // Select all visible records
  const toggleSelectAll = () => {
    const allRecords = filteredData.map(item => item._id);

    if (allRecords.every(id => selectedRecords.includes(id))) {
      setSelectedRecords(prev => prev.filter(id => !allRecords.includes(id)));
    } else {
      setSelectedRecords(prev => [...new Set([...prev, ...allRecords])]);
    }
  };

  // Open edit modal
  const openEditModal = (record) => {
    setEditingRecord(record);
    setEditForm({
      Reg_No: record.Reg_No || "",
      Name: record.Name || "",
      Subject_Code: record.Subject_Code || "",
      Subject_Name: record.Subject_Name || "",
      Credits: record.Credits || "",
      Sem: record.Sem || ""
    });
  };

  // Close edit modal
  const closeEditModal = () => {
    setEditingRecord(null);
    setEditForm({
      Reg_No: "",
      Name: "",
      Subject_Code: "",
      Subject_Name: "",
      Credits: "",
      Sem: ""
    });
  };

  // Update record
  const handleUpdateRecord = async (e) => {
    e.preventDefault();
    if (!editingRecord) return;

    setLoading(true);
    setUploadMessage("");

    try {
      const url = appendSchoolParams('/api/registration-data');
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: editingRecord._id,
          updates: editForm
        })
      });

      const result = await response.json();

      if (response.ok) {
        setUploadMessage(`Successfully updated record for ${editForm.Name}`);
        await fetchRegistrationData();
        closeEditModal();
      } else {
        setUploadMessage(`Error: ${result.error}`);
      }
    } catch (error) {
      setUploadMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete selected records
  const deleteSelectedRecords = async () => {
    if (selectedRecords.length === 0) {
      setUploadMessage("Please select at least one record to delete");
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedRecords.length} selected record(s)? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    setUploadMessage("");

    try {
      const ids = selectedRecords.join(',');
      const response = await fetch(`/api/registration-data?ids=${ids}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (response.ok) {
        setUploadMessage(`Successfully deleted ${result.deletedCount} record(s)`);
        setSelectedRecords([]);
        await fetchRegistrationData();
      } else {
        setUploadMessage(`Error: ${result.error}`);
      }
    } catch (error) {
      setUploadMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters
  useEffect(() => {
    try {
      if (!registrationData || registrationData.length === 0) {
        setFilteredData([]);
        return;
      }

      let filtered = [...registrationData];

      if (semesterFilter) {
        filtered = filtered.filter(item => {
          const sem = String(item.Sem || '');
          return sem === semesterFilter;
        });
      }

      if (departmentFilter) {
        filtered = filtered.filter(item => {
          const regNo = String(item.Reg_No || '');

          if (isDiploma) {
            // Diploma filtering - use index 5-7 for branch code
            // Branch codes: 711=Electrical, 712=Mechanical, 713=Civil, 714=CSE, 715=Automobile, 716=Mining
            if (regNo.length >= 8) {
              const branchCode = regNo.slice(5, 8); // Index 5-7
              const diplomaBranchMap = {
                '711': 'Electrical',
                '712': 'Mechanical',
                '713': 'Civil',
                '714': 'CSE',
                '715': 'Automobile',
                '716': 'Mining'
              };
              const branchName = diplomaBranchMap[branchCode];
              if (branchName) {
                return branchName.includes(departmentFilter) || departmentFilter.includes(branchName);
              }
            }
            return false;
          } else {
            // B.Tech Legacy filtering - use index 5-7 for branch code
            // Branch codes: 111=Civil, 112=CSE, 113=ECE, 115=EEE, 116=Mechanical, 117=CSE AIML
            if (regNo.length >= 8) {
              const branchCode = regNo.slice(5, 8); // Index 5-7
              const btechBranchMap = {
                '111': 'Civil',
                '112': 'CSE',
                '113': 'ECE',
                '115': 'EEE',
                '116': 'Mechanical',
                '117': 'AIML'
              };
              const branchName = btechBranchMap[branchCode];
              if (branchName) {
                // Map department filter codes to branch names
                const deptCodeMap = {
                  '1': 'Civil',
                  '2': 'CSE',
                  '3': 'ECE',
                  '5': 'EEE',
                  '6': 'Mechanical',
                  '7': 'AIML'
                };
                const filterBranch = deptCodeMap[departmentFilter] || departmentFilter;
                return branchName === filterBranch || branchName.includes(filterBranch) || filterBranch.includes(branchName);
              }
            }
            // Fallback to old method (position 7) for backward compatibility
            if (regNo.length < 8) return false;
            const deptCode = regNo.charAt(7);
            return deptCode === departmentFilter;
          }
        });
      }

      if (studentFilter) {
        const searchTerm = studentFilter.toLowerCase();
        filtered = filtered.filter(item => {
          const regNo = String(item.Reg_No || '').toLowerCase();
          const name = String(item.Name || '').toLowerCase();
          const code = String(item.Subject_Code || '').toLowerCase();
          const subject = String(item.Subject_Name || '').toLowerCase();
          return (
            regNo.includes(searchTerm) ||
            name.includes(searchTerm) ||
            code.includes(searchTerm) ||
            subject.includes(searchTerm)
          );
        });
      }

      setFilteredData(filtered);
      // Clear selections when filters change
      setSelectedRecords([]);
    } catch (error) {
      setFilteredData(registrationData || []);
    }
  }, [registrationData, semesterFilter, departmentFilter, studentFilter, isDiploma]);

  // Load data on mount
  useEffect(() => {
    fetchRegistrationData();
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
        <div className="flex items-center justify-between mb-6 sm:mb-8">
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
              📊 Registration Data Viewer
            </h2>
            <p className="text-[#5A6C7D] text-sm sm:text-base font-medium">
              View and manage student registration data
            </p>
          </div>
          <Link
            href={`/dashboard/admin/data?${searchParams.toString()}`}
            className="px-4 py-2 rounded-lg text-white font-bold transition-all hover:shadow-lg active:scale-95 text-sm min-h-[44px] flex items-center gap-2"
            style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
          >
            ← Back
          </Link>
        </div>

        {/* Data Statistics */}
        {dataStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div
              className="rounded-lg p-3 sm:p-4 text-center"
              style={{ background: "rgba(5,163,199,0.1)" }}
            >
              <div className="text-xl sm:text-2xl font-black" style={{ color: "#05A3C7" }}>{dataStats.totalRecords}</div>
              <div className="text-xs sm:text-sm text-[#5A6C7D] font-medium">Total Records</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 sm:p-4 text-center">
              <div className="text-xl sm:text-2xl font-black text-green-600">{dataStats.uniqueStudents}</div>
              <div className="text-xs sm:text-sm text-gray-600 font-medium">Students</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 sm:p-4 text-center">
              <div className="text-xl sm:text-2xl font-black text-purple-600">{dataStats.semesters.length}</div>
              <div className="text-xs sm:text-sm text-gray-600 font-medium">Semesters</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 sm:p-4 text-center">
              <div className="text-xl sm:text-2xl font-black text-orange-600">6</div>
              <div className="text-xs sm:text-sm text-gray-600 font-medium">Departments</div>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {uploadMessage && (
          <div className={`rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 ${uploadMessage.includes('Error')
            ? 'bg-red-50 border-2 border-red-200'
            : uploadMessage.includes('Success')
              ? 'bg-green-50 border-2 border-green-200'
              : 'bg-blue-50 border-2 border-blue-200'
          }`}>
            <div className={`font-bold text-sm sm:text-base ${uploadMessage.includes('Error')
              ? 'text-red-800'
              : uploadMessage.includes('Success')
                ? 'text-green-800'
                : 'text-blue-800'
            }`}>
              {uploadMessage.includes('Error') ? '⚠️ Error' :
                uploadMessage.includes('Success') ? '✅ Success' :
                  'ℹ️ Info'}
            </div>
            <div className={`text-xs sm:text-sm mt-1 ${uploadMessage.includes('Error')
              ? 'text-red-700'
              : uploadMessage.includes('Success')
                ? 'text-green-700'
                : 'text-blue-700'
            }`}>
              {uploadMessage}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div>
            <label className="block text-xs sm:text-sm font-bold text-[#1A1F29] mb-2">Semester:</label>
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-xs sm:text-sm min-h-[44px]"
              style={{ borderColor: "rgba(5,163,199,0.3)" }}
            >
              <option value="">All Semesters</option>
              {dataStats?.semesters.map(sem => (
                <option key={sem} value={sem}>{sem}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-[#1A1F29] mb-2">Department:</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-xs sm:text-sm min-h-[44px]"
              style={{ borderColor: "rgba(5,163,199,0.3)" }}
            >
              <option value="">All Departments</option>
              {isDiploma ? (
                <>
                  <option value="Civil">Civil Engineering</option>
                  <option value="CSE">Computer Science (CSE)</option>
                  <option value="ECE">Electronics (ECE)</option>
                  <option value="Electrical">Electrical (EE)</option>
                  <option value="Mechanical">Mechanical (ME)</option>
                  <option value="Automobile">Automobile (AE)</option>
                  <option value="Mining">Mining</option>
                </>
              ) : (
                <>
                  <option value="1">Civil</option>
                  <option value="2">CSE</option>
                  <option value="3">ECE</option>
                  <option value="5">EEE</option>
                  <option value="6">Mechanical</option>
                  <option value="7">AIML</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-bold text-[#1A1F29] mb-2">Search (Reg/Name/Subject Code/Subject):</label>
            <input
              type="text"
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
              placeholder="Reg No, Name, Subject Code, or Subject..."
              className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-xs sm:text-sm min-h-[44px]"
              style={{ borderColor: "rgba(5,163,199,0.3)" }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="block text-xs sm:text-sm font-bold text-[#1A1F29] mb-2">Actions:</label>
            {selectedRecords.length > 0 && (
              <button
                onClick={deleteSelectedRecords}
                disabled={loading}
                className="w-full px-2 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-bold transition-all active:scale-95 text-xs min-h-[44px]"
                title="Delete Selected"
              >
                🗑️ Delete Selected ({selectedRecords.length})
              </button>
            )}
            <button
              onClick={clearAllRegistrationData}
              disabled={loading}
              className="w-full px-2 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-bold transition-all active:scale-95 text-xs min-h-[44px]"
              title="Clear All"
            >
              🗑️ Clear All
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl border-2 p-4 sm:p-6 shadow-lg" style={{ borderColor: "rgba(5,163,199,0.2)" }}>
          <div className="border-2 rounded-lg" style={{ borderColor: "rgba(5,163,199,0.2)" }}>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div
                    className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
                    style={{ borderColor: "#05A3C7" }}
                  ></div>
                  <p className="text-[#5A6C7D] text-sm sm:text-base">Loading registration data...</p>
                </div>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center p-4">
                  <div className="text-4xl sm:text-6xl mb-4">📊</div>
                  <p className="text-[#5A6C7D] font-medium text-sm sm:text-base">No registration data found</p>
                  <p className="text-xs sm:text-sm text-[#5A6C7D] mt-2">
                    {registrationData.length === 0
                      ? "Upload some registration data to get started"
                      : "Try adjusting your filters"
                    }
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead
                    className="sticky top-0"
                    style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                  >
                    <tr className="text-white">
                      <th className="px-1 sm:px-2 py-1.5 sm:py-2 text-center font-black text-xs uppercase">
                        <input
                          type="checkbox"
                          checked={filteredData.length > 0 && filteredData.every(item => selectedRecords.includes(item._id))}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-2 cursor-pointer"
                        />
                      </th>
                      <th className="px-1.5 sm:px-2 py-1.5 sm:py-2 text-left font-black text-xs uppercase">Reg No</th>
                      <th className="px-1.5 sm:px-2 py-1.5 sm:py-2 text-left font-black text-xs uppercase">Name</th>
                      <th className="px-1.5 sm:px-2 py-1.5 sm:py-2 text-left font-black text-xs uppercase">Code</th>
                      <th className="px-1.5 sm:px-2 py-1.5 sm:py-2 text-left font-black text-xs uppercase">Subject</th>
                      <th className="px-1.5 sm:px-2 py-1.5 sm:py-2 text-center font-black text-xs uppercase">Credits</th>
                      <th className="px-1.5 sm:px-2 py-1.5 sm:py-2 text-center font-black text-xs uppercase">Sem</th>
                      <th className="px-1.5 sm:px-2 py-1.5 sm:py-2 text-center font-black text-xs uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((item, index) => (
                      <tr key={item._id || index} className="border-b-2 hover:bg-[#05A3C7]/5" style={{ borderColor: "rgba(5,163,199,0.1)" }}>
                        <td className="px-1 sm:px-2 py-1.5 sm:py-2 text-center">
                          <input
                            type="checkbox"
                            checked={selectedRecords.includes(item._id)}
                            onChange={() => toggleRecordSelection(item._id)}
                            className="w-4 h-4 rounded border-2 cursor-pointer"
                            style={{ borderColor: "rgba(5,163,199,0.3)" }}
                          />
                        </td>
                        <td className="px-1.5 sm:px-2 py-1.5 sm:py-2 font-mono font-bold text-xs sm:text-sm" style={{ color: "#05A3C7" }}>{item.Reg_No}</td>
                        <td className="px-1.5 sm:px-2 py-1.5 sm:py-2 text-[#1A1F29] font-medium text-xs sm:text-sm">{item.Name}</td>
                        <td className="px-1.5 sm:px-2 py-1.5 sm:py-2 font-mono text-green-600 font-bold text-xs sm:text-sm">{item.Subject_Code}</td>
                        <td className="px-1.5 sm:px-2 py-1.5 sm:py-2 text-[#1A1F29] text-xs sm:text-sm">{item.Subject_Name}</td>
                        <td className="px-1.5 sm:px-2 py-1.5 sm:py-2 text-center font-bold text-[#1A1F29] text-xs sm:text-sm">{item.Credits}</td>
                        <td className="px-1.5 sm:px-2 py-1.5 sm:py-2 text-center">
                          <span className="inline-block px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold text-white shadow-md" style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}>
                            {item.Sem}
                          </span>
                        </td>
                        <td className="px-1.5 sm:px-2 py-1.5 sm:py-2 text-center">
                          <button
                            onClick={() => openEditModal(item)}
                            className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-white font-bold text-[10px] sm:text-xs hover:shadow-md transition-all"
                            style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                            title="Edit"
                          >
                            ✏️ Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Record Count */}
          {filteredData.length > 0 && (
            <div className="flex items-center justify-center mt-4">
              <div className="text-xs sm:text-sm text-[#5A6C7D] font-medium">
                Showing all {filteredData.length} record{filteredData.length !== 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {editingRecord && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h3 className="text-lg sm:text-xl font-black text-[#1A1F29] flex items-center gap-2">
                  ✏️ Edit Registration Record
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
                      required
                      className="w-full rounded-xl border-2 bg-white px-3 sm:px-4 py-2.5 sm:py-3 outline-none focus:ring-4 focus:ring-[#05A3C7]/20 text-[#1A1F29] font-medium text-sm sm:text-base min-h-[44px]"
                      style={{ borderColor: "rgba(5,163,199,0.3)" }}
                      value={editForm.Reg_No}
                      onChange={e => setEditForm({ ...editForm, Reg_No: e.target.value.toUpperCase() })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#1A1F29] mb-2">Student Name</label>
                    <input
                      type="text"
                      required
                      className="w-full rounded-xl border-2 bg-white px-3 sm:px-4 py-2.5 sm:py-3 outline-none focus:ring-4 focus:ring-[#05A3C7]/20 text-[#1A1F29] font-medium text-sm sm:text-base min-h-[44px]"
                      style={{ borderColor: "rgba(5,163,199,0.3)" }}
                      value={editForm.Name}
                      onChange={e => setEditForm({ ...editForm, Name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#1A1F29] mb-2">Subject Code</label>
                    <input
                      type="text"
                      required
                      className="w-full rounded-xl border-2 bg-white px-3 sm:px-4 py-2.5 sm:py-3 outline-none focus:ring-4 focus:ring-[#05A3C7]/20 text-[#1A1F29] font-medium text-sm sm:text-base min-h-[44px]"
                      style={{ borderColor: "rgba(5,163,199,0.3)" }}
                      value={editForm.Subject_Code}
                      onChange={e => setEditForm({ ...editForm, Subject_Code: e.target.value.toUpperCase() })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#1A1F29] mb-2">Subject Name</label>
                    <input
                      type="text"
                      required
                      className="w-full rounded-xl border-2 bg-white px-3 sm:px-4 py-2.5 sm:py-3 outline-none focus:ring-4 focus:ring-[#05A3C7]/20 text-[#1A1F29] font-medium text-sm sm:text-base min-h-[44px]"
                      style={{ borderColor: "rgba(5,163,199,0.3)" }}
                      value={editForm.Subject_Name}
                      onChange={e => setEditForm({ ...editForm, Subject_Name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#1A1F29] mb-2">Credits</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.5"
                      className="w-full rounded-xl border-2 bg-white px-3 sm:px-4 py-2.5 sm:py-3 outline-none focus:ring-4 focus:ring-[#05A3C7]/20 text-[#1A1F29] font-medium text-sm sm:text-base min-h-[44px]"
                      style={{ borderColor: "rgba(5,163,199,0.3)" }}
                      value={editForm.Credits}
                      onChange={e => setEditForm({ ...editForm, Credits: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#1A1F29] mb-2">Semester</label>
                    <select
                      required
                      className="w-full rounded-xl border-2 bg-white px-3 sm:px-4 py-2.5 sm:py-3 outline-none focus:ring-4 focus:ring-[#05A3C7]/20 text-[#1A1F29] font-medium text-sm sm:text-base min-h-[44px]"
                      style={{ borderColor: "rgba(5,163,199,0.3)" }}
                      value={editForm.Sem}
                      onChange={e => setEditForm({ ...editForm, Sem: e.target.value })}
                    >
                      <option value="">Select Semester</option>
                      {semesters.map((sem) => (
                        <option key={sem} value={sem}>
                          {sem}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {uploadMessage && (
                  <div className={`rounded-lg p-3 sm:p-4 ${uploadMessage.includes('Error')
                    ? 'bg-red-50 border-2 border-red-200 text-red-700'
                    : 'bg-green-50 border-2 border-green-200 text-green-700'
                  }`}>
                    <div className="font-bold text-sm sm:text-base">
                      {uploadMessage.includes('Error') ? '⚠️ Error' : '✅ Success'}
                    </div>
                    <div className="text-xs sm:text-sm mt-1">
                      {uploadMessage}
                    </div>
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

        {/* OTP Modal for Clear All */}
        {showOtpModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl sm:rounded-2xl p-5 sm:p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg sm:text-xl font-black text-[#1A1F29] flex items-center gap-2">
                  🔐 Verify to Clear All
                </h3>
                <button
                  onClick={() => setShowOtpModal(false)}
                  className="text-[#5A6C7D] hover:text-[#1A1F29] text-2xl font-bold w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3">
                <div className="text-sm text-[#1A1F29] bg-blue-50 border border-blue-200 rounded-lg p-3">
                  OTP will be sent to your admin email on file. No need to enter email here.
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#1A1F29] mb-1">OTP</label>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Enter 6-digit OTP"
                    className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-sm"
                    style={{ borderColor: "rgba(5,163,199,0.3)" }}
                    disabled={loading || otpStep === "idle"}
                  />
                </div>

                {otpMessage && (
                  <div className={`text-sm rounded-lg p-3 ${otpMessage.toLowerCase().includes('error') || otpMessage.toLowerCase().includes('fail') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                    {otpMessage}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={requestOtp}
                    disabled={loading}
                    className="flex-1 px-4 py-2 rounded-lg text-white font-bold text-sm min-h-[44px] hover:shadow-md transition-all disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                  >
                    {loading && otpStep !== "verifying" ? "Sending..." : "Send OTP"}
                  </button>
                  <button
                    type="button"
                    onClick={verifyOtpAndDelete}
                    disabled={loading || otpStep === "idle"}
                    className="flex-1 px-4 py-2 rounded-lg text-white font-bold text-sm min-h-[44px] hover:shadow-md transition-all disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)" }}
                  >
                    {loading && otpStep === "verifying" ? "Verifying..." : "Verify & Delete"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RegistrationDataViewer() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading registration data viewer...</p>
        </div>
      </div>
    }>
      <RegistrationDataViewerContent />
    </Suspense>
  );
}

