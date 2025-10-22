"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function ResultPageContent() {
  const params = useSearchParams();
  const router = useRouter();

  const registration = params.get("reg");
  const semester = params.get("sem");

  const [result, setResult] = useState(null);
  const [allResults, setAllResults] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isMultipleSemesters, setIsMultipleSemesters] = useState(false);

  const parseCredits = (value) => {
    if (value == null) return 0;
    const str = String(value).trim();
    if (!str) return 0;
    const parts = str.split(/[+\-]/).map((p) => Number(p.trim()) || 0);
    const ops = str.match(/[+\-]/g) || [];
    if (ops.length === 0) return parts[0] || 0;
    let total = parts[0] || 0;
    for (let i = 0; i < ops.length; i++) {
      total = ops[i] === '-' ? total - (parts[i + 1] || 0) : total + (parts[i + 1] || 0);
    }
    return total;
  };

  const gradeToPoints = (grade) => {
    const gradeMap = {
      'O': 10, 'E': 9, 'A': 8, 'B': 7, 'C': 6, 'D': 5,
      'F': 0, 'S': 0, 'M': 0, 'I': 0, 'R': 0
    };
    return gradeMap[grade?.toUpperCase()] || 0;
  };

  const computeSgpa = (subjects) => {
    let totalCredits = 0;
    let weightedSum = 0;
    
    subjects.forEach(subject => {
      const credits = parseCredits(subject.Credits);
      const points = gradeToPoints(subject.Grade);
      totalCredits += credits;
      weightedSum += credits * points;
    });
    
    return totalCredits > 0 ? (weightedSum / totalCredits).toFixed(2) : '0.00';
  };

  const isFailingGrade = (grade) => {
    return ['F', 'S'].includes(grade?.toUpperCase());
  };

  useEffect(() => {
    const fetchResult = async () => {
      try {

        // Check if multiple semesters are selected
        const semesters = semester.split(',');
        setIsMultipleSemesters(semesters.length > 1);

        if (semesters.length > 1) {
          // Fetch results for all semesters
          const semesterResults = {};
          let cumulativeCredits = 0;
          let cumulativePoints = 0;

          for (const sem of semesters) {
            const res = await fetch("/api/result", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ registration, semester: sem.trim() }),
            });
            const data = await res.json();
            if (res.ok && data.subjects) {
              const sgpa = computeSgpa(data.subjects);
              const totalCredits = data.subjects.reduce((sum, s) => sum + parseCredits(s.Credits), 0);
              
              semesterResults[sem.trim()] = {
                ...data,
                sgpa,
                totalCredits,
                cumulativeCredits,
                cumulativePoints
              };

              // Update cumulative values
              cumulativeCredits += totalCredits;
              cumulativePoints += totalCredits * parseFloat(sgpa);
            }
          }

          // Calculate cumulative CGPA for each semester
          Object.keys(semesterResults).forEach(sem => {
            const semData = semesterResults[sem];
            const cgpa = semData.cumulativeCredits > 0 
              ? (semData.cumulativePoints / semData.cumulativeCredits).toFixed(2)
              : '0.00';
            semesterResults[sem].cumulativeCgpa = cgpa;
          });

          setAllResults(semesterResults);
        } else {
          // Single semester
          const res = await fetch("/api/result", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ registration, semester }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Result not found");
          setResult(data);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (registration && semester) fetchResult();
  }, [registration, semester]);

  if (loading)
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-indigo-900 via-indigo-700 to-sky-500 text-white">
        <div className="w-20 h-20 border-4 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-lg font-semibold">Loading Result...</p>
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen flex flex-col justify-center items-center text-red-500 bg-white">
        <h1 className="text-2xl font-bold mb-4">⚠️ {error}</h1>
        <button
          onClick={() => router.push("/dashboard/user")}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg"
        >
          Go Back
        </button>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-gray-900 flex flex-col items-center py-10 px-4">
      <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-6xl">
        <div className="text-center mb-8">
          <img
            src="https://tse1.mm.bing.net/th/id/OIP.yR5DUnUlOBL5eCaPQ9HFgwHaHZ?rs=1&pid=ImgDetMain"
            alt="CUTM Logo"
            className="mx-auto w-24 h-24 rounded-full border-4 border-[#0a2a6c]"
          />
          <h1 className="text-2xl font-bold text-[#0a2a6c] mt-3">
            Centurion University of Technology and Management
          </h1>
          <h2 className="text-lg text-[#1d3a94] font-semibold">
            School Of Engineering & Technology, Paralakhemundi
          </h2>
        </div>

        {isMultipleSemesters ? (
          // Multiple Semesters View
          <div className="flex gap-6">
            {/* Sidebar */}
            <div className="w-80 bg-gray-50 rounded-lg p-4 h-fit">
              <h3 className="text-lg font-bold text-[#0a2a6c] mb-4">📊 Semester Summary</h3>
              <div className="space-y-3">
                {Object.entries(allResults).map(([sem, data]) => (
                  <div key={sem} className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="font-semibold text-[#0a2a6c]">{sem}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      <div>SGPA: <span className="font-semibold text-blue-600">{data.sgpa}</span></div>
                      <div>CGPA: <span className="font-semibold text-green-600">{data.cumulativeCgpa}</span></div>
                      <div>Subjects: <span className="font-semibold">{data.subjects.length}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1">
              <div className="grid md:grid-cols-2 gap-3 text-sm mb-6">
                <p>
                  <b className="text-[#0a2a6c]">Registration No:</b> {registration}
                </p>
                <p>
                  <b className="text-[#0a2a6c]">Semesters:</b> {Object.keys(allResults).join(', ')}
                </p>
              </div>

              {Object.entries(allResults).map(([sem, data]) => (
                <div key={sem} className="mb-8">
                  <h3 className="text-xl font-bold text-[#0a2a6c] mb-4 border-b-2 border-[#0a2a6c] pb-2">
                    {sem} Results
                  </h3>
                  
                  <div className="grid md:grid-cols-3 gap-3 text-sm mb-4">
                    <p>
                      <b className="text-[#0a2a6c]">SGPA:</b> {data.sgpa}
                    </p>
                    <p>
                      <b className="text-[#0a2a6c]">CGPA:</b> {data.cumulativeCgpa}
                    </p>
                    <p>
                      <b className="text-[#0a2a6c]">Total Credits:</b> {data.totalCredits}
                    </p>
                  </div>

                  <div className="overflow-x-auto border rounded-lg shadow-sm mb-6">
                    <table className="min-w-full border-collapse bg-white text-sm">
                      <thead className="bg-[#0a2a6c] text-white">
                        <tr>
                          <th className="border p-2">Subject Code</th>
                          <th className="border p-2 text-left">Subject Name</th>
                          <th className="border p-2">Credits</th>
                          <th className="border p-2">Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.subjects.map((s, i) => (
                          <tr key={i} className="hover:bg-gray-50 transition">
                            <td className="border p-2 text-center">{s.Subject_Code}</td>
                            <td className="border p-2">{s.Subject_Name}</td>
                            <td className="border p-2 text-center">{parseCredits(s.Credits)}</td>
                            <td
                              className={`border p-2 text-center font-bold ${
                                isFailingGrade(s.Grade)
                                  ? " text-red-600"
                                  : ["O", "E", "A"].includes(s.Grade)
                                  ? "text-green-600"
                                  : ["B", "C"].includes(s.Grade)
                                  ? "text-blue-600"
                                  : "text-red-600"
                              }`}
                            >
                              {s.Grade}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 font-semibold">
                          <td className="border p-2 text-right" colSpan={2}>Total</td>
                          <td className="border p-2 text-center">
                            {data.subjects.reduce((sum, s) => sum + parseCredits(s?.Credits), 0)}
                          </td>
                          <td className="border p-2 text-center">—</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Single Semester View
          <>
            <div className="grid md:grid-cols-2 gap-3 text-sm mb-6">
              <p>
                <b className="text-[#0a2a6c]">Registration No:</b> {registration}
              </p>
              <p>
                <b className="text-[#0a2a6c]">Semester:</b> {semester}
              </p>
              <p>
                <b className="text-[#0a2a6c]">SGPA:</b> {result.sgpa}
              </p>
              <p>
                <b className="text-[#0a2a6c]">CGPA:</b> {result.cgpa}
              </p>
            </div>

            <div className="overflow-x-auto border rounded-lg shadow-sm mb-6">
              <table className="min-w-full border-collapse bg-white text-sm">
                <thead className="bg-[#0a2a6c] text-white">
                  <tr>
                    <th className="border p-2">Subject Code</th>
                    <th className="border p-2 text-left">Subject Name</th>
                    <th className="border p-2">Credits</th>
                    <th className="border p-2">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {result.subjects.map((s, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition">
                      <td className="border p-2 text-center">{s.Subject_Code}</td>
                      <td className="border p-2">{s.Subject_Name}</td>
                      <td className="border p-2 text-center">{parseCredits(s.Credits)}</td>
                      <td
                        className={`border p-2 text-center font-bold ${
                          isFailingGrade(s.Grade)
                            ? "  text-red-600"
                            : ["O", "E", "A"].includes(s.Grade)
                            ? "text-green-600"
                            : ["B", "C"].includes(s.Grade)
                            ? "text-blue-600"
                            : "text-red-600"
                        }`}
                      >
                        {s.Grade}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td className="border p-2 text-right" colSpan={2}>Total</td>
                    <td className="border p-2 text-center">
                      {Array.isArray(result?.subjects)
                        ? result.subjects.reduce((sum, s) => sum + parseCredits(s?.Credits), 0)
                        : 0}
                    </td>
                    <td className="border p-2 text-center">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        <div className="flex justify-between">
          <button
            onClick={() => router.push("/dashboard/user")}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-5 py-2 rounded-lg"
          >
            ← Back
          </button>
          <button
            onClick={() => window.print()}
            className="bg-gradient-to-r from-[#0a2a6c] to-[#1d3a94] text-white font-semibold px-5 py-2 rounded-lg hover:scale-105 transition"
          >
            🖨️ Print / Save as PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-indigo-900 via-indigo-700 to-sky-500 text-white">
        <div className="w-20 h-20 border-4 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-lg font-semibold">Loading Result...</p>
      </div>
    }>
      <ResultPageContent />
    </Suspense>
  );
}
