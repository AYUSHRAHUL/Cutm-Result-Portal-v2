"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { appendSchoolParams, getSchoolApiUrl, getSchoolAndCampus } from "@/lib/api-helper";
import {
  DepartmentChart,
  SemesterChart,
  DataSourceChart,
  BatchChart,
  GradeTrendsOverTimeChart,
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
  LabelList,
} from "recharts";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

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
  const [basketSubjects, setBasketSubjects] = useState([]); // Subjects from result database
  const [loadingBasketSubjects, setLoadingBasketSubjects] = useState(false);

  // Subject Comparison specific filters and data
  const [subjectComparisonBatch, setSubjectComparisonBatch] = useState("all");
  const [subjectComparisonBranch, setSubjectComparisonBranch] = useState("all");
  const [subjectComparisonSemester, setSubjectComparisonSemester] = useState("all");
  const [subjectComparisonData, setSubjectComparisonData] = useState([]);
  const [loadingSubjectComparison, setLoadingSubjectComparison] = useState(false);
  const [subjectComparisonUniqueStudents, setSubjectComparisonUniqueStudents] = useState(null);
  const [subjectComparisonPassedAll, setSubjectComparisonPassedAll] = useState(null);

  // Student list for single subject
  const [subjectStudents, setSubjectStudents] = useState([]);
  const [selectedStudentRegNo, setSelectedStudentRegNo] = useState("");
  const [selectedStudents, setSelectedStudents] = useState([]); // Array of selected Reg_Nos
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState(null);
  // Full student records and student-specific performance
  const [studentRecords, setStudentRecords] = useState([]);
  const [loadingStudentRecords, setLoadingStudentRecords] = useState(false);
  const [studentRecordsError, setStudentRecordsError] = useState(null);
  // Subject-wise analysis for selected students
  const [subjectWiseAnalysis, setSubjectWiseAnalysis] = useState([]);
  const [loadingSubjectWiseAnalysis, setLoadingSubjectWiseAnalysis] = useState(false);
  const [studentRecordsForExport, setStudentRecordsForExport] = useState([]); // Store records for Excel export

  const [overviewBatchFilter, setOverviewBatchFilter] = useState("all"); // Separate filter for Department Distribution only
  const [overviewBranchFilter, setOverviewBranchFilter] = useState("all"); // Branch filter for Department Distribution
  const [filteredDepartmentStats, setFilteredDepartmentStats] = useState(null); // Separate state for filtered department stats
  const [loadingDepartmentStats, setLoadingDepartmentStats] = useState(false);

  // Top Performing Students specific filters
  const [topStudentsBatch, setTopStudentsBatch] = useState("all");
  const [topStudentsBranch, setTopStudentsBranch] = useState("all");
  const [topStudentsSemester, setTopStudentsSemester] = useState("all");
  const [topStudentsSearch, setTopStudentsSearch] = useState("");
  const [topStudentsData, setTopStudentsData] = useState(null); // Store filtered top students data
  const [loadingTopStudents, setLoadingTopStudents] = useState(false);

  // Passing Analysis specific filters and state
  const [passingAnalysisBatch, setPassingAnalysisBatch] = useState([]); // Array for checkboxes
  const [passingAnalysisBranch, setPassingAnalysisBranch] = useState([]); // Array for checkboxes
  const [passingAnalysisSemester, setPassingAnalysisSemester] = useState([]); // Array for checkboxes (multi-select)
  const [filteredPassingStats, setFilteredPassingStats] = useState(null);
  const [filteredPassingStatsByBatch, setFilteredPassingStatsByBatch] = useState(null);
  const [filteredPassingStatsByBranch, setFilteredPassingStatsByBranch] = useState(null);
  const [filteredPassingStatsByCombination, setFilteredPassingStatsByCombination] = useState([]); // For multiple filter combinations
  const [loadingPassingStats, setLoadingPassingStats] = useState(false);

  // School detection for dynamic filters
  const searchParams = useSearchParams();
  const schoolParam = searchParams.get('school');
  const campusParam = searchParams.get('campus');
  const isDiploma = schoolParam === 'SOVET' || schoolParam === 'sovet';
  const isSom = schoolParam === 'SOM' || schoolParam === 'som';

  // Store school and campus in localStorage when URL params are present
  useEffect(() => {
    if (schoolParam) {
      localStorage.setItem('selectedSchool', schoolParam);
      localStorage.setItem('school', schoolParam);
    }
    if (campusParam) {
      localStorage.setItem('selectedCampus', campusParam);
      localStorage.setItem('campus', campusParam);
    }
  }, [schoolParam, campusParam]);

  const batches = isDiploma
    ? ["all", "2023", "2024", "2025"]
    : isSom
      ? ["all", "2022", "2023", "2024", "2025"]
      : ["all", "2022", "2023", "2024", "2025"];

  const branches = isDiploma
    ? ["all", "CSE", "EE", "ME", "CIVIL", "MINING", "AUTOMOBILE"]
    : isSom
      ? ["all", "BBA", "MBA"]
      : ["all", "CSE", "ECE", "EEE", "ME", "CIVIL", "AIML"];

  const semesters = isDiploma
    ? ["all", "Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6"]
    : ["all", "Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6", "Sem 7", "Sem 8"];

  // Fetch subjects from result database with filters
  const fetchBasketSubjects = useCallback(async () => {
    try {
      setLoadingBasketSubjects(true);
      // Build query parameters
      const params = new URLSearchParams();
      if (subjectComparisonBatch && subjectComparisonBatch !== "all") {
        params.set("batch", subjectComparisonBatch);
      }
      if (subjectComparisonBranch && subjectComparisonBranch !== "all") {
        params.set("branch", subjectComparisonBranch);
      }
      if (subjectComparisonSemester && subjectComparisonSemester !== "all") {
        // Normalize semester format: "Sem 1" -> "1", "Sem1" -> "1", etc.
        const semValue = String(subjectComparisonSemester).replace(/^Sem\s*/i, "").trim();
        params.set("semester", semValue);
      }

      const queryString = params.toString();
      const baseUrl = getSchoolApiUrl("analytics/subjects");
      let url = baseUrl + (queryString ? (baseUrl.includes('?') ? '&' : '?') + queryString : "");

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        setBasketSubjects([]);
        return;
      }

      const result = await response.json();

      // Verify source is a result collection (not CBCS). SOM uses som_result; SOET/SOVET use CUTM1.
      const allowedSources = new Set(["result", "CUTM1", "som_result"]);
      if (result.source && !allowedSources.has(result.source)) {
        setBasketSubjects([]);
        return;
      }

      if (!result.success) {
        setBasketSubjects([]);
        return;
      }

      const subjects = result.subjects || [];

      if (subjects.length === 0) {
        setBasketSubjects([]);
        return;
      }

      // Format subjects and filter out any with zero students (safety check)
      const formattedSubjects = subjects
        .filter(sub => sub.code && sub.code.trim() !== "" && (sub.totalStudents || 0) > 0)
        .map(sub => ({
          code: sub.code.trim().toUpperCase(),
          name: sub.name || sub.code || "",
          totalStudents: sub.totalStudents || 0
        }))
        .sort((a, b) => a.code.localeCompare(b.code));

      setBasketSubjects(formattedSubjects);
    } catch (err) {
      setBasketSubjects([]);
    } finally {
      setLoadingBasketSubjects(false);
    }
  }, [subjectComparisonBatch, subjectComparisonBranch, subjectComparisonSemester]);

  // Fetch analytics data (always fetches all data, filtering happens client-side)
  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get school and campus from URL params (priority) or localStorage
      const schoolParam = searchParams.get('school');
      const campusParam = searchParams.get('campus');
      
      // Build URL with school-specific route
      let analyticsUrl = getSchoolApiUrl("analytics");
      
      // Ensure school and campus params are in URL
      if (schoolParam || campusParam) {
        const url = new URL(analyticsUrl, window.location.origin);
        if (schoolParam) url.searchParams.set('school', schoolParam);
        if (campusParam) url.searchParams.set('campus', campusParam);
        analyticsUrl = url.pathname + url.search;
      }

      console.log('Fetching analytics from:', analyticsUrl);
      
      const response = await fetch(analyticsUrl, {
        method: "GET",
        credentials: "include", // Include cookies for authentication
      });
      const result = await response.json();

      if (!response.ok) {
        console.error('Analytics API error:', result);
        throw new Error(result.error || "Failed to fetch analytics data");
      }

      if (!result.success || !result.data) {
        console.error('Invalid analytics response:', result);
        throw new Error("Invalid response format from API");
      }

      console.log('Analytics data received:', result.data);
      setAnalyticsData(result.data);
      return result.data; // Return data for promise handling
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError(err.message || "An error occurred while fetching analytics data");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  // Initial fetch when component mounts or school/campus changes
  useEffect(() => {
    const school = searchParams.get('school');
    const campus = searchParams.get('campus');
    
    // Only fetch if we have school parameter
    if (school) {
      fetchAnalyticsData();
    } else {
      // If no school in URL, try to get from localStorage and wait a bit
      const { school: lsSchool } = getSchoolAndCampus();
      if (lsSchool) {
        // School found in localStorage, fetch after a short delay to ensure URL is updated
        setTimeout(() => {
          fetchAnalyticsData();
        }, 100);
      } else {
        setError("Please select a school to view analytics");
        setLoading(false);
      }
    }
  }, [searchParams, fetchAnalyticsData]);

  // Fetch subjects when filters change
  useEffect(() => {
    fetchBasketSubjects();
  }, [fetchBasketSubjects, subjectComparisonBatch, subjectComparisonBranch, subjectComparisonSemester]);

  // Fetch top performing students data when semester filter changes
  useEffect(() => {
    if (!analyticsData) return; // Wait for initial data

    const fetchTopStudentsData = async () => {
      try {
        setLoadingTopStudents(true);

        // If semester is "all", use the original data (CGPA-based)
        if (topStudentsSemester === "all") {
          setTopStudentsData(null); // null means use currentData.topPerformingStudents
          setLoadingTopStudents(false);
          return;
        }

        // Fetch data filtered by semester (this will calculate SGPA)
        const params = new URLSearchParams();
        const schoolParam = searchParams.get('school');
        const campusParam = searchParams.get('campus');
        
        if (schoolParam) params.set('school', schoolParam);
        if (campusParam) params.set('campus', campusParam);

        // Normalize semester format: "Sem 1" -> "1", "Sem1" -> "1", etc.
        const semValue = String(topStudentsSemester).replace(/^Sem\s*/i, "").trim();
        params.set('semester', semValue);

        const baseUrl = getSchoolApiUrl("analytics");
        const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + params.toString();

        const response = await fetch(url, {
          method: "GET",
          credentials: "include",
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data?.topPerformingStudents) {
            setTopStudentsData(result.data.topPerformingStudents);
          } else {
            setTopStudentsData(null);
          }
        } else {
          setTopStudentsData(null);
        }
      } catch (err) {
        console.error('Error fetching top students data:', err);
        setTopStudentsData(null);
      } finally {
        setLoadingTopStudents(false);
      }
    };

    fetchTopStudentsData();
  }, [topStudentsSemester, analyticsData, searchParams]);

  // Fetch filtered department stats when overviewBatchFilter / overviewBranchFilter changes (ONLY for Department Distribution chart)
  useEffect(() => {
    if (!analyticsData) return; // Wait for initial data

    const fetchFilteredDepartmentStats = async () => {
      try {
        setLoadingDepartmentStats(true);
        // If both filters are "all", use original department stats
        if (overviewBatchFilter === "all" && overviewBranchFilter === "all") {
          setFilteredDepartmentStats(analyticsData.departmentStats || null);
        } else {
          // Fetch filtered data from API (server already understands batch + branch filters)
          const abortController = new AbortController();
          const baseUrl = getSchoolApiUrl("analytics");

          const params = new URLSearchParams();
          if (overviewBatchFilter !== "all") {
            params.set("batch", overviewBatchFilter);
          }
          if (overviewBranchFilter !== "all") {
            params.set("branch", overviewBranchFilter);
          }

          const queryString = params.toString();
          const analyticsUrl = baseUrl + (baseUrl.includes('?') ? '&' : '?') + queryString;

          const response = await fetch(analyticsUrl, {
            method: "GET",
            credentials: "include",
            signal: abortController.signal,
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
        // Fallback to original on error
        setFilteredDepartmentStats(analyticsData.departmentStats || null);
      } finally {
        setLoadingDepartmentStats(false);
      }
    };

    fetchFilteredDepartmentStats();
  }, [overviewBatchFilter, overviewBranchFilter, analyticsData]);

  // Fetch filtered passing stats when passingAnalysisBatch or passingAnalysisBranch changes
  useEffect(() => {
    if (!analyticsData) return;

    const abortController = new AbortController();

    const fetchFilteredPassingStats = async () => {
      try {
        setLoadingPassingStats(true);

        // If no filters, use original data from analyticsData
        if (passingAnalysisBatch.length === 0 && passingAnalysisBranch.length === 0 && passingAnalysisSemester.length === 0) {
          setFilteredPassingStats(analyticsData?.performanceMetrics || null);
          setFilteredPassingStatsByBatch(analyticsData?.performanceMetricsByBatch || null);
          setFilteredPassingStatsByBranch(analyticsData?.performanceMetricsByBranch || null);
          setFilteredPassingStatsByCombination([]);
          setLoadingPassingStats(false);
          return;
        }

        // Check if multiple filter types are selected
        const semesters = passingAnalysisSemester
          .filter(s => s !== "all")
          .map(s => s.replace(/^Sem\s*/i, "").trim())
          .filter(s => s);

        const hasMultipleFilterTypes =
          (passingAnalysisBatch.length > 0 && passingAnalysisBranch.length > 0) ||
          (passingAnalysisBatch.length > 0 && semesters.length > 0) ||
          (passingAnalysisBranch.length > 0 && semesters.length > 0) ||
          (passingAnalysisBatch.length > 0 && passingAnalysisBranch.length > 0 && semesters.length > 0);

        if (hasMultipleFilterTypes) {
          // SUPER OPTIMIZATION: Make ONE API call and calculate all combinations on frontend
          // This is 10-100x faster than making individual API calls

          // Generate all combinations
          const batches = passingAnalysisBatch.filter(b => b !== "all");
          const branches = passingAnalysisBranch.filter(b => b !== "all");

          // Make ONE API call with all filters
          const allFiltersParams = new URLSearchParams();
          batches.forEach(b => allFiltersParams.append("batch", b));
          branches.forEach(b => allFiltersParams.append("branch", b));
          semesters.forEach(s => allFiltersParams.append("semester", s));

          try {
            const startTime = Date.now();
            const baseUrl = getSchoolApiUrl("analytics");
            let analyticsUrl = baseUrl + (baseUrl.includes('?') ? '&' : '?') + allFiltersParams.toString();
            const allDataResponse = await fetch(analyticsUrl, {
              method: "GET",
              credentials: "include",
              signal: abortController.signal,
            });

            if (abortController.signal.aborted) return;

            const allDataResult = await allDataResponse.json();

            if (abortController.signal.aborted) return;

            if (allDataResponse.ok && allDataResult.success && allDataResult.data) {
              // FIRST: Check if API returned combination breakdown (best case - most accurate)
              if (allDataResult.data?.performanceMetricsByCombination &&
                Array.isArray(allDataResult.data.performanceMetricsByCombination) &&
                allDataResult.data.performanceMetricsByCombination.length > 0) {
                const combinationResults = allDataResult.data.performanceMetricsByCombination
                  .filter(combo => combo && (combo.total || combo.passed || combo.failed))
                  .map(combo => ({
                    label: `${combo.batch || ''} ${combo.branch || ''}${combo.semester ? ` Sem ${combo.semester}` : ''}`.trim(),
                    batch: combo.batch || null,
                    branch: combo.branch || null,
                    semester: combo.semester || null,
                    data: {
                      totalRecords: combo.total || 0,
                      passedRecords: combo.passed || 0,
                      failedRecords: combo.failed || 0,
                      passRate: combo.passRate || 0
                    },
                    error: null
                  }));

                setFilteredPassingStatsByCombination(combinationResults);

                // Calculate overall strictly from the combination results (respects filters)
                const total = combinationResults.reduce((sum, c) => sum + (c.data.totalRecords || 0), 0);
                const passed = combinationResults.reduce((sum, c) => sum + (c.data.passedRecords || 0), 0);
                setFilteredPassingStats({
                  totalRecords: total,
                  passedRecords: passed,
                  failedRecords: total - passed,
                  passRate: total > 0 ? (passed / total) * 100 : 0
                });

                setFilteredPassingStatsByBatch(null);
                setFilteredPassingStatsByBranch(null);
                setLoadingPassingStats(false);
                return;
              }

              // If API didn't return combinations, we need to make individual calls
              // Don't use overall metrics - they're not accurate for individual combinations
            }
          } catch (err) {
            if (err.name !== 'AbortError' && !abortController.signal.aborted) {
              // Error fetching all filtered data
            }
          }

          // Fallback: If single call approach doesn't work, use individual calls (but optimized)
          const combinationPromises = [];

          // Helper function to create a safe fetch promise
          const createFetchPromise = async (params, label, batch, branch, semesterParam = null) => {
            // Check if already aborted
            if (abortController.signal.aborted) {
              return {
                label,
                batch,
                branch,
                data: null,
                error: "Request aborted"
              };
            }

            try {
              const baseUrl = getSchoolApiUrl("analytics");
              let url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + params.toString();
              const response = await fetch(url, {
                method: "GET",
                credentials: "include",
                signal: abortController.signal,
              });

              // Check if aborted after fetch
              if (abortController.signal.aborted) {
                return {
                  label,
                  batch,
                  branch,
                  data: null,
                  error: "Request aborted"
                };
              }

              if (!response.ok) {
                return {
                  label,
                  batch,
                  branch,
                  data: null,
                  error: `HTTP ${response.status}`
                };
              }

              const result = await response.json();

              // Check if aborted after parsing
              if (abortController.signal.aborted) {
                return {
                  label,
                  batch,
                  branch,
                  data: null,
                  error: "Request aborted"
                };
              }

              if (!result.success) {
                return {
                  label,
                  batch,
                  branch,
                  data: null,
                  error: result.error || "Unknown error"
                };
              }

              // Default to overall metrics
              let metrics = result.data?.performanceMetrics;

              // If semester-specific request, prefer per-semester breakdown when labels match DB Sem values
              if (semesterParam) {
                const semNorm = (v) => {
                  const t = String(v ?? "").replace(/^Sem\s*/i, "").trim();
                  const n = parseInt(t, 10);
                  return Number.isNaN(n) ? t.toLowerCase() : n;
                };
                const semValue = String(semesterParam).replace(/^Sem\s*/i, "").trim();
                const target = semNorm(semValue);
                const semBreakdown = Array.isArray(result.data?.performanceMetricsBySemester)
                  ? result.data.performanceMetricsBySemester.find((s) => {
                    const raw = s.semester ?? s.sem ?? s.Sem ?? "";
                    return semNorm(raw) === target;
                  })
                  : null;
                if (semBreakdown) {
                  const total = semBreakdown.total ?? semBreakdown.totalRecords ?? 0;
                  const passed = semBreakdown.passed ?? semBreakdown.passedRecords ?? 0;
                  const failed = semBreakdown.failed ?? semBreakdown.failedRecords ?? (total - passed);
                  const passRateVal =
                    semBreakdown.passRate ??
                    (total > 0 ? (passed / total) * 100 : 0);
                  metrics = {
                    totalRecords: total,
                    passedRecords: passed,
                    failedRecords: failed,
                    passRate: passRateVal,
                  };
                } else {
                  // Query was already scoped to this semester on the server — use aggregate metrics
                  metrics = result.data?.performanceMetrics ?? null;
                }
              }

              if (!metrics) {
                return {
                  label,
                  batch,
                  branch,
                  data: null,
                  error: "No performance metrics"
                };
              }

              return {
                label,
                batch,
                branch,
                semester: semesterParam,
                data: metrics,
                error: null
              };
            } catch (err) {
              // Handle AbortError gracefully - don't re-throw, just return error object
              if (err.name === 'AbortError' || abortController.signal.aborted) {
                return {
                  label,
                  batch,
                  branch,
                  data: null,
                  error: "Request aborted"
                };
              }
              return {
                label,
                batch,
                branch,
                data: null,
                error: err.message || "Unknown error"
              };
            }
          };

          // Generate combinations based on selected filters
          // Note: This code path is now optimized to use single API call above
          // Keeping this for fallback scenarios
          if (batches.length > 0 && branches.length > 0 && semesters.length > 0) {
            // All three: Batch + Branch + Semester
            batches.forEach(batch => {
              branches.forEach(branch => {
                semesters.forEach(sem => {
                  const params = new URLSearchParams();
                  params.append("batch", batch);
                  params.append("branch", branch);
                  params.append("semester", sem);

                  combinationPromises.push(
                    createFetchPromise(params, `${batch} ${branch} Sem ${sem}`, batch, branch, sem)
                  );
                });
              });
            });
          } else if (batches.length > 0 && branches.length > 0) {
            // Batch + Branch (no semester)
            batches.forEach(batch => {
              branches.forEach(branch => {
                const params = new URLSearchParams();
                params.append("batch", batch);
                params.append("branch", branch);

                combinationPromises.push(
                  createFetchPromise(params, `${batch} ${branch}`, batch, branch)
                );
              });
            });
          } else if (batches.length > 0 && semesters.length > 0) {
            // Batch + Semester (no branch)
            batches.forEach(batch => {
              semesters.forEach(sem => {
                const params = new URLSearchParams();
                params.append("batch", batch);
                params.append("semester", sem);

                combinationPromises.push(
                  createFetchPromise(params, `${batch} Sem ${sem}`, batch, null, sem)
                );
              });
            });
          } else if (branches.length > 0 && semesters.length > 0) {
            // Branch + Semester (no batch)
            branches.forEach(branch => {
              semesters.forEach(sem => {
                const params = new URLSearchParams();
                params.append("branch", branch);
                params.append("semester", sem);

                combinationPromises.push(
                  createFetchPromise(params, `${branch} Sem ${sem}`, null, branch, sem)
                );
              });
            });
          }

          // Wait for all combinations to fetch (use Promise.allSettled to handle individual failures)
          // OPTIMIZATION: Limit concurrent requests to avoid overwhelming the server
          const MAX_CONCURRENT = 3; // CRITICAL: Reduced to 3 to prevent MongoDB connection limit issues
          try {
            if (combinationPromises.length === 0) {
              setFilteredPassingStatsByCombination([]);
            } else {

              // Process promises in batches to avoid overwhelming the server
              const combinationResults = [];
              for (let i = 0; i < combinationPromises.length; i += MAX_CONCURRENT) {
                const batch = combinationPromises.slice(i, i + MAX_CONCURRENT);
                if (abortController.signal.aborted) break;

                const batchResults = await Promise.allSettled(batch);
                combinationResults.push(...batchResults);

                // Increased delay between batches to prevent MongoDB connection exhaustion
                if (i + MAX_CONCURRENT < combinationPromises.length && !abortController.signal.aborted) {
                  await new Promise(resolve => setTimeout(resolve, 300));
                }
              }

              // Check if aborted before processing results
              if (abortController.signal.aborted) {
                return;
              }

              const successfulResults = combinationResults
                .filter(result => {
                  if (result.status === 'fulfilled') {
                    return true;
                  }
                  // Log rejected promises but don't throw
                  if (result.reason && result.reason.name !== 'AbortError') {
                    // Promise rejected
                  }
                  return false;
                })
                .map(result => result.value)
                .filter(result => result && !result.error); // Filter out error results


              // Also fetch overall stats for fallback (only if not aborted)
              if (!abortController.signal.aborted) {
                const overallParams = new URLSearchParams();
                batches.forEach(b => overallParams.append("batch", b));
                branches.forEach(b => overallParams.append("branch", b));
                semesters.forEach(s => overallParams.append("semester", s));

                try {
                  let baseUrl = getSchoolApiUrl("analytics");
                  let overallUrl = baseUrl + (baseUrl.includes('?') ? '&' : '?') + overallParams.toString();
                  const overallResponse = await fetch(overallUrl, {
                    method: "GET",
                    credentials: "include",
                    signal: abortController.signal,
                  });

                  if (!abortController.signal.aborted && overallResponse.ok) {
                    const overallResult = await overallResponse.json();
                    if (overallResult.success && overallResult.data?.performanceMetrics) {
                      setFilteredPassingStats(overallResult.data.performanceMetrics);
                    }
                  }
                } catch (overallErr) {
                  // Only log non-abort errors
                  if (overallErr.name !== 'AbortError' && !abortController.signal.aborted) {
                    // Error fetching overall stats
                  }
                }
              }

              // Only update state if not aborted
              if (!abortController.signal.aborted) {
                setFilteredPassingStatsByCombination(successfulResults);
                // Compute summary strictly from successful results (respect filters)
                const total = successfulResults.reduce((sum, r) => sum + (r?.data?.totalRecords || 0), 0);
                const passed = successfulResults.reduce((sum, r) => sum + (r?.data?.passedRecords || 0), 0);
                setFilteredPassingStats({
                  totalRecords: total,
                  passedRecords: passed,
                  failedRecords: total - passed,
                  passRate: total > 0 ? (passed / total) * 100 : 0
                });
                setFilteredPassingStatsByBatch(null);
                setFilteredPassingStatsByBranch(null);
              }
            }
          } catch (err) {
            // Only handle non-abort errors
            if (err.name !== 'AbortError' && !abortController.signal.aborted) {
              setFilteredPassingStatsByCombination([]);
            }
          }
        } else {
          // Single filter type - fetch with breakdowns
          const params = new URLSearchParams();

          // Add all batch filters
          passingAnalysisBatch.forEach(batch => {
            if (batch !== "all") {
              params.append("batch", batch);
            }
          });

          // Add all branch filters
          passingAnalysisBranch.forEach(branch => {
            if (branch !== "all") {
              params.append("branch", branch);
            }
          });

          // Add all semester filters (normalize "Sem 1" to "1", etc.)
          passingAnalysisSemester.forEach(sem => {
            if (sem !== "all") {
              // Convert "Sem 1" to "1", "Sem 2" to "2", etc.
              const semValue = sem.replace(/^Sem\s*/i, "").trim();
              params.append("semester", semValue);
            }
          });

          const baseUrl = getSchoolApiUrl("analytics");
          let url = baseUrl + (params.toString() ? (baseUrl.includes('?') ? '&' : '?') + params.toString() : "");

          // Check if aborted before fetch
          if (abortController.signal.aborted) {
            return;
          }

          const response = await fetch(url, {
            method: "GET",
            credentials: "include",
            signal: abortController.signal,
          });

          // Check if aborted after fetch
          if (abortController.signal.aborted) {
            return;
          }

          const result = await response.json();

          // Check if aborted after parsing
          if (abortController.signal.aborted) {
            return;
          }

          if (response.ok && result.success) {
            // Set overall metrics
            setFilteredPassingStats(result.data?.performanceMetrics || null);

            // Set breakdowns if available
            if (result.data?.performanceMetricsByBatch) {
              setFilteredPassingStatsByBatch(result.data.performanceMetricsByBatch);
            } else {
              setFilteredPassingStatsByBatch(null);
            }

            if (result.data?.performanceMetricsByBranch) {
              setFilteredPassingStatsByBranch(result.data.performanceMetricsByBranch);
            } else {
              setFilteredPassingStatsByBranch(null);
            }

            setFilteredPassingStatsByCombination([]);
          }
        }
      } catch (err) {
        // Only handle non-abort errors
        if (err.name !== 'AbortError' && !abortController.signal.aborted) {
          setFilteredPassingStats(null);
          setFilteredPassingStatsByBatch(null);
          setFilteredPassingStatsByBranch(null);
          setFilteredPassingStatsByCombination([]);
        }
      } finally {
        // Only update loading state if not aborted
        if (!abortController.signal.aborted) {
          setLoadingPassingStats(false);
        }
      }
    };

    fetchFilteredPassingStats();

    return () => {
      abortController.abort();
    };
  }, [passingAnalysisBatch, passingAnalysisBranch, passingAnalysisSemester, analyticsData]);

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
    if (regNoStr.length !== 12) return null;

    // Program code (index 4-6)
    const programCode = regNoStr.slice(4, 6);
    const branchCode = regNoStr.slice(5, 8); // 3 digits from index 5-7

    // Diploma (SOVET) - program code 07
    if (programCode === '07' || isDiploma) {
      const diplomaBranchMap = {
        '711': 'CIVIL',
        '712': 'ME',
        '713': 'CIVIL',
        '714': 'CSE',
        '715': 'AUTOMOBILE',
        '716': 'MINING'
      };
      return diplomaBranchMap[branchCode] || null;
    }

    // B.Tech (SOET)
    const btechBranchMap = {
      '111': 'CIVIL',
      '112': 'CSE',
      '113': 'ECE',
      '115': 'EEE',
      '116': 'ME',
      '117': 'AIML'
    };
    return btechBranchMap[branchCode] || null;
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
        const batch = s.batch || getBatchFromRegNo(regNo);
        const branch = s.branch || getBranchFromRegNo(regNo);

        // Branch abbreviation mapping
        const branchMap = {
          'CSE': 'Computer Science Engineering',
          'ECE': 'Electronics & Communication Engineering',
          'EEE': 'Electrical & Electronics Engineering',
          'EE': 'Electrical Engineering',
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

  // ====================== Subject Passing Comparison ======================
  // Fetch subject comparison data with filters
  useEffect(() => {
    if (selectedSubjects.length === 0) {
      setSubjectComparisonData([]);
      return;
    }

    const abortController = new AbortController();

    const fetchSubjectComparison = async () => {
      try {
        setLoadingSubjectComparison(true);

        // Build query parameters
        const params = new URLSearchParams();
        if (subjectComparisonBatch && subjectComparisonBatch !== "all") {
          params.set("batch", subjectComparisonBatch);
        }
        if (subjectComparisonBranch && subjectComparisonBranch !== "all") {
          params.set("branch", subjectComparisonBranch);
        }
        if (subjectComparisonSemester && subjectComparisonSemester !== "all") {
          params.set("semester", subjectComparisonSemester);
        }
        params.set("subjects", selectedSubjects.join(","));

        const baseUrl = getSchoolApiUrl("analytics/subject-comparison");
        let comparisonUrl = baseUrl + (baseUrl.includes('?') ? '&' : '?') + params.toString();
        const response = await fetch(comparisonUrl, {
          method: "GET",
          credentials: "include",
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to fetch subject comparison data");
        }

        const result = await response.json();

        if (result.success && result.data) {
          // Map API response to our format
          const comparisonData = selectedSubjects.map((subjectCode) => {
            const normalizedCode = String(subjectCode).trim().toUpperCase();
            const subData = result.data.find((s) => {
              const normalizedSubject = String(s.subject || "").trim().toUpperCase();
              return normalizedSubject === normalizedCode;
            });

            if (!subData) {
              return {
                subject: subjectCode,
                passRate: 0,
                failRate: 0,
                totalStudents: 0,
                passed: 0,
                failed: 0,
                average: 0,
                hasData: false,
                gradeDistribution: {}
              };
            }

            const failedCount = subData.failed || 0;
            const unattemptedCount = subData.unattempted || 0;
            const totalStudents = subData.totalStudents || 0;
            const passedCount = subData.passed || (totalStudents - failedCount - unattemptedCount);
            const attempted = subData.attempted || (totalStudents - unattemptedCount);
            // All percentages should be based on total to add up to 100%
            const passRate = parseFloat(subData.passRate || (totalStudents > 0 ? ((passedCount / totalStudents) * 100).toFixed(1) : 0));
            const failRate = parseFloat(subData.failRate || (totalStudents > 0 ? ((failedCount / totalStudents) * 100).toFixed(1) : 0));
            const unattemptedRate = parseFloat(subData.unattemptedRate || (totalStudents > 0 ? ((unattemptedCount / totalStudents) * 100).toFixed(1) : 0));
            const hasData = totalStudents > 0; // Only true if there are actual students

            return {
              subject: subjectCode,
              passRate: passRate,
              failRate: failRate,
              unattemptedRate: unattemptedRate,
              totalStudents: totalStudents,
              passed: passedCount,
              failed: failedCount,
              unattempted: unattemptedCount,
              attempted: attempted,
              average: parseFloat(subData.average || 0),
              hasData: hasData,
              gradeDistribution: subData.gradeDistribution || {} // Store grade distribution
            };
          });

          setSubjectComparisonData(comparisonData);

          // Auto-remove subjects with no data from selection & dropdown
          const noDataSubjects = comparisonData.filter(s => !s.hasData).map(s => s.subject);
          if (noDataSubjects.length > 0) {
            setSelectedSubjects(prev => prev.filter(code => !noDataSubjects.includes(code)));
            setBasketSubjects(prev => prev.filter(sub => !noDataSubjects.includes(sub.code)));
            setSelectedSubjectToAdd("");
          }

          setSubjectComparisonUniqueStudents(
            typeof result.uniqueStudents === "number" ? result.uniqueStudents : null
          );
          setSubjectComparisonPassedAll(
            typeof result.passedAllStudents === "number" ? result.passedAllStudents : null
          );
        } else {
          setSubjectComparisonData([]);
          setSubjectComparisonUniqueStudents(null);
          setSubjectComparisonPassedAll(null);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setSubjectComparisonData([]);
          setSubjectComparisonUniqueStudents(null);
          setSubjectComparisonPassedAll(null);
        }
      } finally {
        setLoadingSubjectComparison(false);
      }
    };

    fetchSubjectComparison();

    return () => {
      abortController.abort();
    };
  }, [selectedSubjects, subjectComparisonBatch, subjectComparisonBranch, subjectComparisonSemester]);

  // Fetch students when exactly 1 subject is selected
  // Fetch students for selected subject from dropdown (triggers when subject is selected)
  useEffect(() => {
    if (!selectedSubjectToAdd || selectedSubjectToAdd === "__ALL__" || selectedSubjectToAdd === "") {
      setSubjectStudents([]);
      setSelectedStudentRegNo("");
      setSelectedStudents([]);
      setStudentsError(null);
      return;
    }

    const fetchStudents = async () => {
      try {
        setLoadingStudents(true);
        setStudentsError(null);
        const subjectCode = selectedSubjectToAdd;

        const params = new URLSearchParams();
        params.set('subject', subjectCode);
        if (subjectComparisonBatch && subjectComparisonBatch !== "all") {
          params.set('batch', subjectComparisonBatch);
        }
        if (subjectComparisonBranch && subjectComparisonBranch !== "all") {
          params.set('branch', subjectComparisonBranch);
        }
        if (subjectComparisonSemester && subjectComparisonSemester !== "all") {
          // Normalize semester format: "Sem 1" -> "1", "Sem1" -> "1", etc.
          const semValue = String(subjectComparisonSemester).replace(/^Sem\s*/i, "").trim();
          params.set('semester', semValue);
        }

        const baseUrl = getSchoolApiUrl("analytics/subject-students");
        let url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + params.toString();

        const response = await fetch(url, {
          credentials: "include",
        });

        if (response.ok) {
          const result = await response.json();

          if (result.success && Array.isArray(result.students)) {
            setSubjectStudents(result.students);
            setSelectedStudents([]); // Clear selections when new students are loaded
            setStudentsError(null);

            if (result.students.length === 0) {
              // Build filter message
              const activeFilters = [];
              if (subjectComparisonBatch && subjectComparisonBatch !== "all") {
                activeFilters.push(`Batch: ${subjectComparisonBatch}`);
              }
              if (subjectComparisonBranch && subjectComparisonBranch !== "all") {
                activeFilters.push(`Branch: ${subjectComparisonBranch}`);
              }
              if (subjectComparisonSemester && subjectComparisonSemester !== "all") {
                activeFilters.push(`Semester: ${subjectComparisonSemester}`);
              }

              const filterMsg = activeFilters.length > 0
                ? ` with filters: ${activeFilters.join(", ")}`
                : " (no filters applied)";

              let errorMessage = `No students found for subject "${subjectCode}"${filterMsg}.`;

              if (activeFilters.length > 0) {
                errorMessage += ` The filters may be too restrictive. Try clicking "Try without filters" below or adjust the filters above.`;
              } else {
                errorMessage += ` This subject may not exist in the database, or it may have a different code format.`;
              }

              setStudentsError(errorMessage);
            }
          } else {
            setSubjectStudents([]);
            setStudentsError("Invalid response from server. Please try again.");
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          setSubjectStudents([]);
          setStudentsError(errorData.error || `Failed to fetch students (Status: ${response.status})`);
        }
      } catch (err) {
        setSubjectStudents([]);
        setStudentsError(`Network error: ${err.message}. Please check your connection and try again.`);
      } finally {
        setLoadingStudents(false);
      }
    };

    fetchStudents();
  }, [selectedSubjectToAdd, subjectComparisonBatch, subjectComparisonBranch, subjectComparisonSemester]);

  // When exactly one student is selected, fetch that student's full records
  useEffect(() => {
    const regNo = selectedStudents.length === 1 ? selectedStudents[0] : null;
    if (!regNo) {
      setStudentRecords([]);
      setStudentRecordsError(null);
      setLoadingStudentRecords(false);
      return;
    }

    const fetchStudentRecords = async () => {
      try {
        setLoadingStudentRecords(true);
        setStudentRecordsError(null);
        let studentsUrl = getSchoolApiUrl('students');
        const res = await fetch(studentsUrl, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ registration: regNo })
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        setStudentRecords(Array.isArray(data.records) ? data.records : []);
      } catch (err) {
        setStudentRecords([]);
        setStudentRecordsError(err.message || 'Failed to fetch student records');
      } finally {
        setLoadingStudentRecords(false);
      }
    };

    fetchStudentRecords();
  }, [selectedStudents]);

  // Fetch all records for selected students and compute subject-wise analysis
  useEffect(() => {
    if (selectedStudents.length === 0) {
      setSubjectWiseAnalysis([]);
      setStudentRecordsForExport([]);
      return;
    }

    const fetchSubjectWiseData = async () => {
      try {
        setLoadingSubjectWiseAnalysis(true);
        // Fetch records for each selected student
        const allRecords = [];

        for (const regNo of selectedStudents) {
          try {
            let studentsUrl = getSchoolApiUrl('students');
            const res = await fetch(studentsUrl, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ registration: regNo })
            });

            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data.records)) {
                allRecords.push(...data.records);
              }
            }
          } catch (err) {
            console.error(`Failed to fetch records for ${regNo}:`, err);
          }
        }

        // Filter by selected subject if one is chosen
        let filteredRecords = allRecords;
        if (selectedSubjectToAdd && selectedSubjectToAdd !== "__ALL__") {
          const normalizedSubject = String(selectedSubjectToAdd).trim().toUpperCase();
          filteredRecords = allRecords.filter(record => {
            const subCode = (record.Subject_Code || '').toString().toUpperCase();
            return subCode === normalizedSubject || subCode.includes(normalizedSubject);
          });
        }

        // Group by subject and calculate pass/fail/unattempted
        // S and R grades are unattempted (neither pass nor fail)
        // F, M, I grades are failed
        const subjectMap = {};
        filteredRecords.forEach(record => {
          const subject = record.Subject_Code || record["Subject Code"] || record.Subject_Name || 'Unknown';
          // Normalize grade: check multiple possible field names, trim whitespace and convert to uppercase
          const gradeRaw = record.Grade || record.grade || record.GRADE || '';
          const grade = String(gradeRaw).trim().toUpperCase();
          const passingGrades = ['O', 'E', 'A', 'B', 'C', 'D'];
          const unattemptedGrades = ['S', 'R'];
          const failedGrades = ['F', 'M', 'I'];
          
          const isPassed = passingGrades.includes(grade);
          const isUnattempted = unattemptedGrades.includes(grade);
          const isFailed = failedGrades.includes(grade);

          if (!subjectMap[subject]) {
            subjectMap[subject] = { passed: 0, failed: 0, unattempted: 0, total: 0 };
          }

          subjectMap[subject].total++;
          if (isPassed) {
            subjectMap[subject].passed++;
          } else if (isUnattempted) {
            subjectMap[subject].unattempted++;
          } else if (isFailed) {
            subjectMap[subject].failed++;
          } else {
            // Unknown or empty grade - check if it's actually empty
            if (grade === '' || !grade) {
              // Empty grade - could be unattempted
              subjectMap[subject].unattempted++;
            } else {
              // Unknown grade - treat as failed for safety
            subjectMap[subject].failed++;
            }
          }
        });

        // Convert to array and sort by subject name
        // All percentages should be based on total to add up to 100%
        const analysis = Object.entries(subjectMap)
          .map(([subject, data]) => {
            const attempted = data.total - data.unattempted;
            // Calculate all percentages based on total students so they add up to 100%
            const passRate = data.total > 0 ? ((data.passed / data.total) * 100).toFixed(1) : '0.0';
            const failRate = data.total > 0 ? ((data.failed / data.total) * 100).toFixed(1) : '0.0';
            const unattemptedRate = data.total > 0 ? ((data.unattempted / data.total) * 100).toFixed(1) : '0.0';
            return {
            subject,
            passed: data.passed,
            failed: data.failed,
              unattempted: data.unattempted,
            total: data.total,
              attempted: attempted,
              passRate: passRate,
              failRate: failRate,
              unattemptedRate: unattemptedRate
            };
          })
          .sort((a, b) => a.subject.localeCompare(b.subject));

        setSubjectWiseAnalysis(analysis);
        // Store records for Excel export (with grades)
        setStudentRecordsForExport(filteredRecords);
      } finally {
        setLoadingSubjectWiseAnalysis(false);
      }
    };

    fetchSubjectWiseData();
  }, [selectedStudents, selectedSubjectToAdd]);

  const exportToExcel = useCallback((data) => {
    if (!data || data.length === 0) return;

    try {
      // Prepare data for Excel
      const excelData = data.map((item, idx) => {
        const failed = (item.Total || 0) - (item.Passed || 0);
        return {
          "S.No": idx + 1,
          "Category": item.name || "N/A",
          "Total Students": item.Total || 0,
          "Passed": item.Passed || 0,
          "Failed": failed,
          "Pass Rate (%)": item.PassRate ? `${item.PassRate.toFixed(1)}%` : "0%"
        };
      });

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Pass Rate Analysis");

      // Set column widths
      const colWidths = [
        { wch: 8 },   // S.No
        { wch: 30 },  // Category
        { wch: 15 },  // Total Students
        { wch: 12 },  // Passed
        { wch: 12 },  // Failed
        { wch: 15 }   // Pass Rate
      ];
      ws['!cols'] = colWidths;

      // Generate filename with current date
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Pass_Rate_Analysis_${dateStr}.xlsx`;

      // Export to file
      XLSX.writeFile(wb, filename);
    } catch (error) {
      alert("Failed to export to Excel. Please try again.");
    }
  }, []);

  // Download Report function (PDF)
  const downloadReport = useCallback((data) => {
    if (!data || data.length === 0) {
      alert("No data available to download.");
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
      doc.text("Pass Rate Analysis Report", 14, 20);

      // Add date
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

      // Prepare table data
      const tableData = data.map((item, idx) => {
        if (!item) return null;
        const failed = (item.Total || 0) - (item.Passed || 0);
        return [
          idx + 1,
          item.name || "N/A",
          item.Total || 0,
          item.Passed || 0,
          failed,
          item.PassRate ? `${item.PassRate.toFixed(1)}%` : "0%"
        ];
      }).filter(row => row !== null);

      if (tableData.length === 0) {
        alert("No valid data to generate report.");
        return;
      }

      // Check if autoTable is available
      if (typeof doc.autoTable === 'undefined') {
        // Fallback: Create simple table without autoTable
        let yPos = 40;
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);

        // Headers
        doc.setFont(undefined, 'bold');
        doc.text("S.No", 14, yPos);
        doc.text("Category", 25, yPos);
        doc.text("Total", 100, yPos);
        doc.text("Passed", 120, yPos);
        doc.text("Failed", 140, yPos);
        doc.text("Pass Rate", 160, yPos);

        yPos += 10;
        doc.setFont(undefined, 'normal');

        tableData.forEach((row) => {
          if (yPos > 280) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(String(row[0]), 14, yPos);
          doc.text(String(row[1]).substring(0, 20), 25, yPos);
          doc.text(String(row[2]), 100, yPos);
          doc.text(String(row[3]), 120, yPos);
          doc.text(String(row[4]), 140, yPos);
          doc.text(String(row[5]), 160, yPos);
          yPos += 8;
        });
      } else {
        // Use autoTable if available
        doc.autoTable({
          startY: 35,
          head: [["S.No", "Category", "Total Students", "Passed", "Failed", "Pass Rate (%)"]],
          body: tableData,
          theme: "striped",
          headStyles: {
            fillColor: [30, 41, 59],
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
            1: { cellWidth: 60 },
            2: { cellWidth: 30 },
            3: { cellWidth: 25 },
            4: { cellWidth: 25 },
            5: { cellWidth: 30 }
          }
        });
      }

      // Add summary statistics
      const totalStudents = data.reduce((sum, item) => sum + (item?.Total || 0), 0);
      const totalPassed = data.reduce((sum, item) => sum + (item?.Passed || 0), 0);
      const totalFailed = totalStudents - totalPassed;
      const overallPassRate = totalStudents > 0 ? ((totalPassed / totalStudents) * 100).toFixed(1) : 0;

      // Get final Y position
      let finalY = 35;
      if (doc.lastAutoTable && doc.lastAutoTable.finalY) {
        finalY = doc.lastAutoTable.finalY + 10;
      } else {
        finalY = 40 + (tableData.length * 8) + 10;
      }

      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text("Summary Statistics", 14, finalY);

      doc.setFontSize(10);
      doc.text(`Total Students: ${totalStudents}`, 14, finalY + 8);
      doc.text(`Total Passed: ${totalPassed}`, 14, finalY + 14);
      doc.text(`Total Failed: ${totalFailed}`, 14, finalY + 20);
      doc.setFontSize(11);
      doc.setTextColor(16, 185, 129);
      doc.text(`Overall Pass Rate: ${overallPassRate}%`, 14, finalY + 26);

      // Generate filename
      const dateStrFile = new Date().toISOString().split('T')[0];
      const filename = `Pass_Rate_Analysis_Report_${dateStrFile}.pdf`;

      // Save PDF
      doc.save(filename);
    } catch (error) {
      console.error("PDF generation error:", error);
      alert(`Failed to generate report: ${error.message || "Unknown error"}`);
    }
  }, []);

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
  const passingFiltersActive = passingAnalysisBatch.length > 0 || passingAnalysisBranch.length > 0 || passingAnalysisSemester.length > 0;

  const getPassingAnalysis = () => {
    // Use filtered passing stats if available; if filters active but no filtered stats, treat as zero
    const metrics = filteredPassingStats !== null
      ? filteredPassingStats
      : (passingFiltersActive ? { totalRecords: 0, passedRecords: 0, failedRecords: 0, passRate: 0 } : currentData?.performanceMetrics);

    if (!metrics) {
      return { total: 0, passed: 0, fail: 0, passRate: 0 };
    }

    const pr = metrics.passRate;
    const passRateNum =
      typeof pr === "number" && Number.isFinite(pr)
        ? pr
        : parseFloat(pr);
    const safePassRate = Number.isFinite(passRateNum) ? parseFloat(passRateNum.toFixed(1)) : 0;

    return {
      total: metrics.totalRecords || 0,
      passed: metrics.passedRecords || 0,
      fail: metrics.failedRecords || 0,
      passRate: safePassRate
    };
  };

  const passingStats = getPassingAnalysis();

  // Check if we should show breakdown by batch (branch selected, batch = empty)
  const showBatchBreakdown = passingAnalysisBranch.length > 0 && passingAnalysisBatch.length === 0 && filteredPassingStatsByBatch && filteredPassingStatsByBatch.length > 0;

  // Check if we should show breakdown by branch (batch selected, branch = empty)
  const showBranchBreakdown = passingAnalysisBatch.length > 0 && passingAnalysisBranch.length === 0 && filteredPassingStatsByBranch && filteredPassingStatsByBranch.length > 0;

  // Color mapping for branches, batches, and semesters
  const getColorForData = (name, batch, branch, semester = null) => {
    // Color palette for branches
    const branchColors = {
      'CSE': '#3b82f6',    // Blue
      'ECE': '#8b5cf6',     // Purple
      'EEE': '#10b981',     // Emerald
      'ME': '#f59e0b',      // Amber
      'CIVIL': '#ef4444',   // Red
      'AIML': '#ec4899',    // Pink
      'BBA': '#6366f1',     // Indigo (SOM)
      'MBA': '#14b8a6',     // Teal (SOM)
      'CS': '#3b82f6',
      'EC': '#8b5cf6',
      'EE': '#10b981',
      'MECH': '#f59e0b'
    };

    // Color palette for batches (different shades)
    const batchColors = {
      '2022': '#60a5fa',    // Light blue
      '2023': '#34d399',    // Light emerald
      '2024': '#fbbf24',    // Light amber
      '2025': '#f87171',    // Light red
      '2026': '#a78bfa',    // Light purple
      '2027': '#fb7185',    // Light pink
      '2028': '#4ade80'     // Light green
    };

    // Color palette for semesters
    const semesterColors = {
      '1': '#3b82f6',   // Blue
      '2': '#8b5cf6',    // Purple
      '3': '#10b981',    // Emerald
      '4': '#f59e0b',    // Amber
      '5': '#ef4444',    // Red
      '6': '#ec4899',    // Pink
      '7': '#06b6d4',    // Cyan
      '8': '#f97316'     // Orange
    };

    // Extract semester from name if not provided
    if (!semester) {
      const semMatch = name.match(/Sem\s*(\d+)/i);
      if (semMatch) {
        semester = semMatch[1];
      }
    }

    // Priority: Branch > Batch > Semester
    // If branch is available, use branch color
    if (branch && branchColors[branch]) {
      return branchColors[branch];
    }

    // If batch is available, use batch color
    if (batch && batchColors[batch]) {
      return batchColors[batch];
    }

    // If semester is available, use semester color
    if (semester && semesterColors[semester]) {
      return semesterColors[semester];
    }

    // Try to extract branch from name
    const branchMatch = name.match(/\b(CSE|ECE|EEE|ME|CE|AIML|CIVIL|BBA|MBA|CS|EC|EE|MECH)\b/i);
    if (branchMatch && branchColors[branchMatch[1].toUpperCase()]) {
      return branchColors[branchMatch[1].toUpperCase()];
    }

    // Try to extract batch from name
    const batchMatch = name.match(/\b(20\d{2})\b/);
    if (batchMatch && batchColors[batchMatch[1]]) {
      return batchColors[batchMatch[1]];
    }

    // Try to extract semester from name
    const semMatch = name.match(/Sem\s*(\d+)/i);
    if (semMatch && semesterColors[semMatch[1]]) {
      return semesterColors[semMatch[1]];
    }

    // Default gradient colors
    const defaultColors = ['#60a5fa', '#f472b6', '#22c55e', '#f59e0b', '#a855f7', '#2dd4bf', '#ef4444', '#eab308'];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return defaultColors[index % defaultColors.length];
  };

  // Bar chart data - show separate bars for each selected filter value
  const filterValidItems = (items) => {
    if (!items || !Array.isArray(items)) return [];
    return items.filter((item) => {
      const total =
        item?.total ??
        item?.Total ??
        item?.data?.totalRecords ??
        item?.totalRecords ??
        0;
      return total > 0;
    });
  };

  let passFailData = [];

  // If only batch filters selected, show breakdown by branch (branch-wise analysis for batch)
  if (passingAnalysisBatch.length > 0 && passingAnalysisBranch.length === 0) {
    // Show breakdown by branch for selected batch
    const valid = filterValidItems(filteredPassingStatsByBranch);
    if (valid.length > 0) {
      passFailData = valid
        .map(item => {
          const branchUpper = item.branch ? item.branch.toUpperCase() : null;
          return {
            name: item.branch || "Unknown",
            Passed: item.passed || 0,
            PassRate: (item.total && item.total > 0) ? parseFloat((((item.passed || 0) / item.total) * 100).toFixed(1)) : 0,
            Total: item.total || 0,
            branch: branchUpper,
            color: getColorForData(item.branch || "Unknown", null, branchUpper)
          };
        });
    } else {
      passFailData = [];
    }
  }
  // If only branch filters selected, show breakdown by batch
  else if (passingAnalysisBranch.length > 0 && passingAnalysisBatch.length === 0) {
    // Show breakdown by batch for selected branch
    const valid = filterValidItems(filteredPassingStatsByBatch);
    if (valid.length > 0) {
      passFailData = valid
        .map(item => ({
          name: `Batch ${item.batch || "Unknown"}`,
          Passed: item.passed || 0,
          PassRate: (item.total && item.total > 0) ? parseFloat((((item.passed || 0) / item.total) * 100).toFixed(1)) : 0,
          Total: item.total || 0,
          batch: item.batch,
          color: getColorForData(`Batch ${item.batch || "Unknown"}`, item.batch, null)
        }));
    } else {
      passFailData = [];
    }
  }
  // If multiple filter types selected (batch + branch, or batch + branch + semester), show one bar per combination
  if ((passingAnalysisBatch.length > 0 && passingAnalysisBranch.length > 0) ||
    (passingAnalysisBatch.length > 0 && passingAnalysisSemester.length > 0) ||
    (passingAnalysisBranch.length > 0 && passingAnalysisSemester.length > 0) ||
    (passingAnalysisBatch.length > 0 && passingAnalysisBranch.length > 0 && passingAnalysisSemester.length > 0)) {
    // Use combination data if available
    if (filteredPassingStatsByCombination && Array.isArray(filteredPassingStatsByCombination) && filteredPassingStatsByCombination.length > 0) {
      const validCombinations = filteredPassingStatsByCombination.filter(combo => {
        const total = combo?.data?.totalRecords ?? 0;
        const isValid = combo && combo.data && !combo.error && total > 0;
        return isValid;
      });

      if (validCombinations.length > 0) {
        // Sort combinations for better display order:
        // 1. By batch (if available)
        // 2. By branch (if available)
        // 3. By semester (if available)
        const sortedCombinations = [...validCombinations].sort((a, b) => {
          // Extract batch, branch, semester from labels for sorting
          const getSortKey = (combo) => {
            const label = combo.label || "";
            const parts = label.split(/\s+/);
            let batch = "", branch = "", semester = "";

            // Try to extract batch (4-digit year)
            const batchMatch = label.match(/\b(20\d{2})\b/);
            if (batchMatch) batch = batchMatch[1];

            // Try to extract branch (CSE, ECE, etc.)
            const branchMatch = label.match(/\b(CSE|ECE|EEE|ME|CE|AIML|CIVIL|BBA|MBA|CS|EC|EE|MECH)\b/i);
            if (branchMatch) branch = branchMatch[1].toUpperCase();

            // Try to extract semester number
            const semMatch = label.match(/Sem\s*(\d+)/i);
            if (semMatch) semester = String(parseInt(semMatch[1], 10)).padStart(2, "0");

            return `${batch}-${branch}-${semester}`;
          };

          return getSortKey(a).localeCompare(getSortKey(b));
        });

        // Filter out 0% data and map to chart data
        passFailData = sortedCombinations
          .map(combo => {
            if (!combo || !combo.data) return null;
            const metrics = combo.data;
            // Calculate pass rate properly
            let passRate = 0;
            if (metrics.passRate !== undefined && metrics.passRate !== null) {
              const n = typeof metrics.passRate === "number" ? metrics.passRate : parseFloat(metrics.passRate);
              passRate = Number.isFinite(n) ? parseFloat(n.toFixed(1)) : 0;
            } else if (metrics.totalRecords > 0) {
              passRate = parseFloat(((metrics.passedRecords / metrics.totalRecords) * 100).toFixed(1));
            }

            // Calculate pass rate from the actual data (not from the API's passRate which might be aggregated)
            const actualPassRate = metrics.totalRecords > 0
              ? parseFloat(((metrics.passedRecords / metrics.totalRecords) * 100).toFixed(1))
              : 0;

            // Use the calculated pass rate instead of the API's passRate to ensure accuracy
            const finalPassRate = actualPassRate || passRate;

            // Extract batch, branch, and semester from label for color assignment
            const batchMatch = combo.label.match(/\b(20\d{2})\b/);
            const branchMatch = combo.label.match(/\b(CSE|ECE|EEE|ME|CE|AIML|CIVIL|BBA|MBA|CS|EC|EE|MECH)\b/i);
            const semMatch = combo.label.match(/Sem\s*(\d+)/i);
            const batch = batchMatch ? batchMatch[1] : null;
            const branch = branchMatch ? branchMatch[1].toUpperCase() : null;
            const semester = semMatch ? semMatch[1] : (combo.semester ? String(combo.semester).replace(/^Sem\s*/i, "").trim() : null);

            return {
              name: combo.label,
              Passed: metrics.passedRecords || 0,
              PassRate: finalPassRate, // Use calculated pass rate
              Total: metrics.totalRecords || 0,
              batch: batch,
              branch: branch,
              semester: semester,
              color: getColorForData(combo.label, batch, branch, semester)
            };
          })
          // Filter out null entries and entries with 0 total records (no data available)
          .filter(item => item && item.Total > 0);
      } else {
        // Fallback: try to use overall stats if available
        if (filteredPassingStats) {
          const batches = passingAnalysisBatch.filter(b => b !== "all");
          const branches = passingAnalysisBranch.filter(b => b !== "all");

          // Create simple labels for each selected value
          const labels = [];
          if (batches.length > 0 && branches.length > 0) {
            batches.forEach(batch => {
              branches.forEach(branch => {
                labels.push(`Batch ${batch} ${branch}`);
              });
            });
          } else if (batches.length > 0) {
            batches.forEach(batch => {
              labels.push(`Batch ${batch}`);
            });
          } else if (branches.length > 0) {
            branches.forEach(branch => {
              labels.push(branch);
            });
          }

          if (labels.length > 0) {
            passFailData = labels.map(label => {
              const batchMatch = label.match(/\b(20\d{2})\b/);
              const branchMatch = label.match(/\b(CSE|ECE|EEE|ME|CE|AIML|CIVIL|BBA|MBA|CS|EC|EE|MECH)\b/i);
              const batch = batchMatch ? batchMatch[1] : null;
              const branch = branchMatch ? branchMatch[1].toUpperCase() : null;
              return {
                name: label,
                Passed: filteredPassingStats.passedRecords || 0,
                PassRate: (() => {
                  const n = typeof filteredPassingStats.passRate === "number" ? filteredPassingStats.passRate : parseFloat(filteredPassingStats.passRate);
                  return Number.isFinite(n) ? parseFloat(n.toFixed(1)) : 0;
                })(),
                Total: filteredPassingStats.totalRecords || 0,
                batch: batch,
                branch: branch,
                color: getColorForData(label, batch, branch)
              };
            });
          } else {
            passFailData = [];
          }
        } else {
          passFailData = [];
        }
      }
    } else {
      // Fallback: use overall stats
      if (filteredPassingStats) {
        const batches = passingAnalysisBatch.filter(b => b !== "all");
        const branches = passingAnalysisBranch.filter(b => b !== "all");

        if (batches.length > 0 && branches.length > 0) {
          passFailData = batches.flatMap(batch =>
            branches.map(branch => {
              const branchUpper = branch.toUpperCase();
              return {
                name: `Batch ${batch} ${branch}`,
                Passed: filteredPassingStats.passedRecords || 0,
                PassRate: (() => {
                  const n = typeof filteredPassingStats.passRate === "number" ? filteredPassingStats.passRate : parseFloat(filteredPassingStats.passRate);
                  return Number.isFinite(n) ? parseFloat(n.toFixed(1)) : 0;
                })(),
                Total: filteredPassingStats.totalRecords || 0,
                batch: batch,
                branch: branchUpper,
                color: getColorForData(`Batch ${batch} ${branch}`, batch, branchUpper)
              };
            })
          );
        } else {
          passFailData = [];
        }
      } else {
        passFailData = [];
      }
    }
  }
  // No filters - show overall
  else {
    passFailData = [{
      name: "Overall",
      Passed: passingStats.passed || 0,
      PassRate: typeof passingStats.passRate === 'number' ? passingStats.passRate : (typeof passingStats.passRate === 'string' ? parseFloat(passingStats.passRate) || 0 : 0),
      Total: passingStats.total || 0,
      color: getColorForData("Overall", null, null)
    }];
  }

  // Add subject to comparison list (supports "All")
  const handleAddSubject = () => {
    if (!selectedSubjectToAdd) return;

    // Add all subjects
    if (selectedSubjectToAdd === "__ALL__") {
      const allCodes = basketSubjects.map((s) => s.code).filter(Boolean);
      setSelectedSubjects(Array.from(new Set(allCodes)));
      setSelectedSubjectToAdd("");
      return;
    }

    // Add single subject
    if (selectedSubjects.includes(selectedSubjectToAdd)) return;
    setSelectedSubjects([...selectedSubjects, selectedSubjectToAdd]);
    setSelectedSubjectToAdd(""); // Reset dropdown
  };

  // Remove subject from comparison list
  const handleRemoveSubject = (subjectCode) => {
    setSelectedSubjects(selectedSubjects.filter(code => code !== subjectCode));
  };


  // ========================= Render =========================
  return (
    <>
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
              className={`px-6 py-2 rounded-full font-bold transition-all ${activeTab === tab.key
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
                    <FilterSelect
                      value={overviewBranchFilter}
                      onChange={setOverviewBranchFilter}
                      options={branches}
                      label="Branch"
                    />
                  </div>
                  {(overviewBatchFilter !== "all" || overviewBranchFilter !== "all") && (
                    <div className="mb-4 px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-sm text-blue-300 font-semibold">
                      {overviewBatchFilter !== "all" && <>📅 Batch: {overviewBatchFilter}</>}
                      {overviewBatchFilter !== "all" && overviewBranchFilter !== "all" && " • "}
                      {overviewBranchFilter !== "all" && <>🏷️ Branch: {overviewBranchFilter}</>}
                    </div>
                  )}
                  {loadingDepartmentStats ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="inline-block w-8 h-8 border-2 border-blue-300 border-t-transparent rounded-full animate-spin mr-3"></div>
                      <span className="text-blue-300 font-semibold">Loading department data...</span>
                    </div>
                  ) : (
                    <DepartmentChart
                      key={`dept-${overviewBatchFilter}`}
                      data={filteredDepartmentStats || currentData?.departmentStats || []}
                    />
                  )}
                </CoolChartCard>
              )}

            {currentData?.semesterStats && currentData.semesterStats.length > 0 && (
              <CoolChartCard title="Semester Distribution" icon="📚">
                <SemesterChart data={currentData.semesterStats} />
              </CoolChartCard>
            )}

            {currentData?.batchStats && currentData.batchStats.length > 0 && (
              <CoolChartCard title="Batch Distribution" icon="📅">
                <BatchChart data={currentData.batchStats} />
              </CoolChartCard>
            )}

            {(!currentData?.dataSourceStats &&
              (!currentData?.departmentStats || currentData.departmentStats.length === 0) &&
              (!currentData?.semesterStats || currentData.semesterStats.length === 0) &&
              (!currentData?.batchStats || currentData.batchStats.length === 0)) && (
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
              <div className="mb-6 p-5 rounded-2xl border border-white/10 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-amber-400/10 backdrop-blur-sm">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                  <div className="flex items-center gap-2 text-white/90 font-semibold">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    <span className="text-lg">Filter Options</span>
                  </div>

                  <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Batch Checkboxes */}
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <label className="block text-white/90 font-semibold mb-3 text-sm">Batch</label>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {/* Select All */}
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors border-b border-white/10 pb-2 mb-2">
                          <input
                            type="checkbox"
                            checked={passingAnalysisBatch.length === batches.filter(b => b !== "all").length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPassingAnalysisBatch(batches.filter(b => b !== "all"));
                              } else {
                                setPassingAnalysisBatch([]);
                              }
                            }}
                            className="w-4 h-4 rounded border-white/30 bg-white/10 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                          />
                          <span className="text-white/90 text-sm font-semibold">All</span>
                        </label>
                        {batches.filter(b => b !== "all").map((batch) => (
                          <label key={batch} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                            <input
                              type="checkbox"
                              checked={passingAnalysisBatch.includes(batch)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setPassingAnalysisBatch([...passingAnalysisBatch, batch]);
                                } else {
                                  setPassingAnalysisBatch(passingAnalysisBatch.filter(b => b !== batch));
                                }
                              }}
                              className="w-4 h-4 rounded border-white/30 bg-white/10 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                            />
                            <span className="text-white/80 text-sm">{batch}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Branch Checkboxes */}
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <label className="block text-white/90 font-semibold mb-3 text-sm">Branch</label>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {/* Select All */}
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors border-b border-white/10 pb-2 mb-2">
                          <input
                            type="checkbox"
                            checked={passingAnalysisBranch.length === branches.filter(b => b !== "all").length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPassingAnalysisBranch(branches.filter(b => b !== "all"));
                              } else {
                                setPassingAnalysisBranch([]);
                              }
                            }}
                            className="w-4 h-4 rounded border-white/30 bg-white/10 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                          />
                          <span className="text-white/90 text-sm font-semibold">All</span>
                        </label>
                        {branches.filter(b => b !== "all").map((branch) => (
                          <label key={branch} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                            <input
                              type="checkbox"
                              checked={passingAnalysisBranch.includes(branch)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setPassingAnalysisBranch([...passingAnalysisBranch, branch]);
                                } else {
                                  setPassingAnalysisBranch(passingAnalysisBranch.filter(b => b !== branch));
                                }
                              }}
                              className="w-4 h-4 rounded border-white/30 bg-white/10 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                            />
                            <span className="text-white/80 text-sm">{branch}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Semester Checkboxes (Multi-Select) */}
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <label className="block text-white/90 font-semibold mb-3 text-sm">Semester</label>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {semesters.filter(s => s !== "all").map((semester) => (
                          <label key={semester} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors">
                            <input
                              type="checkbox"
                              checked={passingAnalysisSemester.includes(semester)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setPassingAnalysisSemester([...passingAnalysisSemester, semester]);
                                } else {
                                  setPassingAnalysisSemester(passingAnalysisSemester.filter(s => s !== semester));
                                }
                              }}
                              className="w-4 h-4 rounded border-white/30 bg-white/10 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                            />
                            <span className="text-white/80 text-sm">{semester}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Active Filter Indicators */}
                  {(passingAnalysisBatch.length > 0 || passingAnalysisBranch.length > 0 || passingAnalysisSemester.length > 0) && (
                    <div className="flex gap-2 items-center mt-4 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-full w-fit">
                      <span className="text-xs text-blue-300 font-semibold">
                        Filters Active: {passingAnalysisBatch.length + passingAnalysisBranch.length + passingAnalysisSemester.length} selected
                      </span>
                      <button
                        onClick={() => {
                          setPassingAnalysisBatch([]);
                          setPassingAnalysisBranch([]);
                          setPassingAnalysisSemester([]);
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

                {/* Breakdown Info */}
                {showBatchBreakdown && (
                  <div className="mt-3 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-sm text-purple-300">
                    📊 Showing breakdown by <strong>Batch/Year</strong> for <strong>{passingAnalysisBranch.join(", ")}</strong> branch(es)
                  </div>
                )}
                {showBranchBreakdown && (
                  <div className="mt-3 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-sm text-purple-300">
                    📊 Showing breakdown by <strong>Branch</strong> for <strong>{passingAnalysisBatch.join(", ")}</strong> batch(es)
                  </div>
                )}
              </div>

              {loadingPassingStats ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="relative mb-6">
                    <div className="animate-spin rounded-full h-20 w-20 border-4 border-blue-500/30 border-t-blue-500"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-10 w-10 rounded-full bg-blue-500/20 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-blue-300 font-bold text-xl mb-2">Loading Passing Analysis...</p>
                    <p className="text-blue-200/70 text-sm">Fetching data and calculating statistics</p>
                  </div>
                </div>
              ) : !passingFiltersActive ? (
                <div className="text-center py-10 text-white/70 border border-white/10 rounded-2xl bg-white/5">
                  <p className="text-lg font-semibold">Select at least one Batch / Branch / Semester to view Passing Analysis.</p>
                  <p className="text-sm text-white/60 mt-2">No data is shown until you apply filters.</p>
                </div>
              ) : (passFailData.length === 0 && passingStats.total === 0) ? (
                <div className="text-center py-10 text-amber-100 border border-amber-400/30 rounded-2xl bg-amber-500/10">
                  <p className="text-lg font-semibold">No data found for the selected filters.</p>
                  <p className="text-sm text-amber-100/80 mt-2">Try another batch/branch/semester that has records.</p>
                </div>
              ) : (
                <>
                  {/* Enhanced Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
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
                            {passingStats.total > 0 ? ((passingStats.passed / passingStats.total) * 100).toFixed(1) : 0}% of total
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
                        <p className="text-3xl font-black text-blue-400">{passingStats.passRate || 0}%</p>
                        <div className="mt-2 h-1.5 bg-blue-500/20 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500"
                            style={{ width: `${passingStats.passRate || 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Bar Chart */}
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-lg font-bold text-white/90">
                        Pass Rate Analysis
                      </h4>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-4 text-sm text-white/70">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"></div>
                            <span>Percentage of Students</span>
                          </div>
                        </div>
                        {/* Export Buttons */}
                        {passFailData && passFailData.length > 0 && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => exportToExcel(passFailData)}
                              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-sm font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Export Excel
                            </button>
                            <button
                              onClick={() => downloadReport(passFailData)}
                              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-sm font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                              Download Report
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {(() => {
                      if (!passFailData || passFailData.length === 0) {
                        if (loadingPassingStats) {
                          return (
                            <div className="flex flex-col items-center justify-center py-16">
                              <div className="relative mb-4">
                                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500/30 border-t-blue-500"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="h-6 w-6 rounded-full bg-blue-500/20 animate-pulse"></div>
                                </div>
                              </div>
                              <p className="text-blue-300 font-semibold text-lg mb-1">Loading Chart Data...</p>
                              <p className="text-blue-200/70 text-sm">Calculating pass rates for selected filters</p>
                            </div>
                          );
                        }
                        return (
                          <div className="flex flex-col items-center justify-center py-16 text-white/70">
                            <svg className="w-16 h-16 text-white/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <p className="text-lg font-semibold mb-2">No Data Available</p>
                            <p className="text-sm text-white/50">
                              Please select filters to view passing analysis data
                            </p>
                          </div>
                        );
                      }

                      // Y-axis domain should always be 0-100 for percentage
                      const yAxisMax = 100;

                      return (
                        <ResponsiveContainer width="100%" height={350}>
                          <BarChart data={passFailData} margin={{ top: 40, right: 20, left: 60, bottom: 80 }}>
                            <defs>
                              <linearGradient id="passRateGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#22c55e" stopOpacity={1} />
                                <stop offset="100%" stopColor="#16a34a" stopOpacity={0.9} />
                              </linearGradient>
                            </defs>
                            <XAxis
                              dataKey="name"
                              stroke="#94a3b8"
                              tick={{ fill: "#fff", fontSize: 12, fontWeight: 500 }}
                              tickLine={{ stroke: "#94a3b8" }}
                              angle={-45}
                              textAnchor="end"
                              height={80}
                              label={{ value: 'Category', position: 'insideBottom', offset: -5, fill: '#fff', style: { textAnchor: 'middle', fontSize: '14px', fontWeight: 'bold' } }}
                            />
                            <YAxis
                              stroke="#94a3b8"
                              tick={{ fill: "#fff", fontSize: 12 }}
                              tickLine={{ stroke: "#94a3b8" }}
                              label={{ value: 'Percentage of Students', angle: -90, position: 'insideLeft', fill: '#fff', style: { textAnchor: 'middle', fontSize: '14px', fontWeight: 'bold' } }}
                              domain={[0, yAxisMax]}
                            />
                            <Tooltip
                              formatter={(value, name, props) => {
                                if (name === "PassRate" || name === "Percentage of Students") {
                                  const total = props.payload?.Total || 0;
                                  const passed = props.payload?.Passed || 0;
                                  return [
                                    `${value}% (${passed} out of ${total} students)`,
                                    "Pass Rate"
                                  ];
                                }
                                return [value, name];
                              }}
                              contentStyle={{
                                backgroundColor: "rgba(30, 41, 59, 0.95)",
                                border: "1px solid rgba(59, 130, 246, 0.5)",
                                borderRadius: "12px",
                                color: "#e2e8f0",
                                padding: "12px",
                                boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                                fontSize: "13px",
                                fontWeight: "500"
                              }}
                              labelStyle={{
                                color: "#60a5fa",
                                fontWeight: "bold",
                                marginBottom: "8px"
                              }}
                              cursor={{ fill: "rgba(59, 130, 246, 0.1)" }}
                            />
                            <Bar
                              dataKey="PassRate"
                              radius={[12, 12, 0, 0]}
                              name="Percentage of Students"
                              animationDuration={800}
                            >
                              {passFailData && passFailData.length > 0 && passFailData.map((entry, idx) => (
                                <Cell key={`cell-${idx}`} fill={entry?.color || getColorForData(entry?.name, entry?.batch, entry?.branch)} />
                              ))}
                              <LabelList
                                dataKey="PassRate"
                                position="top"
                                formatter={(value) => `${value}%`}
                                style={{ fill: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>

                  {/* Detailed Data Table */}
                  {passFailData && passFailData.length > 0 && (
                    <div className="mt-6 bg-white/5 rounded-2xl p-6 border border-white/10">
                      <h4 className="text-lg font-bold text-white/90 mb-4">
                        Detailed Pass Rate Data
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-white/10 border-b border-white/20">
                              <th className="px-4 py-3 text-left text-sm font-semibold text-white/90">Category</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-white/90">Total Students</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-white/90">Passed</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-white/90">Failed</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-white/90">Pass Rate (%)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {passFailData && passFailData.length > 0 && passFailData.map((item, idx) => {
                              if (!item) return null;
                              const failed = (item.Total || 0) - (item.Passed || 0);
                              return (
                                <tr
                                  key={idx}
                                  className="border-b border-white/10 hover:bg-white/5 transition-colors"
                                >
                                  <td className="px-4 py-3 text-sm text-white/80 font-medium">{item.name || 'N/A'}</td>
                                  <td className="px-4 py-3 text-sm text-white/70 text-center">{item.Total || 0}</td>
                                  <td className="px-4 py-3 text-sm text-emerald-400 text-center font-semibold">{item.Passed || 0}</td>
                                  <td className="px-4 py-3 text-sm text-red-400 text-center font-semibold">{failed}</td>
                                  <td className="px-4 py-3 text-sm text-white/90 text-center font-bold">
                                    {item.PassRate ? `${item.PassRate.toFixed(1)}%` : '0%'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
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
                  <div className="flex items-center gap-2 font-semibold">
                    <svg className="w-5 h-5 text-purple-400 drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className="text-lg bg-gradient-to-r from-cyan-300 via-purple-300 to-amber-300 bg-clip-text text-transparent drop-shadow-md">
                      Compare Subjects
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-2">
                      <label className="text-white/70 text-sm font-medium">Batch:</label>
                      <FilterSelect
                        value={subjectComparisonBatch}
                        onChange={setSubjectComparisonBatch}
                        options={batches}
                        label="Batch"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-white/70 text-sm font-medium">Branch:</label>
                      <FilterSelect
                        value={subjectComparisonBranch}
                        onChange={setSubjectComparisonBranch}
                        options={branches}
                        label="Branch"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-white/70 text-sm font-medium">Semester:</label>
                      <FilterSelect
                        value={subjectComparisonSemester}
                        onChange={setSubjectComparisonSemester}
                        options={semesters}
                        label="Semester"
                      />
                    </div>

                    {/* Subject Selection from result */}
                    <div className="flex flex-col gap-4">
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
                              className="px-4 py-2 bg-white/10 border border-white/20 text-white rounded-lg text-sm min-w-[250px] focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                              <option value="" className="text-black">-- Select a subject --</option>
                              <option value="__ALL__" className="text-black">All Subjects</option>
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
                          disabled={!selectedSubjectToAdd || loadingBasketSubjects}
                          className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 disabled:bg-purple-500/10 disabled:opacity-50 disabled:cursor-not-allowed border border-purple-500/30 text-purple-300 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add Subject
                        </button>

                        {/* Clear All Button */}
                        {selectedSubjects.length > 0 && (
                          <button
                            onClick={() => {
                              setSelectedSubjects([]);
                              setSelectedSubjectToAdd("");
                              setSubjectStudents([]);
                              setSelectedStudentRegNo("");
                              setSelectedStudents([]);
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

                      {/* Student Dropdown - Show right below subject selection */}
                      {selectedSubjectToAdd && selectedSubjectToAdd !== "__ALL__" && (
                        <div className="mt-2 p-4 bg-white/5 rounded-xl border border-white/10">
                          <div className="mb-3">
                            <label className="block text-sm font-semibold text-white/90 mb-2 flex items-center gap-2">
                              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              Students List:
                            </label>

                            {loadingStudents ? (
                              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                                <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                                <span className="text-white/70 text-sm">Loading students...</span>
                              </div>
                            ) : studentsError ? (
                              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                                <div className="flex items-start gap-2">
                                  <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <div className="flex-1">
                                    <p className="text-sm text-red-300 font-semibold mb-1">Error Loading Students</p>
                                    <p className="text-xs text-red-200/80 mb-2">{studentsError}</p>
                                    {((subjectComparisonBatch && subjectComparisonBatch !== "all") ||
                                      (subjectComparisonBranch && subjectComparisonBranch !== "all") ||
                                      (subjectComparisonSemester && subjectComparisonSemester !== "all")) && (
                                        <button
                                          onClick={() => {
                                            setSubjectComparisonBatch("all");
                                            setSubjectComparisonBranch("all");
                                            setSubjectComparisonSemester("all");
                                          }}
                                          className="text-xs px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 rounded-lg transition-all flex items-center gap-1.5"
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                          </svg>
                                          Try without filters
                                        </button>
                                      )}
                                  </div>
                                </div>
                              </div>
                            ) : subjectStudents.length > 0 ? (
                              <div className="space-y-3">
                                {/* Selected Count */}
                                {selectedStudents.length > 0 && (
                                  <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                    <p className="text-xs text-blue-300 font-semibold">
                                      {selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''} selected
                                    </p>
                                  </div>
                                )}

                                {/* Student List with Checkboxes */}
                                <div className="max-h-96 overflow-y-auto border border-white/10 rounded-lg bg-white/5 p-3 space-y-2">
                                  {/* All Option */}
                                  <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group border border-white/10 bg-white/5">
                                    <input
                                      type="checkbox"
                                      checked={selectedStudents.length === subjectStudents.length && subjectStudents.length > 0}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedStudents(subjectStudents.map(s => s.Reg_No || s.regNo).filter(Boolean));
                                        } else {
                                          setSelectedStudents([]);
                                        }
                                      }}
                                      className="w-5 h-5 rounded border-2 border-white/30 bg-white/10 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                                    />
                                    <div className="flex-1">
                                      <span className="text-sm font-bold text-white/90 group-hover:text-blue-300 transition-colors">
                                        Select All ({subjectStudents.length} students)
                                      </span>
                                      {selectedStudents.length > 0 && selectedStudents.length < subjectStudents.length && (
                                        <span className="text-xs text-blue-300 ml-2">
                                          ({selectedStudents.length} selected)
                                        </span>
                                      )}
                                    </div>
                                  </label>

                                  <div className="border-t border-white/10 my-2"></div>

                                  {/* Individual Student Checkboxes */}
                                  {subjectStudents.map((student, index) => {
                                    const regNo = student.Reg_No || student.regNo || `student-${index}`;
                                    const isSelected = selectedStudents.includes(regNo);
                                    return (
                                      <label
                                        key={`student-${regNo}-${index}`}
                                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all group ${isSelected
                                          ? 'bg-blue-500/20 border border-blue-500/30'
                                          : 'hover:bg-white/5 border border-transparent'
                                          }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedStudents([...selectedStudents, regNo]);
                                            } else {
                                              setSelectedStudents(selectedStudents.filter(reg => reg !== regNo));
                                            }
                                          }}
                                          className="w-5 h-5 rounded border-2 border-white/30 bg-white/10 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-3 w-full">
                                            <span className="text-sm font-mono text-purple-300 font-semibold">
                                              {regNo}
                                            </span>

                                            <span className="text-sm text-white/90 font-medium truncate">
                                              {student.Name || student.name || "N/A"}
                                            </span>

                                            {student.Grade && String(student.Grade).trim() && (
                                              <span className="ml-auto">
                                                <span className={`text-xs px-2 py-0.5 rounded font-semibold ${['A', 'A+', 'O'].includes((student.Grade || '').toUpperCase())
                                                  ? 'bg-emerald-500/20 text-emerald-300'
                                                  : ['F', 'E', 'D'].includes((student.Grade || '').toUpperCase())
                                                    ? 'bg-red-500/20 text-red-300'
                                                    : 'bg-yellow-500/20 text-yellow-300'
                                                  }`}>
                                                  {String(student.Grade).toUpperCase()}
                                                </span>
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>

                                {/* Selected Students Summary */}
                                {selectedStudents.length > 0 && (
                                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                    <h4 className="text-xs font-semibold text-blue-300 mb-2">
                                      Selected Students ({selectedStudents.length}):
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                      {selectedStudents.slice(0, 5).map((regNo) => {
                                        const student = subjectStudents.find(s => (s.Reg_No || s.regNo) === regNo);
                                        return (
                                          <span
                                            key={regNo || `selected-${Math.random()}`}
                                            className="text-xs px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-blue-200 font-medium"
                                          >
                                            {student?.Name || student?.name || regNo}
                                          </span>
                                        );
                                      })}
                                      {selectedStudents.length > 5 && (
                                        <span className="text-xs px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-blue-200 font-medium">
                                          +{selectedStudents.length - 5} more
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Student Performance Chart for single selection */}
                                {selectedStudents.length === 1 && (
                                  <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
                                    <div className="flex items-center justify-between mb-3">
                                      <span className="text-white/90 text-sm font-semibold">Student Performance</span>
                                    </div>

                                    {loadingStudentRecords ? (
                                      <div className="p-3 bg-white/5 rounded-lg">
                                        <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                                        <p className="text-xs text-white/60 mt-2">Loading student records...</p>
                                      </div>
                                    ) : studentRecordsError ? (
                                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                                        <p className="text-sm text-red-200">{studentRecordsError}</p>
                                      </div>
                                    ) : studentRecords && studentRecords.length > 0 ? (
                                      (() => {
                                        // Build semester-wise average grade points
                                        const gradeMap = { O: 10, E: 9, A: 8, B: 7, C: 6, D: 5, F: 0, S: 0, I: 0, M: 0, R: 0 };
                                        const semMap = {};
                                        studentRecords.forEach(rec => {
                                          const semRaw = rec.Sem || rec.sem || '';
                                          const semNumMatch = String(semRaw).match(/(\d+)/);
                                          const semNum = semNumMatch ? parseInt(semNumMatch[0], 10) : null;
                                          const semLabel = semNum ? `Sem ${semNum}` : (semRaw || 'Unknown');
                                          const grade = (rec.Grade || rec.grade || '').toString().toUpperCase();
                                          const credits = parseFloat(rec.Credits || rec.Credit || 1) || 1;
                                          const points = gradeMap[grade] !== undefined ? gradeMap[grade] : 0;
                                          if (!semMap[semLabel]) semMap[semLabel] = { sum: 0, credits: 0, semNum: semNum || 999 };
                                          semMap[semLabel].sum += points * credits;
                                          semMap[semLabel].credits += credits;
                                        });

                                        const trendData = Object.entries(semMap)
                                          .map(([sem, val]) => ({ semester: sem, average: val.credits > 0 ? (val.sum / val.credits).toFixed(2) : '0', semNum: val.semNum }))
                                          .sort((a, b) => a.semNum - b.semNum)
                                          .map(({ semester, average }) => ({ semester, average }));

                                        return (
                                          <div className="h-64">
                                            <GradeTrendsOverTimeChart data={trendData} />
                                          </div>
                                        );
                                      })()
                                    ) : (
                                      <div className="p-3 text-xs text-white/60">No detailed records available for this student.</div>
                                    )}
                                  </div>
                                )}

                                {/* Student Comparison Chart for 2+ selections */}
                                {/* Subject-wise Pass/Fail Analysis for 2+ students */}
                                {selectedStudents.length >= 2 && (
                                  <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
                                    <div className="flex items-center justify-between mb-3">
                                      <span className="text-white/90 text-sm font-semibold">
                                        Subject-wise Pass/Fail Analysis ({selectedStudents.length} students)
                                      </span>
                                      {subjectWiseAnalysis.length > 0 && (
                                        <button
                                          onClick={() => {
                                            try {
                                              const wb = XLSX.utils.book_new();
                                              const dateStr = new Date().toISOString().split('T')[0];
                                              
                                              // Grade points mapping
                                              const gradePointsMap = {
                                                'O': 10, 'E': 9, 'A': 8, 'B': 7, 'C': 6, 
                                                'D': 5, 'F': 0, 'S': 0, 'M': 0, 'R': 0
                                              };
                                              
                                              // Sheet 1: Subject-wise Summary
                                              const summaryData = subjectWiseAnalysis.map((item, idx) => ({
                                                "S.No": idx + 1,
                                                "Subject": item.subject,
                                                "Passed": item.passed,
                                                "Failed": item.failed,
                                                "Unattempted": item.unattempted || 0,
                                                "Total": item.total,
                                                "Pass Rate (%)": item.passRate || '0.0',
                                                "Fail Rate (%)": item.failRate || '0.0',
                                                "Unattempted Rate (%)": item.unattemptedRate || '0.0'
                                              }));
                                              const ws1 = XLSX.utils.json_to_sheet(summaryData);
                                              ws1['!cols'] = [
                                                { wch: 8 },   // S.No
                                                { wch: 25 },  // Subject
                                                { wch: 12 },  // Passed
                                                { wch: 12 },  // Failed
                                                { wch: 15 },  // Unattempted
                                                { wch: 10 },  // Total
                                                { wch: 15 },  // Pass Rate
                                                { wch: 15 },  // Fail Rate
                                                { wch: 18 }   // Unattempted Rate
                                              ];
                                              XLSX.utils.book_append_sheet(wb, ws1, "Subject Summary");
                                              
                                              // Sheet 2: Student-wise Grades with Grade Points
                                              if (studentRecordsForExport.length > 0) {
                                                const studentData = [];
                                                let serialNo = 1;
                                                
                                                // Group records by student registration number
                                                const studentRecordsMap = new Map();
                                                studentRecordsForExport.forEach(record => {
                                                  const regNo = String(record.Reg_No || '').trim();
                                                  if (!regNo) return;
                                                  
                                                  if (!studentRecordsMap.has(regNo)) {
                                                    studentRecordsMap.set(regNo, {
                                                      regNo: regNo,
                                                      name: record.Name || record.name || 'Unknown',
                                                      records: []
                                                    });
                                                  }
                                                  studentRecordsMap.get(regNo).records.push(record);
                                                });
                                                
                                                // Create rows for each student and subject combination
                                                studentRecordsMap.forEach((studentInfo, regNo) => {
                                                  studentInfo.records.forEach(record => {
                                                    const subject = record.Subject_Code || record["Subject Code"] || 'Unknown';
                                                    const grade = String(record.Grade || '').toUpperCase().trim();
                                                    const gradePoints = grade && gradePointsMap[grade] !== undefined ? gradePointsMap[grade] : '';
                                                    
                                                    // S and R are unattempted, F/M/I are failed, others are pass
                                                    let status = '';
                                                    if (grade) {
                                                      if (['S', 'R'].includes(grade)) {
                                                        status = 'Unattempted';
                                                      } else if (['F', 'M', 'I'].includes(grade)) {
                                                        status = 'Fail';
                                                      } else {
                                                        status = 'Pass';
                                                      }
                                                    }
                                                    
                                                    studentData.push({
                                                      "S.No": serialNo++,
                                                      "Registration No": regNo,
                                                      "Student Name": studentInfo.name,
                                                      "Subject Code": subject,
                                                      "Subject Name": record.Subject_Name || record["Subject Name"] || record.Subject_name || '',
                                                      "Grade": grade || '',
                                                      "Grade Points": gradePoints !== '' ? gradePoints : '',
                                                      "Status": status
                                                    });
                                                  });
                                                });
                                                
                                                // Sort by Registration No, then by Subject Code
                                                studentData.sort((a, b) => {
                                                  if (a["Registration No"] !== b["Registration No"]) {
                                                    return a["Registration No"].localeCompare(b["Registration No"]);
                                                  }
                                                  return a["Subject Code"].localeCompare(b["Subject Code"]);
                                                });
                                                
                                                // Update serial numbers after sorting
                                                studentData.forEach((row, idx) => {
                                                  row["S.No"] = idx + 1;
                                                });
                                                
                                                if (studentData.length > 0) {
                                                  const ws2 = XLSX.utils.json_to_sheet(studentData);
                                                  ws2['!cols'] = [
                                                    { wch: 8 },   // S.No
                                                    { wch: 18 },  // Registration No
                                                    { wch: 30 },  // Student Name
                                                    { wch: 15 },  // Subject Code
                                                    { wch: 40 },  // Subject Name
                                                    { wch: 10 },  // Grade
                                                    { wch: 12 },  // Grade Points
                                                    { wch: 10 }   // Status
                                                  ];
                                                  XLSX.utils.book_append_sheet(wb, ws2, "Student Grades");
                                                }
                                              }
                                              
                                              // Sheet 3: Grade Distribution Table
                                              if (selectedStudents.length > 0 && studentRecordsForExport.length > 0) {
                                                // Calculate grade distribution from student records
                                                const gradeDist = { "O": 0, "E": 0, "A": 0, "B": 0, "C": 0, "D": 0, "F": 0, "S": 0, "M": 0, "R": 0 };
                                                
                                                studentRecordsForExport.forEach(record => {
                                                  const grade = String(record.Grade || '').toUpperCase().trim();
                                                  if (grade && gradeDist[grade] !== undefined) {
                                                    gradeDist[grade]++;
                                                  }
                                                });
                                                
                                                // Create grade distribution table data
                                                const gradeDistributionData = Object.entries(gradeDist)
                                                  .filter(([grade, count]) => count > 0) // Only include grades with count > 0
                                                  .map(([grade, count], idx) => ({
                                                    "S.No": idx + 1,
                                                    "Grade": grade,
                                                    "Grade Points": gradePointsMap[grade] !== undefined ? gradePointsMap[grade] : 0,
                                                    "Number of Students": count,
                                                    "Percentage": studentRecordsForExport.length > 0 
                                                      ? ((count / studentRecordsForExport.length) * 100).toFixed(2) + '%'
                                                      : '0%'
                                                  }))
                                                  .sort((a, b) => {
                                                    // Sort by grade points (descending), then by grade name
                                                    if (b["Grade Points"] !== a["Grade Points"]) {
                                                      return b["Grade Points"] - a["Grade Points"];
                                                    }
                                                    return a["Grade"].localeCompare(b["Grade"]);
                                                  });
                                                
                                                // Update serial numbers after sorting
                                                gradeDistributionData.forEach((row, idx) => {
                                                  row["S.No"] = idx + 1;
                                                });
                                                
                                                if (gradeDistributionData.length > 0) {
                                                  const ws3 = XLSX.utils.json_to_sheet(gradeDistributionData);
                                                  ws3['!cols'] = [
                                                    { wch: 8 },   // S.No
                                                    { wch: 12 },  // Grade
                                                    { wch: 15 },  // Grade Points
                                                    { wch: 20 },  // Number of Students
                                                    { wch: 15 }   // Percentage
                                                  ];
                                                  XLSX.utils.book_append_sheet(wb, ws3, "Grade Distribution");
                                                }
                                              }
                                              
                                              XLSX.writeFile(wb, `Subject_Analysis_${dateStr}.xlsx`);
                                            } catch (err) {
                                              console.error('Export failed:', err);
                                              alert('Failed to export to Excel');
                                            }
                                          }}
                                          className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                                        >
                                          Export Excel
                                        </button>
                                      )}
                                    </div>

                                    {loadingSubjectWiseAnalysis ? (
                                      <div className="p-3 bg-white/5 rounded-lg flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                                        <p className="text-xs text-white/60">Loading subject analysis...</p>
                                      </div>
                                    ) : subjectWiseAnalysis.length > 0 ? (
                                      <>
                                        {/* Bar Chart with Percentages */}
                                        <div className="mb-6">
                                          <div className="text-white/70 text-xs font-medium mb-3">Pass/Fail/Unattempted Distribution (%)</div>
                                          <div className="h-64">
                                            {subjectWiseAnalysis && Array.isArray(subjectWiseAnalysis) && subjectWiseAnalysis.length > 0 ? (
                                              <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                  data={subjectWiseAnalysis
                                                    .filter(item => item && item.total > 0)
                                                    .map(item => {
                                                      // All percentages should be based on total to add up to 100%
                                                      return {
                                                      ...item,
                                                        passPercentage: parseFloat(item.passRate || ((item.total || 1) > 0 ? (((item.passed || 0) / (item.total || 1)) * 100).toFixed(1) : '0.0')),
                                                        failPercentage: parseFloat(item.failRate || ((item.total || 1) > 0 ? (((item.failed || 0) / (item.total || 1)) * 100).toFixed(1) : '0.0')),
                                                        unattemptedPercentage: parseFloat(item.unattemptedRate || ((item.total || 1) > 0 ? (((item.unattempted || 0) / (item.total || 1)) * 100).toFixed(1) : '0.0'))
                                                      };
                                                    })}
                                                >
                                                  <XAxis
                                                    dataKey="subject"
                                                    tick={{ fontSize: 11, fill: '#ffffff' }}
                                                    angle={-45}
                                                    textAnchor="end"
                                                    height={80}
                                                  />
                                                  <YAxis
                                                    tick={{ fontSize: 12, fill: '#ffffff' }}
                                                    label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }}
                                                  />
                                                  <Tooltip
                                                    cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}
                                                    contentStyle={{
                                                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                                      border: '1px solid rgba(255, 255, 255, 0.2)',
                                                      borderRadius: '8px'
                                                    }}
                                                    formatter={(value) => `${value}%`}
                                                    labelFormatter={(label) => `Subject: ${label}`}
                                                  />
                                                  <Legend />
                                                  <Bar dataKey="passPercentage" fill="rgba(34, 197, 94, 0.8)" name="Passed (%)" radius={[8, 8, 0, 0]} label={{ position: 'top', fontSize: 11, fill: '#ffffff', formatter: (value) => `${value}%` }} />
                                                  <Bar dataKey="failPercentage" fill="rgba(239, 68, 68, 0.8)" name="Failed (%)" radius={[8, 8, 0, 0]} label={{ position: 'top', fontSize: 11, fill: '#ffffff', formatter: (value) => `${value}%` }} />
                                                  <Bar dataKey="unattemptedPercentage" fill="rgba(234, 179, 8, 0.8)" name="Unattempted (%)" radius={[8, 8, 0, 0]} label={{ position: 'top', fontSize: 11, fill: '#ffffff', formatter: (value) => `${value}%` }} />
                                                </BarChart>
                                              </ResponsiveContainer>
                                            ) : (
                                              <div className="flex items-center justify-center h-full text-white/60 text-sm">
                                                No subject-wise analysis data available
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* Grade Distribution Chart - Added by User Request */}
                                        <div className="mb-6 border-t border-white/10 pt-6">
                                          <div className="text-white/70 text-xs font-medium mb-3">Grade Distribution (Selected Students)</div>
                                          {(() => {
                                            // Use the same data source as the table (studentRecordsForExport) for consistency
                                            if (!studentRecordsForExport || studentRecordsForExport.length === 0) {
                                              return <div className="text-white/40 text-xs text-center py-10">No grade data available for selected students</div>;
                                            }
                                            
                                            // Only valid grades: O, E, A, B, C, D, F, S, M, R
                                            const dist = { "O": 0, "E": 0, "A": 0, "B": 0, "C": 0, "D": 0, "F": 0, "S": 0, "M": 0, "R": 0 };
                                            
                                            // Count grades from studentRecordsForExport (same source as table)
                                            studentRecordsForExport.forEach(record => {
                                              const grade = String(record.Grade || '').toUpperCase().trim();
                                              // Only count valid grades: O, E, A, B, C, D, F, S, M, R
                                              if (grade && dist[grade] !== undefined) {
                                                dist[grade]++;
                                              }
                                            });
                                            
                                            // Define grade order to ensure consistent display (including 'O' grade)
                                            const gradeOrder = ['O', 'E', 'A', 'B', 'C', 'D', 'F', 'S', 'M', 'R'];
                                            const chartData = gradeOrder
                                              .filter(grade => dist[grade] > 0) // Only include grades with count > 0
                                              .map((name) => ({
                                                name,
                                                value: dist[name],
                                                color: {
                                                  'O': '#10b981', // Green - Outstanding
                                                  'E': '#3b82f6', // Blue - Excellent
                                                  'A': '#06b6d4', // Cyan - Very Good
                                                  'B': '#f59e0b', // Amber - Good
                                                  'C': '#f97316', // Orange - Average
                                                  'D': '#ef4444', // Red - Below Average
                                                  'F': '#dc2626', // Dark Red - Fail
                                                  'S': '#8b5cf6', // Purple - Supplementary
                                                  'M': '#64748b', // Gray - Malpractice
                                                  'R': '#64748b'  // Gray - Reappear
                                                }[name] || '#8884d8'
                                              }));

                                            if (chartData.length === 0) return <div className="text-white/40 text-xs text-center py-10">No grade data available for selected students</div>;

                                            return (
                                              <div className="h-64">
                                                <ResponsiveContainer width="100%" height="100%">
                                                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                                    <XAxis dataKey="name" tick={{ fill: '#fff' }} />
                                                    <YAxis tick={{ fill: '#fff' }} allowDecimals={false} />
                                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #333', borderRadius: '8px' }} cursor={{ fill: 'rgba(255,255,255,0.1)' }} />
                                                    <Bar dataKey="value" name="Students" radius={[4, 4, 0, 0]}>
                                                      {chartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                      ))}
                                                      <LabelList dataKey="value" position="top" fill="#fff" fontSize={12} />
                                                    </Bar>
                                                  </BarChart>
                                                </ResponsiveContainer>
                                              </div>
                                            );
                                          })()}
                                        </div>

                                        {/* Grade Distribution Table */}
                                        {selectedStudents.length > 0 && studentRecordsForExport.length > 0 && (() => {
                                          // Calculate grade distribution from student records
                                          const gradePointsMap = {
                                            'O': 10, 'E': 9, 'A': 8, 'B': 7, 'C': 6, 
                                            'D': 5, 'F': 0, 'S': 0, 'M': 0, 'R': 0
                                          };
                                          
                                          const gradeDist = { "O": 0, "E": 0, "A": 0, "B": 0, "C": 0, "D": 0, "F": 0, "S": 0, "M": 0, "R": 0 };
                                          
                                          studentRecordsForExport.forEach(record => {
                                            const grade = String(record.Grade || '').toUpperCase().trim();
                                            if (grade && gradeDist[grade] !== undefined) {
                                              gradeDist[grade]++;
                                            }
                                          });
                                          
                                          const gradeTableData = Object.entries(gradeDist)
                                            .filter(([grade, count]) => count > 0)
                                            .map(([grade, count]) => ({
                                              grade,
                                              gradePoints: gradePointsMap[grade] !== undefined ? gradePointsMap[grade] : 0,
                                              count,
                                              percentage: studentRecordsForExport.length > 0 
                                                ? ((count / studentRecordsForExport.length) * 100).toFixed(2)
                                                : '0.00'
                                            }))
                                            .sort((a, b) => {
                                              // Sort by grade points (descending), then by grade name
                                              if (b.gradePoints !== a.gradePoints) {
                                                return b.gradePoints - a.gradePoints;
                                              }
                                              return a.grade.localeCompare(b.grade);
                                            });
                                          
                                          if (gradeTableData.length === 0) return null;
                                          
                                          return (
                                            <div className="mb-6 border-t border-white/10 pt-6">
                                              <div className="text-white/70 text-xs font-medium mb-3">Grade Distribution Table</div>
                                              <div className="overflow-x-auto">
                                                <table className="w-full text-xs">
                                                  <thead>
                                                    <tr className="border-b border-white/10 bg-white/5">
                                                      <th className="px-3 py-2 text-left text-white/80">Grade</th>
                                                      <th className="px-3 py-2 text-center text-white/80">Grade Points</th>
                                                      <th className="px-3 py-2 text-center text-white/80">Number of Students</th>
                                                      <th className="px-3 py-2 text-center text-white/80">Percentage (%)</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {gradeTableData.map((item, idx) => (
                                                      <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition">
                                                        <td className="px-3 py-2 text-white/90 font-semibold">{item.grade}</td>
                                                        <td className="px-3 py-2 text-center text-blue-300 font-semibold">{item.gradePoints}</td>
                                                        <td className="px-3 py-2 text-center text-white/80">{item.count}</td>
                                                        <td className="px-3 py-2 text-center">
                                                          <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-xs font-semibold">
                                                            {item.percentage}%
                                                          </span>
                                                        </td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              </div>
                                            </div>
                                          );
                                        })()}

                                        {/* Detailed Report Table */}
                                        <div className="overflow-x-auto">
                                          <div className="text-white/70 text-xs font-medium mb-3">Detailed Report</div>
                                          <table className="w-full text-xs">
                                            <thead>
                                              <tr className="border-b border-white/10 bg-white/5">
                                                <th className="px-3 py-2 text-left text-white/80">Subject</th>
                                                <th className="px-3 py-2 text-center text-white/80">Passed</th>
                                                <th className="px-3 py-2 text-center text-white/80">Failed</th>
                                                <th className="px-3 py-2 text-center text-white/80">Unattempted</th>
                                                <th className="px-3 py-2 text-center text-white/80">Total</th>
                                                <th className="px-3 py-2 text-center text-white/80">Pass %</th>
                                                <th className="px-3 py-2 text-center text-white/80">Fail %</th>
                                                <th className="px-3 py-2 text-center text-white/80">Unattempted %</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {subjectWiseAnalysis.map((item, idx) => (
                                                <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition">
                                                  <td className="px-3 py-2 text-white/90">{item.subject}</td>
                                                  <td className="px-3 py-2 text-center text-green-400 font-semibold">{item.passed}</td>
                                                  <td className="px-3 py-2 text-center text-red-400 font-semibold">{item.failed}</td>
                                                  <td className="px-3 py-2 text-center text-yellow-400 font-semibold">{item.unattempted || 0}</td>
                                                  <td className="px-3 py-2 text-center text-white/80">{item.total}</td>
                                                  <td className="px-3 py-2 text-center">
                                                    <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs font-semibold">
                                                      {item.passRate || '0.0'}%
                                                    </span>
                                                  </td>
                                                  <td className="px-3 py-2 text-center">
                                                    <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs font-semibold">
                                                      {item.failRate || '0.0'}%
                                                    </span>
                                                  </td>
                                                  <td className="px-3 py-2 text-center">
                                                    <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs font-semibold">
                                                      {item.unattemptedRate || '0.0'}%
                                                    </span>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="p-3 text-xs text-white/60">No subject data available for analysis.</div>
                                    )}
                                  </div>
                                )}

                                {/* Student Comparison Chart for 2-9 students (OLD - keeping for reference) */}
                                {false && selectedStudents.length >= 2 && selectedStudents.length < 10 && (
                                  <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
                                    <div className="flex items-center justify-between mb-3">
                                      <span className="text-white/90 text-sm font-semibold">
                                        Student Comparison ({selectedStudents.length} students)
                                      </span>
                                    </div>

                                    {(() => {
                                      // Build comparison data from selected students in subjectStudents list
                                      const comparisonData = selectedStudents.map(regNo => {
                                        const student = subjectStudents.find(s => 
                                          (s.Reg_No || s.regNo) === regNo || 
                                          String(s.Reg_No || s.regNo || '').trim() === String(regNo || '').trim()
                                        );
                                        if (!student) return null;

                                        // Convert grade to numeric points for chart
                                        // Only valid grades: O, E, A, B, C, D, F, S, M, R
                                        const gradeMap = { 
                                          'O': 10, // Outstanding
                                          'E': 9,  // Excellent
                                          'A': 8,  // Very Good
                                          'B': 7,  // Good
                                          'C': 6,  // Average
                                          'D': 5,  // Below Average
                                          'F': 0,  // Fail
                                          'S': 0,  // Supplementary
                                          'M': 0,  // Malpractice
                                          'R': 0   // Reappear
                                        };
                                        const grade = String(student.Grade || student.grade || '').toUpperCase().trim();
                                        const points = gradeMap[grade] || 0;

                                        return {
                                          name: `${student.Name || student.name || 'N/A'} (${student.Reg_No || student.regNo || regNo})`,
                                          grade: points,
                                          gradeLabel: grade || 'N/A',
                                          regNo: student.Reg_No || student.regNo || regNo
                                        };
                                      }).filter(Boolean);

                                      return comparisonData.length > 0 ? (
                                        <div className="h-64">
                                          <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={comparisonData}>
                                              <XAxis
                                                dataKey="name"
                                                tick={{ fontSize: 12, fill: '#ffffff' }}
                                                angle={-45}
                                                textAnchor="end"
                                                height={80}
                                              />
                                              <YAxis
                                                tick={{ fontSize: 12, fill: '#ffffff' }}
                                                domain={[0, 10]}
                                                label={{ value: 'Grade Points', angle: -90, position: 'insideLeft' }}
                                              />
                                              <Tooltip
                                                cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}
                                                contentStyle={{
                                                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                                  border: '1px solid rgba(255, 255, 255, 0.2)',
                                                  borderRadius: '8px'
                                                }}
                                                formatter={(value, name) => {
                                                  if (name === 'grade') {
                                                    const idx = comparisonData.findIndex(d => d.grade === value);
                                                    return [value.toFixed(2), `Grade: ${comparisonData[idx]?.gradeLabel || 'N/A'}`];
                                                  }
                                                  return [value, name];
                                                }}
                                              />
                                              <Legend />
                                              <Bar
                                                dataKey="grade"
                                                fill="rgba(59, 130, 246, 0.8)"
                                                name="Grade Points"
                                                radius={[8, 8, 0, 0]}
                                              />
                                            </BarChart>
                                          </ResponsiveContainer>
                                        </div>
                                      ) : (
                                        <div className="p-3 text-xs text-white/60">No data available for comparison.</div>
                                      );
                                    })()}
                                  </div>
                                )}

                                {/* Pass/Fail aggregate for 10+ students - REMOVED, using subject-wise instead */}
                              </div>
                            ) : (
                              <div className="text-center py-4 text-white/50">
                                <p className="text-sm text-white/70">No students found for this subject</p>
                                <p className="text-xs text-white/50 mt-1">
                                  {(() => {
                                    const activeFilters = [];
                                    if (subjectComparisonBatch && subjectComparisonBatch !== "all") {
                                      activeFilters.push(`Batch: ${subjectComparisonBatch}`);
                                    }
                                    if (subjectComparisonBranch && subjectComparisonBranch !== "all") {
                                      activeFilters.push(`Branch: ${subjectComparisonBranch}`);
                                    }
                                    if (subjectComparisonSemester && subjectComparisonSemester !== "all") {
                                      activeFilters.push(`Semester: ${subjectComparisonSemester}`);
                                    }

                                    if (activeFilters.length > 0) {
                                      return `Active filters: ${activeFilters.join(", ")}. Try removing filters or selecting a different subject.`;
                                    }
                                    return "The subject may not exist in the database. Try selecting a different subject.";
                                  })()}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                </div>

                {/* Selected Subjects List */}
                {selectedSubjects.length > 0 && (
                  <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white/90 text-sm font-semibold">
                        Selected Subjects ({selectedSubjects.length}):
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
                  {/* Loading State */}
                  {loadingSubjectComparison && (
                    <div className="mb-6 p-6 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-xl text-center">
                      <div className="flex flex-col items-center justify-center gap-4">
                        <div className="relative">
                          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-6 h-6 bg-blue-500/20 rounded-full animate-pulse"></div>
                          </div>
                        </div>
                        <div>
                          <p className="text-blue-300 font-bold text-lg mb-1">Loading Subject Comparison Data...</p>
                          <p className="text-blue-200/70 text-sm">Please wait while we fetch the data</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Warning for subjects without data */}
                  {!loadingSubjectComparison && subjectComparisonData.length > 0 && subjectComparisonData.filter(s => !s.hasData).length > 0 && (
                    <div className="mb-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm text-orange-300 font-semibold mb-2">
                            {subjectComparisonData.filter(s => !s.hasData).length} subject(s) have no result data
                          </p>
                          <div className="text-xs text-orange-200/80 bg-orange-500/10 p-2 rounded border border-orange-500/20">
                            <strong>Subjects without data:</strong> {subjectComparisonData.filter(s => !s.hasData).map(s => {
                              const subject = basketSubjects.find(bs => bs.code === s.subject);
                              return subject ? `${s.subject} - ${subject.name}` : s.subject;
                            }).join(", ")}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Success message when data is loaded */}
                  {!loadingSubjectComparison && subjectComparisonData.filter(s => s.hasData).length > 0 && (
                    <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm text-emerald-300 font-semibold">
                          ✓ Loaded comparison data for {subjectComparisonData.filter(s => s.hasData).length} subject(s)
                        </span>
                      </div>
                    </div>
                  )}

                  {!loadingSubjectComparison && subjectComparisonData.filter(s => s.hasData).length > 0 ? (
                    <>
                      {/* Section Title */}
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-xl font-bold text-white/90 flex items-center gap-2">
                          <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          Comparison Results
                        </h3>
                      </div>

                      {/* Enhanced Summary Cards for Comparison (trimmed to required metrics) */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 mb-6">
                        <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center hover:bg-white/10 transition-all">
                          <div className="flex items-center justify-center mb-2">
                            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                          </div>
                          <p className="text-white/70 text-xs mb-1">Total Subjects</p>
                          <p className="text-2xl font-bold text-white">{selectedSubjects.length}</p>
                          {subjectComparisonData.length < selectedSubjects.length && (
                            <p className="text-xs text-yellow-400 mt-1">
                              ({subjectComparisonData.filter(s => s.hasData).length} with data)
                            </p>
                          )}
                        </div>
                        <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20 text-center hover:bg-blue-500/15 transition-all">
                          <div className="flex items-center justify-center mb-2">
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </div>
                          <p className="text-blue-200 text-xs mb-1">Total Students</p>
                          <p className="text-2xl font-bold text-blue-400">
                            {(subjectComparisonUniqueStudents ?? subjectComparisonData.reduce((sum, s) => sum + (s.totalStudents || 0), 0)).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Enhanced Bar Chart */}
                      <div className="bg-white/5 rounded-2xl p-6 border border-white/10" id="subject-comparison-chart">
                        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <h4 className="text-lg font-bold text-white/90 mb-1">Pass Rate Comparison</h4>
                            <p className="text-xs text-white/60">
                              Comparing {subjectComparisonData.filter(s => s.hasData).length} subject(s) with data
                              {subjectComparisonBatch !== "all" || subjectComparisonBranch !== "all" || subjectComparisonSemester !== "all" ? (
                                <span className="ml-2">
                                  (Filtered: {subjectComparisonBatch !== "all" ? `Batch ${subjectComparisonBatch}` : ""}
                                  {subjectComparisonBatch !== "all" && (subjectComparisonBranch !== "all" || subjectComparisonSemester !== "all") ? ", " : ""}
                                  {subjectComparisonBranch !== "all" ? `Branch ${subjectComparisonBranch}` : ""}
                                  {(subjectComparisonBatch !== "all" || subjectComparisonBranch !== "all") && subjectComparisonSemester !== "all" ? ", " : ""}
                                  {subjectComparisonSemester !== "all" ? `Semester ${subjectComparisonSemester}` : ""})
                                </span>
                              ) : null}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
                              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"></div>
                              <span className="font-medium text-sm text-white/70">Pass Rate</span>
                            </div>
                            <button
                              onClick={async () => {
                                const printContent = document.getElementById('subject-comparison-print');
                                const chartContainer = document.getElementById('subject-comparison-chart');
                                if (!printContent) return;

                                let chartImage = '';

                                // Wait a bit for chart to render
                                await new Promise(resolve => setTimeout(resolve, 500));

                                // Try to capture screenshot using html2canvas
                                try {
                                  const html2canvas = (await import('html2canvas')).default;
                                  const chartElement = document.getElementById('subject-comparison-chart-container') ||
                                    document.querySelector('#subject-comparison-chart .recharts-wrapper') ||
                                    document.querySelector('#subject-comparison-chart');

                                  if (chartElement) {
                                    const canvas = await html2canvas(chartElement, {
                                      backgroundColor: '#ffffff',
                                      scale: 2,
                                      logging: false,
                                      useCORS: true,
                                      allowTaint: true,
                                      width: chartElement.scrollWidth,
                                      height: chartElement.scrollHeight,
                                    });

                                    chartImage = canvas.toDataURL('image/png', 1.0);
                                  }
                                } catch (screenshotError) {
                                  // Fallback to SVG method
                                }

                                // Try to capture chart as image with colors preserved
                                try {
                                  // Try multiple methods to find the chart
                                  let svgElement = null;
                                  let chartContainerElement = null;

                                  // Method 1: Find by container ID
                                  chartContainerElement = document.getElementById('subject-comparison-chart-container');
                                  if (chartContainerElement) {
                                    svgElement = chartContainerElement.querySelector('svg');
                                  }

                                  // Method 2: Find by parent container
                                  if (!svgElement && chartContainer) {
                                    chartContainerElement = chartContainer.querySelector('.recharts-wrapper') || chartContainer;
                                    svgElement = chartContainerElement?.querySelector('svg');
                                  }

                                  // Method 3: Find anywhere in the document
                                  if (!svgElement) {
                                    const allSvgs = document.querySelectorAll('#subject-comparison-chart svg, .recharts-wrapper svg');
                                    if (allSvgs.length > 0) {
                                      svgElement = allSvgs[0];
                                      chartContainerElement = svgElement.closest('.recharts-wrapper') || svgElement.parentElement;
                                    }
                                  }

                                  if (svgElement) {
                                    // Get dimensions from the wrapper
                                    const wrapper = svgElement.closest('.recharts-wrapper') || svgElement.parentElement;
                                    const rect = wrapper ? wrapper.getBoundingClientRect() : svgElement.getBoundingClientRect();

                                    const width = Math.max(rect.width || 900, 900);
                                    const height = Math.max(rect.height || 450, 450);

                                    // Clone the entire SVG with all elements
                                    const clonedSvg = svgElement.cloneNode(true);

                                    // Set dimensions
                                    clonedSvg.setAttribute('width', width.toString());
                                    clonedSvg.setAttribute('height', height.toString());
                                    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                                    clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

                                    // Preserve gradients and colors - copy all defs
                                    const defs = clonedSvg.querySelector('defs');
                                    if (defs) {
                                      // Ensure gradients are preserved with original colors
                                      const gradients = defs.querySelectorAll('linearGradient, radialGradient');
                                      gradients.forEach(grad => {
                                        const originalId = grad.getAttribute('id');
                                        if (originalId) {
                                          // Keep original ID to maintain references
                                          grad.setAttribute('id', originalId);
                                        }
                                        // Ensure all gradient stops preserve their colors
                                        const stops = grad.querySelectorAll('stop');
                                        stops.forEach(stop => {
                                          const stopColor = stop.getAttribute('stop-color') || stop.getAttribute('stopColor');
                                          const stopOpacity = stop.getAttribute('stop-opacity') || stop.getAttribute('stopOpacity') || '1';
                                          // Force blue gradient colors for bars
                                          const offset = stop.getAttribute('offset');
                                          if (originalId === 'subjectPassGradient' || originalId?.includes('Pass')) {
                                            if (offset === '0%' || offset === '0') {
                                              stop.setAttribute('stop-color', '#60a5fa');
                                              stop.setAttribute('stop-opacity', '1');
                                            } else {
                                              stop.setAttribute('stop-color', '#2563eb');
                                              stop.setAttribute('stop-opacity', '0.95');
                                            }
                                          } else if (!stopColor) {
                                            // Default blue gradient if missing
                                            if (offset === '0%' || offset === '0') {
                                              stop.setAttribute('stop-color', '#60a5fa');
                                              stop.setAttribute('stop-opacity', '1');
                                            } else {
                                              stop.setAttribute('stop-color', '#2563eb');
                                              stop.setAttribute('stop-opacity', '0.95');
                                            }
                                          } else {
                                            // Preserve existing color but ensure opacity
                                            stop.setAttribute('stop-opacity', stopOpacity);
                                          }
                                        });
                                      });
                                    } else {
                                      // Create defs if missing and add gradient
                                      const newDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                                      const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
                                      gradient.setAttribute('id', 'subjectPassGradient');
                                      gradient.setAttribute('x1', '0');
                                      gradient.setAttribute('y1', '0');
                                      gradient.setAttribute('x2', '0');
                                      gradient.setAttribute('y2', '1');
                                      const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                                      stop1.setAttribute('offset', '0%');
                                      stop1.setAttribute('stop-color', '#60a5fa');
                                      stop1.setAttribute('stop-opacity', '1');
                                      const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                                      stop2.setAttribute('offset', '100%');
                                      stop2.setAttribute('stop-color', '#2563eb');
                                      stop2.setAttribute('stop-opacity', '0.95');
                                      gradient.appendChild(stop1);
                                      gradient.appendChild(stop2);
                                      newDefs.appendChild(gradient);
                                      clonedSvg.insertBefore(newDefs, clonedSvg.firstChild);
                                    }

                                    // Find and color all bar elements - be more aggressive
                                    const allPaths = clonedSvg.querySelectorAll('path');
                                    const allRects = clonedSvg.querySelectorAll('rect');
                                    const allPolygons = clonedSvg.querySelectorAll('polygon');

                                    // Combine all potential bar elements
                                    const allBarElements = [...allPaths, ...allRects, ...allPolygons];

                                    allBarElements.forEach(bar => {
                                      const fill = bar.getAttribute('fill');
                                      const parent = bar.parentElement;

                                      // Check if it's a bar element
                                      const isBar = (
                                        (parent && (
                                          parent.classList.contains('recharts-bar') ||
                                          parent.classList.contains('recharts-bar-rectangle') ||
                                          parent.getAttribute('class')?.includes('recharts-bar')
                                        )) ||
                                        fill === 'url(#subjectPassGradient)' ||
                                        (fill && fill.includes('gradient')) ||
                                        (fill && fill.includes('subjectPassGradient'))
                                      );

                                      // Also check by dimensions - bars are usually wider than tall
                                      const width = parseFloat(bar.getAttribute('width') || '0');
                                      const height = parseFloat(bar.getAttribute('height') || '0');
                                      const pathData = bar.getAttribute('d') || '';

                                      // If it looks like a bar (rectangular shape), apply gradient
                                      if (isBar || (width > 0 && height > 0 && width < height * 10) || pathData.includes('M') && pathData.includes('L')) {
                                        // Force blue gradient
                                        bar.setAttribute('fill', 'url(#subjectPassGradient)');
                                        bar.removeAttribute('stroke'); // Remove any stroke that might interfere
                                      }
                                    });

                                    // Also check for any elements with gradient fill and ensure they use the right gradient
                                    const gradientElements = clonedSvg.querySelectorAll('[fill*="url(#subjectPassGradient)"], [fill*="gradient"]');
                                    gradientElements.forEach(el => {
                                      el.setAttribute('fill', 'url(#subjectPassGradient)');
                                    });

                                    // Ensure background is white for print
                                    const bgRect = clonedSvg.querySelector('rect[width="100%"][height="100%"]');
                                    if (bgRect) {
                                      bgRect.setAttribute('fill', '#ffffff');
                                    }

                                    // Update text colors for print visibility (black on white)
                                    const textElements = clonedSvg.querySelectorAll('text');
                                    textElements.forEach(text => {
                                      const currentFill = text.getAttribute('fill') || text.getAttribute('style')?.match(/fill:\s*([^;]+)/)?.[1];
                                      // Change white text to black for print
                                      if (!currentFill || currentFill === '#fff' || currentFill === '#ffffff' || currentFill.includes('white')) {
                                        text.setAttribute('fill', '#000000');
                                      }
                                      // Update style attribute
                                      const style = text.getAttribute('style') || '';
                                      if (style.includes('fill:') && (style.includes('white') || style.includes('#fff'))) {
                                        text.setAttribute('style', style.replace(/fill:\s*[^;]+/g, 'fill: #000000'));
                                      } else if (!style.includes('fill:')) {
                                        text.setAttribute('style', style + (style ? '; ' : '') + 'fill: #000000');
                                      }
                                    });

                                    // Update axis line colors to dark gray for visibility
                                    const lines = clonedSvg.querySelectorAll('line');
                                    lines.forEach(line => {
                                      const stroke = line.getAttribute('stroke');
                                      if (stroke === '#94a3b8' || stroke === 'rgb(148, 163, 184)') {
                                        line.setAttribute('stroke', '#333333');
                                      }
                                    });

                                    // Update axis labels
                                    const axisLabels = clonedSvg.querySelectorAll('.recharts-cartesian-axis-tick-value text');
                                    axisLabels.forEach(label => {
                                      label.setAttribute('fill', '#000000');
                                    });

                                    // Create canvas with high DPI for quality
                                    const scale = 2; // For better quality
                                    const canvas = document.createElement('canvas');
                                    canvas.width = width * scale;
                                    canvas.height = height * scale;
                                    const ctx = canvas.getContext('2d');

                                    // Scale context
                                    ctx.scale(scale, scale);

                                    // White background
                                    ctx.fillStyle = '#ffffff';
                                    ctx.fillRect(0, 0, width, height);

                                    // Convert SVG to image - use both methods for compatibility
                                    const svgData = new XMLSerializer().serializeToString(clonedSvg);

                                    // Method 1: Try base64 encoding
                                    try {
                                      const svgBase64 = btoa(unescape(encodeURIComponent(svgData)));
                                      const svgUrl = `data:image/svg+xml;base64,${svgBase64}`;

                                      const img = new Image();
                                      await new Promise((resolve, reject) => {
                                        img.onload = () => {
                                          try {
                                            ctx.drawImage(img, 0, 0, width, height);
                                            chartImage = canvas.toDataURL('image/png', 1.0);
                                            resolve();
                                          } catch (e) {
                                            reject(e);
                                          }
                                        };
                                        img.onerror = () => {
                                          reject(new Error('Base64 method failed'));
                                        };
                                        img.src = svgUrl;
                                      });
                                    } catch (base64Error) {
                                      // Method 2: Fallback to blob URL
                                      try {
                                        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                                        const blobUrl = URL.createObjectURL(svgBlob);

                                        const img = new Image();
                                        await new Promise((resolve, reject) => {
                                          img.onload = () => {
                                            try {
                                              ctx.drawImage(img, 0, 0, width, height);
                                              chartImage = canvas.toDataURL('image/png', 1.0);
                                              URL.revokeObjectURL(blobUrl);
                                              resolve();
                                            } catch (e) {
                                              URL.revokeObjectURL(blobUrl);
                                              reject(e);
                                            }
                                          };
                                          img.onerror = () => {
                                            URL.revokeObjectURL(blobUrl);
                                            reject(new Error('Both methods failed'));
                                          };
                                          img.src = blobUrl;
                                        });
                                      } catch (blobError) {
                                        throw blobError;
                                      }
                                    }
                                  } else {
                                    // Try alternative: look for SVG anywhere in the document
                                    const anySvg = document.querySelector('#subject-comparison-chart svg, .recharts-wrapper svg');
                                    if (anySvg) {
                                      // Retry with this SVG
                                      const clonedSvg = anySvg.cloneNode(true);
                                      const width = 900;
                                      const height = 450;
                                      clonedSvg.setAttribute('width', width.toString());
                                      clonedSvg.setAttribute('height', height.toString());
                                      clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

                                      const canvas = document.createElement('canvas');
                                      canvas.width = width * 2;
                                      canvas.height = height * 2;
                                      const ctx = canvas.getContext('2d');
                                      ctx.scale(2, 2);
                                      ctx.fillStyle = '#ffffff';
                                      ctx.fillRect(0, 0, width, height);

                                      const svgData = new XMLSerializer().serializeToString(clonedSvg);
                                      const svgBase64 = btoa(unescape(encodeURIComponent(svgData)));
                                      const svgUrl = `data:image/svg+xml;base64,${svgBase64}`;

                                      const img = new Image();
                                      await new Promise((resolve, reject) => {
                                        img.onload = () => {
                                          ctx.drawImage(img, 0, 0, width, height);
                                          chartImage = canvas.toDataURL('image/png', 1.0);
                                          resolve();
                                        };
                                        img.onerror = reject;
                                        img.src = svgUrl;
                                      });
                                    }
                                  }
                                } catch (err) {
                                  // Continue without chart image if capture fails
                                }

                                // Helper: convert SVG to PNG with white bg and blue bars
                                const convertSvgToPng = async (svgNode) => {
                                  if (!svgNode) return '';
                                  const clone = svgNode.cloneNode(true);
                                  const bbox = svgNode.getBoundingClientRect();
                                  const width = Math.max(bbox.width || 900, 900);
                                  const height = Math.max(bbox.height || 450, 450);
                                  clone.setAttribute('width', width.toString());
                                  clone.setAttribute('height', height.toString());
                                  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                                  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

                                  // White background
                                  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                                  bg.setAttribute('x', '0');
                                  bg.setAttribute('y', '0');
                                  bg.setAttribute('width', '100%');
                                  bg.setAttribute('height', '100%');
                                  bg.setAttribute('fill', '#ffffff');
                                  clone.insertBefore(bg, clone.firstChild);

                                  // Force bars blue
                                  clone.querySelectorAll('.recharts-bar path, .recharts-bar rect, .recharts-bar-rectangle path, .recharts-bar-rectangle rect, path, rect').forEach(el => {
                                    const cls = el.getAttribute('class') || '';
                                    const fill = el.getAttribute('fill') || '';
                                    if (cls.includes('recharts-bar') || cls.includes('recharts-bar-rectangle') || fill.includes('subjectPassGradient') || fill.includes('gradient')) {
                                      el.setAttribute('fill', '#3b82f6');
                                      el.removeAttribute('stroke');
                                    }
                                  });

                                  // Dark text for print
                                  clone.querySelectorAll('text').forEach(t => {
                                    t.setAttribute('fill', '#111827');
                                    const style = t.getAttribute('style') || '';
                                    if (!style.includes('fill:')) {
                                      t.setAttribute('style', `${style};fill:#111827;`);
                                    }
                                  });

                                  const serialized = new XMLSerializer().serializeToString(clone);
                                  const svg64 = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(serialized);

                                  return new Promise((resolve) => {
                                    const img = new Image();
                                    img.onload = () => {
                                      const canvas = document.createElement('canvas');
                                      canvas.width = width * 2;
                                      canvas.height = height * 2;
                                      const ctx = canvas.getContext('2d');
                                      ctx.fillStyle = '#ffffff';
                                      ctx.fillRect(0, 0, canvas.width, canvas.height);
                                      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                      resolve(canvas.toDataURL('image/png', 1.0));
                                    };
                                    img.onerror = () => resolve('');
                                    img.src = svg64;
                                  });
                                };

                                // Also try to get SVG directly as fallback
                                let svgHtml = '';
                                try {
                                  const svgElement = document.querySelector('#subject-comparison-chart-container svg, #subject-comparison-chart svg, .recharts-wrapper svg');
                                  if (svgElement) {
                                    const clonedSvgForPrint = svgElement.cloneNode(true);
                                    // Update colors for print
                                    clonedSvgForPrint.querySelectorAll('text').forEach(text => {
                                      const fill = text.getAttribute('fill');
                                      if (!fill || fill === '#fff' || fill === '#ffffff' || fill.includes('white')) {
                                        text.setAttribute('fill', '#000000');
                                      }
                                    });
                                    // Ensure bars have gradient
                                    clonedSvgForPrint.querySelectorAll('path, rect').forEach(el => {
                                      const fill = el.getAttribute('fill');
                                      if (fill && fill.includes('gradient')) {
                                        el.setAttribute('fill', 'url(#subjectPassGradient)');
                                      }
                                    });
                                    // Force blue fills for bars in SVG fallback
                                    clonedSvgForPrint.querySelectorAll('.recharts-bar path, .recharts-bar rect, .recharts-bar-rectangle path, .recharts-bar-rectangle rect, path, rect').forEach(el => {
                                      const cls = el.getAttribute('class') || '';
                                      const fill = el.getAttribute('fill') || '';
                                      if (cls.includes('recharts-bar') || cls.includes('recharts-bar-rectangle') || fill.includes('subjectPassGradient') || fill.includes('gradient')) {
                                        el.setAttribute('fill', '#3b82f6');
                                        el.removeAttribute('stroke');
                                      }
                                    });

                                    svgHtml = clonedSvgForPrint.outerHTML;

                                    // If no chartImage yet, derive from SVG to keep colors
                                    if (!chartImage) {
                                      chartImage = await convertSvgToPng(svgElement);
                                    }
                                  }
                                } catch (e) {
                                }

                                // Build content for PDF download (not print)
                                const printInner = printContent.innerHTML || '';

                                // Determine chart content - prefer image, fallback to SVG
                                let chartContent = '';
                                if (chartImage) {
                                  chartContent = `
                              <div class="chart-container">
                                <h2>Pass Rate Comparison Chart</h2>
                                <img src="${chartImage}" alt="Pass Rate Comparison Chart" class="chart-image" style="width:100%;max-width:900px;height:auto;border:1px solid #ddd;border-radius:8px;background:white;" />
                                ${svgHtml ? `<div style="display: none;" class="chart-svg-fallback">${svgHtml}</div>` : ''}
                    </div>
                            `;
                                } else if (svgHtml) {
                                  chartContent = `
                              <div class="chart-container">
                                <h2>Pass Rate Comparison Chart</h2>
                                <div class="chart-svg-wrapper" style="width: 100%; max-width: 900px; margin: 0 auto; background: white; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                                  ${svgHtml}
                  </div>
                              </div>
                            `;
                                }

                                // Create offscreen container for html2canvas capture
                                const container = document.createElement('div');
                                container.style.position = 'absolute';
                                container.style.left = '-9999px';
                                container.style.top = '0';
                                container.style.width = '1200px';
                                container.style.background = '#ffffff';
                                container.style.color = '#111827';
                                container.innerHTML = `
                            <div style="padding:24px;font-family:Arial,sans-serif;">
                                <style>
                                .chart-container { margin: 30px 0; text-align: center; }
                                table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 30px; font-size: 12px; }
                                th, td { border: 1px solid #ddd; padding: 10px; text-align: center; }
                                th { background: #05A3C7; color: #fff; font-weight: bold; }
                                tr:nth-child(even) { background: #f9f9f9; }
                                .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-bottom: 30px; }
                                .summary-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; text-align: center; background: #f9f9f9; }
                                .summary-card h3 { margin: 0 0 10px 0; font-size: 14px; color: #666; }
                                .summary-card p { margin: 0; font-size: 24px; font-weight: bold; color: #05A3C7; }
                                </style>
                              ${printInner}
                                ${chartContent}
                            </div>
                          `;
                                document.body.appendChild(container);

                                try {
                                  const { jsPDF } = await import('jspdf');
                                  const html2canvasLib = (await import('html2canvas')).default;

                                  const captureTarget = container;
                                  const canvas = await html2canvasLib(captureTarget, {
                                    scale: 2,
                                    useCORS: true,
                                    backgroundColor: '#ffffff'
                                  });
                                  const imgData = canvas.toDataURL('image/png', 1.0);

                                  const pdf = new jsPDF('p', 'pt', 'a4');
                                  const pageWidth = pdf.internal.pageSize.getWidth();
                                  const pageHeight = pdf.internal.pageSize.getHeight();

                                  const imgWidth = pageWidth - 40;
                                  const imgHeight = canvas.height * (imgWidth / canvas.width);

                                  let heightLeft = imgHeight;
                                  let position = 20;

                                  pdf.addImage(imgData, 'PNG', 20, position, imgWidth, imgHeight);
                                  heightLeft -= pageHeight - 40;

                                  while (heightLeft > 0) {
                                    pdf.addPage();
                                    position = 20 - (imgHeight - heightLeft);
                                    pdf.addImage(imgData, 'PNG', 20, position, imgWidth, imgHeight);
                                    heightLeft -= pageHeight - 40;
                                  }

                                  pdf.save('Subject-Comparison-Report.pdf');
                                } catch (pdfErr) {
                                  // console.error('PDF generation failed', pdfErr);
                                  alert('Failed to generate PDF report. Please try again.');
                                } finally {
                                  document.body.removeChild(container);
                                }
                              }}
                              className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                              </svg>
                              Print Report
                            </button>
                          </div>
                        </div>

                        {/* Print Content (Hidden but accessible for printing) */}
                        <div id="subject-comparison-print" style={{ display: 'none' }}>
                          <div>
                            <h1>Subject Comparison Report</h1>
                            <div className="info">
                              <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                              {subjectComparisonBatch !== "all" || subjectComparisonBranch !== "all" || subjectComparisonSemester !== "all" ? (
                                <p><strong>Filters:</strong> {
                                  [
                                    subjectComparisonBatch !== "all" ? `Batch: ${subjectComparisonBatch}` : "",
                                    subjectComparisonBranch !== "all" ? `Branch: ${subjectComparisonBranch}` : "",
                                    subjectComparisonSemester !== "all" ? `Semester: ${subjectComparisonSemester}` : ""
                                  ].filter(Boolean).join(", ")
                                }</p>
                              ) : null}
                              <p><strong>Total Subjects:</strong> {subjectComparisonData.filter(s => s.hasData).length}</p>
                            </div>

                            <div className="summary">
                              <div className="summary-card">
                                <h3>Total Subjects</h3>
                                <p>{selectedSubjects.length}</p>
                              </div>
                              <div className="summary-card">
                                <h3>Total Students</h3>
                                <p>{(subjectComparisonUniqueStudents ?? subjectComparisonData.reduce((sum, s) => sum + (s.totalStudents || 0), 0)).toLocaleString()}</p>
                              </div>
                              <div className="summary-card">
                                <h3>Total Passed</h3>
                                <p>{subjectComparisonData.reduce((sum, s) => sum + (s.passed || 0), 0).toLocaleString()}</p>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h2>Detailed Subject Comparison</h2>
                            <table>
                              <thead>
                                <tr>
                                  <th>Subject Code</th>
                                  <th>Subject Name</th>
                                  <th>Total Students</th>
                                  <th>Passed</th>
                                  <th>Failed</th>
                                  <th>Unattempted</th>
                                  <th>Pass Rate (%)</th>
                                  <th>Fail Rate (%)</th>
                                  <th>Unattempted Rate (%)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {subjectComparisonData
                                  .filter(s => s.hasData)
                                  .map((s, idx) => {
                                    const subject = basketSubjects.find(bs => bs.code === s.subject);
                                    return (
                                      <tr key={idx}>
                                        <td>{s.subject}</td>
                                        <td>{subject?.name || "N/A"}</td>
                                        <td>{((s.totalStudents || 0)).toLocaleString()}</td>
                                        <td>{((s.passed || 0)).toLocaleString()}</td>
                                        <td>{((s.failed || 0)).toLocaleString()}</td>
                                        <td>{((s.unattempted || 0)).toLocaleString()}</td>
                                        <td>{((s.passRate || 0)).toFixed(1)}%</td>
                                        <td>{((s.failRate || 0)).toFixed(1)}%</td>
                                        <td>{((s.unattemptedRate || 0)).toFixed(1)}%</td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <ResponsiveContainer width="100%" height={400} id="subject-comparison-chart-container">
                          {(() => {
                            const chartData = subjectComparisonData.filter(s => s.hasData);
                            const subjectColors = ["#60a5fa", "#f472b6", "#22c55e", "#f59e0b", "#a855f7", "#2dd4bf", "#ef4444", "#eab308", "#7dd3fc", "#c084fc"];
                            return (
                              <BarChart
                                data={chartData}
                                margin={{ top: 30, right: 20, left: 50, bottom: 80 }}
                              >
                                <XAxis
                                  dataKey="subject"
                                  stroke="#94a3b8"
                                  angle={-45}
                                  textAnchor="end"
                                  height={100}
                                  tick={{ fill: "#fff", fontSize: 11, fontWeight: 500 }}
                                  tickLine={{ stroke: "#94a3b8" }}
                                  label={{ value: 'Subjects', position: 'insideBottom', offset: -5, fill: '#fff', style: { textAnchor: 'middle', fontSize: '14px', fontWeight: 'bold' } }}
                                  tickFormatter={(value) => {
                                    const subject = basketSubjects.find(s => s.code === value);
                                    // Show short name if available, otherwise just code
                                    if (subject?.name) {
                                      const shortName = subject.name.length > 15
                                        ? subject.name.substring(0, 12) + "..."
                                        : subject.name;
                                      return `${value}\n${shortName}`;
                                    }
                                    return value;
                                  }}
                                />
                                <YAxis
                                  stroke="#94a3b8"
                                  tick={{ fill: "#fff", fontSize: 12 }}
                                  tickLine={{ stroke: "#94a3b8" }}
                                  label={{ value: 'Pass Rate (%)', angle: -90, position: 'insideLeft', fill: '#fff', style: { textAnchor: 'middle', fontSize: '14px', fontWeight: 'bold' } }}
                                />
                                <Tooltip
                                  formatter={(value, name, props) => {
                                    const data = props.payload;
                                    if (name === "Pass Rate (%)") {
                                      const unattempted = data.unattempted || 0;
                                      const attempted = data.attempted || (data.totalStudents - unattempted);
                                      return [`${value}%`, `${name} - ${data.passed} passed / ${attempted} attempted (${unattempted} unattempted) / ${data.totalStudents} total`];
                                    }
                                    return [`${value}%`, name];
                                  }}
                                  labelFormatter={(label) => {
                                    const subject = basketSubjects.find(s => s.code === label);
                                    return subject ? `${label} - ${subject.name}` : label;
                                  }}
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
                                  fill="#60a5fa"
                                  radius={[8, 8, 0, 0]}
                                  name="Pass Rate (%)"
                                  animationDuration={800}
                                  minPointSize={4}
                                  background={{ fill: "rgba(148,163,184,0.15)" }}
                                >
                                  {chartData.map((entry, idx) => (
                                    <Cell key={entry.subject} fill={subjectColors[idx % subjectColors.length]} />
                                  ))}
                                  <LabelList
                                    dataKey="passRate"
                                    position="top"
                                    formatter={(value) => `${value}%`}
                                    style={{ fill: '#10b981', fontSize: '12px', fontWeight: 800 }}
                                  />
                                </Bar>
                              </BarChart>
                            );
                          })()}
                        </ResponsiveContainer>
                      </div>

                      {/* Grade Distribution Chart - DISABLED for Subject Passing Comparison (per user request) */}
                      {/* Previously this showed when exactly one subject had data.
                          Requirement: when we add even a single subject, Grade Distribution should NOT appear.
                          To keep code for future use, we simply gate it behind `false`. */}
                      {false && subjectComparisonData.filter(s => s.hasData).length === 1 && (() => {
                        const singleSubject = subjectComparisonData.find(s => s.hasData);
                        if (!singleSubject || !singleSubject.gradeDistribution) return null;

                        const gradeDistribution = singleSubject.gradeDistribution || {};
                        // Define all possible grades in order
                        const gradeOrder = ['O', 'E', 'A', 'B', 'C', 'D', 'F', 'M', 'S', 'R'];
                        const gradeColors = {
                          'O': '#10b981', // emerald
                          'E': '#3b82f6', // blue
                          'A': '#22c55e', // green
                          'B': '#60a5fa', // light blue
                          'C': '#f59e0b', // amber
                          'D': '#f97316', // orange
                          'F': '#ef4444', // red
                          'M': '#dc2626', // dark red
                          'S': '#991b1b', // darker red
                          'R': '#7f1d1d'  // darkest red
                        };

                        // Prepare chart data
                        const chartData = gradeOrder.map(grade => ({
                          grade: grade,
                          count: gradeDistribution[grade] || gradeDistribution[grade.toUpperCase()] || 0,
                          color: gradeColors[grade] || '#6b7280'
                        })).filter(item => item.count > 0); // Only show grades with data

                        const subject = basketSubjects.find(bs => bs.code === singleSubject.subject);

                        return (
                          <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mt-6">
                            <div className="mb-4">
                              <h4 className="text-lg font-bold text-white/90 mb-1 flex items-center gap-2">
                                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                Grade Distribution - {singleSubject.subject} {subject?.name ? `(${subject.name})` : ''}
                              </h4>
                              <p className="text-xs text-white/60">
                                Distribution of grades for {((singleSubject.totalStudents || 0)).toLocaleString()} student(s)
                              </p>
                            </div>

                            {chartData.length > 0 ? (
                              <>
                                <ResponsiveContainer width="100%" height={400}>
                                  <BarChart
                                    data={chartData}
                                    margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                                  >
                                    <XAxis
                                      dataKey="grade"
                                      stroke="#94a3b8"
                                      tick={{ fill: "#fff", fontSize: 14, fontWeight: 600 }}
                                      tickLine={{ stroke: "#94a3b8" }}
                                      label={{ value: 'Grade', position: 'insideBottom', offset: -5, fill: '#fff', style: { textAnchor: 'middle', fontSize: '14px', fontWeight: 'bold' } }}
                                    />
                                    <YAxis
                                      stroke="#94a3b8"
                                      tick={{ fill: "#fff", fontSize: 12 }}
                                      tickLine={{ stroke: "#94a3b8" }}
                                      label={{ value: 'Number of Students', angle: -90, position: 'insideLeft', fill: '#fff', style: { textAnchor: 'middle', fontSize: '14px', fontWeight: 'bold' } }}
                                    />
                                    <Tooltip
                                      formatter={(value) => [`${value} student(s)`, 'Count']}
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
                                    <Bar
                                      dataKey="count"
                                      radius={[8, 8, 0, 0]}
                                      name="Number of Students"
                                      animationDuration={800}
                                    >
                                      {chartData.map((entry, idx) => (
                                        <Cell key={`cell-${idx}`} fill={entry.color} />
                                      ))}
                                      <LabelList
                                        dataKey="count"
                                        position="top"
                                        style={{ fill: '#fff', fontSize: '12px', fontWeight: 600 }}
                                      />
                                    </Bar>
                                  </BarChart>
                                </ResponsiveContainer>

                                {/* Grade Distribution Table */}
                                <div className="mt-6 overflow-x-auto">
                                  <table className="w-full border-collapse">
                                    <thead>
                                      <tr className="border-b border-white/10">
                                        <th className="px-4 py-3 text-left text-sm font-bold text-white/90">Grade</th>
                                        <th className="px-4 py-3 text-center text-sm font-bold text-white/90">Count</th>
                                        <th className="px-4 py-3 text-center text-sm font-bold text-white/90">Percentage</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {gradeOrder.map((grade) => {
                                        const count = gradeDistribution[grade] || gradeDistribution[grade.toUpperCase()] || 0;
                                        const percentage = (singleSubject.totalStudents && singleSubject.totalStudents > 0)
                                          ? ((count / singleSubject.totalStudents) * 100).toFixed(1)
                                          : 0;
                                        return (
                                          <tr key={grade} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3 text-sm font-mono font-bold" style={{ color: gradeColors[grade] || '#fff' }}>
                                              {grade}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-center text-white/70 font-semibold">
                                              {count.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-center text-white/70 font-semibold">
                                              {percentage}%
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </>
                            ) : (
                              <div className="text-center py-12 text-white/50">
                                <svg className="w-12 h-12 mx-auto text-white/30 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                <p className="font-semibold text-white/70 mb-1">No grade distribution data available</p>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Detailed Comparison Table */}
                      <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mt-6">
                        <div className="mb-4 flex items-center justify-between">
                          <h4 className="text-lg font-bold text-white/90 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Detailed Subject Comparison
                          </h4>
                          <button
                            onClick={() => {
                              const csv = [
                                ["Subject Code", "Subject Name", "Total Students", "Passed", "Failed", "Unattempted", "Pass Rate (%)", "Fail Rate (%)", "Unattempted Rate (%)"],
                                ...subjectComparisonData
                                  .filter(s => s.hasData)
                                  .map(s => {
                                    const subject = basketSubjects.find(bs => bs.code === s.subject);
                                    return [
                                      s.subject,
                                      subject?.name || "N/A",
                                      s.totalStudents || 0,
                                      s.passed || 0,
                                      s.failed || 0,
                                      s.unattempted || 0,
                                      (s.passRate || 0).toFixed(1),
                                      (s.failRate || 0).toFixed(1),
                                      (s.unattemptedRate || 0).toFixed(1)
                                    ];
                                  })
                              ].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");

                              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                              const link = document.createElement("a");
                              link.href = URL.createObjectURL(blob);
                              link.download = `subject_comparison_${new Date().toISOString().split('T')[0]}.csv`;
                              link.click();
                            }}
                            className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Export CSV
                          </button>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[800px]">
                            <thead>
                              <tr className="border-b-2 border-white/20 bg-white/5">
                                <th className="px-4 py-3 text-left text-sm font-bold text-white/90 sticky left-0 bg-white/5 z-10">Subject Code</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-white/90 sticky left-[120px] bg-white/5 z-10">Subject Name</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-white/90">Total Students</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-emerald-400 bg-emerald-500/10">Passed</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-red-400 bg-red-500/10">Failed</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-yellow-400 bg-yellow-500/10">Unattempted</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-emerald-400 bg-emerald-500/10">Pass Rate</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-red-400 bg-red-500/10">Fail Rate</th>
                                <th className="px-4 py-3 text-center text-sm font-bold text-yellow-400 bg-yellow-500/10">Unattempted Rate</th>
                              </tr>
                            </thead>
                            <tbody>
                              {subjectComparisonData
                                .filter(s => s.hasData)
                                .map((s, idx) => {
                                  const subject = basketSubjects.find(bs => bs.code === s.subject);
                                  return (
                                    <tr key={idx} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                                      <td className="px-4 py-3 text-sm font-mono text-purple-300">{s.subject}</td>
                                      <td className="px-4 py-3 text-sm text-white/80">{subject?.name || "N/A"}</td>
                                      <td className="px-4 py-3 text-sm text-center text-white/70 font-semibold">{((s.totalStudents || 0)).toLocaleString()}</td>
                                      <td className="px-4 py-3 text-sm text-center text-emerald-400 font-bold">{((s.passed || 0)).toLocaleString()}</td>
                                      <td className="px-4 py-3 text-sm text-center text-red-400 font-bold">{((s.failed || 0)).toLocaleString()}</td>
                                      <td className="px-4 py-3 text-sm text-center text-yellow-400 font-bold">{((s.unattempted || 0)).toLocaleString()}</td>
                                      <td className="px-4 py-3 text-sm text-center text-emerald-400 font-bold">{((s.passRate || 0)).toFixed(1)}%</td>
                                      <td className="px-4 py-3 text-sm text-center text-red-400 font-bold">{((s.failRate || 0)).toFixed(1)}%</td>
                                      <td className="px-4 py-3 text-sm text-center text-yellow-400 font-bold">{((s.unattemptedRate || 0)).toFixed(1)}%</td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>

                        {subjectComparisonData.filter(s => s.hasData).length === 0 && (
                          <div className="text-center py-12 text-white/50">
                            <svg className="w-12 h-12 mx-auto text-white/30 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                            <p className="font-semibold text-white/70 mb-1">No data available for comparison</p>
                            <p className="text-xs text-white/50">Make sure grade records are uploaded for the selected subjects</p>
                          </div>
                        )}
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
                      ? "Select one or more subjects from result database (up to 6) to compare Pass Rate and Fail Rate"
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
                        Subjects are loaded from the result database. Comparison data comes from uploaded grade records.
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
                        <p>• Verify that subject codes exist in the result database</p>
                        <p>• Selected subjects: {selectedSubjects.join(", ")}</p>
                        <p>• Available subjects with data: {currentData?.subjectDifficultyAnalysis?.length || 0} subjects found in result data</p>
                      </div>
                    </div>
                  )}
                  {basketSubjects.length === 0 && !loadingBasketSubjects && (
                    <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <p className="text-sm text-yellow-300 font-semibold mb-2">
                        No subjects found
                      </p>
                      <p className="text-sm text-yellow-200/80 mb-3">
                        Please upload grade records to the result database first, or check if the database has any subject records.
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
            {(() => {
              // Use topStudentsData if semester filter is applied, otherwise use currentData
              const displayData = topStudentsData !== null ? topStudentsData : (currentData?.topPerformingStudents || []);
              const hasData = displayData && displayData.length > 0;
              
              return hasData ? (
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

                        {/* Semester Filter */}
                        <FilterSelect
                          value={topStudentsSemester}
                          onChange={setTopStudentsSemester}
                          options={semesters}
                          label="Semester"
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
                        {(topStudentsBatch !== "all" || topStudentsBranch !== "all" || topStudentsSemester !== "all" || topStudentsSearch) && (
                        <button
                          onClick={() => {
                            setTopStudentsBatch("all");
                            setTopStudentsBranch("all");
                              setTopStudentsSemester("all");
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
                    {loadingTopStudents && (
                      <div className="mt-4 text-center text-white/70 text-sm">
                        Loading semester data...
                      </div>
                    )}
                </div>

                <TopStudentsTable
                    data={displayData}
                  batchFilter={topStudentsBatch}
                  branchFilter={topStudentsBranch}
                  searchFilter={topStudentsSearch}
                    semesterFilter={topStudentsSemester}
                  isDiploma={isDiploma}
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
              );
            })()}
          </div>
        )}
      </div>
      <style jsx global>{`
      /* Print fixes: keep charts and labels visible on white background */
      @media print {
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        body {
          background: #ffffff !important;
          color: #111827 !important;
        }
        #subject-comparison-chart-container,
        #subject-comparison-chart {
          background: #ffffff !important;
        }
        #subject-comparison-chart-container svg text,
        #subject-comparison-chart svg text,
        #subject-comparison-chart-container .recharts-label,
        #subject-comparison-chart .recharts-label,
        #subject-comparison-chart-container .recharts-cartesian-axis-tick text,
        #subject-comparison-chart .recharts-cartesian-axis-tick text,
        #subject-comparison-chart-container .recharts-legend-item-text,
        #subject-comparison-chart .recharts-legend-item-text {
          fill: #111827 !important;
          color: #111827 !important;
        }
        #subject-comparison-chart-container .recharts-tooltip-wrapper,
        #subject-comparison-chart .recharts-tooltip-wrapper {
          color: #111827 !important;
        }
        #subject-comparison-chart-container svg rect,
        #subject-comparison-chart svg rect {
          stroke: #0f172a !important;
          stroke-width: 0.5 !important;
        }
      }
    `}</style>
    </>
  );
}

/* ===================== REUSABLE COMPONENTS ===================== */
function CoolChartCard({ title, icon, children, fullWidth = false }) {
  return (
    <div
      className={`rounded-3xl border border-white/20 bg-white/10 backdrop-blur-xl p-8 text-white transition hover:-translate-y-1 hover:shadow-2xl ${fullWidth ? "col-span-2" : ""
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

function TopStudentsTable({ data, batchFilter = "all", branchFilter = "all", searchFilter = "", semesterFilter = "all", isDiploma = false }) {
  // Helper functions to extract batch and branch from regNo
  const getBatchFromRegNo = (regNo) => {
    if (!regNo) return null;
    const regNoStr = String(regNo);
    return regNoStr.length >= 2 ? `20${regNoStr.substring(0, 2)}` : null;
  };

  const getBranchFromRegNo = (regNo) => {
    if (!regNo) return null;
    const regNoStr = String(regNo);
    
    // Must be 12 digits
    if (regNoStr.length !== 12) return null;
    
    // Check program code (index 4-6) to determine if Diploma or B.Tech
    const programCode = regNoStr.slice(4, 6);
    const branchCode = regNoStr.slice(5, 8); // 3 digits from index 5-7
    
    // Diploma (SOVET) - Program code is '07'
    if (programCode === '07' || isDiploma) {
      const diplomaBranchMap = {
        '711': 'Electrical Engineering',
        '712': 'Mechanical Engineering',
        '713': 'Civil Engineering',
        '714': 'Computer Science Engineering',
        '715': 'Automobile Engineering',
        '716': 'Mining Engineering'
      };
      return diplomaBranchMap[branchCode] || null;
    }
    
    // B.Tech (SOET) - Program code is not '07'
    const btechBranchMap = {
      '111': 'Civil Engineering',
      '112': 'Computer Science Engineering',
      '113': 'Electronics & Communication Engineering',
      '115': 'Electrical & Electronics Engineering',
      '116': 'Mechanical Engineering',
      '117': 'CSE AIML'
    };
    return btechBranchMap[branchCode] || null;
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
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="text-center py-12 text-white/70">
        <p>No student data available.</p>
      </div>
    );
  }

  let enrichedData = data.map((student) => {
    const regNo = String(student.regNo || "");
    const batch = getBatchFromRegNo(regNo);
    // Use branch from API if available, otherwise parse from regNo
    const branch = student.branch || getBranchFromRegNo(regNo);

    return {
      ...student,
      batch: batch || null,
      branch: branch || null,
      _batchRaw: batch,
      _branchRaw: branch,
      name: student.name || student.Name || student.fullName || student.studentName || "N/A"
    };
  });

  // Always group by batch+branch and show top 10 per combination
  const groupedByBatchBranch = {};

  enrichedData.forEach((student) => {
    // Prefer already parsed values from API/enrichment; fallback to regNo parsing
    const batch = student.batch || getBatchFromRegNo(student.regNo) || "Unknown";
    const branch = student.branch || getBranchFromRegNo(student.regNo) || "Unknown";
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


  // Determine if we're showing SGPA or CGPA
  const isSemesterSpecific = semesterFilter !== "all";
  const gradeType = isSemesterSpecific ? "SGPA" : "CGPA";

  // Sort each group by CGPA/SGPA (keep ALL students, no limit)
  filteredGroups.forEach((key) => {
    groupedByBatchBranch[key].students.sort((a, b) => parseFloat(b.cgpa || 0) - parseFloat(a.cgpa || 0));
    // Removed .slice(0, 10) to show ALL students regardless of CGPA/SGPA
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


  // Sort all results by CGPA/SGPA for final display
  filteredData.sort((a, b) => parseFloat(b.cgpa || 0) - parseFloat(a.cgpa || 0));

  const limitedData = filteredData;

  return (
    <div className="space-y-4">
      {/* Results count */}
      <div className="flex flex-col gap-2 text-sm text-white/70 mb-2">
        <div className="flex items-center justify-between">
          <span>
            Showing <span className="font-bold text-white">{limitedData.length}</span> student{limitedData.length !== 1 ? 's' : ''}
            <span className="ml-2 text-white/60">
              (Top 10 per Batch+Branch combination sorted by {gradeType}
              {batchFilter !== "all" || branchFilter !== "all" || isSemesterSpecific ? " - filtered" : ""})
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
              <th className="text-left py-4 px-6 font-bold">Name</th>
              <th className="text-left py-4 px-6 font-bold">Branch</th>
              <th className="text-left py-4 px-6 font-bold">Batch</th>
              <th className="text-left py-4 px-6 font-bold">{gradeType}</th>
              <th className="text-left py-4 px-6 font-bold">Subjects</th>
            </tr>
          </thead>
          <tbody>
            {limitedData.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-white/50">
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
                  <td className="py-4 px-6 text-white/90">{student.name || "N/A"}</td>
                  <td className="py-4 px-6">{student.branch || "N/A"}</td>
                  <td className="py-4 px-6">{student.batch || "N/A"}</td>
                  <td className="py-4 px-6 font-bold text-emerald-300">
                    {student.cgpa ? `${parseFloat(student.cgpa).toFixed(2)}` : "N/A"}
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

