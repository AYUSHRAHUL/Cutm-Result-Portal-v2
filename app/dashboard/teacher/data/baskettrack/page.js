"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function TeacherBasketProgressTracker() {
  const [department, setDepartment] = useState("");
  const [batch, setBatch] = useState("");
  const [registration, setRegistration] = useState("");
  const [registrationOptions, setRegistrationOptions] = useState([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [semesters, setSemesters] = useState([]);
  const [semesterValues, setSemesterValues] = useState([]);
  const [basket, setBasket] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSemesters, setLoadingSemesters] = useState(false);

  // Results state
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [studentData, setStudentData] = useState(null);
  const [basketProgress, setBasketProgress] = useState({});
  const [allStudentsData, setAllStudentsData] = useState([]);
  const [dataSources, setDataSources] = useState(null);
  
  // Basket detail state
  const [selectedBasket, setSelectedBasket] = useState(null);
  const [showBasketDetails, setShowBasketDetails] = useState(false);

  function clearFilters() {
    setDepartment("");
    setBatch("");
    setRegistration("");
    setSemesterValues([]);
    setBasket("");
    setError("");
    setStudentData(null);
    setBasketProgress({});
    setAllStudentsData([]);
    setDataSources(null);
    setSearchPerformed(false);
    setSemesters([]);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSearchPerformed(true);
    setLoading(true);
    
    // Reset previous results immediately
    setStudentData(null);
    setBasketProgress({});
    setAllStudentsData([]);
    
    try {
      const isBulkSearch = registration === "all" || registration === "";
      
      if (isBulkSearch) {
        if (!department || department === "" || department === "Select Department") {
          throw new Error("Please select a valid department for bulk search");
        }
        
        const validDepartments = [
          "All",
          "Civil Engineering", 
          "Computer Science Engineering",
          "Electronics & Communication Engineering", 
          "Electrical & Electronics Engineering",
          "Mechanical Engineering"
        ];
        
        if (!validDepartments.includes(department)) {
          throw new Error("Please select a valid department from the dropdown");
        }
        
        // Allow "All" departments for bulk search
        if (department === "All") {
          // valid
        }
        
        // FIXED: Enhanced request body with proper filtering
        const requestBody = { 
          registration: "all",
          department: department === "All" ? "" : department, // Send empty string for "All" departments
          batch: batch && batch !== "All" ? batch : "", // Send empty string for "All" batches
          semesters: semesterValues.length > 0 && !semesterValues.includes("All") ? semesterValues : [], // Send empty array for "All" semesters
          basket: basket && basket !== "All" ? basket : "" // Send empty string for "All" baskets
        };
        
        console.log("Teacher bulk search request:", requestBody);
        
        const res = await fetch("/api/cbcs/track/bulk", {
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
        } catch {
          throw new Error("Invalid response from server. Please check your network connection.");
        }
        
        if (!res.ok) {
          if (res.status === 404) {
            if (data?.debug) {
              const debugInfo = data.debug;
              const errorMsg = `No students found in ${department}. \n\nDebug Information:\n- Total students in database: ${debugInfo.totalStudents}\n- Available departments: ${debugInfo.uniqueBranches?.join(', ') || 'None found'}\n- Sample students: ${debugInfo.sampleStudents?.map(s => `${s.Reg_No} (${s.Branch})`).join(', ') || 'None found'}\n- Query used: ${JSON.stringify(debugInfo.query)}\n\n${debugInfo.suggestions || ''}\n\nPlease check if the department name matches exactly with the available departments above.`;
              throw new Error(errorMsg);
            } else {
              throw new Error(`No students found in ${department}. Please check if the department name is correct.`);
            }
          } else if (res.status === 400) {
            throw new Error(data?.error || "Invalid request. Please check your filter selections.");
          } else {
            throw new Error(data?.error || `Server error: ${res.status} - ${res.statusText}`);
          }
        }
        
        const students = data.students || data.data || [];
        if (!students || students.length === 0) {
          throw new Error(`No students found in ${department}. Try selecting "All Departments" or check if students exist in this department.`);
        }
        setAllStudentsData(students);
        setDataSources(data.dataSources || null);
        
      } else {
        if (!registration || registration.trim().length < 6) {
          throw new Error("Please enter a valid registration number (minimum 6 characters)");
        }
        if (department && (department === "Select Department")) {
          throw new Error("Please select a valid department or leave it empty");
        }
        
        // FIXED: Individual student search with proper filtering
        const requestBody = {
          department: department && department !== "All" ? department : "", 
          batch: batch && batch !== "All" ? batch : "", 
          registration: registration.trim().toUpperCase(), 
          semesters: semesterValues.length > 0 && !semesterValues.includes("All") ? semesterValues : [], 
          basket: basket && basket !== "All" ? basket : ""
        };
        
        console.log("Teacher individual search request:", requestBody);
        
        const res = await fetch("/api/cbcs/track", {
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
        } catch {
          throw new Error("Invalid response from server");
        }
        
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error(`Student with registration ${registration} not found. Please check the registration number.`);
          } else {
            throw new Error(data.error || "Unable to load student progress");
          }
        }
        
        const student = data.student || data.data;
        const progress = data.basketProgress || data.progress || {};
        if (!student) {
          throw new Error(`No data found for registration ${registration}. Please verify the registration number.`);
        }
        setStudentData(student);
        setBasketProgress(progress);
        setDataSources(data.dataSources || null);
      }
    } catch (err) {
      setError(err.message);
      setStudentData(null);
      setBasketProgress({});
      setAllStudentsData([]);
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
        body: JSON.stringify({ registration: value }) 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load semesters");
      setSemesters(data.semesters || []);
    } catch {
      setSemesters([]);
    } finally {
      setLoadingSemesters(false);
    }
  }

  useEffect(() => {
    if (registration && registration.trim().length >= 6 && registration !== "all") {
      loadSemestersForRegistration(registration.trim());
    } else {
      setSemesters([]);
      setSemesterValues([]);
    }
  }, [registration]);

  // Load registration list when department and batch are selected (mirror admin)
  useEffect(() => {
    async function loadRegistrations() {
      try {
        setLoadingRegistrations(true);
        setError("");
        setRegistrationOptions([]);
        const branchMap = {
          "Civil Engineering": "Civil",
          "Computer Science Engineering": "CSE",
          "Electronics & Communication Engineering": "ECE",
          "Electrical & Electronics Engineering": "EEE",
          "Mechanical Engineering": "Mechanical",
        };
        const branch = department && department !== "All" ? branchMap[department] : undefined;
        const hasBatch = batch && batch !== "All";
        const body = { ...(branch ? { branch } : {}), ...(hasBatch ? { batch } : {}) };
        const res = await fetch("/api/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load registrations");
        const records = data.records || [];
        const seen = new Set();
        const options = [];
        for (const r of records) {
          const reg = r.Reg_No;
          if (!reg || seen.has(reg)) continue;
          seen.add(reg);
          options.push({ value: reg, label: `${reg}${r.Name ? ` - ${r.Name}` : ''}` });
        }
        options.sort((a, b) => a.value.localeCompare(b.value));
        setRegistrationOptions(options);
      } catch (err) {
        setRegistrationOptions([]);
        setError(prev => prev || err.message);
      } finally {
        setLoadingRegistrations(false);
      }
    }

    // Clear dependent states when filters change
    setRegistration("");
    setSemesters([]);
    setSemesterValues([]);

    if (department && department !== "" && department !== "All" && batch && batch !== "" && batch !== "All") {
      loadRegistrations();
    } else {
      setRegistrationOptions([]);
    }
  }, [department, batch]);

  // Stats calculation
  const overallStats = useMemo(() => {
    const entries = Object.values(basketProgress || {});
    const totalBaskets = entries.length || 5;
    const basketsCompleted = entries.filter((b) => b && b.is_completed).length;
    const totalEarned = entries.reduce((sum, b) => sum + (Number(b?.earned_credits) || 0), 0);
    const totalFailed = entries.reduce((sum, b) => sum + (Number(b?.failed_credits) || 0), 0);
    const totalCredits = totalEarned; // Exclude failed credits from total
    
    // Check if student is lateral entry
    const isLateralEntry = studentData?.is_lateral_entry || false;
    const totalRequired = isLateralEntry ? 120 : 160;
    const percentage = Math.min(100, Math.round((totalEarned / totalRequired) * 100));
    
    return { totalBaskets, basketsCompleted, totalEarned, totalFailed, totalCredits, totalRequired, percentage, isLateralEntry };
  }, [basketProgress, studentData]);

  function handleBasketClick(basketName, basketInfo) {
    setSelectedBasket({
      name: basketName,
      info: basketInfo,
      subjects: basketInfo?.subjects || []
    });
    setShowBasketDetails(true);
  }

  function closeBasketDetails() {
    setShowBasketDetails(false);
    setSelectedBasket(null);
  }

  async function handleBulkBasketClick(student, basketNumber) {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/cbcs/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration: student.registration,
          department: student.department,
          batch: student.registration.substring(0, 2),
          semesters: ["All"],
          basket: `Basket ${basketNumber}`
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      const basketName = `Basket ${basketNumber}`;
      const basketInfo = data.basketProgress?.[basketName];
      if (basketInfo) {
        setSelectedBasket({
          name: `${basketName} - ${student.name}`,
          info: basketInfo,
          subjects: basketInfo?.subjects || []
        });
        setShowBasketDetails(true);
      } else {
        throw new Error(`No data found for ${basketName}`);
      }
    } catch (err) {
      setError(`Failed to load basket details: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkStudentClick(student) {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/cbcs/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration: student.registration,
          department: student.department,
          batch: student.registration.substring(0, 2),
          semesters: ["All"],
          basket: "All"
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setStudentData(data.student);
      setBasketProgress(data.basketProgress || {});
      setSearchPerformed(true);
    } catch (err) {
      setError(`Failed to load student details: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function exportToCSV() {
    if (registration !== "all" && studentData) {
      const csvData = [];
      csvData.push(["Student Information"]);
      csvData.push(["Name", studentData.name]);
      csvData.push(["Registration", studentData.registration]);
      csvData.push(["Department", studentData.department]);
      csvData.push([]);
      csvData.push(["Basket Progress"]);
      csvData.push(["Basket", "Required Credits", "Earned Credits", "Status", "Percentage"]);
      Object.entries(basketProgress).forEach(([basketName, info]) => {
        csvData.push([
          basketName,
          info.required_credits || 0,
          info.earned_credits || 0,
          info.status || "Not Started",
          `${info.percentage || 0}%`
        ]);
      });
      const csv = csvData.map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
      downloadFile(csv, `student_${studentData.registration}_basket_progress.csv`, "text/csv");
    } else if (registration === "all" && allStudentsData.length > 0) {
      const csvData = [];
      csvData.push(["Sl.No", "Name", "Registration No", "Department", "Total Credits", "Status"]);
      allStudentsData.forEach((student, index) => {
        csvData.push([
          index + 1,
          student.name,
          student.registration,
          student.department,
          student.totalCredits || 0,
          student.status || "Not Started"
        ]);
      });
      const csv = csvData.map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
      downloadFile(csv, `bulk_basket_analysis_${department}_${new Date().toISOString().split('T')[0]}.csv`, "text/csv");
    }
  }

  function exportToExcel() {
    if (registration !== "all" && studentData) {
      const html = `
        <html>
          <head><meta charset="UTF-8"></head>
          <body>
            <h2>Student Basket Progress Report</h2>
            <table border="1">
              <tr><td><strong>Name:</strong></td><td>${studentData.name}</td></tr>
              <tr><td><strong>Registration:</strong></td><td>${studentData.registration}</td></tr>
              <tr><td><strong>Department:</strong></td><td>${studentData.department}</td></tr>
            </table>
            <br>
            <table border="1">
              <tr><th>Basket</th><th>Required Credits</th><th>Earned Credits</th><th>Status</th><th>Percentage</th></tr>
              ${Object.entries(basketProgress).map(([basketName, info]) => 
                `<tr><td>${basketName}</td><td>${info.required_credits || 0}</td><td>${info.earned_credits || 0}</td><td>${info.status || "Not Started"}</td><td>${info.percentage || 0}%</td></tr>`
              ).join("")}
            </table>
          </body>
        </html>
      `;
      downloadFile(html, `student_${studentData.registration}_basket_progress.xls`, "application/vnd.ms-excel");
    } else if (registration === "all" && allStudentsData.length > 0) {
      const html = `
        <html>
          <head><meta charset="UTF-8"></head>
          <body>
            <h2>Bulk Basket Analysis Report</h2>
            <table border="1">
              <tr><th>Sl.No</th><th>Name</th><th>Registration No</th><th>Department</th><th>Total Credits</th><th>Status</th></tr>
              ${allStudentsData.map((student, index) => 
                `<tr><td>${index + 1}</td><td>${student.name}</td><td>${student.registration}</td><td>${student.department}</td><td>${student.totalCredits || 0}</td><td>${student.status || "Not Started"}</td></tr>`
              ).join("")}
            </table>
          </body>
        </html>
      `;
      downloadFile(html, `bulk_basket_analysis_${department}_${new Date().toISOString().split('T')[0]}.xls`, "application/vnd.ms-excel");
    }
  }

  function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gray-100 text-black">
      {/* Header with Logo */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Centurion University</h1>
                <p className="text-sm text-gray-600">Credits Tracker</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Link href="/dashboard/teacher/data/basket" className="text-gray-600 hover:text-gray-800">← Back to Baskets</Link>
              <span className="text-gray-400">||</span>
              <Link href="/dashboard/teacher" className="text-gray-600 hover:text-gray-800">Teacher Dashboard</Link>
              <span className="text-gray-400">||</span>
              <button 
                onClick={async () => {
                  try {
                    const res = await fetch("/api/debug/database");
                    const data = await res.json();
                    if (data.success) {
                      const debug = data.debug;
                      alert(`Department Analysis (Based on Registration Numbers):\n\nTotal Students: ${debug.totalStudents}\n\nDepartment Distribution:\n${Object.entries(debug.regAnalysis).map(([code, info]) => 
  `Code ${code}: ${info.department} (${info.count} students)`
).join('\n')}\n\nAvailable Fields:\n${debug.allFields.join(', ')}\n\nSample Student Record:\n${JSON.stringify(debug.sampleStudents[0], null, 2)}\n\nSample Result Record:\n${JSON.stringify(debug.sampleResults[0], null, 2)}`);
                    }
                  } catch (err) {
                    alert("Debug failed: " + err.message);
                  }
                }}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                🔍 Debug Database
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">CUTM || Credits Tracker || Search</h1>
          <p className="text-gray-600">Track CBCS progress and basket completion status</p>
        </div>

        {/* Information Panel */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="text-sm text-blue-800">
            <span className="font-semibold">📋 Credit Requirements:</span>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <div>
                <span className="font-medium">Regular Students:</span> 160 total credits
                <div className="text-xs text-blue-600 ml-4">Basket I: 17, Basket II: 12, Basket III: 25, Basket IV: 58, Basket V: 48</div>
              </div>
              <div>
                <span className="font-medium">Lateral Entry Students:</span> <span className="font-bold text-orange-600">120 total credits</span>
                <div className="text-xs text-blue-600 ml-4">Basket I: 6, Basket II: 9, Basket III: 25, Basket IV: 48, Basket V: 32</div>
              </div>
            </div>
            <div className="mt-2 text-xs text-blue-600">
              💡 Lateral entry students are identified by registration numbers with "1" as the 9th character (e.g., 220101131056)
            </div>
          </div>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {/* Department */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Department: <span className="text-red-500">*</span> 
                  <span className="text-xs text-gray-500">(Required for bulk search)</span>
                </label>
                <select 
                  value={department} 
                  onChange={e => setDepartment(e.target.value)} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                >
                  <option value="">Select Department</option>
                  <option value="All">All Departments</option>
                  <option value="Civil Engineering">Civil Engineering</option>
                  <option value="Computer Science Engineering">Computer Science Engineering</option>
                  <option value="Electronics & Communication Engineering">Electronics & Communication Engineering</option>
                  <option value="Electrical & Electronics Engineering">Electrical & Electronics Engineering</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                </select>
                <div className="text-xs text-gray-500">
                  💡 Department selection is mandatory for "All Students" search
                </div>
              </div>

              {/* Batch */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Batch:</label>
                <select 
                  value={batch} 
                  onChange={e => setBatch(e.target.value)} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                >
                  <option value="">Select Batch</option>
                  <option value="All">All Batches</option>
                  {["20","21","22","23","24","25"].map(y => <option key={y} value={y}>{`20${y} (${y})`}</option>)}
                </select>
              </div>

            {/* Registration No */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Registration No:</label>
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-2">
                  <select 
                    value={registration === "all" ? "all" : registration}
                    onChange={e => {
                      const val = e.target.value;
                      setRegistration(val);
                    }} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                  >
                    <option value="">Select Registration</option>
                    <option value="all">All Students</option>
                    {registrationOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {loadingRegistrations && (
                    <div className="text-xs text-gray-500">Loading registrations...</div>
                  )}
                  <input 
                    type="text"
                    value={registration !== "all" ? registration : ""} 
                    onChange={e => setRegistration(e.target.value)} 
                    placeholder="Or type registration manually"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                  />
                </div>
              </div>
              <div className="text-xs text-gray-500">
                💡 Select "All Students" or enter specific registration number
              </div>
            </div>

              {/* Semester */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Semester:</label>
                <select 
                  value={semesterValues.length > 0 ? semesterValues[0] : ""} 
                  onChange={e => setSemesterValues([e.target.value])} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                  disabled={loadingSemesters}
                >
                  <option value="">Select Semester</option>
                  <option value="All">All Semesters</option>
                  {semesters.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {loadingSemesters && <div className="text-xs text-gray-500">Loading semesters...</div>}
              </div>

              {/* FIXED: Basket */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Basket:</label>
                <select 
                  value={basket} 
                  onChange={e => setBasket(e.target.value)} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                >
                  <option value="">Select Basket</option>
                  <option value="All">All Baskets</option>
                  <option value="Basket I">Basket I (17/6 credits)</option>
                  <option value="Basket II">Basket II (12/9 credits)</option>
                  <option value="Basket III">Basket III (25 credits)</option>
                  <option value="Basket IV">Basket IV (58/48 credits)</option>
                  <option value="Basket V">Basket V (48/32 credits)</option>
                </select>
                <div className="text-xs text-gray-500">
                  💡 Filter results by specific basket or view all baskets
                </div>
              </div>
            </div>

            {/* Submit and Clear Buttons */}
            <div className="flex justify-center space-x-4">
              <button 
                type="submit" 
                className={`px-8 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors ${
                  loading ? 'opacity-70 cursor-not-allowed' : ''
                }`}
                disabled={loading}
              >
                {loading ? "Loading..." : "Submit"}
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
                  <p className="mt-1 text-xs text-red-600">
                    Check the browser console for more details or try different filters.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              <div className="text-blue-800">Loading search results...</div>
            </div>
          </div>
        )}

        {/* FIXED: Search Status Information */}
        {searchPerformed && !loading && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
            <div className="text-green-800 text-sm">
              <strong>Search Completed:</strong><br/>
              Department: {department || 'All'}<br/>
              Batch: {batch || 'All'}<br/>
              Basket: {basket || 'All'}<br/>
              Results: {allStudentsData.length} students found<br/>
              {allStudentsData.length > 0 && (
                <span className="text-green-600">
                  ✅ Use the table below to view detailed basket progress for each student
                </span>
              )}
            </div>
          </div>
        )}

        {/* FIXED: Filtering Guide for Teachers */}
        {searchPerformed && !loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
            <div className="text-blue-800 text-sm">
              <strong>📋 Filtering Guide:</strong><br/>
              • <strong>Registration Format:</strong> 2021001234 (10 digits)<br/>
              • <strong>Department Codes:</strong> 1=Civil, 2=CSE, 3=ECE, 5=EEE, 6=Mechanical<br/>
              • <strong>Batch:</strong> First 2 digits (20=2020, 21=2021, etc.)<br/>
              • <strong>Basket Credits:</strong> I(17), II(12), III(25), IV(58), V(48)<br/>
              • <strong>Click on basket numbers</strong> to view detailed subject breakdown
            </div>
          </div>
        )}

        {/* FIXED: No Results Message */}
        {searchPerformed && !loading && registration === "all" && allStudentsData.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6 mb-6">
            <div className="text-center">
              <div className="text-yellow-600 text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">No Students Found</h3>
              <p className="text-yellow-700 mb-4">
                No students found matching your search criteria. Please try:
              </p>
              <ul className="text-yellow-700 text-sm text-left max-w-md mx-auto">
                <li>• Selecting a different department</li>
                <li>• Choosing a different batch</li>
                <li>• Removing some filters to broaden your search</li>
                <li>• Checking if the department has students in the database</li>
              </ul>
              <button 
                onClick={clearFilters}
                className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}

        {/* Data Source Summary for Bulk Results */}
        {searchPerformed && !loading && registration === "all" && dataSources && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-blue-900">📊 Data Sources Used for Basket Calculation</h3>
                <div className="flex items-center space-x-4 mt-2">
                  {dataSources.sources?.cutm1 && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      🔵 CUTM1 Collection ({dataSources.cutm1Records} records)
                    </span>
                  )}
                  {dataSources.sources?.registrationData && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                      🟢 Registration Data Collection ({dataSources.registrationDataRecords} records)
                    </span>
                  )}
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                    ⚪ Total Combined ({dataSources.totalRecords} records)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Results Display */}
        {searchPerformed && !loading && registration === "all" && allStudentsData.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border">
            {/* Results Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Bulk Search Results</h3>
                  <p className="text-sm text-gray-600">
                    Department: <span className="font-medium">{department}</span> | 
                    Total Students: <span className="font-medium">{allStudentsData.length}</span>
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={exportToCSV} 
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                  >
                    Export CSV
                  </button>
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

            {/* Results Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300">
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900">Sl.No</th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900">Name</th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900">Registration No</th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900">Department</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">Basket I (17/6)</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">Basket II (12/9)</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">Basket III (25)</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">Basket IV (58/48)</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">Basket V (48/32)</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">Total Credits (160/120)</th>
                  </tr>
                </thead>
                <tbody>
                  {allStudentsData.map((student, index) => (
                    <tr key={student.registration || index} className="hover:bg-gray-50 transition-colors">
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                      <td 
                        className="border border-gray-300 px-4 py-3 text-sm text-gray-900 font-medium cursor-pointer hover:bg-blue-50 text-blue-600 hover:text-blue-800 transition-colors"
                        onClick={() => handleBulkStudentClick(student)}
                        title="Click to view detailed student progress"
                      >
                        {student.name || 'Unknown'}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 font-mono">
                        {student.registration || 'Unknown'}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900">
                        {student.department || 'Unknown'}
                        {student.is_lateral_entry && (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              Lateral Entry
                            </span>
                          </div>
                        )}
                      </td>
                      <td 
                        className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center cursor-pointer hover:bg-blue-50 text-blue-600 hover:text-blue-800 font-medium transition-colors"
                        onClick={() => handleBulkBasketClick(student, "I")}
                        title="Click to view Basket I details"
                      >
                        {student.basketI || student.basket1 || 0}
                      </td>
                      <td 
                        className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center cursor-pointer hover:bg-blue-50 text-blue-600 hover:text-blue-800 font-medium transition-colors"
                        onClick={() => handleBulkBasketClick(student, "II")}
                        title="Click to view Basket II details"
                      >
                        {student.basketII || student.basket2 || 0}
                      </td>
                      <td 
                        className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center cursor-pointer hover:bg-blue-50 text-blue-600 hover:text-blue-800 font-medium transition-colors"
                        onClick={() => handleBulkBasketClick(student, "III")}
                        title="Click to view Basket III details"
                      >
                        {student.basketIII || student.basket3 || 0}
                      </td>
                      <td 
                        className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center cursor-pointer hover:bg-blue-50 text-blue-600 hover:text-blue-800 font-medium transition-colors"
                        onClick={() => handleBulkBasketClick(student, "IV")}
                        title="Click to view Basket IV details"
                      >
                        {student.basketIV || student.basket4 || 0}
                      </td>
                      <td 
                        className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center cursor-pointer hover:bg-blue-50 text-blue-600 hover:text-blue-800 font-medium transition-colors"
                        onClick={() => handleBulkBasketClick(student, "V")}
                        title="Click to view Basket V details"
                      >
                        {student.basketV || student.basket5 || 0}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center font-semibold bg-gray-50">
                        {student.totalCredits || student.total || 0}
                        {student.is_lateral_entry && (
                          <div className="text-xs text-orange-600 mt-1">
                            /{student.totalRequiredCredits || 120}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FIXED: No Individual Results Message */}
        {searchPerformed && !loading && registration !== "all" && !studentData && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6 mb-6">
            <div className="text-center">
              <div className="text-yellow-600 text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">No Student Data Found</h3>
              <p className="text-yellow-700 mb-4">
                No data found for registration number: <strong>{registration}</strong>
              </p>
              <ul className="text-yellow-700 text-sm text-left max-w-md mx-auto">
                <li>• Verify the registration number is correct</li>
                <li>• Check if the student exists in the database</li>
                <li>• Try removing semester filters</li>
                <li>• Contact administrator if the issue persists</li>
              </ul>
              <button 
                onClick={clearFilters}
                className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}

        {/* Individual Results Display */}
        {searchPerformed && !loading && registration !== "all" && studentData && (
          <div className="bg-white rounded-lg shadow-sm border">
            {/* Export Buttons */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Individual Student Results</h3>
                <div className="flex space-x-2">
                  <button 
                    onClick={exportToCSV} 
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                  >
                    Export CSV
                  </button>
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
              {/* Total Credits Summary Card for Lateral Entry */}
              {studentData.is_lateral_entry && (
                <div className="mb-6 bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-sm">120</span>
                      </div>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-lg font-semibold text-orange-800">
                        Lateral Entry Student - Total Required Credits
                      </h3>
                      <p className="text-orange-700 text-sm">
                        This student requires <strong className="text-orange-900">120 total credits</strong> to complete their degree (instead of 160 for regular students).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Data Source Information */}
              {dataSources && (
                <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-md font-semibold text-blue-900 mb-3">📊 Data Sources Used</h4>
                  <div className="flex items-center space-x-4">
                    {dataSources.sources?.cutm1 && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        🔵 CUTM1 Collection ({dataSources.cutm1Records} records)
                      </span>
                    )}
                    {dataSources.sources?.registrationData && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        🟢 Registration Data Collection ({dataSources.registrationDataRecords} records)
                      </span>
                    )}
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                      ⚪ Total Combined ({dataSources.totalRecords} records)
                    </span>
                  </div>
                </div>
              )}

              {/* Student Information Section */}
              <div className="mb-6">
                <h4 className="text-md font-semibold text-gray-800 mb-3">Student Information</h4>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <table className="w-full border-collapse">
                    <tbody>
                      <tr className="border-b border-gray-200">
                        <td className="px-4 py-3 font-semibold text-gray-700 bg-gray-50 w-1/4">Name:</td>
                        <td className="px-4 py-3 text-gray-900">{studentData.name || 'Unknown'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="px-4 py-3 font-semibold text-gray-700 bg-gray-50">Department:</td>
                        <td className="px-4 py-3 text-gray-900">{studentData.department || 'Unknown'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="px-4 py-3 font-semibold text-gray-700 bg-gray-50">Registration No:</td>
                        <td className="px-4 py-3 text-gray-900 font-mono">{studentData.registration || 'Unknown'}</td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="px-4 py-3 font-semibold text-gray-700 bg-gray-50">Student Type:</td>
                        <td className="px-4 py-3 text-gray-900">
                          {studentData.is_lateral_entry ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              Lateral Entry Student
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Regular Student
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-200">
                        <td className="px-4 py-3 font-semibold text-gray-700 bg-gray-50">Total Required Credits:</td>
                        <td className="px-4 py-3 text-gray-900">
                          <span className={studentData.is_lateral_entry ? "text-orange-600 font-semibold" : ""}>
                            {studentData.is_lateral_entry ? "120 credits (Lateral Entry)" : "160 credits (Regular)"}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-semibold text-gray-700 bg-gray-50">Semester:</td>
                        <td className="px-4 py-3 text-gray-900">
                          {semesterValues.length > 0 && semesterValues[0] !== "All" ? semesterValues[0] : "All Semesters"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Basket Progress Section */}
              <div>
                <h4 className="text-md font-semibold text-gray-800 mb-3">Basket Progress</h4>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100 border-b-2 border-gray-300">
                        <th className="px-4 py-3 text-left font-semibold text-gray-900">Sl.No</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-900">Basket</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-900">Required Credits</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-900">Earned Credits</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-900">Failed Credits</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-900">Total Credits</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-900">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(basketProgress || {}).length > 0 ? (
                        Object.entries(basketProgress).map(([basketName, info], index) => {
                          const earnedCredits = Number(info?.earned_credits) || 0;
                          const failedCredits = Number(info?.failed_credits) || 0;
                          const totalCredits = earnedCredits; // Exclude failed credits from total
                          const requiredCredits = Number(info?.required_credits) || 0;
                          const isCompleted = earnedCredits >= requiredCredits && requiredCredits > 0;
                          const status = isCompleted ? "Completed" : "Not Completed";
                          
                          return (
                            <tr key={basketName} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-center text-gray-900">{index + 1}</td>
                              <td 
                                className="px-4 py-3 cursor-pointer hover:bg-blue-50 text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                onClick={() => handleBasketClick(basketName, info)}
                                title="Click to view detailed subjects"
                              >
                                {basketName} 📋
                              </td>
                              <td className="px-4 py-3 text-center text-gray-900">{requiredCredits}</td>
                              <td className="px-4 py-3 text-center text-green-600 font-medium">{earnedCredits}</td>
                              <td className="px-4 py-3 text-center text-red-600 font-medium">{failedCredits}</td>
                              <td className="px-4 py-3 text-center text-gray-900 font-semibold">{totalCredits}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  isCompleted 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {status}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                            No basket progress data available for this student
                          </td>
                        </tr>
                      )}
                      
                      {Object.entries(basketProgress || {}).length > 0 && (
                        <tr className="bg-gray-50 border-t-2 border-gray-300">
                          <td className="px-4 py-3 font-semibold text-center text-gray-900" colSpan="2">
                            {overallStats.isLateralEntry ? "Lateral Entry Total" : "Total"}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-gray-900">
                            {overallStats.totalRequired}
                            {overallStats.isLateralEntry && (
                              <div className="text-xs text-orange-600 mt-1">Lateral Entry</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-green-600">{overallStats.totalEarned}</td>
                          <td className="px-4 py-3 text-center font-semibold text-red-600">{overallStats.totalFailed}</td>
                          <td className="px-4 py-3 text-center font-semibold text-gray-900">{overallStats.totalCredits}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              overallStats.percentage >= 100 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {overallStats.percentage >= 100 ? "Completed" : "Not Completed"}
                            </span>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Basket Details Modal */}
        {showBasketDetails && selectedBasket && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
                <h3 className="text-xl font-semibold">
                  {selectedBasket.name} - Detailed Subjects
                </h3>
                <button
                  onClick={closeBasketDetails}
                  className="text-white hover:text-gray-200 text-2xl font-bold transition-colors"
                >
                  ×
                </button>
              </div>
              
              {/* Modal Body */}
              <div className="p-6 overflow-y-auto max-h-[70vh]">
                {/* Basket Summary */}
                <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-semibold text-gray-700">Required Credits:</span>
                      <span className="ml-2 text-gray-900">{selectedBasket.info?.required_credits || 0}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Earned Credits:</span>
                      <span className="ml-2 text-green-600 font-medium">{selectedBasket.info?.earned_credits || 0}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Failed Credits:</span>
                      <span className="ml-2 text-red-600 font-medium">{selectedBasket.info?.failed_credits || 0}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Status:</span>
                      <span className={`ml-2 font-medium ${selectedBasket.info?.is_completed ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedBasket.info?.is_completed ? 'Completed' : 'Not Completed'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="mb-4 bg-gray-50 p-3 rounded-lg">
                  <h5 className="text-sm font-semibold text-gray-700 mb-2">📋 Legend:</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="font-medium text-gray-700">Data Sources:</span>
                      <div className="mt-1 space-y-1">
                        <div className="flex items-center">
                          <span className="inline-block w-3 h-3 bg-green-100 border border-green-300 rounded mr-2"></span>
                          <span className="text-green-800">Reg - Registration Data</span>
                        </div>
                        <div className="flex items-center">
                          <span className="inline-block w-3 h-3 bg-gray-100 border border-gray-300 rounded mr-2"></span>
                          <span className="text-gray-800">CUTM1 - Academic Records</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Grade Status:</span>
                      <div className="mt-1 space-y-1">
                        <div className="flex items-center">
                          <span className="inline-block w-3 h-3 bg-green-100 border border-green-300 rounded mr-2"></span>
                          <span className="text-green-800">Completed</span>
                        </div>
                        <div className="flex items-center">
                          <span className="inline-block w-3 h-3 bg-yellow-100 border border-yellow-300 rounded mr-2"></span>
                          <span className="text-yellow-800">Result Not Published</span>
                        </div>
                        <div className="flex items-center">
                          <span className="inline-block w-3 h-3 bg-red-100 border border-red-300 rounded mr-2"></span>
                          <span className="text-red-800">Failed</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Lateral Entry:</span>
                      <div className="mt-1 text-orange-700">
                        Students with "1" as 9th character in registration number require 120 total credits instead of 160.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subjects Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-900">Sl.No</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-900">Subject Code</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-900">Subject Name</th>
                        <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-900">Credits</th>
                        <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-900">Grade</th>
                        <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-900">Data Source</th>
                        <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-900">Semester</th>
                        <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-900">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBasket.subjects && selectedBasket.subjects.length > 0 ? (
                        selectedBasket.subjects.map((subject, index) => (
                          <tr key={`${subject.code}-${index}`} className="hover:bg-gray-50 transition-colors">
                            <td className="border border-gray-300 px-3 py-2 text-center text-gray-900">{index + 1}</td>
                            <td className="border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900">{subject.code || 'N/A'}</td>
                            <td className="border border-gray-300 px-3 py-2 text-gray-900">{subject.name || 'Unknown Subject'}</td>
                            <td className="border border-gray-300 px-3 py-2 text-center text-gray-900">{subject.credits || 0}</td>
                            <td className="border border-gray-300 px-3 py-2 text-center">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                subject.grade === 'Result Not Published'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : subject.completed 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                              }`}>
                                {subject.grade || (subject.completed ? 'PASS' : 'FAIL')}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-3 py-2 text-center">
                              {subject.dataSource && (
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  subject.dataSource === 'Registration' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {subject.dataSource === 'Registration' ? 'Reg' : 'CUTM1'}
                                </span>
                              )}
                            </td>
                            <td className="border border-gray-300 px-3 py-2 text-center text-gray-900">{subject.semester || 'N/A'}</td>
                            <td className="border border-gray-300 px-3 py-2 text-center">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                subject.status === 'Completed'
                                  ? 'bg-green-100 text-green-800' 
                                  : subject.status === 'Failed'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
                                {subject.status || (subject.completed ? 'Completed' : 'Failed')}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="8" className="border border-gray-300 px-3 py-8 text-center text-gray-500">
                            No subjects found in this basket
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
                <button
                  onClick={closeBasketDetails}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* No Results Messages */}
        {searchPerformed && !loading && registration !== "all" && !studentData && !error && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-6">
            <div className="text-center">
              <div className="text-blue-600 text-4xl mb-2">🔍</div>
              <h3 className="text-lg font-medium text-blue-800 mb-2">No Student Data Found</h3>
              <p className="text-blue-700">
                No data found for registration number: <span className="font-mono font-semibold">{registration}</span>
              </p>
              <p className="text-blue-600 text-sm mt-2">
                Please verify the registration number and try again.
              </p>
            </div>
          </div>
        )}

        {searchPerformed && !loading && registration === "all" && allStudentsData.length === 0 && !error && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-6">
            <div className="text-center">
              <div className="text-blue-600 text-4xl mb-2">📊</div>
              <h3 className="text-lg font-medium text-blue-800 mb-2">No Students Found</h3>
              <p className="text-blue-700">
                No students found for department: <span className="font-semibold">{department}</span>
              </p>
              <p className="text-blue-600 text-sm mt-2">
                Please verify the department selection and try different filters.
              </p>
            </div>
          </div>
        )}

        {/* Welcome Message */}
        {!searchPerformed && !loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-6">
            <div className="text-center">
              <div className="text-blue-600 text-4xl mb-4">🎯</div>
              <h3 className="text-lg font-medium text-blue-800 mb-3">Welcome to CUTM Credits Tracker</h3>
              <div className="text-blue-700 text-left max-w-2xl mx-auto">
                <p className="mb-3">Choose your tracking mode:</p>
                <ul className="list-disc ml-6 space-y-2">
                  <li><strong>Individual Mode:</strong> Enter a specific registration number to track one student's basket progress in detail</li>
                  <li><strong>Bulk Mode:</strong> Select "All Students" to analyze multiple students' progress at once (department selection required)</li>
                </ul>
                <p className="mt-3 text-sm text-blue-600">
                  💡 Use filters to narrow down your search and get more specific results.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        * { color: black !important; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        @media print {
          body { background: white !important; }
          .min-h-screen { min-height: auto !important; }
          .shadow-sm, .shadow-xl { box-shadow: none !important; }
          .rounded-lg, .rounded-md { border-radius: 0 !important; }
          .fixed { position: relative !important; }
          .inset-0 { top: auto !important; left: auto !important; right: auto !important; bottom: auto !important; }
          .bg-black { background: transparent !important; }
          .bg-opacity-50 { background: transparent !important; }
          .p-4, .p-6 { padding: 0 !important; }
          .mb-6, .mb-4, .mb-3, .mb-2 { margin-bottom: 1rem !important; }
          .text-white { color: #000 !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #000 !important; padding: 4px !important; }
          .bg-gray-50, .bg-gray-100 { background: #f0f0f0 !important; }
        }
      `}</style>
    </div>
  );
}