"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { appendSchoolParams, getSchoolAndCampus, getSchoolApiUrl } from "@/lib/api-helper";

// Helpers
const branchMapFull = {
  'CSE': 'Computer Science & Engineering (CSE)',
  'ECE': 'Electronics & Communication Engineering (ECE)',
  'EEE': 'Electrical & Electronics Engineering (EEE)',
  'Mechanical': 'Mechanical Engineering',
  'Civil': 'Civil Engineering',
  'AIML': 'CSE (AI & ML)',
  // Diploma mappings if needed for short code lookups
  'Diploma CSE': 'Diploma Computer Science',
  'Diploma Civil': 'Diploma Civil',
  'Diploma Electrical': 'Diploma Electrical',
  'Diploma Mechanical': 'Diploma Mechanical',
  'Diploma Automobile': 'Diploma Automobile',
  'Diploma Mining': 'Diploma Mining'
};

const shortBranchFromCode = {
  '1': 'Civil', '2': 'CSE', '3': 'ECE',
  '5': 'EEE', '6': 'Mechanical', '7': 'AIML'
};

function getFullBranchName(shortBranch) {
  return branchMapFull[shortBranch] || shortBranch || "";
}

// Unified Branch Map based on Index 5-7 (User Provided Source of Truth)
const regNoBranchMap = {
  // B.TECH (SOET)
  '111': 'Civil Engineering',
  '112': 'Computer Science & Engineering (CSE)',
  '113': 'Electronics & Communication Engineering (ECE)',
  '115': 'Electrical & Electronics Engineering (EEE)',
  '116': 'Mechanical Engineering',
  '117': 'CSE (AI & ML)',

  // DIPLOMA
  '711': 'Diploma Electrical',
  '712': 'Diploma Mechanical',
  '713': 'Diploma Civil',
  '714': 'Diploma Computer Science',
  '715': 'Diploma Automobile',
  '716': 'Diploma Mining'
};

function getBranchFromRegNo(regNo = "") {
  if (!regNo || regNo.length < 8) return "";

  // For B.Tech & Diploma, use index 5-7 (positions 5, 6, 7)
  const branchCode = regNo.slice(5, 8);
  if (regNoBranchMap[branchCode]) {
    return regNoBranchMap[branchCode];
  }

  // Fallback to old method (position 7) for backward compatibility
  const code = regNo.charAt(7);
  const short = shortBranchFromCode[code] || "";
  return short ? getFullBranchName(short) : "";
}

function deriveBatchFromReg(regNo = "") {
  if (!regNo || regNo.length < 2) return "";
  const yy = regNo.slice(0, 2);
  return `20${yy}`;
}

function pickBatch(preferredYear = "", regNo = "") {
  if (preferredYear && preferredYear !== "All") return preferredYear;
  return deriveBatchFromReg(regNo);
}

