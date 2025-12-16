/**
 * SOVET Diploma Student Management
 * Displays diploma student records by batch year
 */

"use client";

import React, { useMemo, useState } from "react";
import { appendSchoolParams } from "@/lib/api-helper";

export default function DiplomaBatchPage() {
  const [batch, setBatch] = useState("");
  const [diplomaType, setDiplomaType] = useState(""); // IoT or Web
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState(new Set());

  // Sample Diploma Students Data
  const sampleDiplomaData = {
    "2024-IoT": [
      { Reg_No: "2024DIP001", Name: "Neha Bhatt", Program: "Diploma IoT", Batch: "2024", Sem: 1, Subject_Code: "DIP101", Subject_Name: "Microcontroller Basics", Credits: 3, Grade: "A" },
      { Reg_No: "2024DIP001", Name: "Neha Bhatt", Program: "Diploma IoT", Batch: "2024", Sem: 1, Subject_Code: "DIP102", Subject_Name: "Arduino Programming", Credits: 3, Grade: "A" },
      { Reg_No: "2024DIP002", Name: "Rajesh Kumar", Program: "Diploma IoT", Batch: "2024", Sem: 1, Subject_Code: "DIP101", Subject_Name: "Microcontroller Basics", Credits: 3, Grade: "B" },
      { Reg_No: "2024DIP002", Name: "Rajesh Kumar", Program: "Diploma IoT", Batch: "2024", Sem: 1, Subject_Code: "DIP102", Subject_Name: "Arduino Programming", Credits: 3, Grade: "B" },
      { Reg_No: "2024DIP003", Name: "Anjali Patel", Program: "Diploma IoT", Batch: "2024", Sem: 1, Subject_Code: "DIP101", Subject_Name: "Microcontroller Basics", Credits: 3, Grade: "A" },
      { Reg_No: "2024DIP003", Name: "Anjali Patel", Program: "Diploma IoT", Batch: "2024", Sem: 1, Subject_Code: "DIP102", Subject_Name: "Arduino Programming", Credits: 3, Grade: "O" }
    ],
    "2024-Web": [
      { Reg_No: "2024DIP101", Name: "Vikram Singh", Program: "Diploma Web", Batch: "2024", Sem: 1, Subject_Code: "DIP201", Subject_Name: "HTML & CSS Fundamentals", Credits: 3, Grade: "B" },
      { Reg_No: "2024DIP101", Name: "Vikram Singh", Program: "Diploma Web", Batch: "2024", Sem: 1, Subject_Code: "DIP202", Subject_Name: "JavaScript Basics", Credits: 3, Grade: "B" },
      { Reg_No: "2024DIP102", Name: "Meera Verma", Program: "Diploma Web", Batch: "2024", Sem: 1, Subject_Code: "DIP201", Subject_Name: "HTML & CSS Fundamentals", Credits: 3, Grade: "A" },
      { Reg_No: "2024DIP102", Name: "Meera Verma", Program: "Diploma Web", Batch: "2024", Sem: 1, Subject_Code: "DIP202", Subject_Name: "JavaScript Basics", Credits: 3, Grade: "A" },
      { Reg_No: "2024DIP103", Name: "Arjun Singh", Program: "Diploma Web", Batch: "2024", Sem: 1, Subject_Code: "DIP201", Subject_Name: "HTML & CSS Fundamentals", Credits: 3, Grade: "C" },
      { Reg_No: "2024DIP103", Name: "Arjun Singh", Program: "Diploma Web", Batch: "2024", Sem: 1, Subject_Code: "DIP202", Subject_Name: "JavaScript Basics", Credits: 3, Grade: "B" }
    ],
    "2023-IoT": [
      { Reg_No: "2023DIP001", Name: "Pooja Sharma", Program: "Diploma IoT", Batch: "2023", Sem: 2, Subject_Code: "DIP103", Subject_Name: "Embedded Systems", Credits: 3, Grade: "A" },
      { Reg_No: "2023DIP001", Name: "Pooja Sharma", Program: "Diploma IoT", Batch: "2023", Sem: 2, Subject_Code: "DIP104", Subject_Name: "Sensor Integration", Credits: 3, Grade: "A" },
      { Reg_No: "2023DIP002", Name: "Arun Verma", Program: "Diploma IoT", Batch: "2023", Sem: 2, Subject_Code: "DIP103", Subject_Name: "Embedded Systems", Credits: 3, Grade: "B" },
      { Reg_No: "2023DIP002", Name: "Arun Verma", Program: "Diploma IoT", Batch: "2023", Sem: 2, Subject_Code: "DIP104", Subject_Name: "Sensor Integration", Credits: 3, Grade: "B" }
    ],
    "2023-Web": [
      { Reg_No: "2023DIP101", Name: "Kavya Nair", Program: "Diploma Web", Batch: "2023", Sem: 2, Subject_Code: "DIP203", Subject_Name: "React.js Fundamentals", Credits: 3, Grade: "O" },
      { Reg_No: "2023DIP101", Name: "Kavya Nair", Program: "Diploma Web", Batch: "2023", Sem: 2, Subject_Code: "DIP204", Subject_Name: "Node.js Backend", Credits: 3, Grade: "A" },
      { Reg_No: "2023DIP102", Name: "Saurav Das", Program: "Diploma Web", Batch: "2023", Sem: 2, Subject_Code: "DIP203", Subject_Name: "React.js Fundamentals", Credits: 3, Grade: "A" },
      { Reg_No: "2023DIP102", Name: "Saurav Das", Program: "Diploma Web", Batch: "2023", Sem: 2, Subject_Code: "DIP204", Subject_Name: "Node.js Backend", Credits: 3, Grade: "A" }
    ]
  };

  async function onSubmit(e) {
    e.preventDefault();
    setMessage(""); setError(""); setRows([]);

    if (!batch || !diplomaType) {
      setError("Please select batch year and diploma type");
      return;
    }

    try {
      setLoading(true);
      const key = `${batch}-${diplomaType}`;
      const data = sampleDiplomaData[key];

      if (!data || data.length === 0) {
        setError("No diploma student records found for selected criteria");
        setRows([]);
        setCount(0);
        return;
      }

      setRows(data);
      setCount(data.length);
      setMessage(`${data.length} records loaded for Diploma ${diplomaType === 'IoT' ? 'IoT Engineering' : 'Web Technologies'} - Batch ${batch}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
          Program: record.Program,
          Batch: record.Batch,
          subjects: [],
          totalSubjects: 0,
          totalCredits: 0
        };
      }
      grouped[regNo].subjects.push(record);
      grouped[regNo].totalSubjects++;
      grouped[regNo].totalCredits += parseFloat(record.Credits) || 0;
    });
    return Object.values(grouped).sort((a, b) => a.Reg_No.localeCompare(b.Reg_No));
  }, [rows]);

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

  return (
    <div className="min-h-screen pb-8 sm:pb-12" style={{
      background: "linear-gradient(to bottom, #F5F8FA 0%, #E8F4F8 50%, #D1E9F6 100%)",
    }}>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 pt-6 sm:pt-8 lg:pt-12">
        
        {/* Header */}
        <div className="mb-4 sm:mb-6 text-center">
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black inline-flex items-center justify-center gap-2 sm:gap-3"
            style={{
              background: "linear-gradient(135deg, #FF6B6B 0%, #FF8E72 50%, #FFA07A 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            🎓 Diploma Student Records
          </h1>
          <p className="text-gray-600 mt-2">SOVET - Diploma Programs Management</p>
        </div>

        {/* Main Card */}
        <div className="rounded-xl sm:rounded-2xl overflow-hidden shadow-xl bg-white border-2" style={{ borderColor: "rgba(5,163,199,0.2)" }}>
          
          {/* Card Header */}
          <div className="p-4 sm:p-6 text-white" style={{
            background: "linear-gradient(135deg, #FF6B6B 0%, #FF8E72 100%)",
          }}>
            <h2 className="text-lg sm:text-xl font-black">Search Diploma Student Records</h2>
            <p className="opacity-90 text-xs sm:text-sm mt-1">View diploma student data by batch year and program</p>
          </div>
          
          {/* Content */}
          <div className="p-4 sm:p-6">
            
            {/* Search Form */}
            <form onSubmit={onSubmit} className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                
                <div>
                  <label className="block font-bold mb-1.5 sm:mb-2 text-sm sm:text-base text-[#1A1F29]">
                    Diploma Type
                  </label>
                  <select 
                    className="w-full border-2 rounded-xl bg-white px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-[#1A1F29] font-medium outline-none focus:ring-4 focus:ring-[#FF6B6B]/20 transition-all min-h-[44px]" 
                    style={{ borderColor: "rgba(255,107,107,0.3)" }}
                    value={diplomaType} 
                    onChange={e => setDiplomaType(e.target.value)}
                  >
                    <option value="">Select Diploma Type</option>
                    <option value="IoT">Diploma IoT Engineering</option>
                    <option value="Web">Diploma Web Technologies</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1.5 sm:mb-2 text-sm sm:text-base text-[#1A1F29]">
                    Batch (Year)
                  </label>
                  <select 
                    className="w-full border-2 rounded-xl bg-white px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-[#1A1F29] font-medium outline-none focus:ring-4 focus:ring-[#FF6B6B]/20 transition-all min-h-[44px]" 
                    style={{ borderColor: "rgba(255,107,107,0.3)" }}
                    value={batch} 
                    onChange={e => setBatch(e.target.value)}
                  >
                    <option value="">Select Batch Year</option>
                    <option value="2024">2024</option>
                    <option value="2023">2023</option>
                    <option value="2022">2022</option>
                  </select>
                </div>
              </div>

              <div className="text-center">
                <button 
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl text-white font-black hover:shadow-lg active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 text-sm sm:text-base min-h-[44px] w-full sm:w-auto" 
                  style={{
                    background: "linear-gradient(135deg, #FF6B6B 0%, #FF8E72 100%)",
                  }}
                >
                  {loading ? "Loading..." : "Get Diploma Student Data"}
                </button>
              </div>
            </form>

            {/* Messages */}
            {message && (
              <div className="mb-4 p-3 sm:p-4 rounded-lg bg-green-50 border-l-4 border-green-500 text-green-800 text-sm sm:text-base">
                ✓ {message}
              </div>
            )}
            {error && (
              <div className="mb-4 p-3 sm:p-4 rounded-lg bg-red-50 border-l-4 border-red-500 text-red-800 text-sm sm:text-base">
                ✗ {error}
              </div>
            )}

            {/* Results */}
            {studentSummary.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
                  📊 {count} Records from {studentSummary.length} Students
                </h3>

                <div className="space-y-3">
                  {studentSummary.map(student => (
                    <div key={student.Reg_No} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition">
                      
                      {/* Student Header */}
                      <button
                        onClick={() => toggleExpand(student.Reg_No)}
                        className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-orange-50 to-red-50 hover:from-orange-100 hover:to-red-100 transition flex justify-between items-center"
                      >
                        <div className="text-left">
                          <p className="font-bold text-gray-900 text-sm sm:text-base">{student.Name}</p>
                          <p className="text-xs sm:text-sm text-gray-600">
                            {student.Reg_No} • {student.Program} • Batch {student.Batch}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
                            {student.totalSubjects} Subjects
                          </span>
                          <span className="text-lg sm:text-xl">
                            {expandedStudents.has(student.Reg_No) ? "▼" : "▶"}
                          </span>
                        </div>
                      </button>

                      {/* Subject Details */}
                      {expandedStudents.has(student.Reg_No) && (
                        <div className="p-4 sm:p-6 bg-white border-t border-gray-200">
                          <table className="w-full text-xs sm:text-sm">
                            <thead>
                              <tr className="border-b-2 border-gray-200">
                                <th className="text-left py-2 px-2 font-semibold text-gray-700">Code</th>
                                <th className="text-left py-2 px-2 font-semibold text-gray-700">Subject</th>
                                <th className="text-center py-2 px-2 font-semibold text-gray-700">Sem</th>
                                <th className="text-center py-2 px-2 font-semibold text-gray-700">Credits</th>
                                <th className="text-center py-2 px-2 font-semibold text-gray-700">Grade</th>
                              </tr>
                            </thead>
                            <tbody>
                              {student.subjects.map((subj, idx) => (
                                <tr key={idx} className="border-b hover:bg-gray-50">
                                  <td className="py-2 px-2 font-mono text-gray-900">{subj.Subject_Code}</td>
                                  <td className="py-2 px-2 text-gray-700">{subj.Subject_Name}</td>
                                  <td className="text-center py-2 px-2 text-gray-700">{subj.Sem}</td>
                                  <td className="text-center py-2 px-2 text-gray-700">{subj.Credits}</td>
                                  <td className="text-center py-2 px-2">
                                    <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded font-bold text-xs">
                                      {subj.Grade}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                              <tr className="bg-gray-50 font-bold">
                                <td colSpan="3" className="text-right py-2 px-2">Total Credits:</td>
                                <td className="text-center py-2 px-2">{student.totalCredits}</td>
                                <td></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && rows.length === 0 && message && (
              <div className="text-center py-8 text-gray-500">
                No records found. Try different filters.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
