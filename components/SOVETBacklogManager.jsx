/**
 * SOVET Backlog Management - Enhanced with Centurion University Registration
 * Handles: /dashboard/admin/backlog?school=SOVET&campus=pkd|bbsr
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { appendSchoolParams, getSchoolApiUrl } from "@/lib/api-helper";
import {
  parseRegistrationNo,
  extractBatchFromReg,
  extractProgramFromReg,
  filterStudents,
  getAllBatches,
  getAllPrograms,
  getAllBranches,
  programCodes
} from "@/lib/registration/centurion";

export default function SOVETBacklogManagementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get query parameters
  const school = searchParams?.get('school') || 'SOVET';
  const campus = searchParams?.get('campus') || 'BBSR';
  
  const [registrationInput, setRegistrationInput] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("All");
  const [selectedProgram, setSelectedProgram] = useState("All");
  const [selectedBranch, setSelectedBranch] = useState("All");
  
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [count, setCount] = useState(0);
  
  const [batches, setBatches] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [branches, setBranches] = useState([]);
  const [studentSummary, setStudentSummary] = useState([]);
  
  const [expandedStudents, setExpandedStudents] = useState(new Set());
  const [sortBy, setSortBy] = useState("regNo");
  const [filterGrade, setFilterGrade] = useState("");

  // Parse batch and branch from registration number
  function parseStudentInfo(regNo) {
    const parsed = parseRegistrationNo(regNo);
    if (parsed.isValid) {
      return {
        regNo: parsed.regNo,
        batch: String(parsed.year),
        program: parsed.branch,
        branch: parsed.branch,
        school: parsed.school,
        campus: campus.toUpperCase(),
        semester: parsed.currentSemester,
        expectedGraduate: parsed.expectedGraduation
      };
    }
    return null;
  }

  // Fetch backlog data from API
  async function fetchBacklogData(regNo = "", batchYear = "", program = "") {
    try {
      setLoading(true);
      setError("");
      setMessage("");
      
      // Enhance with campus/school parameters
      const backlogUrl = getSchoolApiUrl("backlogs");
      
      const payload = {
        registration: regNo || registration || "",
        batch: batchYear || selectedBatch !== "All" ? selectedBatch : "",
        program: program || selectedProgram !== "All" ? selectedProgram : "",
        campus: campus.toUpperCase(),
        school: school.toUpperCase()
      };

      const res = await fetch(backlogUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch backlog data");
      }

      const records = data.records || data.result || [];
      
      // Enhance records with parsed registration info
      const enhancedRecords = records.map(record => {
        const studentInfo = parseStudentInfo(record.Reg_No || record.registration);
        return {
          ...record,
          ...studentInfo,
          Reg_No: record.Reg_No || record.registration,
          Subject_Code: record.Subject_Code || record.subject_code,
          Subject_Name: record.Subject_Name || record.subject_name,
          Grade: record.Grade || record.grade
        };
      });

      setRows(enhancedRecords);
      setCount(enhancedRecords.length);
      setMessage(`${enhancedRecords.length} backlog records found for ${school} (${campus})`);

      // Update available batches and programs
      if (enhancedRecords.length > 0) {
        const uniqueBatches = [...new Set(enhancedRecords.map(r => r.batch))].sort().reverse();
        const uniquePrograms = [...new Set(enhancedRecords.map(r => r.program))].sort();
        setBatches(uniqueBatches);
        setPrograms(uniquePrograms);
      }

    } catch (err) {
      setError(err.message);
      setRows([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }

  // Fetch all backlogs for analytics
  async function fetchAllBacklogs() {
    try {
      setLoading(true);
      setError("");
      
      const backlogUrl = getSchoolApiUrl("backlogs") + "/all";
      
      const res = await fetch(backlogUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });

      const data = await res.json();
      const records = data.records || [];

      // Parse and group by student
      const studentMap = {};
      records.forEach(record => {
        const regNo = record.Reg_No || record.registration;
        if (!studentMap[regNo]) {
          const studentInfo = parseStudentInfo(regNo);
          studentMap[regNo] = {
            Reg_No: regNo,
            ...studentInfo,
            backlogs: []
          };
        }
        studentMap[regNo].backlogs.push(record);
      });

      const summary = Object.values(studentMap).map(s => ({
        ...s,
        TotalBacklogs: s.backlogs.length
      })).sort((a, b) => b.TotalBacklogs - a.TotalBacklogs);

      setStudentSummary(summary);

    } catch (err) {
      console.error("Error fetching all backlogs:", err);
    } finally {
      setLoading(false);
    }
  }

  // Search by registration number
  function handleRegistrationSearch() {
    if (!registrationInput.trim()) {
      setError("Please enter a registration number");
      return;
    }

    const studentInfo = parseStudentInfo(registrationInput);
    if (!studentInfo) {
      setError("Invalid registration number format. Expected format: 2024AI001");
      return;
    }

    // Update selections based on parsed info
    setSelectedBatch(studentInfo.batch);
    setSelectedProgram(studentInfo.program);
    setSelectedBranch(studentInfo.branch);

    // Fetch data
    fetchBacklogData(registrationInput, studentInfo.batch, studentInfo.program);
  }

  // Search by batch and branch
  function handleBatchBranchSearch() {
    let filters = {};
    
    if (selectedBatch !== "All") filters.batch = selectedBatch;
    if (selectedProgram !== "All") filters.program = selectedProgram;
    if (selectedBranch !== "All") filters.branch = selectedBranch;

    if (Object.keys(filters).length === 0) {
      setError("Please select batch and/or branch to search");
      return;
    }

    fetchBacklogData("", filters.batch, filters.program);
  }

  // Toggle student expansion
  function toggleStudentExpanded(regNo) {
    setExpandedStudents(prev => {
      const next = new Set(prev);
      if (next.has(regNo)) next.delete(regNo);
      else next.add(regNo);
      return next;
    });
  }

  // Sort data
  const sortedRows = useMemo(() => {
    let sorted = [...rows];
    
    if (filterGrade && filterGrade !== "All") {
      sorted = sorted.filter(r => r.Grade === filterGrade);
    }

    if (sortBy === "regNo") {
      sorted.sort((a, b) => (a.Reg_No || "").localeCompare(b.Reg_No || ""));
    } else if (sortBy === "name") {
      sorted.sort((a, b) => (a.Name || "").localeCompare(b.Name || ""));
    } else if (sortBy === "batch") {
      sorted.sort((a, b) => (b.batch || "").localeCompare(a.batch || ""));
    }
    
    return sorted;
  }, [rows, sortBy, filterGrade]);

  // Group by student
  const studentGroups = useMemo(() => {
    const grouped = {};
    sortedRows.forEach(row => {
      const regNo = row.Reg_No || row.registration;
      if (!grouped[regNo]) {
        grouped[regNo] = {
          regNo,
          name: row.Name,
          batch: row.batch,
          program: row.program,
          branch: row.branch,
          campus: row.campus,
          subjects: []
        };
      }
      grouped[regNo].subjects.push(row);
    });
    return Object.values(grouped);
  }, [sortedRows]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">🕓</span>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">SOVET Backlog Management</h1>
          </div>
          <p className="text-gray-600">Manage and track student backlogs</p>
          <p className="text-sm text-gray-500 mt-2">
            School: <span className="font-bold text-cyan-600">{school}</span> | 
            Campus: <span className="font-bold text-cyan-600">{campus.toUpperCase()}</span>
          </p>
        </div>

        {/* Search Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          
          {/* Registration Number Search */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🔍 Search by Registration</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Registration Number (e.g., 2024AI001)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={registrationInput}
                    onChange={(e) => setRegistrationInput(e.target.value)}
                    placeholder="e.g., 2024AI001, 2023IOT032"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    onKeyPress={(e) => e.key === 'Enter' && handleRegistrationSearch()}
                  />
                  <button
                    onClick={handleRegistrationSearch}
                    disabled={loading}
                    className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 font-semibold transition"
                  >
                    Search
                  </button>
                </div>
              </div>
              <div className="bg-cyan-50 p-3 rounded-lg text-sm text-gray-700">
                <p className="font-semibold mb-1">📋 Registration Format:</p>
                <p>Year (4) + Program Code (2-4) + Student No (3)</p>
                <p className="mt-2 text-xs">Examples:</p>
                <ul className="list-disc list-inside text-xs space-y-1">
                  <li>2024AI001 - Batch 2024, AI & ML, Student 001</li>
                  <li>2023IOT032 - Batch 2023, IoT & Automation, Student 032</li>
                  <li>2024CYBER001 - Batch 2024, Cybersecurity, Student 001</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Batch & Branch Search */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📊 Filter by Batch & Program</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Batch Year</label>
                <select
                  value={selectedBatch}
                  onChange={(e) => setSelectedBatch(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="All">All Batches</option>
                  <option value="2024">2024</option>
                  <option value="2023">2023</option>
                  <option value="2022">2022</option>
                  <option value="2021">2021</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Program</label>
                <select
                  value={selectedProgram}
                  onChange={(e) => setSelectedProgram(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="All">All Programs</option>
                  <option value="AI">B.Tech AI & ML</option>
                  <option value="IOT">B.Tech IoT & Automation</option>
                  <option value="CYBER">B.Tech Cybersecurity</option>
                  <option value="BLK">B.Tech Blockchain</option>
                  <option value="DIP">Diploma Programs</option>
                </select>
              </div>

              <button
                onClick={handleBatchBranchSearch}
                disabled={loading}
                className="w-full px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-semibold transition"
              >
                Search by Filters
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6">
            ✓ {message}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            ✗ {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin">⏳</div>
            <p className="text-gray-600 mt-2">Loading backlog data...</p>
          </div>
        )}

        {/* Results Section */}
        {sortedRows.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Results: {count} Backlog Records
              </h2>
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="regNo">Sort: Registration</option>
                  <option value="name">Sort: Name</option>
                  <option value="batch">Sort: Batch</option>
                </select>
                
                <select
                  value={filterGrade}
                  onChange={(e) => setFilterGrade(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">All Grades</option>
                  <option value="F">Grade F</option>
                  <option value="D">Grade D</option>
                </select>
              </div>
            </div>

            {/* Student Groups */}
            <div className="space-y-4">
              {studentGroups.map((group) => (
                <div key={group.regNo} className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition">
                  <button
                    onClick={() => toggleStudentExpanded(group.regNo)}
                    className="w-full px-6 py-4 bg-gradient-to-r from-cyan-50 to-blue-50 hover:from-cyan-100 hover:to-blue-100 transition text-left flex justify-between items-center"
                  >
                    <div>
                      <p className="font-bold text-gray-900">{group.name || 'Unknown'}</p>
                      <p className="text-sm text-gray-600">
                        Reg: {group.regNo} | Batch: {group.batch} | Program: {group.program}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-bold">
                        {group.subjects.length} Backlog{group.subjects.length !== 1 ? 's' : ''}
                      </span>
                      <span className="text-2xl">{expandedStudents.has(group.regNo) ? '▼' : '▶'}</span>
                    </div>
                  </button>

                  {expandedStudents.has(group.regNo) && (
                    <div className="p-6 bg-white border-t border-gray-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b-2 border-gray-200">
                            <th className="text-left py-2 px-4 font-semibold text-gray-700">Code</th>
                            <th className="text-left py-2 px-4 font-semibold text-gray-700">Subject</th>
                            <th className="text-center py-2 px-4 font-semibold text-gray-700">Sem</th>
                            <th className="text-center py-2 px-4 font-semibold text-gray-700">Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.subjects.map((subj, idx) => (
                            <tr key={idx} className="border-b hover:bg-gray-50">
                              <td className="py-2 px-4 font-mono text-gray-900">{subj.Subject_Code}</td>
                              <td className="py-2 px-4 text-gray-700">{subj.Subject_Name}</td>
                              <td className="text-center py-2 px-4 text-gray-700">{subj.Sem}</td>
                              <td className="text-center py-2 px-4">
                                <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full font-bold">
                                  {subj.Grade}
                                </span>
                              </td>
                            </tr>
                          ))}
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
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
            <p className="text-gray-600">No backlog records found matching your criteria.</p>
            <p className="text-sm text-gray-500 mt-2">Try adjusting your search filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
