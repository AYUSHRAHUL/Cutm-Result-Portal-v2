"use client";

import { useEffect, useMemo, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { appendSchoolParams, getSchoolApiUrl } from "@/lib/api-helper";

// Excel XML Helper Functions
function escapeXml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sanitizeSheetName(name) {
  if (!name) return "Sheet1";
  const cleaned = name.replace(/[\[\]\*\/\\\?\:]/g, "").trim();
  if (!cleaned) return "Sheet1";
  return cleaned.slice(0, 31);
}

function createExcelCell(value, styleId = null) {
  // Always create a cell, even if empty
  let cellXml = "<Cell";
  if (styleId) {
    cellXml += ` ss:StyleID="${styleId}"`;
  }
  cellXml += ">";

  // Only add Data if there's a value
  if (value !== null && value !== undefined && value !== "") {
    const strValue = String(value);
    // Check if it's a number (but not empty string)
    const isNum = !isNaN(strValue) && !isNaN(parseFloat(strValue)) && strValue.trim() !== "";
    const type = isNum ? "Number" : "String";
    const data = escapeXml(strValue);
    cellXml += `<Data ss:Type="${type}">${data}</Data>`;
  }

  cellXml += "</Cell>";
  return cellXml;
}

function createExcelMergedCell(value, styleId, mergeAcross = 0) {
  let cellXml = "<Cell";
  if (styleId) {
    cellXml += ` ss:StyleID="${styleId}"`;
  }
  if (mergeAcross > 0) {
    cellXml += ` ss:MergeAcross="${mergeAcross}"`;
  }
  cellXml += ">";

  // Only add Data if there's a value
  if (value !== null && value !== undefined && value !== "") {
    const strValue = String(value);
    const isNum = !isNaN(strValue) && !isNaN(parseFloat(strValue)) && strValue.trim() !== "";
    const type = isNum ? "Number" : "String";
    const data = escapeXml(strValue);
    cellXml += `<Data ss:Type="${type}">${data}</Data>`;
  }

  cellXml += "</Cell>";
  return cellXml;
}

function createExcelRow(cells) {
  return `<Row>${cells.join("")}</Row>`;
}

function TeacherBasketProgressTrackerContent() {
  const searchParams = useSearchParams();
  const school = searchParams.get('school');
  const isDiploma = school?.toUpperCase() === 'SOVET' || school?.toUpperCase()?.includes('VOCATIONAL');
  const [department, setDepartment] = useState("");

  const btechDeptsList = [
    { value: "Civil Engineering", label: "Civil Engineering" },
    { value: "Computer Science Engineering", label: "Computer Science Engineering" },
    { value: "Electronics & Communication Engineering", label: "Electronics & Communication Engineering" },
    { value: "Electrical & Electronics Engineering", label: "Electrical & Electronics Engineering" },
    { value: "Mechanical Engineering", label: "Mechanical Engineering" },
    { value: "AIML", label: "AIML" }
  ];
  const diplomaDeptsList = [
    { value: "Civil Engineering", label: "Civil Engineering" },
    { value: "Computer Science Engineering", label: "Computer Science Engineering" },
    { value: "Electrical Engineering", label: "Electrical Engineering" },
    { value: "Mechanical Engineering", label: "Mechanical Engineering" },
    { value: "Mining Engineering", label: "Mining Engineering" },
    { value: "Automobile Engineering", label: "Automobile Engineering" }
  ];
  const deptOptions = isDiploma ? diplomaDeptsList : btechDeptsList;

  const [batch, setBatch] = useState("");
  const [registration, setRegistration] = useState("");
  const [registrationOptions, setRegistrationOptions] = useState([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  // Hardcoded semester list - always show all 8 semesters
  const allSemesters = ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6", "Sem 7", "Sem 8"];
  const [semesters, setSemesters] = useState(allSemesters);
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
  const [sortBy, setSortBy] = useState('registration'); // default to registration number sorting
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

  // Batch-based flags for dynamic labels (2024 onwards)
  const is2024Onwards = useMemo(() => {
    const n = Number(batch);
    return !Number.isNaN(n) && n >= 24;
  }, [batch]);

  const legacyRegularCreditRequirements = { total: 160, basket1: 17, basket2: 12, basket3: 25, basket4: 58, basket5: 48 };
  const regularCreditRequirements = { total: 160, basket1: 17, basket2: 12, basket3: 25, basket4: 60, basket5: 46 };
  const lateralCreditRequirements = { total: 120, basket1: 6, basket2: 9, basket3: 25, basket4: 48, basket5: 32 };

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
    setSelectedRegistrations([]); // Clear multi-select registrations
    setSemesterValues([]);
    setBasket("");
    setError("");
    setStudentData(null);
    setBasketProgress({});
    setAllStudentsData([]);
    setDataSources(null);
    setSearchPerformed(false);
    setSemesters(allSemesters); // Keep all semesters visible
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
      const isBulkSearch = registration === "all";

      if (isBulkSearch) {
        // FIXED: Enhanced department validation for bulk search
        if (!department || department === "" || department === "Select Department") {
          throw new Error("Please select a valid department for bulk search");
        }

        const btechDepts = [
          "All",
          "Civil Engineering",
          "Computer Science Engineering",
          "Electronics & Communication Engineering",
          "Electrical & Electronics Engineering",
          "Mechanical Engineering",
          "AIML"
        ];
        const diplomaDepts = [
          "All",
          "Civil Engineering",
          "Computer Science Engineering",
          "Electrical Engineering",
          "Mechanical Engineering",
          "Mining Engineering",
          "Automobile Engineering"
        ];
        const validDepartments = isDiploma ? diplomaDepts : btechDepts;

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
          const url = appendSchoolParams("/api/cbcs/track/bulk");
          res = await fetch(url, {
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
        // Single registration search
        if (!registration || registration.trim().length < 6) {
          throw new Error("Please enter a valid registration number (minimum 6 characters)");
        }

        const normalizedDepartment = department && department !== "All" && department !== "Select Department" ? department : "";
        const normalizedBatch = batch && batch !== "All" && batch !== "Select Batch" ? batch : "";
        const normalizedSemesters = semesterValues.length > 0 && !semesterValues.includes("All") ? semesterValues : [];
        const normalizedBasket = basket && basket !== "All" && basket !== "Select Basket" ? basket : "";
        
        const requestBody = {
          department: normalizedDepartment,
          batch: normalizedBatch,
          registration: registration.trim().toUpperCase(),
          semesters: normalizedSemesters,
          basket: normalizedBasket
        };

          console.log("Individual search request:", requestBody);

          const url = appendSchoolParams("/api/cbcs/track");
          const res = await fetch(url, {
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
              throw new Error(`Student with registration ${registration.trim().toUpperCase()} not found. Please check the registration number.`);
            } else {
              throw new Error(data.error || "Unable to load student progress");
            }
          }

          // FIXED: Enhanced individual data processing
          const student = data.student || data.data;
          const progress = data.basketProgress || data.progress || {};

          if (!student) {
            throw new Error(`No data found for registration ${registration.trim().toUpperCase()}. Please verify the registration number.`);
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
        const branchMap = isDiploma ? {
          "Civil Engineering": "Civil",
          "Computer Science Engineering": "CSE",
          "Electronics & Communication Engineering": "ECE",
          "Electrical Engineering": "Electrical",
          "Mechanical Engineering": "Mechanical",
          "Automobile Engineering": "Automobile",
          "Mining Engineering": "Mining"
        } : {
          "Civil Engineering": "Civil",
          "Computer Science Engineering": "CSE",
          "Electronics & Communication Engineering": "ECE",
          "Electrical & Electronics Engineering": "EEE",
          "Mechanical Engineering": "Mechanical",
          "AIML": "AIML",
        };
        const branch = department && department !== "All" ? branchMap[department] : undefined;
        const hasBatch = batch && batch !== "All";
        const body = { ...(branch ? { branch } : {}), ...(hasBatch ? { batch } : {}) };
        const batchUrl = getSchoolApiUrl("batch");
        const res = await fetch(batchUrl, {
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
        // Sort by last 4 digits of registration number
        options.sort((a, b) => {
          const regA = String(a.value || '').trim();
          const regB = String(b.value || '').trim();
          const last4A = regA.length >= 4 ? regA.slice(-4) : regA;
          const last4B = regB.length >= 4 ? regB.slice(-4) : regB;
          return last4A.localeCompare(last4B, undefined, { numeric: true });
        });
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
    setSemesters(allSemesters); // Keep all semesters visible
    setSemesterValues([]);

    if (department && department !== "" && department !== "All" && batch && batch !== "" && batch !== "All") {
      loadRegistrations();
    } else {
      setRegistrationOptions([]);
    }
  }, [department, batch, isDiploma]);

  // Load semesters for registration
  async function loadSemestersForRegistration(value) {
    // Always keep all 8 semesters visible - no need to fetch
    // Individual registration doesn't restrict semester options
    return;
  }

  // Semesters always stay as all 8 - no need to change based on registration
  useEffect(() => {
    // Keep all semesters visible always
    setSemesters(allSemesters);
  }, [registration]);

  // Enhanced stats calculation
  const overallStats = useMemo(() => {
    const entries = Object.values(basketProgress || {});
    // Always expect 5 baskets (Basket I, II, III, IV, V) for total calculation
    const expectedBaskets = ["Basket I", "Basket II", "Basket III", "Basket IV", "Basket V"];
    const totalBaskets = expectedBaskets.length; // Always 5

    // Calculate baskets completed using the EXACT same logic as individual rows: earned >= required
    let basketsCompleted = 0;
    const basketStatuses = {};

    expectedBaskets.forEach((basketName) => {
      const b = basketProgress[basketName];
      if (b) {
        const earnedCredits = Number(b.earned_credits) || 0;
        const requiredCredits = Number(b.required_credits) || 0;
        // EXACT same logic as individual row: earnedCredits >= requiredCredits && requiredCredits > 0
        const isCompleted = earnedCredits >= requiredCredits && requiredCredits > 0;
        basketStatuses[basketName] = { earnedCredits, requiredCredits, isCompleted };
        if (isCompleted) {
          basketsCompleted++;
        }
      } else {
        basketStatuses[basketName] = { earnedCredits: 0, requiredCredits: 0, isCompleted: false };
      }
    });

    // Calculate totals from all baskets in basketProgress
    const totalEarned = entries.reduce((sum, b) => sum + (Number(b?.earned_credits) || 0), 0);
    const totalFailed = entries.reduce((sum, b) => sum + (Number(b?.failed_credits) || 0), 0);
    const totalCredits = totalEarned + totalFailed; // earned + failed for totals
    const totalRequired = studentData?.is_lateral_entry ? 120 : 160;
    const percentage = Math.min(100, Math.round((totalEarned / totalRequired) * 100));

    console.log('🔍 Overall Stats Calculation:', {
      totalBaskets,
      basketsCompleted,
      allBasketsCompleted: basketsCompleted === totalBaskets,
      basketStatuses,
      willShowTotalAs: basketsCompleted === totalBaskets && totalBaskets > 0 ? 'Completed' : 'Not Completed'
    });

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
      let aVal;
      let bVal;

      switch (sortBy) {
        case 'name':
          aVal = (a.name || '').toString().toLowerCase().trim();
          bVal = (b.name || '').toString().toLowerCase().trim();
          break;
        case 'registration':
          aVal = (a.registration || '').toString().toLowerCase().trim();
          bVal = (b.registration || '').toString().toLowerCase().trim();
          break;
        case 'credits':
          aVal = Number(a.totalCredits) || 0;
          bVal = Number(b.totalCredits) || 0;
          break;
        case 'percentage':
          aVal = Number(a.percentage) || 0;
          bVal = Number(b.percentage) || 0;
          break;
        default:
          aVal = (a.name || '').toString().toLowerCase().trim();
          bVal = (b.name || '').toString().toLowerCase().trim();
      }

      if (typeof aVal === 'string') {
        const comparison = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
        return sortOrder === 'asc' ? comparison : -comparison;
      } else {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });

    return students;
  }, [allStudentsData, searchTerm, filterStatus, sortBy, sortOrder]);

  const sortedBasketSubjects = useMemo(() => {
    if (!selectedBasket?.subjects) return [];

    const parseSemesterValue = (semester) => {
      if (!semester) return Number.MAX_SAFE_INTEGER;
      const match = semester.toString().match(/\d+/);
      return match ? parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
    };

    return [...selectedBasket.subjects].sort((a, b) => {
      const semA = parseSemesterValue(a.semester);
      const semB = parseSemesterValue(b.semester);

      if (semA !== semB) return semA - semB;

      const nameA = (a.name || '').toString().toLowerCase().trim();
      const nameB = (b.name || '').toString().toLowerCase().trim();
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [selectedBasket]);

  // DISABLED: Auto-refresh functionality to prevent excessive MongoDB connections
  // useEffect(() => {
  //   if (autoRefresh && searchPerformed && !loading) {
  //     const interval = setInterval(() => {
  //       onSubmit({ preventDefault: () => { } });
  //       addNotification('info', 'Data refreshed automatically');
  //     }, 30000); // Refresh every 30 seconds
  //
  //     return () => clearInterval(interval);
  //   }
  // }, [autoRefresh, searchPerformed, loading]);

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

      const url = appendSchoolParams("/api/cbcs/track");
      const response = await fetch(url, {
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

      const url = appendSchoolParams("/api/cbcs/track");
      const response = await fetch(url, {
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

  const downloadFile = useCallback((content, filename, type) => {
    // Add UTF-8 BOM for Excel files to ensure proper opening
    let blobContent = content;
    if (type && type.includes("application/vnd.ms-excel") && typeof content === "string") {
      const BOM = "\uFEFF";
      blobContent = BOM + content;
    }
    const blob = new Blob([blobContent], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // Enhanced export functions
  const exportToCSV = useCallback(() => {
    const isBulkContext = registration === "all";

    if (!isBulkContext && studentData) {
      // For individual student: Export in CBCS.xlsx template format matching Excel export
      // Group subjects by semester and organize by basket columns

      // Collect all subjects with their basket and semester info
      const allSubjects = [];
      Object.entries(basketProgress).forEach(([basketName, basketInfo]) => {
        const subjects = basketInfo?.subjects || [];
        subjects.forEach(subject => {
          allSubjects.push({
            ...subject,
            basket: basketName,
            basketNumber: basketName === "Basket I" ? 1 :
              basketName === "Basket II" ? 2 :
                basketName === "Basket III" ? 3 :
                  basketName === "Basket IV" ? 4 :
                    basketName === "Basket V" ? 5 : 0
          });
        });
      });

      // Group by semester
      const subjectsBySemester = {};
      allSubjects.forEach(subject => {
        const sem = subject.semester || "Unknown";
        if (!subjectsBySemester[sem]) {
          subjectsBySemester[sem] = [];
        }
        subjectsBySemester[sem].push(subject);
      });

      // Sort semesters
      const sortedSemesters = Object.keys(subjectsBySemester).sort((a, b) => {
        const semNumA = parseInt(a.replace(/[^0-9]/g, '')) || 0;
        const semNumB = parseInt(b.replace(/[^0-9]/g, '')) || 0;
        return semNumA - semNumB;
      });

      // Build CSV matching CBCS.xlsx template format EXACTLY
      const csvData = [];

      // Header Section (4 rows - matching Excel)
      csvData.push(["CENTURION UNIVERSITY OF TECHNOLOGY & MANAGEMENT", "", "", "", "", "", "", "", ""]);
      csvData.push(["SCHOOL OF ENGINEERING & TECHNOLOGY", "", "", "", "", "", "", "", ""]);
      csvData.push(["SUBJECT REGISTRATION AS PER CBCS CURRICULUM", "", "", "", "", "", "", "", ""]);
      csvData.push(["REGISTRATION", "", "", "", "", "", "", "", ""]);

      // Student Info Section (1 row - matching Excel)
      csvData.push(["NAME:", studentData.name || '', "", "REGISTRATION NO:", studentData.registration || '', "", "BRANCH:", studentData.department || studentData.actual_department || '', ""]);

      // Semester-wise Subject Tables (matching Excel structure exactly)
      sortedSemesters.forEach(semester => {
        const subjects = subjectsBySemester[semester];
        const semesterDisplay = semester.replace(/Sem\s*/i, 'Semester-');

        // Calculate totals for this semester
        let semesterTotals = { basket1: 0, basket2: 0, basket3: 0, basket4: 0, basket5: 0, grandTotal: 0 };

        // Semester Header (1 row - matching Excel colspan=9)
        csvData.push([semesterDisplay, "", "", "", "", "", "", "", ""]);

        // Column Headers (1 row - matching Excel)
        csvData.push(["Sl.N", "Subject Code", "Subject", "Basket 1 (Credit)", "Basket 2 (Credit)", "Basket 3 (Credit)", "Basket 4 (Credit)", "Basket 5 (Credit)", "Grand Total (Credit)"]);

        // Subject Rows (matching Excel structure)
        subjects.forEach((subject, idx) => {
          const credits = Number(subject.credits) || 0;
          const basket1 = subject.basketNumber === 1 ? credits : 0;
          const basket2 = subject.basketNumber === 2 ? credits : 0;
          const basket3 = subject.basketNumber === 3 ? credits : 0;
          const basket4 = subject.basketNumber === 4 ? credits : 0;
          const basket5 = subject.basketNumber === 5 ? credits : 0;

          semesterTotals.basket1 += basket1;
          semesterTotals.basket2 += basket2;
          semesterTotals.basket3 += basket3;
          semesterTotals.basket4 += basket4;
          semesterTotals.basket5 += basket5;
          semesterTotals.grandTotal += credits;

          csvData.push([
            idx + 1,
            subject.code || '',
            subject.name || '',
            basket1 || '',
            basket2 || '',
            basket3 || '',
            basket4 || '',
            basket5 || '',
            credits
          ]);
        });

        // Semester Total Row (1 row - matching Excel)
        csvData.push(["Total", "", "", semesterTotals.basket1, semesterTotals.basket2, semesterTotals.basket3, semesterTotals.basket4, semesterTotals.basket5, semesterTotals.grandTotal]);

        // Empty row (1 row - matching Excel empty row with colspan=9)
        csvData.push(["", "", "", "", "", "", "", "", ""]);
      });

      // Overall Totals (1 row - matching Excel)
      csvData.push(["Total", "", "",
        allSubjects.filter(s => s.basketNumber === 1).reduce((sum, s) => sum + (Number(s.credits) || 0), 0),
        allSubjects.filter(s => s.basketNumber === 2).reduce((sum, s) => sum + (Number(s.credits) || 0), 0),
        allSubjects.filter(s => s.basketNumber === 3).reduce((sum, s) => sum + (Number(s.credits) || 0), 0),
        allSubjects.filter(s => s.basketNumber === 4).reduce((sum, s) => sum + (Number(s.credits) || 0), 0),
        allSubjects.filter(s => s.basketNumber === 5).reduce((sum, s) => sum + (Number(s.credits) || 0), 0),
        allSubjects.reduce((sum, s) => sum + (Number(s.credits) || 0), 0)
      ]);

      const csv = csvData.map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
      downloadFile(csv, `student_${studentData.registration}_basket_progress.csv`, "text/csv");
      addNotification('success', 'CSV exported in CBCS template format');
    } else if (isBulkContext && filteredAndSortedStudents.length > 0) {
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
    } else {
      addNotification('error', 'No data available for export');
    }
  }, [registration, studentData, filteredAndSortedStudents, department, addNotification, downloadFile]);

  const exportToExcel = useCallback(() => {
    const isBulkContext = registration === "all";

    if (!isBulkContext && studentData) {
      // For individual student: Export in CBCS.xlsx template format matching the screenshot
      // Group subjects by semester and organize by basket columns

      // Collect all subjects with their basket and semester info
      const allSubjects = [];
      Object.entries(basketProgress).forEach(([basketName, basketInfo]) => {
        const subjects = basketInfo?.subjects || [];
        subjects.forEach(subject => {
          allSubjects.push({
            ...subject,
            basket: basketName,
            basketNumber: basketName === "Basket I" ? 1 :
              basketName === "Basket II" ? 2 :
                basketName === "Basket III" ? 3 :
                  basketName === "Basket IV" ? 4 :
                    basketName === "Basket V" ? 5 : 0
          });
        });
      });

      // Group by semester
      const subjectsBySemester = {};
      allSubjects.forEach(subject => {
        const sem = subject.semester || "Unknown";
        if (!subjectsBySemester[sem]) {
          subjectsBySemester[sem] = [];
        }
        subjectsBySemester[sem].push(subject);
      });

      // Sort semesters
      const sortedSemesters = Object.keys(subjectsBySemester).sort((a, b) => {
        const semNumA = parseInt(a.replace(/[^0-9]/g, '')) || 0;
        const semNumB = parseInt(b.replace(/[^0-9]/g, '')) || 0;
        return semNumA - semNumB;
      });

      // Build HTML table matching CBCS.xlsx template
      let htmlContent = `
        <html>
          <head><meta charset="UTF-8"></head>
          <body style="font-family: Arial, sans-serif;">
            <table border="1" cellpadding="5" cellspacing="0" style="width: 100%; border-collapse: collapse;">
              <!-- Header Section -->
              <tr>
                <td colspan="9" style="text-align: center; font-weight: bold; font-size: 14px; background-color: #E6F3FF;">
                  CENTURION UNIVERSITY OF TECHNOLOGY & MANAGEMENT
                </td>
              </tr>
              <tr>
                <td colspan="9" style="text-align: center; font-weight: bold; font-size: 12px; background-color: #E6F3FF;">
                  SCHOOL OF ENGINEERING & TECHNOLOGY
                </td>
              </tr>
              <tr>
                <td colspan="9" style="text-align: center; font-weight: bold; font-size: 12px; background-color: #E6F3FF;">
                  SUBJECT REGISTRATION AS PER CBCS CURRICULUM
                </td>
              </tr>
              <tr>
                <td colspan="9" style="text-align: center; font-weight: bold; font-size: 12px; background-color: #E6F3FF;">
                  REGISTRATION
                </td>
              </tr>
              
              <!-- Student Info Section -->
              <tr>
                <td style="font-weight: bold; background-color: #F0F0F0;">NAME:</td>
                <td colspan="2">${studentData.name || ''}</td>
                <td style="font-weight: bold; background-color: #F0F0F0;">REGISTRATION NO:</td>
                <td colspan="2">${studentData.registration || ''}</td>
                <td style="font-weight: bold; background-color: #F0F0F0;">BRANCH:</td>
                <td colspan="2">${studentData.department || studentData.actual_department || ''}</td>
              </tr>
              
              <!-- Semester-wise Subject Tables -->
              ${sortedSemesters.map(semester => {
        const subjects = subjectsBySemester[semester];
        const semesterDisplay = semester.replace(/Sem\s*/i, 'Semester-');

        // Calculate totals for this semester
        let semesterTotals = { basket1: 0, basket2: 0, basket3: 0, basket4: 0, basket5: 0, grandTotal: 0 };

        // Build subject rows and calculate totals
        const subjectRows = subjects.map((subject, idx) => {
          const credits = Number(subject.credits) || 0;
          const basket1 = subject.basketNumber === 1 ? credits : 0;
          const basket2 = subject.basketNumber === 2 ? credits : 0;
          const basket3 = subject.basketNumber === 3 ? credits : 0;
          const basket4 = subject.basketNumber === 4 ? credits : 0;
          const basket5 = subject.basketNumber === 5 ? credits : 0;

          semesterTotals.basket1 += basket1;
          semesterTotals.basket2 += basket2;
          semesterTotals.basket3 += basket3;
          semesterTotals.basket4 += basket4;
          semesterTotals.basket5 += basket5;
          semesterTotals.grandTotal += credits;

          return `
                    <tr>
                      <td style="text-align: center;">${idx + 1}</td>
                      <td>${subject.code || ''}</td>
                      <td>${subject.name || ''}</td>
                      <td style="text-align: center;">${basket1 || ''}</td>
                      <td style="text-align: center;">${basket2 || ''}</td>
                      <td style="text-align: center;">${basket3 || ''}</td>
                      <td style="text-align: center;">${basket4 || ''}</td>
                      <td style="text-align: center;">${basket5 || ''}</td>
                      <td style="text-align: center;">${credits}</td>
                    </tr>
                  `;
        }).join('');

        return `
                  <!-- ${semesterDisplay} Header -->
                  <tr>
                    <td colspan="9" style="font-weight: bold; background-color: #D9E1F2; text-align: center;">
                      ${semesterDisplay}
                    </td>
                  </tr>
                  
                  <!-- Column Headers -->
                  <tr style="background-color: #D9E1F2; font-weight: bold; text-align: center;">
                    <td>Sl.N</td>
                    <td>Subject Code</td>
                    <td>Subject</td>
                    <td>Basket 1 (Credit)</td>
                    <td>Basket 2 (Credit)</td>
                    <td>Basket 3 (Credit)</td>
                    <td>Basket 4 (Credit)</td>
                    <td>Basket 5 (Credit)</td>
                    <td>Grand Total (Credit)</td>
                  </tr>
                  
                  <!-- Subject Rows -->
                  ${subjectRows}
                  
                  <!-- Semester Total Row -->
                  <tr style="font-weight: bold; background-color: #F2F2F2;">
                    <td colspan="3" style="text-align: right;">Total</td>
                    <td style="text-align: center;">${semesterTotals.basket1}</td>
                    <td style="text-align: center;">${semesterTotals.basket2}</td>
                    <td style="text-align: center;">${semesterTotals.basket3}</td>
                    <td style="text-align: center;">${semesterTotals.basket4}</td>
                    <td style="text-align: center;">${semesterTotals.basket5}</td>
                    <td style="text-align: center;">${semesterTotals.grandTotal}</td>
                  </tr>
                  
                  <tr><td colspan="9" style="height: 10px;"></td></tr>
                `;
      }).join('')}
              
              <!-- Overall Totals -->
              <tr style="font-weight: bold; background-color: #D9E1F2;">
                <td colspan="3" style="text-align: right;">Total</td>
                <td style="text-align: center;">${allSubjects.filter(s => s.basketNumber === 1).reduce((sum, s) => sum + (Number(s.credits) || 0), 0)}</td>
                <td style="text-align: center;">${allSubjects.filter(s => s.basketNumber === 2).reduce((sum, s) => sum + (Number(s.credits) || 0), 0)}</td>
                <td style="text-align: center;">${allSubjects.filter(s => s.basketNumber === 3).reduce((sum, s) => sum + (Number(s.credits) || 0), 0)}</td>
                <td style="text-align: center;">${allSubjects.filter(s => s.basketNumber === 4).reduce((sum, s) => sum + (Number(s.credits) || 0), 0)}</td>
                <td style="text-align: center;">${allSubjects.filter(s => s.basketNumber === 5).reduce((sum, s) => sum + (Number(s.credits) || 0), 0)}</td>
                <td style="text-align: center;">${allSubjects.reduce((sum, s) => sum + (Number(s.credits) || 0), 0)}</td>
              </tr>
            </table>
          </body>
        </html>
      `;

      downloadFile(htmlContent, `student_${studentData.registration}_basket_progress.xls`, "application/vnd.ms-excel");
      addNotification('success', 'Excel file exported in CBCS template format');
    } else if (isBulkContext && filteredAndSortedStudents.length > 0) {
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
    } else {
      addNotification('error', 'No data available for export');
    }
  }, [registration, studentData, filteredAndSortedStudents, department, addNotification, downloadFile]);

  const downloadReport = useCallback(() => {
    if (registration !== "all" && studentData) {
      // For individual student: Export in CBCS.xlsx template format matching the exact format provided
      // Group subjects by semester and organize by basket columns

      // Collect all subjects with their basket and semester info
      const allSubjects = [];
      Object.entries(basketProgress).forEach(([basketName, basketInfo]) => {
        const subjects = basketInfo?.subjects || [];
        subjects.forEach(subject => {
          allSubjects.push({
            ...subject,
            basket: basketName,
            basketNumber: basketName === "Basket I" ? 1 :
              basketName === "Basket II" ? 2 :
                basketName === "Basket III" ? 3 :
                  basketName === "Basket IV" ? 4 :
                    basketName === "Basket V" ? 5 : 0
          });
        });
      });

      // Group by semester - Normalize semester keys to match expected format
      const subjectsBySemester = {};
      allSubjects.forEach(subject => {
        let sem = subject.semester || "Unknown";
        // Normalize semester format: "Semester 1" -> "Sem 1", "Sem1" -> "Sem 1", etc.
        sem = sem.replace(/semester\s*/i, "Sem ").replace(/sem\s*/i, "Sem ").trim();
        if (!sem.match(/^Sem\s*\d+$/i)) {
          // Try to extract number if format is different
          const numMatch = sem.match(/\d+/);
          if (numMatch) {
            sem = `Sem ${numMatch[0]}`;
          }
        }
        if (!subjectsBySemester[sem]) {
          subjectsBySemester[sem] = [];
        }
        subjectsBySemester[sem].push(subject);
      });

      // Get all 8 semesters (even if empty) - always show all
      // Use normalized keys: "Sem 1", "Sem 2", etc.
      const allSemesterKeys = ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6", "Sem 7", "Sem 8"];
      const sortedSemesters = allSemesterKeys;

      // Get session year from registration (first 2 digits)
      const regYear = studentData.registration ? studentData.registration.substring(0, 2) : new Date().getFullYear().toString().substring(2);
      const sessionYear = `20${regYear}-${parseInt(regYear) + 4}`;
      const branchCode = studentData.department || studentData.actual_department || '';
      const btechMap = {
        "Civil Engineering": "Civil",
        "Computer Science Engineering": "CSE",
        "Electronics & Communication Engineering": "ECE",
        "Electrical & Electronics Engineering": "EEE",
        "Mechanical Engineering": "Mechanical",
        "AIML": "AIML",
      };
      const diplomaMap = {
        "Civil Engineering": "Civil",
        "Computer Science Engineering": "CSE",
        "Electrical Engineering": "EE",
        "Mechanical Engineering": "Mechanical",
        "Mining Engineering": "Mining",
        "Automobile Engineering": "Automobile",
      };
      const branchMap = isDiploma ? diplomaMap : btechMap;
      const branchShort = Object.keys(branchMap).find(key => branchCode.includes(key))
        ? branchMap[Object.keys(branchMap).find(key => branchCode.includes(key))]
        : branchCode;

      // Helper function to calculate semester totals (same logic as in buildSemesterTable)
      const calculateSemesterTotals = (semester) => {
        const subjects = subjectsBySemester[semester] || [];
        let totals = { basket1: 0, basket2: 0, basket3: 0, basket4: 0, basket5: 0, grandTotal: 0 };
        subjects.forEach(subject => {
          const credits = Number(subject.credits) || 0;
          const basketNum = subject.basketNumber || 0;
          if (basketNum === 1) totals.basket1 += credits;
          if (basketNum === 2) totals.basket2 += credits;
          if (basketNum === 3) totals.basket3 += credits;
          if (basketNum === 4) totals.basket4 += credits;
          if (basketNum === 5) totals.basket5 += credits;
          totals.grandTotal += credits;
        });
        return totals;
      };

      // Calculate semester totals for all semesters
      const semesterTotalsMap = {};
      allSemesterKeys.forEach(semKey => {
        semesterTotalsMap[semKey] = calculateSemesterTotals(semKey);
      });

      // Calculate year totals by adding semester totals (matching screenshot format exactly)
      // Layout: Top row = Sem 1 (left) + Sem 2 (right), Bottom row = Sem 3 (left) + Sem 4 (right)
      // 1st Year = Sem 1 totals + Sem 2 totals (as shown in screenshot)
      const firstYearTotals = {
        basket1: (semesterTotalsMap["Sem 1"]?.basket1 || 0) + (semesterTotalsMap["Sem 2"]?.basket1 || 0),
        basket2: (semesterTotalsMap["Sem 1"]?.basket2 || 0) + (semesterTotalsMap["Sem 2"]?.basket2 || 0),
        basket3: (semesterTotalsMap["Sem 1"]?.basket3 || 0) + (semesterTotalsMap["Sem 2"]?.basket3 || 0),
        basket4: (semesterTotalsMap["Sem 1"]?.basket4 || 0) + (semesterTotalsMap["Sem 2"]?.basket4 || 0),
        basket5: (semesterTotalsMap["Sem 1"]?.basket5 || 0) + (semesterTotalsMap["Sem 2"]?.basket5 || 0),
        grandTotal: (semesterTotalsMap["Sem 1"]?.grandTotal || 0) + (semesterTotalsMap["Sem 2"]?.grandTotal || 0)
      };

      // 1st & 2nd Year = 1st Year + Sem 3 + Sem 4 (as shown in screenshot)
      const secondYearTotals = {
        basket1: firstYearTotals.basket1 + (semesterTotalsMap["Sem 3"]?.basket1 || 0) + (semesterTotalsMap["Sem 4"]?.basket1 || 0),
        basket2: firstYearTotals.basket2 + (semesterTotalsMap["Sem 3"]?.basket2 || 0) + (semesterTotalsMap["Sem 4"]?.basket2 || 0),
        basket3: firstYearTotals.basket3 + (semesterTotalsMap["Sem 3"]?.basket3 || 0) + (semesterTotalsMap["Sem 4"]?.basket3 || 0),
        basket4: firstYearTotals.basket4 + (semesterTotalsMap["Sem 3"]?.basket4 || 0) + (semesterTotalsMap["Sem 4"]?.basket4 || 0),
        basket5: firstYearTotals.basket5 + (semesterTotalsMap["Sem 3"]?.basket5 || 0) + (semesterTotalsMap["Sem 4"]?.basket5 || 0),
        grandTotal: firstYearTotals.grandTotal + (semesterTotalsMap["Sem 3"]?.grandTotal || 0) + (semesterTotalsMap["Sem 4"]?.grandTotal || 0)
      };

      // 1st, 2nd & 3rd Year = 1st & 2nd Year + Sem 5 + Sem 6
      const thirdYearTotals = {
        basket1: secondYearTotals.basket1 + (semesterTotalsMap["Sem 5"]?.basket1 || 0) + (semesterTotalsMap["Sem 6"]?.basket1 || 0),
        basket2: secondYearTotals.basket2 + (semesterTotalsMap["Sem 5"]?.basket2 || 0) + (semesterTotalsMap["Sem 6"]?.basket2 || 0),
        basket3: secondYearTotals.basket3 + (semesterTotalsMap["Sem 5"]?.basket3 || 0) + (semesterTotalsMap["Sem 6"]?.basket3 || 0),
        basket4: secondYearTotals.basket4 + (semesterTotalsMap["Sem 5"]?.basket4 || 0) + (semesterTotalsMap["Sem 6"]?.basket4 || 0),
        basket5: secondYearTotals.basket5 + (semesterTotalsMap["Sem 5"]?.basket5 || 0) + (semesterTotalsMap["Sem 6"]?.basket5 || 0),
        grandTotal: secondYearTotals.grandTotal + (semesterTotalsMap["Sem 5"]?.grandTotal || 0) + (semesterTotalsMap["Sem 6"]?.grandTotal || 0)
      };

      // 1st, 2nd, 3rd & 4th Year = 1st, 2nd & 3rd Year + Sem 7 + Sem 8
      const fourthYearTotals = {
        basket1: thirdYearTotals.basket1 + (semesterTotalsMap["Sem 7"]?.basket1 || 0) + (semesterTotalsMap["Sem 8"]?.basket1 || 0),
        basket2: thirdYearTotals.basket2 + (semesterTotalsMap["Sem 7"]?.basket2 || 0) + (semesterTotalsMap["Sem 8"]?.basket2 || 0),
        basket3: thirdYearTotals.basket3 + (semesterTotalsMap["Sem 7"]?.basket3 || 0) + (semesterTotalsMap["Sem 8"]?.basket3 || 0),
        basket4: thirdYearTotals.basket4 + (semesterTotalsMap["Sem 7"]?.basket4 || 0) + (semesterTotalsMap["Sem 8"]?.basket4 || 0),
        basket5: thirdYearTotals.basket5 + (semesterTotalsMap["Sem 7"]?.basket5 || 0) + (semesterTotalsMap["Sem 8"]?.basket5 || 0),
        grandTotal: thirdYearTotals.grandTotal + (semesterTotalsMap["Sem 7"]?.grandTotal || 0) + (semesterTotalsMap["Sem 8"]?.grandTotal || 0)
      };

      // Build HTML table matching CBCS.xlsx template EXACTLY
      let htmlContent = `
        <html>
          <head><meta charset="UTF-8"></head>
          <body style="font-family: Arial, sans-serif; margin: 0; padding: 10px;">
            <table border="1" cellpadding="5" cellspacing="0" style="width: 100%; border-collapse: collapse;">
              <!-- Header Section - Matching exact format -->
              <tr>
                <td colspan="9" style="text-align: center; font-weight: bold; font-size: 14px; background-color: #E6F3FF; padding: 8px;">
                  CENTURION UNIVERSITY OF TECHNOLOGY & MANAGEMENT
                </td>
              </tr>
              <tr>
                <td colspan="9" style="text-align: center; font-weight: bold; font-size: 12px; background-color: #E6F3FF; padding: 8px;">
                  SCHOOL OF ENGINEERING & TECHNOLOGY
                </td>
              </tr>
              <tr>
                <td colspan="9" style="text-align: center; font-weight: bold; font-size: 12px; background-color: #E6F3FF; padding: 8px;">
                  PARALAKHEMUNDI CAMPUS
                </td>
              </tr>
              <tr>
                <td colspan="9" style="text-align: center; font-weight: bold; font-size: 12px; background-color: #E6F3FF; padding: 8px;">
                  SUBJECT REGISTRATION AS PER CBCS CURRICULUM
                </td>
              </tr>
              
              <!-- Student Info Section - Left: Name, Right: Registration details -->
              <tr>
                <td colspan="4" style="font-weight: bold; background-color: #F0F0F0; padding: 8px;">NAME OF STUDENT:</td>
                <td colspan="5" style="padding: 8px;">${studentData.name || ''}</td>
              </tr>
              <tr>
                <td colspan="3" style="font-weight: bold; background-color: #F0F0F0; padding: 8px;">REGISTRATION NO:</td>
                <td colspan="3" style="padding: 8px;">${studentData.registration || ''}</td>
                <td colspan="1" style="font-weight: bold; background-color: #F0F0F0; padding: 8px;">SESSION:</td>
                <td colspan="2" style="padding: 8px;">${sessionYear}</td>
              </tr>
              <tr>
                <td colspan="3" style="font-weight: bold; background-color: #F0F0F0; padding: 8px;">BRANCH:</td>
                <td colspan="6" style="padding: 8px;">${branchShort}</td>
              </tr>
              
              <!-- Semester-wise Subject Tables - Arranged in pairs side by side -->
              ${(() => {
          // Helper function to build a semester table
          const buildSemesterTable = (semester, semNum) => {
            const subjects = subjectsBySemester[semester] || [];
            const semesterDisplay = semester.replace(/Sem\s*/i, 'Semester-');
            const hasSlNo = semNum % 2 === 0; // Even semesters have Sl. No

            // Calculate totals for this semester
            let semesterTotals = { basket1: 0, basket2: 0, basket3: 0, basket4: 0, basket5: 0, grandTotal: 0 };

            // Build subject rows
            const subjectRows = subjects.map((subject, idx) => {
              const credits = Number(subject.credits) || 0;
              const basket1 = subject.basketNumber === 1 ? credits : 0;
              const basket2 = subject.basketNumber === 2 ? credits : 0;
              const basket3 = subject.basketNumber === 3 ? credits : 0;
              const basket4 = subject.basketNumber === 4 ? credits : 0;
              const basket5 = subject.basketNumber === 5 ? credits : 0;

              semesterTotals.basket1 += basket1;
              semesterTotals.basket2 += basket2;
              semesterTotals.basket3 += basket3;
              semesterTotals.basket4 += basket4;
              semesterTotals.basket5 += basket5;
              semesterTotals.grandTotal += credits;

              const slNoCell = hasSlNo ? `<td style="text-align: center; padding: 5px;">${idx + 1}</td>` : '';

              return `
                      <tr>
                        ${slNoCell}
                        <td style="padding: 5px;">${subject.code || ''}</td>
                        <td style="padding: 5px;">${subject.name || ''}</td>
                        <td style="text-align: center; padding: 5px;">${basket1 || ''}</td>
                        <td style="text-align: center; padding: 5px;">${basket2 || ''}</td>
                        <td style="text-align: center; padding: 5px;">${basket3 || ''}</td>
                        <td style="text-align: center; padding: 5px;">${basket4 || ''}</td>
                        <td style="text-align: center; padding: 5px;">${basket5 || ''}</td>
                        <td style="text-align: center; padding: 5px;">${credits}</td>
                      </tr>
                    `;
            }).join('');

            const headerColspan = hasSlNo ? 9 : 8;
            const slNoHeader = hasSlNo ? '<td style="padding: 5px;">Sl. No</td>' : '';
            const totalColspan = hasSlNo ? 3 : 2;

            return {
              html: `
                      <!-- ${semesterDisplay} Header -->
                      <tr>
                        <td colspan="${headerColspan}" style="font-weight: bold; background-color: #D9E1F2; text-align: center; padding: 8px;">
                          ${semesterDisplay}
                        </td>
                      </tr>
                      
                      <!-- Column Headers -->
                      <tr style="background-color: #D9E1F2; font-weight: bold; text-align: center;">
                        ${slNoHeader}
                        <td style="padding: 5px;">Subject Code</td>
                        <td style="padding: 5px;">Subject</td>
                        <td style="padding: 5px;">Basket 1 (Credit)</td>
                        <td style="padding: 5px;">Basket 2 (Credit)</td>
                        <td style="padding: 5px;">Basket 3 (Credit)</td>
                        <td style="padding: 5px;">Basket 4 (Credit)</td>
                        <td style="padding: 5px;">Basket 5 (Credit)</td>
                        <td style="padding: 5px;">Grand Total (Credit)</td>
                      </tr>
                      
                      <!-- Subject Rows -->
                      ${subjectRows || '<tr><td colspan="' + headerColspan + '" style="padding: 5px; text-align: center;">No subjects</td></tr>'}
                      
                      <!-- Semester Total Row -->
                      <tr style="font-weight: bold; background-color: #E6F3FF;">
                        <td colspan="${totalColspan}" style="text-align: right; padding: 5px;">Total</td>
                        <td style="text-align: center; padding: 5px;">${semesterTotals.basket1}</td>
                        <td style="text-align: center; padding: 5px;">${semesterTotals.basket2}</td>
                        <td style="text-align: center; padding: 5px;">${semesterTotals.basket3}</td>
                        <td style="text-align: center; padding: 5px;">${semesterTotals.basket4}</td>
                        <td style="text-align: center; padding: 5px;">${semesterTotals.basket5}</td>
                        <td style="text-align: center; padding: 5px;">${semesterTotals.grandTotal}</td>
                      </tr>
                    `,
              totals: semesterTotals,
              semNum,
              headerColspan
            };
          };

          // Build semester pairs matching screenshot layout exactly:
          // Top row: Sem 1 (left) + Sem 2 (right)
          // Bottom row: Sem 3 (left) + Sem 4 (right)
          let result = '';

          // First row: Sem 1 + Sem 2 (side-by-side)
          const sem1Key = allSemesterKeys[0]; // Sem 1
          const sem2Key = allSemesterKeys[1]; // Sem 2
          const sem1Table = buildSemesterTable(sem1Key, 1);
          const sem2Table = buildSemesterTable(sem2Key, 2);

          const sem1Colspan = 4; // Sem 1 is odd (no Sl. No) = 8 cols, so 4 in outer table
          const sem2Colspan = 5; // Sem 2 is even (has Sl. No) = 9 cols, so 5 in outer table

          // Add "1st Year Total Credits" row inside Sem 2 table (in Subject column)
          const sem2TableWithYearTotal = sem2Table.html + `
                      <!-- 1st Year Total Credits Row (inside Sem 2 table, Subject column) -->
                      <tr style="font-weight: bold; background-color: #E6F3FF;">
                        <td style="text-align: center; padding: 5px;"></td>
                        <td style="text-align: center; padding: 5px;"></td>
                        <td style="text-align: left; padding: 5px; font-weight: bold;">1st Year Total Credits</td>
                        <td style="text-align: center; padding: 5px;">${firstYearTotals.basket1 || 0}</td>
                        <td style="text-align: center; padding: 5px;">${firstYearTotals.basket2 || 0}</td>
                        <td style="text-align: center; padding: 5px;">${firstYearTotals.basket3 || 0}</td>
                        <td style="text-align: center; padding: 5px;">${firstYearTotals.basket4 || 0}</td>
                        <td style="text-align: center; padding: 5px;">${firstYearTotals.basket5 || 0}</td>
                        <td style="text-align: center; padding: 5px;">${firstYearTotals.grandTotal || 0}</td>
                      </tr>
                    `;

          result += `
                  <tr>
                    <td colspan="${sem1Colspan}" style="width: 50%; vertical-align: top; padding: 0; border: 1px solid #000;">
                      <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                        ${sem1Table.html}
                      </table>
                    </td>
                    <td colspan="${sem2Colspan}" style="width: 50%; vertical-align: top; padding: 0; border: 1px solid #000;">
                      <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                        ${sem2TableWithYearTotal}
                      </table>
                    </td>
                  </tr>
                `;

          // Add spacing between rows
          result += `<tr><td colspan="9" style="height: 10px; border: 1px solid #000;"></td></tr>`;

          // Second row: Sem 3 + Sem 4 (side-by-side)
          const sem3Key = allSemesterKeys[2]; // Sem 3
          const sem4Key = allSemesterKeys[3]; // Sem 4
          const sem3Table = buildSemesterTable(sem3Key, 3);
          const sem4Table = buildSemesterTable(sem4Key, 4);

          const sem3Colspan = 4; // Sem 3 is odd (no Sl. No) = 8 cols, so 4 in outer table
          const sem4Colspan = 5; // Sem 4 is even (has Sl. No) = 9 cols, so 5 in outer table

          // Add "1st & 2nd Year Total Credits" row inside Sem 4 table (in Subject column)
          const sem4TableWithYearTotal = sem4Table.html + `
                      <!-- 1st & 2nd Year Total Credits Row (inside Sem 4 table, Subject column) -->
                      <tr style="font-weight: bold; background-color: #E6F3FF;">
                        <td style="text-align: center; padding: 5px;"></td>
                        <td style="text-align: center; padding: 5px;"></td>
                        <td style="text-align: left; padding: 5px; font-weight: bold;">1st & 2nd Year Total Credits</td>
                        <td style="text-align: center; padding: 5px;">${secondYearTotals.basket1 || 0}</td>
                        <td style="text-align: center; padding: 5px;">${secondYearTotals.basket2 || 0}</td>
                        <td style="text-align: center; padding: 5px;">${secondYearTotals.basket3 || 0}</td>
                        <td style="text-align: center; padding: 5px;">${secondYearTotals.basket4 || 0}</td>
                        <td style="text-align: center; padding: 5px;">${secondYearTotals.basket5 || 0}</td>
                        <td style="text-align: center; padding: 5px;">${secondYearTotals.grandTotal || 0}</td>
                      </tr>
                    `;

          result += `
                  <tr>
                    <td colspan="${sem3Colspan}" style="width: 50%; vertical-align: top; padding: 0; border: 1px solid #000;">
                      <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                        ${sem3Table.html}
                      </table>
                    </td>
                    <td colspan="${sem4Colspan}" style="width: 50%; vertical-align: top; padding: 0; border: 1px solid #000;">
                      <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                        ${sem4TableWithYearTotal}
                      </table>
                    </td>
                  </tr>
                `;

          // Add remaining semesters (5,6,7,8) if needed
          for (let i = 4; i < 8; i += 2) {
            const sem1Key = allSemesterKeys[i];
            const sem2Key = allSemesterKeys[i + 1];
            const sem1Num = i + 1;
            const sem2Num = i + 2;

            const sem1Table = buildSemesterTable(sem1Key, sem1Num);
            const sem2Table = buildSemesterTable(sem2Key, sem2Num);

            const sem1Colspan = 4;
            const sem2Colspan = 5;

            // Add year totals inside even semester tables (Sem 6, Sem 8)
            let sem2TableWithYearTotal = sem2Table.html;
            if (sem2Num === 6) {
              // Add "1st, 2nd & 3rd year Total Credits" inside Sem 6 table (in Subject column)
              sem2TableWithYearTotal = sem2Table.html + `
                          <!-- 1st, 2nd & 3rd year Total Credits Row (inside Sem 6 table, Subject column) -->
                          <tr style="font-weight: bold; background-color: #E6F3FF;">
                            <td style="text-align: center; padding: 5px;"></td>
                            <td style="text-align: center; padding: 5px;"></td>
                            <td style="text-align: left; padding: 5px; font-weight: bold;">1st, 2nd & 3rd year Total Credits</td>
                            <td style="text-align: center; padding: 5px;">${thirdYearTotals.basket1 || 0}</td>
                            <td style="text-align: center; padding: 5px;">${thirdYearTotals.basket2 || 0}</td>
                            <td style="text-align: center; padding: 5px;">${thirdYearTotals.basket3 || 0}</td>
                            <td style="text-align: center; padding: 5px;">${thirdYearTotals.basket4 || 0}</td>
                            <td style="text-align: center; padding: 5px;">${thirdYearTotals.basket5 || 0}</td>
                            <td style="text-align: center; padding: 5px;">${thirdYearTotals.grandTotal || 0}</td>
                          </tr>
                        `;
            } else if (sem2Num === 8) {
              // Add "1st, 2nd, 3rd & 4th year Total" inside Sem 8 table (in Subject column)
              sem2TableWithYearTotal = sem2Table.html + `
                          <!-- 1st, 2nd, 3rd & 4th year Total Row (inside Sem 8 table, Subject column) -->
                          <tr style="font-weight: bold; background-color: #E6F3FF;">
                            <td style="text-align: center; padding: 5px;"></td>
                            <td style="text-align: center; padding: 5px;"></td>
                            <td style="text-align: left; padding: 5px; font-weight: bold;">1st, 2nd, 3rd & 4th year Total</td>
                            <td style="text-align: center; padding: 5px;">${fourthYearTotals.basket1 || 0}</td>
                            <td style="text-align: center; padding: 5px;">${fourthYearTotals.basket2 || 0}</td>
                            <td style="text-align: center; padding: 5px;">${fourthYearTotals.basket3 || 0}</td>
                            <td style="text-align: center; padding: 5px;">${fourthYearTotals.basket4 || 0}</td>
                            <td style="text-align: center; padding: 5px;">${fourthYearTotals.basket5 || 0}</td>
                            <td style="text-align: center; padding: 5px;">${fourthYearTotals.grandTotal || 0}</td>
                          </tr>
                        `;
            }

            result += `<tr><td colspan="9" style="height: 10px; border: 1px solid #000;"></td></tr>`;

            result += `
                    <tr>
                      <td colspan="${sem1Colspan}" style="width: 50%; vertical-align: top; padding: 0; border: 1px solid #000;">
                        <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                          ${sem1Table.html}
                        </table>
                      </td>
                      <td colspan="${sem2Colspan}" style="width: 50%; vertical-align: top; padding: 0; border: 1px solid #000;">
                        <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                          ${sem2TableWithYearTotal}
                        </table>
                      </td>
                    </tr>
                  `;
          }

          return result;
        })()}
            </table>
          </body>
        </html>
      `;

      downloadFile(htmlContent, `CBCS_Registration_${studentData.registration}_${new Date().toISOString().split('T')[0]}.xls`, "application/vnd.ms-excel");
      addNotification('success', 'Report downloaded in CBCS template format');
    }
  }, [registration, studentData, basketProgress, addNotification, downloadFile]);

  // Helper function to generate HTML content for a student (same format as individual download)
  const generateStudentReportHtml = useCallback((studentData, basketProgress) => {
    // Collect all subjects with their basket and semester info
    const allSubjects = [];
    Object.entries(basketProgress).forEach(([basketName, basketInfo]) => {
      const subjects = basketInfo?.subjects || [];
      subjects.forEach(subject => {
        allSubjects.push({
          ...subject,
          basket: basketName,
          basketNumber: basketName === "Basket I" ? 1 :
            basketName === "Basket II" ? 2 :
              basketName === "Basket III" ? 3 :
                basketName === "Basket IV" ? 4 :
                  basketName === "Basket V" ? 5 : 0
        });
      });
    });

    // Group by semester - Normalize semester keys
    const subjectsBySemester = {};
    allSubjects.forEach(subject => {
      let sem = subject.semester || "Unknown";
      sem = sem.replace(/semester\s*/i, "Sem ").replace(/sem\s*/i, "Sem ").trim();
      if (!sem.match(/^Sem\s*\d+$/i)) {
        const numMatch = sem.match(/\d+/);
        if (numMatch) {
          sem = `Sem ${numMatch[0]}`;
        }
      }
      if (!subjectsBySemester[sem]) {
        subjectsBySemester[sem] = [];
      }
      subjectsBySemester[sem].push(subject);
    });

    const allSemesterKeys = ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6", "Sem 7", "Sem 8"];

    // Get session year and branch
    const regYear = studentData.registration ? studentData.registration.substring(0, 2) : new Date().getFullYear().toString().substring(2);
    const sessionYear = `20${regYear}-${parseInt(regYear) + 4}`;
    const branchCode = studentData.department || studentData.actual_department || '';
    const branchMap = {
      "Civil Engineering": "Civil",
      "Computer Science Engineering": "CSE",
      "Electronics & Communication Engineering": "ECE",
      "Electrical & Electronics Engineering": "EEE",
      "Mechanical Engineering": "Mechanical",
      "AIML": "AIML",
    };
    const branchShort = Object.keys(branchMap).find(key => branchCode.includes(key))
      ? branchMap[Object.keys(branchMap).find(key => branchCode.includes(key))]
      : branchCode;

    // Calculate semester totals
    const calculateSemesterTotals = (semester) => {
      const subjects = subjectsBySemester[semester] || [];
      let totals = { basket1: 0, basket2: 0, basket3: 0, basket4: 0, basket5: 0, grandTotal: 0 };
      subjects.forEach(subject => {
        const credits = Number(subject.credits) || 0;
        const basketNum = subject.basketNumber || 0;
        if (basketNum === 1) totals.basket1 += credits;
        if (basketNum === 2) totals.basket2 += credits;
        if (basketNum === 3) totals.basket3 += credits;
        if (basketNum === 4) totals.basket4 += credits;
        if (basketNum === 5) totals.basket5 += credits;
        totals.grandTotal += credits;
      });
      return totals;
    };

    const semesterTotalsMap = {};
    allSemesterKeys.forEach(semKey => {
      semesterTotalsMap[semKey] = calculateSemesterTotals(semKey);
    });

    // Calculate year totals
    const firstYearTotals = {
      basket1: (semesterTotalsMap["Sem 1"]?.basket1 || 0) + (semesterTotalsMap["Sem 2"]?.basket1 || 0),
      basket2: (semesterTotalsMap["Sem 1"]?.basket2 || 0) + (semesterTotalsMap["Sem 2"]?.basket2 || 0),
      basket3: (semesterTotalsMap["Sem 1"]?.basket3 || 0) + (semesterTotalsMap["Sem 2"]?.basket3 || 0),
      basket4: (semesterTotalsMap["Sem 1"]?.basket4 || 0) + (semesterTotalsMap["Sem 2"]?.basket4 || 0),
      basket5: (semesterTotalsMap["Sem 1"]?.basket5 || 0) + (semesterTotalsMap["Sem 2"]?.basket5 || 0),
      grandTotal: (semesterTotalsMap["Sem 1"]?.grandTotal || 0) + (semesterTotalsMap["Sem 2"]?.grandTotal || 0)
    };

    const secondYearTotals = {
      basket1: firstYearTotals.basket1 + (semesterTotalsMap["Sem 3"]?.basket1 || 0) + (semesterTotalsMap["Sem 4"]?.basket1 || 0),
      basket2: firstYearTotals.basket2 + (semesterTotalsMap["Sem 3"]?.basket2 || 0) + (semesterTotalsMap["Sem 4"]?.basket2 || 0),
      basket3: firstYearTotals.basket3 + (semesterTotalsMap["Sem 3"]?.basket3 || 0) + (semesterTotalsMap["Sem 4"]?.basket3 || 0),
      basket4: firstYearTotals.basket4 + (semesterTotalsMap["Sem 3"]?.basket4 || 0) + (semesterTotalsMap["Sem 4"]?.basket4 || 0),
      basket5: firstYearTotals.basket5 + (semesterTotalsMap["Sem 3"]?.basket5 || 0) + (semesterTotalsMap["Sem 4"]?.basket5 || 0),
      grandTotal: firstYearTotals.grandTotal + (semesterTotalsMap["Sem 3"]?.grandTotal || 0) + (semesterTotalsMap["Sem 4"]?.grandTotal || 0)
    };

    const thirdYearTotals = {
      basket1: secondYearTotals.basket1 + (semesterTotalsMap["Sem 5"]?.basket1 || 0) + (semesterTotalsMap["Sem 6"]?.basket1 || 0),
      basket2: secondYearTotals.basket2 + (semesterTotalsMap["Sem 5"]?.basket2 || 0) + (semesterTotalsMap["Sem 6"]?.basket2 || 0),
      basket3: secondYearTotals.basket3 + (semesterTotalsMap["Sem 5"]?.basket3 || 0) + (semesterTotalsMap["Sem 6"]?.basket3 || 0),
      basket4: secondYearTotals.basket4 + (semesterTotalsMap["Sem 5"]?.basket4 || 0) + (semesterTotalsMap["Sem 6"]?.basket4 || 0),
      basket5: secondYearTotals.basket5 + (semesterTotalsMap["Sem 5"]?.basket5 || 0) + (semesterTotalsMap["Sem 6"]?.basket5 || 0),
      grandTotal: secondYearTotals.grandTotal + (semesterTotalsMap["Sem 5"]?.grandTotal || 0) + (semesterTotalsMap["Sem 6"]?.grandTotal || 0)
    };

    const fourthYearTotals = {
      basket1: thirdYearTotals.basket1 + (semesterTotalsMap["Sem 7"]?.basket1 || 0) + (semesterTotalsMap["Sem 8"]?.basket1 || 0),
      basket2: thirdYearTotals.basket2 + (semesterTotalsMap["Sem 7"]?.basket2 || 0) + (semesterTotalsMap["Sem 8"]?.basket2 || 0),
      basket3: thirdYearTotals.basket3 + (semesterTotalsMap["Sem 7"]?.basket3 || 0) + (semesterTotalsMap["Sem 8"]?.basket3 || 0),
      basket4: thirdYearTotals.basket4 + (semesterTotalsMap["Sem 7"]?.basket4 || 0) + (semesterTotalsMap["Sem 8"]?.basket4 || 0),
      basket5: thirdYearTotals.basket5 + (semesterTotalsMap["Sem 7"]?.basket5 || 0) + (semesterTotalsMap["Sem 8"]?.basket5 || 0),
      grandTotal: thirdYearTotals.grandTotal + (semesterTotalsMap["Sem 7"]?.grandTotal || 0) + (semesterTotalsMap["Sem 8"]?.grandTotal || 0)
    };

    // Build HTML table (same as downloadReport)
    const buildSemesterTable = (semester, semNum) => {
      const subjects = subjectsBySemester[semester] || [];
      const semesterDisplay = semester.replace(/Sem\s*/i, 'Semester-');
      const hasSlNo = semNum % 2 === 0;

      let semesterTotals = { basket1: 0, basket2: 0, basket3: 0, basket4: 0, basket5: 0, grandTotal: 0 };

      const subjectRows = subjects.map((subject, idx) => {
        const credits = Number(subject.credits) || 0;
        const basket1 = subject.basketNumber === 1 ? credits : 0;
        const basket2 = subject.basketNumber === 2 ? credits : 0;
        const basket3 = subject.basketNumber === 3 ? credits : 0;
        const basket4 = subject.basketNumber === 4 ? credits : 0;
        const basket5 = subject.basketNumber === 5 ? credits : 0;

        semesterTotals.basket1 += basket1;
        semesterTotals.basket2 += basket2;
        semesterTotals.basket3 += basket3;
        semesterTotals.basket4 += basket4;
        semesterTotals.basket5 += basket5;
        semesterTotals.grandTotal += credits;

        const slNoCell = hasSlNo ? `<td style="text-align: center; padding: 5px;">${idx + 1}</td>` : '';

        return `
          <tr>
            ${slNoCell}
            <td style="padding: 5px;">${subject.code || ''}</td>
            <td style="padding: 5px;">${subject.name || ''}</td>
            <td style="text-align: center; padding: 5px;">${basket1 || ''}</td>
            <td style="text-align: center; padding: 5px;">${basket2 || ''}</td>
            <td style="text-align: center; padding: 5px;">${basket3 || ''}</td>
            <td style="text-align: center; padding: 5px;">${basket4 || ''}</td>
            <td style="text-align: center; padding: 5px;">${basket5 || ''}</td>
            <td style="text-align: center; padding: 5px;">${credits}</td>
          </tr>
        `;
      }).join('');

      const headerColspan = hasSlNo ? 9 : 8;
      const slNoHeader = hasSlNo ? '<td style="padding: 5px;">Sl. No</td>' : '';
      const totalColspan = hasSlNo ? 3 : 2;

      return {
        html: `
          <tr>
            <td colspan="${headerColspan}" style="font-weight: bold; background-color: #D9E1F2; text-align: center; padding: 8px;">
              ${semesterDisplay}
            </td>
          </tr>
          <tr style="background-color: #D9E1F2; font-weight: bold; text-align: center;">
            ${slNoHeader}
            <td style="padding: 5px;">Subject Code</td>
            <td style="padding: 5px;">Subject</td>
            <td style="padding: 5px;">Basket 1 (Credit)</td>
            <td style="padding: 5px;">Basket 2 (Credit)</td>
            <td style="padding: 5px;">Basket 3 (Credit)</td>
            <td style="padding: 5px;">Basket 4 (Credit)</td>
            <td style="padding: 5px;">Basket 5 (Credit)</td>
            <td style="padding: 5px;">Grand Total (Credit)</td>
          </tr>
          ${subjectRows || '<tr><td colspan="' + headerColspan + '" style="padding: 5px; text-align: center;">No subjects</td></tr>'}
          <tr style="font-weight: bold; background-color: #E6F3FF;">
            <td colspan="${totalColspan}" style="text-align: right; padding: 5px;">Total</td>
            <td style="text-align: center; padding: 5px;">${semesterTotals.basket1}</td>
            <td style="text-align: center; padding: 5px;">${semesterTotals.basket2}</td>
            <td style="text-align: center; padding: 5px;">${semesterTotals.basket3}</td>
            <td style="text-align: center; padding: 5px;">${semesterTotals.basket4}</td>
            <td style="text-align: center; padding: 5px;">${semesterTotals.basket5}</td>
            <td style="text-align: center; padding: 5px;">${semesterTotals.grandTotal}</td>
          </tr>
        `,
        totals: semesterTotals,
        semNum,
        headerColspan
      };
    };

    // Build semester pairs
    let result = '';
    const sem1Table = buildSemesterTable(allSemesterKeys[0], 1);
    const sem2Table = buildSemesterTable(allSemesterKeys[1], 2);
    const sem2TableWithYearTotal = sem2Table.html + `
      <tr style="font-weight: bold; background-color: #E6F3FF;">
        <td style="text-align: center; padding: 5px;"></td>
        <td style="text-align: center; padding: 5px;"></td>
        <td style="text-align: left; padding: 5px; font-weight: bold;">1st Year Total Credits</td>
        <td style="text-align: center; padding: 5px;">${firstYearTotals.basket1 || 0}</td>
        <td style="text-align: center; padding: 5px;">${firstYearTotals.basket2 || 0}</td>
        <td style="text-align: center; padding: 5px;">${firstYearTotals.basket3 || 0}</td>
        <td style="text-align: center; padding: 5px;">${firstYearTotals.basket4 || 0}</td>
        <td style="text-align: center; padding: 5px;">${firstYearTotals.basket5 || 0}</td>
        <td style="text-align: center; padding: 5px;">${firstYearTotals.grandTotal || 0}</td>
      </tr>
    `;

    result += `
      <tr>
        <td colspan="4" style="width: 50%; vertical-align: top; padding: 0; border: 1px solid #000;">
          <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
            ${sem1Table.html}
          </table>
        </td>
        <td colspan="5" style="width: 50%; vertical-align: top; padding: 0; border: 1px solid #000;">
          <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
            ${sem2TableWithYearTotal}
          </table>
        </td>
      </tr>
    `;

    result += `<tr><td colspan="9" style="height: 10px; border: 1px solid #000;"></td></tr>`;

    const sem3Table = buildSemesterTable(allSemesterKeys[2], 3);
    const sem4Table = buildSemesterTable(allSemesterKeys[3], 4);
    const sem4TableWithYearTotal = sem4Table.html + `
      <tr style="font-weight: bold; background-color: #E6F3FF;">
        <td style="text-align: center; padding: 5px;"></td>
        <td style="text-align: center; padding: 5px;"></td>
        <td style="text-align: left; padding: 5px; font-weight: bold;">1st & 2nd Year Total Credits</td>
        <td style="text-align: center; padding: 5px;">${secondYearTotals.basket1 || 0}</td>
        <td style="text-align: center; padding: 5px;">${secondYearTotals.basket2 || 0}</td>
        <td style="text-align: center; padding: 5px;">${secondYearTotals.basket3 || 0}</td>
        <td style="text-align: center; padding: 5px;">${secondYearTotals.basket4 || 0}</td>
        <td style="text-align: center; padding: 5px;">${secondYearTotals.basket5 || 0}</td>
        <td style="text-align: center; padding: 5px;">${secondYearTotals.grandTotal || 0}</td>
      </tr>
    `;

    result += `
      <tr>
        <td colspan="4" style="width: 50%; vertical-align: top; padding: 0; border: 1px solid #000;">
          <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
            ${sem3Table.html}
          </table>
        </td>
        <td colspan="5" style="width: 50%; vertical-align: top; padding: 0; border: 1px solid #000;">
          <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
            ${sem4TableWithYearTotal}
          </table>
        </td>
      </tr>
    `;

    for (let i = 4; i < 8; i += 2) {
      const sem1Key = allSemesterKeys[i];
      const sem2Key = allSemesterKeys[i + 1];
      const sem1Num = i + 1;
      const sem2Num = i + 2;

      const sem1Table = buildSemesterTable(sem1Key, sem1Num);
      const sem2Table = buildSemesterTable(sem2Key, sem2Num);

      let sem2TableWithYearTotal = sem2Table.html;
      if (sem2Num === 6) {
        sem2TableWithYearTotal = sem2Table.html + `
          <tr style="font-weight: bold; background-color: #E6F3FF;">
            <td style="text-align: center; padding: 5px;"></td>
            <td style="text-align: center; padding: 5px;"></td>
            <td style="text-align: left; padding: 5px; font-weight: bold;">1st, 2nd & 3rd year Total Credits</td>
            <td style="text-align: center; padding: 5px;">${thirdYearTotals.basket1 || 0}</td>
            <td style="text-align: center; padding: 5px;">${thirdYearTotals.basket2 || 0}</td>
            <td style="text-align: center; padding: 5px;">${thirdYearTotals.basket3 || 0}</td>
            <td style="text-align: center; padding: 5px;">${thirdYearTotals.basket4 || 0}</td>
            <td style="text-align: center; padding: 5px;">${thirdYearTotals.basket5 || 0}</td>
            <td style="text-align: center; padding: 5px;">${thirdYearTotals.grandTotal || 0}</td>
          </tr>
        `;
      } else if (sem2Num === 8) {
        sem2TableWithYearTotal = sem2Table.html + `
          <tr style="font-weight: bold; background-color: #E6F3FF;">
            <td style="text-align: center; padding: 5px;"></td>
            <td style="text-align: center; padding: 5px;"></td>
            <td style="text-align: left; padding: 5px; font-weight: bold;">1st, 2nd, 3rd & 4th year Total</td>
            <td style="text-align: center; padding: 5px;">${fourthYearTotals.basket1 || 0}</td>
            <td style="text-align: center; padding: 5px;">${fourthYearTotals.basket2 || 0}</td>
            <td style="text-align: center; padding: 5px;">${fourthYearTotals.basket3 || 0}</td>
            <td style="text-align: center; padding: 5px;">${fourthYearTotals.basket4 || 0}</td>
            <td style="text-align: center; padding: 5px;">${fourthYearTotals.basket5 || 0}</td>
            <td style="text-align: center; padding: 5px;">${fourthYearTotals.grandTotal || 0}</td>
          </tr>
        `;
      }

      result += `<tr><td colspan="9" style="height: 10px; border: 1px solid #000;"></td></tr>`;
      result += `
        <tr>
          <td colspan="4" style="width: 50%; vertical-align: top; padding: 0; border: 1px solid #000;">
            <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
              ${sem1Table.html}
            </table>
          </td>
          <td colspan="5" style="width: 50%; vertical-align: top; padding: 0; border: 1px solid #000;">
            <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
              ${sem2TableWithYearTotal}
            </table>
          </td>
        </tr>
      `;
    }

    return `
      <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 10px;">
          <table border="1" cellpadding="5" cellspacing="0" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td colspan="9" style="text-align: center; font-weight: bold; font-size: 14px; background-color: #E6F3FF; padding: 8px;">
                CENTURION UNIVERSITY OF TECHNOLOGY & MANAGEMENT
              </td>
            </tr>
            <tr>
              <td colspan="9" style="text-align: center; font-weight: bold; font-size: 12px; background-color: #E6F3FF; padding: 8px;">
                SCHOOL OF ENGINEERING & TECHNOLOGY
              </td>
            </tr>
            <tr>
              <td colspan="9" style="text-align: center; font-weight: bold; font-size: 12px; background-color: #E6F3FF; padding: 8px;">
                PARALAKHEMUNDI CAMPUS
              </td>
            </tr>
            <tr>
              <td colspan="9" style="text-align: center; font-weight: bold; font-size: 12px; background-color: #E6F3FF; padding: 8px;">
                SUBJECT REGISTRATION AS PER CBCS CURRICULUM
              </td>
            </tr>
            <tr>
              <td colspan="4" style="font-weight: bold; background-color: #F0F0F0; padding: 8px;">NAME OF STUDENT:</td>
              <td colspan="5" style="padding: 8px;">${studentData.name || ''}</td>
            </tr>
            <tr>
              <td colspan="3" style="font-weight: bold; background-color: #F0F0F0; padding: 8px;">REGISTRATION NO:</td>
              <td colspan="3" style="padding: 8px;">${studentData.registration || ''}</td>
              <td colspan="1" style="font-weight: bold; background-color: #F0F0F0; padding: 8px;">SESSION:</td>
              <td colspan="2" style="padding: 8px;">${sessionYear}</td>
            </tr>
            <tr>
              <td colspan="3" style="font-weight: bold; background-color: #F0F0F0; padding: 8px;">BRANCH:</td>
              <td colspan="6" style="padding: 8px;">${branchShort}</td>
            </tr>
            ${result}
          </table>
        </body>
      </html>
    `;
  }, []);

  // Function to generate Excel XML worksheet matching HTML format exactly (for bulk download)
  const generateStudentWorksheetXmlFromHtmlFormat = useCallback((studentData, basketProgress, sheetName) => {
    const cleanSheetName = sanitizeSheetName(sheetName || studentData.registration || studentData.name || "Student");

    // Use the exact same logic as generateStudentReportHtml
    const allSubjects = [];
    Object.entries(basketProgress).forEach(([basketName, basketInfo]) => {
      const subjects = basketInfo?.subjects || [];
      subjects.forEach(subject => {
        allSubjects.push({
          ...subject,
          basket: basketName,
          basketNumber: basketName === "Basket I" ? 1 :
            basketName === "Basket II" ? 2 :
              basketName === "Basket III" ? 3 :
                basketName === "Basket IV" ? 4 :
                  basketName === "Basket V" ? 5 : 0
        });
      });
    });

    const subjectsBySemester = {};
    allSubjects.forEach(subject => {
      let sem = subject.semester || "Unknown";
      sem = sem.replace(/semester\s*/i, "Sem ").replace(/sem\s*/i, "Sem ").trim();
      if (!sem.match(/^Sem\s*\d+$/i)) {
        const numMatch = sem.match(/\d+/);
        if (numMatch) {
          sem = `Sem ${numMatch[0]}`;
        }
      }
      if (!subjectsBySemester[sem]) {
        subjectsBySemester[sem] = [];
      }
      subjectsBySemester[sem].push(subject);
    });

    const allSemesterKeys = ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6", "Sem 7", "Sem 8"];

    const regYear = studentData.registration ? studentData.registration.substring(0, 2) : new Date().getFullYear().toString().substring(2);
    const sessionYear = `20${regYear}-${parseInt(regYear) + 4}`;
    const branchCode = studentData.department || studentData.actual_department || '';
    const branchMap = {
      "Civil Engineering": "Civil",
      "Computer Science Engineering": "CSE",
      "Electronics & Communication Engineering": "ECE",
      "Electrical & Electronics Engineering": "EEE",
      "Mechanical Engineering": "Mechanical",
      "AIML": "AIML",
    };
    const branchShort = Object.keys(branchMap).find(key => branchCode.includes(key))
      ? branchMap[Object.keys(branchMap).find(key => branchCode.includes(key))]
      : branchCode;

    const calculateSemesterTotals = (semester) => {
      const subjects = subjectsBySemester[semester] || [];
      let totals = { basket1: 0, basket2: 0, basket3: 0, basket4: 0, basket5: 0, grandTotal: 0 };
      subjects.forEach(subject => {
        const credits = Number(subject.credits) || 0;
        const basketNum = subject.basketNumber || 0;
        if (basketNum === 1) totals.basket1 += credits;
        if (basketNum === 2) totals.basket2 += credits;
        if (basketNum === 3) totals.basket3 += credits;
        if (basketNum === 4) totals.basket4 += credits;
        if (basketNum === 5) totals.basket5 += credits;
        totals.grandTotal += credits;
      });
      return totals;
    };

    const semesterTotalsMap = {};
    allSemesterKeys.forEach(semKey => {
      semesterTotalsMap[semKey] = calculateSemesterTotals(semKey);
    });

    const firstYearTotals = {
      basket1: (semesterTotalsMap["Sem 1"]?.basket1 || 0) + (semesterTotalsMap["Sem 2"]?.basket1 || 0),
      basket2: (semesterTotalsMap["Sem 1"]?.basket2 || 0) + (semesterTotalsMap["Sem 2"]?.basket2 || 0),
      basket3: (semesterTotalsMap["Sem 1"]?.basket3 || 0) + (semesterTotalsMap["Sem 2"]?.basket3 || 0),
      basket4: (semesterTotalsMap["Sem 1"]?.basket4 || 0) + (semesterTotalsMap["Sem 2"]?.basket4 || 0),
      basket5: (semesterTotalsMap["Sem 1"]?.basket5 || 0) + (semesterTotalsMap["Sem 2"]?.basket5 || 0),
      grandTotal: (semesterTotalsMap["Sem 1"]?.grandTotal || 0) + (semesterTotalsMap["Sem 2"]?.grandTotal || 0)
    };

    const secondYearTotals = {
      basket1: firstYearTotals.basket1 + (semesterTotalsMap["Sem 3"]?.basket1 || 0) + (semesterTotalsMap["Sem 4"]?.basket1 || 0),
      basket2: firstYearTotals.basket2 + (semesterTotalsMap["Sem 3"]?.basket2 || 0) + (semesterTotalsMap["Sem 4"]?.basket2 || 0),
      basket3: firstYearTotals.basket3 + (semesterTotalsMap["Sem 3"]?.basket3 || 0) + (semesterTotalsMap["Sem 4"]?.basket3 || 0),
      basket4: firstYearTotals.basket4 + (semesterTotalsMap["Sem 3"]?.basket4 || 0) + (semesterTotalsMap["Sem 4"]?.basket4 || 0),
      basket5: firstYearTotals.basket5 + (semesterTotalsMap["Sem 3"]?.basket5 || 0) + (semesterTotalsMap["Sem 4"]?.basket5 || 0),
      grandTotal: firstYearTotals.grandTotal + (semesterTotalsMap["Sem 3"]?.grandTotal || 0) + (semesterTotalsMap["Sem 4"]?.grandTotal || 0)
    };

    const thirdYearTotals = {
      basket1: secondYearTotals.basket1 + (semesterTotalsMap["Sem 5"]?.basket1 || 0) + (semesterTotalsMap["Sem 6"]?.basket1 || 0),
      basket2: secondYearTotals.basket2 + (semesterTotalsMap["Sem 5"]?.basket2 || 0) + (semesterTotalsMap["Sem 6"]?.basket2 || 0),
      basket3: secondYearTotals.basket3 + (semesterTotalsMap["Sem 5"]?.basket3 || 0) + (semesterTotalsMap["Sem 6"]?.basket3 || 0),
      basket4: secondYearTotals.basket4 + (semesterTotalsMap["Sem 5"]?.basket4 || 0) + (semesterTotalsMap["Sem 6"]?.basket4 || 0),
      basket5: secondYearTotals.basket5 + (semesterTotalsMap["Sem 5"]?.basket5 || 0) + (semesterTotalsMap["Sem 6"]?.basket5 || 0),
      grandTotal: secondYearTotals.grandTotal + (semesterTotalsMap["Sem 5"]?.grandTotal || 0) + (semesterTotalsMap["Sem 6"]?.grandTotal || 0)
    };

    const fourthYearTotals = {
      basket1: thirdYearTotals.basket1 + (semesterTotalsMap["Sem 7"]?.basket1 || 0) + (semesterTotalsMap["Sem 8"]?.basket1 || 0),
      basket2: thirdYearTotals.basket2 + (semesterTotalsMap["Sem 7"]?.basket2 || 0) + (semesterTotalsMap["Sem 8"]?.basket2 || 0),
      basket3: thirdYearTotals.basket3 + (semesterTotalsMap["Sem 7"]?.basket3 || 0) + (semesterTotalsMap["Sem 8"]?.basket3 || 0),
      basket4: thirdYearTotals.basket4 + (semesterTotalsMap["Sem 7"]?.basket4 || 0) + (semesterTotalsMap["Sem 8"]?.basket4 || 0),
      basket5: thirdYearTotals.basket5 + (semesterTotalsMap["Sem 7"]?.basket5 || 0) + (semesterTotalsMap["Sem 8"]?.basket5 || 0),
      grandTotal: thirdYearTotals.grandTotal + (semesterTotalsMap["Sem 7"]?.grandTotal || 0) + (semesterTotalsMap["Sem 8"]?.grandTotal || 0)
    };

    const rows = [];
    // 17 columns: Left semester (8) + Right semester (9) - matching HTML nested table structure exactly
    const columnWidths = [80, 200, 60, 60, 60, 60, 60, 60, 40, 80, 200, 60, 60, 60, 60, 60, 60];
    const columnsXml = columnWidths.map((width) => `<Column ss:AutoFitWidth="0" ss:Width="${width}"/>`).join("");

    // Headers - 17 columns (no merged cells to avoid Excel opening issues)
    rows.push(createExcelRow([
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("CENTURION UNIVERSITY OF TECHNOLOGY & MANAGEMENT", "Header"),

      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header")
    ]));
    rows.push(createExcelRow([
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("SCHOOL OF ENGINEERING & TECHNOLOGY", "Header"),

      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header")
    ]));
    rows.push(createExcelRow([
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("PARALAKHEMUNDI CAMPUS", "Header"),

      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header")
    ]));
    rows.push(createExcelRow([
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("SUBJECT REGISTRATION AS PER CBCS CURRICULUM", "Header"),

      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header")
    ]));

    // Student info - 17 columns (no merged cells to avoid Excel opening issues)
    rows.push(createExcelRow([
      createExcelCell("NAME OF STUDENT:", "Label"),
      createExcelCell(studentData.name || "", "Value"),

      createExcelCell("", "Value"),

      createExcelCell("", "Value"),

      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value")
    ]));
    rows.push(createExcelRow([
      createExcelCell("REGISTRATION NO:", "Label"),
      createExcelCell("", "Value"),

      createExcelCell(studentData.registration || "", "Value"),
      createExcelCell("SESSION:", "Label"),
      createExcelCell(sessionYear, "Value"),

      createExcelCell("", "Value"),
      createExcelCell("", "Value"),

      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value")
    ]));
    rows.push(createExcelRow([
      createExcelCell("BRANCH:", "Label"),
      createExcelCell(branchShort, "Value"),

      createExcelCell("", "Value"),
      createExcelCell("", "Value"),

      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value")
    ]));

    // Build semester pairs side-by-side (17 columns: left 8, right 9) - exactly like screenshot
    const buildSemesterPair = (sem1Key, sem2Key, sem1Num, sem2Num, yearTotals, yearLabel) => {
      const sem1Subjects = subjectsBySemester[sem1Key] || [];
      const sem2Subjects = subjectsBySemester[sem2Key] || [];
      const maxRows = Math.max(sem1Subjects.length, sem2Subjects.length);

      // Empty separator row (minimal spacing)
      rows.push(createExcelRow(Array(17).fill("").map(() => createExcelCell("", "Spacer"))));

      // Semester headers - side by side (17 columns: left 8, right 9) - no merged cells, no spacer
      rows.push(createExcelRow([
        createExcelCell(`Semester-${sem1Num}`, "SemesterHeader"),
        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader"),
        createExcelCell(`Semester-${sem2Num}`, "SemesterHeader"),

        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader")
      ]));

      // Column headers - side by side (17 columns) - no spacer between
      rows.push(createExcelRow([
        // Left semester headers (8 columns)
        createExcelCell("Code", "ColumnHeader"),
        createExcelCell("Subject", "ColumnHeader"),
        createExcelCell("Basket 1 (Credit)", "ColumnHeader"),
        createExcelCell("Basket 2 (Credit)", "ColumnHeader"),
        createExcelCell("Basket 3 (Credit)", "ColumnHeader"),
        createExcelCell("Basket 4 (Credit)", "ColumnHeader"),
        createExcelCell("Basket 5 (Credit)", "ColumnHeader"),
        createExcelCell("Grand Total (Credit)", "ColumnHeader"),
        // Right semester headers (9 columns) - directly adjacent, no spacer
        createExcelCell("Sl. No", "ColumnHeader"),
        createExcelCell("Code", "ColumnHeader"),
        createExcelCell("Subject", "ColumnHeader"),
        createExcelCell("Basket 1 (Credit)", "ColumnHeader"),
        createExcelCell("Basket 2 (Credit)", "ColumnHeader"),
        createExcelCell("Basket 3 (Credit)", "ColumnHeader"),
        createExcelCell("Basket 4 (Credit)", "ColumnHeader"),
        createExcelCell("Basket 5 (Credit)", "ColumnHeader"),
        createExcelCell("Grand Total (Credit)", "ColumnHeader")
      ]));

      let sem1Totals = { basket1: 0, basket2: 0, basket3: 0, basket4: 0, basket5: 0, grandTotal: 0 };
      let sem2Totals = { basket1: 0, basket2: 0, basket3: 0, basket4: 0, basket5: 0, grandTotal: 0 };

      // Subject rows - side by side (17 columns)
      for (let idx = 0; idx < maxRows; idx++) {
        const subj1 = sem1Subjects[idx];
        const subj2 = sem2Subjects[idx];

        const credits1 = subj1 ? Number(subj1?.credits) || 0 : 0;
        const credits2 = subj2 ? Number(subj2?.credits) || 0 : 0;

        const basket1_1 = subj1 && subj1.basketNumber === 1 ? credits1 : 0;
        const basket2_1 = subj1 && subj1.basketNumber === 2 ? credits1 : 0;
        const basket3_1 = subj1 && subj1.basketNumber === 3 ? credits1 : 0;
        const basket4_1 = subj1 && subj1.basketNumber === 4 ? credits1 : 0;
        const basket5_1 = subj1 && subj1.basketNumber === 5 ? credits1 : 0;

        const basket1_2 = subj2 && subj2.basketNumber === 1 ? credits2 : 0;
        const basket2_2 = subj2 && subj2.basketNumber === 2 ? credits2 : 0;
        const basket3_2 = subj2 && subj2.basketNumber === 3 ? credits2 : 0;
        const basket4_2 = subj2 && subj2.basketNumber === 4 ? credits2 : 0;
        const basket5_2 = subj2 && subj2.basketNumber === 5 ? credits2 : 0;

        if (subj1) {
          sem1Totals.basket1 += basket1_1;
          sem1Totals.basket2 += basket2_1;
          sem1Totals.basket3 += basket3_1;
          sem1Totals.basket4 += basket4_1;
          sem1Totals.basket5 += basket5_1;
          sem1Totals.grandTotal += credits1;
        }

        if (subj2) {
          sem2Totals.basket1 += basket1_2;
          sem2Totals.basket2 += basket2_2;
          sem2Totals.basket3 += basket3_2;
          sem2Totals.basket4 += basket4_2;
          sem2Totals.basket5 += basket5_2;
          sem2Totals.grandTotal += credits2;
        }

        rows.push(createExcelRow([
          // Left semester: Code, Subject, Basket 1-5, Total (8 columns)
          createExcelCell(subj1?.code || "", "Value"),
          createExcelCell(subj1?.name || "", "Value"),
          createExcelCell(basket1_1 || "", "ValueCenter"),
          createExcelCell(basket2_1 || "", "ValueCenter"),
          createExcelCell(basket3_1 || "", "ValueCenter"),
          createExcelCell(basket4_1 || "", "ValueCenter"),
          createExcelCell(basket5_1 || "", "ValueCenter"),
          createExcelCell(credits1 || "", "ValueCenter"),
          // Right semester: Sl.No, Code, Subject, Basket 1-5, Total (9 columns) - directly adjacent
          createExcelCell(subj2 ? idx + 1 : "", "ValueCenter"),
          createExcelCell(subj2?.code || "", "Value"),
          createExcelCell(subj2?.name || "", "Value"),
          createExcelCell(basket1_2 || "", "ValueCenter"),
          createExcelCell(basket2_2 || "", "ValueCenter"),
          createExcelCell(basket3_2 || "", "ValueCenter"),
          createExcelCell(basket4_2 || "", "ValueCenter"),
          createExcelCell(basket5_2 || "", "ValueCenter"),
          createExcelCell(credits2 || "", "ValueCenter")
        ]));
      }

      // Totals row - exactly 17 columns
      rows.push(createExcelRow([
        // Left semester totals (8 columns)
        createExcelCell("Total", "TotalLabel"),
        createExcelCell("", "TotalLabel"),
        createExcelCell(sem1Totals.basket1 || "", "TotalValue"),
        createExcelCell(sem1Totals.basket2 || "", "TotalValue"),
        createExcelCell(sem1Totals.basket3 || "", "TotalValue"),
        createExcelCell(sem1Totals.basket4 || "", "TotalValue"),
        createExcelCell(sem1Totals.basket5 || "", "TotalValue"),
        createExcelCell(sem1Totals.grandTotal || "", "TotalValue"),
        // Right semester totals (9 columns) - directly adjacent
        createExcelCell("", "TotalLabel"),
        createExcelCell("Total", "TotalLabel"),

        createExcelCell("", "TotalLabel"),
        createExcelCell(sem2Totals.basket1 || "", "TotalValue"),
        createExcelCell(sem2Totals.basket2 || "", "TotalValue"),
        createExcelCell(sem2Totals.basket3 || "", "TotalValue"),
        createExcelCell(sem2Totals.basket4 || "", "TotalValue"),
        createExcelCell(sem2Totals.basket5 || "", "TotalValue"),
        createExcelCell(sem2Totals.grandTotal || "", "TotalValue")
      ]));

      // Year totals if applicable (only for even semesters: 2, 4, 6, 8)
      if (yearTotals && yearLabel && sem2Num % 2 === 0) {
        rows.push(createExcelRow([
          createExcelCell("", "GrandTotalLabel"),
          createExcelCell("", "GrandTotalLabel"),
          createExcelCell("", "GrandTotalLabel"),
          createExcelCell("", "GrandTotalLabel"),
          createExcelCell("", "GrandTotalLabel"),
          createExcelCell("", "GrandTotalLabel"),
          createExcelCell("", "GrandTotalLabel"),
          createExcelCell("", "GrandTotalLabel"),
          createExcelCell("", "GrandTotalLabel"),
          createExcelCell("", "GrandTotalLabel"),
          createExcelCell(yearLabel, "GrandTotalLabel"),
          createExcelCell(yearTotals.basket1 || "", "GrandTotalValue"),
          createExcelCell(yearTotals.basket2 || "", "GrandTotalValue"),
          createExcelCell(yearTotals.basket3 || "", "GrandTotalValue"),
          createExcelCell(yearTotals.basket4 || "", "GrandTotalValue"),
          createExcelCell(yearTotals.basket5 || "", "GrandTotalValue"),
          createExcelCell(yearTotals.grandTotal || "", "GrandTotalValue")
        ]));
      }
    };

    // Build semester pairs side-by-side (matching screenshot exactly - no extra spacing)
    buildSemesterPair(allSemesterKeys[0], allSemesterKeys[1], 1, 2, firstYearTotals, "1st Year Total Credits");

    // Minimal spacing between semester pairs (matching screenshot)
    rows.push(createExcelRow(Array(17).fill("").map(() => createExcelCell("", "Spacer"))));

    buildSemesterPair(allSemesterKeys[2], allSemesterKeys[3], 3, 4, secondYearTotals, "1st & 2nd Year Total Credits");

    // Minimal spacing between semester pairs (matching screenshot)
    rows.push(createExcelRow(Array(17).fill("").map(() => createExcelCell("", "Spacer"))));

    buildSemesterPair(allSemesterKeys[4], allSemesterKeys[5], 5, 6, thirdYearTotals, "1st, 2nd & 3rd year Total Credits");

    // Minimal spacing between semester pairs (matching screenshot)
    rows.push(createExcelRow(Array(17).fill("").map(() => createExcelCell("", "Spacer"))));

    buildSemesterPair(allSemesterKeys[6], allSemesterKeys[7], 7, 8, fourthYearTotals, "1st, 2nd, 3rd & 4th year Total");

    const tableXml = `<Table ss:ExpandedColumnCount="17" ss:ExpandedRowCount="${rows.length}" x:FullColumns="1" x:FullRows="1">${columnsXml}${rows.join("")}</Table>`;
    const worksheetOptions = `<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"></WorksheetOptions>`;

    return `<Worksheet ss:Name="${escapeXml(cleanSheetName)}">${tableXml}${worksheetOptions}</Worksheet>`;
  }, []);

  // Function to generate Excel XML worksheet for a student (same format as HTML)
  const generateStudentWorksheetXml = useCallback((studentData, basketProgress, sheetName) => {
    const cleanSheetName = sanitizeSheetName(sheetName || studentData.registration || studentData.name || "Student");

    // Collect all subjects with their basket and semester info
    const allSubjects = [];
    Object.entries(basketProgress).forEach(([basketName, basketInfo]) => {
      const subjects = basketInfo?.subjects || [];
      subjects.forEach(subject => {
        allSubjects.push({
          ...subject,
          basket: basketName,
          basketNumber: basketName === "Basket I" ? 1 :
            basketName === "Basket II" ? 2 :
              basketName === "Basket III" ? 3 :
                basketName === "Basket IV" ? 4 :
                  basketName === "Basket V" ? 5 : 0
        });
      });
    });

    // Group by semester
    const subjectsBySemester = {};
    allSubjects.forEach(subject => {
      let sem = subject.semester || "Unknown";
      sem = sem.replace(/semester\s*/i, "Sem ").replace(/sem\s*/i, "Sem ").trim();
      if (!sem.match(/^Sem\s*\d+$/i)) {
        const numMatch = sem.match(/\d+/);
        if (numMatch) {
          sem = `Sem ${numMatch[0]}`;
        }
      }
      if (!subjectsBySemester[sem]) {
        subjectsBySemester[sem] = [];
      }
      subjectsBySemester[sem].push(subject);
    });

    const allSemesterKeys = ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6", "Sem 7", "Sem 8"];

    // Get session year and branch
    const regYear = studentData.registration ? studentData.registration.substring(0, 2) : new Date().getFullYear().toString().substring(2);
    const sessionYear = `20${regYear}-${parseInt(regYear) + 4}`;
    const branchCode = studentData.department || studentData.actual_department || '';
    const branchMap = {
      "Civil Engineering": "Civil",
      "Computer Science Engineering": "CSE",
      "Electronics & Communication Engineering": "ECE",
      "Electrical & Electronics Engineering": "EEE",
      "Mechanical Engineering": "Mechanical",
      "AIML": "AIML",
    };
    const branchShort = Object.keys(branchMap).find(key => branchCode.includes(key))
      ? branchMap[Object.keys(branchMap).find(key => branchCode.includes(key))]
      : branchCode;

    // Calculate semester totals
    const calculateSemesterTotals = (semester) => {
      const subjects = subjectsBySemester[semester] || [];
      let totals = { basket1: 0, basket2: 0, basket3: 0, basket4: 0, basket5: 0, grandTotal: 0 };
      subjects.forEach(subject => {
        const credits = Number(subject.credits) || 0;
        const basketNum = subject.basketNumber || 0;
        if (basketNum === 1) totals.basket1 += credits;
        if (basketNum === 2) totals.basket2 += credits;
        if (basketNum === 3) totals.basket3 += credits;
        if (basketNum === 4) totals.basket4 += credits;
        if (basketNum === 5) totals.basket5 += credits;
        totals.grandTotal += credits;
      });
      return totals;
    };

    const semesterTotalsMap = {};
    allSemesterKeys.forEach(semKey => {
      semesterTotalsMap[semKey] = calculateSemesterTotals(semKey);
    });

    // Calculate year totals
    const firstYearTotals = {
      basket1: (semesterTotalsMap["Sem 1"]?.basket1 || 0) + (semesterTotalsMap["Sem 2"]?.basket1 || 0),
      basket2: (semesterTotalsMap["Sem 1"]?.basket2 || 0) + (semesterTotalsMap["Sem 2"]?.basket2 || 0),
      basket3: (semesterTotalsMap["Sem 1"]?.basket3 || 0) + (semesterTotalsMap["Sem 2"]?.basket3 || 0),
      basket4: (semesterTotalsMap["Sem 1"]?.basket4 || 0) + (semesterTotalsMap["Sem 2"]?.basket4 || 0),
      basket5: (semesterTotalsMap["Sem 1"]?.basket5 || 0) + (semesterTotalsMap["Sem 2"]?.basket5 || 0),
      grandTotal: (semesterTotalsMap["Sem 1"]?.grandTotal || 0) + (semesterTotalsMap["Sem 2"]?.grandTotal || 0)
    };

    const secondYearTotals = {
      basket1: firstYearTotals.basket1 + (semesterTotalsMap["Sem 3"]?.basket1 || 0) + (semesterTotalsMap["Sem 4"]?.basket1 || 0),
      basket2: firstYearTotals.basket2 + (semesterTotalsMap["Sem 3"]?.basket2 || 0) + (semesterTotalsMap["Sem 4"]?.basket2 || 0),
      basket3: firstYearTotals.basket3 + (semesterTotalsMap["Sem 3"]?.basket3 || 0) + (semesterTotalsMap["Sem 4"]?.basket3 || 0),
      basket4: firstYearTotals.basket4 + (semesterTotalsMap["Sem 3"]?.basket4 || 0) + (semesterTotalsMap["Sem 4"]?.basket4 || 0),
      basket5: firstYearTotals.basket5 + (semesterTotalsMap["Sem 3"]?.basket5 || 0) + (semesterTotalsMap["Sem 4"]?.basket5 || 0),
      grandTotal: firstYearTotals.grandTotal + (semesterTotalsMap["Sem 3"]?.grandTotal || 0) + (semesterTotalsMap["Sem 4"]?.grandTotal || 0)
    };

    const thirdYearTotals = {
      basket1: secondYearTotals.basket1 + (semesterTotalsMap["Sem 5"]?.basket1 || 0) + (semesterTotalsMap["Sem 6"]?.basket1 || 0),
      basket2: secondYearTotals.basket2 + (semesterTotalsMap["Sem 5"]?.basket2 || 0) + (semesterTotalsMap["Sem 6"]?.basket2 || 0),
      basket3: secondYearTotals.basket3 + (semesterTotalsMap["Sem 5"]?.basket3 || 0) + (semesterTotalsMap["Sem 6"]?.basket3 || 0),
      basket4: secondYearTotals.basket4 + (semesterTotalsMap["Sem 5"]?.basket4 || 0) + (semesterTotalsMap["Sem 6"]?.basket4 || 0),
      basket5: secondYearTotals.basket5 + (semesterTotalsMap["Sem 5"]?.basket5 || 0) + (semesterTotalsMap["Sem 6"]?.basket5 || 0),
      grandTotal: secondYearTotals.grandTotal + (semesterTotalsMap["Sem 5"]?.grandTotal || 0) + (semesterTotalsMap["Sem 6"]?.grandTotal || 0)
    };

    const fourthYearTotals = {
      basket1: thirdYearTotals.basket1 + (semesterTotalsMap["Sem 7"]?.basket1 || 0) + (semesterTotalsMap["Sem 8"]?.basket1 || 0),
      basket2: thirdYearTotals.basket2 + (semesterTotalsMap["Sem 7"]?.basket2 || 0) + (semesterTotalsMap["Sem 8"]?.basket2 || 0),
      basket3: thirdYearTotals.basket3 + (semesterTotalsMap["Sem 7"]?.basket3 || 0) + (semesterTotalsMap["Sem 8"]?.basket3 || 0),
      basket4: thirdYearTotals.basket4 + (semesterTotalsMap["Sem 7"]?.basket4 || 0) + (semesterTotalsMap["Sem 8"]?.basket4 || 0),
      basket5: thirdYearTotals.basket5 + (semesterTotalsMap["Sem 7"]?.basket5 || 0) + (semesterTotalsMap["Sem 8"]?.basket5 || 0),
      grandTotal: thirdYearTotals.grandTotal + (semesterTotalsMap["Sem 7"]?.grandTotal || 0) + (semesterTotalsMap["Sem 8"]?.grandTotal || 0)
    };

    const rows = [];
    // 17 columns: Left semester (8) + Right semester (9)
    const columnWidths = [80, 200, 60, 60, 60, 60, 60, 60, 40, 80, 200, 60, 60, 60, 60, 60, 60];
    const columnsXml = columnWidths.map((width) => `<Column ss:AutoFitWidth="0" ss:Width="${width}"/>`).join("");

    // Headers - 17 columns (use simple cells instead of merged to avoid Excel issues)
    rows.push(createExcelRow([
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),

      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("CENTURION UNIVERSITY OF TECHNOLOGY & MANAGEMENT", "Header"),

      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header")
    ]));
    rows.push(createExcelRow([
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("SCHOOL OF ENGINEERING & TECHNOLOGY", "Header"),

      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header")
    ]));
    rows.push(createExcelRow([
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("PARALAKHEMUNDI CAMPUS", "Header"),

      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header")
    ]));
    rows.push(createExcelRow([
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("SUBJECT REGISTRATION AS PER CBCS CURRICULUM", "Header"),

      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header"),
      createExcelCell("", "Header")
    ]));

    // Student info - exactly 17 columns (no merged cells to avoid Excel issues)
    rows.push(createExcelRow([
      createExcelCell("NAME OF STUDENT:", "Label"),
      createExcelCell(studentData.name || "", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value")
    ]));
    rows.push(createExcelRow([
      createExcelCell("REGISTRATION NO:", "Label"),
      createExcelCell(studentData.registration || "", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("SESSION:", "Label"),
      createExcelCell(sessionYear, "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value")
    ]));
    rows.push(createExcelRow([
      createExcelCell("BRANCH:", "Label"),
      createExcelCell(branchShort, "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value"),
      createExcelCell("", "Value")
    ]));

    // Build semester pairs side-by-side (17 columns: left 8, right 9)
    const buildSemesterPair = (sem1Key, sem2Key, sem1Num, sem2Num, yearTotals = null) => {
      const sem1Subjects = subjectsBySemester[sem1Key] || [];
      const sem2Subjects = subjectsBySemester[sem2Key] || [];
      const maxSubjects = Math.max(sem1Subjects.length, sem2Subjects.length);

      // Empty separator row
      rows.push(createExcelRow(Array(17).fill("").map(() => createExcelCell("", "Spacer"))));

      // Semester headers - side by side (17 columns: left 8, right 9) - no merged cells
      rows.push(createExcelRow([
        createExcelCell(`Semester-${sem1Num}`, "SemesterHeader"), // Left: 1 column
        createExcelCell("", "SemesterHeader"), // 6 more columns
        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader"), // Total 8 columns for left
        createExcelCell(`Semester-${sem2Num}`, "SemesterHeader"), // Right: 1 column
        createExcelCell("", "SemesterHeader"), // 8 more columns
        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader"),
        createExcelCell("", "SemesterHeader") // Total 9 columns for right
      ]));

      // Column headers - side by side (17 columns)
      rows.push(createExcelRow([
        // Left semester headers (8 columns)
        createExcelCell("Code", "ColumnHeader"),
        createExcelCell("Subject", "ColumnHeader"),
        createExcelCell("Basket 1 (Credit)", "ColumnHeader"),
        createExcelCell("Basket 2 (Credit)", "ColumnHeader"),
        createExcelCell("Basket 3 (Credit)", "ColumnHeader"),
        createExcelCell("Basket 4 (Credit)", "ColumnHeader"),
        createExcelCell("Basket 5 (Credit)", "ColumnHeader"),
        createExcelCell("Grand Total (Credit)", "ColumnHeader"),
        // Right semester headers (9 columns)
        createExcelCell("No", "ColumnHeader"),
        createExcelCell("Code", "ColumnHeader"),
        createExcelCell("Subject", "ColumnHeader"),
        createExcelCell("Basket 1 (Credit)", "ColumnHeader"),
        createExcelCell("Basket 2 (Credit)", "ColumnHeader"),
        createExcelCell("Basket 3 (Credit)", "ColumnHeader"),
        createExcelCell("Basket 4 (Credit)", "ColumnHeader"),
        createExcelCell("Basket 5 (Credit)", "ColumnHeader"),
        createExcelCell("Grand Total (Credit)", "ColumnHeader")
      ]));

      let sem1Totals = { basket1: 0, basket2: 0, basket3: 0, basket4: 0, basket5: 0, grandTotal: 0 };
      let sem2Totals = { basket1: 0, basket2: 0, basket3: 0, basket4: 0, basket5: 0, grandTotal: 0 };

      // Subject rows - side by side
      for (let idx = 0; idx < maxSubjects; idx++) {
        const subj1 = sem1Subjects[idx];
        const subj2 = sem2Subjects[idx];

        const credits1 = subj1 ? Number(subj1?.credits) || 0 : 0;
        const credits2 = subj2 ? Number(subj2?.credits) || 0 : 0;

        const basket1_1 = subj1 && subj1.basketNumber === 1 ? credits1 : 0;
        const basket2_1 = subj1 && subj1.basketNumber === 2 ? credits1 : 0;
        const basket3_1 = subj1 && subj1.basketNumber === 3 ? credits1 : 0;
        const basket4_1 = subj1 && subj1.basketNumber === 4 ? credits1 : 0;
        const basket5_1 = subj1 && subj1.basketNumber === 5 ? credits1 : 0;

        const basket1_2 = subj2 && subj2.basketNumber === 1 ? credits2 : 0;
        const basket2_2 = subj2 && subj2.basketNumber === 2 ? credits2 : 0;
        const basket3_2 = subj2 && subj2.basketNumber === 3 ? credits2 : 0;
        const basket4_2 = subj2 && subj2.basketNumber === 4 ? credits2 : 0;
        const basket5_2 = subj2 && subj2.basketNumber === 5 ? credits2 : 0;

        if (subj1) {
          sem1Totals.basket1 += basket1_1;
          sem1Totals.basket2 += basket2_1;
          sem1Totals.basket3 += basket3_1;
          sem1Totals.basket4 += basket4_1;
          sem1Totals.basket5 += basket5_1;
          sem1Totals.grandTotal += credits1;
        }

        if (subj2) {
          sem2Totals.basket1 += basket1_2;
          sem2Totals.basket2 += basket2_2;
          sem2Totals.basket3 += basket3_2;
          sem2Totals.basket4 += basket4_2;
          sem2Totals.basket5 += basket5_2;
          sem2Totals.grandTotal += credits2;
        }

        rows.push(createExcelRow([
          // Left semester: Code, Subject, Basket 1-5, Total (8 columns)
          createExcelCell(subj1?.code || "", "Value"),
          createExcelCell(subj1?.name || "", "Value"),
          createExcelCell(basket1_1 || "", "ValueCenter"),
          createExcelCell(basket2_1 || "", "ValueCenter"),
          createExcelCell(basket3_1 || "", "ValueCenter"),
          createExcelCell(basket4_1 || "", "ValueCenter"),
          createExcelCell(basket5_1 || "", "ValueCenter"),
          createExcelCell(credits1 || "", "ValueCenter"),
          // Right semester: No, Code, Subject, Basket 1-5, Total (9 columns)
          createExcelCell(subj2 ? idx + 1 : "", "Value"),
          createExcelCell(subj2?.code || "", "Value"),
          createExcelCell(subj2?.name || "", "Value"),
          createExcelCell(basket1_2 || "", "ValueCenter"),
          createExcelCell(basket2_2 || "", "ValueCenter"),
          createExcelCell(basket3_2 || "", "ValueCenter"),
          createExcelCell(basket4_2 || "", "ValueCenter"),
          createExcelCell(basket5_2 || "", "ValueCenter"),
          createExcelCell(credits2 || "", "ValueCenter")
        ]));
      }

      // Totals row - exactly 17 columns (no merged cells to avoid Excel issues)
      rows.push(createExcelRow([
        // Left semester totals (8 columns): Total, empty, Basket 1-5, Grand Total
        createExcelCell("Total", "TotalLabel"), // 1 column
        createExcelCell("", "TotalLabel"), // 1 column
        createExcelCell(sem1Totals.basket1 || "", "TotalValue"),
        createExcelCell(sem1Totals.basket2 || "", "TotalValue"),
        createExcelCell(sem1Totals.basket3 || "", "TotalValue"),
        createExcelCell(sem1Totals.basket4 || "", "TotalValue"),
        createExcelCell(sem1Totals.basket5 || "", "TotalValue"),
        createExcelCell(sem1Totals.grandTotal || "", "TotalValue"),
        // Right semester totals (9 columns): Total, empty, empty, Basket 1-5, Grand Total
        createExcelCell("Total", "TotalLabel"), // 1 column
        createExcelCell("", "TotalLabel"), // 1 column
        createExcelCell("", "TotalLabel"), // 1 column
        createExcelCell(sem2Totals.basket1 || "", "TotalValue"),
        createExcelCell(sem2Totals.basket2 || "", "TotalValue"),
        createExcelCell(sem2Totals.basket3 || "", "TotalValue"),
        createExcelCell(sem2Totals.basket4 || "", "TotalValue"),
        createExcelCell(sem2Totals.basket5 || "", "TotalValue"),
        createExcelCell(sem2Totals.grandTotal || "", "TotalValue")
      ]));

      // Year totals if applicable (only for even semesters: 2, 4, 6, 8)
      if (yearTotals && sem2Num % 2 === 0) {
        const yearLabel = sem2Num === 2 ? "1st Year Total Credits" :
          sem2Num === 4 ? "1st & 2nd Year Total Credits" :
            sem2Num === 6 ? "1st, 2nd & 3rd year Total Credits" :
              sem2Num === 8 ? "1st, 2nd, 3rd & 4th year Total" : "";

        if (yearLabel) {
          // Year totals row: 8 empty (left) + Year label (merged 2) + empty (1) + 6 basket totals = 17
          rows.push(createExcelRow([
            createExcelCell("", "GrandTotalLabel"), // 1 column
            createExcelCell("", "GrandTotalLabel"), // 1 column
            createExcelCell("", "GrandTotalLabel"), // 1 column
            createExcelCell("", "GrandTotalLabel"), // 1 column
            createExcelCell("", "GrandTotalLabel"), // 1 column
            createExcelCell("", "GrandTotalLabel"), // 1 column
            createExcelCell("", "GrandTotalLabel"), // 1 column
            createExcelCell("", "GrandTotalLabel"), // 1 column
            createExcelCell(yearLabel, "GrandTotalLabel"), // 1 column
            createExcelCell("", "GrandTotalLabel"), // 1 column
            createExcelCell("", "GrandTotalLabel"), // 1 column
            createExcelCell(yearTotals.basket1 || "", "GrandTotalValue"),
            createExcelCell(yearTotals.basket2 || "", "GrandTotalValue"),
            createExcelCell(yearTotals.basket3 || "", "GrandTotalValue"),
            createExcelCell(yearTotals.basket4 || "", "GrandTotalValue"),
            createExcelCell(yearTotals.basket5 || "", "GrandTotalValue"),
            createExcelCell(yearTotals.grandTotal || "", "GrandTotalValue")
          ]));
        }
      }
    };

    // Build semester pairs side-by-side (matching HTML format)
    buildSemesterPair(allSemesterKeys[0], allSemesterKeys[1], 1, 2, firstYearTotals);
    buildSemesterPair(allSemesterKeys[2], allSemesterKeys[3], 3, 4, secondYearTotals);
    buildSemesterPair(allSemesterKeys[4], allSemesterKeys[5], 5, 6, thirdYearTotals);
    buildSemesterPair(allSemesterKeys[6], allSemesterKeys[7], 7, 8, fourthYearTotals);

    // Build table XML - Excel XML requires consistent structure (17 columns)
    const tableXml = `<Table ss:ExpandedColumnCount="17" ss:ExpandedRowCount="${rows.length}" x:FullColumns="1" x:FullRows="1">${columnsXml}${rows.join("")}</Table>`;

    // WorksheetOptions - Excel requires proper opening/closing tags (keep it simple)
    const worksheetOptions = `<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
</WorksheetOptions>`;

    return `<Worksheet ss:Name="${escapeXml(cleanSheetName)}">${tableXml}${worksheetOptions}</Worksheet>`;
  }, []);

  // Function to build Excel workbook XML with multiple worksheets
  const buildExcelWorkbookXml = useCallback((worksheetsXml = []) => {
    const workbookHeader = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">`;

    const documentProperties = `<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office"></DocumentProperties>`;
    const excelWorkbook = `<ExcelWorkbook xmlns="urn:schemas-microsoft-com:office:excel"></ExcelWorkbook>`;

    const styles = `<Styles>
<Style ss:ID="Default" ss:Name="Normal">
<Alignment ss:Vertical="Center"/>
<Font ss:FontName="Calibri" ss:Size="11"/>
</Style>
<Style ss:ID="Header">
<Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
<Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1"/>
<Interior ss:Color="#E6F3FF" ss:Pattern="Solid"/>
</Style>
<Style ss:ID="Label">
<Font ss:FontName="Calibri" ss:Bold="1"/>
<Interior ss:Color="#F0F0F0" ss:Pattern="Solid"/>
</Style>
<Style ss:ID="Value">
<Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
</Style>
<Style ss:ID="ValueCenter">
<Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
</Style>
<Style ss:ID="SemesterHeader">
<Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
<Font ss:FontName="Calibri" ss:Bold="1"/>
<Interior ss:Color="#D9E1F2" ss:Pattern="Solid"/>
</Style>
<Style ss:ID="ColumnHeader">
<Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
<Font ss:FontName="Calibri" ss:Bold="1"/>
<Interior ss:Color="#D9E1F2" ss:Pattern="Solid"/>
<Borders>
<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
</Borders>
</Style>
<Style ss:ID="TotalLabel">
<Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
<Font ss:FontName="Calibri" ss:Bold="1"/>
<Interior ss:Color="#F2F2F2" ss:Pattern="Solid"/>
<Borders>
<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
</Borders>
</Style>
<Style ss:ID="TotalValue">
<Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
<Font ss:FontName="Calibri" ss:Bold="1"/>
<Interior ss:Color="#F2F2F2" ss:Pattern="Solid"/>
<Borders>
<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
</Borders>
</Style>
<Style ss:ID="GrandTotalLabel">
<Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
<Font ss:FontName="Calibri" ss:Bold="1"/>
<Interior ss:Color="#D9E1F2" ss:Pattern="Solid"/>
<Borders>
<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
</Borders>
</Style>
<Style ss:ID="GrandTotalValue">
<Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
<Font ss:FontName="Calibri" ss:Bold="1"/>
<Interior ss:Color="#D9E1F2" ss:Pattern="Solid"/>
<Borders>
<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
</Borders>
</Style>
<Style ss:ID="Spacer">
<Interior ss:Pattern="Solid" ss:Color="#FFFFFF"/>
</Style>
</Styles>`;

    // Build workbook XML - keep it compact for better Excel compatibility
    return `${workbookHeader}${documentProperties}${excelWorkbook}${styles}${worksheetsXml.join("")}</Workbook>`;
  }, []);

  // Bulk download function - creates individual sheets for each student
  const downloadBulkReport = useCallback(async () => {
    const isBulkContext = registration === "all";

    if (!isBulkContext || filteredAndSortedStudents.length === 0) {
      addNotification('error', 'No students available for bulk report download');
      return;
    }

    setIsExporting(true);
    addNotification('info', `Preparing bulk report for ${filteredAndSortedStudents.length} students. Please wait...`);

    try {
      const worksheets = [];
      const seenSheetNames = new Set();
      const semesterFilter = semesterValues.length > 0 && !semesterValues.includes("All") ? semesterValues : [];

      // Sort students by registration number in ascending order for bulk download
      const sortedStudents = [...filteredAndSortedStudents].sort((a, b) => {
        const regA = a.registration || '';
        const regB = b.registration || '';
        return regA.localeCompare(regB, undefined, { numeric: true, sensitivity: 'base' });
      });

      for (const [index, student] of sortedStudents.entries()) {
        try {
          // Fetch detailed student data
          const url = appendSchoolParams("/api/cbcs/track");
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              registration: student.registration,
              department: "",
              batch: "",
              semesters: semesterFilter,
              basket: "",
            }),
          });

          const responseText = await res.text();
          let data;
          try {
            data = JSON.parse(responseText || "{}");
          } catch (parseErr) {
            console.error(`Failed to parse response for ${student.registration}`);
            continue;
          }

          if (!res.ok || !data.student || !data.basketProgress) {
            console.error(`Failed to fetch data for ${student.registration}`);
            continue;
          }

          const studentData = data.student;
          const basketProgress = data.basketProgress;

          // Generate sheet name
          let sheetName = studentData.registration || studentData.name || `Student${index + 1}`;
          sheetName = sanitizeSheetName(sheetName) || `Student${index + 1}`;

          // Handle duplicate sheet names
          if (seenSheetNames.has(sheetName)) {
            let attempt = 1;
            const baseName = sheetName;
            let nextName = sheetName;
            while (seenSheetNames.has(nextName)) {
              const suffix = `_${attempt}`;
              const trimmedBase = baseName.slice(0, Math.max(0, 31 - suffix.length));
              nextName = sanitizeSheetName(`${trimmedBase}${suffix}`) || `${baseName}_${attempt}`;
              attempt += 1;
            }
            sheetName = nextName;
          }

          seenSheetNames.add(sheetName);

          // Generate Excel worksheet XML for this student (same format as individual HTML download)
          // Use the same logic as generateStudentReportHtml but convert to Excel XML
          const worksheetXml = generateStudentWorksheetXmlFromHtmlFormat(studentData, basketProgress, sheetName);
          worksheets.push(worksheetXml);

          // Update progress every 5 students
          if ((index + 1) % 5 === 0) {
            addNotification('info', `Processed ${index + 1} of ${sortedStudents.length} students...`);
          }
        } catch (error) {
          console.error(`Error processing student ${student.registration}:`, error);
        }
      }

      if (worksheets.length === 0) {
        throw new Error('No student worksheets could be generated');
      }

      // Build Excel workbook with multiple worksheets (one per student)
      const workbookXml = buildExcelWorkbookXml(worksheets);

      // downloadFile function already adds UTF-8 BOM for Excel files
      downloadFile(
        workbookXml,
        `Bulk_CBCS_Reports_${department || 'all'}_${new Date().toISOString().split('T')[0]}.xls`,
        "application/vnd.ms-excel;charset=utf-8"
      );

      addNotification('success', `Bulk report downloaded with ${worksheets.length} students, each in their own sheet.`);
    } catch (error) {
      console.error('Bulk report download failed:', error);
      addNotification('error', `Bulk report download failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  }, [registration, filteredAndSortedStudents, semesterValues, department, addNotification, downloadFile, generateStudentWorksheetXmlFromHtmlFormat, buildExcelWorkbookXml]);

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

  // Debug information removed for production

  return (
    <div className={`min-h-screen transition-all duration-300 ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'}`}>


      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Enhanced Page Title */}
        <div className="text-center mb-8">
          <h1 className={`text-4xl font-extrabold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Advanced {isDiploma ? 'Diploma Subject' : 'Basket Progress'} Tracker
          </h1>
          <p className={`text-lg ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            🎯 Comprehensive {isDiploma ? 'Diploma subject' : 'CBCS basket'} analysis with real-time insights
          </p>

          {/* Enhanced Credit Requirements Card */}
          {/* Enhanced Credit Requirements Card - Show only for B.Tech */}
          {isDiploma ? (
            <div className={`mt-6 p-6 rounded-2xl shadow-lg max-w-5xl mx-auto ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200'
              }`}>
              <div className={`text-sm ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                <span className="font-bold text-lg">📋 Diploma Credit Requirements (SCTE&VT)</span>
                <div className={`mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 text-left`}>
                  <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-white/60'}`}>
                    <span className="font-semibold">Regular Students:</span>
                    <span className={`ml-2 font-bold ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>120 total credits</span>
                    <div className="text-xs mt-2 space-y-1">
                      <div>Basket I: 12 credits</div>
                      <div>Basket II: 13 credits</div>
                      <div>Basket III: 20 credits</div>
                      <div>Basket IV: 26 credits</div>
                      <div>Basket V: 49 credits</div>
                    </div>
                  </div>
                  <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-white/60'}`}>
                    <span className="font-semibold">Lateral Entry Students:</span>
                    <span className="ml-2 font-bold text-orange-500">80 total credits</span>
                    <div className="text-xs mt-2 space-y-1">
                      <div>Basket I: Exempted (0 credits)</div>
                      <div>Basket II: 5 credits</div>
                      <div>Basket III: 12 credits</div>
                      <div>Basket IV: 26 credits</div>
                      <div>Basket V: 37 credits</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={`mt-6 p-6 rounded-2xl shadow-lg max-w-5xl mx-auto ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200'
              }`}>
              <div className={`text-sm ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                <span className="font-bold text-lg">📋 Credit Requirements Overview</span>
                <div className={`mt-4 grid grid-cols-1 md:grid-cols-3 gap-6 text-left`}>
                  <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-white/60'}`}>
                    <span className="font-semibold">Regular Students (till 2023):</span>
                    <span className={`ml-2 font-bold ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>{legacyRegularCreditRequirements.total} total credits</span>
                    <div className="text-xs mt-2 space-y-1">
                      <div>Basket I: {legacyRegularCreditRequirements.basket1} credits</div>
                      <div>Basket II: {legacyRegularCreditRequirements.basket2} credits</div>
                      <div>Basket III: {legacyRegularCreditRequirements.basket3} credits</div>
                      <div>Basket IV: {legacyRegularCreditRequirements.basket4} credits</div>
                      <div>Basket V: {legacyRegularCreditRequirements.basket5} credits</div>
                    </div>
                  </div>
                  <div className={`p-4 rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-white/60'}`}>
                    <span className="font-semibold">Regular Students (2024 batch onwards):</span>
                    <span className={`ml-2 font-bold ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>{regularCreditRequirements.total} total credits</span>
                    <div className="text-xs mt-2 space-y-1">
                      <div>Basket I: {regularCreditRequirements.basket1} credits</div>
                      <div>Basket II: {regularCreditRequirements.basket2} credits</div>
                      <div>Basket III: {regularCreditRequirements.basket3} credits</div>
                      <div>Basket IV: {regularCreditRequirements.basket4} credits</div>
                      <div>Basket V: {regularCreditRequirements.basket5} credits</div>
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

              </div>
            </div>
          )}
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
                  {deptOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
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
                  {["20", "21", "22", "23", "24", "25"].map(y => <option key={y} value={y}>{`20${y} (${y})`}</option>)}
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
                  <option value="Basket I">{isDiploma ? "Basket I (12/0 credits)" : "Basket I (17/6 credits)"}</option>
                  <option value="Basket II">{isDiploma ? "Basket II (13/5 credits)" : "Basket II (12/9 credits)"}</option>
                  <option value="Basket III">{isDiploma ? "Basket III (20/12 credits)" : "Basket III (25 credits)"}</option>
                  <option value="Basket IV">{isDiploma ? "Basket IV (26/26 credits)" : `Basket IV (${is2024Onwards ? '60/48' : '58/48'} credits)`}</option>
                  <option value="Basket V">{isDiploma ? "Basket V (49/37 credits)" : `Basket V (${is2024Onwards ? '46/32' : '48/32'} credits)`}</option>
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
                className={`px-8 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors ${loading ? 'opacity-70 cursor-not-allowed' : ''
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

        {/* Diploma Student Alert */}
        {searchPerformed && !loading && registration !== "all" && studentData && studentData.is_diploma && (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  🎓 Diploma Student Detected
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    <strong>{studentData.name}</strong> ({studentData.registration}) is a <strong>{studentData.student_type}</strong> student.
                  </p>
                  <p className="mt-1">
                    <strong>Total Required Credits: <span className="text-blue-900 font-bold">{studentData.totalRequiredCredits} credits</span></strong>
                    {studentData.is_lateral_entry ? " (Diploma Lateral Entry - 80 credits)" : " (Diploma Regular - 120 credits)"}
                  </p>
                  <div className="mt-2 text-xs">
                    <strong>Basket Requirements:</strong> {
                      studentData.is_lateral_entry
                        ? "Basket I: 0, Basket II: 5, Basket III: 12, Basket IV: 26, Basket V: 37"
                        : "Basket I: 12, Basket II: 13, Basket III: 20, Basket IV: 26, Basket V: 49"
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lateral Entry Student Alert (B.Tech only) */}
        {searchPerformed && !loading && registration !== "all" && studentData && studentData.is_lateral_entry && !studentData.is_diploma && (
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
              <strong>Search Completed:</strong><br />
              Department: {department || 'All'}<br />
              Batch: {batch || 'All'}<br />
              Basket: {basket || 'All'}<br />
              Results: {filteredAndSortedStudents.length} students found<br />
              {filteredAndSortedStudents.length > 0 && (
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
                    Total Students: <span className="font-medium">{filteredAndSortedStudents.length}</span>
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={downloadBulkReport}
                    disabled={isExporting}
                    className={`px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors flex items-center gap-1 ${isExporting ? 'opacity-70 cursor-not-allowed' : ''
                      }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {isExporting ? 'Downloading...' : 'Download Report'}
                  </button>
                  <button
                    onClick={exportToExcel}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                  >
                    Export Excel
                  </button>
                </div>
              </div>
            </div>

            {/* Data Source Summary */}
            {dataSources && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-semibold text-blue-800 mb-2">📊 Data Sources Used for Basket Calculation:</h4>
                <div className="flex flex-wrap gap-3">
                  {dataSources.sources.result && (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        Result Collection
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

            {/* FIXED: Enhanced Results Table with Dynamic Basket Columns */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300">
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900">Sl.No</th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900">Name</th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900">Registration No</th>
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900">Department</th>
                    {/* Dynamic Basket Columns - Show only selected basket or all if "All" is selected */}
                    {(!basket || basket === "All" || basket === "Select Basket" || basket === "") ? (
                      <>
                        <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">{isDiploma ? "Basket I (12/0)" : "Basket I (17/6)"}</th>
                        <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">{isDiploma ? "Basket II (13/5)" : "Basket II (12/9)"}</th>
                        <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">{isDiploma ? "Basket III (20/12)" : "Basket III (25)"}</th>
                        <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">{isDiploma ? "Basket IV (26/26)" : `Basket IV (${is2024Onwards ? '60/48' : '58/48'})`}</th>
                        <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">{isDiploma ? "Basket V (49/37)" : `Basket V (${is2024Onwards ? '46/32' : '48/32'})`}</th>
                      </>
                    ) : (
                      <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">
                        {basket === "Basket I" ? (isDiploma ? "Basket I (12/0)" : "Basket I (17/6)") :
                          basket === "Basket II" ? (isDiploma ? "Basket II (13/5)" : "Basket II (12/9)") :
                            basket === "Basket III" ? (isDiploma ? "Basket III (20/12)" : "Basket III (25)") :
                              basket === "Basket IV" ? (isDiploma ? "Basket IV (26/26)" : `Basket IV (${is2024Onwards ? '60/48' : '58/48'})`) :
                                basket === "Basket V" ? (isDiploma ? "Basket V (49/37)" : `Basket V (${is2024Onwards ? '46/32' : '48/32'})`) : basket}
                      </th>
                    )}
                    <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">{isDiploma ? 'Total Credits (120/80)' : 'Total Credits (160/120)'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedStudents.map((student, index) => (
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
                      {/* Dynamic Basket Columns - Show only selected basket or all if "All" is selected */}
                      {(!basket || basket === "All" || basket === "Select Basket" || basket === "") ? (
                        <>
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
                        </>
                      ) : (
                        <td
                          className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center cursor-pointer hover:bg-blue-50 text-blue-600 hover:text-blue-800 font-medium transition-colors"
                          onClick={() => {
                            const basketNum = basket === "Basket I" ? "I" :
                              basket === "Basket II" ? "II" :
                                basket === "Basket III" ? "III" :
                                  basket === "Basket IV" ? "IV" :
                                    basket === "Basket V" ? "V" : "";
                            if (basketNum) handleBulkBasketClick(student, basketNum);
                          }}
                          title={`Click to view ${basket} details`}
                        >
                          {basket === "Basket I" ? (student.basketI || student.basket1 || 0) :
                            basket === "Basket II" ? (student.basketII || student.basket2 || 0) :
                              basket === "Basket III" ? (student.basketIII || student.basket3 || 0) :
                                basket === "Basket IV" ? (student.basketIV || student.basket4 || 0) :
                                  basket === "Basket V" ? (student.basketV || student.basket5 || 0) : 0}
                        </td>
                      )}
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 text-center font-semibold bg-gray-50">
                        {student.totalCredits || student.total || 0}
                        {student.is_lateral_entry && (
                          <div className="text-xs text-orange-600 mt-1">
                            /{student.totalRequiredCredits || (isDiploma ? 80 : 120)}
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
                    onClick={downloadReport}
                    className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Report
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
              {studentData.is_lateral_entry && !studentData.is_diploma && (
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
                              {dataSources.sources.result && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                  Result ({dataSources.resultRecords} records)
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
                            {studentData.overall_stats?.total_required_credits || (studentData.is_diploma ? (studentData.is_lateral_entry ? 80 : 120) : (studentData.is_lateral_entry ? 120 : 160))} credits
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
                      <span className="px-2 py-1 rounded bg-gray-100 text-gray-800 font-medium">Result</span>
                      <span className="text-gray-600">Result Database</span>
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
                          const totalCredits = earnedCredits + failedCredits; // earned + failed per basket row
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
                                <span className={`px-2 py-1 rounded text-xs font-medium ${isCompleted
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
                            {studentData.is_diploma && studentData.is_lateral_entry ? 80 : (studentData.is_lateral_entry ? 120 : overallStats.totalRequired)}
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
                            {/* Total status is "Completed" ONLY when ALL individual baskets are completed */}
                            {(() => {
                              const allBasketsCompleted = overallStats.basketsCompleted === overallStats.totalBaskets && overallStats.totalBaskets > 0;
                              console.log('✅ Total Status Render:', {
                                basketsCompleted: overallStats.basketsCompleted,
                                totalBaskets: overallStats.totalBaskets,
                                allBasketsCompleted,
                                willShow: allBasketsCompleted ? '✅ Completed' : '❌ Not Completed'
                              });
                              return (
                                <span className={`px-2 py-1 rounded text-xs font-medium ${allBasketsCompleted
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                                  }`}>
                                  {allBasketsCompleted ? "Completed" : "Not Completed"}
                                </span>
                              );
                            })()}
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
              <div className="p-5 overflow-y-auto max-h-[70vh]">
                {/* Basket Summary */}
                <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
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
                      <span className="font-semibold text-gray-700">Total Credits:</span>
                      <span className="ml-2 text-gray-900 font-semibold">{(Number(selectedBasket.info?.earned_credits) || 0) + (Number(selectedBasket.info?.failed_credits) || 0)}</span>
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
                      {sortedBasketSubjects.length > 0 ? (
                        sortedBasketSubjects.map((subject, index) => (
                          <tr key={`${subject.code}-${index}`} className="hover:bg-gray-50 transition-colors">
                            <td className="border border-gray-300 px-3 py-2 text-center text-gray-900">{index + 1}</td>
                            <td className="border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900">{subject.code || 'N/A'}</td>
                            <td className="border border-gray-300 px-3 py-2 text-gray-900">{subject.name || 'Unknown Subject'}</td>
                            <td className="border border-gray-300 px-3 py-2 text-center text-gray-900">{subject.credits || 0}</td>
                            <td className="border border-gray-300 px-3 py-2 text-center">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${subject.grade === 'Result Not Published'
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
                                <span className={`px-2 py-1 rounded text-xs font-medium ${subject.status === 'Completed'
                                  ? 'bg-green-100 text-green-800'
                                  : subject.status === 'Failed'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-orange-100 text-orange-800'
                                  }`}>
                                  {subject.status || (subject.completed ? 'Completed' : 'Failed')}
                                </span>
                                {subject.dataSource && (
                                  <span className={`px-1 py-0.5 rounded text-xs font-medium ${subject.dataSource === 'Registration'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                                    }`}>
                                    {subject.dataSource === 'Registration' ? 'Reg' : 'Result'}
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

        {searchPerformed && !loading && (registration === "all" || selectedRegistrations.length > 1) && allStudentsData.length === 0 && !error && (
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

export default function TeacherBasketProgressTracker() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading basket tracker...</p>
        </div>
      </div>
    }>
      <TeacherBasketProgressTrackerContent />
    </Suspense>
  );
}
