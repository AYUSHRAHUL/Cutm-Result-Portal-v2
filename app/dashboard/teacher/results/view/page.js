"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ResultPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registration = searchParams.get("reg");
  const semester = searchParams.get("sem");

  const [result, setResult] = useState(null);
  const [allResults, setAllResults] = useState(null);
  const [isMultipleSemesters, setIsMultipleSemesters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSemester, setActiveSemester] = useState(0);

  useEffect(() => {
    if (!registration || !semester) {
      setError("Missing registration number or semester");
      setLoading(false);
      return;
    }

    const fetchResults = async () => {
      try {
        setLoading(true);
        setError("");

        // Check if multiple semesters are selected
        const semesters = semester.split(',');
        setIsMultipleSemesters(semesters.length > 1);

        if (semesters.length > 1) {
          // Fetch results for all semesters
          const semesterResults = {};

          for (const sem of semesters) {
            const res = await fetch("/api/result", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ registration, semester: sem.trim() }),
            });

            if (!res.ok) {
              const errorData = await res.json();
              throw new Error(errorData.error || `Failed to fetch results for ${sem}`);
            }

            const data = await res.json();
            semesterResults[sem.trim()] = data;
          }

          setAllResults(semesterResults);
          setActiveSemester(0); // Start with first semester
        } else {
          // Single semester
          const res = await fetch("/api/result", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ registration, semester }),
          });

          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || "Failed to fetch results");
          }

          const data = await res.json();
          setResult(data);
        }
      } catch (err) {
        console.error("Error fetching results:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [registration, semester]);

  const parseCredits = (credits) => {
    if (!credits) return 0;
    if (typeof credits === 'number') return credits;
    if (typeof credits === 'string') {
      // Handle formats like "1+2+3" or "3"
      return credits.split('+').reduce((sum, c) => sum + (parseFloat(c.trim()) || 0), 0);
    }
    return 0;
  };

  const isFailingGrade = (grade) => {
    const failingGrades = ['F', 'S', 'I', 'M', 'R'];
    return failingGrades.includes(String(grade || '').toUpperCase().trim());
  };

  const getCreditsCleared = (subjects) => {
    return subjects.reduce((sum, s) => {
      const credits = parseCredits(s.Credits);
      return isFailingGrade(s.Grade) ? sum : sum + credits;
    }, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-6"></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Loading Results</h2>
          <p className="text-gray-600">Please wait while we fetch the academic records...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="text-red-600 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Results</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => router.push("/dashboard/teacher/results")}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-3 rounded-lg transition"
            >
              ← Back to Results Search
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-5 py-3 rounded-lg transition"
            >
              🔄 Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalCredits = result ? result.subjects.reduce((sum, s) => sum + parseCredits(s?.Credits), 0) : 0;
  const creditsCleared = result ? getCreditsCleared(result.subjects) : 0;

  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            transform: none;
            transform-origin: top left;
            background: white;
            box-shadow: none;
            margin: 0;
            padding: 15mm;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
          /* Multi-page support for multiple semesters */
          .semester-page-break {
            page-break-before: always;
            margin-top: 0;
            padding-top: 0;
          }
          .semester-page-break:first-child {
            page-break-before: avoid;
          }
          /* Compact fonts/padding for better fit */
          .print-area h1 { font-size: 18px; margin-bottom: 8px; }
          .print-area h2 { font-size: 14px; margin-bottom: 6px; }
          .print-area h3 { font-size: 16px; margin-bottom: 8px; }
          .print-area table { font-size: 11px; margin-bottom: 10px; }
          .print-area th, .print-area td { padding: 4px 6px !important; }
          .print-summary { font-size: 11px; margin-bottom: 10px; display: flex !important; flex-wrap: wrap !important; gap: 12px !important; }
          .print-summary > div { flex: 1 1 auto !important; min-width: fit-content !important; }
          .print-logo { width: 70px !important; height: 70px !important; }
          .avoid-break { page-break-inside: avoid; }
          .print-area .mb-6 { margin-bottom: 15px !important; }
          .print-area .mb-8 { margin-bottom: 20px !important; }
          .print-area .space-y-2 > * + * { margin-top: 4px !important; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50 py-8 px-4">
        {/* Header Info */}
        <div className="max-w-4xl mx-auto mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-600">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <h1 className="text-lg font-bold text-gray-900">Academic Results - Teacher View</h1>
                <p className="text-sm text-gray-600">
                  Registration: <span className="font-mono font-semibold">{registration}</span>
                  {isMultipleSemesters ? (
                    <span className="block sm:inline"> • {Object.keys(allResults || {}).length} Semesters Selected</span>
                  ) : (
                    <span className="block sm:inline"> • {semester}</span>
                  )}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-sm text-gray-500">Generated on</div>
                <div className="text-sm font-semibold text-gray-700">
                  {new Date().toLocaleDateString('en-GB', { 
                    day: '2-digit', 
                    month: 'short', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Single Semester View */}
        {!isMultipleSemesters && result && (
          <div className="print-area bg-white shadow-lg rounded-lg p-8 w-full max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="flex justify-center mb-3">
                <img
                  src="https://tse1.mm.bing.net/th/id/OIP.yR5DUnUlOBL5eCaPQ9HFgwHaHZ?rs=1&pid=ImgDetMain"
                  alt="CUTM Logo"
                  className="w-20 h-20 rounded-full   "
                />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Centurion University of Technology and Management
              </h1>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">
                School Of Engineering & Technology, Paralakhemundi
              </h2>
              <p className="text-base font-semibold text-gray-800">Paralakhemundi Campus</p>
              <h3 className="text-xl font-bold text-gray-900 ">
                Semester Grade Sheet
              </h3>
            </div>

            {/* Student Information */}
            <div className="mb-6 space-y-2 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <p><span className="font-semibold">Student Regd. No.:</span> {registration}</p>
                <p><span className="font-semibold">Semester:</span> {semester.replace('Semester ', 'Sem ')}</p>
              </div>
              <p><span className="font-semibold">Student Name:</span> {result.name || 'N/A'}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <p><span className="font-semibold">Course:</span> {result.course || 'B.Tech'}</p>
                <p><span className="font-semibold">Batch:</span> {result.batch || 'N/A'}</p>
              </div>
              <p><span className="font-semibold">Branch:</span> {result.branch || 'Electronics and Communication Engineering'}</p>
            </div>

            {/* Results Table */}
            <div className="mb-6 overflow-x-auto avoid-break">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="border border-gray-700 px-3 py-2 text-center font-bold">SL.NO</th>
                    <th className="border border-gray-700 px-3 py-2 text-left font-bold">SUB.CODE</th>
                    <th className="border border-gray-700 px-4 py-2 text-left font-bold">SUBJECT</th>
                    <th className="border border-gray-700 px-3 py-2 text-center font-bold">CREDIT</th>
                    <th className="border border-gray-700 px-3 py-2 text-center font-bold">GRADE</th>
                  </tr>
                </thead>
                <tbody>
                  {result.subjects.map((s, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-3 py-2 text-center">{i + 1}</td>
                      <td className="border border-gray-300 px-3 py-2 font-mono">{s.Subject_Code}</td>
                      <td className="border border-gray-300 px-4 py-2">{s.Subject_Name}</td>
                      <td className="border border-gray-300 px-3 py-2 text-center">{parseCredits(s.Credits)}</td>
                      <td className={`border border-gray-300 px-3 py-2 text-center font-bold ${isFailingGrade(s.Grade) ? 'text-red-600' : 'text-gray-900'}`}>
                        {s.Grade}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary Statistics */}
            <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm print-summary">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">Total Credits:</span>
                <span className="font-bold text-gray-900">{totalCredits}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">Credits Cleared:</span>
                <span className="font-bold text-gray-900">{creditsCleared}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">SGPA:</span>
                <span className="font-bold text-gray-900">{result.sgpa}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">CGPA:</span>
                <span className="font-bold text-gray-900">{result.cgpa}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between text-sm text-gray-700 border-t pt-4 mt-8">
              <p>Date : {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              <p className="font-semibold">Dean, Examinations</p>
            </div>

            {/* Action Buttons */}
            <div className="no-print mt-8 flex flex-col sm:flex-row justify-between gap-4">
              <button
                onClick={() => router.push("/dashboard/teacher/results")}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-5 py-2 rounded-lg transition"
              >
                ← Back to Search
              </button>
              <button
                onClick={() => window.print()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg transition shadow-md"
              >
                🖨️ Print / Save as PDF
              </button>
            </div>
          </div>
        )}

        {/* Multiple Semesters View with Sidebar */}
        {isMultipleSemesters && allResults && (
          <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto">
            {/* Sidebar Navigation */}
            <div className="w-full lg:w-80 bg-white rounded-lg shadow-sm p-4 lg:h-fit lg:sticky lg:top-4 order-2 lg:order-1">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <span className="mr-2">📊</span>
                Semester Navigation
              </h3>
              <div className="space-y-2">
                {Object.entries(allResults).map(([sem, data], index) => (
                  <button
                    key={sem}
                    onClick={() => setActiveSemester(index)}
                    className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                      activeSemester === index
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="font-semibold text-sm">{sem.replace('Semester ', 'Sem ')}</div>
                    <div className={`text-xs mt-1 ${
                      activeSemester === index ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      <span className="block sm:inline">SGPA: <span className="font-semibold">{data.sgpa || 'N/A'}</span></span>
                      <span className="hidden sm:inline"> • </span>
                      <span className="block sm:inline">CGPA: <span className="font-semibold">{data.cgpa || data.cumulativeCgpa || 'N/A'}</span></span>
                    </div>
                    <div className={`text-xs mt-1 ${
                      activeSemester === index ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      <span className="block sm:inline">{data.subjects.length} Subjects</span>
                      <span className="hidden sm:inline"> • </span>
                      <span className="block sm:inline">{data.subjects.reduce((sum, s) => sum + parseCredits(s?.Credits), 0)} Credits</span>
                    </div>
                  </button>
                ))}
              </div>
              
              {/* Quick Stats */}
              <div className="mt-6 p-3 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-900 text-sm mb-2">Overall Summary</h4>
                <div className="space-y-1 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Total Semesters:</span>
                    <span className="font-semibold">{Object.keys(allResults).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Subjects:</span>
                    <span className="font-semibold">{Object.values(allResults).reduce((sum, data) => sum + data.subjects.length, 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Credits:</span>
                    <span className="font-semibold">{Object.values(allResults).reduce((sum, data) => sum + data.subjects.reduce((s, sub) => s + parseCredits(sub?.Credits), 0), 0)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => router.push("/dashboard/teacher/results")}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-4 py-2 rounded-lg transition text-sm"
                >
                  ← Back to Search
                </button>
                <button
                  onClick={() => window.print()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition text-sm"
                >
                  🖨️ Print All Semesters
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 order-1 lg:order-2">
              {Object.entries(allResults).map(([sem, data], index) => (
                <div 
                  key={sem} 
                  className={`print-area bg-white shadow-lg rounded-lg p-8 ${
                    activeSemester === index ? 'block' : 'hidden'
                  }`}
                >
                  {/* Header for each semester */}
                  <div className="text-center mb-6">
                    <div className="flex justify-center mb-3">
                      <img
                        src="https://tse1.mm.bing.net/th/id/OIP.yR5DUnUlOBL5eCaPQ9HFgwHaHZ?rs=1&pid=ImgDetMain"
                        alt="CUTM Logo"
                        className="w-20 h-20 rounded-full    "
                      />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                      Centurion University of Technology and Management
                    </h1>
                    <h2 className="text-lg font-semibold text-gray-800 mb-1">
                      School Of Engineering & Technology, Paralakhemundi
                    </h2>
                    <p className="text-base font-semibold text-gray-800">Paralakhemundi Campus</p>
                    <h3 className="text-xl font-semibold text-gray-900 ">
                      Semester Grade Sheet
                    </h3>
                  </div>

                  {/* Student Information for each semester */}
                  <div className="mb-6 space-y-2 text-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <p><span className="font-semibold">Student Regd. No.:</span> {registration}</p>
                      <p><span className="font-semibold">Semester:</span> {sem.replace('Semester ', 'Sem ')}</p>
                    </div>
                    <p><span className="font-semibold">Student Name:</span> {data.name || 'N/A'}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <p><span className="font-semibold">Course:</span> {data.course || 'B.Tech'}</p>
                      <p><span className="font-semibold">Batch:</span> {data.batch || 'N/A'}</p>
                    </div>
                    <p><span className="font-semibold">Branch:</span> {data.branch || 'Electronics and Communication Engineering'}</p>
                  </div>

                  {/* Results Table for each semester */}
                  <div className="mb-6 overflow-x-auto avoid-break">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-blue-600 text-white">
                          <th className="border border-gray-700 px-3 py-2 text-center font-bold">SL.NO</th>
                          <th className="border border-gray-700 px-3 py-2 text-left font-bold">SUB.CODE</th>
                          <th className="border border-gray-700 px-4 py-2 text-left font-bold">SUBJECT</th>
                          <th className="border border-gray-700 px-3 py-2 text-center font-bold">CREDIT</th>
                          <th className="border border-gray-700 px-3 py-2 text-center font-bold">GRADE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.subjects.map((s, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-3 py-2 text-center">{i + 1}</td>
                            <td className="border border-gray-300 px-3 py-2 font-mono">{s.Subject_Code}</td>
                            <td className="border border-gray-300 px-4 py-2">{s.Subject_Name}</td>
                            <td className="border border-gray-300 px-3 py-2 text-center">{parseCredits(s.Credits)}</td>
                            <td className={`border border-gray-300 px-3 py-2 text-center font-bold ${isFailingGrade(s.Grade) ? 'text-red-600' : 'text-gray-900'}`}>
                              {s.Grade}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Statistics for each semester */}
                  <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm print-summary">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-700">Total Credits:</span>
                      <span className="font-bold text-gray-900">{data.subjects.reduce((sum, s) => sum + parseCredits(s?.Credits), 0)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-700">Credits Cleared:</span>
                      <span className="font-bold text-gray-900">{getCreditsCleared(data.subjects)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-700">SGPA:</span>
                      <span className="font-bold text-gray-900">{data.sgpa}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-700">CGPA:</span>
                      <span className="font-bold text-gray-900">{data.cgpa || data.cumulativeCgpa || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Footer for each semester */}
                  <div className="flex justify-between text-sm text-gray-700 border-t pt-4 mt-8">
                    <p>Date : {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    <p className="font-semibold">Dean, Examinations</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Print View - All Semesters for PDF */}
        {isMultipleSemesters && allResults && (
          <div className="hidden print:block">
            {Object.entries(allResults).map(([sem, data], index) => (
              <div key={`print-${sem}`} className="print-area bg-white p-8 semester-page-break">
                {/* Header for each semester */}
                <div className="text-center mb-6">
                  <div className="flex justify-center mb-3">
                    <img
                      src="https://tse1.mm.bing.net/th/id/OIP.yR5DUnUlOBL5eCaPQ9HFgwHaHZ?rs=1&pid=ImgDetMain"
                      alt="CUTM Logo"
                      className="w-20 h-20 rounded-full border-4 "
                    />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Centurion University of Technology and Management
                  </h1>
                  <h2 className="text-lg font-semibold text-gray-800 mb-1">
                    School Of Engineering & Technology, Paralakhemundi
                  </h2>
                  <p className="text-base text-gray-700">Paralakhemundi Campus</p>
                  <h3 className="text-xl font-bold text-gray-900 mt-4">
                    Semester Grade Sheet
                  </h3>
                </div>

                {/* Student Information for each semester */}
                <div className="mb-6 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <p><span className="font-semibold">Student Regd. No.:</span> {registration}</p>
                    <p><span className="font-semibold">Semester:</span> {sem.replace('Semester ', 'Sem ')}</p>
                  </div>
                  <p><span className="font-semibold">Student Name:</span> {data.name || 'N/A'}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <p><span className="font-semibold">Course:</span> {data.course || 'B.Tech'}</p>
                    <p><span className="font-semibold">Batch:</span> {data.batch || 'N/A'}</p>
                  </div>
                  <p><span className="font-semibold">Branch:</span> {data.branch || 'Electronics and Communication Engineering'}</p>
                </div>

                {/* Results Table for each semester */}
                <div className="mb-6 overflow-x-auto avoid-break">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-blue-600 text-white">
                        <th className="border border-gray-700 px-3 py-2 text-center font-bold">SL.NO</th>
                        <th className="border border-gray-700 px-3 py-2 text-left font-bold">SUB.CODE</th>
                        <th className="border border-gray-700 px-4 py-2 text-left font-bold">SUBJECT</th>
                        <th className="border border-gray-700 px-3 py-2 text-center font-bold">CREDIT</th>
                        <th className="border border-gray-700 px-3 py-2 text-center font-bold">GRADE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.subjects.map((s, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-3 py-2 text-center">{i + 1}</td>
                          <td className="border border-gray-300 px-3 py-2 font-mono">{s.Subject_Code}</td>
                          <td className="border border-gray-300 px-4 py-2">{s.Subject_Name}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{parseCredits(s.Credits)}</td>
                          <td className={`border border-gray-300 px-3 py-2 text-center font-bold ${isFailingGrade(s.Grade) ? 'text-red-600' : 'text-gray-900'}`}>
                            {s.Grade}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary Statistics for each semester */}
                <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm print-summary">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700">Total Credits:</span>
                    <span className="font-bold text-gray-900">{data.subjects.reduce((sum, s) => sum + parseCredits(s?.Credits), 0)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700">Credits Cleared:</span>
                    <span className="font-bold text-gray-900">{getCreditsCleared(data.subjects)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700">SGPA:</span>
                    <span className="font-bold text-gray-900">{data.sgpa || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700">CGPA:</span>
                    <span className="font-bold text-gray-900">{data.cgpa || data.cumulativeCgpa || 'N/A'}</span>
                  </div>
                </div>

                {/* Footer for each semester */}
                <div className="flex justify-between text-sm text-gray-700 border-t pt-4 mt-8">
                  <p>Date : {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  <p className="font-semibold">Dean, Examinations</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-6"></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Initializing</h2>
          <p className="text-gray-600">Setting up the result viewer...</p>
        </div>
      </div>
    }>
      <ResultPageContent />
    </Suspense>
  );
}
