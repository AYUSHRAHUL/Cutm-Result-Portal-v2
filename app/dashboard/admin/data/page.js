"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

export default function AdminCBCSIndex() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [selectedSemester, setSelectedSemester] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  
  // Registration data management states
  const [showRegistrationViewer, setShowRegistrationViewer] = useState(false);
  const [registrationData, setRegistrationData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataStats, setDataStats] = useState(null);
  
  // Filters
  const [semesterFilter, setSemesterFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // Available semesters
  const semesters = [
    'Semester 1', 'Semester 2', 'Semester 3', 'Semester 4',
    'Semester 5', 'Semester 6', 'Semester 7', 'Semester 8'
  ];

  // Fetch registration data
  const fetchRegistrationData = async () => {
    setLoading(true);
    setUploadMessage("");
    
    try {
      const response = await fetch('/api/registration-data');
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
  const clearAllRegistrationData = async () => {
    if (!confirm('Are you sure you want to clear ALL registration data? This action cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/registration-data', {
        method: 'DELETE'
      });
      const result = await response.json();
      
      if (response.ok) {
        setUploadMessage(`Successfully cleared ${result.deletedCount} registration records`);
        setRegistrationData([]);
        setFilteredData([]);
        setDataStats(null);
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
          if (!regNo || regNo.length < 8) return false;
          const deptCode = regNo.charAt(7);
          return deptCode === departmentFilter;
        });
      }
      
      if (studentFilter) {
        const searchTerm = studentFilter.toLowerCase();
        filtered = filtered.filter(item => {
          const regNo = String(item.Reg_No || '').toLowerCase();
          const name = String(item.Name || '').toLowerCase();
          return regNo.includes(searchTerm) || name.includes(searchTerm);
        });
      }
      
      setFilteredData(filtered);
      setCurrentPage(1);
    } catch (error) {
      setFilteredData(registrationData || []);
    }
  }, [registrationData, semesterFilter, departmentFilter, studentFilter]);

  // Load data when viewer opens
  useEffect(() => {
    if (showRegistrationViewer) {
      fetchRegistrationData();
    }
  }, [showRegistrationViewer]);

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadMessage("Please select a file to upload");
      return;
    }
    
    if (!selectedSemester) {
      setUploadMessage("Please select a semester for the registration data");
      return;
    }

    setUploading(true);
    setUploadMessage("");

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('semester', selectedSemester);

      const response = await fetch('/api/upload/registration', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (response.ok) {
        setUploadMessage(`Success! ${result.message}`);
        setUploadFile(null);
        setSelectedSemester("");
        const fileInput = document.getElementById('registrationFile');
        if (fileInput) fileInput.value = '';
      } else {
        let errorMsg = `Error: ${result.error}`;
        if (result.debugInfo) {
          errorMsg += `\n\nDebug Info:\n- Total rows: ${result.debugInfo.totalRows}\n- Available columns: ${result.debugInfo.availableColumns?.join(', ')}\n- Sample row: ${JSON.stringify(result.debugInfo.sampleRow, null, 2)}`;
        }
        setUploadMessage(errorMsg);
      }
    } catch (error) {
      setUploadMessage(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div 
      className="min-h-screen pb-10"
      style={{
        background: "linear-gradient(to bottom, #F5F8FA 0%, #E8F4F8 50%, #D1E9F6 100%)",
      }}
    >
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 pt-6 sm:pt-8 lg:pt-12">
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
            📚 Data Management
          </h1>
          <p className="text-[#5A6C7D] text-sm sm:text-base font-medium">
            Manage CBCS subjects and registration data
          </p>
        </div>
        
        {/* Management Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* CBCS Management */}
          <div 
            className="rounded-xl sm:rounded-2xl border-2 p-4 sm:p-5 lg:p-6 shadow-lg"
            style={{ borderColor: "rgba(5,163,199,0.2)", background: "white" }}
          >
            <h2 className="text-lg sm:text-xl font-black text-[#1A1F29] mb-3 sm:mb-4 flex items-center gap-2">
              🗂️ CBCS Management
            </h2>
            <p className="text-[#5A6C7D] mb-4 text-xs sm:text-sm">
              Manage CBCS subjects and baskets
            </p>
            <div className="flex flex-col gap-2 sm:gap-3">
              <Link 
                href="/dashboard/admin/data/basket" 
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95 min-h-[44px]"
                style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
              >
                🗂️ View Baskets
              </Link>
              <Link 
                href="/dashboard/admin/data/baskettrack" 
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95 min-h-[44px]"
                style={{ background: "linear-gradient(135deg, #56ab2f, #a8e6cf)" }}
              >
                📊 Track Progress
              </Link>
            </div>
          </div>

          {/* Registration Data Management */}
          <div 
            className="rounded-xl sm:rounded-2xl border-2 p-4 sm:p-5 lg:p-6 shadow-lg"
            style={{ borderColor: "rgba(5,163,199,0.2)", background: "white" }}
          >
            <h2 className="text-lg sm:text-xl font-black text-[#1A1F29] mb-3 sm:mb-4 flex items-center gap-2">
              📊 Registration Data
            </h2>
            <p className="text-[#5A6C7D] mb-4 text-xs sm:text-sm">
              View and manage student registration data
            </p>
            <div className="flex flex-col gap-2 sm:gap-3">
              <button
                onClick={() => setShowRegistrationViewer(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95 min-h-[44px]"
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
              >
                👁️ View Registration Data
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95 min-h-[44px]"
                style={{ background: "linear-gradient(135deg, #ff6b6b, #feca57)" }}
              >
                📤 Upload Registration Data
              </button>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div 
          className="rounded-xl sm:rounded-2xl border-2 p-4 sm:p-5 lg:p-6 mb-6 sm:mb-8 shadow-lg"
          style={{ borderColor: "rgba(5,163,199,0.2)", background: "rgba(5,163,199,0.05)" }}
        >
          <h3 className="text-base sm:text-lg font-black text-[#1A1F29] mb-3 sm:mb-4 flex items-center gap-2">
            ℹ️ Data Management Info
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
            <div>
              <h4 className="font-bold text-[#1A1F29] mb-2">📤 Registration Data Upload:</h4>
              <ul className="text-[#5A6C7D] space-y-1">
                <li>• Updates only the selected semester</li>
                <li>• Preserves data from other semesters</li>
                <li>• Uses smart update/insert strategy</li>
                <li>• No data loss for other semesters</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-[#1A1F29] mb-2">📊 Results Data Upload:</h4>
              <ul className="text-[#5A6C7D] space-y-1">
                <li>• Updates existing records with failed grades</li>
                <li>• Inserts new records automatically</li>
                <li>• Supports CSV and Excel formats</li>
                <li>• Batch processing for multiple files</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl sm:rounded-2xl p-5 sm:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg sm:text-xl font-black text-[#1A1F29] mb-4 flex items-center gap-2">
                📤 Upload Registration Data
              </h3>
              
              <div className="mb-4 sm:mb-6">
                <h4 className="font-bold text-[#1A1F29] mb-2 text-sm">📋 Expected Format:</h4>
                <div 
                  className="rounded-lg p-3 text-xs text-left overflow-x-auto"
                  style={{ background: "rgba(5,163,199,0.1)" }}
                >
                  <div className="font-mono text-[10px] sm:text-xs whitespace-pre">
                    <div className="font-bold text-[#05A3C7]">Sr. | Rollno | Name | Subject | Code | Type | Credit</div>
                    <div className="text-[#5A6C7D] mt-2">
                      Example:<br/>
                      1 | 220101120188 | Subrata Das | ROBOTIC AUTOMATION | CUTM1020 | PP | 1
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleFileUpload}>
                <div className="mb-4">
                  <label className="block text-sm font-bold text-[#1A1F29] mb-2">
                    Select Semester:
                  </label>
                  <select
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(e.target.value)}
                    className="w-full px-3 py-2.5 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-sm min-h-[44px]"
                    style={{ borderColor: "rgba(5,163,199,0.3)" }}
                    required
                  >
                    <option value="">Choose a semester...</option>
                    {semesters.map((sem) => (
                      <option key={sem} value={sem}>
                        {sem}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-bold text-[#1A1F29] mb-2">
                    Select CSV/Excel File:
                  </label>
                  <input
                    id="registrationFile"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-sm"
                    style={{ borderColor: "rgba(5,163,199,0.3)" }}
                    required
                  />
                </div>

                {uploadMessage && (
                  <div className={`mb-4 p-3 rounded-lg text-xs sm:text-sm whitespace-pre-line ${
                    uploadMessage.includes('Success') ? 'bg-green-100 text-green-700 border-2 border-green-200' : 'bg-red-100 text-red-700 border-2 border-red-200'
                  }`}>
                    {uploadMessage}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadMessage("");
                      setUploadFile(null);
                      setSelectedSemester("");
                    }}
                    className="flex-1 px-4 py-2.5 border-2 rounded-lg font-bold transition-all hover:bg-gray-50 active:scale-95 text-sm min-h-[44px]"
                    style={{ borderColor: "rgba(5,163,199,0.3)", color: "#1A1F29" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || !selectedSemester || !uploadFile}
                    className="flex-1 px-4 py-2.5 rounded-lg text-white font-bold transition-all hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm min-h-[44px]"
                    style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                  >
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Registration Data Viewer Modal */}
        {showRegistrationViewer && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h3 className="text-lg sm:text-2xl font-black text-[#1A1F29] flex items-center gap-2">
                  📊 Registration Data Viewer
                </h3>
                <button
                  onClick={() => {
                    setShowRegistrationViewer(false);
                    setRegistrationData([]);
                    setFilteredData([]);
                    setDataStats(null);
                    setSemesterFilter("");
                    setDepartmentFilter("");
                    setStudentFilter("");
                  }}
                  className="text-[#5A6C7D] hover:text-[#1A1F29] text-2xl sm:text-3xl font-bold w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                  ×
                </button>
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
                <div className={`rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 ${
                  uploadMessage.includes('Error') 
                    ? 'bg-red-50 border-2 border-red-200' 
                    : uploadMessage.includes('Success') 
                    ? 'bg-green-50 border-2 border-green-200'
                    : 'bg-blue-50 border-2 border-blue-200'
                }`}>
                  <div className={`font-bold text-sm sm:text-base ${
                    uploadMessage.includes('Error') 
                      ? 'text-red-800' 
                      : uploadMessage.includes('Success') 
                      ? 'text-green-800'
                      : 'text-blue-800'
                  }`}>
                    {uploadMessage.includes('Error') ? '⚠️ Error' : 
                     uploadMessage.includes('Success') ? '✅ Success' : 
                     'ℹ️ Info'}
                  </div>
                  <div className={`text-xs sm:text-sm mt-1 ${
                    uploadMessage.includes('Error') 
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
                    <option value="1">Civil</option>
                    <option value="2">CSE</option>
                    <option value="3">ECE</option>
                    <option value="5">EEE</option>
                    <option value="6">Mechanical</option>
                    <option value="7">AIML</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-[#1A1F29] mb-2">Search:</label>
                  <input
                    type="text"
                    value={studentFilter}
                    onChange={(e) => setStudentFilter(e.target.value)}
                    placeholder="Reg No or Name..."
                    className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-xs sm:text-sm min-h-[44px]"
                    style={{ borderColor: "rgba(5,163,199,0.3)" }}
                  />
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="block text-xs sm:text-sm font-bold text-[#1A1F29] mb-2">Actions:</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={fetchRegistrationData}
                      disabled={loading}
                      className="px-2 py-2 rounded-lg text-white font-bold transition-all hover:shadow-lg active:scale-95 disabled:opacity-50 text-xs min-h-[44px]"
                      style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                      title="Refresh"
                    >
                      🔄
                    </button>
                    <button
                      onClick={() => {
                        setSemesterFilter("");
                        setDepartmentFilter("");
                        setStudentFilter("");
                      }}
                      className="px-2 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-bold transition-all active:scale-95 text-xs min-h-[44px]"
                      title="Reset Filters"
                    >
                      ↺
                    </button>
                    <button
                      onClick={clearAllRegistrationData}
                      disabled={loading}
                      className="px-2 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-bold transition-all active:scale-95 text-xs min-h-[44px]"
                      title="Clear All"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="flex-1 overflow-auto border-2 rounded-lg" style={{ borderColor: "rgba(5,163,199,0.2)" }}>
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
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-left font-black text-xs uppercase">Reg No</th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-left font-black text-xs uppercase">Name</th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-left font-black text-xs uppercase">Code</th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-left font-black text-xs uppercase">Subject</th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-center font-black text-xs uppercase">Credits</th>
                          <th className="px-3 sm:px-4 py-2 sm:py-3 text-center font-black text-xs uppercase">Sem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredData
                          .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                          .map((item, index) => (
                          <tr key={index} className="border-b-2 hover:bg-[#05A3C7]/5" style={{ borderColor: "rgba(5,163,199,0.1)" }}>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 font-mono font-bold" style={{ color: "#05A3C7" }}>{item.Reg_No}</td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-[#1A1F29] font-medium">{item.Name}</td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 font-mono text-green-600 font-bold">{item.Subject_Code}</td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-[#1A1F29]">{item.Subject_Name}</td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-center font-bold text-[#1A1F29]">{item.Credits}</td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-center">
                              <span className="px-2 py-1 rounded-full text-xs font-bold text-white" style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}>
                                {item.Sem}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {filteredData.length > itemsPerPage && (
                <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-3">
                  <div className="text-xs sm:text-sm text-[#5A6C7D] font-medium">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-2 border-2 rounded-lg disabled:opacity-50 hover:bg-[#05A3C7]/10 transition-colors text-xs sm:text-sm font-bold min-h-[44px]"
                      style={{ borderColor: "rgba(5,163,199,0.3)" }}
                    >
                      Previous
                    </button>
                    <span className="px-3 py-2 rounded-lg text-xs sm:text-sm font-bold text-white min-h-[44px] flex items-center" style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}>
                      {currentPage} of {Math.ceil(filteredData.length / itemsPerPage)}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredData.length / itemsPerPage), prev + 1))}
                      disabled={currentPage >= Math.ceil(filteredData.length / itemsPerPage)}
                      className="px-3 py-2 border-2 rounded-lg disabled:opacity-50 hover:bg-[#05A3C7]/10 transition-colors text-xs sm:text-sm font-bold min-h-[44px]"
                      style={{ borderColor: "rgba(5,163,199,0.3)" }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

    
      </div>
    </div>
  );
}