function BacklogContent() {
  const searchParams = useSearchParams();
  const [registration, setRegistration] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [branch, setBranch] = useState("");
  const [year, setYear] = useState("");
  const [regList, setRegList] = useState([]);
  const [regMode, setRegMode] = useState("manual");
  const [selectedReg, setSelectedReg] = useState("");
  const [subjectMode, setSubjectMode] = useState("manual");
  const [subjectList, setSubjectList] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resultsRendered, setResultsRendered] = useState(false);
  const loadRegsControllerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading backlog data...");
  const [sortBy, setSortBy] = useState("");
  const [filterGrade, setFilterGrade] = useState("");
  const formRef = useRef(null);
  const [studentSummary, setStudentSummary] = useState([]);
  const [showAllMode, setShowAllMode] = useState(false);
  const [selectedStudentInfo, setSelectedStudentInfo] = useState(null);
  const lastRegSearchedRef = useRef("");
  const [lastRegValue, setLastRegValue] = useState("");
  const summariesLoadedRef = useRef(false); // Track if summaries are already loaded to prevent re-loading

  // Dynamic Metadata for Diploma (SOVET)
  const [dynamicBatches, setDynamicBatches] = useState([]);
  const [dynamicBranches, setDynamicBranches] = useState([]);
  const [isSovet, setIsSovet] = useState(false);

  // Load Metadata for SOVET
  // Load Metadata for SOVET
  useEffect(() => {
    const { school: lsSchool } = getSchoolAndCampus();
    const urlSchool = searchParams.get('school');
    const school = urlSchool || lsSchool;

    /* Check if school is SOVET (case-insensitive) */
    if (school && school.toUpperCase() === 'SOVET') {
      setIsSovet(true);
      fetchMetadata(school);
    } else {
      setIsSovet(false);
      setDynamicBatches([]);
      setDynamicBranches([]);
    }
  }, [searchParams]);

  async function fetchMetadata(schoolOverride) {
    try {
      const campus = searchParams.get('campus');
      let query = "";
      if (schoolOverride) {
        query = `?school=${schoolOverride}`;
        if (campus) query += `&campus=${campus}`;
      } else {
        query = "";
      }

      // If query is constructed manually, use it. Otherwise use appendSchoolParams helper.
      const batchUrl = query ? `/api/metadata/batches${query}` : appendSchoolParams("/api/metadata/batches");
      const branchUrl = query ? `/api/metadata/departments${query}` : appendSchoolParams("/api/metadata/departments");

      // Batches
      const batchRes = await fetch(batchUrl);
      if (batchRes.ok) {
        const data = await batchRes.json();
        setDynamicBatches(data.batches || []);
      }

      // Branches
      const branchRes = await fetch(branchUrl);
      if (branchRes.ok) {
        const data = await branchRes.json();
        setDynamicBranches(data.departments || []);
      }
    } catch (e) {
    }
  }

  // CSV Export Function
  function exportCSV() {
    if (rows.length === 0) return;

    // Determine if this is a subject search
    const isSubjectSearchExport = !selectedReg && !registration && (selectedSubject || subjectCode);

    const headers = isSubjectSearchExport
      ? ["Name", "Registration No", "Branch", "Batch", "Subject Code", "Subject Name", "Semester", "Grade"]
      : ["Subject Code", "Subject Name", "Semester", "Grade"];

    const csvRows = rows.map(b => {
      const rowData = isSubjectSearchExport
        ? [
          b.Name || '',
          b.Reg_No || b.registration || '',
          b.Branch || '',
          b.Batch || '',
          b.Subject_Code || b.subject_code || '',
          b.Subject_Name || '',
          b.Sem || '',
          b.Grade || ''
        ]
        : [
          b.Subject_Code || b.subject_code || '',
          b.Subject_Name || '',
          b.Sem || '',
          b.Grade || ''
        ];

      return rowData.map(field => {
        const str = String(field).replace(/"/g, '""');
        return /[",\n]/.test(str) ? `"${str}"` : str;
      }).join(',');
    });

    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backlogs_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Export All Students Summary to Excel
  function exportAllStudentsSummaryToExcel() {
    if (!studentSummary || studentSummary.length === 0) {
      alert("No data available to export.");
      return;
    }

    try {
      const excelData = studentSummary.map((student, idx) => ({
        "S.No": idx + 1,
        "Name": student.Name || "",
        "Registration No": student.Reg_No || "",
        "Branch": student.Branch || "",
        "Batch": student.Batch || "",
        "Total Backlogs": student.TotalBacklogs || 0
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "All Students Summary");

      const colWidths = [
        { wch: 8 },   // S.No
        { wch: 30 },  // Name
        { wch: 18 },  // Registration No
        { wch: 35 },  // Branch
        { wch: 12 },  // Batch
        { wch: 18 }   // Total Backlogs
      ];
      ws['!cols'] = colWidths;

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `All_Students_Summary_${dateStr}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (error) {
      alert("Failed to export to Excel. Please try again.");
    }
  }

  // Export Branch-wise Summary to Excel
  function exportBranchWiseToExcel() {
    if (!branchWiseCounts || branchWiseCounts.length === 0) return;

    try {
      const excelData = branchWiseCounts.map((item, idx) => ({
        "S.No": idx + 1,
        "Batch & Branch": item.branch || "Unknown",
        "Number of Backlogs": item.count
      }));

      // Add total row
      excelData.push({
        "S.No": "",
        "Batch & Branch": "Total",
        "Number of Backlogs": subjectResultCount
      });

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Branch-wise Summary");

      const colWidths = [
        { wch: 8 },   // S.No
        { wch: 40 },  // Batch & Branch
        { wch: 20 }   // Number of Backlogs
      ];
      ws['!cols'] = colWidths;

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Branch_Wise_Backlog_Summary_${dateStr}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (error) {
      alert("Failed to export to Excel. Please try again.");
    }
  }

  // Download Branch-wise Summary Report (PDF)
  function downloadBranchWiseReport() {
    if (!branchWiseCounts || branchWiseCounts.length === 0) {
      alert("No data available to generate report.");
      return;
    }

    try {
      // Check if jsPDF is available
      if (typeof jsPDF === 'undefined') {
        alert("PDF library not loaded. Please refresh the page.");
        return;
      }

      const doc = new jsPDF();

      // Add title
      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text("Branch-wise Backlog Summary Report", 14, 20);

      // Add date and filters
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const dateStr = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      doc.text(`Generated on: ${dateStr}`, 14, 28);

      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const subjectText = `Subject: ${subjectNameDisplay || "N/A"} (${selectedSubject || subjectCode || "code"})`;
      doc.text(subjectText.substring(0, 90), 14, 35);
      doc.text(`Branch: ${branch || "All"} | Batch: ${year || "All"}`, 14, 41);

      // Prepare table data - ensure all values are strings/numbers
      const tableData = branchWiseCounts.map((item, idx) => [
        String(idx + 1),
        String(item.branch || "Unknown"),
        Number(item.count) || 0
      ]);

      // Add total row
      tableData.push(["", "Total", Number(subjectResultCount) || 0]);

      // Check if autoTable is available
      if (typeof doc.autoTable === 'undefined') {
        // Fallback: Create simple table without autoTable
        let yPos = 50;
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);

        // Headers
        doc.setFont(undefined, 'bold');
        doc.text("S.No", 14, yPos);
        doc.text("Batch & Branch", 25, yPos);
        doc.text("Number of Backlogs", 120, yPos);

        yPos += 8;
        doc.setFont(undefined, 'normal');

        tableData.forEach((row) => {
          if (yPos > 280) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(String(row[0]), 14, yPos);
          doc.text(String(row[1]).substring(0, 40), 25, yPos);
          doc.text(String(row[2]), 120, yPos);
          yPos += 7;
        });
      } else {
        // Use autoTable if available
        doc.autoTable({
          startY: 48,
          head: [["S.No", "Batch & Branch", "Number of Backlogs"]],
          body: tableData,
          theme: "striped",
          headStyles: {
            fillColor: [5, 163, 199],
            textColor: [255, 255, 255],
            fontStyle: "bold"
          },
          alternateRowStyles: {
            fillColor: [245, 247, 250]
          },
          styles: {
            fontSize: 9,
            cellPadding: 3
          },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 120 },
            2: { cellWidth: 50, halign: 'center' }
          }
        });
      }

      const dateStrFile = new Date().toISOString().split('T')[0];
      const filename = `Branch_Wise_Backlog_Summary_${dateStrFile}.pdf`;
      doc.save(filename);
    } catch (error) {
      alert(`Failed to generate report: ${error.message || "Unknown error"}`);
    }
  }

  // Export Detailed Subject Breakdown to Excel
  function exportDetailedSubjectBreakdownToExcel() {
    if (!detailedSubjectBreakdown || detailedSubjectBreakdown.length === 0) {
      alert("No data available to export.");
      return;
    }

    try {
      const excelData = detailedSubjectBreakdown.map((item, idx) => ({
        "S.No": idx + 1,
        "Batch": item.batch || "",
        "Branch": item.branch || "",
        "Subject Code": item.subjectCode || "",
        "Subject Name": item.subjectName || "",
        "Backlog Count": item.count || 0
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Subject Breakdown");

      const colWidths = [
        { wch: 8 },   // S.No
        { wch: 12 },  // Batch
        { wch: 35 },  // Branch
        { wch: 15 },  // Subject Code
        { wch: 40 },  // Subject Name
        { wch: 18 }   // Backlog Count
      ];
      ws['!cols'] = colWidths;

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Detailed_Subject_Breakdown_${dateStr}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (error) {
      alert("Failed to export to Excel. Please try again.");
    }
  }

  // Download Detailed Subject Breakdown Report (PDF)
  function downloadDetailedSubjectBreakdownReport() {
    if (!detailedSubjectBreakdown || detailedSubjectBreakdown.length === 0) {
      alert("No data available to generate report.");
      return;
    }

    try {
      if (typeof jsPDF === 'undefined') {
        alert("PDF library not loaded. Please refresh the page.");
        return;
      }

      const doc = new jsPDF();

      // Add title
      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text("Detailed Subject Breakdown Report", 14, 20);

      // Add date and filters
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const dateStr = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      doc.text(`Generated on: ${dateStr}`, 14, 28);

      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const subjectText = `Subject: ${subjectNameDisplay || "N/A"} (${selectedSubject || subjectCode || "code"})`;
      doc.text(subjectText.substring(0, 90), 14, 35);
      const batchFilter = year && year !== "All" ? year : "All";
      doc.text(`Branch: All | Batch: ${batchFilter} | Total Records: ${detailedSubjectBreakdown.length}`, 14, 41);

      // Prepare table data
      const tableData = detailedSubjectBreakdown.map((item, idx) => [
        String(idx + 1),
        String(item.batch || ""),
        String(item.branch || "").substring(0, 25),
        String(item.subjectCode || ""),
        String(item.subjectName || "").substring(0, 30),
        Number(item.count) || 0
      ]);

      // Use autoTable if available
      if (typeof doc.autoTable !== 'undefined') {
        doc.autoTable({
          startY: 48,
          head: [["S.No", "Batch", "Branch", "Subject Code", "Subject Name", "Backlog Count"]],
          body: tableData,
          theme: "striped",
          headStyles: {
            fillColor: [5, 163, 199],
            textColor: [255, 255, 255],
            fontStyle: "bold"
          },
          alternateRowStyles: {
            fillColor: [245, 247, 250]
          },
          styles: {
            fontSize: 7,
            cellPadding: 2
          },
          columnStyles: {
            0: { cellWidth: 15 },
            1: { cellWidth: 25 },
            2: { cellWidth: 40 },
            3: { cellWidth: 30 },
            4: { cellWidth: 50 },
            5: { cellWidth: 30, halign: 'center' }
          }
        });
      } else {
        // Fallback: Create simple table
        let yPos = 50;
        doc.setFontSize(7);
        doc.setTextColor(30, 41, 59);

        // Headers
        doc.setFont(undefined, 'bold');
        doc.text("S.No", 14, yPos);
        doc.text("Batch", 22, yPos);
        doc.text("Branch", 35, yPos);
        doc.text("Subject Code", 70, yPos);
        doc.text("Subject Name", 95, yPos);
        doc.text("Count", 150, yPos);

        yPos += 6;
        doc.setFont(undefined, 'normal');

        tableData.forEach((row) => {
          if (yPos > 280) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(String(row[0]), 14, yPos);
          doc.text(String(row[1]), 22, yPos);
          doc.text(String(row[2]), 35, yPos);
          doc.text(String(row[3]), 70, yPos);
          doc.text(String(row[4]), 95, yPos);
          doc.text(String(row[5]), 150, yPos);
          yPos += 6;
        });
      }

      const dateStrFile = new Date().toISOString().split('T')[0];
      const filename = `Detailed_Subject_Breakdown_${dateStrFile}.pdf`;
      doc.save(filename);
    } catch (error) {
      alert(`Failed to generate report: ${error.message || "Unknown error"}`);
    }
  }

  // Export Detailed Results to Excel
  function exportDetailedResultsToExcel() {
    if (filteredRows.length === 0) return;

    try {
      const excelData = filteredRows.map((row, idx) => {
        const branchName = row.Branch || getBranchFromRegNo(row.Reg_No || row.registration || "") || "Unknown";
        const fullBranchName = branchName.length <= 5 && branchName !== "AIML"
          ? getFullBranchName(branchName)
          : branchName;

        // Remove "Sem" prefix if already present in the data
        let semValue = String(row.Sem || "");
        if (semValue.toLowerCase().startsWith("sem")) {
          semValue = semValue.substring(3).trim();
        }
        if (semValue && !semValue.toLowerCase().startsWith("sem")) {
          semValue = `Sem ${semValue}`;
        }

        return {
          "S.No": idx + 1,
          "Name": row.Name || "",
          "Registration No": row.Reg_No || row.registration || "",
          "Branch": fullBranchName,
          "Batch": row.Batch || "",
          "Semester": semValue || "",
          "Grade": row.Grade || "",
          "Subject Code": row.Subject_Code || row.subject_code || "",
          "Subject Name": row.Subject_Name || ""
        };
      });

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Detailed Results");

      const colWidths = [
        { wch: 8 },   // S.No
        { wch: 25 },  // Name
        { wch: 18 },  // Registration No
        { wch: 30 },  // Branch
        { wch: 12 },  // Batch
        { wch: 12 },  // Semester
        { wch: 10 },  // Grade
        { wch: 15 },  // Subject Code
        { wch: 40 }   // Subject Name
      ];
      ws['!cols'] = colWidths;

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Detailed_Backlog_Results_${dateStr}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (error) {
      alert("Failed to export to Excel. Please try again.");
    }
  }

  // Download Detailed Results Report (PDF)
  function downloadDetailedResultsReport() {
    if (filteredRows.length === 0) {
      alert("No data available to generate report.");
      return;
    }

    try {
      // Check if jsPDF is available
      if (typeof jsPDF === 'undefined') {
        alert("PDF library not loaded. Please refresh the page.");
        return;
      }

      const doc = new jsPDF();

      // Add title
      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text("Detailed Backlog Results Report", 14, 20);

      // Add date and filters
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const dateStr = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      doc.text(`Generated on: ${dateStr}`, 14, 28);

      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const subjectText = `Subject: ${subjectNameDisplay || "N/A"} (${selectedSubject || subjectCode || "code"})`;
      doc.text(subjectText.substring(0, 90), 14, 35);
      doc.text(`Branch: ${branch || "All"} | Batch: ${year || "All"} | Total Records: ${filteredRows.length}`, 14, 41);

      // Prepare table data - ensure all values are strings
      const tableData = filteredRows.map((row, idx) => {
        const branchName = row.Branch || getBranchFromRegNo(row.Reg_No || row.registration || "") || "Unknown";
        const fullBranchName = branchName.length <= 5 && branchName !== "AIML"
          ? getFullBranchName(branchName)
          : branchName;

        // Remove "Sem" prefix if already present in the data
        let semValue = String(row.Sem || "");
        if (semValue.toLowerCase().startsWith("sem")) {
          semValue = semValue.substring(3).trim();
        }
        if (semValue && !semValue.toLowerCase().startsWith("sem")) {
          semValue = `Sem ${semValue}`;
        }

        return [
          String(idx + 1),
          String(row.Name || "").substring(0, 30),
          String(row.Reg_No || row.registration || ""),
          String(fullBranchName).substring(0, 25),
          String(row.Batch || ""),
          semValue || "",
          String(row.Grade || "")
        ];
      });

      // Check if autoTable is available
      if (typeof doc.autoTable === 'undefined') {
        // Fallback: Create simple table without autoTable
        let yPos = 50;
        doc.setFontSize(7);
        doc.setTextColor(30, 41, 59);

        // Headers
        doc.setFont(undefined, 'bold');
        doc.text("S.No", 14, yPos);
        doc.text("Name", 22, yPos);
        doc.text("Reg No", 50, yPos);
        doc.text("Branch", 75, yPos);
        doc.text("Batch", 110, yPos);
        doc.text("Sem", 125, yPos);
        doc.text("Grade", 140, yPos);

        yPos += 6;
        doc.setFont(undefined, 'normal');

        tableData.forEach((row) => {
          if (yPos > 280) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(String(row[0]), 14, yPos);
          doc.text(String(row[1]), 22, yPos);
          doc.text(String(row[2]), 50, yPos);
          doc.text(String(row[3]), 75, yPos);
          doc.text(String(row[4]), 110, yPos);
          doc.text(String(row[5]), 125, yPos);
          doc.text(String(row[6]), 140, yPos);
          yPos += 6;
        });
      } else {
        // Use autoTable if available
        doc.autoTable({
          startY: 48,
          head: [["S.No", "Name", "Registration No", "Branch", "Batch", "Semester", "Grade"]],
          body: tableData,
          theme: "striped",
          headStyles: {
            fillColor: [5, 163, 199],
            textColor: [255, 255, 255],
            fontStyle: "bold"
          },
          alternateRowStyles: {
            fillColor: [245, 247, 250]
          },
          styles: {
            fontSize: 7,
            cellPadding: 2
          },
          columnStyles: {
            0: { cellWidth: 15 },
            1: { cellWidth: 40 },
            2: { cellWidth: 30 },
            3: { cellWidth: 35 },
            4: { cellWidth: 20 },
            5: { cellWidth: 20 },
            6: { cellWidth: 20, halign: 'center' }
          }
        });
      }

      const dateStrFile = new Date().toISOString().split('T')[0];
      const filename = `Detailed_Backlog_Results_${dateStrFile}.pdf`;
      doc.save(filename);
    } catch (error) {
      alert(`Failed to generate report: ${error.message || "Unknown error"}`);
    }
  }

  async function search(e, overrideReg = null) {
    if (e && e.preventDefault) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Clear previous states in correct order
    setError("");
    setMessage("");
    setShowAllMode(false);
    setRows([]);
    setCount(0);

    // Set loading states
    setLoadingMessage("Loading backlog data...");
    setResultsRendered(false);
    setLoading(true);
    try {
      // Prioritize selectedReg if it's set (for "View Details" button clicks)
      // Otherwise use registration based on regMode
      const regValueRaw = overrideReg || selectedReg || (regMode === "list" ? selectedReg : registration);
      const regValue = (regValueRaw || "").trim();
      const regValueUpper = regValue.toUpperCase();
      setLastRegValue(regValueUpper);

      // Only reset selected student info when registration changes; set a fresh shell to avoid stale name
      let effectiveSelectedInfo = selectedStudentInfo;
      if (regValueUpper && regValueUpper !== lastRegSearchedRef.current) {
        const shell = {
          Reg_No: regValueUpper,
          Name: "",
          Branch: "",
          Batch: pickBatch(year, regValueUpper)
        };
        setSelectedStudentInfo(shell);
        effectiveSelectedInfo = shell;
      }
      lastRegSearchedRef.current = regValueUpper;
      let subjValue = subjectMode === "list" ? selectedSubject : subjectCode;
      if (String(subjValue || "").toUpperCase() === "ALL") {
        subjValue = "";
      }
      // Treat registration=ALL as allowAll
      let isAll = (!branch || branch === "All") && (!year || year === "All");
      if (!overrideReg && regMode === "list" && selectedReg === "ALL") {
        isAll = true;
        setShowAllMode(true);
        summariesLoadedRef.current = false; // Reset flag when explicitly selecting "ALL" to allow reload
      } else if (regValue) {
        setShowAllMode(false);
        summariesLoadedRef.current = false; // Reset flag when selecting specific student

        // Find student info for selected registration
        const studentInfo = studentSummary.find(s => (s.Reg_No || "").toUpperCase() === regValueUpper);
        if (studentInfo) {
          // Student info already has full branch name from summary fetching
          setSelectedStudentInfo((prev) => ({
            Reg_No: (studentInfo.Reg_No || regValueUpper || "").toUpperCase(),
            Name: studentInfo.Name || prev?.Name || "",
            Branch: studentInfo.Branch || prev?.Branch || "",
            Batch: studentInfo.Batch || prev?.Batch || pickBatch(year, regValueUpper)
          }));
        } else {
          // Try to extract branch from registration number if not found
          let extractedBranch = "";
          if (regValueUpper.length >= 8) {
            extractedBranch = getBranchFromRegNo(regValueUpper);
          }
          if (!extractedBranch && branch && branch !== "All") {
            extractedBranch = getFullBranchName(branch);
          }
          setSelectedStudentInfo({
            Reg_No: regValueUpper,
            Name: selectedStudentInfo?.Name || "",
            Branch: extractedBranch,
            Batch: selectedStudentInfo?.Batch || pickBatch(year, regValueUpper)
          });
        }
      }
      // Guard: avoid unfiltered query that could fetch whole data on first load
      if (!isAll && !regValue && !subjValue && !branch && !year) {
        setError("Please select Registration or provide Branch/Year or Subject");
        setLoading(false);
        return;
      }
      // Build minimal request body and let backend filter efficiently
      const body = regValue
        ? { registration: regValueUpper }
        : {
          subject_code: (subjValue || "").toUpperCase(),
          branch: branch || "",
          year: year || "",
          allowAll: isAll ? true : undefined
        };
      // Use AbortController to cancel previous slow requests
      if (search.controller) {
        try {
          search.controller.abort();
        } catch (err) {
          // Ignore abort errors
        }
      }

      const reqId = Date.now();
      search.requestId = reqId;
      search.controller = new AbortController();

      const backlogUrl = getSchoolApiUrl("backlogs");
      let res, data;

      try {
        res = await fetch(backlogUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: search.controller.signal,
          cache: "no-store",
          body: JSON.stringify(body)
        });

        data = await res.json();
      } catch (fetchErr) {
        // Check if this was an abort
        if (fetchErr.name === 'AbortError') {
          setLoading(false);
          return;
        }
        throw fetchErr;
      }

      // Check if this request is still the latest
      if (search.requestId !== reqId) {
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || "No backlog found");
      const list = data.backlogs || data.result || [];

      setRows(list);
      setCount(list.length);
      setMessage(data.message || "Results loaded");

      // Update student info from results or fetch student record (handles zero-backlog cases)
      if (regValue && (!effectiveSelectedInfo || !effectiveSelectedInfo.Name || !effectiveSelectedInfo.Batch)) {
        let studentBranch = "";
        let studentName = "";
        let studentBatch = "";

        // Prefer info already present in summary (works even when no backlog rows)
        const summaryInfo = studentSummary.find(
          (s) => (s.Reg_No || "").toUpperCase() === regValueUpper
        );
        if (summaryInfo) {
          studentName = summaryInfo.Name || studentName;
          studentBranch = summaryInfo.Branch || studentBranch;
          studentBatch = summaryInfo.Batch || studentBatch;
        }

        // Use first row if available
        if (list.length > 0) {
          const firstRow = list[0];
          studentBranch = studentBranch || firstRow.Branch || "";
          studentName = studentName || firstRow.Name || "";
          studentBatch = studentBatch || firstRow.Batch || pickBatch(year, regValueUpper);
        }

        // Branch override
        try {
          const overrideUrl = appendSchoolParams(`/api/branch-change?reg=${regValueUpper}`);
          const overrideRes = await fetch(overrideUrl);
          if (overrideRes.ok) {
            const overrideData = await overrideRes.json();
            if (overrideData.override) {
              studentBranch = overrideData.override;
            }
          }
        } catch { }

        // Normalize branch
        if (studentBranch && studentBranch.length <= 5 && studentBranch !== "AIML") {
          studentBranch = getFullBranchName(studentBranch);
        }

        // Derive branch if still missing
        if (!studentBranch) {
          studentBranch = getBranchFromRegNo(regValueUpper) || (branch && branch !== "All" ? getFullBranchName(branch) : "");
        }

        // If name or batch missing, fetch student record
        if (!studentName || !studentBatch) {
          try {
            const studentsUrl = getSchoolApiUrl("students");
            const studentRes = await fetch(studentsUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ registration: regValueUpper })
            });
            if (studentRes.ok) {
              const studentData = await studentRes.json();
              const record = (studentData.records && studentData.records[0]) || null;
              if (record) {
                if (!studentName) studentName = record.Name || "";
                if (!studentBranch && record.Branch) {
                  studentBranch = record.Branch.length <= 5 && record.Branch !== "AIML"
                    ? getFullBranchName(record.Branch)
                    : record.Branch;
                }
                if (!studentBatch) studentBatch = pickBatch(year, regValueUpper);
              }
            }
          } catch { }
        }

        setSelectedStudentInfo({
          Reg_No: regValueUpper,
          Name: studentName || "",
          Branch: studentBranch || "",
          Batch: studentBatch || pickBatch(year, regValueUpper)
        });
      }

      // Note: Loading will be hidden by useEffect after results are rendered
    } catch (err) {
      setError(err.message);
      setLoading(false); // Hide loading on error immediately
    }
  }

  useEffect(() => {
    formRef.current?.querySelector('input[name="registration"]')?.focus();
  }, []);

  // Hide loading after results are rendered
  useEffect(() => {
    // Only proceed if loading is active and resultsRendered flag indicates new results
    if (!loading || resultsRendered) return;

    if (rows.length > 0) {
      // Results have been set, now wait for React to render them
      const timeoutId = setTimeout(() => {
        setLoading(false);
        setResultsRendered(true);
      }, 150);

      return () => clearTimeout(timeoutId);
    } else if (message && rows.length === 0) {
      // No results case or empty result with message - hide loading after message is set
      const timeoutId = setTimeout(() => {
        setLoading(false);
        setResultsRendered(true);
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [rows, message, resultsRendered, loading]);

  // Keep student info in sync when summary data arrives with better details
  useEffect(() => {
    if (!selectedStudentInfo?.Reg_No) return;
    const summaryInfo = studentSummary.find(
      (s) => (s.Reg_No || "").toUpperCase() === selectedStudentInfo.Reg_No.toUpperCase()
    );
    if (!summaryInfo) return;
    const hasBetterName = summaryInfo.Name && !selectedStudentInfo.Name;
    const hasBetterBranch = summaryInfo.Branch && !selectedStudentInfo.Branch;
    const hasBetterBatch = summaryInfo.Batch && (!selectedStudentInfo.Batch || selectedStudentInfo.Batch === "All");
    if (hasBetterName || hasBetterBranch || hasBetterBatch) {
      setSelectedStudentInfo((prev) => ({
        Reg_No: (summaryInfo.Reg_No || prev?.Reg_No || "").toUpperCase(),
        Name: hasBetterName ? summaryInfo.Name : prev?.Name || "",
        Branch: hasBetterBranch ? summaryInfo.Branch : prev?.Branch || "",
        Batch: hasBetterBatch ? summaryInfo.Batch : prev?.Batch || ""
      }));
    }
  }, [studentSummary, selectedStudentInfo?.Reg_No, selectedStudentInfo?.Name, selectedStudentInfo?.Branch, selectedStudentInfo?.Batch]);

  // Clear student info when registration field is emptied
  useEffect(() => {
    if (!registration && regMode === "manual") {
      setSelectedStudentInfo(null);
      lastRegSearchedRef.current = "";
      setLastRegValue("");
    }
  }, [registration, regMode]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (regMode !== "list") {
          if (!cancelled) {
            setRegList([]);
            setSelectedReg("");
            setStudentSummary([]);
          }
          return;
        }
        if (!branch && !year) {
          if (!cancelled) {
            setRegList([]);
            setSelectedReg("");
            setStudentSummary([]);
          }
          return;
        }

        if (loadRegsControllerRef.current) {
          try { loadRegsControllerRef.current.abort(); } catch { }
        }
        loadRegsControllerRef.current = new AbortController();
        const baseBatchUrl = getSchoolApiUrl("batch");
        const batchUrl = baseBatchUrl.includes('?') ? `${baseBatchUrl}&mode=list` : `${baseBatchUrl}?mode=list`;
        const res = await fetch(batchUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: loadRegsControllerRef.current.signal,
          cache: "no-store",
          body: JSON.stringify({ branch, batch: year })
        });
        const data = await res.json();
        if (cancelled) return;

        if (res.ok) {
          const students = data.records || [];
          const list = students
            .map(r => (r.Reg_No || r.registration || "").toUpperCase())
            .filter(Boolean)
            .sort();
          const uniqueRegNos = Array.from(new Set(list));
          setRegList(uniqueRegNos);
          setSelectedReg("");

          // If not in "Show All" mode, stop here so registration list loads instantly
          if (!showAllMode) {
            if (!cancelled) {
              setStudentSummary([]);
              summariesLoadedRef.current = false;
            }
            return;
          }

          // Prevent re-loading summaries if already loaded (only reload if branch/year/regMode actually changed)
          // This is critical to prevent excessive MongoDB connections
          if (summariesLoadedRef.current && studentSummary.length > 0) {
            return; // Skip reloading if summaries already exist
          }

          // Show loading indicator for All Students Summary
          if (!cancelled) {
            setLoadingMessage("Loading All Students Summary...");
            setLoading(true);
          }

          // In Show All mode, build branch overrides and per-student backlog summary
          // OPTIMIZED: Use bulk API to get all backlog data in one request
          const MAX_STUDENTS = 5000; // Can handle much more with bulk API
          const studentsToProcess = uniqueRegNos.slice(0, MAX_STUDENTS);

          // branchOverrides map removed - using strict local detection instead
          const branchOverrides = new Map();

          // OPTIMIZED: Single bulk API call to get all backlog summaries
          try {
            const backlogUrl = getSchoolApiUrl("backlogs");
            const bulkBacklogRes = await fetch(backlogUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                bulkSummary: true,
                registrations: studentsToProcess
              })
            });

            if (cancelled) return;

            if (!bulkBacklogRes.ok) {
              throw new Error("Bulk backlog request failed");
            }

            const bulkBacklogData = await bulkBacklogRes.json();
            const backlogSummaries = bulkBacklogData.summaries || [];

            // Build summary map from bulk response
            const backlogMap = new Map();
            backlogSummaries.forEach(summary => {
              backlogMap.set(summary.Reg_No, summary);
            });

            // Merge with student data
            const summaries = studentsToProcess.map(regNo => {
              const backlogInfo = backlogMap.get(regNo) || { TotalBacklogs: 0, Name: "", Branch: "" };
              const studentInfo = students.find(s => (s.Reg_No || s.registration || "").toUpperCase() === regNo.toUpperCase());

              let studentBranch = "";
              if (branchOverrides.has(regNo.toUpperCase())) {
                studentBranch = branchOverrides.get(regNo.toUpperCase());
              } else if (studentInfo?.Branch) {
                studentBranch = studentInfo.Branch;
                if (studentBranch && studentBranch.length <= 5 && studentBranch !== "AIML") {
                  studentBranch = getFullBranchName(studentBranch);
                }
              } else if (backlogInfo.Branch) {
                studentBranch = backlogInfo.Branch;
                if (studentBranch && studentBranch.length <= 5 && studentBranch !== "AIML") {
                  studentBranch = getFullBranchName(studentBranch);
                }
              } else {
                const shortBranch = getBranchFromRegNo(regNo);
                if (shortBranch) {
                  studentBranch = getFullBranchName(shortBranch);
                }
              }

              if (!studentBranch && branch && branch !== "All") {
                studentBranch = getFullBranchName(branch);
              }

              let studentName = studentInfo?.Name || backlogInfo.Name || "";

              return {
                Reg_No: regNo,
                Name: studentName,
                Branch: studentBranch,
                Batch: studentInfo?.Batch || pickBatch(year, regNo),
                TotalBacklogs: backlogInfo.TotalBacklogs || 0
              };
            });

            if (!cancelled) {
              setStudentSummary(summaries);
              summariesLoadedRef.current = true;

              // Keep loading true briefly to allow React to render the summary table
              setTimeout(() => {
                setLoading(false);
              }, 200);
            }
          } catch (error) {
            // Fallback to empty summaries on error
            if (!cancelled) {
              const summaries = studentsToProcess.map(regNo => {
                const studentInfo = students.find(s => (s.Reg_No || s.registration || "").toUpperCase() === regNo.toUpperCase());
                const shortBranch = getBranchFromRegNo(regNo);
                const fallbackBranch = shortBranch ? getFullBranchName(shortBranch) : (branch && branch !== "All" ? getFullBranchName(branch) : "");

                return {
                  Reg_No: regNo,
                  Name: studentInfo?.Name || "",
                  Branch: branchOverrides.get(regNo.toUpperCase()) || studentInfo?.Branch || fallbackBranch,
                  Batch: studentInfo?.Batch || pickBatch(year, regNo),
                  TotalBacklogs: 0
                };
              });
              setStudentSummary(summaries);
              summariesLoadedRef.current = true;
              setLoading(false);
            }
          }
        } else if (!cancelled) {
          setRegList([]);
          setSelectedReg("");
          setStudentSummary([]);
        }
      } catch {
        if (!cancelled) {
          setRegList([]);
          setSelectedReg("");
          setStudentSummary([]);
          setLoading(false); // Hide loading on error
        }
      }
    };

    load();
    return () => {
      cancelled = true;
      if (loadRegsControllerRef.current) {
        try { loadRegsControllerRef.current.abort(); } catch { }
      }
    };
  }, [branch, year, regMode, showAllMode]);

  // Reset summaries and results when branch or year changes to force reload
  useEffect(() => {
    summariesLoadedRef.current = false;
    setStudentSummary([]);
    // Clear current results when filters change
    if (showAllMode) {
      setRows([]);
      setCount(0);
      setMessage("");
    }
  }, [branch, year]);

  useEffect(() => {
    if (regMode === "list" && selectedReg) {
      search();
    }
  }, [selectedReg, regMode]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (subjectMode !== "list") { if (!cancelled) setSubjectList([]); return; }
        const params = new URLSearchParams();
        if (branch) params.set("branch", branch);
        params.set("limit", "0");
        const baseUrl = getSchoolApiUrl("cbcs");
        const separator = baseUrl.includes('?') ? '&' : '?';
        const res = await fetch(baseUrl + separator + params.toString());
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          const items = data.items || [];
          const list = items.map(it => ({ code: it["Subject Code"] || it.SubjectCode, name: it.Subject_name || it.Subject_Name || "" })).filter(s => s.code);
          const uniq = Array.from(new Map(list.map(s => [s.code, s])).values());
          setSubjectList(uniq);
        } else {
          setSubjectList([]);
        }
      } catch {
        if (!cancelled) setSubjectList([]);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [subjectMode, branch]);

  const getFilteredRows = () => {
    let filtered = [...rows];
    if (filterGrade) {
      filtered = filtered.filter(b => b.Grade === filterGrade);
    }
    if (sortBy === "name") {
      filtered.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
    } else if (sortBy === "reg") {
      filtered.sort((a, b) => (a.Reg_No || a.registration || '').localeCompare(b.Reg_No || b.registration || ''));
    }
    return filtered;
  };

  const filteredRows = getFilteredRows();
  const uniqueGrades = Array.from(new Set(rows.map(r => r.Grade).filter(Boolean)));

  // Determine if this is a subject search (not registration search)
  const isSubjectSearch = !selectedReg && !registration && (selectedSubject || subjectCode);
  const subjectResultCount = isSubjectSearch ? filteredRows.length : 0;

  // Check if we should show branch-wise summary
  // Case 1: Subject search with branch=all and batch=all (show batch+branch combinations)
  // Case 2: Subject search with branch=all and specific batch selected (show branch-wise for that batch)
  const showBranchWiseSummary = isSubjectSearch &&
    (branch === "All" || branch === "" || !branch) &&
    filteredRows.length > 0;

  // Check if both batch and branch are "All" - then show batch+branch combinations
  const showBatchBranchCombinations = showBranchWiseSummary &&
    (year === "All" || year === "" || !year);

  // Show subject summary by batch when subject search with specific filters
  const showSubjectByBatchSummary = isSubjectSearch && filteredRows.length > 0;

  // Calculate branch-wise or batch+branch-wise backlog counts
  const branchWiseCounts = useMemo(() => {
    if (!showBranchWiseSummary) return [];

    const countMap = new Map();

    filteredRows.forEach(row => {
      const branchName = row.Branch || getBranchFromRegNo(row.Reg_No || row.registration || "") || "Unknown";
      const fullBranchName = branchName.length <= 5 && branchName !== "AIML"
        ? getFullBranchName(branchName)
        : branchName;

      // If both batch and branch are "All", group by batch+branch combination
      if (showBatchBranchCombinations) {
        const rowBatch = row.Batch || deriveBatchFromReg(row.Reg_No || row.registration || "") || "Unknown";
        const key = `${rowBatch} Batch ${fullBranchName}`;
        const currentCount = countMap.get(key) || 0;
        countMap.set(key, currentCount + 1);
      } else {
        // If only branch is "All" but batch is selected, group by branch only
        const currentCount = countMap.get(fullBranchName) || 0;
        countMap.set(fullBranchName, currentCount + 1);
      }
    });

    // Convert to array and sort by count (descending)
    return Array.from(countMap.entries())
      .map(([label, count]) => ({ branch: label, count }))
      .sort((a, b) => {
        // Sort by batch first (if batch+branch format), then by count
        const aBatch = a.branch.match(/^(\d{4})/)?.[1] || "";
        const bBatch = b.branch.match(/^(\d{4})/)?.[1] || "";
        if (aBatch && bBatch && aBatch !== bBatch) {
          return bBatch.localeCompare(aBatch); // Descending batch order
        }
        return b.count - a.count; // Then by count
      });
  }, [showBranchWiseSummary, showBatchBranchCombinations, filteredRows]);

  // Calculate subject summary by batch - shows subjects grouped by batch
  const subjectByBatchSummary = useMemo(() => {
    if (!showSubjectByBatchSummary) return [];

    const summaryMap = new Map();

    filteredRows.forEach(row => {
      const rowBatch = row.Batch || deriveBatchFromReg(row.Reg_No || row.registration || "") || "Unknown";
      const subjectCode = row.Subject_Code || row.subject_code || "Unknown";
      const subjectName = row.Subject_Name || "";

      const key = `${rowBatch}|${subjectCode}`;
      const existing = summaryMap.get(key) || {
        batch: rowBatch,
        subjectCode: subjectCode,
        subjectName: subjectName,
        count: 0
      };
      existing.count += 1;
      summaryMap.set(key, existing);
    });

    // Convert to array and sort by batch (descending), then by count
    return Array.from(summaryMap.values())
      .sort((a, b) => {
        if (a.batch !== b.batch) {
          return b.batch.localeCompare(a.batch);
        }
        return b.count - a.count;
      });
  }, [showSubjectByBatchSummary, filteredRows]);

  // Calculate detailed breakdown: Batch + Branch + Subject backlog counts
  // Show when: subject search AND (branch is "All" OR both branch and batch are "All")
  const detailedSubjectBreakdown = useMemo(() => {
    // Show breakdown when branch is "All" (regardless of batch selection)
    if (!showBranchWiseSummary || !isSubjectSearch) return [];

    const breakdownMap = new Map();

    filteredRows.forEach(row => {
      const branchName = row.Branch || getBranchFromRegNo(row.Reg_No || row.registration || "") || "Unknown";
      const fullBranchName = branchName.length <= 5 && branchName !== "AIML"
        ? getFullBranchName(branchName)
        : branchName;
      const rowBatch = row.Batch || deriveBatchFromReg(row.Reg_No || row.registration || "") || "Unknown";
      const subjectCode = row.Subject_Code || row.subject_code || "Unknown";
      const subjectName = row.Subject_Name || "";

      const key = `${rowBatch}|${fullBranchName}|${subjectCode}`;
      const existing = breakdownMap.get(key) || {
        batch: rowBatch,
        branch: fullBranchName,
        subjectCode: subjectCode,
        subjectName: subjectName,
        count: 0
      };
      existing.count += 1;
      breakdownMap.set(key, existing);
    });

    // Convert to array and sort
    return Array.from(breakdownMap.values())
      .sort((a, b) => {
        // Sort by batch (descending), then branch, then count
        if (a.batch !== b.batch) {
          return b.batch.localeCompare(a.batch);
        }
        if (a.branch !== b.branch) {
          return a.branch.localeCompare(b.branch);
        }
        return b.count - a.count;
      });
  }, [showBranchWiseSummary, isSubjectSearch, filteredRows]);
  const subjectNameDisplay = (() => {
    if (!isSubjectSearch) return "";
    const code = (selectedSubject || subjectCode || "").trim();
    const fromList = subjectList.find(s => s.code === code);
    if (fromList?.name) return fromList.name;
    const fromRows = filteredRows[0]?.Subject_Name || rows[0]?.Subject_Name;
    return fromRows || code || "Subject";
  })();

  return (
    <>
      <style jsx>{`
        @media print {
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      <div
        className="min-h-screen pb-10"
        style={{
          background: "linear-gradient(to bottom, #F5F8FA 0%, #E8F4F8 50%, #D1E9F6 100%)",
        }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-6 sm:pt-8 lg:pt-12">
          {/* Header */}
          <div className="mb-4 sm:mb-6 text-center">
            <h1
              className="text-2xl sm:text-3xl md:text-4xl font-black inline-flex items-center justify-center gap-2 sm:gap-3"
              style={{
                background: "linear-gradient(135deg, #05A3C7 0%, #04748F 50%, #023945 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Backlog Management
            </h1>
            <p className="text-[#5A6C7D] text-sm sm:text-base font-medium mt-2">
              Track and manage student backlogs
            </p>
          </div>

          {/* Search Forms */}
          <form ref={formRef} onSubmit={search} className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="rounded-xl sm:rounded-2xl border-2 bg-white p-3 sm:p-4 lg:p-5 shadow-lg" style={{ borderColor: "rgba(5,163,199,0.2)" }}>
              <h2 className="text-[#1A1F29] font-black mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base lg:text-lg">
                🔎 Search by Registration
              </h2>
              <div className="mb-2 sm:mb-3">
                <select
                  className="w-full rounded-lg sm:rounded-xl border-2 bg-white px-3 py-2 sm:py-2.5 text-sm sm:text-base text-[#1A1F29] font-medium outline-none focus:ring-4 focus:ring-[#05A3C7]/20 transition-all min-h-[44px]"
                  style={{ borderColor: "rgba(5,163,199,0.3)" }}
                  value={regMode}
                  onChange={e => setRegMode(e.target.value)}
                >
                  <option value="manual">Enter Manually</option>
                  <option value="list">Choose from List</option>
                </select>
              </div>
              {regMode === "manual" ? (
                <div className="flex flex-col gap-2 sm:gap-3">
                  <input
                    name="registration"
                    className="w-full rounded-lg sm:rounded-xl border-2 bg-white px-3 sm:px-4 py-2.5 sm:py-3 outline-none focus:ring-4 focus:ring-[#05A3C7]/20 text-[#1A1F29] font-medium transition-all text-sm sm:text-base min-h-[44px]"
                    style={{ borderColor: "rgba(5,163,199,0.3)" }}
                    placeholder="e.g., 220101130056"
                    value={registration}
                    onChange={e => setRegistration(e.target.value.toUpperCase())}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full rounded-lg sm:rounded-xl text-white font-black px-4 sm:px-5 py-3 sm:py-3.5 transition-all duration-300 hover:shadow-lg active:scale-95 text-sm sm:text-base min-h-[44px] ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    style={{
                      background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                    }}
                  >
                    {loading ? 'Loading...' : 'Search'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <select
                      className="w-full rounded-lg sm:rounded-xl border-2 bg-white px-3 py-2 sm:py-2.5 text-sm sm:text-base text-[#1A1F29] font-medium outline-none focus:ring-4 focus:ring-[#05A3C7]/20 transition-all min-h-[44px]"
                      style={{ borderColor: "rgba(5,163,199,0.3)" }}
                      value={year}
                      onChange={e => setYear(e.target.value)}
                    >
                      <option value="">Batch (Year)</option>
                      <option value="All">All</option>
                      {["2022", "2023", "2024", "2025"].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select
                      className="w-full rounded-lg sm:rounded-xl border-2 bg-white px-3 py-2 sm:py-2.5 text-sm sm:text-base text-[#1A1F29] font-medium outline-none focus:ring-4 focus:ring-[#05A3C7]/20 transition-all min-h-[44px]"
                      style={{ borderColor: "rgba(5,163,199,0.3)" }}
                      value={branch}
                      onChange={e => setBranch(e.target.value)}
                    >
                      <option value="">Branch</option>
                      <option value="All">All</option>
                      {isSovet ? (
                        <>
                          <option value="CSE">Computer Science Engineering</option>
                          <option value="Electrical Engineering (Diploma)">Electrical Engineering</option>
                          <option value="Mechanical">Mechanical Engineering</option>
                          <option value="Civil">Civil Engineering</option>
                          <option value="ME">Mining Engineering</option>
                          <option value="Automobile Engineering">Automobile Engineering</option>
                        </>
                      ) : (
                        <>
                          <option value="Civil">Civil</option>
                          <option value="CSE">CSE</option>
                          <option value="ECE">ECE</option>
                          <option value="EEE">EEE</option>
                          <option value="Mechanical">Mechanical</option>
                          <option value="AIML">AIML</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2 sm:gap-3">
                    <select
                      className="w-full rounded-lg sm:rounded-xl border-2 bg-white px-3 py-2 sm:py-2.5 text-sm sm:text-base text-[#1A1F29] font-medium outline-none focus:ring-4 focus:ring-[#05A3C7]/20 transition-all min-h-[44px]"
                      style={{ borderColor: "rgba(5,163,199,0.3)" }}
                      value={selectedReg}
                      onChange={e => setSelectedReg(e.target.value)}
                    >
                      <option value="">
                        {regList.length === 0
                          ? (branch && year ? "No students found" : "Select batch & branch")
                          : `Select Registration (${regList.length})`}
                      </option>
                      {/* Always offer an 'All' option for convenience */}
                      <option value="ALL">
                        {regList.length > 0
                          ? `All (${regList.length} students)`
                          : "All"}
                      </option>
                      {regList.map(r => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={!selectedReg || loading}
                      className="w-full rounded-lg sm:rounded-xl text-white font-black px-4 sm:px-5 py-3 sm:py-3.5 transition-all duration-300 hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base min-h-[44px]"
                      style={{
                        background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                      }}
                    >
                      {loading ? 'Loading...' : (selectedReg ? "Search" : "Select First")}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-xl sm:rounded-2xl border-2 bg-white p-3 sm:p-4 lg:p-5 shadow-lg" style={{ borderColor: "rgba(5,163,199,0.2)" }}>
              <h2 className="text-[#1A1F29] font-black mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base lg:text-lg">
                🎯 Search by Subject + Filters
              </h2>
              <div className="mb-2 sm:mb-3">
                <select
                  className="w-full rounded-lg sm:rounded-xl border-2 bg-white px-3 py-2 sm:py-2.5 text-sm sm:text-base text-[#1A1F29] font-medium outline-none focus:ring-4 focus:ring-[#05A3C7]/20 transition-all min-h-[44px]"
                  style={{ borderColor: "rgba(5,163,199,0.3)" }}
                  value={subjectMode}
                  onChange={e => setSubjectMode(e.target.value)}
                >
                  <option value="manual">Enter Subject Manually</option>
                  <option value="list">Choose Subject from List</option>
                </select>
              </div>
              <div className="space-y-2 sm:space-y-3">
                {subjectMode === "manual" ? (
                  <input
                    className="w-full rounded-lg sm:rounded-xl border-2 bg-white px-3 sm:px-4 py-2.5 sm:py-3 outline-none focus:ring-4 focus:ring-[#05A3C7]/20 text-[#1A1F29] font-medium transition-all text-sm sm:text-base min-h-[44px]"
                    style={{ borderColor: "rgba(5,163,199,0.3)" }}
                    placeholder="Subject code (e.g., CS101)"
                    value={subjectCode}
                    onChange={e => setSubjectCode(e.target.value.toUpperCase())}
                  />
                ) : (
                  <select
                    className="w-full rounded-lg sm:rounded-xl border-2 bg-white px-3 py-2 sm:py-2.5 text-sm sm:text-base text-[#1A1F29] font-medium outline-none focus:ring-4 focus:ring-[#05A3C7]/20 transition-all min-h-[44px]"
                    style={{ borderColor: "rgba(5,163,199,0.3)" }}
                    value={selectedSubject}
                    onChange={e => setSelectedSubject(e.target.value)}
                  >
                    <option value="">Select Subject from CBCS</option>
                    <option value="ALL">All</option>
                    {subjectList.map(s => <option key={s.code} value={s.code}>{`${s.code}${s.name ? ` — ${s.name}` : ''}`}</option>)}
                  </select>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <select
                    className="w-full rounded-lg sm:rounded-xl border-2 bg-white px-3 py-2 sm:py-2.5 text-sm sm:text-base text-[#1A1F29] font-medium outline-none focus:ring-4 focus:ring-[#05A3C7]/20 transition-all min-h-[44px]"
                    style={{ borderColor: "rgba(5,163,199,0.3)" }}
                    value={branch}
                    onChange={e => setBranch(e.target.value)}
                  >
                    <option value="">All Branches</option>
                    <option value="All">All</option>
                    {isSovet ? (
                      dynamicBranches.map(b => <option key={b} value={b}>{b}</option>)
                    ) : (
                      <>
                        <option value="Civil">Civil</option>
                        <option value="CSE">CSE</option>
                        <option value="ECE">ECE</option>
                        <option value="EEE">EEE</option>
                        <option value="Mechanical">Mechanical</option>
                        <option value="AIML">AIML</option>
                      </>
                    )}
                  </select>
                  <select
                    className="w-full rounded-lg sm:rounded-xl border-2 bg-white px-3 py-2 sm:py-2.5 text-sm sm:text-base text-[#1A1F29] font-medium outline-none focus:ring-4 focus:ring-[#05A3C7]/20 transition-all min-h-[44px]"
                    style={{ borderColor: "rgba(5,163,199,0.3)" }}
                    value={year}
                    onChange={e => setYear(e.target.value)}
                  >
                    <option value="">All Batches</option>
                    <option value="All">All</option>
                    {isSovet ? (
                      dynamicBatches.map(y => <option key={y} value={y}>{y}</option>)
                    ) : (
                      ["2020", "2021", "2022", "2023", "2024", "2025"].map(y => <option key={y} value={y}>{y}</option>)
                    )}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={search}
                  disabled={loading || (!subjectCode && !selectedSubject && !branch && !year)}
                  className={`w-full rounded-lg sm:rounded-xl text-white font-black px-4 sm:px-5 py-3 sm:py-3.5 transition-all duration-300 hover:shadow-lg active:scale-95 text-sm sm:text-base min-h-[44px] ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  style={{
                    background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                  }}
                >
                  {loading ? 'Loading...' : 'Search with Filters'}
                </button>
              </div>
            </div>
          </form>

          {/* Alerts */}
          {message && (
            <div className="mb-3 sm:mb-4 rounded-lg sm:rounded-xl border-2 border-green-200 bg-green-50 text-green-700 px-3 sm:px-4 py-2.5 sm:py-3 font-medium flex items-center gap-2 sm:gap-3 text-sm sm:text-base">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0">
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
              </svg>
              {message}
            </div>
          )}
          {error && (
            <div className="mb-3 sm:mb-4 rounded-lg sm:rounded-xl border-2 border-red-200 bg-red-50 text-red-700 px-3 sm:px-4 py-2.5 sm:py-3 font-medium flex items-center gap-2 sm:gap-3 text-sm sm:text-base">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {/* Subject search result count with filter context */}
          {isSubjectSearch && (
            <div className="mb-3 sm:mb-4 rounded-lg sm:rounded-xl border-2 border-[#05A3C7]/20 bg-[#05A3C7]/5 text-[#023945] px-3 sm:px-4 py-2.5 sm:py-3 font-semibold text-sm sm:text-base flex items-center gap-2 flex-wrap">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#05A3C7] text-white text-xs font-black">
                #
              </span>
              <span className="font-black text-[#05A3C7]">{subjectResultCount}</span>
              <span className="text-[#023945] font-medium">backlogs for</span>
              <span className="px-2 py-1 rounded-lg bg-white text-[#023945] font-bold border border-[#05A3C7]/30">
                {subjectNameDisplay} ({selectedSubject || subjectCode || "code"})
              </span>
              <span className="px-2 py-1 rounded-lg bg-white text-[#023945] font-semibold border border-[#05A3C7]/20">
                Branch: {branch || "All"}
              </span>
              <span className="px-2 py-1 rounded-lg bg-white text-[#023945] font-semibold border border-[#05A3C7]/20">
                Batch: {year || "All"}
              </span>
            </div>
          )}

          {/* Student Info Card - Show when specific student is selected */}
          {selectedStudentInfo && !showAllMode && (
            <div className="mb-4 sm:mb-6 rounded-xl sm:rounded-2xl border-2 bg-white p-4 sm:p-5 shadow-lg" style={{ borderColor: "rgba(5,163,199,0.2)" }}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <h3 className="text-[#1A1F29] font-black text-base sm:text-lg">Student Information</h3>
                <button
                  onClick={() => {
                    if (!selectedStudentInfo || rows.length === 0) {
                      alert("No data available to generate report.");
                      return;
                    }

                    try {
                      if (typeof jsPDF === 'undefined') {
                        alert("PDF library not loaded. Please refresh the page.");
                        return;
                      }

                      const doc = new jsPDF();

                      // Add title
                      doc.setFontSize(18);
                      doc.setTextColor(30, 41, 59);
                      doc.text("Student Backlog Report", 14, 20);

                      // Add student information
                      doc.setFontSize(12);
                      doc.setTextColor(5, 163, 199);
                      doc.text("Student Information", 14, 32);

                      doc.setFontSize(10);
                      doc.setTextColor(60, 60, 60);
                      let yPos = 40;
                      doc.text(`Name: ${selectedStudentInfo.Name || "N/A"}`, 14, yPos);
                      yPos += 7;
                      doc.text(`Registration Number: ${selectedStudentInfo.Reg_No || "N/A"}`, 14, yPos);
                      yPos += 7;
                      doc.text(`Branch: ${selectedStudentInfo.Branch || "N/A"}`, 14, yPos);
                      yPos += 7;
                      doc.text(`Batch: ${selectedStudentInfo.Batch || "N/A"}`, 14, yPos);
                      yPos += 7;
                      doc.text(`Total Backlogs: ${rows.length}`, 14, yPos);
                      yPos += 7;

                      // Add date
                      doc.setFontSize(9);
                      doc.setTextColor(100, 100, 100);
                      doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}`, 14, yPos + 5);

                      // Prepare table data
                      const tableData = rows.map((row, idx) => {
                        // Remove "Sem" prefix if already present
                        let semValue = String(row.Sem || "");
                        if (semValue.toLowerCase().startsWith("sem")) {
                          semValue = semValue.substring(3).trim();
                        }
                        if (semValue && !semValue.toLowerCase().startsWith("sem")) {
                          semValue = `Sem ${semValue}`;
                        }

                        return [
                          String(idx + 1),
                          String(row.Subject_Code || row.subject_code || ""),
                          String(row.Subject_Name || "").substring(0, 40),
                          semValue || "",
                          String(row.Grade || "")
                        ];
                      });

                      // Add table
                      if (typeof doc.autoTable !== 'undefined') {
                        doc.autoTable({
                          startY: yPos + 12,
                          head: [["S.No", "Subject Code", "Subject Name", "Semester", "Grade"]],
                          body: tableData,
                          theme: "striped",
                          headStyles: {
                            fillColor: [5, 163, 199],
                            textColor: [255, 255, 255],
                            fontStyle: "bold"
                          },
                          alternateRowStyles: {
                            fillColor: [245, 247, 250]
                          },
                          styles: {
                            fontSize: 9,
                            cellPadding: 3
                          },
                          columnStyles: {
                            0: { cellWidth: 15 },
                            1: { cellWidth: 30 },
                            2: { cellWidth: 80 },
                            3: { cellWidth: 25 },
                            4: { cellWidth: 20, halign: 'center' }
                          }
                        });
                      } else {
                        // Fallback: Create simple table
                        let tableY = yPos + 15;
                        doc.setFontSize(9);
                        doc.setTextColor(30, 41, 59);

                        // Headers
                        doc.setFont(undefined, 'bold');
                        doc.text("S.No", 14, tableY);
                        doc.text("Subject Code", 25, tableY);
                        doc.text("Subject Name", 55, tableY);
                        doc.text("Semester", 120, tableY);
                        doc.text("Grade", 150, tableY);

                        tableY += 7;
                        doc.setFont(undefined, 'normal');

                        tableData.forEach((row) => {
                          if (tableY > 280) {
                            doc.addPage();
                            tableY = 20;
                          }
                          doc.text(String(row[0]), 14, tableY);
                          doc.text(String(row[1]), 25, tableY);
                          doc.text(String(row[2]), 55, tableY);
                          doc.text(String(row[3]), 120, tableY);
                          doc.text(String(row[4]), 150, tableY);
                          tableY += 6;
                        });
                      }

                      const dateStr = new Date().toISOString().split('T')[0];
                      const filename = `Student_Backlog_Report_${selectedStudentInfo.Reg_No || "student"}_${dateStr}.pdf`;
                      doc.save(filename);
                    } catch (error) {
                      alert(`Failed to generate report: ${error.message || "Unknown error"}`);
                    }
                  }}
                  className="px-4 py-2 rounded-lg text-white font-bold text-sm hover:shadow-md transition-all flex items-center gap-2"
                  style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                >
                  <span>📄</span>
                  <span>Download Report (PDF)</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <div className="text-xs sm:text-sm text-[#5A6C7D] font-medium mb-1">Name</div>
                  <div className="text-sm sm:text-base text-[#1A1F29] font-bold">{selectedStudentInfo.Name || "-"}</div>
                </div>
                <div>
                  <div className="text-xs sm:text-sm text-[#5A6C7D] font-medium mb-1">Registration Number</div>
                  <div className="text-sm sm:text-base font-bold" style={{ color: "#05A3C7" }}>{selectedStudentInfo.Reg_No || "-"}</div>
                </div>
                <div>
                  <div className="text-xs sm:text-sm text-[#5A6C7D] font-medium mb-1">Branch</div>
                  <div className="text-sm sm:text-base text-[#1A1F29] font-bold">{selectedStudentInfo.Branch || "-"}</div>
                </div>
                <div>
                  <div className="text-xs sm:text-sm text-[#5A6C7D] font-medium mb-1">Batch</div>
                  <div className="text-sm sm:text-base text-[#1A1F29] font-bold">{selectedStudentInfo.Batch || "-"}</div>
                </div>
              </div>
            </div>
          )}

          {/* All Students Summary Table - Show when "All" is selected */}
          {showAllMode && studentSummary.length > 0 && (
            <div className="mb-4 sm:mb-6 rounded-xl sm:rounded-2xl border-2 bg-white shadow-lg" style={{ borderColor: "rgba(5,163,199,0.2)" }}>
              <div
                className="text-white px-3 sm:px-4 lg:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3"
                style={{
                  background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                }}
              >
                <h3 className="font-black text-sm sm:text-base lg:text-lg">All Students Summary ({studentSummary.length} students)</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportAllStudentsSummaryToExcel}
                    className="px-3 py-1.5 sm:py-2 rounded-lg bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors flex items-center gap-1.5 font-bold text-xs sm:text-sm min-h-[36px]"
                  >
                    <span className="text-base">📥</span>
                    <span className="hidden xs:inline">Export Excel</span>
                    <span className="xs:hidden">Excel</span>
                  </button>
                  <button
                    onClick={() => {
                      // Create table without Actions column
                      const tableRows = studentSummary.map((student, idx) => `
                      <tr>
                        <td>${idx + 1}</td>
                        <td>${student.Name || "-"}</td>
                        <td>${student.Reg_No || "-"}</td>
                        <td>${student.Branch || "-"}</td>
                        <td>${student.Batch || "-"}</td>
                        <td style="text-align: center;">${student.TotalBacklogs || 0}</td>
                      </tr>
                    `).join('');

                      const printWindow = window.open('', '_blank');
                      printWindow.document.write(`
                      <html>
                        <head>
                          <title>All Students Summary</title>
                          <style>
                            @media print {
                              @page { margin: 15mm; }
                              body { font-family: Arial, sans-serif; }
                              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                              th { background-color: #05A3C7; color: white; padding: 10px; text-align: left; font-weight: bold; }
                              td { padding: 8px; border: 1px solid #ddd; }
                              tr:nth-child(even) { background-color: #f5f5f5; }
                              .header { text-align: center; margin-bottom: 20px; }
                              .header h1 { color: #05A3C7; margin: 0; }
                              .header p { color: #666; margin: 5px 0; }
                            }
                            body { font-family: Arial, sans-serif; padding: 20px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th { background-color: #05A3C7; color: white; padding: 10px; text-align: left; font-weight: bold; }
                            td { padding: 8px; border: 1px solid #ddd; }
                            tr:nth-child(even) { background-color: #f5f5f5; }
                            .header { text-align: center; margin-bottom: 20px; }
                            .header h1 { color: #05A3C7; margin: 0; }
                            .header p { color: #666; margin: 5px 0; }
                          </style>
                        </head>
                        <body>
                          <div class="header">
                            <h1>All Students Summary</h1>
                            <p>Total Students: ${studentSummary.length}</p>
                            <p>Generated on: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            ${branch && branch !== "All" ? `<p>Branch: ${branch}</p>` : ''}
                            ${year && year !== "All" ? `<p>Batch: ${year}</p>` : ''}
            </div>
                          <table>
                            <thead>
                              <tr>
                                <th>S.No</th>
                                <th>Name</th>
                                <th>Registration No</th>
                                <th>Branch</th>
                                <th>Batch</th>
                                <th style="text-align: center;">Total Backlogs</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${tableRows}
                            </tbody>
                          </table>
                        </body>
                      </html>
                    `);
                      printWindow.document.close();
                      setTimeout(() => {
                        printWindow.print();
                      }, 250);
                    }}
                    className="px-3 py-1.5 sm:py-2 rounded-lg bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors flex items-center gap-1.5 font-bold text-xs sm:text-sm min-h-[36px]"
                  >
                    <span className="text-base">🖨️</span>
                    <span className="hidden xs:inline">Print</span>
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto" id="all-students-summary-table">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr style={{ background: "rgba(5,163,199,0.1)" }}>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left font-black text-xs uppercase">S.No</th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left font-black text-xs uppercase">Name</th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left font-black text-xs uppercase">Registration No</th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left font-black text-xs uppercase">Branch</th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-left font-black text-xs uppercase">Batch</th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-center font-black text-xs uppercase">Total Backlogs</th>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 text-center font-black text-xs uppercase no-print">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentSummary.map((student, idx) => (
                      <tr
                        key={student.Reg_No || idx}
                        className="border-t-2 border-[#05A3C7]/10 hover:bg-[#05A3C7]/5 transition-colors"
                      >
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-[#1A1F29] font-medium">{idx + 1}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-[#1A1F29] font-medium">{student.Name || "-"}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 font-bold" style={{ color: "#05A3C7" }}>{student.Reg_No}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-[#1A1F29] font-medium">{student.Branch || "-"}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-[#1A1F29] font-medium">{student.Batch || "-"}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-center font-bold text-[#1A1F29]">{student.TotalBacklogs}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-center no-print">
                          <button
                            onClick={() => {
                              setRegistration(student.Reg_No); // Use manual input state
                              setRegMode("manual"); // Switch to manual mode
                              setSelectedReg(""); // Clear list selection to avoid conflicts
                              setShowAllMode(false);
                              // Set student info immediately
                              setSelectedStudentInfo({
                                Reg_No: student.Reg_No,
                                Name: student.Name || "",
                                Branch: student.Branch || "",
                                Batch: student.Batch || ""
                              });
                              // Use specific reg override to avoid stale state in closure
                              search(null, student.Reg_No);
                            }}
                            className="px-3 py-1 rounded-lg text-white font-bold text-xs hover:shadow-md transition-all"
                            style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Filter and Sort */}
          {rows.length > 0 && !showAllMode && (
            <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
              <select
                className="w-full sm:w-auto rounded-lg border-2 bg-white px-3 py-2 sm:py-2.5 text-[#1A1F29] text-sm font-medium outline-none focus:ring-4 focus:ring-[#05A3C7]/20 transition-all min-h-[44px]"
                style={{ borderColor: "rgba(5,163,199,0.3)" }}
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
              >
                <option value="">Sort by...</option>
                <option value="name">Name</option>
                <option value="reg">Registration</option>
              </select>

              <select
                className="w-full sm:w-auto rounded-lg border-2 bg-white px-3 py-2 sm:py-2.5 text-[#1A1F29] text-sm font-medium outline-none focus:ring-4 focus:ring-[#05A3C7]/20 transition-all min-h-[44px]"
                style={{ borderColor: "rgba(5,163,199,0.3)" }}
                value={filterGrade}
                onChange={e => setFilterGrade(e.target.value)}
              >
                <option value="">All Grades</option>
                {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          )}


          {/* Results - Hide when in "All" mode */}
          {!showAllMode && (
            <div className="rounded-xl sm:rounded-2xl overflow-hidden border-2 bg-white shadow-lg" style={{ borderColor: "rgba(5,163,199,0.2)" }}>
              <div
                className="text-white px-3 sm:px-4 lg:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3"
                style={{
                  background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                }}
              >
                <span className="font-black text-sm sm:text-base lg:text-lg">Backlog Results</span>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm lg:text-base">
                  <span className="font-bold">{filteredRows.length} record{filteredRows.length === 1 ? "" : "s"}</span>
                  {count > 0 && !isSubjectSearch && (
                    <button
                      onClick={exportCSV}
                      className="px-3 py-1.5 sm:py-2 rounded-lg bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors flex items-center gap-1.5 font-bold min-h-[36px]"
                    >
                      <span className="text-base sm:text-lg">📥</span>
                      <span className="hidden xs:inline">Export CSV</span>
                      <span className="xs:hidden">Export</span>
                    </button>
                  )}
                </div>
              </div>

              {/* If subject search, show summary with branch-wise breakdown if applicable */}
              {isSubjectSearch ? (
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="rounded-xl border-2 border-[#05A3C7]/20 bg-[#05A3C7]/5 p-4 sm:p-5 flex flex-col gap-2">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#05A3C7] text-white font-black text-sm">
                        #
                      </span>
                      <div className="text-lg sm:text-xl font-black text-[#05A3C7]">{subjectResultCount} backlogs</div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm sm:text-base text-[#023945] font-semibold">
                      <span className="px-2 py-1 rounded-lg bg-white border border-[#05A3C7]/30">
                        Subject: {subjectNameDisplay} ({selectedSubject || subjectCode || "code"})
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-white border border-[#05A3C7]/20">
                        Branch: {branch || "All"}
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-white border border-[#05A3C7]/20">
                        Batch: {year || "All"}
                      </span>
                    </div>
                  </div>

                  {/* Subject by Batch Summary Table - Show when searching with specific filters */}
                  {showSubjectByBatchSummary && subjectByBatchSummary.length > 0 && !showBranchWiseSummary && (
                    <div className="rounded-xl border-2 border-[#05A3C7]/20 bg-white overflow-hidden">
                      <div
                        className="text-white px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3"
                        style={{
                          background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                        }}
                      >
                        <h3 className="font-black text-base sm:text-lg">
                          Subject Summary by Batch
                        </h3>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              // Export subject by batch summary to CSV
                              if (subjectByBatchSummary.length === 0) return;

                              const csvRows = [
                                ["Batch", "Subject Code", "Subject Name", "Backlog Count"]
                              ];

                              subjectByBatchSummary.forEach(item => {
                                csvRows.push([
                                  item.batch || "",
                                  item.subjectCode || "",
                                  item.subjectName || "",
                                  String(item.count || 0)
                                ]);
                              });

                              csvRows.push(["", "", "Total", String(subjectResultCount || 0)]);

                              const csvContent = csvRows.map(row =>
                                row.map(field => {
                                  const str = String(field).replace(/"/g, '""');
                                  return /[",\n]/.test(str) ? `"${str}"` : str;
                                }).join(',')
                              ).join('\n');

                              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                              const link = document.createElement('a');
                              const url = URL.createObjectURL(blob);
                              link.setAttribute('href', url);
                              link.setAttribute('download', `Subject_By_Batch_Summary_${new Date().toISOString().split('T')[0]}.csv`);
                              link.style.visibility = 'hidden';
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors flex items-center gap-1.5 font-bold text-xs sm:text-sm min-h-[36px]"
                          >
                            <span className="text-base">📥</span>
                            <span className="hidden xs:inline">Export CSV</span>
                            <span className="xs:hidden">CSV</span>
                          </button>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr style={{ background: "rgba(5,163,199,0.1)" }}>
                              <th className="px-4 py-3 text-left font-black text-xs uppercase">S.No</th>
                              <th className="px-4 py-3 text-left font-black text-xs uppercase">Batch</th>
                              <th className="px-4 py-3 text-left font-black text-xs uppercase">Subject Code</th>
                              <th className="px-4 py-3 text-left font-black text-xs uppercase">Subject Name</th>
                              <th className="px-4 py-3 text-center font-black text-xs uppercase">Backlog Count</th>
                            </tr>
                          </thead>
                          <tbody>
                            {subjectByBatchSummary.map((item, idx) => (
                              <tr
                                key={idx}
                                className="border-t-2 border-[#05A3C7]/10 hover:bg-[#05A3C7]/5 transition-colors"
                              >
                                <td className="px-4 py-3 text-[#1A1F29] font-medium">{idx + 1}</td>
                                <td className="px-4 py-3 text-[#1A1F29] font-bold">{item.batch || "-"}</td>
                                <td className="px-4 py-3 font-bold" style={{ color: "#05A3C7" }}>
                                  {item.subjectCode || "-"}
                                </td>
                                <td className="px-4 py-3 text-[#1A1F29] font-medium">{item.subjectName || "-"}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-[#05A3C7] text-white font-black text-base">
                                    {item.count}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            <tr className="border-t-2 border-[#05A3C7]/30 bg-[#05A3C7]/5">
                              <td colSpan={4} className="px-4 py-3 text-[#1A1F29] font-black text-base">Total</td>
                              <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-[#04748F] text-white font-black text-base">
                                  {subjectResultCount}
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Branch-wise Summary Table */}
                  {showBranchWiseSummary && branchWiseCounts.length > 0 && (
                    <div className="rounded-xl border-2 border-[#05A3C7]/20 bg-white overflow-hidden">
                      <div
                        className="text-white px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3"
                        style={{
                          background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                        }}
                      >
                        <h3 className="font-black text-base sm:text-lg">
                          {showBatchBranchCombinations
                            ? "Batch & Branch-wise Backlog Count"
                            : year && year !== "All"
                              ? `${year} Batch - Branch-wise Backlog Count`
                              : "Branch-wise Backlog Count"}
                        </h3>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={exportBranchWiseToExcel}
                            className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors flex items-center gap-1.5 font-bold text-xs sm:text-sm min-h-[36px]"
                          >
                            <span className="text-base">📥</span>
                            <span className="hidden xs:inline">Export Excel</span>
                            <span className="xs:hidden">Excel</span>
                          </button>
                          <button
                            onClick={downloadBranchWiseReport}
                            className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors flex items-center gap-1.5 font-bold text-xs sm:text-sm min-h-[36px]"
                          >
                            <span className="text-base">📄</span>
                            <span className="hidden xs:inline">Download PDF</span>
                            <span className="xs:hidden">PDF</span>
                          </button>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr style={{ background: "rgba(5,163,199,0.1)" }}>
                              <th className="px-4 py-3 text-left font-black text-xs uppercase">
                                {showBatchBranchCombinations ? "Batch & Branch" : "Branch"}
                              </th>
                              <th className="px-4 py-3 text-center font-black text-xs uppercase">Number of Backlogs</th>
                            </tr>
                          </thead>
                          <tbody>
                            {branchWiseCounts.map((item, idx) => (
                              <tr
                                key={idx}
                                className="border-t-2 border-[#05A3C7]/10 hover:bg-[#05A3C7]/5 transition-colors"
                              >
                                <td className="px-4 py-3 text-[#1A1F29] font-bold">
                                  {item.branch || "Unknown"}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-[#05A3C7] text-white font-black text-base">
                                    {item.count}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            <tr className="border-t-2 border-[#05A3C7]/30 bg-[#05A3C7]/5">
                              <td className="px-4 py-3 text-[#1A1F29] font-black text-base">Total</td>
                              <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-[#04748F] text-white font-black text-base">
                                  {subjectResultCount}
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Detailed Subject Breakdown Table - Shows Batch + Branch + Subject breakdown */}
                  {showBranchWiseSummary && detailedSubjectBreakdown.length > 0 && (
                    <div className="rounded-xl border-2 border-[#05A3C7]/20 bg-white overflow-hidden">
                      <div
                        className="text-white px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3"
                        style={{
                          background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                        }}
                      >
                        <h3 className="font-black text-base sm:text-lg">
                          Detailed Breakdown: Batch, Branch & Subject
                        </h3>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={exportDetailedSubjectBreakdownToExcel}
                            className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors flex items-center gap-1.5 font-bold text-xs sm:text-sm min-h-[36px]"
                          >
                            <span className="text-base">📥</span>
                            <span className="hidden xs:inline">Export Excel</span>
                            <span className="xs:hidden">Excel</span>
                          </button>
                          <button
                            onClick={downloadDetailedSubjectBreakdownReport}
                            className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors flex items-center gap-1.5 font-bold text-xs sm:text-sm min-h-[36px]"
                          >
                            <span className="text-base">📄</span>
                            <span className="hidden xs:inline">Download PDF</span>
                            <span className="xs:hidden">PDF</span>
                          </button>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr style={{ background: "rgba(5,163,199,0.1)" }}>
                              <th className="px-4 py-3 text-left font-black text-xs uppercase">S.No</th>
                              <th className="px-4 py-3 text-left font-black text-xs uppercase">Batch</th>
                              <th className="px-4 py-3 text-left font-black text-xs uppercase">Branch</th>
                              <th className="px-4 py-3 text-left font-black text-xs uppercase">Subject Code</th>
                              <th className="px-4 py-3 text-left font-black text-xs uppercase">Subject Name</th>
                              <th className="px-4 py-3 text-center font-black text-xs uppercase">Backlog Count</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailedSubjectBreakdown.map((item, idx) => (
                              <tr
                                key={idx}
                                className="border-t-2 border-[#05A3C7]/10 hover:bg-[#05A3C7]/5 transition-colors"
                              >
                                <td className="px-4 py-3 text-[#1A1F29] font-medium">{idx + 1}</td>
                                <td className="px-4 py-3 text-[#1A1F29] font-bold">{item.batch || "-"}</td>
                                <td className="px-4 py-3 text-[#1A1F29] font-medium">{item.branch || "-"}</td>
                                <td className="px-4 py-3 font-bold" style={{ color: "#05A3C7" }}>
                                  {item.subjectCode || "-"}
                                </td>
                                <td className="px-4 py-3 text-[#1A1F29] font-medium">{item.subjectName || "-"}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-[#05A3C7] text-white font-black text-base">
                                    {item.count}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            <tr className="border-t-2 border-[#05A3C7]/30 bg-[#05A3C7]/5">
                              <td colSpan={5} className="px-4 py-3 text-[#1A1F29] font-black text-base">Total</td>
                              <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-[#04748F] text-white font-black text-base">
                                  {subjectResultCount}
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Detailed Results Table */}
                  {filteredRows.length > 0 && (
                    <div className="rounded-xl border-2 border-[#05A3C7]/20 bg-white overflow-hidden">
                      <div
                        className="text-white px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3"
                        style={{
                          background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                        }}
                      >
                        <h3 className="font-black text-base sm:text-lg">Detailed Results ({filteredRows.length} records)</h3>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={exportDetailedResultsToExcel}
                            className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors flex items-center gap-1.5 font-bold text-xs sm:text-sm min-h-[36px]"
                          >
                            <span className="text-base">📥</span>
                            <span className="hidden xs:inline">Export Excel</span>
                            <span className="xs:hidden">Excel</span>
                          </button>
                          <button
                            onClick={downloadDetailedResultsReport}
                            className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors flex items-center gap-1.5 font-bold text-xs sm:text-sm min-h-[36px]"
                          >
                            <span className="text-base">📄</span>
                            <span className="hidden xs:inline">Download PDF</span>
                            <span className="xs:hidden">PDF</span>
                          </button>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr style={{ background: "rgba(5,163,199,0.1)" }}>
                              <th className="px-4 py-3 text-left font-black text-xs uppercase">Name</th>
                              <th className="px-4 py-3 text-left font-black text-xs uppercase">Registration No</th>
                              <th className="px-4 py-3 text-left font-black text-xs uppercase">Branch</th>
                              <th className="px-4 py-3 text-left font-black text-xs uppercase">Batch</th>
                              <th className="px-4 py-3 text-left font-black text-xs uppercase">Semester</th>
                              <th className="px-4 py-3 text-center font-black text-xs uppercase">Grade</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRows.map((row, idx) => {
                              const branchName = row.Branch || getBranchFromRegNo(row.Reg_No || row.registration || "") || "Unknown";
                              const fullBranchName = branchName.length <= 5 && branchName !== "AIML"
                                ? getFullBranchName(branchName)
                                : branchName;

                              // Remove "Sem" prefix if already present in the data
                              let semValue = String(row.Sem || "");
                              if (semValue.toLowerCase().startsWith("sem")) {
                                semValue = semValue.substring(3).trim();
                              }
                              if (semValue && !semValue.toLowerCase().startsWith("sem")) {
                                semValue = `Sem ${semValue}`;
                              }
                              if (!semValue) semValue = "-";

                              return (
                                <tr
                                  key={idx}
                                  className="border-t-2 border-[#05A3C7]/10 hover:bg-[#05A3C7]/5 transition-colors"
                                >
                                  <td className="px-4 py-3 text-[#1A1F29] font-medium">{row.Name || "-"}</td>
                                  <td className="px-4 py-3 font-bold" style={{ color: "#05A3C7" }}>
                                    {row.Reg_No || row.registration || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-[#1A1F29] font-medium">{fullBranchName}</td>
                                  <td className="px-4 py-3 text-[#1A1F29] font-medium">{row.Batch || "-"}</td>
                                  <td className="px-4 py-3 text-[#1A1F29] font-medium">{semValue}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                      {row.Grade || "-"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="block md:hidden">
                    {filteredRows.length === 0 ? (
                      <div className="px-3 py-8 sm:py-10 text-center text-[#5A6C7D] font-medium text-sm">
                        {rows.length === 0 ? "No backlog results" : "No results match filters"}
                      </div>
                    ) : (
                      <div className="divide-y-2 divide-[#05A3C7]/10">
                        {filteredRows.map((b, i) => (
                          <div key={i} className="p-3 sm:p-4 hover:bg-[#05A3C7]/5 active:bg-[#05A3C7]/10 transition-colors">
                            <div className="flex justify-between items-start gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-[#1A1F29] font-bold text-sm sm:text-base truncate">{b.Name || '-'}</div>
                                <div className="text-[#5A6C7D] text-xs sm:text-sm font-medium">{b.Reg_No || b.registration || '-'}</div>
                              </div>
                              <span className="px-2 sm:px-2.5 py-1 rounded-lg text-xs sm:text-sm font-bold bg-red-100 text-red-700 flex-shrink-0">
                                {b.Grade || '-'}
                              </span>
                            </div>
                            <div className="text-[#1A1F29] font-medium mb-2 text-xs sm:text-sm leading-snug">{b.Subject_Name || '-'}</div>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <code className="text-[#05A3C7] bg-[#05A3C7]/10 px-2 py-1 rounded font-bold">
                                {b.Subject_Code || b.subject_code}
                              </code>
                              <span className="px-2 py-1 rounded-full bg-[#05A3C7]/10 text-[#05A3C7] font-bold">
                                {(() => {
                                  let semValue = String(b.Sem || "");
                                  if (semValue.toLowerCase().startsWith("sem")) {
                                    semValue = semValue.substring(3).trim();
                                  }
                                  if (semValue && !semValue.toLowerCase().startsWith("sem")) {
                                    semValue = `Sem ${semValue}`;
                                  }
                                  return semValue || "-";
                                })()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr
                          className="text-white"
                          style={{
                            background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                          }}
                        >
                          {["Subject Code", "Subject Name", "Semester", "Grade"].map(h => (
                            <th key={h} className="px-4 py-3 text-left uppercase tracking-wider font-black text-xs whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-3 py-8 lg:py-10 text-center text-[#5A6C7D] font-medium">
                              {rows.length === 0 ? "No backlog results" : "No results match filters"}
                            </td>
                          </tr>
                        )}
                        {filteredRows.map((b, i) => (
                          <tr key={i} className="border-t-2 border-[#05A3C7]/10 hover:bg-[#05A3C7]/5 transition-colors">
                            {[b.Subject_Code || b.subject_code || '-', b.Subject_Name || '-', b.Sem || '-', b.Grade || '-'].map((val, idx2) => (
                              <td key={idx2} className="px-4 py-3 whitespace-nowrap text-[#1A1F29] font-medium">
                                {idx2 === 3 ? (
                                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 whitespace-nowrap">
                                    {val}
                                  </span>
                                ) : (
                                  val
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Loading Overlay */}
          {loading && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
              <div
                className="rounded-xl sm:rounded-2xl p-4 sm:p-6 flex items-center gap-3 shadow-2xl max-w-sm w-full"
                style={{
                  background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                }}
              >
                <div className="w-5 h-5 sm:w-6 sm:h-6 border-3 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0"></div>
                <span className="text-white font-bold text-sm sm:text-base">{loadingMessage}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminBacklogPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading backlog...</div>}>
      <BacklogContent />
    </Suspense>
  );
}
