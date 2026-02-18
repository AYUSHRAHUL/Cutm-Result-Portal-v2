"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getSchoolApiUrl } from "@/lib/api-helper";

function ResultDataManagementContent() {
  const searchParams = useSearchParams();
  const school = searchParams.get('school') || 'soet';
  const campus = searchParams.get('campus') || 'pkd';

  const [selectedProgram, setSelectedProgram] = useState(school);

  // Helper function to get school-specific API URL based on selected program
  const getApiUrl = (endpoint) => {
    const schoolPath = selectedProgram === 'sovet' ? 'sovet' : 'soet';
    const basePath = `/api/${schoolPath}/${endpoint}`;
    const campusParam = campus ? `?campus=${campus}` : '';
    return basePath + campusParam;
  };

  const [selectedBatch, setSelectedBatch] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  
  const [batches, setBatches] = useState([]);
  const [branches, setBranches] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [error, setError] = useState("");

  // Handle program selection change
  const handleProgramChange = (newProgram) => {
    setSelectedProgram(newProgram);
    localStorage.setItem('selectedSchool', newProgram);
    localStorage.setItem('school', newProgram);
    // Reset filters when switching programs
    setSelectedBatch("");
    setSelectedBranch("");
    setSelectedSemester("");
    setBatches([]);
    setBranches([]);
    setSubjects([]);
  };

  // OTP for subject deletion
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");

  // Students list modal
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [selectedSubjectForStudents, setSelectedSubjectForStudents] = useState(null);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState("");

  // Edit student modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // Set localStorage
  useEffect(() => {
    if (campus) localStorage.setItem('selectedCampus', campus);
    if (selectedProgram) localStorage.setItem('selectedSchool', selectedProgram);
  }, [campus, selectedProgram]);

  // Fetch batches
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        setLoadingBatches(true);
        setError("");
        
        // Build URL with explicit campus and school params
        const batchesUrl = getApiUrl('result-data/batches');
        console.log('Fetching batches from:', batchesUrl);
        
        // Try dedicated batches endpoint first
        let response = await fetch(batchesUrl, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.batches && Array.isArray(result.batches)) {
            console.log('Batches loaded:', result.batches.length);
            setBatches(result.batches);
            return;
          } else {
            console.warn('Batches response format issue:', result);
          }
        } else {
          const errorText = await response.text();
          console.warn('Batches endpoint failed:', response.status, errorText);
        }
        
        // Fallback to analytics API
        response = await fetch(getApiUrl('analytics'), {
          credentials: 'include'
        });
        
        if (response.ok) {
          const result = await response.json();
          // Analytics API returns { success: true, data: { performanceMetricsByBatch: [...] } }
          const analyticsData = result.data || result;
          const batchMetrics = analyticsData.performanceMetricsByBatch || analyticsData.batchStats || [];
          // Extract unique batches from analytics data
          const uniqueBatches = [...new Set(batchMetrics.map(b => b.batch).filter(Boolean))].sort();
          if (uniqueBatches.length > 0) {
            setBatches(uniqueBatches);
          } else {
            console.warn('No batches found in analytics data');
          }
        } else {
          console.error('Analytics API also failed:', response.status);
        }
      } catch (err) {
        console.error('Error fetching batches:', err);
      } finally {
        setLoadingBatches(false);
      }
    };
    
    fetchBatches();
  }, [selectedProgram, campus]);

  // Fetch branches when batch is selected
  useEffect(() => {
    if (!selectedBatch) {
      setBranches([]);
      return;
    }

    const fetchBranches = async () => {
      try {
        // Try dedicated branches endpoint first
        let response = await fetch(`${getApiUrl('result-data/branches')}?batch=${selectedBatch}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.branches && Array.isArray(result.branches)) {
            setBranches(result.branches);
            return;
          }
        } else {
          console.warn('Branches endpoint failed, trying analytics API fallback');
        }
        
        // Fallback to analytics API
        response = await fetch(`${getApiUrl('analytics')}?batch=${selectedBatch}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const result = await response.json();
          // Analytics API returns { success: true, data: { performanceMetricsByBranch: [...] } }
          const analyticsData = result.data || result;
          const branchMetrics = analyticsData.performanceMetricsByBranch || analyticsData.departmentStats || [];
          const uniqueBranches = [...new Set(branchMetrics.map(b => b.branch || b.name).filter(Boolean))].sort();
          if (uniqueBranches.length > 0) {
            setBranches(uniqueBranches);
          } else {
            console.warn('No branches found in analytics data');
          }
        } else {
          console.error('Analytics API also failed:', response.status);
        }
      } catch (err) {
        console.error('Error fetching branches:', err);
      }
    };
    
    fetchBranches();
  }, [selectedBatch]);

  // Fetch subjects when filters are selected
  useEffect(() => {
    if (!selectedBatch || !selectedBranch || !selectedSemester) {
      setSubjects([]);
      return;
    }

    const fetchSubjects = async () => {
      try {
        setLoading(true);
        setError("");
        
        // Ensure values are not empty
        if (!selectedBatch || !selectedBranch || !selectedSemester) {
          console.error('Missing filter values:', { selectedBatch, selectedBranch, selectedSemester });
          setError('Please select batch, branch, and semester');
          return;
        }

        const baseUrl = getApiUrl('result-data/subjects');
        // Check if baseUrl already has query params
        const separator = baseUrl.includes('?') ? '&' : '?';
        
        const params = new URLSearchParams({
          batch: String(selectedBatch).trim(),
          branch: String(selectedBranch).trim(),
          semester: String(selectedSemester).trim()
        });

        const subjectsUrl = `${baseUrl}${separator}${params}`;
        console.log('Fetching subjects from:', subjectsUrl);
        console.log('Filter values:', { batch: selectedBatch, branch: selectedBranch, semester: selectedSemester });
        
        const response = await fetch(subjectsUrl, {
          credentials: 'include'
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = 'Failed to fetch subjects';
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            errorMessage = errorText || errorMessage;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        if (data.success) {
          console.log('Subjects loaded:', data.subjects?.length || 0);
          setSubjects(data.subjects || []);
        } else {
          setError(data.error || 'Failed to load subjects');
        }
      } catch (err) {
        setError(err.message || 'Error loading subjects');
        setSubjects([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSubjects();
  }, [selectedBatch, selectedBranch, selectedSemester]);

  const handleViewStudents = async (subject) => {
    setSelectedSubjectForStudents(subject);
    setShowStudentsModal(true);
    setLoadingStudents(true);
    setStudentsError("");
    setStudents([]);

    try {
      const baseUrl = getApiUrl('result-data/students');
      const separator = baseUrl.includes('?') ? '&' : '?';
      
      const params = new URLSearchParams({
        subject: subject.code,
        batch: selectedBatch,
        branch: selectedBranch,
        semester: selectedSemester
      });

      const response = await fetch(`${baseUrl}${separator}${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to fetch students';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.success) {
        setStudents(data.students || []);
      } else {
        setStudentsError(data.error || 'Failed to load students');
      }
    } catch (err) {
      setStudentsError(err.message || 'Error loading students');
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleEditStudent = (student) => {
    setEditingStudent(student);
    setEditFormData({
      name: student.name,
      grade: student.grade,
      credits: student.credits
    });
    setShowEditModal(true);
  };

  const handleUpdateStudent = async () => {
    if (!editingStudent) return;

    try {
      const baseUrl = getApiUrl('result-data/student/update');
      const response = await fetch(baseUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          regNo: editingStudent.regNo,
          subjectCode: editingStudent.subjectCode,
          batch: selectedBatch,
          branch: selectedBranch,
          semester: selectedSemester,
          updates: editFormData
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('Student data updated successfully!');
        setShowEditModal(false);
        // Refresh students list
        handleViewStudents(selectedSubjectForStudents);
      } else {
        alert('Error: ' + (data.error || 'Failed to update student'));
      }
    } catch (err) {
      alert('Error updating student: ' + err.message);
    }
  };

  const handleDeleteStudent = async (student) => {
    if (!confirm(`Are you sure you want to delete data for student ${student.regNo}?`)) {
      return;
    }

    try {
      const baseUrl = getApiUrl('result-data/student/delete');
      const response = await fetch(baseUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          regNo: student.regNo,
          subjectCode: student.subjectCode,
          batch: selectedBatch,
          branch: selectedBranch,
          semester: selectedSemester
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('Student data deleted successfully!');
        // Refresh students list
        handleViewStudents(selectedSubjectForStudents);
        // Refresh subjects list to update counts
        const refreshBaseUrl = getSchoolApiUrl('result-data/subjects');
        const refreshSeparator = refreshBaseUrl.includes('?') ? '&' : '?';
        const params = new URLSearchParams({
          batch: selectedBatch,
          branch: selectedBranch,
          semester: selectedSemester
        });
        const refreshResponse = await fetch(`${refreshBaseUrl}${refreshSeparator}${params}`, {
          credentials: 'include'
        });
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          setSubjects(refreshData.subjects || []);
        }
      } else {
        alert('Error: ' + (data.error || 'Failed to delete student'));
      }
    } catch (err) {
      alert('Error deleting student: ' + err.message);
    }
  };

  const handleDeleteClick = (subject) => {
    setSelectedSubject(subject);
    setShowDeleteModal(true);
    setOtpSent(false);
    setOtp("");
    setOtpError("");
  };

  const handleRequestOTP = async () => {
    try {
      const response = await fetch(getApiUrl('result-data/otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          subject: selectedSubject.code,
          batch: selectedBatch,
          branch: selectedBranch,
          semester: selectedSemester,
          campus: campus
        })
      });

      const data = await response.json();
      if (data.success) {
        setOtpSent(true);
        setOtpError("");
        alert('OTP sent to your email!');
      } else {
        setOtpError(data.error || 'Failed to send OTP');
      }
    } catch (err) {
      setOtpError('Error sending OTP: ' + err.message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!otp.trim()) {
      setOtpError('Please enter OTP');
      return;
    }

    try {
      const response = await fetch(getApiUrl('result-data/delete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          subject: selectedSubject.code,
          batch: selectedBatch,
          branch: selectedBranch,
          semester: selectedSemester,
          campus: campus,
          otp: otp.trim()
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('Subject data deleted successfully!');
        setShowDeleteModal(false);
        // Refresh subjects list
        const refreshBaseUrl = getSchoolApiUrl('result-data/subjects');
        const refreshSeparator = refreshBaseUrl.includes('?') ? '&' : '?';
        const params = new URLSearchParams({
          batch: selectedBatch,
          branch: selectedBranch,
          semester: selectedSemester
        });
        const refreshResponse = await fetch(`${refreshBaseUrl}${refreshSeparator}${params}`, {
          credentials: 'include'
        });
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          setSubjects(refreshData.subjects || []);
        }
      } else {
        setOtpError(data.error || 'Failed to delete data');
      }
    } catch (err) {
      setOtpError('Error deleting data: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Result Data Management</h1>
          <p className="text-gray-600">Filter by batch, branch, and semester to view and manage subject data</p>
        </div>

        {/* Program Selector */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-600 mb-3 uppercase">Select Program</h2>
          <div className="flex gap-3">
            <button
              onClick={() => handleProgramChange('soet')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                selectedProgram === 'soet'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              B.Tech (SOET)
            </button>
            <button
              onClick={() => handleProgramChange('sovet')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                selectedProgram === 'sovet'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Diploma (SOVET)
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Batch
                {loadingBatches && <span className="ml-2 text-xs text-gray-500">(Loading...)</span>}
              </label>
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loadingBatches}
              >
                <option value="">{loadingBatches ? "Loading batches..." : "Select Batch"}</option>
                {batches.length === 0 && !loadingBatches ? (
                  <option value="" disabled>No batches available</option>
                ) : (
                  batches.map(batch => (
                    <option key={batch} value={batch}>{batch}</option>
                  ))
                )}
              </select>
              {!loadingBatches && batches.length === 0 && (
                <p className="mt-1 text-xs text-yellow-600">No batches found. Check if data exists.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Branch
                {selectedBatch && branches.length === 0 && !loadingBatches && (
                  <span className="ml-2 text-xs text-gray-500">(Select batch first)</span>
                )}
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!selectedBatch}
              >
                <option value="">{!selectedBatch ? "Select batch first" : branches.length === 0 ? "Loading branches..." : "Select Branch"}</option>
                {branches.map(branch => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
              {selectedBatch && branches.length === 0 && (
                <p className="mt-1 text-xs text-yellow-600">No branches found for this batch.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Semester</option>
                {['1', '2', '3', '4', '5', '6', '7', '8'].map(sem => (
                  <option key={sem} value={sem}>Semester {sem}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Subjects Table */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading subjects...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <p className="text-red-600">{error}</p>
          </div>
        ) : selectedBatch && selectedBranch && selectedSemester && subjects.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">Subjects</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject Name</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">No. of Students</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {subjects.map((subject, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{subject.code}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{subject.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600">{subject.studentCount}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                        <button
                          onClick={() => handleViewStudents(subject)}
                          className="mr-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          View Students
                        </button>
                        <button
                          onClick={() => handleDeleteClick(subject)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          Delete Subject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : selectedBatch && selectedBranch && selectedSemester ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <p className="text-gray-600">No subjects found for the selected filters.</p>
          </div>
        ) : null}

        {/* Students List Modal */}
        {showStudentsModal && selectedSubjectForStudents && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-200 flex-shrink-0">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">Students List</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedSubjectForStudents.code} - {selectedSubjectForStudents.name}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowStudentsModal(false);
                      setStudents([]);
                    }}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ×
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                {loadingStudents ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading students...</p>
                  </div>
                ) : studentsError ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <p className="text-red-600">{studentsError}</p>
                  </div>
                ) : students.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-600">No students found for this subject.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reg No</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Grade</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Credits</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {students.map((student, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{student.regNo}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{student.name || '-'}</td>
                            <td className="px-4 py-3 text-sm text-center text-gray-600">{student.grade || '-'}</td>
                            <td className="px-4 py-3 text-sm text-center text-gray-600">{student.credits || '-'}</td>
                            <td className="px-4 py-3 text-sm text-center">
                              <button
                                onClick={() => handleEditStudent(student)}
                                className="mr-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteStudent(student)}
                                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Edit Student Modal */}
        {showEditModal && editingStudent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Edit Student Data</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
                  <input
                    type="text"
                    value={editingStudent.regNo}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={editFormData.name || ''}
                    onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                  <input
                    type="text"
                    value={editFormData.grade || ''}
                    onChange={(e) => setEditFormData({...editFormData, grade: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Credits</label>
                  <input
                    type="text"
                    value={editFormData.credits || ''}
                    onChange={(e) => setEditFormData({...editFormData, credits: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleUpdateStudent}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Update
                  </button>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Subject Modal with OTP */}
        {showDeleteModal && selectedSubject && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Delete All Subject Data</h3>
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete <strong>ALL student data</strong> for <strong>{selectedSubject.code} - {selectedSubject.name}</strong>?
                <br />
                <span className="text-red-600 font-semibold">This will delete data for all {selectedSubject.studentCount} students. This action cannot be undone.</span>
              </p>
              
              {!otpSent ? (
                <button
                  onClick={handleRequestOTP}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mb-4"
                >
                  Send OTP to Email
                </button>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Enter OTP</label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter 6-digit OTP"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                    maxLength={6}
                  />
                  {otpError && (
                    <p className="text-red-600 text-sm mb-4">{otpError}</p>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={handleConfirmDelete}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Confirm Delete
                    </button>
                    <button
                      onClick={() => setShowDeleteModal(false)}
                      className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                    >
                      Cancel
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

export default function ResultDataManagement() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ResultDataManagementContent />
    </Suspense>
  );
}

