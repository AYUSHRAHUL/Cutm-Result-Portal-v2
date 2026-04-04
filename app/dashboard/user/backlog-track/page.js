"use client";

import { useState, useEffect, useCallback } from "react";
import { getSchoolApiUrl } from "@/lib/api-helper";
import { resolveUserPanelSchool, getUserSchoolApiBase } from "@/lib/campus";

export default function UserBacklogTrack() {
  const [user, setUser] = useState(null);
  const [registration, setRegistration] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [backlogData, setBacklogData] = useState([]);
  const [totalBacklogs, setTotalBacklogs] = useState(0);
  const [autoFetched, setAutoFetched] = useState(false);

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
          if (
            userData.email &&
            (userData.email.includes("@cutm.ac.in") ||
              userData.email.includes("@centurionuniv.edu.in"))
          ) {
            const regNumber = userData.email.split("@")[0].toUpperCase();
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

  const fetchBacklogs = useCallback(async () => {
    setError("");
    setLoading(true);
    setBacklogData([]);
    setTotalBacklogs(0);
    
    try {
      if (!registration || registration.trim().length < 6) {
        throw new Error("Please enter a valid registration number (minimum 6 characters)");
      }
      
      const requestBody = {
        registration: registration.trim().toUpperCase()
      };
      
      console.log("User backlog search request:", requestBody);
      
      // For user panel, determine school from registration number
      const regNum = registration.trim().toUpperCase();
      const school = resolveUserPanelSchool(regNum, user?.school);
      const apiUrl = `${getUserSchoolApiBase(school)}/backlogs`;
      
      console.log("Determined school from registration:", school, "API URL:", apiUrl);
      
      const res = await fetch(apiUrl, {
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
  }, [registration, user?.school]);

  useEffect(() => {
    if (registration && registration.trim().length >= 6 && !autoFetched) {
      fetchBacklogs();
      setAutoFetched(true);
    }
  }, [registration, autoFetched, fetchBacklogs]);

  useEffect(() => {
    if (registration && registration.trim().length >= 6 && autoFetched && user?.school) {
      fetchBacklogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.school]);

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
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6 text-center">
              <h1 className="text-3xl font-bold text-gray-900">Backlog Tracker</h1>
              <p className="mt-1 text-sm text-gray-500">
                View your failed subjects and track your backlog progress
              </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                <h3 className="text-sm font-medium text-red-800">Unable to load backlogs</h3>
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

        {/* Empty State */}
        {!loading && !error && autoFetched && backlogData.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6 text-center text-gray-600">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No backlog subjects found</h3>
            <p className="text-sm">
              Great job! You currently have no pending subjects for registration <strong>{registration}</strong>.
            </p>
          </div>
        )}

        {/* Backlog Results Display */}
        {!loading && backlogData.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Backlog Subjects</h3>
                  <p className="text-sm text-gray-500">
                    Registration: <span className="font-medium text-gray-900">{registration}</span>
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-sm text-gray-600">
                    Total Subjects: <span className="font-semibold text-gray-900">{totalBacklogs}</span>
                  </span>
                  <div className="flex flex-wrap gap-2">
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
            </div>

            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[180px] border-collapse text-[9px] sm:text-sm">
                  <thead>
                    <tr className="bg-gray-100 border-b-2 border-gray-300 text-[9px] sm:text-xs">
                      <th className="px-1 py-0.5 sm:px-4 sm:py-3 text-left font-semibold text-gray-900 whitespace-nowrap">Sl.No</th>
                      <th className="px-1 py-0.5 sm:px-4 sm:py-3 text-left font-semibold text-gray-900 whitespace-nowrap">Subject Code</th>
                      <th className="px-1 py-0.5 sm:px-4 sm:py-3 text-left font-semibold text-gray-900">Subject Name</th>
                      <th className="px-1 py-0.5 sm:px-4 sm:py-3 text-center font-semibold text-gray-900">Semester</th>
                      <th className="px-1 py-0.5 sm:px-4 sm:py-3 text-center font-semibold text-gray-900">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backlogData.map((backlog, index) => {
                      const grade = backlog.Grade || backlog.grade || 'F';
                      
                      return (
                        <tr key={index} className="border-b border-gray-200 hover:bg-gray-50 transition-colors text-[9px] sm:text-sm">
                          <td className="px-1 py-0.5 sm:px-4 sm:py-3 text-center text-gray-900">{index + 1}</td>
                          <td className="px-1 py-0.5 sm:px-4 sm:py-3 text-gray-900 font-mono break-words">
                            {backlog.Subject_Code || backlog.subjectCode || 'N/A'}
                          </td>
                          <td className="px-1 py-0.5 sm:px-4 sm:py-3 text-gray-900 whitespace-normal break-words">
                            {backlog.Subject_Name || backlog.subjectName || 'N/A'}
                          </td>
                          <td className="px-1 py-0.5 sm:px-4 sm:py-3 text-center text-gray-900">
                            {backlog.Sem || backlog.semester || 'N/A'}
                          </td>
                          <td className="px-1 py-0.5 sm:px-4 sm:py-3 text-center">
                            <span className={`inline-flex items-center px-1 py-0.5 rounded-full text-[8px] sm:text-xs font-medium ${getGradeBackground(grade)}`}>
                              {grade}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
