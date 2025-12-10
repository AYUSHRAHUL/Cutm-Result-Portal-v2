"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

export default function UserBasketTrack() {
  const [user, setUser] = useState(null);
  const [registration, setRegistration] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [studentData, setStudentData] = useState(null);
  const [basketProgress, setBasketProgress] = useState({});
  const [autoFetched, setAutoFetched] = useState(false);
  
  // Basket detail state
  const [selectedBasket, setSelectedBasket] = useState(null);
  const [showBasketDetails, setShowBasketDetails] = useState(false);

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
          }
        }
      } catch (error) {
        // Error fetching user data
      }
    };

    fetchUserData();
  }, []);

  const fetchBasketProgress = useCallback(async () => {
    setError("");
    setLoading(true);
    setStudentData(null);
    setBasketProgress({});
    
    try {
      if (!registration || registration.trim().length < 6) {
        throw new Error("Please enter a valid registration number (minimum 6 characters)");
      }
      
      const requestBody = {
        department: "",
        batch: "", 
        registration: registration.trim().toUpperCase(), 
        semesters: [],
        basket: ""
      };
      
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
        } else if (res.status === 403) {
          throw new Error("Access denied. You can only view your own academic progress.");
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
    } catch (err) {
      setError(err.message);
      setStudentData(null);
      setBasketProgress({});
    } finally {
      setLoading(false);
    }
  }, [registration]);

  useEffect(() => {
    if (registration && registration.trim().length >= 6 && !autoFetched) {
      fetchBasketProgress();
      setAutoFetched(true);
    }
  }, [registration, autoFetched, fetchBasketProgress]);

  // Stats calculation with lateral entry support
  const overallStats = useMemo(() => {
    const entries = Object.values(basketProgress || {});
    // Always expect 5 baskets (Basket I, II, III, IV, V) for total calculation
    const expectedBaskets = ["Basket I", "Basket II", "Basket III", "Basket IV", "Basket V"];
    const totalBaskets = expectedBaskets.length; // Always 5
    
    // Calculate baskets completed using the EXACT same logic as individual rows: earned >= required
    // This must match the logic in the table row rendering (line ~559)
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
        // Basket not found = not completed
        basketStatuses[basketName] = { earnedCredits: 0, requiredCredits: 0, isCompleted: false };
      }
    });
    
    // Calculate totals from all baskets in basketProgress
    const totalEarned = entries.reduce((sum, b) => sum + (Number(b?.earned_credits) || 0), 0);
    const totalFailed = entries.reduce((sum, b) => sum + (Number(b?.failed_credits) || 0), 0);
    const totalCredits = totalEarned + totalFailed;
    
    // Check if student is lateral entry
    const isLateralEntry = studentData?.is_lateral_entry || false;
    const totalRequired = isLateralEntry ? 120 : 160;
    const percentage = Math.min(100, Math.round((totalEarned / totalRequired) * 100));
    
    return { totalBaskets, basketsCompleted, totalEarned, totalFailed, totalCredits, totalRequired, percentage, isLateralEntry };
  }, [basketProgress, studentData]);

  // Handle basket click for details
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

  // Export functions
  const exportToCSV = () => {
    if (!studentData || !basketProgress) return;
    
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
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `basket_progress_${registration}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadReport = () => {
    if (!studentData || !basketProgress) return;
    
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
                
                // Add empty rows with proper cell structure to maintain table format
                // Minimum 10 rows total (including Total row), so add empty rows if needed
                const minRows = 10; // Including Total row
                const currentSubjectCount = subjects.length;
                const emptyRowsNeeded = Math.max(0, minRows - currentSubjectCount - 1); // -1 for Total row
                
                const emptyRows = Array(emptyRowsNeeded).fill(null).map(() => {
                  const slNoCell = hasSlNo ? `<td style="text-align: center; padding: 5px;"></td>` : '';
                  return `
                    <tr>
                      ${slNoCell}
                      <td style="padding: 5px;"></td>
                      <td style="padding: 5px;"></td>
                      <td style="text-align: center; padding: 5px;"></td>
                      <td style="text-align: center; padding: 5px;"></td>
                      <td style="text-align: center; padding: 5px;"></td>
                      <td style="text-align: center; padding: 5px;"></td>
                      <td style="text-align: center; padding: 5px;"></td>
                      <td style="text-align: center; padding: 5px;"></td>
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
                    
                    <!-- Empty Rows with proper cell structure -->
                    ${emptyRows}
                    
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
              
              // Remove total row from individual semester tables (last Total row)
              const sem1TableWithoutTotal = sem1Table.html.replace(/<tr style="font-weight: bold; background-color: #E6F3FF;">[\s\S]*?Total[\s\S]*?<\/tr>\s*$/, '');
              const sem2TableWithoutTotal = sem2Table.html.replace(/<tr style="font-weight: bold; background-color: #E6F3FF;">[\s\S]*?Total[\s\S]*?<\/tr>\s*$/, '');
              
              result += `
                <tr>
                  <td colspan="${sem1Colspan}" style="width: 50%; vertical-align: top; padding: 0; border: 1px solid #000;">
                    <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                      ${sem1TableWithoutTotal}
                    </table>
                  </td>
                  <td colspan="${sem2Colspan}" style="width: 50%; vertical-align: top; padding: 0; border: 1px solid #000;">
                    <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                      ${sem2TableWithoutTotal}
                    </table>
                  </td>
                </tr>
              `;
              
              // Add both semester totals in one row (side-by-side) - no empty space
              result += `
                <tr>
                  <td colspan="${sem1Colspan}" style="padding: 0; border: 1px solid #000;">
                    <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                      <tr style="font-weight: bold; background-color: #E6F3FF;">
                        <td colspan="2" style="text-align: right; padding: 5px;">Total</td>
                        <td style="text-align: center; padding: 5px;">${sem1Table.totals.basket1}</td>
                        <td style="text-align: center; padding: 5px;">${sem1Table.totals.basket2}</td>
                        <td style="text-align: center; padding: 5px;">${sem1Table.totals.basket3}</td>
                        <td style="text-align: center; padding: 5px;">${sem1Table.totals.basket4}</td>
                        <td style="text-align: center; padding: 5px;">${sem1Table.totals.basket5}</td>
                        <td style="text-align: center; padding: 5px;">${sem1Table.totals.grandTotal}</td>
                      </tr>
                    </table>
                  </td>
                  <td colspan="${sem2Colspan}" style="padding: 0; border: 1px solid #000;">
                    <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                      <tr style="font-weight: bold; background-color: #E6F3FF;">
                        <td colspan="3" style="text-align: right; padding: 5px;">Total</td>
                        <td style="text-align: center; padding: 5px;">${sem2Table.totals.basket1}</td>
                        <td style="text-align: center; padding: 5px;">${sem2Table.totals.basket2}</td>
                        <td style="text-align: center; padding: 5px;">${sem2Table.totals.basket3}</td>
                        <td style="text-align: center; padding: 5px;">${sem2Table.totals.basket4}</td>
                        <td style="text-align: center; padding: 5px;">${sem2Table.totals.basket5}</td>
                        <td style="text-align: center; padding: 5px;">${sem2Table.totals.grandTotal}</td>
                      </tr>
                      <!-- 1st Year Total Credits Row (inside Sem 2 table, Subject column) -->
                      <tr style="font-weight: bold; background-color: #E6F3FF;">
                        <td colspan="3" style="text-align: left; padding: 5px; font-weight: bold;">1st Year Total Credits</td>
                        <td style="text-align: center; padding: 5px;">${firstYearTotals.basket1 || 0}</td>
                        <td style="text-align: center; padding: 5px;">${firstYearTotals.basket2 || 0}</td>
                        <td style="text-align: center; padding: 5px;">${firstYearTotals.basket3 || 0}</td>
                        <td style="text-align: center; padding: 5px;">${firstYearTotals.basket4 || 0}</td>
                        <td style="text-align: center; padding: 5px;">${firstYearTotals.basket5 || 0}</td>
                        <td style="text-align: center; padding: 5px;">${firstYearTotals.grandTotal || 0}</td>
                      </tr>
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
              
              // Remove total row from individual semester tables (last Total row)
              const sem3TableWithoutTotal = sem3Table.html.replace(/<tr style="font-weight: bold; background-color: #E6F3FF;">[\s\S]*?Total[\s\S]*?<\/tr>\s*$/, '');
              const sem4TableWithoutTotal = sem4Table.html.replace(/<tr style="font-weight: bold; background-color: #E6F3FF;">[\s\S]*?Total[\s\S]*?<\/tr>\s*$/, '');
              
              result += `
                <tr>
                  <td colspan="${sem3Colspan}" style="width: 50%; vertical-align: top; padding: 0; border: 1px solid #000;">
                    <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                      ${sem3TableWithoutTotal}
                    </table>
                  </td>
                  <td colspan="${sem4Colspan}" style="width: 50%; vertical-align: top; padding: 0; border: 1px solid #000;">
                    <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                      ${sem4TableWithoutTotal}
                    </table>
                  </td>
                </tr>
              `;
              
              // Add both semester totals in one row (side-by-side) - no empty space
              result += `
                <tr>
                  <td colspan="${sem3Colspan}" style="padding: 0; border: 1px solid #000;">
                    <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                      <tr style="font-weight: bold; background-color: #E6F3FF;">
                        <td colspan="2" style="text-align: right; padding: 5px;">Total</td>
                        <td style="text-align: center; padding: 5px;">${sem3Table.totals.basket1}</td>
                        <td style="text-align: center; padding: 5px;">${sem3Table.totals.basket2}</td>
                        <td style="text-align: center; padding: 5px;">${sem3Table.totals.basket3}</td>
                        <td style="text-align: center; padding: 5px;">${sem3Table.totals.basket4}</td>
                        <td style="text-align: center; padding: 5px;">${sem3Table.totals.basket5}</td>
                        <td style="text-align: center; padding: 5px;">${sem3Table.totals.grandTotal}</td>
                      </tr>
                    </table>
                  </td>
                  <td colspan="${sem4Colspan}" style="padding: 0; border: 1px solid #000;">
                    <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                      <tr style="font-weight: bold; background-color: #E6F3FF;">
                        <td colspan="3" style="text-align: right; padding: 5px;">Total</td>
                        <td style="text-align: center; padding: 5px;">${sem4Table.totals.basket1}</td>
                        <td style="text-align: center; padding: 5px;">${sem4Table.totals.basket2}</td>
                        <td style="text-align: center; padding: 5px;">${sem4Table.totals.basket3}</td>
                        <td style="text-align: center; padding: 5px;">${sem4Table.totals.basket4}</td>
                        <td style="text-align: center; padding: 5px;">${sem4Table.totals.basket5}</td>
                        <td style="text-align: center; padding: 5px;">${sem4Table.totals.grandTotal}</td>
                      </tr>
                      <!-- 1st & 2nd Year Total Credits Row (inside Sem 4 table, Subject column) -->
                      <tr style="font-weight: bold; background-color: #E6F3FF;">
                        <td colspan="3" style="text-align: left; padding: 5px; font-weight: bold;">1st & 2nd Year Total Credits</td>
                        <td style="text-align: center; padding: 5px;">${secondYearTotals.basket1 || 0}</td>
                        <td style="text-align: center; padding: 5px;">${secondYearTotals.basket2 || 0}</td>
                        <td style="text-align: center; padding: 5px;">${secondYearTotals.basket3 || 0}</td>
                        <td style="text-align: center; padding: 5px;">${secondYearTotals.basket4 || 0}</td>
                        <td style="text-align: center; padding: 5px;">${secondYearTotals.basket5 || 0}</td>
                        <td style="text-align: center; padding: 5px;">${secondYearTotals.grandTotal || 0}</td>
                      </tr>
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
                
                // Remove total row from individual semester tables (last Total row)
                const sem1TableWithoutTotal = sem1Table.html.replace(/<tr style="font-weight: bold; background-color: #E6F3FF;">[\s\S]*?Total[\s\S]*?<\/tr>\s*$/, '');
                const sem2TableWithoutTotal = sem2Table.html.replace(/<tr style="font-weight: bold; background-color: #E6F3FF;">[\s\S]*?Total[\s\S]*?<\/tr>\s*$/, '');
                
                result += `<tr><td colspan="9" style="height: 10px; border: 1px solid #000;"></td></tr>`;
                
                result += `
                  <tr>
                    <td colspan="${sem1Colspan}" style="width: 50%; vertical-align: top; padding: 0; border: 1px solid #000;">
                      <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                        ${sem1TableWithoutTotal}
                      </table>
                    </td>
                    <td colspan="${sem2Colspan}" style="width: 50%; vertical-align: top; padding: 0; border: 1px solid #000;">
                      <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                        ${sem2TableWithoutTotal}
                      </table>
                    </td>
                  </tr>
                `;
                
                // Add both semester totals in one row (side-by-side) - no empty space
                result += `
                  <tr>
                    <td colspan="${sem1Colspan}" style="padding: 0; border: 1px solid #000;">
                      <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                        <tr style="font-weight: bold; background-color: #E6F3FF;">
                          <td colspan="2" style="text-align: right; padding: 5px;">Total</td>
                          <td style="text-align: center; padding: 5px;">${sem1Table.totals.basket1}</td>
                          <td style="text-align: center; padding: 5px;">${sem1Table.totals.basket2}</td>
                          <td style="text-align: center; padding: 5px;">${sem1Table.totals.basket3}</td>
                          <td style="text-align: center; padding: 5px;">${sem1Table.totals.basket4}</td>
                          <td style="text-align: center; padding: 5px;">${sem1Table.totals.basket5}</td>
                          <td style="text-align: center; padding: 5px;">${sem1Table.totals.grandTotal}</td>
                        </tr>
                      </table>
                    </td>
                    <td colspan="${sem2Colspan}" style="padding: 0; border: 1px solid #000;">
                      <table border="1" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
                        <tr style="font-weight: bold; background-color: #E6F3FF;">
                          <td colspan="3" style="text-align: right; padding: 5px;">Total</td>
                          <td style="text-align: center; padding: 5px;">${sem2Table.totals.basket1}</td>
                          <td style="text-align: center; padding: 5px;">${sem2Table.totals.basket2}</td>
                          <td style="text-align: center; padding: 5px;">${sem2Table.totals.basket3}</td>
                          <td style="text-align: center; padding: 5px;">${sem2Table.totals.basket4}</td>
                          <td style="text-align: center; padding: 5px;">${sem2Table.totals.basket5}</td>
                          <td style="text-align: center; padding: 5px;">${sem2Table.totals.grandTotal}</td>
                        </tr>
                        ${sem1Num === 5 && sem2Num === 6 ? `
                        <!-- 1st, 2nd & 3rd year Total Credits Row (inside Sem 6 table, Subject column) -->
                        <tr style="font-weight: bold; background-color: #E6F3FF;">
                          <td colspan="3" style="text-align: left; padding: 5px; font-weight: bold;">1st, 2nd & 3rd year Total Credits</td>
                          <td style="text-align: center; padding: 5px;">${thirdYearTotals.basket1 || 0}</td>
                          <td style="text-align: center; padding: 5px;">${thirdYearTotals.basket2 || 0}</td>
                          <td style="text-align: center; padding: 5px;">${thirdYearTotals.basket3 || 0}</td>
                          <td style="text-align: center; padding: 5px;">${thirdYearTotals.basket4 || 0}</td>
                          <td style="text-align: center; padding: 5px;">${thirdYearTotals.basket5 || 0}</td>
                          <td style="text-align: center; padding: 5px;">${thirdYearTotals.grandTotal || 0}</td>
                        </tr>
                        ` : ''}
                        ${sem1Num === 7 && sem2Num === 8 ? `
                        <!-- 1st, 2nd, 3rd & 4th year Total Row (inside Sem 8 table, Subject column) -->
                        <tr style="font-weight: bold; background-color: #E6F3FF;">
                          <td colspan="3" style="text-align: left; padding: 5px; font-weight: bold;">1st, 2nd, 3rd & 4th year Total</td>
                          <td style="text-align: center; padding: 5px;">${fourthYearTotals.basket1 || 0}</td>
                          <td style="text-align: center; padding: 5px;">${fourthYearTotals.basket2 || 0}</td>
                          <td style="text-align: center; padding: 5px;">${fourthYearTotals.basket3 || 0}</td>
                          <td style="text-align: center; padding: 5px;">${fourthYearTotals.basket4 || 0}</td>
                          <td style="text-align: center; padding: 5px;">${fourthYearTotals.basket5 || 0}</td>
                          <td style="text-align: center; padding: 5px;">${fourthYearTotals.grandTotal || 0}</td>
                        </tr>
                        ` : ''}
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
    
    const blob = new Blob([htmlContent], { type: "application/vnd.ms-excel" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CBCS_Registration_${studentData.registration}_${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

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
            padding: 15mm 10mm 10mm 10mm;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 15mm 10mm 10mm 10mm;
          }
          /* Styling for print - Bigger and centered */
          .print-area {
            text-align: center !important;
            max-width: 100% !important;
            margin: 0 auto !important;
          }
          .print-area h1 { 
            font-size: 24px !important; 
            margin-bottom: 12px !important; 
            margin-top: 0 !important;
            text-align: center !important;
            font-weight: bold !important;
          }
          .print-area h3 { 
            font-size: 16px !important; 
            margin-bottom: 8px !important; 
            text-align: center !important;
          }
          .print-area h4 { 
            font-size: 14px !important; 
            margin-bottom: 6px !important; 
            text-align: center !important;
          }
          .print-area table { 
            font-size: 11px !important; 
            margin: 0 auto 10px auto !important; 
            border-collapse: collapse !important;
            width: 95% !important;
            text-align: center !important;
          }
          .print-area th, .print-area td { 
            padding: 6px 8px !important; 
            border: 1px solid #000 !important;
            text-align: center !important;
          }
          .print-area th {
            font-weight: bold !important;
            background-color: #f0f0f0 !important;
          }
          .print-area .mb-6 { 
            margin-bottom: 12px !important; 
          }
          .print-area .mb-4 { 
            margin-bottom: 10px !important; 
          }
          .print-area .p-6 { 
            padding: 15px !important; 
          }
          .print-area .px-6 { 
            padding-left: 15px !important; 
            padding-right: 15px !important; 
          }
          .print-area .py-4 { 
            padding-top: 10px !important; 
            padding-bottom: 10px !important; 
          }
          .print-area .py-3 { 
            padding-top: 8px !important; 
            padding-bottom: 8px !important; 
          }
          .print-area .text-3xl { 
            font-size: 22px !important; 
          }
          .print-area .text-lg { 
            font-size: 14px !important; 
          }
          .print-area .text-md { 
            font-size: 13px !important; 
          }
          .print-area .text-sm { 
            font-size: 11px !important; 
          }
          .print-area .text-xs { 
            font-size: 10px !important; 
          }
          /* Center all text content */
          .print-area > div {
            text-align: center !important;
          }
          .print-area .border {
            margin: 0 auto !important;
          }
          /* Remove backgrounds and shadows for print */
          .print-area .bg-gray-50,
          .print-area .bg-white,
          .print-area .bg-orange-50,
          .print-area .bg-orange-100 {
            background: white !important;
          }
          .print-area .shadow-sm,
          .print-area .shadow-lg {
            box-shadow: none !important;
          }
          /* Ensure tables fit on page */
          .print-area .overflow-x-auto {
            overflow: visible !important;
          }
          /* Hide decorative elements */
          .print-area svg {
            display: none !important;
          }
          .print-area .cursor-pointer {
            cursor: default !important;
          }
          /* Show print header */
          .print-area div[style*="display: none"] {
            display: block !important;
          }
          /* Print header styling */
          .print-area > div > h1:first-of-type {
            font-size: 18px !important;
            text-align: center !important;
            margin-bottom: 10px !important;
            margin-top: 0 !important;
          }
        }
      `}</style>

    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b no-print">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6 text-center">
              <h1 className="text-3xl font-bold text-gray-900">Basket Progress Tracker</h1>
              <p className="mt-1 text-sm text-gray-500">
                Track your CBCS basket completion progress
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
                <h3 className="text-sm font-medium text-red-800">Unable to load basket progress</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
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
              <div className="text-blue-800">Loading your basket progress...</div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && autoFetched && !studentData && (
          <div className="bg-white rounded-lg shadow-sm border p-6 text-center text-gray-600">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No basket data found</h3>
            <p className="text-sm">
              We couldn’t find any CBCS basket progress for registration <strong>{registration}</strong>.
              Please contact your department if you believe this is incorrect.
            </p>
          </div>
        )}

        {/* Basket Results */}
        {!loading && studentData && (
          <div className="bg-white rounded-lg shadow-sm border print-area">
            {/* Export Buttons */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 no-print">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Your Basket Progress</h3>
                <div className="flex flex-wrap gap-2 justify-end">
                  {/* <button 
                    onClick={exportToCSV} 
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                  >
                    Export CSV
                  </button> */}
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

            {/* Print Header - Only visible when printing */}
            <div className="text-center mb-4" style={{ display: 'none' }}>
              <h1 className="text-3xl font-bold text-gray-900">Basket Progress Tracker</h1>
              <p className="text-sm text-gray-600 mt-1">CBCS Basket Completion Progress</p>
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
                        You require <strong className="text-orange-900">120 total credits</strong> to complete your degree (instead of 160 for regular students).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Student Information Section */}
              <div className="mb-6">
                <h4 className="text-md font-semibold text-gray-800 mb-3">Student Information</h4>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs sm:text-sm">
                      <tbody>
                        <tr className="border-b border-gray-200">
                          <td className="px-4 py-3 font-semibold text-gray-700 bg-gray-50 w-1/3">Student:</td>
                          <td className="px-4 py-3 text-gray-900">
                            <div className="font-semibold text-base sm:text-lg">{studentData.name || 'Unknown'}</div>
                            <div className="text-xs sm:text-sm text-gray-600 mt-1">
                              Reg. No: <span className="font-mono">{studentData.registration || 'Unknown'}</span>
                            </div>
                          </td>
                        </tr>
                        <tr className="border-b border-gray-200">
                          <td className="px-4 py-3 font-semibold text-gray-700 bg-gray-50">Department:</td>
                          <td className="px-4 py-3 text-gray-900">{studentData.department || 'Unknown'}</td>
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
                          <td className="px-4 py-3 text-gray-900">All Semesters</td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>

              {/* Basket Progress Section */}
              <div>
                <h4 className="text-md font-semibold text-gray-800 mb-3">Basket Progress</h4>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[11px] sm:text-sm">
                    <thead>
                      <tr className="bg-gray-100 border-b-2 border-gray-300 text-[10px] sm:text-xs">
                        <th className="px-2 py-1 sm:px-4 sm:py-3 text-left font-semibold text-gray-900">Basket</th>
                        <th className="px-2 py-1 sm:px-4 sm:py-3 text-center font-semibold text-gray-900">Required Credits</th>
                        <th className="px-2 py-1 sm:px-4 sm:py-3 text-center font-semibold text-gray-900">Earned Credits</th>
                        <th className="px-2 py-1 sm:px-4 sm:py-3 text-center font-semibold text-gray-900">Failed Credits</th>
                        <th className="px-2 py-1 sm:px-4 sm:py-3 text-center font-semibold text-gray-900">Total Credits</th>
                        <th className="px-2 py-1 sm:px-4 sm:py-3 text-center font-semibold text-gray-900">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(basketProgress || {}).length > 0 ? (
                        Object.entries(basketProgress).map(([basketName, info], index) => {
                          const earnedCredits = Number(info?.earned_credits) || 0;
                          const failedCredits = Number(info?.failed_credits) || 0;
                          const totalCredits = earnedCredits + failedCredits;
                          const requiredCredits = Number(info?.required_credits) || 0;
                          const isCompleted = earnedCredits >= requiredCredits && requiredCredits > 0;
                          const status = isCompleted ? "Completed" : "Not Completed";

                          return (
                            <tr key={basketName} className="border-b border-gray-200 hover:bg-gray-50 transition-colors text-[11px] sm:text-sm">
                              <td 
                                className="px-2 py-1 sm:px-4 sm:py-3 cursor-pointer hover:bg-blue-50 text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                onClick={() => handleBasketClick(basketName, info)}
                                title="Click to view detailed subjects"
                              >
                                {basketName} 📋
                              </td>
                              <td className="px-2 py-1 sm:px-4 sm:py-3 text-center text-gray-900">{requiredCredits}</td>
                              <td className="px-2 py-1 sm:px-4 sm:py-3 text-center text-green-600 font-medium">{earnedCredits}</td>
                              <td className="px-2 py-1 sm:px-4 sm:py-3 text-center text-red-600 font-medium">{failedCredits}</td>
                              <td className="px-2 py-1 sm:px-4 sm:py-3 text-center text-gray-900 font-semibold">{totalCredits}</td>
                              <td className="px-2 py-1 sm:px-4 sm:py-3 text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${
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
                            No basket progress data available
                          </td>
                        </tr>
                      )}
                      
                      {Object.entries(basketProgress || {}).length > 0 && (
                        <tr className="bg-gray-50 border-t-2 border-gray-300 text-[11px] sm:text-sm">
                          <td className="px-2 py-1 sm:px-4 sm:py-3 font-semibold text-center text-gray-900">
                            {overallStats.isLateralEntry ? "Lateral Entry Total" : "Total"}
                          </td>
                          <td className="px-2 py-1 sm:px-4 sm:py-3 text-center font-semibold text-gray-900">
                            {overallStats.totalRequired}
                            {overallStats.isLateralEntry && (
                              <div className="text-xs text-orange-600 mt-1">Lateral Entry</div>
                            )}
                          </td>
                          <td className="px-2 py-1 sm:px-4 sm:py-3 text-center font-semibold text-green-600">{overallStats.totalEarned}</td>
                          <td className="px-2 py-1 sm:px-4 sm:py-3 text-center font-semibold text-red-600">{overallStats.totalFailed}</td>
                          <td className="px-2 py-1 sm:px-4 sm:py-3 text-center font-semibold text-gray-900">{overallStats.totalCredits}</td>
                          <td className="px-2 py-1 sm:px-4 sm:py-3 text-center">
                            {/* Total status is "Completed" ONLY when ALL individual baskets are completed */}
                            {(() => {
                              // CRITICAL: Check if ALL baskets are completed
                              // basketsCompleted must equal totalBaskets (5) for status to be "Completed"
                              const allBasketsCompleted = overallStats.basketsCompleted === overallStats.totalBaskets && overallStats.totalBaskets > 0;
                              
                              return (
                            <span className={`px-2 py-1 rounded text-[10px] sm:text-xs font-medium ${
                                  allBasketsCompleted
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                                  {allBasketsCompleted ? "Completed" : "Not Completed"}
                            </span>
                              );
                            })()}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Basket Details Modal */}
        {showBasketDetails && selectedBasket && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 no-print">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {selectedBasket.name} - Subject Details
                  </h3>
                  <button
                    onClick={closeBasketDetails}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="mb-4">
                  <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Required Credits:</span>
                      <span className="ml-2 text-gray-900">{selectedBasket.info?.required_credits || 0}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Earned Credits:</span>
                      <span className="ml-2 text-green-600 font-medium">{selectedBasket.info?.earned_credits || 0}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Failed Credits:</span>
                      <span className="ml-2 text-red-600 font-medium">{selectedBasket.info?.failed_credits || 0}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Total Credits:</span>
                      <span className="ml-2 text-gray-900 font-semibold">
                        {selectedBasket.info?.earned_credits || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedBasket.subjects && selectedBasket.subjects.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 sm:px-4 sm:py-3 text-left font-medium text-gray-700">Subject Code</th>
                          <th className="px-3 py-2 sm:px-4 sm:py-3 text-left font-medium text-gray-700">Subject Name</th>
                            <th className="px-3 py-2 sm:px-4 sm:py-3 text-center font-medium text-gray-700">Credits</th>
                            <th className="px-3 py-2 sm:px-4 sm:py-3 text-center font-medium text-gray-700">Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBasket.subjects.map((subject, index) => {
                          const grade = String(subject?.grade || subject?.Grade || "").toUpperCase();
                          return (
                            <tr key={index} className="border-t">
                              <td className="px-3 py-2 sm:px-4 sm:py-3 text-gray-900">{subject.code}</td>
                              <td className="px-3 py-2 sm:px-4 sm:py-3 text-gray-900 whitespace-normal break-words">{subject.name}</td>
                              <td className="px-3 py-2 sm:px-4 sm:py-3 text-center text-gray-900">{subject.credits}</td>
                              <td className="px-3 py-2 sm:px-4 sm:py-3 text-center">
                                <span className={`px-2 py-1 rounded text-[10px] sm:text-xs font-medium ${
                                  grade === 'RESULT NOT PUBLISHED'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : ["O","E","A"].includes(grade) ? 'bg-green-100 text-green-800' :
                                    ["B","C","D"].includes(grade) ? 'bg-blue-100 text-blue-800' :
                                    'bg-red-100 text-red-800'
                                }`}>
                                  {grade || '—'}
                                </span>
                              </td>
                                
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No subject details available for this basket
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={closeBasketDetails}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
