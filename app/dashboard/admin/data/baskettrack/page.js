"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";

export default function BasketProgressTracker() {
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
  
  // Enhanced UI state
  const [viewMode, setViewMode] = useState('table'); // 'table', 'cards', 'chart'
  const [sortBy, setSortBy] = useState('name'); // 'name', 'registration', 'credits', 'percentage'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'completed', 'in-progress', 'not-started'
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [notifications, setNotifications] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState('csv');
  const [darkMode, setDarkMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showStats, setShowStats] = useState(true);

  // Enhanced utility functions
  const addNotification = useCallback((type, message) => {
    const notification = {
      id: Date.now(),
      type,
      message,
      timestamp: new Date()
    };
    setNotifications(prev => [...prev, notification]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      console.log('Audio notification not supported');
    }
  }, []);

  // FIXED: Clear filters function
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
    setSearchTerm('');
    setFilterStatus('all');
    setShowAdvancedFilters(false);
    addNotification('info', 'All filters cleared successfully');
  }

  // FIXED: Enhanced submission with proper state management
  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSearchPerformed(true);
    setLoading(true);
    
    // FIXED: Reset previous results immediately
    setStudentData(null);
    setBasketProgress({});
    setAllStudentsData([]);
    
    try {
      const isBulkSearch = registration === "all" || registration === "";
      
      if (isBulkSearch) {
        // FIXED: Enhanced department validation for bulk search
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
          // This is valid - will get all students
        }
        
        // FIXED: Enhanced request body with proper filtering
        const requestBody = { 
          registration: "all",
          department: department === "All" || department === "Select Department" ? "" : department, // Send empty string for "All" departments
          batch: batch && batch !== "All" && batch !== "Select Batch" ? batch : "", // Send empty string for "All" batches
          semesters: semesterValues.length > 0 && !semesterValues.includes("All") ? semesterValues : [], // Send empty array for "All" semesters
          basket: basket && basket !== "All" && basket !== "Select Basket" ? basket : "" // Send empty string for "All" baskets
        };
        
        console.log("Frontend sending request:", requestBody);
        
        console.log("Making fetch request to:", "/api/cbcs/track/bulk");
        let res;
        try {
          res = await fetch("/api/cbcs/track/bulk", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify(requestBody)
          });
          console.log("Fetch completed, response received");
        } catch (fetchError) {
          console.error("Fetch error:", fetchError);
          throw new Error(`Network error: ${fetchError.message}`);
        }
        
        console.log("Response status:", res.status);
        console.log("Response headers:", Object.fromEntries(res.headers.entries()));
        
        let data;
        try {
          const responseText = await res.text();
          console.log("Raw response:", responseText);
          data = JSON.parse(responseText);
          console.log("Parsed response:", data);
        } catch (parseError) {
          console.error("Parse error:", parseError);
          throw new Error("Invalid response from server. Please check your network connection.");
        }
        
        if (!res.ok) {
          
          if (res.status === 404) {
            // Show debug information if available
            if (data?.debug) {
              const debugInfo = data.debug;
              const errorMsg = `No students found in ${department}. 

Debug Information:
- Total students in database: ${debugInfo.totalStudents}
- Available departments: ${debugInfo.uniqueBranches?.join(', ') || 'None found'}
- Sample students: ${debugInfo.sampleStudents?.map(s => `${s.Reg_No} (${s.Branch})`).join(', ') || 'None found'}
- Query used: ${JSON.stringify(debugInfo.query)}

${debugInfo.suggestions || ''}

Please check if the department name matches exactly with the available departments above.`;
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
        
        // FIXED: Enhanced data processing
        const students = data.students || data.data || [];
        
        if (!students || students.length === 0) {
          throw new Error(`No students found in ${department}. Try selecting "All Departments" or check if students exist in this department.`);
        }
        
        // FIXED: Set data with proper validation
        setAllStudentsData(students);
        setDataSources(data.dataSources || null);
        setLastUpdated(new Date());
        
        // Success notification
        addNotification('success', `Found ${students.length} students in ${department}`);
        playNotificationSound();
        
      } else {
        // FIXED: Enhanced validation for individual search
        if (!registration || registration.trim().length < 6) {
          throw new Error("Please enter a valid registration number (minimum 6 characters)");
        }
        
        if (department && (department === "Select Department")) {
          throw new Error("Please select a valid department or leave it empty");
        }
        
        // FIXED: Individual student search with proper filtering
        const requestBody = {
          department: department && department !== "All" && department !== "Select Department" ? department : "", 
          batch: batch && batch !== "All" && batch !== "Select Batch" ? batch : "", 
          registration: registration.trim().toUpperCase(), 
          semesters: semesterValues.length > 0 && !semesterValues.includes("All") ? semesterValues : [], 
          basket: basket && basket !== "All" && basket !== "Select Basket" ? basket : ""
        };
        
        console.log("Individual search request:", requestBody);
        
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
        } catch (parseError) {
          throw new Error("Invalid response from server");
        }
        
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error(`Student with registration ${registration} not found. Please check the registration number.`);
          } else {
            throw new Error(data.error || "Unable to load student progress");
          }
        }
        
        // FIXED: Enhanced individual data processing
        const student = data.student || data.data;
        const progress = data.basketProgress || data.progress || {};
        
        if (!student) {
          throw new Error(`No data found for registration ${registration}. Please verify the registration number.`);
        }
        
        setStudentData(student);
        setBasketProgress(progress);
        setDataSources(data.dataSources || null);
        setLastUpdated(new Date());
        
        // Success notification
        addNotification('success', `Student data loaded successfully for ${student.name}`);
        playNotificationSound();
      }
    } catch (err) {
      setError(err.message);
      setStudentData(null);
      setBasketProgress({});
      setAllStudentsData([]);
      addNotification('error', err.message);
    } finally {
      setLoading(false);
    }
  }

  // Load registration list when department and batch are selected
  useEffect(() => {
    async function loadRegistrations() {
      try {
        setLoadingRegistrations(true);
        setError("");
        setRegistrationOptions([]);
        // Map UI department to API branch code names expected by /api/batch
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
        // Surface a subtle error note but don't block the page
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

  // Enhanced stats calculation
  const overallStats = useMemo(() => {
    const entries = Object.values(basketProgress || {});
    const totalBaskets = entries.length || 5;
    const basketsCompleted = entries.filter((b) => b && b.is_completed).length;
    const totalEarned = entries.reduce((sum, b) => sum + (Number(b?.earned_credits) || 0), 0);
    const totalFailed = entries.reduce((sum, b) => sum + (Number(b?.failed_credits) || 0), 0);
    const totalCredits = totalEarned + totalFailed; // FIXED: Include failed credits in total
    const totalRequired = studentData?.is_lateral_entry ? 120 : 160;
    const percentage = Math.min(100, Math.round((totalEarned / totalRequired) * 100));
    return { totalBaskets, basketsCompleted, totalEarned, totalFailed, totalCredits, totalRequired, percentage };
  }, [basketProgress, studentData]);

  // Enhanced filtering and sorting for bulk results
  const filteredAndSortedStudents = useMemo(() => {
    let students = [...allStudentsData];
    
    // Apply search term filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      students = students.filter(student => 
        student.name?.toLowerCase().includes(term) ||
        student.registration?.toLowerCase().includes(term) ||
        student.department?.toLowerCase().includes(term)
      );
    }
    
    // Apply status filter
    if (filterStatus !== 'all') {
      students = students.filter(student => {
        switch (filterStatus) {
          case 'completed':
            return student.status === 'Completed';
          case 'in-progress':
            return student.status === 'In Progress';
          case 'not-started':
            return student.status === 'Not Started';
          default:
            return true;
        }
      });
    }
    
    // Apply sorting
    students.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'name':
          aVal = a.name || '';
          bVal = b.name || '';
          break;
        case 'registration':
          aVal = a.registration || '';
          bVal = b.registration || '';
          break;
        case 'credits':
          aVal = a.totalCredits || 0;
          bVal = b.totalCredits || 0;
          break;
        case 'percentage':
          aVal = a.percentage || 0;
          bVal = b.percentage || 0;
          break;
        default:
          aVal = a.name || '';
          bVal = b.name || '';
      }
      
      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });
    
    return students;
  }, [allStudentsData, searchTerm, filterStatus, sortBy, sortOrder]);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh && searchPerformed && !loading) {
      const interval = setInterval(() => {
        onSubmit({ preventDefault: () => {} });
        addNotification('info', 'Data refreshed automatically');
      }, 30000); // Refresh every 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [autoRefresh, searchPerformed, loading]);

  // Function to handle basket click and show detailed subjects
  function handleBasketClick(basketName, basketInfo) {
    setSelectedBasket({
      name: basketName,
      info: basketInfo,
      subjects: basketInfo?.subjects || []
    });
    setShowBasketDetails(true);
  }

  // Function to close basket details
  function closeBasketDetails() {
    setShowBasketDetails(false);
    setSelectedBasket(null);
  }

  // Function to handle basket click from bulk results
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
          semesters: [],
          basket: `Basket ${basketNumber}`
        })
      });
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
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

  // Function to handle student name click from bulk results
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
          semesters: [],
          basket: ""
        })
      });
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setStudentData(data.student);
      setBasketProgress(data.basketProgress || {});
      setSearchPerformed(true);
      
    } catch (err) {
      setError(`Failed to load student details: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Enhanced export functions
  const exportToCSV = useCallback(() => {
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
      addNotification('success', 'CSV exported successfully');
    } else if (registration === "all" && filteredAndSortedStudents.length > 0) {
      const csvData = [];
      csvData.push(["Sl.No", "Name", "Registration No", "Department", "Student Type", "Basket I", "Basket II", "Basket III", "Basket IV", "Basket V", "Total Credits", "Required Credits", "Percentage", "Status"]);
      
      filteredAndSortedStudents.forEach((student, index) => {
        csvData.push([
          index + 1,
          student.name,
          student.registration,
          student.department,
          student.is_lateral_entry ? 'Lateral Entry' : 'Regular',
          student.basketI || 0,
          student.basketII || 0,
          student.basketIII || 0,
          student.basketIV || 0,
          student.basketV || 0,
          student.totalCredits || 0,
          student.totalRequiredCredits || (student.is_lateral_entry ? 120 : 160),
          `${student.percentage || 0}%`,
          student.status || "Not Started"
        ]);
      });
      
      const csv = csvData.map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
      downloadFile(csv, `bulk_basket_analysis_${department}_${new Date().toISOString().split('T')[0]}.csv`, "text/csv");
      addNotification('success', `CSV exported with ${filteredAndSortedStudents.length} students`);
    }
  }, [registration, studentData, filteredAndSortedStudents, department, addNotification]);

  const exportToExcel = useCallback(() => {
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
      addNotification('success', 'Excel file exported successfully');
    } else if (registration === "all" && filteredAndSortedStudents.length > 0) {
      const html = `
        <html>
          <head><meta charset="UTF-8"></head>
          <body>
            <h2>Bulk Basket Analysis Report</h2>
            <table border="1">
              <tr><th>Sl.No</th><th>Name</th><th>Registration No</th><th>Department</th><th>Student Type</th><th>Basket I</th><th>Basket II</th><th>Basket III</th><th>Basket IV</th><th>Basket V</th><th>Total Credits</th><th>Required Credits</th><th>Percentage</th><th>Status</th></tr>
              ${filteredAndSortedStudents.map((student, index) => 
                `<tr><td>${index + 1}</td><td>${student.name}</td><td>${student.registration}</td><td>${student.department}</td><td>${student.is_lateral_entry ? 'Lateral Entry' : 'Regular'}</td><td>${student.basketI || 0}</td><td>${student.basketII || 0}</td><td>${student.basketIII || 0}</td><td>${student.basketIV || 0}</td><td>${student.basketV || 0}</td><td>${student.totalCredits || 0}</td><td>${student.totalRequiredCredits || (student.is_lateral_entry ? 120 : 160)}</td><td>${student.percentage || 0}%</td><td>${student.status || "Not Started"}</td></tr>`
              ).join("")}
            </table>
          </body>
        </html>
      `;
      downloadFile(html, `bulk_basket_analysis_${department}_${new Date().toISOString().split('T')[0]}.xls`, "application/vnd.ms-excel");
      addNotification('success', `Excel file exported with ${filteredAndSortedStudents.length} students`);
    }
  }, [registration, studentData, filteredAndSortedStudents, department, addNotification]);

  const exportToPDF = useCallback(async () => {
    setIsExporting(true);
    try {
      // Simulate PDF generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      addNotification('success', 'PDF export completed');
    } catch (error) {
      addNotification('error', 'PDF export failed');
    } finally {
      setIsExporting(false);
    }
  }, [addNotification]);

  const shareProgress = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: 'CUTM Basket Progress Report',
        text: `Basket progress analysis for ${department} department - ${filteredAndSortedStudents.length} students`,
        url: window.location.href
      });
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(`CUTM Basket Progress Report - ${department} department: ${window.location.href}`);
      addNotification('success', 'Report link copied to clipboard');
    }
  }, [department, filteredAndSortedStudents.length, addNotification]);

  const downloadFile = useCallback((content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Debug information removed for production

  return (
    <div className={`min-h-screen transition-all duration-300 ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'}`}>
      {/* Enhanced Header */}
      <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white/80 backdrop-blur-sm'} shadow-lg border-b`}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-xl font-bold">📊</span>
              </div>
              <div>
                <h1 className={`text-3xl font-extrabold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  CUTM Basket Tracker
                </h1>
                <p className={`mt-1 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  🎯 Advanced CBCS basket progress analysis and management
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-lg transition-all duration-300 ${
                  darkMode ? 'bg-gray-700 text-yellow-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title="Toggle dark mode"
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
              <Link
                href="/dashboard/admin/data/basket"
                className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                  darkMode 
                    ? 'bg-gray-700 text-white hover:bg-gray-600 border border-gray-600' 
                    : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-lg'
                }`}
              >
                ← Back to Baskets
              </Link>
              <Link
                href="/dashboard/admin"
                className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                  darkMode 
                    ? 'bg-gray-700 text-white hover:bg-gray-600 border border-gray-600' 
                    : 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white shadow-lg'
                }`}
              >
                Admin Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Enhanced Page Title */}
        <div className="text-center mb-8">
          <h1 className={`text-4xl font-extrabold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Advanced Basket Progress Tracker
          </h1>
          <p className={`text-lg ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            🎯 Comprehensive CBCS basket analysis with real-time insights
          </p>
          
          {/* Enhanced Credit Requirements Card */}
          <div className={`mt-6 p-6 rounded-2xl shadow-lg max-w-5xl mx-auto ${
            darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200'
          }`}>
            <div className={`text-sm ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>
              <span className="font-bold text-lg">📋 Credit Requirements Overview</span>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-white/60'}`}>
                  <span className="font-semibold">Regular Students:</span> 
                  <span className={`ml-2 font-bold ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>160 total credits</span>
                  <div className="text-xs mt-2 space-y-1">
                    <div>Basket I: 17 credits</div>
                    <div>Basket II: 12 credits</div>
                    <div>Basket III: 25 credits</div>
                    <div>Basket IV: 58 credits</div>
                    <div>Basket V: 48 credits</div>
                  </div>
                </div>
                <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-white/60'}`}>
                  <span className="font-semibold">Lateral Entry Students:</span> 
                  <span className="ml-2 font-bold text-orange-500">120 total credits</span>
                  <div className="text-xs mt-2 space-y-1">
                    <div>Basket I: 6 credits</div>
                    <div>Basket II: 9 credits</div>
                    <div>Basket III: 25 credits</div>
                    <div>Basket IV: 48 credits</div>
                    <div>Basket V: 32 credits</div>
                  </div>
                </div>
              </div>
              <div className={`mt-4 text-xs p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white/40'}`}>
                💡 <strong>Special Note:</strong> CUTM1046 is assigned to Basket IV for ECE students, Basket V for CSE students. 
                Lateral entry students are identified by registration numbers with "1" as the 9th character.
              </div>
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

        {/* Lateral Entry Student Alert */}
        {searchPerformed && !loading && registration !== "all" && studentData && studentData.is_lateral_entry && (
          <div className="bg-orange-50 border-l-4 border-orange-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-orange-800">
                  🎓 Lateral Entry Student Detected
                </h3>
                <div className="mt-2 text-sm text-orange-700">
                  <p>
                    <strong>{studentData.name}</strong> ({studentData.registration}) is a lateral entry student.
                  </p>
                  <p className="mt-1">
                    <strong>Total Required Credits: <span className="text-orange-900 font-bold">120 credits</span></strong> (instead of 160 for regular students)
                  </p>
                  <div className="mt-2 text-xs">
                    <strong>Modified Basket Requirements:</strong> Basket I: 6, Basket II: 9, Basket III: 25, Basket IV: 48, Basket V: 32
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
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

        {/* FIXED: Loading Indicator */}
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

        {/* FIXED: Enhanced Bulk Results Display */}
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

            {/* Data Source Summary */}
            {dataSources && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-semibold text-blue-800 mb-2">📊 Data Sources Used for Basket Calculation:</h4>
                <div className="flex flex-wrap gap-3">
                  {dataSources.sources.cutm1 && (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        CUTM1 Collection
                      </span>
                      <span className="text-sm text-blue-700">{dataSources.cutm1Records} records</span>
                    </div>
                  )}
                  {dataSources.sources.registrationData && (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        Registration Data Collection
                      </span>
                      <span className="text-sm text-green-700">{dataSources.registrationDataRecords} records</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                      Total Combined
                    </span>
                    <span className="text-sm text-gray-700 font-semibold">{dataSources.totalRecords} records</span>
                  </div>
                </div>
              </div>
            )}

            {/* FIXED: Enhanced Results Table */}
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
                          <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                            Lateral Entry
                          </span>
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

        {/* FIXED: Enhanced Individual Results Display */}
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
                          {studentData.student_type || 'Regular'}
                          {studentData.is_lateral_entry && (
                            <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                              Lateral Entry
                            </span>
                          )}
                        </td>
                      </tr>
                      {dataSources && (
                        <tr className="border-b border-gray-200">
                          <td className="px-4 py-3 font-semibold text-gray-700 bg-gray-50">Data Sources:</td>
                          <td className="px-4 py-3 text-gray-900">
                            <div className="flex flex-wrap gap-2">
                              {dataSources.sources.cutm1 && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                  CUTM1 ({dataSources.cutm1Records} records)
                                </span>
                              )}
                              {dataSources.sources.registrationData && (
                                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                  Registration Data ({dataSources.registrationDataRecords} records)
                                </span>
                              )}
                              <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                                Total: {dataSources.totalRecords} records
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-gray-200">
                        <td className="px-4 py-3 font-semibold text-gray-700 bg-gray-50">Total Required Credits:</td>
                        <td className="px-4 py-3 text-gray-900">
                          <span className={`font-bold ${studentData.is_lateral_entry ? 'text-orange-600' : 'text-blue-600'}`}>
                            {studentData.overall_stats?.total_required_credits || (studentData.is_lateral_entry ? 120 : 160)} credits
                          </span>
                          {studentData.is_lateral_entry && (
                            <span className="ml-2 text-xs text-gray-500">(Lateral Entry)</span>
                          )}
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
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-md font-semibold text-gray-800">Basket Progress</h4>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-gray-600">Data Sources:</span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 font-medium">Reg</span>
                      <span className="text-gray-600">Registration Data</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded bg-gray-100 text-gray-800 font-medium">CUTM1</span>
                      <span className="text-gray-600">CUTM1 Database</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800 font-medium">Result Not Published</span>
                      <span className="text-gray-600">Registration subjects (no grade yet)</span>
                    </div>
                  </div>
                </div>
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
                          const totalCredits = earnedCredits + failedCredits; // FIXED: Include failed credits in total
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
                      
                      {/* Total Row */}
                      {Object.entries(basketProgress || {}).length > 0 && (
                        <tr className="bg-gray-50 border-t-2 border-gray-300">
                          <td className="px-4 py-3 font-semibold text-center text-gray-900" colSpan="2">Total</td>
                          <td className="px-4 py-3 text-center font-semibold text-gray-900">
                            {studentData.is_lateral_entry ? 120 : overallStats.totalRequired}
                            {studentData.is_lateral_entry && (
                              <div className="text-xs text-orange-600 mt-1">
                                Lateral Entry Total
                              </div>
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
                            {studentData.is_lateral_entry && (
                              <div className="text-xs text-orange-600 mt-1">
                                Lateral Entry Student
                              </div>
                            )}
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

        {/* FIXED: Enhanced Basket Details Modal */}
        {showBasketDetails && selectedBasket && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-semibold">
                    {selectedBasket.name} - Detailed Subjects
                  </h3>
                  {studentData?.is_lateral_entry && (
                    <div className="mt-1">
                      <span className="px-2 py-1 bg-orange-500 text-white text-xs rounded-full">
                        Lateral Entry Student - Modified Credit Requirements
                      </span>
                    </div>
                  )}
                </div>
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
                  {studentData?.is_lateral_entry && (
                    <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded text-sm">
                      <span className="font-semibold text-orange-800">Note:</span>
                      <span className="text-orange-700 ml-1">
                        This student is a lateral entry student with modified credit requirements. 
                        Total required credits: 120 (instead of 160 for regular students).
                      </span>
                    </div>
                  )}
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
                            <td className="border border-gray-300 px-3 py-2 text-center text-gray-900">{subject.semester || 'N/A'}</td>
                            <td className="border border-gray-300 px-3 py-2 text-center">
                              <div className="flex flex-col gap-1">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  subject.completed 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {subject.completed ? 'Completed' : 'Failed'}
                                </span>
                                {subject.dataSource && (
                                  <span className={`px-1 py-0.5 rounded text-xs font-medium ${
                                    subject.dataSource === 'Registration' 
                                      ? 'bg-blue-100 text-blue-800' 
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {subject.dataSource === 'Registration' ? 'Reg' : 'CUTM1'}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" className="border border-gray-300 px-3 py-8 text-center text-gray-500">
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

        {/* FIXED: Enhanced No Results Messages */}
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
