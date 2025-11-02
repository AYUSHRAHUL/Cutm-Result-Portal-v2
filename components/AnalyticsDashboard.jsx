"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DepartmentChart,
  SemesterChart,
  DataSourceChart,
} from "./charts/ChartComponents";
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
} from "recharts";

export default function AnalyticsDashboard() {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [filteredData, setFilteredData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  // Filters
  const [selectedBatch, setSelectedBatch] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [selectedSubjectToAdd, setSelectedSubjectToAdd] = useState(""); // Subject selection state for dropdown
  const [basketSubjects, setBasketSubjects] = useState([]); // Basket subjects from cbcs collection
  const [loadingBasketSubjects, setLoadingBasketSubjects] = useState(false);
  const [overviewBatchFilter, setOverviewBatchFilter] = useState("all"); // Separate filter for Department Distribution only
  const [filteredDepartmentStats, setFilteredDepartmentStats] = useState(null); // Separate state for filtered department stats
  
  // Top Performing Students specific filters
  const [topStudentsBatch, setTopStudentsBatch] = useState("all");
  const [topStudentsBranch, setTopStudentsBranch] = useState("all");
  const [topStudentsSearch, setTopStudentsSearch] = useState("");

  // Passing Analysis specific filters and state
  const [passingAnalysisBatch, setPassingAnalysisBatch] = useState("all");
  const [passingAnalysisBranch, setPassingAnalysisBranch] = useState("all");
  const [filteredPassingStats, setFilteredPassingStats] = useState(null);
  const [filteredPassingStatsByBatch, setFilteredPassingStatsByBatch] = useState(null);
  const [filteredPassingStatsByBranch, setFilteredPassingStatsByBranch] = useState(null);
  const [loadingPassingStats, setLoadingPassingStats] = useState(false);

  const batches = ["all", "2022", "2023", "2024", "2025", "2026", "2027", "2028"];
  const branches = ["all", "CSE", "ECE", "EEE", "ME", "CIVIL", "AIML"];

  // Fetch basket subjects from cbcs collection
  const fetchBasketSubjects = useCallback(async () => {
    try {
      setLoadingBasketSubjects(true);
      const response = await fetch("/api/cbcs?limit=1000", {
        method: "GET",
        credentials: "include",
      });
      
      if (!response.ok) {
        console.error("Failed to fetch basket subjects:", response.status, response.statusText);
        setBasketSubjects([]);
        return;
      }

      const result = await response.json();
      console.log("Basket subjects API response:", result);

      if (!result.success) {
        console.error("API returned success: false", result);
        setBasketSubjects([]);
        return;
      }

      const items = result.items || [];
      console.log("Basket subjects items:", items.length, "items found");

      if (items.length === 0) {
        console.warn("No basket subjects found in database");
        setBasketSubjects([]);
        return;
      }

      // Get unique subjects (Subject Code)
      // Handle both "Subject Code" and "SubjectCode" field names
      const uniqueSubjects = Array.from(
        new Map(
          items
            .filter(item => {
              // Filter out items without a subject code
              const subjectCode = item["Subject Code"] || item.SubjectCode || item["SubjectCode"];
              return subjectCode && subjectCode.trim() !== "";
            })
            .map(item => {
              const subjectCode = item["Subject Code"] || item.SubjectCode || item["SubjectCode"];
              const subjectName = item.Subject_name || item.SubjectName || item["SubjectName"] || subjectCode;
              
              return [
                subjectCode.trim().toUpperCase(),
                {
                  code: subjectCode.trim().toUpperCase(),
                  name: subjectName.trim(),
                  basket: item.Basket || "",
                  branch: item.Branch || "",
                  credits: item.Credits || ""
                }
              ];
            })
        ).values()
      ).sort((a, b) => a.code.localeCompare(b.code));
      
      console.log("Processed unique basket subjects:", uniqueSubjects.length);
      setBasketSubjects(uniqueSubjects);
    } catch (err) {
      console.error("Error fetching basket subjects:", err);
      setBasketSubjects([]);
    } finally {
      setLoadingBasketSubjects(false);
    }
  }, []);

  // Fetch analytics data (always fetches all data, filtering happens client-side)
  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch("/api/analytics", {
        method: "GET",
        credentials: "include", // Include cookies for authentication
      });
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch analytics data");
      }
      
      if (!result.success || !result.data) {
        throw new Error("Invalid response format from API");
      }
      
      console.log("Analytics data loaded:", result.data);
      setAnalyticsData(result.data);
      return result.data; // Return data for promise handling
    } catch (err) {
      console.error("Error fetching analytics:", err);
      setError(err.message || "An error occurred while fetching analytics data");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch (only on mount)
  useEffect(() => {
    fetchAnalyticsData();
    fetchBasketSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch filtered department stats when overviewBatchFilter changes (ONLY for Department Distribution chart)
  useEffect(() => {
    if (!analyticsData) return; // Wait for initial data
    
    const fetchFilteredDepartmentStats = async () => {
      try {
        if (overviewBatchFilter === "all") {
          // Use original department stats
          setFilteredDepartmentStats(analyticsData.departmentStats || null);
        } else {
          // Fetch filtered data from API
          const response = await fetch(`/api/analytics?batch=${overviewBatchFilter}`, {
            method: "GET",
            credentials: "include",
          });
          const result = await response.json();
          
          if (response.ok && result.success && result.data?.departmentStats) {
            setFilteredDepartmentStats(result.data.departmentStats);
          } else {
            // Fallback to original if filtered fetch fails
            setFilteredDepartmentStats(analyticsData.departmentStats || null);
          }
        }
      } catch (err) {
        console.error("Error fetching filtered department stats:", err);
        // Fallback to original on error
        setFilteredDepartmentStats(analyticsData.departmentStats || null);
      }
    };

    fetchFilteredDepartmentStats();
  }, [overviewBatchFilter, analyticsData]);

  // Fetch filtered passing stats when passingAnalysisBatch or passingAnalysisBranch changes
  useEffect(() => {
    if (!analyticsData) return;
    
    const abortController = new AbortController();
    
    const fetchFilteredPassingStats = async () => {
      try {
        setLoadingPassingStats(true);
        
        // Build query params
        const params = new URLSearchParams();
        if (passingAnalysisBatch !== "all") {
          params.append("batch", passingAnalysisBatch);
        }
        if (passingAnalysisBranch !== "all") {
          params.append("branch", passingAnalysisBranch);
        }
        
        // If no filters, use original data
        if (passingAnalysisBatch === "all" && passingAnalysisBranch === "all") {
          setFilteredPassingStats(null);
          setFilteredPassingStatsByBatch(null);
          setFilteredPassingStatsByBranch(null);
          setLoadingPassingStats(false);
          return;
        }
        
        // Fetch filtered data from API
        const url = `/api/analytics${params.toString() ? `?${params.toString()}` : ""}`;
        const response = await fetch(url, {
          method: "GET",
          credentials: "include",
          signal: abortController.signal,
        });
        const result = await response.json();
        
        if (response.ok && result.success) {
          if (result.data?.performanceMetrics) {
            setFilteredPassingStats(result.data.performanceMetrics);
          }
          // If breakdown by batch is available (branch selected, batch = all)
          if (result.data?.performanceMetricsByBatch) {
            setFilteredPassingStatsByBatch(result.data.performanceMetricsByBatch);
          } else {
            setFilteredPassingStatsByBatch(null);
          }
          // If breakdown by branch is available (batch selected, branch = all)
          if (result.data?.performanceMetricsByBranch) {
            setFilteredPassingStatsByBranch(result.data.performanceMetricsByBranch);
          } else {
            setFilteredPassingStatsByBranch(null);
          }
        } else {
          setFilteredPassingStats(null);
          setFilteredPassingStatsByBatch(null);
          setFilteredPassingStatsByBranch(null);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error("Error fetching filtered passing stats:", err);
          setFilteredPassingStats(null);
          setFilteredPassingStatsByBatch(null);
          setFilteredPassingStatsByBranch(null);
        }
      } finally {
        setLoadingPassingStats(false);
      }
    };
    
    fetchFilteredPassingStats();
    
    return () => {
      abortController.abort();
    };
  }, [passingAnalysisBatch, passingAnalysisBranch, analyticsData]);

  // Helper function to extract batch from regNo
  const getBatchFromRegNo = (regNo) => {
    if (!regNo) return null;
    const regNoStr = String(regNo);
    return regNoStr.length >= 2 ? `20${regNoStr.substring(0, 2)}` : null;
  };

  // Helper function to extract branch from regNo
  const getBranchFromRegNo = (regNo) => {
    if (!regNo) return null;
    const regNoStr = String(regNo);
    const deptCode = regNoStr.length >= 8 ? regNoStr.charAt(7) : "";
    const deptMap = {
      '1': 'Civil Engineering',
      '2': 'Computer Science Engineering',
      '3': 'Electronics & Communication Engineering',
      '4': 'Electronics & Communication Engineering', // Alternative code for ECE
      '5': 'Electrical & Electronics Engineering',
      '6': 'Mechanical Engineering',
      '7': 'AIML',
      '8': 'Computer Science Engineering', // Alternative code for CSE
      '9': 'Civil Engineering' // Alternative code for Civil
    };
    return deptMap[deptCode] || null;
  };

  // Apply filters
  useEffect(() => {
    if (!analyticsData) return;
    let filtered = { ...analyticsData };
    const term = searchTerm.toLowerCase();

    if (term) {
      if (filtered.departmentStats) {
        filtered.departmentStats = filtered.departmentStats.filter((d) =>
          d.name.toLowerCase().includes(term)
        );
      }
      if (filtered.topPerformingStudents) {
        filtered.topPerformingStudents = filtered.topPerformingStudents.filter(
          (s) => s.regNo?.toLowerCase().includes(term)
        );
      }
    }

    // Batch/Branch Filters for top students (extract from regNo)
    if (filtered.topPerformingStudents) {
      filtered.topPerformingStudents = filtered.topPerformingStudents.filter((s) => {
        const regNo = String(s.regNo || "");
        const batch = getBatchFromRegNo(regNo);
        const branch = getBranchFromRegNo(regNo);
        
        // Branch abbreviation mapping
        const branchMap = {
          'CSE': 'Computer Science Engineering',
          'ECE': 'Electronics & Communication Engineering',
          'EEE': 'Electrical & Electronics Engineering',
          'ME': 'Mechanical Engineering',
          'CIVIL': 'Civil Engineering',
          'AIML': 'AIML'
        };
        const normalizedBranch = branchMap[selectedBranch] || selectedBranch;
        
        const batchMatch = selectedBatch === "all" || batch === selectedBatch;
        const branchMatch = selectedBranch === "all" || 
          branch?.toLowerCase().includes(normalizedBranch.toLowerCase()) ||
          branch?.toLowerCase().includes(selectedBranch.toLowerCase());
        
        return batchMatch && branchMatch;
      });
    }

    setFilteredData(filtered);
  }, [analyticsData, searchTerm, selectedBatch, selectedBranch]);

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center h-96 text-white">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mb-4"></div>
        <p>Loading analytics data...</p>
      </div>
    );

  if (error)
    return (
      <div className="text-center py-12">
        <p className="text-red-400 font-bold">{error}</p>
        <button
          onClick={fetchAnalyticsData}
          className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Retry
        </button>
      </div>
    );

  const currentData = filteredData || analyticsData;

  // ======================== Passing Analysis ========================
  const getPassingAnalysis = () => {
    // Use filtered passing stats if available, otherwise fall back to original
    const metrics = filteredPassingStats !== null ? filteredPassingStats : currentData?.performanceMetrics;
    
    if (!metrics) {
      return { total: 0, passed: 0, fail: 0, passRate: 0 };
    }

    return {
      total: metrics.totalRecords || 0,
      passed: metrics.passedRecords || 0,
      fail: metrics.failedRecords || 0,
      passRate: metrics.passRate?.toFixed(1) || "0"
    };
  };

  const passingStats = getPassingAnalysis();

  // Check if we should show breakdown by batch (branch selected, batch = all)
  const showBatchBreakdown = passingAnalysisBranch !== "all" && passingAnalysisBatch === "all" && filteredPassingStatsByBatch && filteredPassingStatsByBatch.length > 0;
  
  // Check if we should show breakdown by branch (batch selected, branch = all)
  const showBranchBreakdown = passingAnalysisBatch !== "all" && passingAnalysisBranch === "all" && filteredPassingStatsByBranch && filteredPassingStatsByBranch.length > 0;
  
  // Bar chart data - either breakdown by batch, breakdown by branch, or simple pass/fail
  let passFailData = [];
  if (showBatchBreakdown) {
    // Show breakdown by batch (when branch selected, batch = all)
    passFailData = filteredPassingStatsByBatch.map(item => ({
      batch: item.batch,
      Passed: item.passed,
      Failed: item.failed,
      Total: item.total
    }));
  } else if (showBranchBreakdown) {
    // Show breakdown by branch (when batch selected, branch = all)
    passFailData = filteredPassingStatsByBranch.map(item => ({
      branch: item.branch,
      Passed: item.passed,
      Failed: item.failed,
      Total: item.total
    }));
  } else {
    // Simple pass/fail chart
    passFailData = [
      { name: "Passed", value: passingStats.passed, fill: "#22c55e" },
      { name: "Failed", value: passingStats.fail, fill: "#ef4444" },
    ];
  }

  // ====================== Subject Passing Comparison ======================
  const getSubjectComparisonData = () => {
    // Use subjectDifficultyAnalysis from API which has passRate and gradeDistribution
    // Subjects come from basket subjects (selectedSubjects contains subject codes)
    if (!currentData?.subjectDifficultyAnalysis || selectedSubjects.length === 0) {
      console.log("No subject data available:", {
        hasData: !!currentData?.subjectDifficultyAnalysis,
        selectedCount: selectedSubjects.length,
        subjects: selectedSubjects
      });
      return [];
    }

    const availableSubjects = currentData.subjectDifficultyAnalysis || [];
    console.log("Getting subject comparison data:", {
      selectedSubjects,
      availableSubjectsCount: availableSubjects.length,
      availableSubjects: availableSubjects.map(s => s.subject).slice(0, 10) // First 10 for debugging
    });

    // Process ALL selected subjects, don't filter out
    const comparisonData = selectedSubjects.map((subjectCode) => {
      // Normalize subject code for matching
      const normalizedCode = String(subjectCode).trim().toUpperCase();
      
      // Try multiple matching strategies - exact match first, then partial
      let subData = availableSubjects.find((s) => {
        const normalizedSubject = String(s.subject || "").trim().toUpperCase();
        return normalizedSubject === normalizedCode;
      });

      // If exact match not found, try partial matching (but be careful)
      if (!subData) {
        subData = availableSubjects.find((s) => {
          const normalizedSubject = String(s.subject || "").trim().toUpperCase();
          // Try if either contains the other (for cases like CUTM1058 vs CUTM1058X)
          return normalizedSubject.includes(normalizedCode) || normalizedCode.includes(normalizedSubject);
        });
      }

      console.log(`Subject ${subjectCode}:`, {
        normalizedCode,
        found: !!subData,
        matchedSubject: subData?.subject,
        passRate: subData?.passRate,
        totalStudents: subData?.totalStudents
      });

      // If no data found, return zero values but keep the subject in the list
      if (!subData) {
        console.warn(`No data found for subject: ${subjectCode}. Showing with 0 values.`);
        return { 
          subject: subjectCode, 
          passRate: 0, 
          failRate: 0,
          totalStudents: 0,
          passed: 0,
          failed: 0,
          average: 0,
          hasData: false
        };
      }

      // Calculate failed count from gradeDistribution
      const gradeDistribution = subData.gradeDistribution || {};
      const failedGrades = ['F', 'S', 'M', 'I', 'R'];
      const failedCount = failedGrades.reduce((sum, grade) => {
        return sum + (gradeDistribution[grade] || 0);
      }, 0);
      
      const totalStudents = subData.totalStudents || 0;
      const passedCount = totalStudents - failedCount;
      const passRate = parseFloat(subData.passRate || 0);
      const failRate = totalStudents > 0 ? ((failedCount / totalStudents) * 100).toFixed(1) : 0;

      return {
        subject: subjectCode,
        passRate: passRate,
        failRate: parseFloat(failRate),
        totalStudents: totalStudents,
        passed: passedCount,
        failed: failedCount,
        average: parseFloat(subData.average || 0),
        hasData: true
      };
    });

    // Log summary
    const withData = comparisonData.filter(item => item.hasData).length;
    const withoutData = comparisonData.filter(item => !item.hasData).length;
    console.log(`Subject comparison summary: ${withData} with data, ${withoutData} without data`);
    
    // Return ALL subjects, don't filter - let the UI show which ones have data
    return comparisonData;
  };

  const subjectComparisonData = getSubjectComparisonData();

  // Add subject to comparison list
  const handleAddSubject = () => {
    if (!selectedSubjectToAdd) return;
    
    // Check if already added
    if (selectedSubjects.includes(selectedSubjectToAdd)) {
      return; // Already added
    }
    
    // Check limit
    if (selectedSubjects.length >= 6) {
      return; // Already at max
    }
    
    // Add to list
    setSelectedSubjects([...selectedSubjects, selectedSubjectToAdd]);
    setSelectedSubjectToAdd(""); // Reset dropdown
  };

  // Remove subject from comparison list
  const handleRemoveSubject = (subjectCode) => {
    setSelectedSubjects(selectedSubjects.filter(code => code !== subjectCode));
  };


  // ========================= Render =========================
  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="text-center mb-8">
        <h2 className="text-4xl font-black bg-gradient-to-r from-white via-blue-300 to-purple-300 bg-clip-text text-transparent">
          📊 Analytics Dashboard
        </h2>
        <p className="text-blue-200/80 mt-2 text-lg">
          Real-time insights, Passing Analysis & Top Performers
        </p>
      </div>

      {/* TABS */}
      <div className="flex flex-wrap justify-center gap-4 mb-8">
        {[
          { key: "overview", label: "📈 Overview" },
          { key: "passinganalysis", label: "✅ Passing Analysis" },
          { key: "performance", label: "🎯 Performance" },
          { key: "topstudents", label: "🏆 Top Performing Students" }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-6 py-2 rounded-full font-bold transition-all ${
              activeTab === tab.key
                ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {currentData?.dataSourceStats && (
          <CoolChartCard title="Data Source Distribution" icon="📊">
            <DataSourceChart data={currentData.dataSourceStats} />
          </CoolChartCard>
          )}

          {((filteredDepartmentStats && filteredDepartmentStats.length > 0) || 
            (currentData?.departmentStats && currentData.departmentStats.length > 0)) && (
            <CoolChartCard title="Department Distribution" icon="🏢">
              <div className="flex flex-wrap justify-end gap-3 mb-4">
                <FilterSelect
                  value={overviewBatchFilter}
                  onChange={setOverviewBatchFilter}
                  options={batches}
                  label="Batch"
                />
              </div>
              {overviewBatchFilter !== "all" && (
                <div className="mb-4 px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-sm text-blue-300 font-semibold">
                  📅 Filtered by Batch: {overviewBatchFilter}
                </div>
              )}
              <DepartmentChart data={filteredDepartmentStats || currentData?.departmentStats || []} />
            </CoolChartCard>
          )}

          {currentData?.semesterStats && currentData.semesterStats.length > 0 && (
            <CoolChartCard title="Semester Distribution" icon="📚">
              <SemesterChart data={currentData.semesterStats} />
            </CoolChartCard>
          )}

          {(!currentData?.dataSourceStats && 
            (!currentData?.departmentStats || currentData.departmentStats.length === 0) &&
            (!currentData?.semesterStats || currentData.semesterStats.length === 0)) && (
            <CoolChartCard title="No Data Available" icon="📊" fullWidth>
              <div className="text-center py-12 text-white/70">
                <p>No analytics data available yet.</p>
                <p className="text-sm text-white/50 mt-2">
                  Upload student records to see analytics.
                </p>
              </div>
            </CoolChartCard>
          )}
        </div>
      )}

      {/* PASSING ANALYSIS TAB */}
      {activeTab === "passinganalysis" && (
        <div className="space-y-10">
          {/* PASSING ANALYSIS */}
          <CoolChartCard title="Passing Analysis" icon="✅" fullWidth>
            {/* Enhanced Filter Section */}
            <div className="mb-6 p-5 rounded-2xl border border-white/10 bg-gradient-to-r from-white/5 via-white/5 to-white/5 backdrop-blur-sm">
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                <div className="flex items-center gap-2 text-white/90 font-semibold">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  <span className="text-lg">Filter Options</span>
                </div>
                
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="flex items-center gap-2">
                    <label className="text-white/70 text-sm font-medium">Batch:</label>
              <FilterSelect
                      value={passingAnalysisBatch}
                      onChange={setPassingAnalysisBatch}
                options={batches}
                label="Batch"
              />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-white/70 text-sm font-medium">Branch:</label>
              <FilterSelect
                      value={passingAnalysisBranch}
                      onChange={setPassingAnalysisBranch}
                options={branches}
                label="Branch"
              />
            </div>

                  {/* Active Filter Indicators */}
                  {(passingAnalysisBatch !== "all" || passingAnalysisBranch !== "all") && (
                    <div className="flex gap-2 items-center ml-2 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-full">
                      <span className="text-xs text-blue-300 font-semibold">Filters Active</span>
                      <button
                        onClick={() => {
                          setPassingAnalysisBatch("all");
                          setPassingAnalysisBranch("all");
                        }}
                        className="ml-1 text-blue-300 hover:text-blue-200 transition"
                        title="Clear all filters"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Breakdown Info */}
              {showBatchBreakdown && (
                <div className="mt-3 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-sm text-purple-300">
                  📊 Showing breakdown by <strong>Batch/Year</strong> for <strong>{passingAnalysisBranch}</strong> branch
                </div>
              )}
              {showBranchBreakdown && (
                <div className="mt-3 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-sm text-purple-300">
                  📊 Showing breakdown by <strong>Branch</strong> for <strong>{passingAnalysisBatch}</strong> batch
                </div>
              )}
            </div>

            {loadingPassingStats ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500/30 border-t-blue-500"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-8 w-8 rounded-full bg-blue-500/20 animate-pulse"></div>
                  </div>
                </div>
                <span className="mt-6 text-white/70 font-medium">Loading passing analysis...</span>
              </div>
            ) : (
              <>
                {/* Enhanced Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="relative bg-gradient-to-br from-white/10 to-white/5 rounded-2xl p-5 border border-white/10 text-center overflow-hidden group hover:scale-105 transition-transform duration-200">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative z-10">
                      <div className="flex items-center justify-center mb-2">
                        <svg className="w-6 h-6 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <p className="text-white/70 text-sm mb-2 font-medium">Total Students</p>
                      <p className="text-3xl font-black text-white bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">{passingStats.total}</p>
                    </div>
                  </div>
                  
                  <div className="relative bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 rounded-2xl p-5 border border-emerald-500/30 text-center overflow-hidden group hover:scale-105 transition-transform duration-200 shadow-lg shadow-emerald-500/10">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative z-10">
                      <div className="flex items-center justify-center mb-2">
                        <svg className="w-6 h-6 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-emerald-200 text-sm mb-2 font-medium">Passed</p>
                      <p className="text-3xl font-black text-emerald-400">{passingStats.passed}</p>
                      {passingStats.total > 0 && (
                        <p className="text-xs text-emerald-300/70 mt-1">
                          {((passingStats.passed / passingStats.total) * 100).toFixed(1)}% of total
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="relative bg-gradient-to-br from-red-500/20 to-red-500/10 rounded-2xl p-5 border border-red-500/30 text-center overflow-hidden group hover:scale-105 transition-transform duration-200 shadow-lg shadow-red-500/10">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative z-10">
                      <div className="flex items-center justify-center mb-2">
                        <svg className="w-6 h-6 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-red-200 text-sm mb-2 font-medium">Failed</p>
                      <p className="text-3xl font-black text-red-400">{passingStats.fail}</p>
                      {passingStats.total > 0 && (
                        <p className="text-xs text-red-300/70 mt-1">
                          {((passingStats.fail / passingStats.total) * 100).toFixed(1)}% of total
                        </p>
                      )}
                    </div>
              </div>

                  <div className="relative bg-gradient-to-br from-blue-500/20 to-blue-500/10 rounded-2xl p-5 border border-blue-500/30 text-center overflow-hidden group hover:scale-105 transition-transform duration-200 shadow-lg shadow-blue-500/10">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative z-10">
                      <div className="flex items-center justify-center mb-2">
                        <svg className="w-6 h-6 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <p className="text-blue-200 text-sm mb-2 font-medium">Pass Rate</p>
                      <p className="text-3xl font-black text-blue-400">{passingStats.passRate}%</p>
                      <div className="mt-2 h-1.5 bg-blue-500/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500"
                          style={{ width: `${passingStats.passRate}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
              </div>

                {/* Enhanced Bar Chart */}
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-lg font-bold text-white/90">
                      {showBatchBreakdown ? "Passing Analysis by Batch" : 
                       showBranchBreakdown ? "Passing Analysis by Branch" : 
                       "Passing vs Failing Students"}
                    </h4>
                    <div className="flex items-center gap-4 text-sm text-white/70">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"></div>
                        <span>Passed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-400 to-red-500"></div>
                        <span>Failed</span>
                      </div>
                    </div>
                  </div>
                  
                  <ResponsiveContainer width="100%" height={350}>
                    {showBatchBreakdown ? (
                      <BarChart data={passFailData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="passedGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity={1} />
                            <stop offset="100%" stopColor="#16a34a" stopOpacity={0.9} />
                          </linearGradient>
                          <linearGradient id="failedGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                            <stop offset="100%" stopColor="#dc2626" stopOpacity={0.9} />
                          </linearGradient>
                        </defs>
                        <XAxis 
                          dataKey="batch" 
                          stroke="#94a3b8"
                          tick={{ fill: "#fff", fontSize: 12, fontWeight: 500 }}
                          tickLine={{ stroke: "#94a3b8" }}
                        />
                        <YAxis 
                          stroke="#94a3b8"
                          tick={{ fill: "#fff", fontSize: 12 }}
                          tickLine={{ stroke: "#94a3b8" }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "rgba(0, 0, 0, 0.9)", 
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            borderRadius: "12px",
                            color: "#fff",
                            padding: "12px",
                            boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
                          }}
                          cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
                        />
                        <Legend 
                          wrapperStyle={{ paddingTop: "20px" }}
                          iconType="circle"
                        />
                        <Bar 
                          dataKey="Passed" 
                          fill="url(#passedGradient)"
                          radius={[12, 12, 0, 0]}
                          name="Passed Students"
                          animationDuration={800}
                        />
                        <Bar 
                          dataKey="Failed" 
                          fill="url(#failedGradient)"
                          radius={[12, 12, 0, 0]}
                          name="Failed Students"
                          animationDuration={800}
                        />
                      </BarChart>
                    ) : showBranchBreakdown ? (
                      <BarChart data={passFailData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="passedGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity={1} />
                            <stop offset="100%" stopColor="#16a34a" stopOpacity={0.9} />
                          </linearGradient>
                          <linearGradient id="failedGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                            <stop offset="100%" stopColor="#dc2626" stopOpacity={0.9} />
                          </linearGradient>
                        </defs>
                        <XAxis 
                          dataKey="branch" 
                          stroke="#94a3b8"
                          tick={{ fill: "#fff", fontSize: 12, fontWeight: 500 }}
                          tickLine={{ stroke: "#94a3b8" }}
                        />
                        <YAxis 
                          stroke="#94a3b8"
                          tick={{ fill: "#fff", fontSize: 12 }}
                          tickLine={{ stroke: "#94a3b8" }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "rgba(0, 0, 0, 0.9)", 
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            borderRadius: "12px",
                            color: "#fff",
                            padding: "12px",
                            boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
                          }}
                          cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
                        />
                        <Legend 
                          wrapperStyle={{ paddingTop: "20px" }}
                          iconType="circle"
                        />
                        <Bar 
                          dataKey="Passed" 
                          fill="url(#passedGradient)"
                          radius={[12, 12, 0, 0]}
                          name="Passed Students"
                          animationDuration={800}
                        />
                        <Bar 
                          dataKey="Failed" 
                          fill="url(#failedGradient)"
                          radius={[12, 12, 0, 0]}
                          name="Failed Students"
                          animationDuration={800}
                        />
                      </BarChart>
                    ) : (
                      <BarChart data={passFailData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="passedGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity={1} />
                            <stop offset="100%" stopColor="#16a34a" stopOpacity={0.9} />
                          </linearGradient>
                          <linearGradient id="failedGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                            <stop offset="100%" stopColor="#dc2626" stopOpacity={0.9} />
                          </linearGradient>
                        </defs>
                        <XAxis 
                          dataKey="name" 
                          stroke="#94a3b8"
                          tick={{ fill: "#fff", fontSize: 13, fontWeight: 600 }}
                          tickLine={{ stroke: "#94a3b8" }}
                        />
                        <YAxis 
                          stroke="#94a3b8"
                          tick={{ fill: "#fff", fontSize: 12 }}
                          tickLine={{ stroke: "#94a3b8" }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "rgba(0, 0, 0, 0.9)", 
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            borderRadius: "12px",
                            color: "#fff",
                            padding: "12px",
                            boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
                          }}
                          cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
                        />
                        <Legend 
                          wrapperStyle={{ paddingTop: "20px" }}
                          iconType="circle"
                        />
                        <Bar 
                    dataKey="value"
                          radius={[12, 12, 0, 0]}
                          animationDuration={800}
                  >
                    {passFailData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill === "#22c55e" ? "url(#passedGradient)" : "url(#failedGradient)"} />
                          ))}
                        </Bar>
                      </BarChart>
                    )}
              </ResponsiveContainer>
            </div>
              </>
            )}
          </CoolChartCard>
        </div>
      )}

      {/* PERFORMANCE TAB */}
      {activeTab === "performance" && (
        <div className="space-y-10">

          {/* SUBJECT PASSING COMPARISON */}
          <CoolChartCard title="Subject Passing Comparison" icon="📘" fullWidth>
            {/* Enhanced Filter Section */}
            <div className="mb-6 p-5 rounded-2xl border border-white/10 bg-gradient-to-r from-white/5 via-white/5 to-white/5 backdrop-blur-sm">
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                <div className="flex items-center gap-2 text-white/90 font-semibold">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="text-lg">Compare Subjects</span>
                </div>
                
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="flex items-center gap-2">
                    <label className="text-white/70 text-sm font-medium">Batch:</label>
              <FilterSelect
                value={selectedBatch}
                onChange={setSelectedBatch}
                options={batches}
                label="Batch"
              />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-white/70 text-sm font-medium">Branch:</label>
              <FilterSelect
                value={selectedBranch}
                onChange={setSelectedBranch}
                options={branches}
                label="Branch"
              />
                  </div>
                  
                  {/* Subject Selection from Basket */}
                  <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
                    <div className="flex items-center gap-2 flex-1">
                      <label className="text-white/70 text-sm font-medium whitespace-nowrap">Select Subject:</label>
                      {loadingBasketSubjects ? (
                        <div className="px-4 py-2 bg-white/10 border border-white/20 text-white rounded-lg text-sm min-w-[250px] flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                          <span className="ml-2 text-white/70 text-sm">Loading subjects...</span>
                        </div>
                      ) : basketSubjects.length === 0 ? (
                        <div className="px-4 py-2 bg-white/10 border border-white/20 text-white rounded-lg text-sm min-w-[250px] flex items-center justify-center text-white/50">
                          <span>No subjects available</span>
                        </div>
                      ) : (
              <select
                          value={selectedSubjectToAdd}
                          onChange={(e) => setSelectedSubjectToAdd(e.target.value)}
                          disabled={selectedSubjects.length >= 6}
                          className="px-4 py-2 bg-white/10 border border-white/20 text-white rounded-lg text-sm min-w-[250px] focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="" className="text-black">-- Select a subject --</option>
                          {basketSubjects
                            .filter(subject => !selectedSubjects.includes(subject.code))
                            .map((subject) => (
                              <option key={subject.code} value={subject.code} className="text-black">
                                {subject.code} - {subject.name}
                  </option>
                ))}
              </select>
                      )}
            </div>

                    {/* Add Button */}
                    <button
                      onClick={handleAddSubject}
                      disabled={!selectedSubjectToAdd || selectedSubjects.length >= 6 || loadingBasketSubjects}
                      className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 disabled:bg-purple-500/10 disabled:opacity-50 disabled:cursor-not-allowed border border-purple-500/30 text-purple-300 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Subject
                    </button>
                    
                    {/* Subject Limit Indicator */}
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-3 py-1.5 rounded ${
                        selectedSubjects.length >= 6 
                          ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30" 
                          : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      }`}>
                        {selectedSubjects.length}/6 subjects
                      </span>
                    </div>
                    
                    {/* Clear All Button */}
                    {selectedSubjects.length > 0 && (
                      <button
                        onClick={() => {
                          setSelectedSubjects([]);
                          setSelectedSubjectToAdd("");
                        }}
                        className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Clear All
                      </button>
                    )}
                  </div>
                  
                  {/* Max Limit Warning */}
                  {selectedSubjects.length >= 6 && (
                    <div className="px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 rounded-lg text-xs font-semibold flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Maximum 6 subjects reached. Remove a subject to add another.
                    </div>
                  )}
                </div>
              </div>
              
              {/* Selected Subjects List */}
              {selectedSubjects.length > 0 && (
                <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white/90 text-sm font-semibold">
                      Selected Subjects ({selectedSubjects.length}/6):
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedSubjects.map((subjectCode) => {
                      const subject = basketSubjects.find(s => s.code === subjectCode);
                      return (
                        <div
                          key={subjectCode}
                          className="group px-3 py-2 bg-gradient-to-r from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-lg flex items-center gap-2 hover:from-purple-500/30 hover:to-purple-600/30 transition-all"
                        >
                          <span className="text-purple-200 text-sm font-medium">
                            {subject ? `${subject.code} - ${subject.name}` : subjectCode}
                          </span>
                          <button
                            onClick={() => handleRemoveSubject(subjectCode)}
                            className="ml-1 text-purple-300 hover:text-red-300 transition-colors p-0.5 hover:bg-red-500/20 rounded"
                            title="Remove subject"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {selectedSubjects.length > 0 ? (
              <>
                {/* Warning for subjects without data */}
                {subjectComparisonData.filter(s => !s.hasData).length > 0 && (
                  <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <p className="text-sm text-orange-300 font-semibold mb-1">
                      ⚠️ {subjectComparisonData.filter(s => !s.hasData).length} subject(s) have no result data
                    </p>
                    <div className="text-xs text-orange-200/80">
                      Subjects without data: {subjectComparisonData.filter(s => !s.hasData).map(s => s.subject).join(", ")}
                    </div>
                  </div>
                )}
                
                {subjectComparisonData.filter(s => s.hasData).length > 0 ? (
                  <>
                {/* Summary Cards for Comparison */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
                    <p className="text-white/70 text-sm mb-1">Total Subjects</p>
                    <p className="text-2xl font-bold text-white">{selectedSubjects.length}</p>
                    {subjectComparisonData.length < selectedSubjects.length && (
                      <p className="text-xs text-yellow-400 mt-1">
                        ({subjectComparisonData.filter(s => s.hasData).length} with data)
                      </p>
                    )}
                  </div>
                  <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20 text-center">
                    <p className="text-emerald-200 text-sm mb-1">Avg Pass Rate</p>
                    <p className="text-2xl font-bold text-emerald-400">
                      {(() => {
                        const subjectsWithData = subjectComparisonData.filter(s => s.hasData);
                        return subjectsWithData.length > 0
                          ? (
                              subjectsWithData.reduce((sum, s) => sum + s.passRate, 0) /
                              subjectsWithData.length
                            ).toFixed(1)
                          : 0;
                      })()}%
                    </p>
                    {subjectComparisonData.filter(s => s.hasData).length < selectedSubjects.length && (
                      <p className="text-xs text-emerald-300/70 mt-1">
                        (of subjects with data)
                      </p>
                    )}
                  </div>
                  <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20 text-center">
                    <p className="text-red-200 text-sm mb-1">Avg Fail Rate</p>
                    <p className="text-2xl font-bold text-red-400">
                      {(() => {
                        const subjectsWithData = subjectComparisonData.filter(s => s.hasData);
                        return subjectsWithData.length > 0
                          ? (
                              subjectsWithData.reduce((sum, s) => sum + s.failRate, 0) /
                              subjectsWithData.length
                            ).toFixed(1)
                          : 0;
                      })()}%
                    </p>
                    {subjectComparisonData.filter(s => s.hasData).length < selectedSubjects.length && (
                      <p className="text-xs text-red-300/70 mt-1">
                        (of subjects with data)
                      </p>
                    )}
                  </div>
                  <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20 text-center">
                    <p className="text-blue-200 text-sm mb-1">Total Students</p>
                    <p className="text-2xl font-bold text-blue-400">
                      {subjectComparisonData.reduce((sum, s) => sum + s.totalStudents, 0)}
                    </p>
                  </div>
                </div>

                {/* Enhanced Bar Chart */}
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-lg font-bold text-white/90">Pass Rate vs Fail Rate Comparison</h4>
                    <div className="flex items-center gap-4 text-sm text-white/70">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"></div>
                        <span>Pass Rate</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-400 to-red-500"></div>
                        <span>Fail Rate</span>
                      </div>
                    </div>
                  </div>
                  
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart 
                      data={subjectComparisonData.filter(s => s.hasData)} 
                      margin={{ top: 10, right: 20, left: 0, bottom: 80 }}
                    >
                      <defs>
                        <linearGradient id="subjectPassGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={1} />
                          <stop offset="100%" stopColor="#16a34a" stopOpacity={0.9} />
                        </linearGradient>
                        <linearGradient id="subjectFailGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                          <stop offset="100%" stopColor="#dc2626" stopOpacity={0.9} />
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="subject" 
                        stroke="#94a3b8"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        tick={{ fill: "#fff", fontSize: 11, fontWeight: 500 }}
                        tickLine={{ stroke: "#94a3b8" }}
                      />
                      <YAxis 
                        stroke="#94a3b8"
                        tick={{ fill: "#fff", fontSize: 12 }}
                        tickLine={{ stroke: "#94a3b8" }}
                        label={{ value: 'Rate (%)', angle: -90, position: 'insideLeft', fill: '#fff', style: { textAnchor: 'middle' } }}
                      />
                      <Tooltip 
                        formatter={(value, name) => [`${value}%`, name]}
                        labelStyle={{ color: '#fff', fontWeight: 'bold', marginBottom: '4px' }}
                        contentStyle={{ 
                          backgroundColor: "rgba(0, 0, 0, 0.9)", 
                          border: "1px solid rgba(255, 255, 255, 0.2)",
                          borderRadius: "12px",
                          color: "#fff",
                          padding: "12px",
                          boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
                        }}
                        cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
                      />
                      <Legend 
                        wrapperStyle={{ paddingTop: "20px" }}
                        iconType="circle"
                      />
                      <Bar 
                        dataKey="passRate" 
                        fill="url(#subjectPassGradient)"
                        radius={[8, 8, 0, 0]}
                        name="Pass Rate (%)"
                        animationDuration={800}
                      />
                      <Bar 
                        dataKey="failRate" 
                        fill="url(#subjectFailGradient)"
                        radius={[8, 8, 0, 0]}
                        name="Fail Rate (%)"
                        animationDuration={800}
                      />
                </BarChart>
              </ResponsiveContainer>
                </div>
                  </>
                ) : (
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10 text-center">
                    <p className="text-white/70 font-semibold mb-2">
                      No result data found for any selected subjects
                    </p>
                    <p className="text-sm text-white/50">
                      Please upload grade records or verify subject codes match.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-white/70">
                <div className="mb-4">
                  <svg className="w-16 h-16 mx-auto text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="mb-2 font-semibold text-lg">
                  {selectedSubjects.length === 0 
                    ? "Select one or more basket subjects (up to 6) to compare Pass Rate and Fail Rate"
                    : subjectComparisonData.length === 0
                    ? "No result data available for selected subjects. Make sure grade records are uploaded."
                    : "No data available for selected subjects."
                  }
                </p>
                {selectedSubjects.length === 0 && (
                  <div className="text-sm text-white/50 mt-2 space-y-2">
                    <p className="font-semibold text-white/70 mb-2">How to add subjects:</p>
                    <div className="space-y-1 pl-4">
                      <p>1. Select a subject from the dropdown</p>
                      <p>2. Click the <strong className="text-purple-300">"Add Subject"</strong> button</p>
                      <p>3. Repeat to add more subjects (up to 6)</p>
                      <p>4. Click the <span className="text-red-300">×</span> button on any subject to remove it</p>
                    </div>
                    <p className="text-xs text-white/40 mt-3">
                      Subjects are loaded from the Basket (CBCS) table. Comparison data comes from uploaded grade records.
                    </p>
                  </div>
                )}
                {selectedSubjects.length > 0 && subjectComparisonData.length === 0 && (
                  <div className="mt-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <p className="text-sm text-orange-300 font-semibold mb-2">
                      ⚠️ No result data found for selected subjects
                    </p>
                    <div className="text-sm text-orange-200/80 space-y-1">
                      <p>• Make sure grade records have been uploaded to the system</p>
                      <p>• Verify that the subject codes in basket match the subject codes in grade records</p>
                      <p>• Selected subjects: {selectedSubjects.join(", ")}</p>
                      <p>• Available subjects with data: {currentData?.subjectDifficultyAnalysis?.length || 0} subjects found in result data</p>
                    </div>
                  </div>
                )}
                {basketSubjects.length === 0 && !loadingBasketSubjects && (
                  <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-sm text-yellow-300 font-semibold mb-2">
                      No basket subjects found
                    </p>
                    <p className="text-sm text-yellow-200/80 mb-3">
                      Please add subjects to the Basket (CBCS) table first, or check if the database has any CBCS subjects.
                    </p>
                    <button
                      onClick={() => {
                        fetchBasketSubjects();
                      }}
                      className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-300 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Retry Loading Subjects
                    </button>
                  </div>
                )}
                {(!currentData?.subjectDifficultyAnalysis || currentData.subjectDifficultyAnalysis.length === 0) && 
                 (!currentData?.subjectStats || currentData.subjectStats.length === 0) && (
                  <p className="text-sm text-white/50 mt-2">
                    Subject performance data will appear after uploading grade records.
                  </p>
                )}
              </div>
            )}
          </CoolChartCard>
        </div>
      )}

      {/* TOP PERFORMING STUDENTS TAB */}
      {activeTab === "topstudents" && (
        <div className="space-y-10">
          {currentData?.topPerformingStudents && currentData.topPerformingStudents.length > 0 ? (
            <CoolChartCard title="Top Performing Students" icon="🏆" fullWidth>
              {/* Dedicated Filters for Top Students */}
              <div className="mb-6 p-4 rounded-xl border border-white/10 bg-white/5">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
                  <div className="flex items-center gap-2 text-white/90 font-semibold">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    Filter Students
                  </div>
                  
                  <div className="flex flex-wrap gap-3 flex-1">
                    {/* Batch Filter */}
                <FilterSelect
                      value={topStudentsBatch}
                      onChange={setTopStudentsBatch}
                  options={batches}
                  label="Batch"
                />
                    
                    {/* Branch Filter */}
                <FilterSelect
                      value={topStudentsBranch}
                      onChange={setTopStudentsBranch}
                  options={branches}
                  label="Branch"
                />
                    
                    {/* Search by Reg No */}
                    <div className="relative flex-1 min-w-[200px]">
                      <input
                        type="text"
                        value={topStudentsSearch}
                        onChange={(e) => setTopStudentsSearch(e.target.value)}
                        placeholder="Search by registration number..."
                        className="w-full px-4 py-2 pl-10 bg-white/10 border border-white/20 text-white rounded-full text-sm placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
              </div>
                    
                    {/* Clear Filters Button */}
                    {(topStudentsBatch !== "all" || topStudentsBranch !== "all" || topStudentsSearch) && (
                      <button
                        onClick={() => {
                          setTopStudentsBatch("all");
                          setTopStudentsBranch("all");
                          setTopStudentsSearch("");
                        }}
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-white rounded-full text-sm font-semibold transition-all flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              <TopStudentsTable 
                data={currentData.topPerformingStudents} 
                batchFilter={topStudentsBatch}
                branchFilter={topStudentsBranch}
                searchFilter={topStudentsSearch}
              />
            </CoolChartCard>
          ) : (
            <CoolChartCard title="Top Performing Students" icon="🏆" fullWidth>
              <div className="text-center py-12 text-white/70">
                <p>No student performance data available.</p>
                <p className="text-sm text-white/50 mt-2">
                  Performance data will appear after uploading grade records.
                </p>
              </div>
            </CoolChartCard>
          )}
        </div>
      )}
    </div>
  );
}

/* ===================== REUSABLE COMPONENTS ===================== */
function CoolChartCard({ title, icon, children, fullWidth = false }) {
  return (
    <div
      className={`rounded-3xl border border-white/20 bg-white/10 backdrop-blur-xl p-8 text-white transition hover:-translate-y-1 hover:shadow-2xl ${
        fullWidth ? "col-span-2" : ""
      }`}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="text-3xl">{icon}</div>
        <h3 className="text-2xl font-bold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function FilterSelect({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-4 py-2 bg-white/10 border border-white/20 text-white rounded-full text-sm"
    >
      {options.map((opt) => (
        <option key={opt} value={opt} className="text-black">
          {opt === "all" ? "All" : opt}
        </option>
      ))}
    </select>
  );
}

function TopStudentsTable({ data, batchFilter = "all", branchFilter = "all", searchFilter = "" }) {
  // Helper functions to extract batch and branch from regNo
  const getBatchFromRegNo = (regNo) => {
    if (!regNo) return null;
    const regNoStr = String(regNo);
    return regNoStr.length >= 2 ? `20${regNoStr.substring(0, 2)}` : null;
  };

  const getBranchFromRegNo = (regNo) => {
    if (!regNo) return null;
    const regNoStr = String(regNo);
    const deptCode = regNoStr.length >= 8 ? regNoStr.charAt(7) : "";
    const deptMap = {
      '1': 'Civil Engineering',
      '2': 'Computer Science Engineering',
      '3': 'Electronics & Communication Engineering',
      '4': 'Electronics & Communication Engineering', // Alternative code for ECE
      '5': 'Electrical & Electronics Engineering',
      '6': 'Mechanical Engineering',
      '7': 'AIML',
      '8': 'Computer Science Engineering', // Alternative code for CSE
      '9': 'Civil Engineering' // Alternative code for Civil
    };
    return deptMap[deptCode] || null;
  };

  // Branch abbreviation mapping
  const branchMap = {
    'CSE': 'Computer Science Engineering',
    'ECE': 'Electronics & Communication Engineering',
    'EEE': 'Electrical & Electronics Engineering',
    'ME': 'Mechanical Engineering',
    'CIVIL': 'Civil Engineering',
    'AIML': 'AIML'
  };

  // Enrich data with batch and branch extracted from regNo
  let enrichedData = data.map((student) => {
    const regNo = String(student.regNo || "");
    const batch = getBatchFromRegNo(regNo);
    const branch = getBranchFromRegNo(regNo);
    
    return {
      ...student,
      batch: batch || null,
      branch: branch || null,
      _batchRaw: batch,
      _branchRaw: branch,
      name: "N/A" // Name not available in API response
    };
  });

  // Debug: Log some sample data
  if (enrichedData.length > 0) {
    console.log("Sample enriched data:", enrichedData.slice(0, 3));
    console.log("Batch filter:", batchFilter, "Branch filter:", branchFilter);
  }

  // Always group by batch+branch and show top 10 per combination
  const groupedByBatchBranch = {};
  
  enrichedData.forEach((student) => {
    const batch = getBatchFromRegNo(student.regNo) || "Unknown";
    const branch = getBranchFromRegNo(student.regNo) || "Unknown";
    const key = `${batch}-${branch}`;
    
    if (!groupedByBatchBranch[key]) {
      groupedByBatchBranch[key] = {
        batch,
        branch,
        students: []
      };
    }
    groupedByBatchBranch[key].students.push(student);
  });

  // Debug: Log groups
  console.log("Total groups:", Object.keys(groupedByBatchBranch).length);
  console.log("Sample groups:", Object.keys(groupedByBatchBranch).slice(0, 5));

  // Apply filters to determine which groups to include
  const filteredGroups = Object.keys(groupedByBatchBranch).filter((key) => {
    const group = groupedByBatchBranch[key];
    
    // Batch filter
    if (batchFilter !== "all") {
      // Extract 2-digit year from filter (e.g., "2023" -> "23")
      const filterYearSuffix = batchFilter.length === 4 ? batchFilter.substring(2, 4) : batchFilter;
      // Extract 2-digit year from group batch (e.g., "2023" -> "23")
      const groupYearSuffix = group.batch && group.batch.length >= 2 ? group.batch.substring(2, 4) : "";
      
      if (groupYearSuffix !== filterYearSuffix && group.batch !== batchFilter) {
        return false;
      }
    }

    // Branch filter
    if (branchFilter !== "all") {
      const normalizedBranch = branchMap[branchFilter] || branchFilter;
      const groupBranch = (group.branch || "").trim();
      
      if (!groupBranch) return false;
      
      const groupBranchLower = groupBranch.toLowerCase();
      const normalizedBranchLower = normalizedBranch.toLowerCase();
      const branchFilterLower = branchFilter.toLowerCase();
      
      // Check multiple matching strategies
      const matches = 
        groupBranchLower === normalizedBranchLower ||
        groupBranchLower.includes(normalizedBranchLower) ||
        normalizedBranchLower.includes(groupBranchLower) ||
        groupBranchLower.includes(branchFilterLower) ||
        // Handle abbreviations (e.g., "EEE" in "Electrical & Electronics Engineering")
        (branchFilterLower === "eee" && groupBranchLower.includes("electrical") && groupBranchLower.includes("electronics")) ||
        (branchFilterLower === "ece" && groupBranchLower.includes("electronics") && groupBranchLower.includes("communication")) ||
        (branchFilterLower === "cse" && (groupBranchLower.includes("computer") || groupBranchLower.includes("cse"))) ||
        (branchFilterLower === "me" && groupBranchLower.includes("mechanical")) ||
        (branchFilterLower === "civil" && groupBranchLower.includes("civil")) ||
        (branchFilterLower === "aiml" && groupBranchLower.includes("aiml"));
      
      if (!matches) {
        return false;
      }
    }

    return true;
  });

  console.log("Total groups before filter:", Object.keys(groupedByBatchBranch).length);
  console.log("Filtered groups after batch/branch filter:", filteredGroups.length, filteredGroups);

  // Sort each group by average grade and keep top 10
  filteredGroups.forEach((key) => {
    groupedByBatchBranch[key].students.sort((a, b) => parseFloat(b.average || 0) - parseFloat(a.average || 0));
    groupedByBatchBranch[key].students = groupedByBatchBranch[key].students.slice(0, 10);
  });

  // Flatten back to array (all groups that passed the filter)
  let filteredData = [];
  
  filteredGroups.forEach((key) => {
    // Apply search filter to students in each group
    let groupStudents = groupedByBatchBranch[key].students;
    
    if (searchFilter) {
      const searchTerm = searchFilter.toLowerCase();
      groupStudents = groupStudents.filter((student) => {
        const regNo = String(student.regNo || "").toLowerCase();
        return regNo.includes(searchTerm);
      });
    }
    
    filteredData.push(...groupStudents);
  });

  console.log("Final filtered data count:", filteredData.length);

  // Sort all results by average grade for final display
  filteredData.sort((a, b) => parseFloat(b.average || 0) - parseFloat(a.average || 0));

  const limitedData = filteredData;

  return (
    <div className="space-y-4">
      {/* Results count */}
      <div className="flex flex-col gap-2 text-sm text-white/70 mb-2">
        <div className="flex items-center justify-between">
          <span>
            Showing <span className="font-bold text-white">{limitedData.length}</span> student{limitedData.length !== 1 ? 's' : ''}
            <span className="ml-2 text-white/60">
              (Top 10 per Batch+Branch combination
              {batchFilter !== "all" || branchFilter !== "all" ? " - filtered" : ""})
            </span>

          </span>
          {limitedData.length === 0 && (batchFilter !== "all" || branchFilter !== "all" || searchFilter) && (
            <span className="text-yellow-400 font-semibold">
              No students match the selected filters
            </span>
          )}
        </div>
        {/* Debug info - can be removed later */}
        {data.length > 0 && limitedData.length === 0 && (
          <div className="text-xs text-blue-300/70 p-2 bg-blue-500/10 rounded border border-blue-500/20">
            <p>Total students in data: {data.length}</p>
            <p>Active filters: Batch={batchFilter}, Branch={branchFilter}, Search={searchFilter || "none"}</p>
            <p className="mt-1">Try: Clear filters to see all students, or check if data exists for selected batch/branch combination.</p>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full text-white">
        <thead>
            <tr className="border-b border-white/20 bg-white/5">
            <th className="text-left py-4 px-6 font-bold">Rank</th>
            <th className="text-left py-4 px-6 font-bold">Reg No</th>
            <th className="text-left py-4 px-6 font-bold">Branch</th>
            <th className="text-left py-4 px-6 font-bold">Batch</th>
              <th className="text-left py-4 px-6 font-bold">Average Grade</th>
              <th className="text-left py-4 px-6 font-bold">Subjects</th>
          </tr>
        </thead>
        <tbody>
            {limitedData.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-white/50">
                  No students found matching your criteria
                </td>
              </tr>
            ) : (
              limitedData.map((student, index) => (
                <tr
                  key={student.regNo || index}
                className="border-b border-white/10 hover:bg-white/5 transition"
              >
                <td className="py-4 px-6 font-bold text-blue-300">{index + 1}</td>
                  <td className="py-4 px-6 font-mono text-white/90">{student.regNo || "N/A"}</td>
                <td className="py-4 px-6">{student.branch || "N/A"}</td>
                <td className="py-4 px-6">{student.batch || "N/A"}</td>
                <td className="py-4 px-6 font-bold text-emerald-300">
                    {student.average ? `${parseFloat(student.average).toFixed(2)}` : "N/A"}
                </td>
                  <td className="py-4 px-6">{student.totalSubjects || "N/A"}</td>
              </tr>
              ))
            )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
