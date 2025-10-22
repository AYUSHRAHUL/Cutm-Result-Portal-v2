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
    setUploadMessage(""); // Clear previous messages
    
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
        setUploadMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setUploadMessage(`❌ Error fetching data: ${error.message}`);
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
        setUploadMessage(`✅ Successfully cleared ${result.deletedCount} registration records`);
        setRegistrationData([]);
        setFilteredData([]);
        setDataStats(null);
      } else {
        setUploadMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setUploadMessage(`❌ Error: ${error.message}`);
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
      const beforeCount = filtered.length;
      filtered = filtered.filter(item => {
        const sem = String(item.Sem || '');
        const matches = sem === semesterFilter;
        return matches;
      });
    }
    
    if (departmentFilter) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(item => {
        // Ensure Reg_No is a string and has enough characters
        const regNo = String(item.Reg_No || '');
        if (!regNo || regNo.length < 8) {
          return false;
        }
        const deptCode = regNo.charAt(7);
        const matches = deptCode === departmentFilter;
        return matches;
      });
      console.log(`Department filter: ${beforeCount} → ${filtered.length}`);
    }
    
    if (studentFilter) {
      const beforeCount = filtered.length;
      const searchTerm = studentFilter.toLowerCase();
      filtered = filtered.filter(item => {
        const regNo = String(item.Reg_No || '').toLowerCase();
        const name = String(item.Name || '').toLowerCase();
        const regMatch = regNo.includes(searchTerm);
        const nameMatch = name.includes(searchTerm);
        const matches = regMatch || nameMatch;
        return matches;
      });
    }
    
      setFilteredData(filtered);
      setCurrentPage(1);
    } catch (error) {
      // Fallback: show all data if filtering fails
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
        setUploadMessage(`✅ Success! ${result.message}`);
        setUploadFile(null);
        setSelectedSemester("");
        // Reset file input
        const fileInput = document.getElementById('registrationFile');
        if (fileInput) fileInput.value = '';
      } else {
        let errorMsg = `❌ Error: ${result.error}`;
        if (result.debugInfo) {
          errorMsg += `\n\nDebug Info:\n- Total rows: ${result.debugInfo.totalRows}\n- Available columns: ${result.debugInfo.availableColumns?.join(', ')}\n- Sample row: ${JSON.stringify(result.debugInfo.sampleRow, null, 2)}`;
        }
        setUploadMessage(errorMsg);
      }
    } catch (error) {
      setUploadMessage(`❌ Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen text-gray-900 flex items-center justify-center bg-[linear-gradient(135deg,#667eea_0%,#764ba2_100%)] p-6">
      <div className="w-full max-w-4xl rounded-3xl bg-white p-10 shadow-[0_20px_40px_rgba(0,0,0,0.1)] text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#2c3e50] mb-4">📚 Data Management</h1>
        <p className="text-[#6c757d] mb-8 text-base leading-relaxed">Manage CBCS subjects and registration data</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* CBCS Management */}
          <div className="bg-gray-50 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-[#2c3e50] mb-4">🗂️ CBCS Management</h2>
            <p className="text-[#6c757d] mb-4 text-sm">Manage CBCS subjects and baskets</p>
            <div className="flex flex-col gap-3">
              <Link href="/dashboard/admin/data/basket" className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-semibold transition-transform hover:-translate-y-0.5 shadow-[0_8px_20px_rgba(102,126,234,0.4)]" style={{ background: "linear-gradient(45deg, #667eea, #764ba2)" }}>
                🗂️ View Baskets
              </Link>
              <Link href="/dashboard/admin/data/baskettrack" className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-semibold transition-transform hover:-translate-y-0.5 shadow-[0_8px_20px_rgba(86,171,47,0.4)]" style={{ background: "linear-gradient(45deg, #56ab2f, #a8e6cf)" }}>
                📊 Track Progress
              </Link>
            </div>
          </div>

          {/* Registration Data Management */}
          <div className="bg-gray-50 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-[#2c3e50] mb-4">📊 Registration Data</h2>
            <p className="text-[#6c757d] mb-4 text-sm">View and manage student registration data</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setShowRegistrationViewer(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-semibold transition-transform hover:-translate-y-0.5 shadow-[0_8px_20px_rgba(34,197,94,0.4)]"
                style={{ background: "linear-gradient(45deg, #22c55e, #16a34a)" }}
              >
                👁️ View Registration Data
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-semibold transition-transform hover:-translate-y-0.5 shadow-[0_8px_20px_rgba(255,107,107,0.4)]"
                style={{ background: "linear-gradient(45deg, #ff6b6b, #feca57)" }}
              >
                📤 Upload Registration Data
              </button>
              {/* <Link href="/dashboard/admin/upload" className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-semibold transition-transform hover:-translate-y-0.5 shadow-[0_8px_20px_rgba(59,130,246,0.4)]" style={{ background: "linear-gradient(45deg, #3b82f6, #1d4ed8)" }}>
                📊 Upload Results Data
              </Link> */}
            </div>
          </div>
        </div>

        {/* Data Status Information */}
        <div className="bg-blue-50 rounded-2xl p-6 mb-8">
          <h3 className="text-lg font-bold text-[#2c3e50] mb-3 flex items-center gap-2">
            ℹ️ Data Management Info
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">📤 Registration Data Upload:</h4>
              <ul className="text-gray-600 space-y-1">
                <li>• Updates only the selected semester</li>
                <li>• Preserves data from other semesters</li>
                <li>• Uses smart update/insert strategy</li>
                <li>• No data loss for other semesters</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">📊 Results Data Upload:</h4>
              <ul className="text-gray-600 space-y-1">
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full">
              <h3 className="text-xl font-bold text-[#2c3e50] mb-4">📤 Upload Registration Data</h3>
              
              <div className="mb-6">
                <h4 className="font-semibold text-gray-700 mb-2">📋 Expected Format:</h4>
                <div className="bg-gray-100 rounded-lg p-3 text-sm text-left">
                  <div className="font-mono text-xs">
                    <div>Sr. | Rollno | Name | Subject | Code | Type | Credit</div>
                    <div className="text-gray-500 mt-1">
                      Example:<br/>
                      1 | 220101120188 | Subrata Das | ROBOTIC AUTOMATION | CUTM1020 | PP | 1<br/>
                      2 | 220101120188 | Subrata Das | ROBOTIC AUTOMATION | CUTM1020 | PR | 2
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleFileUpload}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Semester:
                  </label>
                  <select
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select CSV/Excel File:
                  </label>
                  <input
                    id="registrationFile"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {uploadMessage && (
                  <div className={`mb-4 p-3 rounded-lg text-sm whitespace-pre-line ${
                    uploadMessage.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {uploadMessage}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadMessage("");
                      setUploadFile(null);
                      setSelectedSemester("");
                    }}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || !selectedSemester || !uploadFile}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-[#2c3e50] flex items-center gap-2">
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
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Data Statistics */}
              {dataStats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{dataStats.totalRecords}</div>
                    <div className="text-sm text-gray-600">Total Records</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{dataStats.uniqueStudents}</div>
                    <div className="text-sm text-gray-600"> Students</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">{dataStats.semesters.length}</div>
                    <div className="text-sm text-gray-600">Semesters</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">{5}</div>
                    <div className="text-sm text-gray-600">Departments</div>
                  </div>
                </div>
              )}

              {/* Status Messages */}
              {uploadMessage && (
                <div className={`rounded-lg p-4 mb-6 ${
                  uploadMessage.includes('❌') 
                    ? 'bg-red-50 border border-red-200' 
                    : uploadMessage.includes('✅') 
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-blue-50 border border-blue-200'
                }`}>
                  <div className={`font-semibold ${
                    uploadMessage.includes('❌') 
                      ? 'text-red-800' 
                      : uploadMessage.includes('✅') 
                      ? 'text-green-800'
                      : 'text-blue-800'
                  }`}>
                    {uploadMessage.includes('❌') ? '⚠️ Error' : 
                     uploadMessage.includes('✅') ? '✅ Success' : 
                     'ℹ️ Info'}
                  </div>
                  <div className={`text-sm mt-1 ${
                    uploadMessage.includes('❌') 
                      ? 'text-red-700' 
                      : uploadMessage.includes('✅') 
                      ? 'text-green-700'
                      : 'text-blue-700'
                  }`}>
                    {uploadMessage}
                  </div>
                </div>
              )}


              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Semester Filter:</label>
                  <select
                    value={semesterFilter}
                    onChange={(e) => setSemesterFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Semesters</option>
                    {dataStats?.semesters.map(sem => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department Filter:</label>
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Departments</option>
                    <option value="1">Civil Engineering</option>
                    <option value="2">Computer Science</option>
                    <option value="3">Electronics & Communication</option>
                    <option value="5">Electrical & Electronics</option>
                    <option value="6">Mechanical Engineering</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Student Search:</label>
                  <input
                    type="text"
                    value={studentFilter}
                    onChange={(e) => setStudentFilter(e.target.value)}
                    placeholder="Search by Reg No or Name..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="flex items-end gap-2">
                  <button
                    onClick={fetchRegistrationData}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {loading ? 'Loading...' : '🔄 Refresh Data'}
                  </button>
                  <button
                    onClick={() => {
                      setSemesterFilter("");
                      setDepartmentFilter("");
                      setStudentFilter("");
                    }}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                  >
                    🔄 Reset Filters
                  </button>
                  <button
                    onClick={clearAllRegistrationData}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
                  >
                    {loading ? 'Loading...' : '🗑️ Clear All Data'}
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Loading registration data...</p>
                    </div>
                  </div>
                ) : filteredData.length === 0 ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <div className="text-6xl mb-4">📊</div>
                      <p className="text-gray-600">No registration data found</p>
                      <p className="text-sm text-gray-500 mt-2">
                        {registrationData.length === 0 
                          ? "Upload some registration data to get started"
                          : "Try adjusting your filters"
                        }
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Reg No</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Subject Code</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Subject Name</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Credits</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Semester</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredData
                          .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                          .map((item, index) => (
                          <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-blue-600">{item.Reg_No}</td>
                            <td className="px-4 py-3">{item.Name}</td>
                            <td className="px-4 py-3 font-mono text-green-600">{item.Subject_Code}</td>
                            <td className="px-4 py-3">{item.Subject_Name}</td>
                            <td className="px-4 py-3 text-center">{item.Credits}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
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
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-gray-600">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} records
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded">
                      {currentPage} of {Math.ceil(filteredData.length / itemsPerPage)}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredData.length / itemsPerPage), prev + 1))}
                      disabled={currentPage >= Math.ceil(filteredData.length / itemsPerPage)}
                      className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-8">
          <Link href="/dashboard/admin" className="text-[#6c757d] hover:text-[#495057]">← Back to Admin</Link>
        </div>
      </div>
    </div>
  );
}


