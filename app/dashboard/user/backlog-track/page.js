"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UserBacklogTrack() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [registration, setRegistration] = useState("");
  const [semesters, setSemesters] = useState([]);
  const [semesterValues, setSemesterValues] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSemesters, setLoadingSemesters] = useState(false);
  
  // Results state
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [backlogData, setBacklogData] = useState([]);
  const [totalBacklogs, setTotalBacklogs] = useState(0);

  // Fetch user data and auto-fill registration
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          const userData = data.user || data;
          setUser(userData);
          
          // Auto-fill registration number for user's own results
          if (userData.email && userData.email.includes('@cutm.ac.in')) {
            const regNumber = userData.email.split('@')[0];
            setRegistration(regNumber);
            console.log('Auto-filled registration number:', regNumber);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, []);

  function clearFilters() {
    setSemesterValues([]);
    setError("");
    setBacklogData([]);
    setTotalBacklogs(0);
    setSearchPerformed(false);
    setSemesters([]);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSearchPerformed(true);
    setLoading(true);
    
    // Reset previous results immediately
    setBacklogData([]);
    setTotalBacklogs(0);
    
    try {
      // Enhanced validation for individual search
      if (!registration || registration.trim().length < 6) {
        throw new Error("Please enter a valid registration number (minimum 6 characters)");
      }
      
      // Individual student search for backlogs
      const requestBody = {
        registration: registration.trim().toUpperCase(),
        semesters: semesterValues.length > 0 && !semesterValues.includes("All") ? semesterValues : []
      };
      
      console.log("User backlog search request:", requestBody);
      
      const res = await fetch("/api/backlogs", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json" 
        },
        body: JSON.stringify(requestBody)
      });
      
      let data;
      try {
        const responseText = await res.text();
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error("Invalid response from server");
      }
      
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`No backlog data found for registration ${registration}.`);
        } else if (res.status === 403) {
          throw new Error("Access denied. You can only view your own backlog information.");
        } else {
          throw new Error(data.error || "Unable to load backlog data");
        }
      }
      
      // Process backlog data
      const backlogs = data.backlogs || data.data || [];
      const total = data.total || backlogs.length;
      
      if (!backlogs || backlogs.length === 0) {
        throw new Error(`No backlog subjects found for registration ${registration}.`);
      }
      
      setBacklogData(backlogs);
      setTotalBacklogs(total);
    } catch (err) {
      setError(err.message);
      setBacklogData([]);
      setTotalBacklogs(0);
    } finally {
      setLoading(false);
    }
  }

  // Load semesters for registration
  async function loadSemestersForRegistration(value) {
    if (!value || value === "all") {
      setSemesters([]);
      return;
    }
    
    try {
      setLoadingSemesters(true);
      const res = await fetch("/api/semesters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No semesters found");
      setSemesters(data.semesters || []);
    } catch (err) {
      setError(err.message);
      setSemesters([]);
    } finally {
      setLoadingSemesters(false);
    }
  }

  // Handle registration change
  const handleRegistrationChange = (e) => {
    const reg = e.target.value.toUpperCase();
    setRegistration(reg);
    setError("");
    setSemesterValues([]);
    
    // Auto-fetch when registration has 6+ characters
    if (reg.length >= 6) {
      loadSemestersForRegistration(reg);
    } else {
      setSemesters([]);
    }
  };

  // Export functions
  const exportToCSV = () => {
    if (!backlogData || backlogData.length === 0) return;
    
    const csvContent = [
      ["Subject Code", "Subject Name", "Credits", "Semester", "Grade", "Attempts"],
      ...backlogData.map(backlog => [
        backlog.Subject_Code || backlog.subjectCode || '',
        backlog.Subject_Name || backlog.subjectName || '',
        backlog.Credits || backlog.credits || 0,
        backlog.Sem || backlog.semester || '',
        backlog.Grade || backlog.grade || '',
        backlog.Attempts || backlog.attempts || 1
      ])
    ].map(row => row.join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backlog_subjects_${registration}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToExcel = () => {
    // For now, just export as CSV
    exportToCSV();
  };

  // Get grade color
  const getGradeColor = (grade) => {
    if (["O", "E", "A"].includes(grade)) return "text-green-600";
    if (["B", "C"].includes(grade)) return "text-blue-600";
    return "text-red-600";
  };

  // Get grade background
  const getGradeBackground = (grade) => {
    if (["O", "E", "A"].includes(grade)) return "bg-green-100 text-green-800";
    if (["B", "C"].includes(grade)) return "bg-blue-100 text-blue-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Backlog Tracker</h1>
              <p className="mt-1 text-sm text-gray-500">
                View your failed subjects and track your backlog progress
              </p>
            </div>
            <Link
              href="/dashboard/user"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Form */}
        <div className="bg-white rounded-lg shadow-sm border mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Search Your Backlog Subjects</h2>
            <p className="text-sm text-gray-600 mt-1">
              Enter your registration number to view your failed subjects
            </p>
          </div>
          
          <form onSubmit={onSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Registration Number */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Registration Number:</label>
                <input
                  type="text"
                  value={registration}
                  readOnly
                  placeholder="Your registration number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-black"
                  required
                />
                <div className="text-xs text-gray-500">
                  💡 Your registration number is auto-filled from your profile and cannot be changed
                </div>
              </div>

              {/* Semester */}
              {/* <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Semester:</label>
                <select 
                  value={semesterValues.length > 0 ? semesterValues[0] : ""} 
                  onChange={e => setSemesterValues([e.target.value])} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-black"
                  disabled={loadingSemesters}
                >
                  <option value="">Select Semester</option>
                  <option value="All">All Semesters</option>
                  {semesters.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {loadingSemesters && <div className="text-xs text-gray-500">Loading semesters...</div>}
              </div> */}
            </div>

            {/* Submit and Clear Buttons */}
            <div className="flex justify-center space-x-4 mt-6">
              <button 
                type="submit" 
                className={`px-8 py-3 bg-orange-600 text-white font-medium rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors ${
                  loading ? 'opacity-70 cursor-not-allowed' : ''
                }`}
                disabled={loading}
              >
                {loading ? "Loading..." : "Search Backlogs"}
              </button>
              
              <button 
                type="button"
                onClick={clearFilters}
                className="px-8 py-3 bg-gray-600 text-white font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </form>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Search Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="bg-orange-50 border border-orange-200 rounded-md p-4 mb-6">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600 mr-2"></div>
              <div className="text-orange-800">Loading your backlog subjects...</div>
            </div>
          </div>
        )}

        {/* Search Status Information */}
        {searchPerformed && !loading && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
            <div className="text-green-800 text-sm">
              <strong>Search Completed:</strong><br/>
              Registration: {registration}<br/>
              Semester: {semesterValues.length > 0 && semesterValues[0] !== "All" ? semesterValues[0] : "All Semesters"}<br/>
              Total Backlog Subjects: {totalBacklogs}<br/>
              {backlogData.length > 0 && (
                <span className="text-green-600">
                  ✅ Your backlog subjects have been loaded successfully
                </span>
              )}
            </div>
          </div>
        )}

        {/* No Results Message */}
        {searchPerformed && !loading && backlogData.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-md p-6 mb-6">
            <div className="text-center">
              <div className="text-green-600 text-4xl mb-4">🎉</div>
              <h3 className="text-lg font-semibold text-green-800 mb-2">No Backlog Subjects Found!</h3>
              <p className="text-green-700 mb-4">
                Congratulations! You have no failed subjects for registration number: <strong>{registration}</strong>
              </p>
              <p className="text-green-600 text-sm">
                This means you have successfully completed all your subjects. Keep up the excellent work!
              </p>
            </div>
          </div>
        )}

        {/* Backlog Results Display */}
        {searchPerformed && !loading && backlogData.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border">
            {/* Export Buttons */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Your Backlog Subjects</h3>
                <div className="flex space-x-2">
                  {/* <button 
                    onClick={exportToCSV} 
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                  >
                    Export CSV
                  </button> */}
                  <button 
                    onClick={exportToExcel} 
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                  >
                    Export Excel
                  </button>
                  <button 
                    onClick={() => window.print()} 
                    className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                  >
                    Print
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Summary Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{totalBacklogs}</div>
                    <div className="text-sm text-red-700">Total Backlog Subjects</div>
                  </div>
                </div>
               
              </div>

              {/* Backlog Subjects Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b-2 border-gray-300">
                      <th className="px-4 py-3 text-left font-semibold text-gray-900">Sl.No</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-900">Subject Code</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-900">Subject Name</th>
                      {/* <th className="px-4 py-3 text-center font-semibold text-gray-900">Credits</th> */}
                      <th className="px-4 py-3 text-center font-semibold text-gray-900">Semester</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-900">Grade</th>
                      {/* <th className="px-4 py-3 text-center font-semibold text-gray-900">Attempts</th> */}
                      {/* <th className="px-4 py-3 text-center font-semibold text-gray-900">Status</th> */}
                    </tr>
                  </thead>
                  <tbody>
                    {backlogData.map((backlog, index) => {
                      const grade = backlog.Grade || backlog.grade || 'F';
                      const attempts = backlog.Attempts || backlog.attempts || 1;
                      const isFailed = ["F", "S", "I"].includes(grade);
                      
                      return (
                        <tr key={index} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-center text-gray-900">{index + 1}</td>
                          <td className="px-4 py-3 text-gray-900 font-mono">
                            {backlog.Subject_Code || backlog.subjectCode || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-gray-900">
                            {backlog.Subject_Name || backlog.subjectName || 'N/A'}
                          </td>
                          {/* <td className="px-4 py-3 text-center text-gray-900">
                            {backlog.Credits || backlog.credits || 0}
                          </td> */}
                          <td className="px-4 py-3 text-center text-gray-900">
                            {backlog.Sem || backlog.semester || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getGradeBackground(grade)}`}>
                              {grade}
                            </span>
                          </td>
                          {/* <td className="px-4 py-3 text-center text-gray-900">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {attempts}
                            </span>
                          </td> */}
                          {/* <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              isFailed 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {isFailed ? 'Failed' : 'Passed'}
                            </span>
                          </td> */}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Important Notes */}
              <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-yellow-800 mb-2">📝 Important Notes:</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Failed subjects (F, S, M grades) need to be cleared in subsequent semesters</li>
                  <li>• Contact your academic advisor for guidance on clearing backlogs</li>
                  <li>• Some subjects may have specific clearance requirements</li>
                  <li>• Keep track of your progress and plan your studies accordingly</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
