"use client";

import { useEffect, useState, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getSchoolApiUrl, appendSchoolParams } from "@/lib/api-helper";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid
} from "recharts";
import * as XLSX from "xlsx-js-style";
import jsPDF from "jspdf";
import "jspdf-autotable";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

function PlacementManagementContent() {
  const searchParams = useSearchParams();
  const school = searchParams.get('school') || 'som';
  const campus = searchParams.get('campus') || 'pkd';

  const [activeTab, setActiveTab] = useState('data');

  const [placements, setPlacements] = useState([]);
  const [filterMeta, setFilterMeta] = useState({ batches: [], branches: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Advanced filtering and search
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    batch: '',
    branch: '',
    minPackage: '',
    maxPackage: ''
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Sorting
  const [sortField, setSortField] = useState('regNo');
  const [sortDirection, setSortDirection] = useState('asc');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState([]);

  // Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlacement, setEditingPlacement] = useState(null);
  const [formData, setFormData] = useState({
    batch: '',
    branch: '',
    regNo: '',
    name: '',
    companyName: '',
    package: ''
  });

  // Report data states
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFilters, setReportFilters] = useState({
    batch: '',
    branch: ''
  });

  // Statistics tab states
  const [selectedStatCategory, setSelectedStatCategory] = useState('all_students');
  const [selectedStatBranch, setSelectedStatBranch] = useState('all');
  const [statBranches, setStatBranches] = useState([]);
  const [unplacedStudents, setUnplacedStudents] = useState([]);
  const [unplacedLoading, setUnplacedLoading] = useState(false);
  const [joinedCompanies, setJoinedCompanies] = useState({}); // regNo -> joinedCompany

  useEffect(() => {
    if (campus) localStorage.setItem('selectedCampus', campus);
    if (school) localStorage.setItem('selectedSchool', school);
  }, [campus, school]);

  useEffect(() => {
    if (activeTab === 'data') {
      fetchPlacements();
    } else if (activeTab === 'statistics') {
      // Auto-generate report when user opens Statistics tab
      if (!reportData && !reportLoading) {
        generatePlacementReport();
      }
    }
  }, [activeTab, filters]);

  useEffect(() => {
    if (activeTab === 'statistics') {
      generatePlacementReport();
    }
  }, [filters.batch]);
  useEffect(() => {
    // Load dropdown options from DB once (or when campus/school changes)
    fetchFilterMeta();
  }, [campus, school]);

  useEffect(() => {
    if (selectedStatCategory === 'zero' || selectedStatCategory === 'all_students') {
      fetchUnplacedStudents();
    }
  }, [selectedStatCategory, filters.batch]);

  const fetchUnplacedStudents = async () => {
    try {
      setUnplacedLoading(true);
      const baseUrl = getSchoolApiUrl('placement/unplaced-students');
      const separator = baseUrl.includes('?') ? '&' : '?';
      const url = filters.batch ? `${baseUrl}${separator}batch=${filters.batch}` : baseUrl;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        console.error('Failed to fetch unplaced students');
        setUnplacedStudents([]);
        return;
      }
      const data = await res.json();
      if (data?.success) {
        const list = data.unplacedStudents || [];
        setUnplacedStudents(list);
      } else {
        setUnplacedStudents([]);
      }
    } catch (err) {
      console.error('Error fetching unplaced students:', err);
      setUnplacedStudents([]);
    } finally {
      setUnplacedLoading(false);
    }
  };

  const handleJoinedCompanyChange = async (regNo, joinedCompany) => {
    try {
      // Update local state immediately for better UX
      setJoinedCompanies(prev => ({
        ...prev,
        [regNo]: joinedCompany
      }));

      // Save to backend
      const baseUrl = getSchoolApiUrl('placement/joined-companies');
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          regNo,
          joinedCompany
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        // Revert on error
        setJoinedCompanies(prev => {
          const updated = { ...prev };
          delete updated[regNo];
          return updated;
        });
        alert('Failed to update joined company. Please try again.');
      }
    } catch (err) {
      console.error('Error updating joined company:', err);
      // Revert on error
      setJoinedCompanies(prev => {
        const updated = { ...prev };
        delete updated[regNo];
        return updated;
      });
      alert('Error updating joined company. Please try again.');
    }
  };

  const fetchFilterMeta = async () => {
    try {
      const url = getSchoolApiUrl("placement/meta");
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success) {
        setFilterMeta({
          batches: Array.isArray(data.batches) ? data.batches : [],
          branches: Array.isArray(data.branches) ? data.branches : []
        });
      }
    } catch (e) {
      // Non-blocking: dropdowns can fallback to manual typing if needed
      console.error("Failed to fetch placement filter meta", e);
    }
  };

  const fetchPlacements = async () => {
    try {
      setLoading(true);
      setError("");

      const baseUrl = getSchoolApiUrl('placement');
      const separator = baseUrl.includes('?') ? '&' : '?';
      const params = new URLSearchParams();
      if (filters.batch) params.append('batch', filters.batch);
      if (filters.branch) params.append('branch', filters.branch);

      const url = params.toString() ? `${baseUrl}${separator}${params}` : baseUrl;

      const response = await fetch(url, {
        credentials: 'include'
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to fetch placements';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.success) {
        const list = data.placements || [];
        setPlacements(list);
        return list;
      } else {
        setError(data.error || 'Failed to load placements');
        return [];
      }
    } catch (err) {
      setError(err.message || 'Error loading placements');
      setPlacements([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Filtered, searched, and sorted placements
  const processedPlacements = useMemo(() => {
    let filtered = [...placements];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.regNo?.toLowerCase().includes(term) ||
        p.name?.toLowerCase().includes(term) ||
        p.companyName?.toLowerCase().includes(term) ||
        p.branch?.toLowerCase().includes(term) ||
        p.batch?.toLowerCase().includes(term)
      );
    }

    // Package range filter
    if (filters.minPackage) {
      const min = parseFloat(filters.minPackage);
      if (!isNaN(min)) {
        filtered = filtered.filter(p => parseFloat(p.package || 0) >= min);
      }
    }
    if (filters.maxPackage) {
      const max = parseFloat(filters.maxPackage);
      if (!isNaN(max)) {
        filtered = filtered.filter(p => parseFloat(p.package || 0) <= max);
      }
    }

    // Sorting
    filtered.sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';

      if (sortField === 'package') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });

    return filtered;
  }, [placements, searchTerm, filters, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(processedPlacements.length / itemsPerPage);
  const paginatedPlacements = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedPlacements.slice(start, start + itemsPerPage);
  }, [processedPlacements, currentPage, itemsPerPage]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDownloadTemplate = () => {
    // Create template data with sample rows
    const templateData = [
      ['Reg No', 'Name', 'Branch', 'Batch', 'Company Name', 'Package (LPA)'],
      ['220101120001', 'John Doe', 'CSE', '2022', 'Tech Corp', '8.5'],
      ['220101120002', 'Jane Smith', 'ECE', '2022', 'Innovation Ltd', '7.2'],
      ['220101120003', 'Bob Johnson', 'MECH', '2023', 'Engineering Solutions', '9.0'],
    ];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(templateData);

    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // Reg No
      { wch: 20 }, // Name
      { wch: 12 }, // Branch
      { wch: 10 }, // Batch
      { wch: 25 }, // Company Name
      { wch: 15 }, // Package
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Placement Template');

    // Download the file
    XLSX.writeFile(wb, 'Placement_Upload_Template.xlsx');
  };

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const baseUrl = getSchoolApiUrl("placement/upload");
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(baseUrl, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setUploadResult(data.stats);
        fetchPlacements();
        alert(`Upload successful! Inserted: ${data.stats.inserted}, Updated: ${data.stats.updated}`);
      } else {
        alert('Upload failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Upload error: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAddClick = () => {
    setEditingPlacement(null);
    setFormData({
      batch: '',
      branch: '',
      regNo: '',
      name: '',
      companyName: '',
      package: ''
    });
    setShowAddModal(true);
  };

  const handleEditClick = (placement) => {
    setEditingPlacement(placement);
    setFormData({
      batch: placement.batch || '',
      branch: placement.branch || '',
      regNo: placement.regNo || '',
      name: placement.name || '',
      companyName: placement.companyName || '',
      package: placement.package || ''
    });
    setShowAddModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const baseUrl = getSchoolApiUrl(editingPlacement ? 'placement/update' : 'placement');
      const method = editingPlacement ? 'PUT' : 'POST';

      const response = await fetch(baseUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...(editingPlacement && { id: editingPlacement._id }),
          ...formData
        })
      });

      const data = await response.json();
      if (data.success) {
        alert(editingPlacement ? 'Placement updated successfully!' : 'Placement added successfully!');
        setShowAddModal(false);
        fetchPlacements();
      } else {
        alert('Error: ' + (data.error || 'Failed to save placement'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this placement record?')) {
      return;
    }

    try {
      const baseUrl = getSchoolApiUrl('placement/delete');
      const response = await fetch(baseUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id })
      });

      const data = await response.json();
      if (data.success) {
        alert('Placement deleted successfully!');
        fetchPlacements();
      } else {
        alert('Error: ' + (data.error || 'Failed to delete placement'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Helper: derive branch short code from B.Tech registration
  const getBranchFromRegistration = (registration) => {
    if (!registration) return null;
    const reg = String(registration).trim();
    if (reg.length !== 12) return null;

    const branchCode = reg.slice(5, 8); // index 5-7
    const map = {
      "912": "BBA",
      "214": "MBA"
    };

    return map[branchCode] || null;
  };

  const getBatchFromRegistration = (registration) => {
    if (!registration) return null;
    const reg = String(registration).trim();
    if (reg.length < 2) return null;
    const yearCode = reg.slice(0, 2); // e.g., "22"
    return `20${yearCode}`;
  };

  const fetchTotalStudentsByBranchAndBatch = async (batchFilter = '') => {
    try {
      const baseUrl = getSchoolApiUrl("placement/student-strength");
      const url = batchFilter && batchFilter !== 'all' 
        ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}batch=${batchFilter}`
        : baseUrl;
        
      const response = await fetch(url, { credentials: "include" });

      if (!response.ok) {
        console.error("Failed to fetch student strength");
        return { totalStudentsByBranch: {}, totalStudentsByBatch: {}, totalUniqueStudents: 0 };
      }

      const result = await response.json();

      if (!result?.success) {
        console.error("Student strength API error", result?.error);
        return {
          totalStudentsByBranch: {},
          totalStudentsByBatch: {},
          totalUniqueStudents: 0,
          offerBuckets: null
        };
      }

      const totalStudentsByBranch = result.byBranch || {};
      const totalStudentsByBatch = result.byBatch || {};
      const totalUniqueStudents = result.totalStudents || 0;
      const offerBuckets = result.offerBuckets || null;

      return {
        totalStudentsByBranch,
        totalStudentsByBatch,
        totalUniqueStudents,
        offerBuckets
      };
    } catch (err) {
      console.error("Error fetching total students from student-strength API:", err);
      return {
        totalStudentsByBranch: {},
        totalStudentsByBatch: {},
        totalUniqueStudents: 0,
        offerBuckets: null
      };
    }
  };

  // Normalize branch names (must match student-strength API)
  const normalizeBranchName = (branchName) => {
    if (!branchName) return "";

    const normalized = String(branchName).trim().toUpperCase();

    const branchMap = {
      'BBA': 'BBA',
      'MBA': 'MBA',
      'BACHELOR OF BUSINESS ADMINISTRATION': 'BBA',
      'MASTER OF BUSINESS ADMINISTRATION': 'MBA'
    };

    // Check exact match first
    if (branchMap[normalized]) {
      return branchMap[normalized];
    }

    // Fallback: partial matching for edge cases
    const b = normalized.toLowerCase();
    if (b.includes('bba') || b.includes('bachelor of business administration')) return 'BBA';
    if (b.includes('mba') || b.includes('master of business administration')) return 'MBA';

    return branchName;
  };

  // Generate Placement Report
  const generatePlacementReport = async () => {
    try {
      setReportLoading(true);

      // Fetch placements with current batch filter to ensure we have the correct data
      // fetchPlacements already applies batch filter, so we get the correct data
      let allPlacements = await fetchPlacements();
      if (!allPlacements || allPlacements.length === 0) {
        // If fetchPlacements returns empty, try using current placements state but filter by batch
        allPlacements = placements;
        if (filters.batch) {
          allPlacements = allPlacements.filter(p => p.batch === filters.batch);
        }
        if (!allPlacements || allPlacements.length === 0) {
          alert('No placement records found for the selected batch. Please upload or add placement data first.');
          return;
        }
      }
      // Note: fetchPlacements already filters by batch, so no need to filter again

      // Fetch total students from 7th semester registration data
      const {
        totalStudentsByBranch,
        totalStudentsByBatch,
        totalUniqueStudents,
        offerBuckets
      } = await fetchTotalStudentsByBranchAndBatch(filters.batch);

      // Fetch joined companies data — store in local var (React setState is async, can't be read immediately)
      let fetchedJoinedCompanies = {};
      try {
        const joinedCompanyUrl = getSchoolApiUrl('placement/joined-companies');
        const separator = joinedCompanyUrl.includes('?') ? '&' : '?';
        const joinedCompanyParams = new URLSearchParams();
        if (filters.batch) joinedCompanyParams.append('batch', filters.batch);
        const joinedCompanyResponse = await fetch(
          joinedCompanyParams.toString() ? `${joinedCompanyUrl}${separator}${joinedCompanyParams}` : joinedCompanyUrl,
          { credentials: 'include' }
        );
        if (joinedCompanyResponse.ok) {
          const joinedData = await joinedCompanyResponse.json();
          if (joinedData.success && joinedData.joinedCompanies) {
            fetchedJoinedCompanies = joinedData.joinedCompanies; // local var — immediately available
            setJoinedCompanies(fetchedJoinedCompanies);           // also update UI state
          }
        }
      } catch (err) {
        console.error('Error fetching joined companies:', err);
      }

      // Get unique registration numbers from placements
      const placedRegNos = new Set(allPlacements.map(p => p.regNo));

      // Unique batches & branches from registration data + placements
      const uniqueBatchesSet = [
        ...new Set([
          ...Object.keys(totalStudentsByBatch),
          ...allPlacements.map((p) => p.batch).filter(Boolean)
        ])
      ].sort();

      let uniqueBranches = [
        ...new Set([
          ...Object.keys(totalStudentsByBranch),
          ...allPlacements.map((p) => normalizeBranchName(p.branch)).filter(Boolean)
        ])
      ].sort();

      // Calculate total students count (7th sem only)
      const totalStudentsCount = totalUniqueStudents;
      const placedStudentsCount = placedRegNos.size;
      const placementRatio = ((placedStudentsCount / Math.max(totalStudentsCount, 1)) * 100).toFixed(2);

      // Branch-wise analysis
      const branchAnalysis = {};
      uniqueBranches.forEach(branch => {
        const branchPlacements = allPlacements.filter(p => normalizeBranchName(p.branch) === branch);

        // Total students in this branch from registration (7th sem)
        const totalInBranch = totalStudentsByBranch[branch] || branchPlacements.length;
        
        // Count unique placed students (not total placement records)
        const uniquePlacedInBranch = new Set(branchPlacements.map(p => p.regNo?.trim()).filter(Boolean)).size;

        branchAnalysis[branch] = {
          totalStudents: totalInBranch,
          placedStudents: uniquePlacedInBranch, // Unique students, not total placement records
          placementRatio: ((uniquePlacedInBranch / Math.max(totalInBranch, 1)) * 100).toFixed(2),
          avgPackage: branchPlacements.length > 0
            ? (branchPlacements.reduce((sum, p) => sum + parseFloat(p.package || 0), 0) / branchPlacements.length).toFixed(2)
            : 0,
          maxPackage: branchPlacements.length > 0
            ? Math.max(...branchPlacements.map(p => parseFloat(p.package || 0))).toFixed(2)
            : 0,
          minPackage: branchPlacements.length > 0
            ? Math.min(...branchPlacements.map(p => parseFloat(p.package || 0))).toFixed(2)
            : 0,
          companies: new Set(branchPlacements.map(p => p.companyName)).size
        };
      });

      // Batch-wise analysis
      const batchAnalysis = {};
      uniqueBatchesSet.forEach(batch => {
        const batchPlacements = allPlacements.filter(p => p.batch === batch);
        const batchTotalStudents = totalStudentsByBatch[batch] || batchPlacements.length;

        batchAnalysis[batch] = {
          totalStudents: Math.max(batchTotalStudents, 1),
          placedStudents: batchPlacements.length,
          placementRatio: ((batchPlacements.length / Math.max(batchTotalStudents, 1)) * 100).toFixed(2),
          avgPackage: batchPlacements.length > 0
            ? (batchPlacements.reduce((sum, p) => sum + parseFloat(p.package || 0), 0) / batchPlacements.length).toFixed(2)
            : 0,
          maxPackage: batchPlacements.length > 0
            ? Math.max(...batchPlacements.map(p => parseFloat(p.package || 0))).toFixed(2)
            : 0,
          minPackage: batchPlacements.length > 0
            ? Math.min(...batchPlacements.map(p => parseFloat(p.package || 0))).toFixed(2)
            : 0,
          companies: new Set(batchPlacements.map(p => p.companyName)).size
        };
      });

      // Company-wise analysis
      const companyStats = {};
      allPlacements.forEach(p => {
        if (!companyStats[p.companyName]) {
          companyStats[p.companyName] = {
            count: 0,
            packages: [],
            branches: new Set()
          };
        }
        companyStats[p.companyName].count++;
        companyStats[p.companyName].packages.push(parseFloat(p.package || 0));
        companyStats[p.companyName].branches.add(p.branch);
      });

      const topCompanies = Object.entries(companyStats)
        .map(([name, data]) => ({
          name,
          count: data.count,
          avgPackage: (data.packages.reduce((a, b) => a + b, 0) / data.count).toFixed(2),
          maxPackage: Math.max(...data.packages).toFixed(2),
          branches: Array.from(data.branches).join(', ')
        }))
        .sort((a, b) => b.count - a.count);

      // Student-wise placement count
      const studentPlacementCounts = {};
      allPlacements.forEach(p => {
        const regNo = p.regNo;
        const normalizedBranch = normalizeBranchName(p.branch);
        if (!studentPlacementCounts[regNo]) {
          studentPlacementCounts[regNo] = {
            regNo: regNo,
            name: p.name || '',
            branch: normalizedBranch || '',
            batch: p.batch || '',
            count: 0,
            companies: [],
            packages: []
          };
        }
        studentPlacementCounts[regNo].count++;
        studentPlacementCounts[regNo].companies.push(p.companyName || '');
        studentPlacementCounts[regNo].packages.push(parseFloat(p.package || 0));
      });

      // Convert to array and sort by count (descending)
      const studentPlacementList = Object.values(studentPlacementCounts)
        .map(student => {
          // Get unique companies
          const uniqueCompanies = [...new Set(student.companies.filter(Boolean))];
          return {
            ...student,
            avgPackage: student.packages.length > 0
              ? (student.packages.reduce((a, b) => a + b, 0) / student.packages.length).toFixed(2)
              : '0.00',
            maxPackage: student.packages.length > 0
              ? Math.max(...student.packages).toFixed(2)
              : '0.00',
            companies: uniqueCompanies, // Keep as array
            companiesString: uniqueCompanies.join(', '), // For display
            joinedCompany: fetchedJoinedCompanies[student.regNo] || 'Not yet joined' // use local var, not stale state
          };
        })
        .sort((a, b) => b.count - a.count);

      setReportData({
        totalStudents: totalStudentsCount,
        placedStudents: placedStudentsCount,
        placementRatio,
        avgPackage: allPlacements.length > 0
          ? (allPlacements.reduce((sum, p) => sum + parseFloat(p.package || 0), 0) / allPlacements.length).toFixed(2)
          : 0,
        maxPackage: allPlacements.length > 0
          ? Math.max(...allPlacements.map(p => parseFloat(p.package || 0))).toFixed(2)
          : 0,
        minPackage: allPlacements.length > 0
          ? Math.min(...allPlacements.map(p => parseFloat(p.package || 0))).toFixed(2)
          : 0,
        uniqueBranches,
        uniqueBatches: uniqueBatchesSet,
        branchAnalysis,
        batchAnalysis,
        topCompanies,
        companyCount: Object.keys(companyStats).length,
        offerBuckets,
        studentPlacementList,
        allPlacements, // raw placement records for expanded Excel export
        joinedCompaniesMap: { ...fetchedJoinedCompanies } // use local var — joinedCompanies state is stale here
      });

      // Set branches for statistics filter
      setStatBranches(uniqueBranches);
      setSelectedStatBranch('all');
    } catch (err) {
      console.error('Error generating report:', err);
      alert('Error generating report: ' + err.message);
    } finally {
      setReportLoading(false);
    }
  };

  // Download Report as PDF
  const downloadReportPDF = () => {
    if (!reportData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 20;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(0, 88, 254);
    doc.text('PLACEMENT REPORT', pageWidth / 2, y, { align: 'center' });
    y += 15;

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, y, { align: 'center' });
    y += 12;

    // Summary Section
    doc.setFontSize(12);
    doc.setTextColor(25, 118, 210);
    doc.text('SUMMARY', 20, y);
    y += 8;

    const summaryData = [
      ['Total Students', reportData.totalStudents.toString()],
      ['Placed Students', reportData.placedStudents.toString()],
      ['Placement Ratio', `${reportData.placementRatio}%`],
      ['Average Package', `${reportData.avgPackage} LPA`],
      ['Highest Package', `${reportData.maxPackage} LPA`],
      ['Lowest Package', `${reportData.minPackage} LPA`],
      ['Total Companies', reportData.companyCount.toString()],
      ['Total Branches', reportData.uniqueBranches.length.toString()]
    ];

    doc.autoTable({
      startY: y,
      head: [['Metric', 'Value']],
      body: summaryData,
      theme: 'grid',
      headerStyles: { fillColor: [25, 118, 210], textColor: 255 },
      bodyStyles: { textColor: 50 },
      alternateRowStyles: { fillColor: [240, 248, 255] }
    });

    y = doc.lastAutoTable.finalY + 15;

    // Branch-wise Analysis
    if (reportData.uniqueBranches.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(25, 118, 210);
      doc.text('BRANCH-WISE ANALYSIS', 20, y);
      y += 8;

      const branchData = reportData.uniqueBranches.map(branch => {
        const stats = reportData.branchAnalysis[branch];
        return [
          branch,
          stats.totalStudents.toString(),
          stats.placedStudents.toString(),
          `${stats.placementRatio}%`,
          `${stats.avgPackage}`,
          `${stats.maxPackage}`
        ];
      });

      doc.autoTable({
        startY: y,
        head: [['Branch', 'Total', 'Placed', 'Ratio %', 'Avg LPA', 'Max LPA']],
        body: branchData,
        theme: 'grid',
        headerStyles: { fillColor: [76, 175, 80], textColor: 255 },
        bodyStyles: { textColor: 50 },
        alternateRowStyles: { fillColor: [240, 255, 240] }
      });
    }

    y = doc.lastAutoTable.finalY + 15;

    // Batch-wise Analysis
    if (reportData.uniqueBatches.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(25, 118, 210);
      doc.text('BATCH-WISE ANALYSIS', 20, y);
      y += 8;

      const batchData = reportData.uniqueBatches.map(batch => {
        const stats = reportData.batchAnalysis[batch];
        return [
          batch,
          stats.totalStudents.toString(),
          stats.placedStudents.toString(),
          `${stats.placementRatio}%`,
          `${stats.avgPackage}`,
          `${stats.maxPackage}`
        ];
      });

      doc.autoTable({
        startY: y,
        head: [['Batch', 'Total', 'Placed', 'Ratio %', 'Avg LPA', 'Max LPA']],
        body: batchData,
        theme: 'grid',
        headerStyles: { fillColor: [156, 39, 176], textColor: 255 },
        bodyStyles: { textColor: 50 },
        alternateRowStyles: { fillColor: [250, 240, 255] }
      });
    }

    y = doc.lastAutoTable.finalY + 15;

    // Student Placement Per Student
    if (reportData.studentPlacementList && reportData.studentPlacementList.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(25, 118, 210);
      doc.text('PLACEMENT GOT PER STUDENT', 20, y);
      y += 8;

      // Limit to first 100 students for PDF (to avoid too large files)
      const studentData = reportData.studentPlacementList.slice(0, 100).map(student => [
        student.regNo,
        student.name,
        student.branch,
        student.batch,
        student.count.toString(),
        `${student.avgPackage} LPA`,
        `${student.maxPackage} LPA`,
        student.companies.substring(0, 50) // Truncate long company lists
      ]);

      doc.autoTable({
        startY: y,
        head: [['Reg No', 'Name', 'Branch', 'Batch', 'Placements', 'Avg LPA', 'Max LPA', 'Companies']],
        body: studentData,
        theme: 'grid',
        headerStyles: { fillColor: [99, 102, 241], textColor: 255 },
        bodyStyles: { textColor: 50, fontSize: 7 },
        alternateRowStyles: { fillColor: [238, 242, 255] },
        styles: { overflow: 'linebreak', cellWidth: 'wrap' }
      });

      if (reportData.studentPlacementList.length > 100) {
        y = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Note: Showing first 100 students. Total: ${reportData.studentPlacementList.length}`, 20, y);
      }
    }

    // Save PDF
    doc.save(`Placement_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Download Report as Excel
  const downloadReportExcel = () => {
    if (!reportData) return;

    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ['PLACEMENT REPORT SUMMARY'],
      ['Generated on:', new Date().toLocaleDateString()],
      [],
      ['Metric', 'Value'],
      ['Total Students', reportData.totalStudents],
      ['Placed Students', reportData.placedStudents],
      ['Placement Ratio (%)', parseFloat(reportData.placementRatio)],
      ['Average Package (LPA)', parseFloat(reportData.avgPackage)],
      ['Highest Package (LPA)', parseFloat(reportData.maxPackage)],
      ['Lowest Package (LPA)', parseFloat(reportData.minPackage)],
      ['Total Companies', reportData.companyCount],
      ['Total Branches', reportData.uniqueBranches.length]
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    // Branch-wise sheet
    if (reportData.uniqueBranches.length > 0) {
      const branchHeaders = ['Branch', 'Total Students', 'Placed Students', 'Placement Ratio (%)', 'Avg Package (LPA)', 'Max Package (LPA)', 'Min Package (LPA)', 'Companies'];
      const branchData = [branchHeaders, ...reportData.uniqueBranches.map(branch => {
        const stats = reportData.branchAnalysis[branch];
        return [branch, stats.totalStudents, stats.placedStudents, parseFloat(stats.placementRatio), parseFloat(stats.avgPackage), parseFloat(stats.maxPackage), parseFloat(stats.minPackage), stats.companies];
      })];

      const branchSheet = XLSX.utils.aoa_to_sheet(branchData);
      XLSX.utils.book_append_sheet(wb, branchSheet, 'Branch Analysis');
    }

    // Batch-wise sheet
    if (reportData.uniqueBatches.length > 0) {
      const batchHeaders = ['Batch', 'Total Students', 'Placed Students', 'Placement Ratio (%)', 'Avg Package (LPA)', 'Max Package (LPA)', 'Companies'];
      const batchData = [batchHeaders, ...reportData.uniqueBatches.map(batch => {
        const stats = reportData.batchAnalysis[batch];
        return [batch, stats.totalStudents, stats.placedStudents, parseFloat(stats.placementRatio), parseFloat(stats.avgPackage), parseFloat(stats.maxPackage), stats.companies];
      })];

      const batchSheet = XLSX.utils.aoa_to_sheet(batchData);
      XLSX.utils.book_append_sheet(wb, batchSheet, 'Batch Analysis');
    }

    // Top companies sheet
    if (reportData.topCompanies.length > 0) {
      const companyHeaders = ['Company', 'Hires', 'Avg Package (LPA)', 'Max Package (LPA)', 'Branches'];
      const companyData = [companyHeaders, ...reportData.topCompanies.slice(0, 20).map(c => [c.name, c.count, parseFloat(c.avgPackage), parseFloat(c.maxPackage), c.branches])];

      const companySheet = XLSX.utils.aoa_to_sheet(companyData);
      XLSX.utils.book_append_sheet(wb, companySheet, 'Top Companies');
    }

    // Student Placement Per Student sheet
    if (reportData.studentPlacementList && reportData.studentPlacementList.length > 0) {
      const studentHeaders = ['Reg No', 'Name', 'Branch', 'Batch', 'Placements', 'Avg Package (LPA)', 'Max Package (LPA)', 'Companies'];
      const studentData = [studentHeaders, ...reportData.studentPlacementList.map(student => [
        student.regNo,
        student.name,
        student.branch,
        student.batch,
        student.count,
        parseFloat(student.avgPackage),
        parseFloat(student.maxPackage),
        student.companies
      ])];

      const studentSheet = XLSX.utils.aoa_to_sheet(studentData);
      XLSX.utils.book_append_sheet(wb, studentSheet, 'Student Placements');
    }

    XLSX.writeFile(wb, `Placement_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Download Statistics Excel (only selected category) — expanded row-per-offer format
  const downloadStatisticsExcel = () => {
    if (!reportData) return;

    const wb = XLSX.utils.book_new();
    let sheetName = 'Statistics';

    if (selectedStatCategory === 'zero') {
      // Unplaced students — simple flat format
      sheetName = 'Unplaced Students';
      const selectedData = unplacedStudents.filter(s => selectedStatBranch === 'all' || s.branch === selectedStatBranch);
      const headers = ['Reg No', 'Name', 'Branch', 'Batch'];
      const data = [headers, ...selectedData.map(student => [
        student.regNo,
        student.name,
        student.branch,
        student.batch
      ])];
      const sheet = XLSX.utils.aoa_to_sheet(data);
      sheet['!cols'] = [
        { wch: 16 }, { wch: 24 }, { wch: 12 }, { wch: 8 }
      ];
      XLSX.utils.book_append_sheet(wb, sheet, sheetName);
      XLSX.writeFile(wb, `Student_Statistics_${selectedStatCategory}_${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

    // For placed-student categories — expanded row-per-offer format
    let filteredStudents = [];
    if (selectedStatCategory === 'all_students') {
      filteredStudents = reportData.studentPlacementList.filter(s => selectedStatBranch === 'all' || s.branch === selectedStatBranch);
      sheetName = 'All Students';
    } else if (selectedStatCategory === 'one') {
      filteredStudents = reportData.studentPlacementList.filter(s => s.count === 1 && (selectedStatBranch === 'all' || s.branch === selectedStatBranch));
      sheetName = '1 Placement';
    } else if (selectedStatCategory === 'two') {
      filteredStudents = reportData.studentPlacementList.filter(s => s.count === 2 && (selectedStatBranch === 'all' || s.branch === selectedStatBranch));
      sheetName = '2 Placements';
    } else if (selectedStatCategory === 'more_than_two') {
      filteredStudents = reportData.studentPlacementList.filter(s => s.count > 2 && (selectedStatBranch === 'all' || s.branch === selectedStatBranch));
      sheetName = 'More than 2';
    }

    const filteredRegNos = new Set(filteredStudents.map(s => s.regNo));
    const rawPlacements = (reportData.allPlacements || []).filter(p => filteredRegNos.has(p.regNo));
    // Use live joinedCompanies state — always reflects current UI values (not stale reportData snapshot)
    const joinedCompaniesMap = joinedCompanies;

    // Group raw placements by regNo preserving insertion order
    const groupedByRegNo = {};
    rawPlacements.forEach(p => {
      const reg = p.regNo?.trim() || '';
      if (!groupedByRegNo[reg]) groupedByRegNo[reg] = [];
      groupedByRegNo[reg].push(p);
    });

    // Headers matching the screenshot
    const headers = ['Reg No', 'Name', 'Branch', 'Batch', 'Placements', 'Package (LPA)', 'Companies', 'Joined Company'];
    const rows = [headers];
    const merges = []; // track cell merge ranges

    // Sort students by regNo (ascending)
    const sortedStudents = filteredStudents
      .slice()
      .sort((a, b) => (a.regNo || '').localeCompare(b.regNo || ''));

    sortedStudents.forEach(student => {
      const offers = groupedByRegNo[student.regNo] || [];
      const totalOffers = offers.length;
      const joined = joinedCompaniesMap[student.regNo] || 'Not yet joined';
      const startRow = rows.length; // 0-indexed row of first offer for this student

      if (totalOffers === 0) {
        // Fallback single row
        rows.push([student.regNo, student.name, student.branch, student.batch, student.count, '', '', joined]);
        return;
      }

      offers.forEach((offer, idx) => {
        rows.push([
          idx === 0 ? student.regNo : '',
          idx === 0 ? student.name : '',
          idx === 0 ? student.branch : '',
          idx === 0 ? student.batch : '',
          idx === 0 ? totalOffers : '',
          parseFloat(offer.package || 0) || '',
          offer.companyName || '',
          idx === 0 ? joined : ''
        ]);
      });

      const endRow = rows.length - 1; // 0-indexed row of last offer

      // Only add merges if student has more than 1 offer
      if (totalOffers > 1) {
        // Merge cols 0-4 (Reg No, Name, Branch, Batch, Placements) vertically
        [0, 1, 2, 3, 4].forEach(col => {
          merges.push({ s: { r: startRow, c: col }, e: { r: endRow, c: col } });
        });
        // Merge col 7 (Joined Company) vertically
        merges.push({ s: { r: startRow, c: 7 }, e: { r: endRow, c: 7 } });
      }
    });

    const sheet = XLSX.utils.aoa_to_sheet(rows);

    // Apply merges
    if (merges.length > 0) {
      sheet['!merges'] = merges;
    }

    // Apply vertical-center alignment + header styles using xlsx-js-style
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

    // Track which rows are "first rows" of a student group (for thick border)
    const groupFirstRows = new Set();
    let trackRow = 1; // row 0 = header
    sortedStudents.forEach(student => {
      const offers = groupedByRegNo[student.regNo] || [];
      groupFirstRows.add(trackRow);
      trackRow += Math.max(offers.length, 1);
    });

    const borderMedium = { style: 'medium', color: { rgb: '888888' } };
    const borderThin   = { style: 'thin',   color: { rgb: 'CCCCCC' } };

    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!sheet[cellAddr]) sheet[cellAddr] = { t: 's', v: '' };

        const isHeader = R === 0;
        const isGroupFirst = groupFirstRows.has(R);

        sheet[cellAddr].s = {
          alignment: {
            vertical: 'center',
            horizontal: C === 1 ? 'left' : 'center',
            wrapText: false
          },
          font: isHeader ? { bold: true, color: { rgb: 'CC0000' } } : {},
          fill: isHeader
            ? { fgColor: { rgb: 'FFFF00' } }
            : (R % 2 === 0 ? { fgColor: { rgb: 'F5F8FF' } } : { fgColor: { rgb: 'FFFFFF' } }),
          border: {
            top:    isGroupFirst && !isHeader ? borderMedium : borderThin,
            bottom: borderThin,
            left:   borderThin,
            right:  borderThin
          }
        };
      }
    }

    // Row heights
    sheet['!rows'] = rows.map((_, i) => ({ hpt: i === 0 ? 20 : 18 }));

    sheet['!cols'] = [
      { wch: 16 }, // Reg No
      { wch: 22 }, // Name
      { wch: 12 }, // Branch
      { wch: 8  }, // Batch
      { wch: 12 }, // Placements
      { wch: 14 }, // Package (LPA)
      { wch: 30 }, // Companies
      { wch: 25 }, // Joined Company
    ];

    XLSX.utils.book_append_sheet(wb, sheet, sheetName);
    XLSX.writeFile(wb, `Student_Statistics_${selectedStatCategory}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Download Statistics PDF (only selected category)
  const downloadStatisticsPDF = () => {
    if (!reportData) return;

    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 14;

    // ── Header ──────────────────────────────────────────────────────────────
    doc.setFontSize(16);
    doc.setTextColor(0, 88, 254);
    doc.text('STUDENT PLACEMENT STATISTICS REPORT', pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, y, { align: 'center' });
    y += 8;

    // ── Determine category & data ────────────────────────────────────────────
    let categoryTitle = '';
    let selectedStudents = [];

    if (selectedStatCategory === 'all_students') {
      categoryTitle = 'ALL PLACED STUDENTS';
      selectedStudents = reportData.studentPlacementList.filter(s => selectedStatBranch === 'all' || s.branch === selectedStatBranch);
    } else if (selectedStatCategory === 'zero') {
      categoryTitle = 'UNPLACED STUDENTS';
      selectedStudents = unplacedStudents.filter(s => selectedStatBranch === 'all' || s.branch === selectedStatBranch);
    } else if (selectedStatCategory === 'one') {
      categoryTitle = 'STUDENTS WITH 1 PLACEMENT';
      selectedStudents = reportData.studentPlacementList.filter(s => s.count === 1 && (selectedStatBranch === 'all' || s.branch === selectedStatBranch));
    } else if (selectedStatCategory === 'two') {
      categoryTitle = 'STUDENTS WITH 2 PLACEMENTS';
      selectedStudents = reportData.studentPlacementList.filter(s => s.count === 2 && (selectedStatBranch === 'all' || s.branch === selectedStatBranch));
    } else if (selectedStatCategory === 'more_than_two') {
      categoryTitle = 'STUDENTS WITH MORE THAN 2 PLACEMENTS';
      selectedStudents = reportData.studentPlacementList.filter(s => s.count > 2 && (selectedStatBranch === 'all' || s.branch === selectedStatBranch));
    }

    doc.setFontSize(11);
    doc.setTextColor(25, 118, 210);
    doc.text(categoryTitle, 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Total students: ${selectedStudents.length}`, 14, y);
    y += 6;

    if (selectedStudents.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text('No data available for the selected category.', 14, y + 10);
      doc.save(`Student_Statistics_${selectedStatCategory}_${new Date().toISOString().split('T')[0]}.pdf`);
      return;
    }

    // ── UNPLACED: simple flat table ──────────────────────────────────────────
    if (selectedStatCategory === 'zero') {
      const sortedUnplaced = [...selectedStudents].sort((a, b) => (a.regNo || '').localeCompare(b.regNo || ''));
      doc.autoTable({
        startY: y,
        head: [['#', 'Reg No', 'Name', 'Branch', 'Batch']],
        body: sortedUnplaced.map((s, i) => [i + 1, s.regNo, s.name, s.branch, s.batch]),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
        headStyles: { fillColor: [220, 53, 69], textColor: 255, fontStyle: 'bold', halign: 'center' },
        alternateRowStyles: { fillColor: [255, 240, 240] },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { halign: 'center', cellWidth: 35 },
          2: { halign: 'left',   cellWidth: 50 },
          3: { halign: 'center', cellWidth: 25 },
          4: { halign: 'center', cellWidth: 20 }
        }
      });
      doc.save(`Student_Statistics_${selectedStatCategory}_${new Date().toISOString().split('T')[0]}.pdf`);
      return;
    }

    // ── PLACED STUDENTS: row-per-offer with rowSpan ──────────────────────────
    // Sort by regNo
    const sortedStudents = [...selectedStudents].sort((a, b) => (a.regNo || '').localeCompare(b.regNo || ''));

    // Group raw placements by regNo
    const filteredRegNos = new Set(sortedStudents.map(s => s.regNo));
    const rawPlacements = (reportData.allPlacements || []).filter(p => filteredRegNos.has(p.regNo));
    const groupedByRegNo = {};
    rawPlacements.forEach(p => {
      const reg = p.regNo?.trim() || '';
      if (!groupedByRegNo[reg]) groupedByRegNo[reg] = [];
      groupedByRegNo[reg].push(p);
    });
    // Use live joinedCompanies state — always reflects what the UI shows, not a stale snapshot
    const joinedCompaniesMap = joinedCompanies;

    // Build body rows with rowSpan for jspdf-autotable
    const body = [];
    let sno = 1;

    sortedStudents.forEach(student => {
      const offers = groupedByRegNo[student.regNo] || [];
      const totalOffers = offers.length;
      const joined = joinedCompaniesMap[student.regNo] || '-';

      if (totalOffers === 0) {
        body.push([
          { content: sno++, rowSpan: 1, styles: { halign: 'center', valign: 'middle' } },
          { content: student.regNo, rowSpan: 1, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } },
          { content: student.name, rowSpan: 1, styles: { halign: 'left', valign: 'middle' } },
          { content: student.branch, rowSpan: 1, styles: { halign: 'center', valign: 'middle' } },
          { content: student.batch, rowSpan: 1, styles: { halign: 'center', valign: 'middle' } },
          { content: student.count, rowSpan: 1, styles: { halign: 'center', valign: 'middle' } },
          { content: '', styles: { halign: 'center', valign: 'middle' } },
          { content: '', styles: { halign: 'left', valign: 'middle' } },
          { content: joined, rowSpan: 1, styles: { halign: 'left', valign: 'middle', fontStyle: 'bold', textColor: [0, 128, 0] } }
        ]);
        return;
      }

      offers.forEach((offer, idx) => {
        const isFirst = idx === 0;
        const pkg = parseFloat(offer.package || 0) || '-';
        const company = offer.companyName || '-';

        if (isFirst) {
          body.push([
            { content: sno++, rowSpan: totalOffers, styles: { halign: 'center', valign: 'middle' } },
            { content: student.regNo, rowSpan: totalOffers, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold' } },
            { content: student.name, rowSpan: totalOffers, styles: { halign: 'left', valign: 'middle' } },
            { content: student.branch, rowSpan: totalOffers, styles: { halign: 'center', valign: 'middle' } },
            { content: student.batch, rowSpan: totalOffers, styles: { halign: 'center', valign: 'middle' } },
            { content: totalOffers, rowSpan: totalOffers, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', textColor: [0, 80, 200] } },
            { content: pkg, styles: { halign: 'center', valign: 'middle' } },
            { content: company, styles: { halign: 'left', valign: 'middle' } },
            { content: joined, rowSpan: totalOffers, styles: { halign: 'left', valign: 'middle', fontStyle: 'bold', textColor: [0, 128, 0] } }
          ]);
        } else {
          body.push([
            { content: pkg, styles: { halign: 'center', valign: 'middle' } },
            { content: company, styles: { halign: 'left', valign: 'middle' } }
          ]);
        }
      });
    });

    doc.autoTable({
      startY: y,
      head: [[
        { content: '#',             styles: { halign: 'center' } },
        { content: 'Reg No',        styles: { halign: 'center' } },
        { content: 'Name',          styles: { halign: 'center' } },
        { content: 'Branch',        styles: { halign: 'center' } },
        { content: 'Batch',         styles: { halign: 'center' } },
        { content: 'Placements',    styles: { halign: 'center' } },
        { content: 'Package (LPA)', styles: { halign: 'center' } },
        { content: 'Companies',     styles: { halign: 'center' } },
        { content: 'Joined Company',styles: { halign: 'center' } }
      ]],
      body,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [25, 118, 210], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [240, 246, 255] },
      columnStyles: {
        0: { cellWidth: 8  },  // #
        1: { cellWidth: 33 },  // Reg No
        2: { cellWidth: 38 },  // Name
        3: { cellWidth: 22 },  // Branch
        4: { cellWidth: 16 },  // Batch
        5: { cellWidth: 20 },  // Placements
        6: { cellWidth: 22 },  // Package
        7: { cellWidth: 55 },  // Companies
        8: { cellWidth: 45 },  // Joined Company
      },
      didParseCell: (data) => {
        // Highlight header
        if (data.section === 'head') {
          data.cell.styles.fillColor = [30, 30, 30];
          data.cell.styles.textColor = [255, 215, 0];
        }
        // Alternate light blue on even student groups
        if (data.section === 'body' && data.row.index % 2 === 0) {
          if (!data.cell.styles.fillColor || data.cell.styles.fillColor[0] === 255) {
            data.cell.styles.fillColor = [245, 250, 255];
          }
        }
      }
    });

    doc.save(`Student_Statistics_${selectedStatCategory}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      alert('Please select at least one record');
      return;
    }
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} placement record(s)?`)) {
      return;
    }

    try {
      for (const id of selectedIds) {
        const baseUrl = getSchoolApiUrl('placement/delete');
        await fetch(baseUrl, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id })
        });
      }
      alert(`${selectedIds.length} record(s) deleted successfully!`);
      setSelectedIds([]);
      fetchPlacements();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleExport = (format) => {
    const dataToExport = processedPlacements.map(p => ({
      Batch: p.batch,
      Branch: p.branch,
      'Registration Number': p.regNo,
      Name: p.name,
      'Company Name': p.companyName,
      'Package (LPA)': p.package
    }));

    if (format === 'csv') {
      const headers = Object.keys(dataToExport[0] || {});
      const csv = [
        headers.join(','),
        ...dataToExport.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `placements_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } else if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Placements');
      XLSX.writeFile(wb, `placements_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if (format === 'pdf') {
      const doc = new jsPDF();
      doc.text('Placement Records', 14, 15);
      doc.autoTable({
        head: [['Batch', 'Branch', 'Reg No', 'Name', 'Company', 'Package (LPA)']],
        body: processedPlacements.map(p => [
          p.batch,
          p.branch,
          p.regNo,
          p.name,
          p.companyName,
          p.package
        ]),
        startY: 20,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [5, 163, 199] }
      });
      doc.save(`placements_${new Date().toISOString().split('T')[0]}.pdf`);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedPlacements.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedPlacements.map(p => p._id));
    }
  };

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex gap-4 border-b border-gray-200 overflow-x-auto">
            <button
              onClick={() => setActiveTab('data')}
              className={`px-6 py-3 font-semibold transition-colors whitespace-nowrap ${activeTab === 'data'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              Placement Data
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-6 py-3 font-semibold transition-colors whitespace-nowrap ${activeTab === 'analytics'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              Analytics & Visualization
            </button>
            <button
              onClick={() => setActiveTab('statistics')}
              className={`px-6 py-3 font-semibold transition-colors whitespace-nowrap ${activeTab === 'statistics'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              Student Statistics
            </button>
          </div>
        </div>

        {activeTab === 'data' && (
          <div>
            {/* Advanced Filters */}
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, reg no, company..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Batch</label>
                  <select
                    value={filters.batch}
                    onChange={(e) => setFilters({ ...filters, batch: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All</option>
                    {filterMeta.batches.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                  <select
                    value={filters.branch}
                    onChange={(e) => setFilters({ ...filters, branch: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All</option>
                    {filterMeta.branches.map((br) => (
                      <option key={br} value={br}>{br}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Min Package</label>
                    <input
                      type="number"
                      value={filters.minPackage}
                      onChange={(e) => setFilters({ ...filters, minPackage: e.target.value })}
                      placeholder="Min LPA"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Package</label>
                    <input
                      type="number"
                      value={filters.maxPackage}
                      onChange={(e) => setFilters({ ...filters, maxPackage: e.target.value })}
                      placeholder="Max LPA"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <label className="flex items-center px-4 py-2 bg-gray-100 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-200">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files?.[0])}
                    disabled={uploading}
                  />
                  <span className="text-sm font-semibold text-gray-700">{uploading ? "Uploading..." : "📁 Upload CSV/Excel"}</span>
                </label>
                <button
                  onClick={handleDownloadTemplate}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold flex items-center gap-2"
                >
                  📄 View Template
                </button>
                <button
                  onClick={handleAddClick}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                >
                  + Add Placement
                </button>
                {selectedIds.length > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
                  >
                    🗑️ Delete Selected ({selectedIds.length})
                  </button>
                )}
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={() => handleExport('csv')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    📥 CSV
                  </button>
                  <button
                    onClick={() => handleExport('excel')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    📊 Excel
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    📄 PDF
                  </button>
                </div>
              </div>

              {uploadResult && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                  ✅ Uploaded: {uploadResult.inserted} inserted, {uploadResult.updated} updated, {uploadResult.skipped} skipped (Total: {uploadResult.total})
                </div>
              )}
            </div>

            {/* Table */}
            {loading ? (
              <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading placements...</p>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
                <p className="text-red-600">{error}</p>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-4">
                  <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      Showing {paginatedPlacements.length} of {processedPlacements.length} records
                    </span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value={10}>10 per page</option>
                      <option value={20}>20 per page</option>
                      <option value={50}>50 per page</option>
                      <option value={100}>100 per page</option>
                    </select>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left">
                            <input
                              type="checkbox"
                              checked={selectedIds.length === paginatedPlacements.length && paginatedPlacements.length > 0}
                              onChange={toggleSelectAll}
                              className="rounded"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('batch')}>
                            Batch {sortField === 'batch' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('branch')}>
                            Branch {sortField === 'branch' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('regNo')}>
                            Reg No {sortField === 'regNo' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('name')}>
                            Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('companyName')}>
                            Company {sortField === 'companyName' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('package')}>
                            Package (LPA) {sortField === 'package' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedPlacements.map((placement, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(placement._id)}
                                onChange={() => toggleSelect(placement._id)}
                                className="rounded"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{placement.batch}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{placement.branch}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{placement.regNo}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{placement.name}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{placement.companyName}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-600 font-semibold">{placement.package}</td>
                            <td className="px-4 py-3 text-sm text-center">
                              <button
                                onClick={() => handleEditClick(placement)}
                                className="mr-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(placement._id)}
                                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="bg-white rounded-2xl shadow-xl p-4 flex justify-center items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <PlacementAnalytics />
        )}

        {activeTab === 'statistics' && (
          <div>
            {/* Statistics Header */}
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">📊 Student Placement Statistics</h2>
              <p className="text-gray-600">Detailed breakdown of students by their placement count</p>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Batch</label>
                <select
                  value={filters.batch}
                  onChange={(e) => setFilters({ ...filters, batch: e.target.value })}
                  className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">All</option>
                  {filterMeta.batches.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            {reportLoading && !reportData && (
              <div className="bg-white rounded-2xl shadow-xl p-12 text-center mb-6">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading statistics...</p>
              </div>
            )}

            {reportData && reportData.studentPlacementList && (
              <div className="space-y-6">
                {/* Summary Cards - Like Placement Report */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                    <h3 className="text-sm font-medium opacity-90 mb-2">Total Students</h3>
                    <p className="text-4xl font-bold">{reportData.totalStudents}</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                    <h3 className="text-sm font-medium opacity-90 mb-2">Placed Students</h3>
                    <p className="text-4xl font-bold">{reportData.placedStudents}</p>
                  </div>
                  <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
                    <h3 className="text-sm font-medium opacity-90 mb-2">Unplaced Students</h3>
                    <p className="text-4xl font-bold">{reportData.totalStudents - reportData.placedStudents}</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                    <h3 className="text-sm font-medium opacity-90 mb-2">Placement Ratio</h3>
                    <p className="text-4xl font-bold">{reportData.placementRatio}%</p>
                  </div>
                </div>

                {/* Category Filter Buttons */}
                <div className="bg-white rounded-2xl shadow-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Select Category</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {/* All Students */}
                    <button
                      onClick={() => setSelectedStatCategory('all_students')}
                      className={`px-4 py-3 rounded-lg font-semibold transition-all ${selectedStatCategory === 'all_students'
                        ? 'bg-gray-800 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                    >
                      All Students
                      <div className="text-2xl font-bold">{
                        selectedStatBranch === 'all'
                          ? reportData.totalStudents
                          : (reportData.branchAnalysis[selectedStatBranch]?.totalStudents || 0)
                      }</div>
                    </button>

                    {/* 0 Placements (Unplaced) */}
                    <button
                      onClick={() => setSelectedStatCategory('zero')}
                      className={`px-4 py-3 rounded-lg font-semibold transition-all ${selectedStatCategory === 'zero'
                        ? 'bg-red-600 text-white shadow-lg'
                        : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                    >
                      0 Placements
                      <div className="text-2xl font-bold">{
                        unplacedLoading 
                          ? (selectedStatBranch === 'all'
                              ? (reportData.totalStudents - reportData.placedStudents)
                              : ((reportData.branchAnalysis[selectedStatBranch]?.totalStudents || 0) -
                                (reportData.branchAnalysis[selectedStatBranch]?.placedStudents || 0)))
                          : unplacedStudents.filter(s => selectedStatBranch === 'all' || s.branch === selectedStatBranch).length
                      }</div>
                    </button>

                    {/* 1 Placement */}
                    <button
                      onClick={() => setSelectedStatCategory('one')}
                      className={`px-4 py-3 rounded-lg font-semibold transition-all ${selectedStatCategory === 'one'
                        ? 'bg-yellow-600 text-white shadow-lg'
                        : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        }`}
                    >
                      1 Placement
                      <div className="text-2xl font-bold">{(reportData.studentPlacementList || []).filter(s => s.count === 1 && (selectedStatBranch === 'all' || s.branch === selectedStatBranch)).length}</div>
                    </button>

                    {/* 2 Placements */}
                    <button
                      onClick={() => setSelectedStatCategory('two')}
                      className={`px-4 py-3 rounded-lg font-semibold transition-all ${selectedStatCategory === 'two'
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        }`}
                    >
                      2 Placements
                      <div className="text-2xl font-bold">{(reportData.studentPlacementList || []).filter(s => s.count === 2 && (selectedStatBranch === 'all' || s.branch === selectedStatBranch)).length}</div>
                    </button>

                    {/* More than 2 Placements */}
                    <button
                      onClick={() => setSelectedStatCategory('more_than_two')}
                      className={`px-4 py-3 rounded-lg font-semibold transition-all ${selectedStatCategory === 'more_than_two'
                        ? 'bg-green-600 text-white shadow-lg'
                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                        }`}
                    >
                      &gt; 2 Placements
                      <div className="text-2xl font-bold">{(reportData.studentPlacementList || []).filter(s => s.count > 2 && (selectedStatBranch === 'all' || s.branch === selectedStatBranch)).length}</div>
                    </button>
                  </div>
                </div>

                {/* Branch Filter */}
                <div className="bg-white rounded-2xl shadow-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Select Branch</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedStatBranch('all')}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all ${selectedStatBranch === 'all'
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        }`}
                    >
                      All Branches
                    </button>
                    {statBranches.map((branch) => (
                      <button
                        key={branch}
                        onClick={() => setSelectedStatBranch(branch)}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all ${selectedStatBranch === branch
                          ? 'bg-purple-600 text-white shadow-lg'
                          : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                          }`}
                      >
                        {branch}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Download Buttons */}
                <div className="bg-white rounded-xl shadow-lg p-6 flex gap-3 flex-wrap">
                  <button
                    onClick={downloadStatisticsPDF}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold flex items-center gap-2"
                  >
                    📄 Download PDF
                  </button>
                  <button
                    onClick={downloadStatisticsExcel}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold flex items-center gap-2"
                  >
                    📊 Download Excel
                  </button>
                </div>

                {/* Student Table */}
                <div className="bg-white rounded-2xl shadow-xl p-6">
                  {selectedStatCategory === 'all_students' && (
                    <>
                      <h3 className="text-xl font-bold text-gray-800 mb-4">All Students ({
                        ((reportData.studentPlacementList || []).filter(s => selectedStatBranch === 'all' || s.branch === selectedStatBranch).length +
                        (unplacedStudents || []).filter(s => selectedStatBranch === 'all' || s.branch === selectedStatBranch).length)
                      })</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Reg No</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Branch</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Batch</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Placements</th>
                              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Avg LPA</th>
                              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Max LPA</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Companies</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Joined Company</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {/* Placed Students */}
                            {reportData.studentPlacementList.filter(s => selectedStatBranch === 'all' || s.branch === selectedStatBranch).map((student, idx) => {
                              const studentCompanies = Array.isArray(student.companies) ? student.companies : (student.companiesString || '').split(', ').filter(Boolean);
                              const currentJoinedCompany = joinedCompanies[student.regNo] || student.joinedCompany || 'Not yet joined';
                              return (
                                <tr key={`placed-${idx}`} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{student.regNo}</td>
                                  <td className="px-4 py-3 text-sm text-gray-800">{student.name}</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">{student.branch}</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">{student.batch}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${student.count === 1 ? 'bg-yellow-100 text-yellow-800' :
                                      student.count === 2 ? 'bg-blue-100 text-blue-800' :
                                        'bg-green-100 text-green-800'
                                      }`}>
                                      {student.count}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right text-sm text-gray-600 font-semibold">{student.avgPackage} LPA</td>
                                  <td className="px-4 py-3 text-right text-sm font-semibold text-green-600">{student.maxPackage} LPA</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    <div className="max-w-md">
                                      {studentCompanies.map((company, cIdx) => {
                                        const isJoined = currentJoinedCompany !== 'Not yet joined' && company === currentJoinedCompany;
                                        return (
                                          <span
                                            key={cIdx}
                                            className={`inline-block mr-2 mb-1 px-2 py-1 rounded text-xs ${
                                              isJoined
                                                ? 'bg-green-100 text-green-800 font-semibold border-2 border-green-500'
                                                : 'bg-gray-100 text-gray-700'
                                            }`}
                                            title={company}
                                          >
                                            {company}
                                            {isJoined && ' ✓'}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm">
                                    <select
                                      value={currentJoinedCompany}
                                      onChange={(e) => handleJoinedCompanyChange(student.regNo, e.target.value)}
                                      className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                      <option value="Not yet joined">Not yet joined</option>
                                      {studentCompanies.map((company, cIdx) => (
                                        <option key={cIdx} value={company}>{company}</option>
                                      ))}
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}
                            {/* Unplaced Students */}
                            {unplacedStudents.filter(s => selectedStatBranch === 'all' || s.branch === selectedStatBranch).map((student, idx) => (
                              <tr key={`unplaced-${idx}`} className="hover:bg-red-50 bg-red-50/30">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{student.regNo}</td>
                                <td className="px-4 py-3 text-sm text-gray-800">{student.name}</td>
                                <td className="px-4 py-3 text-sm text-gray-600">{student.branch}</td>
                                <td className="px-4 py-3 text-sm text-gray-600">{student.batch}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">0</span>
                                </td>
                                <td className="px-4 py-3 text-right text-sm text-gray-400">-</td>
                                <td className="px-4 py-3 text-right text-sm text-gray-400">-</td>
                                <td className="px-4 py-3 text-sm text-gray-400">-</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {reportData.studentPlacementList.filter(s => selectedStatBranch === 'all' || s.branch === selectedStatBranch).length === 0 &&
                        unplacedStudents.filter(s => selectedStatBranch === 'all' || s.branch === selectedStatBranch).length === 0 && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
                          <p className="text-sm text-gray-600 text-center">No students found for the selected branch.</p>
                        </div>
                      )}
                    </>
                  )}

                  {selectedStatCategory === 'zero' && (
                    <>
                      <h3 className="text-xl font-bold text-gray-800 mb-4">
                        <span className="text-red-600">Students with 0 Placements (Unplaced)</span> ({
                          unplacedLoading 
                            ? 0 
                            : unplacedStudents.filter(s => selectedStatBranch === 'all' || s.branch === selectedStatBranch).length
                        })
                      </h3>
                      {unplacedLoading ? (
                        <div className="text-center py-8">
                          <p className="text-gray-600">Loading unplaced students...</p>
                        </div>
                      ) : unplacedStudents.filter(s => selectedStatBranch === 'all' || s.branch === selectedStatBranch).length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-red-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Reg No</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Branch</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Batch</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {unplacedStudents.filter(s => selectedStatBranch === 'all' || s.branch === selectedStatBranch).map((student, idx) => (
                                <tr key={idx} className="hover:bg-red-50">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{student.regNo}</td>
                                  <td className="px-4 py-3 text-sm text-gray-800">{student.name}</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">{student.branch}</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">{student.batch}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="text-sm text-green-800">
                            ✓ Great! All students are placed or have placement records.
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {selectedStatCategory === 'one' && (
                    <>
                      <h3 className="text-xl font-bold text-gray-800 mb-4">
                        <span className="text-yellow-600">Students with 1 Placement</span> ({reportData.studentPlacementList.filter(s => s.count === 1 && (selectedStatBranch === 'all' || s.branch === selectedStatBranch)).length})
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-yellow-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Reg No</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Branch</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Batch</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Company</th>
                              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Package (LPA)</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Joined Company</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {reportData.studentPlacementList.filter(s => s.count === 1 && (selectedStatBranch === 'all' || s.branch === selectedStatBranch)).map((student, idx) => {
                              const studentCompanies = Array.isArray(student.companies) ? student.companies : (student.companiesString || student.companies || '').split(', ').filter(Boolean);
                              const currentJoinedCompany = joinedCompanies[student.regNo] || student.joinedCompany || 'Not yet joined';
                              return (
                                <tr key={idx} className="hover:bg-yellow-50">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{student.regNo}</td>
                                  <td className="px-4 py-3 text-sm text-gray-800">{student.name}</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">{student.branch}</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">{student.batch}</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    <div className="max-w-md">
                                      {studentCompanies.map((company, cIdx) => {
                                        const isJoined = currentJoinedCompany !== 'Not yet joined' && company === currentJoinedCompany;
                                        return (
                                          <span
                                            key={cIdx}
                                            className={`inline-block mr-2 mb-1 px-2 py-1 rounded text-xs ${
                                              isJoined
                                                ? 'bg-green-100 text-green-800 font-semibold border-2 border-green-500'
                                                : 'bg-gray-100 text-gray-700'
                                            }`}
                                            title={company}
                                          >
                                            {company}
                                            {isJoined && ' ✓'}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right text-sm font-semibold text-green-600">{student.maxPackage} LPA</td>
                                  <td className="px-4 py-3 text-sm">
                                    <select
                                      value={currentJoinedCompany}
                                      onChange={(e) => handleJoinedCompanyChange(student.regNo, e.target.value)}
                                      className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                      <option value="Not yet joined">Not yet joined</option>
                                      {studentCompanies.map((company, cIdx) => (
                                        <option key={cIdx} value={company}>{company}</option>
                                      ))}
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {reportData.studentPlacementList.filter(s => s.count === 1 && (selectedStatBranch === 'all' || s.branch === selectedStatBranch)).length === 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                          <p className="text-sm text-yellow-800 text-center">No students with exactly 1 placement found.</p>
                        </div>
                      )}
                    </>
                  )}

                  {selectedStatCategory === 'two' && (
                    <>
                      <h3 className="text-xl font-bold text-gray-800 mb-4">
                        <span className="text-blue-600">Students with 2 Placements</span> ({reportData.studentPlacementList.filter(s => s.count === 2 && (selectedStatBranch === 'all' || s.branch === selectedStatBranch)).length})
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-blue-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Reg No</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Branch</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Batch</th>
                              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Avg Package</th>
                              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Max Package</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Companies</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Joined Company</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {reportData.studentPlacementList.filter(s => s.count === 2 && (selectedStatBranch === 'all' || s.branch === selectedStatBranch)).map((student, idx) => {
                              const studentCompanies = Array.isArray(student.companies) ? student.companies : (student.companiesString || student.companies || '').split(', ').filter(Boolean);
                              const currentJoinedCompany = joinedCompanies[student.regNo] || student.joinedCompany || 'Not yet joined';
                              return (
                                <tr key={idx} className="hover:bg-blue-50">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{student.regNo}</td>
                                  <td className="px-4 py-3 text-sm text-gray-800">{student.name}</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">{student.branch}</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">{student.batch}</td>
                                  <td className="px-4 py-3 text-right text-sm text-gray-600 font-semibold">{student.avgPackage} LPA</td>
                                  <td className="px-4 py-3 text-right text-sm font-semibold text-green-600">{student.maxPackage} LPA</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    <div className="max-w-md">
                                      {studentCompanies.map((company, cIdx) => {
                                        const isJoined = currentJoinedCompany !== 'Not yet joined' && company === currentJoinedCompany;
                                        return (
                                          <span
                                            key={cIdx}
                                            className={`inline-block mr-2 mb-1 px-2 py-1 rounded text-xs ${
                                              isJoined
                                                ? 'bg-green-100 text-green-800 font-semibold border-2 border-green-500'
                                                : 'bg-gray-100 text-gray-700'
                                            }`}
                                            title={company}
                                          >
                                            {company}
                                            {isJoined && ' ✓'}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm">
                                    <select
                                      value={currentJoinedCompany}
                                      onChange={(e) => handleJoinedCompanyChange(student.regNo, e.target.value)}
                                      className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                      <option value="Not yet joined">Not yet joined</option>
                                      {studentCompanies.map((company, cIdx) => (
                                        <option key={cIdx} value={company}>{company}</option>
                                      ))}
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {reportData.studentPlacementList.filter(s => s.count === 2 && (selectedStatBranch === 'all' || s.branch === selectedStatBranch)).length === 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                          <p className="text-sm text-blue-800 text-center">No students with exactly 2 placements found.</p>
                        </div>
                      )}
                    </>
                  )}

                  {selectedStatCategory === 'more_than_two' && (
                    <>
                      <h3 className="text-xl font-bold text-gray-800 mb-4">
                        <span className="text-green-600">Students with More than 2 Placements</span> ({reportData.studentPlacementList.filter(s => s.count > 2 && (selectedStatBranch === 'all' || s.branch === selectedStatBranch)).length})
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-green-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Reg No</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Branch</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Batch</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700"># Placements</th>
                              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Avg Package</th>
                              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Max Package</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Companies</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Joined Company</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {reportData.studentPlacementList.filter(s => s.count > 2 && (selectedStatBranch === 'all' || s.branch === selectedStatBranch)).map((student, idx) => {
                              const studentCompanies = Array.isArray(student.companies) ? student.companies : (student.companiesString || student.companies || '').split(', ').filter(Boolean);
                              const currentJoinedCompany = joinedCompanies[student.regNo] || student.joinedCompany || 'Not yet joined';
                              return (
                                <tr key={idx} className="hover:bg-green-50">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{student.regNo}</td>
                                  <td className="px-4 py-3 text-sm text-gray-800">{student.name}</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">{student.branch}</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">{student.batch}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-semibold">
                                      {student.count}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right text-sm text-gray-600 font-semibold">{student.avgPackage} LPA</td>
                                  <td className="px-4 py-3 text-right text-sm font-semibold text-green-600">{student.maxPackage} LPA</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    <div className="max-w-md">
                                      {studentCompanies.map((company, cIdx) => {
                                        const isJoined = currentJoinedCompany !== 'Not yet joined' && company === currentJoinedCompany;
                                        return (
                                          <span
                                            key={cIdx}
                                            className={`inline-block mr-2 mb-1 px-2 py-1 rounded text-xs ${
                                              isJoined
                                                ? 'bg-green-100 text-green-800 font-semibold border-2 border-green-500'
                                                : 'bg-gray-100 text-gray-700'
                                            }`}
                                            title={company}
                                          >
                                            {company}
                                            {isJoined && ' ✓'}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm">
                                    <select
                                      value={currentJoinedCompany}
                                      onChange={(e) => handleJoinedCompanyChange(student.regNo, e.target.value)}
                                      className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                      <option value="Not yet joined">Not yet joined</option>
                                      {studentCompanies.map((company, cIdx) => (
                                        <option key={cIdx} value={company}>{company}</option>
                                      ))}
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {reportData.studentPlacementList.filter(s => s.count > 2 && (selectedStatBranch === 'all' || s.branch === selectedStatBranch)).length === 0 && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                          <p className="text-sm text-green-800 text-center">No students with more than 2 placements found.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add/Edit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                {editingPlacement ? 'Edit Placement' : 'Add New Placement'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Batch *</label>
                    <input
                      type="text"
                      required
                      value={formData.batch}
                      onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                      placeholder="e.g., 2022"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Branch *</label>
                    <input
                      type="text"
                      required
                      value={formData.branch}
                      onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                      placeholder="e.g., CSE"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Registration Number *</label>
                    <input
                      type="text"
                      required
                      value={formData.regNo}
                      onChange={(e) => setFormData({ ...formData, regNo: e.target.value })}
                      placeholder="e.g., 220101120003"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Student Name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Company Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      placeholder="Company Name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Package (LPA) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.package}
                      onChange={(e) => setFormData({ ...formData, package: e.target.value })}
                      placeholder="e.g., 8.5"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                  >
                    {editingPlacement ? 'Update' : 'Add'} Placement
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlacementManagement() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <PlacementManagementContent />
    </Suspense>
  );
}

// Advanced Analytics Component
function PlacementAnalytics() {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [allBatchesAnalyticsData, setAllBatchesAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState('overview');
  const [studentStrength, setStudentStrength] = useState(null);
  const [activeCompanyIndex, setActiveCompanyIndex] = useState(null);
  // Initialize selectedBatch from localStorage immediately to avoid race condition
  const [selectedBatch, setSelectedBatch] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('analyticsSelectedBatch');
        return saved || 'all';
      } catch {
        return 'all';
      }
    }
    return 'all';
  });
  const [selectedBranch, setSelectedBranch] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('analyticsSelectedBranch');
        return saved || 'all';
      } catch {
        return 'all';
      }
    }
    return 'all';
  });
  const [batchOptions, setBatchOptions] = useState([]);
  const [branchOptions, setBranchOptions] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const hasInitialFetch = useRef(false);

  useEffect(() => {
    const initialize = async () => {
      // Load batch and branch options
      const { batches, branches } = await fetchMeta();
      
      // Determine the batch to use
      let batchToUse = selectedBatch;
      if (selectedBatch === 'all' && batches.length > 0) {
        const latestBatch = batches[0];
        batchToUse = latestBatch;
        setSelectedBatch(latestBatch);
        try {
          localStorage.setItem('analyticsSelectedBatch', latestBatch);
        } catch {}
      }

      // Determine the branch to use
      let branchToUse = selectedBranch;
      
      // Fetch data with the determined parameters
      fetchAnalytics(batchToUse, branchToUse);
      fetchStudentStrength(batchToUse, branchToUse);
      fetchAllBatchesAnalytics(); // Always fetch all batches for Batch Analysis and Batch Trend
      
      hasInitialFetch.current = true;
      setIsInitialized(true);
    };
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  useEffect(() => {
    // Only fetch data when batch changes after initial fetch
    if (!hasInitialFetch.current) return;
    
    if (selectedBatch || selectedBranch) {
      fetchAnalytics(selectedBatch, selectedBranch);
      fetchAllBatchesAnalytics(); // Always fetch all batches for Batch Analysis and Batch Trend
      fetchStudentStrength(selectedBatch, selectedBranch);
    }
  }, [selectedBatch, selectedBranch]);

  const fetchMeta = async () => {
    try {
      const url = getSchoolApiUrl("placement/meta");
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return { batches: [], branches: [] };
      const data = await res.json();
      if (data?.success) {
        const batches = Array.isArray(data.batches) ? data.batches : [];
        const branches = Array.isArray(data.branches) ? data.branches : [];
        setBatchOptions(batches);
        setBranchOptions(branches);
        return { batches, branches };
      }
      return { batches: [], branches: [] };
    } catch {
      return { batches: [], branches: [] };
    }
  };

  const fetchAnalytics = async (batch, branch) => {
    try {
      setLoading(true);
      const baseUrl = getSchoolApiUrl('placement/analytics');
      const separator = baseUrl.includes('?') ? '&' : '?';
      const params = new URLSearchParams();
      if (batch && batch !== 'all') params.append('batch', batch);
      if (branch && branch !== 'all') params.append('branch', branch);
      
      const url = params.toString() ? `${baseUrl}${separator}${params}` : baseUrl;
      const response = await fetch(url, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAnalyticsData(data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllBatchesAnalytics = async () => {
    try {
      // Always fetch all batches data for Batch Analysis and Batch Trend
      const baseUrl = getSchoolApiUrl('placement/analytics');
      const response = await fetch(baseUrl, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAllBatchesAnalyticsData(data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching all batches analytics:', err);
    }
  };

  const fetchStudentStrength = async (batch, branch) => {
    try {
      const baseUrl = getSchoolApiUrl('placement/student-strength');
      const separator = baseUrl.includes('?') ? '&' : '?';
      const params = new URLSearchParams();
      if (batch && batch !== 'all') params.append('batch', batch);
      if (branch && branch !== 'all') params.append('branch', branch);
      
      const url = params.toString() ? `${baseUrl}${separator}${params}` : baseUrl;
      const response = await fetch(url, {
        credentials: 'include'
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data.success) {
        setStudentStrength(data);
      }
    } catch (err) {
      console.error('Error fetching student strength for analytics:', err);
    }
  };

  const handleExportCompanyPDF = async () => {
    if (!analyticsData || !companyChartData.length) {
      alert('No company data available to export');
      return;
    }

    try {
      // Ensure autotable plugin is loaded
      if (typeof window !== 'undefined') {
        await import('jspdf-autotable');
      }
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 20;

      // Header
      doc.setFontSize(20);
      doc.setTextColor(0, 88, 254);
      doc.text('COMPANY ANALYSIS REPORT', pageWidth / 2, y, { align: 'center' });
      y += 10;

      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      const batchText = selectedBatch && selectedBatch !== 'all' ? `Batch: ${selectedBatch}` : 'All Batches';
      doc.text(batchText, pageWidth / 2, y, { align: 'center' });
      y += 15;

      // Company Statistics Table
      doc.setFontSize(16);
      doc.setTextColor(25, 118, 210);
      doc.text('Company Statistics', 20, y);
      y += 8;
      
      // Subtitle/Description
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Top Companies with Branch-wise Breakdown', 20, y);
      y += 10;

      const companyTableData = companyChartData.map((item, idx) => [
        (idx + 1).toString(), // Index
        item.fullName, // Company
        item.hires.toString(), // No of Students
        item.avgPackage.toFixed(2), // Package
        Object.entries(item.branchCounts || {}).map(([br, cnt]) => `${br}: ${cnt}`).join(', ') // Branch
      ]);

      // Use autoTable if available (same pattern as other files)
      if (typeof doc.autoTable !== 'undefined') {
        doc.autoTable({
          startY: y,
          head: [['Index', 'Company', 'No of Students', 'Package (LPA)', 'Branch']],
          body: companyTableData,
          styles: { 
            fontSize: 8,
            cellPadding: 2,
            overflow: 'linebreak',
            cellWidth: 'wrap'
          },
          headStyles: { 
            fillColor: [59, 130, 246],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          },
          columnStyles: {
            0: { cellWidth: 15, halign: 'center' }, // Index
            1: { cellWidth: 60 }, // Company name
            2: { cellWidth: 25, halign: 'center' }, // No of Students
            3: { cellWidth: 25, halign: 'center' }, // Package
            4: { cellWidth: 80, cellMinWidth: 80 } // Branch - wider column
          },
          margin: { top: y, left: 20, right: 20 },
          tableWidth: 'auto'
        });
      } else {
        // Fallback: Create simple table manually
        const headers = ['Index', 'Company', 'No of Students', 'Package (LPA)', 'Branch'];
        const colWidths = [15, 55, 25, 25, 70]; // Adjusted column widths including Index
        let x = 20;
        
        // Draw headers
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.setFillColor(59, 130, 246);
        headers.forEach((header, idx) => {
          doc.rect(x, y, colWidths[idx], 8, 'F');
          doc.text(header, x + 2, y + 6);
          x += colWidths[idx];
        });
        y += 8;
        
        // Draw rows
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        companyTableData.forEach((row) => {
          if (y > 280) {
            doc.addPage();
            y = 20;
          }
          
          // Calculate row height based on longest cell (especially branches)
          let rowHeight = 8;
          const branchText = String(row[4]); // Branch is now at index 4
          const maxCharsPerLine = Math.floor(colWidths[4] / 2.5);
          let branchLines = 1;
          if (branchText.length > maxCharsPerLine) {
            const parts = branchText.split(', ');
            let currentLine = '';
            parts.forEach((part, partIdx) => {
              if (partIdx === 0 || (currentLine + ', ' + part).length <= maxCharsPerLine) {
                currentLine = currentLine ? currentLine + ', ' + part : part;
              } else {
                branchLines++;
                currentLine = part;
              }
            });
          }
          rowHeight = Math.max(8, branchLines * 4 + 4);
          
          x = 20;
          row.forEach((cell, colIdx) => {
            doc.rect(x, y, colWidths[colIdx], rowHeight, 'S');
            let cellText = String(cell);
            
            // For branches column (index 4), show full text with wrapping
            if (colIdx === 4) {
              if (branchText.length > maxCharsPerLine) {
                const parts = branchText.split(', ');
                let currentLine = '';
                let lineY = y + 4;
                parts.forEach((part, partIdx) => {
                  if (partIdx === 0 || (currentLine + ', ' + part).length <= maxCharsPerLine) {
                    currentLine = currentLine ? currentLine + ', ' + part : part;
                  } else {
                    doc.text(currentLine, x + 2, lineY);
                    lineY += 4;
                    currentLine = part;
                  }
                });
                doc.text(currentLine, x + 2, lineY);
              } else {
                doc.text(branchText, x + 2, y + rowHeight / 2);
              }
            } else {
              // For other columns (Index, Company, No of Students, Package), center align and truncate if needed
              cellText = cellText.substring(0, Math.floor(colWidths[colIdx] / 2.5));
              const textX = colIdx === 0 || colIdx === 2 || colIdx === 3 ? x + colWidths[colIdx] / 2 : x + 2; // Center for Index, No of Students, Package
              const textY = y + rowHeight / 2;
              if (colIdx === 0 || colIdx === 2 || colIdx === 3) {
                doc.text(cellText, textX, textY, { align: 'center' });
              } else {
                doc.text(cellText, textX, textY);
              }
            }
            x += colWidths[colIdx];
          });
          y += rowHeight;
        });
      }

      doc.save(`Company_Analysis_${selectedBatch !== 'all' ? selectedBatch : 'All'}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  // Prepare chart data (safe defaults when analyticsData not yet loaded)
  // For Batch Analysis and Batch Trend, use all batches data
  // For other views, use filtered data based on selectedBatch
  const strengthByBranch = studentStrength?.byBranch || {};
  const branchStats = analyticsData?.branchStats || {};
  // Use allBatchesAnalyticsData for batch stats to show trends across all batches
  const batchStats = (selectedView === 'batch' || selectedView === 'overview') 
    ? (allBatchesAnalyticsData?.batchStats || {}) 
    : (analyticsData?.batchStats || {});
  const companyStats = analyticsData?.companyStats || {};

  const branchChartData = Object.entries(branchStats).map(([branch, stats]) => {
    const totalStudents = strengthByBranch[branch] || 0;
    const placementPercent = totalStudents > 0
      ? (stats.count / totalStudents) * 100
      : 0;
    return {
      name: branch,
      placements: stats.count,
      totalStudents,
      placementPercent: parseFloat(placementPercent.toFixed(2)),
      avgPackage: parseFloat(stats.avgPackage?.toFixed(2) || 0),
      maxPackage: parseFloat(stats.maxPackage?.toFixed(2) || 0)
    };
  });

  const batchChartData = Object.entries(batchStats || {})
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([batch, stats]) => ({
      name: batch,
      placements: stats.count,
      avgPackage: parseFloat(stats.avgPackage?.toFixed(2) || 0)
    }));

  const companyChartData = Object.entries(companyStats || {})
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([company, stats]) => {
      const branchCounts = stats.branchCounts || {};
      const datum = {
        name: company, // Show full name, no truncation
        fullName: company,
        hires: stats.count,
        avgPackage: parseFloat(stats.avgPackage?.toFixed(2) || 0),
        branchCounts
      };

      // Explicit fields per branch for stacked charts
      const knownBranches = ['CSE', 'Civil', 'ECE', 'EEE', 'MECH', 'CSE AIML'];
      let other = 0;
      Object.entries(branchCounts).forEach(([br, c]) => {
        if (knownBranches.includes(br)) {
          datum[br] = c;
        } else {
          other += c;
        }
      });
      knownBranches.forEach(br => {
        datum[br] = datum[br] || 0;
      });
      datum.Other = other;

      return datum;
    });

  const companyChartWithActiveBranches = useMemo(
    () =>
      companyChartData.map((item, index) => {
        const isActive = index === activeCompanyIndex;
        return {
          ...item,
          CSE: isActive ? item.CSE : 0,
          Civil: isActive ? item.Civil : 0,
          ECE: isActive ? item.ECE : 0,
          EEE: isActive ? item.EEE : 0,
          MECH: isActive ? item.MECH : 0,
          Other: isActive ? item.Other : 0
        };
      }),
    [companyChartData, activeCompanyIndex]
  );

  const packageDistribution = branchChartData.map((item, idx) => ({
    name: item.name,
    value: item.avgPackage,
    color: COLORS[idx % COLORS.length]
  }));

  // Histogram buckets for packages (LPA)
  const allPackages = Object.values(companyStats || {})
    .flatMap(s => (s.packages || []).map(n => Number(n)).filter(Number.isFinite));
  const buckets = [
    { label: "0-3", min: 0, max: 3 },
    { label: "3-6", min: 3, max: 6 },
    { label: "6-10", min: 6, max: 10 },
    { label: "10-15", min: 10, max: 15 },
    { label: "15+", min: 15, max: Infinity },
  ];
  const packageHistogram = buckets.map(b => ({
    range: b.label,
    count: allPackages.filter(p => p >= b.min && p < b.max).length,
  }));

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading analytics...</p>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
        <p className="text-gray-600">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <h3 className="text-sm font-medium opacity-90 mb-2">Total Placements</h3>
          <p className="text-4xl font-bold">{analyticsData.totalPlacements || 0}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <h3 className="text-sm font-medium opacity-90 mb-2">Average Package</h3>
          <p className="text-4xl font-bold">{analyticsData.avgPackage?.toFixed(2) || '0.00'} LPA</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <h3 className="text-sm font-medium opacity-90 mb-2">Highest Package</h3>
          <p className="text-4xl font-bold">{analyticsData.maxPackage || '0.00'} LPA</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
          <h3 className="text-sm font-medium opacity-90 mb-2">Companies</h3>
          <p className="text-4xl font-bold">{analyticsData.totalCompanies || 0}</p>
        </div>
      </div>

      {/* View Tabs */}
      <div className="bg-white rounded-2xl shadow-xl p-4">
        <div className="flex gap-2 border-b">
          {['overview', 'branch', 'batch', 'company'].map(view => (
            <button
              key={view}
              onClick={() => setSelectedView(view)}
              className={`px-4 py-2 font-semibold capitalize transition-colors ${selectedView === view
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              {view} Analysis
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            <select
              value={selectedBranch}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedBranch(val);
                try {
                  localStorage.setItem('analyticsSelectedBranch', val);
                } catch {}
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="all">All Branches</option>
              {branchOptions.map((br) => (
                <option key={br} value={br}>{br}</option>
              ))}
            </select>
            <select
              value={selectedBatch}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedBatch(val);
                try {
                  localStorage.setItem('analyticsSelectedBatch', val);
                } catch {}
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="all">All Batches</option>
              {batchOptions.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Branch Analysis */}
      {selectedView === 'branch' && branchChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Placement Percent by Branch</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={branchChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="placementPercent" fill="#0088FE" name="Placement %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Average Package by Branch</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={branchChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgPackage" fill="#00C49F" name="Avg Package (LPA)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Branch-wise Statistics</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total Students</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Placements</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Placement %</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Package (LPA)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Max Package (LPA)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {branchChartData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">
                        {item.totalStudents || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">{item.placements}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600 font-semibold">
                        {item.totalStudents ? `${item.placementPercent.toFixed(2)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600 font-semibold">{item.avgPackage.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600 font-semibold">{item.maxPackage.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Batch Analysis */}
      {selectedView === 'batch' && batchChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Placements by Batch</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={batchChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="placements" stroke="#8884d8" strokeWidth={2} name="Placements" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Average Package Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={batchChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="avgPackage" stroke="#82ca9d" strokeWidth={2} name="Avg Package (LPA)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Batch-wise Statistics</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Placements</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Package (LPA)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Max Package (LPA)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {batchChartData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">{item.placements}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600 font-semibold">{item.avgPackage.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600 font-semibold">
                        {analyticsData.batchStats?.[item.name]?.maxPackage?.toFixed(2) || '0.00'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Company Analysis */}
      {selectedView === 'company' && companyChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Top Companies by Hires</h2>
              <button
                onClick={handleExportCompanyPDF}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold text-sm flex items-center gap-2"
              >
                📄 Export PDF
              </button>
            </div>
            <ResponsiveContainer width="100%" height={Math.max(400, companyChartData.length * 40)}>
              <BarChart data={companyChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={200}
                  tick={{ fontSize: 12 }}
                  angle={0}
                />
                <Tooltip />
                <Legend />
                <Bar dataKey="hires" fill="#FF8042" name="Hires" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Package Distribution by Branch</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={packageDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#8884d8" name="Avg Package (LPA)">
                  {packageDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">All Companies (Branch Breakdown)</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase w-16 bg-blue-50">Index</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Company</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">No of Students</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Package (LPA)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Branch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {companyChartData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-center text-gray-900 font-bold w-16 bg-blue-50">{idx + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.fullName}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">{item.hires}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600 font-semibold">{item.avgPackage.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-left">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(item.branchCounts || {}).map(([branch, count]) => (
                            <span
                              key={branch}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                              style={{
                                backgroundColor:
                                  branch === 'CSE'
                                    ? '#3B82F6'
                                    : branch === 'Civil'
                                      ? '#F97316'
                                      : branch === 'ECE'
                                        ? '#A855F7'
                                        : branch === 'EEE'
                                          ? '#22C55E'
                                          : branch === 'MECH'
                                            ? '#0EA5E9'
                                            : '#9CA3AF'
                              }}
                            >
                              {branch}: {count}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Overview */}
      {selectedView === 'overview' && (
        <div className="space-y-6">
          {/* Row 1: Placement Percent by Branch (full width) */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Placement Percent by Branch</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={branchChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="placementPercent" fill="#0088FE" name="Placement %" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Row 2: Batch Trend + Package Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Batch Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={batchChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="placements" stroke="#8884d8" strokeWidth={2} name="Placements" />
                  <Line type="monotone" dataKey="avgPackage" stroke="#82ca9d" strokeWidth={2} name="Avg Package (LPA)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Package Distribution by Branch</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={packageDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#8884d8" name="Avg Package (LPA)">
                    {packageDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 3: Package Histogram */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Package Distribution (Histogram)</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={packageHistogram}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#00C49F" name="Students" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Row 4: Top Companies (bigger, last) */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Top Companies</h2>
            <ResponsiveContainer width="100%" height={Math.max(380, companyChartData.length * 30)}>
              <BarChart
                data={companyChartWithActiveBranches}
                onMouseMove={(state) => {
                  if (state && typeof state.activeTooltipIndex === 'number') {
                    setActiveCompanyIndex(state.activeTooltipIndex);
                  }
                }}
                onMouseLeave={() => setActiveCompanyIndex(null)}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={Math.max(100, companyChartData.length * 15)}
                  tick={{ fontSize: 11 }}
                  interval={0}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="hires" fill="#F97316" name="Total Hires" />
                <Bar dataKey="CSE" stackId="branches" fill="#3B82F6" name="CSE" />
                <Bar dataKey="Civil" stackId="branches" fill="#F97316" name="Civil" />
                <Bar dataKey="ECE" stackId="branches" fill="#A855F7" name="ECE" />
                <Bar dataKey="EEE" stackId="branches" fill="#22C55E" name="EEE" />
                <Bar dataKey="MECH" stackId="branches" fill="#0EA5E9" name="MECH" />
                <Bar dataKey="Other" stackId="branches" fill="#9CA3AF" name="Other" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
