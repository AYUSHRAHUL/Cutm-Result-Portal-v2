"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DepartmentChart,
  SemesterChart,
  DataSourceChart,
  BatchChart,
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
  const [basketSubjects, setBasketSubjects] = useState([]); // Subjects from CUTM1 database
  const [loadingBasketSubjects, setLoadingBasketSubjects] = useState(false);
  
  // Subject Comparison specific filters and data
  const [subjectComparisonBatch, setSubjectComparisonBatch] = useState("all");
  const [subjectComparisonBranch, setSubjectComparisonBranch] = useState("all");
  const [subjectComparisonSemester, setSubjectComparisonSemester] = useState("all");
  const [subjectComparisonData, setSubjectComparisonData] = useState([]);
  const [loadingSubjectComparison, setLoadingSubjectComparison] = useState(false);
  const [overviewBatchFilter, setOverviewBatchFilter] = useState("all"); // Separate filter for Department Distribution only
  const [filteredDepartmentStats, setFilteredDepartmentStats] = useState(null); // Separate state for filtered department stats
  const [loadingDepartmentStats, setLoadingDepartmentStats] = useState(false);
  
  // Top Performing Students specific filters
  const [topStudentsBatch, setTopStudentsBatch] = useState("all");
  const [topStudentsBranch, setTopStudentsBranch] = useState("all");
  const [topStudentsSearch, setTopStudentsSearch] = useState("");

  // Passing Analysis specific filters and state
  const [passingAnalysisBatch, setPassingAnalysisBatch] = useState([]); // Array for checkboxes
  const [passingAnalysisBranch, setPassingAnalysisBranch] = useState([]); // Array for checkboxes
  const [passingAnalysisSemester, setPassingAnalysisSemester] = useState([]); // Array for checkboxes
  const [filteredPassingStats, setFilteredPassingStats] = useState(null);
  const [filteredPassingStatsByBatch, setFilteredPassingStatsByBatch] = useState(null);
  const [filteredPassingStatsByBranch, setFilteredPassingStatsByBranch] = useState(null);
  const [filteredPassingStatsByCombination, setFilteredPassingStatsByCombination] = useState([]); // For multiple filter combinations
  const [loadingPassingStats, setLoadingPassingStats] = useState(false);

  const batches = ["all", "2022", "2023", "2024", "2025", "2026", "2027", "2028"];
  const branches = ["all", "CSE", "ECE", "EEE", "ME", "CIVIL", "AIML"];
  const semesters = ["all", "Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6", "Sem 7", "Sem 8"];

  // Fetch subjects from CUTM1 database with filters
  const fetchBasketSubjects = useCallback(async () => {
    try {
      setLoadingBasketSubjects(true);
      console.log("Fetching subjects from CUTM1 database with filters...", {
        batch: subjectComparisonBatch,
        branch: subjectComparisonBranch,
        semester: subjectComparisonSemester
      });
      
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
      
      const url = `/api/analytics/subjects${params.toString() ? `?${params.toString()}` : ""}`;
      console.log("Fetching from:", url);
      
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to fetch subjects:", response.status, response.statusText, errorText);
        setBasketSubjects([]);
        return;
      }

      const result = await response.json();
      console.log("Subjects API response:", result);

      // Verify source is CUTM1, not CBCS
      if (result.source && result.source !== "CUTM1") {
        console.error("ERROR: Subjects are NOT from CUTM1! Source:", result.source);
        setBasketSubjects([]);
        return;
      }

      if (!result.success) {
        console.error("API returned success: false", result);
        setBasketSubjects([]);
        return;
      }

      const subjects = result.subjects || [];
      console.log(`✓ Found ${subjects.length} subjects from CUTM1 database (NOT from CBCS)`);
      
      if (result.count !== undefined) {
        console.log(`✓ Verified: ${result.count} subjects loaded from CUTM1 collection`);
      }

      if (subjects.length === 0) {
        console.warn("⚠️ No subjects found in CUTM1 database. Make sure grade records are uploaded to CUTM1 collection (NOT CBCS).");
        setBasketSubjects([]);
        return;
      }

      // Format subjects
      const formattedSubjects = subjects
        .filter(sub => sub.code && sub.code.trim() !== "")
        .map(sub => ({
          code: sub.code.trim().toUpperCase(),
          name: sub.name || sub.code || ""
        }))
        .sort((a, b) => a.code.localeCompare(b.code));
      
      console.log(`✓ Processed ${formattedSubjects.length} unique subjects from CUTM1 (NOT from CBCS)`);
      setBasketSubjects(formattedSubjects);
    } catch (err) {
      console.error("❌ Error fetching subjects from CUTM1 (NOT CBCS):", err);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch subjects when filters change
  useEffect(() => {
    fetchBasketSubjects();
  }, [fetchBasketSubjects]);

  // Fetch filtered department stats when overviewBatchFilter changes (ONLY for Department Distribution chart)
  useEffect(() => {
    if (!analyticsData) return; // Wait for initial data
    
    const fetchFilteredDepartmentStats = async () => {
      try {
        setLoadingDepartmentStats(true);
        if (overviewBatchFilter === "all") {
          // Use original department stats
          setFilteredDepartmentStats(analyticsData.departmentStats || null);
        } else {
          // Fetch filtered data from API
          const abortController = new AbortController();
          const response = await fetch(`/api/analytics?batch=${overviewBatchFilter}`, {
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
        console.error("Error fetching filtered department stats:", err);
        // Fallback to original on error
        setFilteredDepartmentStats(analyticsData.departmentStats || null);
      } finally {
        setLoadingDepartmentStats(false);
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
        
        // If no filters, use original data
        if (passingAnalysisBatch.length === 0 && passingAnalysisBranch.length === 0 && passingAnalysisSemester.length === 0) {
          setFilteredPassingStats(null);
          setFilteredPassingStatsByBatch(null);
          setFilteredPassingStatsByBranch(null);
          setFilteredPassingStatsByCombination([]);
          setLoadingPassingStats(false);
          return;
        }
        
        // Check if multiple filter types are selected
        const hasMultipleFilterTypes = 
          (passingAnalysisBatch.length > 0 && passingAnalysisBranch.length > 0) ||
          (passingAnalysisBatch.length > 0 && passingAnalysisSemester.length > 0) ||
          (passingAnalysisBranch.length > 0 && passingAnalysisSemester.length > 0) ||
          (passingAnalysisBatch.length > 0 && passingAnalysisBranch.length > 0 && passingAnalysisSemester.length > 0);
        
        if (hasMultipleFilterTypes) {
          // SUPER OPTIMIZATION: Make ONE API call and calculate all combinations on frontend
          // This is 10-100x faster than making individual API calls
          
          // Generate all combinations
          const batches = passingAnalysisBatch.filter(b => b !== "all");
          const branches = passingAnalysisBranch.filter(b => b !== "all");
          const semesters = passingAnalysisSemester
            .filter(s => s !== "all")
            .map(s => s.replace(/^Sem\s*/i, "").trim())
            .filter(s => s);
          
          console.log("Fetching all data once for combinations:", { batches, branches, semesters });
          
          // Make ONE API call with all filters
          const allFiltersParams = new URLSearchParams();
          batches.forEach(b => allFiltersParams.append("batch", b));
          branches.forEach(b => allFiltersParams.append("branch", b));
          semesters.forEach(s => allFiltersParams.append("semester", s));
          
          try {
            const startTime = Date.now();
            const allDataResponse = await fetch(`/api/analytics?${allFiltersParams.toString()}`, {
              method: "GET",
              credentials: "include",
              signal: abortController.signal,
            });
            
            if (abortController.signal.aborted) return;
            
            const allDataResult = await allDataResponse.json();
            const fetchTime = Date.now() - startTime;
            console.log(`Single API call completed in ${fetchTime}ms`);
            
            if (abortController.signal.aborted) return;
            
            if (allDataResponse.ok && allDataResult.success && allDataResult.data) {
              // FIRST: Check if API returned combination breakdown (best case - most accurate)
              if (allDataResult.data.performanceMetricsByCombination && 
                  Array.isArray(allDataResult.data.performanceMetricsByCombination) &&
                  allDataResult.data.performanceMetricsByCombination.length > 0) {
                console.log("✅ Using API-provided combination breakdown");
                console.log("📊 Raw combinations from API:", allDataResult.data.performanceMetricsByCombination);
                const combinationResults = allDataResult.data.performanceMetricsByCombination.map(combo => ({
                  label: `${combo.batch || ''} ${combo.branch || ''}${combo.semester ? ` Sem ${combo.semester}` : ''}`.trim(),
                  batch: combo.batch,
                  branch: combo.branch,
                  semester: combo.semester,
                  data: {
                    totalRecords: combo.total || 0,
                    passedRecords: combo.passed || 0,
                    failedRecords: combo.failed || 0,
                    passRate: combo.passRate || 0
                  },
                  error: null
                }));
                console.log("📊 Processed combinations:", combinationResults);
                console.log("📊 Total combinations:", combinationResults.length);
                
                setFilteredPassingStatsByCombination(combinationResults);
                // Also set overall metrics for summary cards
                const overallMetrics = allDataResult.data?.performanceMetrics;
                if (overallMetrics) {
                setFilteredPassingStats(overallMetrics);
                } else {
                  // Calculate overall from combinations
                  const total = combinationResults.reduce((sum, c) => sum + (c.data.totalRecords || 0), 0);
                  const passed = combinationResults.reduce((sum, c) => sum + (c.data.passedRecords || 0), 0);
                  setFilteredPassingStats({
                    totalRecords: total,
                    passedRecords: passed,
                    failedRecords: total - passed,
                    passRate: total > 0 ? (passed / total) * 100 : 0
                  });
                }
                setFilteredPassingStatsByBatch(null);
                setFilteredPassingStatsByBranch(null);
                setLoadingPassingStats(false);
                return;
              }
              
              // If API didn't return combinations, we need to make individual calls
              // Don't use overall metrics - they're not accurate for individual combinations
              console.log("⚠️ API didn't return combination breakdown, will make individual calls");
            }
          } catch (err) {
            if (err.name !== 'AbortError' && !abortController.signal.aborted) {
              console.error("Error fetching all filtered data:", err);
            }
          }
          
          // Fallback: If single call approach doesn't work, use individual calls (but optimized)
          console.warn("Falling back to individual API calls (slower)");
          const combinationPromises = [];
          
          // Helper function to create a safe fetch promise
          const createFetchPromise = async (params, label, batch, branch) => {
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
              const url = `/api/analytics?${params.toString()}`;
              console.log(`Fetching: ${url}`);
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
                console.error(`API error for ${label}:`, response.status, response.statusText);
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
              
              console.log(`API response for ${label}:`, result);
              
              if (!result.success) {
                console.error(`API returned success=false for ${label}:`, result);
                return {
                  label,
                  batch,
                  branch,
                  data: null,
                  error: result.error || "Unknown error"
                };
              }
              
              const metrics = result.data?.performanceMetrics;
              if (!metrics) {
                console.warn(`No performanceMetrics for ${label}`);
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
              console.error(`Error fetching ${label}:`, err);
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
                    createFetchPromise(params, `${batch} ${branch} Sem ${sem}`, batch, branch)
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
                  createFetchPromise(params, `${batch} Sem ${sem}`, batch, null)
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
                  createFetchPromise(params, `${branch} Sem ${sem}`, null, branch)
                );
              });
            });
          }
          
          // Wait for all combinations to fetch (use Promise.allSettled to handle individual failures)
          // OPTIMIZATION: Limit concurrent requests to avoid overwhelming the server
          const MAX_CONCURRENT = 10; // Process 10 requests at a time
          try {
            if (combinationPromises.length === 0) {
              console.warn("No combination promises created!");
              setFilteredPassingStatsByCombination([]);
            } else {
              console.log(`Fetching ${combinationPromises.length} combinations (batched for performance)...`);
              
              // Process promises in batches to avoid overwhelming the server
              const combinationResults = [];
              for (let i = 0; i < combinationPromises.length; i += MAX_CONCURRENT) {
                const batch = combinationPromises.slice(i, i + MAX_CONCURRENT);
                if (abortController.signal.aborted) break;
                
                const batchResults = await Promise.allSettled(batch);
                combinationResults.push(...batchResults);
                
                // Small delay between batches to avoid overwhelming the server
                if (i + MAX_CONCURRENT < combinationPromises.length && !abortController.signal.aborted) {
                  await new Promise(resolve => setTimeout(resolve, 50));
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
                    console.warn("Promise rejected:", result.reason);
                  }
                  return false;
                })
                .map(result => result.value)
                .filter(result => result && !result.error); // Filter out error results
              
              console.log("Combination results (all):", combinationResults);
              console.log("Combination results (successful):", successfulResults);
              console.log("Successful count:", successfulResults.length, "out of", combinationPromises.length);
              
              // Also fetch overall stats for fallback (only if not aborted)
              if (!abortController.signal.aborted) {
                const overallParams = new URLSearchParams();
                batches.forEach(b => overallParams.append("batch", b));
                branches.forEach(b => overallParams.append("branch", b));
                
                try {
                  const overallResponse = await fetch(`/api/analytics?${overallParams.toString()}`, {
                    method: "GET",
                    credentials: "include",
                    signal: abortController.signal,
                  });
                  
                  if (!abortController.signal.aborted && overallResponse.ok) {
                    const overallResult = await overallResponse.json();
                    if (overallResult.success && overallResult.data?.performanceMetrics) {
                      console.log("Overall filtered stats:", overallResult.data.performanceMetrics);
                      setFilteredPassingStats(overallResult.data.performanceMetrics);
                    }
                  }
                } catch (overallErr) {
                  // Only log non-abort errors
                  if (overallErr.name !== 'AbortError' && !abortController.signal.aborted) {
                    console.error("Error fetching overall stats:", overallErr);
                  }
                }
              }
              
              // Only update state if not aborted
              if (!abortController.signal.aborted) {
                setFilteredPassingStatsByCombination(successfulResults);
                setFilteredPassingStatsByBatch(null);
                setFilteredPassingStatsByBranch(null);
              }
            }
          } catch (err) {
            // Only handle non-abort errors
            if (err.name !== 'AbortError' && !abortController.signal.aborted) {
              console.error("Error in Promise.allSettled:", err);
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
          
        const url = `/api/analytics${params.toString() ? `?${params.toString()}` : ""}`;
          console.log("Fetching single filter data:", url);
          
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
            console.log("Single filter API response:", result.data);
            // Set overall metrics
            setFilteredPassingStats(result.data?.performanceMetrics || null);
            
            // Set breakdowns if available
          if (result.data?.performanceMetricsByBatch) {
              console.log("Got batch breakdown:", result.data.performanceMetricsByBatch);
            setFilteredPassingStatsByBatch(result.data.performanceMetricsByBatch);
          } else {
            setFilteredPassingStatsByBatch(null);
          }
            
          if (result.data?.performanceMetricsByBranch) {
              console.log("Got branch breakdown:", result.data.performanceMetricsByBranch);
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
          console.error("Error fetching filtered passing stats:", err);
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
        
        const response = await fetch(`/api/analytics/subject-comparison?${params.toString()}`, {
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
                hasData: false
              };
            }
            
            const failedCount = subData.failed || 0;
            const totalStudents = subData.totalStudents || 0;
            const passedCount = subData.passed || (totalStudents - failedCount);
            const passRate = parseFloat(subData.passRate || 0);
            const failRate = totalStudents > 0 ? parseFloat(((failedCount / totalStudents) * 100).toFixed(1)) : 0;
            
            return {
              subject: subjectCode,
              passRate: passRate,
              failRate: failRate,
              totalStudents: totalStudents,
              passed: passedCount,
              failed: failedCount,
              average: parseFloat(subData.average || 0),
              hasData: true
            };
          });
          
          setSubjectComparisonData(comparisonData);
        } else {
          setSubjectComparisonData([]);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error("Error fetching subject comparison:", err);
          setSubjectComparisonData([]);
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

  // Check if we should show breakdown by batch (branch selected, batch = empty)
  const showBatchBreakdown = passingAnalysisBranch.length > 0 && passingAnalysisBatch.length === 0 && filteredPassingStatsByBatch && filteredPassingStatsByBatch.length > 0;
  
  // Check if we should show breakdown by branch (batch selected, branch = empty)
  const showBranchBreakdown = passingAnalysisBatch.length > 0 && passingAnalysisBranch.length === 0 && filteredPassingStatsByBranch && filteredPassingStatsByBranch.length > 0;
  
  // Bar chart data - show separate bars for each selected filter value
  let passFailData = [];
  
  console.log("=== Generating passFailData ===");
  console.log("Filters:", {
    batch: passingAnalysisBatch,
    branch: passingAnalysisBranch
  });
  console.log("Available data:", {
    filteredPassingStats,
    filteredPassingStatsByBatch,
    filteredPassingStatsByBranch,
    filteredPassingStatsByCombination
  });
  
  // If only batch filters selected, show breakdown by branch (branch-wise analysis for batch)
  if (passingAnalysisBatch.length > 0 && passingAnalysisBranch.length === 0) {
    // Show breakdown by branch for selected batch
    if (filteredPassingStatsByBranch && filteredPassingStatsByBranch.length > 0) {
      passFailData = filteredPassingStatsByBranch
        .map(item => ({
          name: item.branch,
      Passed: item.passed,
          PassRate: item.total > 0 ? parseFloat(((item.passed / item.total) * 100).toFixed(1)) : 0,
      Total: item.total
    }));
      console.log("Batch selected - showing branch breakdown:", passFailData);
    } else {
      console.warn("No branch breakdown available for selected batch");
      passFailData = [];
    }
  } 
  // If only branch filters selected, show breakdown by batch
  else if (passingAnalysisBranch.length > 0 && passingAnalysisBatch.length === 0) {
    // Show breakdown by batch for selected branch
    if (filteredPassingStatsByBatch && filteredPassingStatsByBatch.length > 0) {
      passFailData = filteredPassingStatsByBatch
        .map(item => ({
          name: `Batch ${item.batch}`,
          Passed: item.passed,
          PassRate: item.total > 0 ? parseFloat(((item.passed / item.total) * 100).toFixed(1)) : 0,
          Total: item.total
        }));
      console.log("Branch selected - showing batch breakdown:", passFailData);
  } else {
      console.warn("No breakdown available for selected branch");
      passFailData = [];
    }
  } 
  // If multiple filter types selected (batch + branch, or batch + branch + semester), show one bar per combination
  else if ((passingAnalysisBatch.length > 0 && passingAnalysisBranch.length > 0) || 
           (passingAnalysisBatch.length > 0 && passingAnalysisSemester.length > 0) ||
           (passingAnalysisBranch.length > 0 && passingAnalysisSemester.length > 0) ||
           (passingAnalysisBatch.length > 0 && passingAnalysisBranch.length > 0 && passingAnalysisSemester.length > 0)) {
    // Use combination data if available
    console.log("Using combination data for chart:", filteredPassingStatsByCombination);
    console.log("Combination data type:", typeof filteredPassingStatsByCombination);
    console.log("Combination data is array:", Array.isArray(filteredPassingStatsByCombination));
    
    if (filteredPassingStatsByCombination && Array.isArray(filteredPassingStatsByCombination) && filteredPassingStatsByCombination.length > 0) {
      const validCombinations = filteredPassingStatsByCombination.filter(combo => {
        const isValid = combo && combo.data && !combo.error && combo.data.totalRecords !== undefined;
        if (!isValid) {
          console.warn("Invalid combination:", combo);
        }
        return isValid;
      });
      console.log("Valid combinations for chart:", validCombinations);
      console.log("Valid combinations count:", validCombinations.length);
      
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
            const branchMatch = label.match(/\b(CSE|ECE|EEE|ME|CE|AIML|CIVIL|CS|EC|EE|MECH)\b/i);
            if (branchMatch) branch = branchMatch[1].toUpperCase();
            
            // Try to extract semester number
            const semMatch = label.match(/Sem\s*(\d+)/i);
            if (semMatch) semester = String(parseInt(semMatch[1])).padStart(2, '0');
            
            return `${batch}-${branch}-${semester}`;
          };
          
          return getSortKey(a).localeCompare(getSortKey(b));
        });
        
          // Filter out 0% data and map to chart data
        passFailData = sortedCombinations
          .map(combo => {
            const metrics = combo.data;
            // Calculate pass rate properly
            let passRate = 0;
            if (metrics.passRate !== undefined && metrics.passRate !== null) {
              passRate = parseFloat(metrics.passRate.toFixed(1));
            } else if (metrics.totalRecords > 0) {
              passRate = parseFloat(((metrics.passedRecords / metrics.totalRecords) * 100).toFixed(1));
            }
            
            // Calculate pass rate from the actual data (not from the API's passRate which might be aggregated)
            const actualPassRate = metrics.totalRecords > 0 
              ? parseFloat(((metrics.passedRecords / metrics.totalRecords) * 100).toFixed(1))
              : 0;
            
            // Use the calculated pass rate instead of the API's passRate to ensure accuracy
            const finalPassRate = actualPassRate || passRate;
            
            console.log(`📊 Chart data for ${combo.label}:`, {
              semester: combo.semester,
              passedRecords: metrics.passedRecords,
              totalRecords: metrics.totalRecords,
              apiPassRate: passRate,
              calculatedPassRate: actualPassRate,
              finalPassRate: finalPassRate,
              hasData: metrics.totalRecords > 0
            });
            
            return {
              name: combo.label,
              Passed: metrics.passedRecords || 0,
              PassRate: finalPassRate, // Use calculated pass rate
              Total: metrics.totalRecords || 0
            };
          })
          // Filter out entries with 0 total records (no data available)
          .filter(item => {
            const hasData = item.Total > 0;
            if (!hasData) {
              console.log(`Filtering out ${item.name} - no data (Total: ${item.Total})`);
            }
            return hasData;
          });
        console.log("Generated passFailData from combinations (sorted, filtered):", passFailData);
      } else {
        console.warn("No valid combinations found for chart. All combinations:", filteredPassingStatsByCombination);
        // Fallback: try to use overall stats if available
        if (filteredPassingStats) {
          console.log("Using fallback: filteredPassingStats");
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
            passFailData = labels.map(label => ({
              name: label,
              Passed: filteredPassingStats.passedRecords || 0,
              PassRate: filteredPassingStats.passRate ? parseFloat(filteredPassingStats.passRate.toFixed(1)) : 0,
              Total: filteredPassingStats.totalRecords || 0
            }));
          } else {
            passFailData = [];
          }
        } else {
          passFailData = [];
        }
      }
    } else {
      console.warn("No combination data available for chart. Type:", typeof filteredPassingStatsByCombination, "Length:", filteredPassingStatsByCombination?.length);
      // Fallback: use overall stats
      if (filteredPassingStats) {
        console.log("Using fallback: filteredPassingStats for multiple filters");
        const batches = passingAnalysisBatch.filter(b => b !== "all");
        const branches = passingAnalysisBranch.filter(b => b !== "all");
        
        if (batches.length > 0 && branches.length > 0) {
          passFailData = batches.flatMap(batch => 
            branches.map(branch => ({
              name: `Batch ${batch} ${branch}`,
              Passed: filteredPassingStats.passedRecords || 0,
              PassRate: filteredPassingStats.passRate ? parseFloat(filteredPassingStats.passRate.toFixed(1)) : 0,
              Total: filteredPassingStats.totalRecords || 0
            }))
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
      Passed: passingStats.passed,
      PassRate: passingStats.passRate,
      Total: passingStats.total
    }];
  }
  
  console.log("=== Final passFailData ===", passFailData);
  console.log("passFailData length:", passFailData.length);

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
            <div className="mb-6 p-5 rounded-2xl border border-white/10 bg-gradient-to-r from-white/5 via-white/5 to-white/5 backdrop-blur-sm">
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

                  {/* Semester Checkboxes */}
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <label className="block text-white/90 font-semibold mb-3 text-sm">Semester</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {/* Select All */}
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors border-b border-white/10 pb-2 mb-2">
                        <input
                          type="checkbox"
                          checked={passingAnalysisSemester.length === semesters.filter(s => s !== "all").length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPassingAnalysisSemester(semesters.filter(s => s !== "all"));
                            } else {
                              setPassingAnalysisSemester([]);
                            }
                          }}
                          className="w-4 h-4 rounded border-white/30 bg-white/10 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                        />
                        <span className="text-white/90 text-sm font-semibold">All</span>
                      </label>
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
                          {((passingStats.passed / passingStats.total) * 100).toFixed(1)}% of total
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
                      Pass Rate Analysis
                    </h4>
                    <div className="flex items-center gap-4 text-sm text-white/70">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"></div>
                        <span>Number of Students</span>
                      </div>
                      </div>
                    </div>
                  
                  {(() => {
                    console.log("Chart rendering - passFailData:", passFailData);
                    console.log("Chart rendering - passFailData length:", passFailData?.length);
                    
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
                  
                    // Calculate max value for Y-axis domain
                    const maxTotal = Math.max(...passFailData.map(item => item.Total || 0));
                    const yAxisMax = maxTotal > 0 ? Math.ceil(maxTotal * 1.1) : 100; // Add 10% padding
                  
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
                        label={{ value: 'Number of Students', angle: -90, position: 'insideLeft', fill: '#fff', style: { textAnchor: 'middle', fontSize: '14px', fontWeight: 'bold' } }}
                        domain={[0, yAxisMax]}
                        />
                        <Tooltip 
                        formatter={(value, name, props) => {
                          if (name === "Total") {
                            const passRate = props.payload?.PassRate || 0;
                            return [
                              `${value} students (${passRate}% pass rate)`,
                              "Total Students"
                            ];
                          }
                          return [value, name];
                        }}
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
                        dataKey="Total" 
                        fill="url(#passRateGradient)"
                          radius={[12, 12, 0, 0]}
                        name="Number of Students"
                          animationDuration={800}
                  >
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
                  
                  {/* Subject Selection from CUTM1 */}
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
                
                {/* Enhanced Summary Cards for Comparison */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
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
                  <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20 text-center hover:bg-emerald-500/15 transition-all">
                    <div className="flex items-center justify-center mb-2">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-emerald-200 text-xs mb-1">Avg Pass Rate</p>
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
                  <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20 text-center hover:bg-blue-500/15 transition-all">
                    <div className="flex items-center justify-center mb-2">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <p className="text-blue-200 text-xs mb-1">Total Students</p>
                    <p className="text-2xl font-bold text-blue-400">
                      {subjectComparisonData.reduce((sum, s) => sum + s.totalStudents, 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/20 text-center hover:bg-yellow-500/15 transition-all">
                    <div className="flex items-center justify-center mb-2">
                      <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                    </div>
                    <p className="text-yellow-200 text-xs mb-1">Avg Grade</p>
                    <p className="text-2xl font-bold text-yellow-400">
                      {(() => {
                        const subjectsWithData = subjectComparisonData.filter(s => s.hasData && s.average > 0);
                        return subjectsWithData.length > 0
                          ? (
                              subjectsWithData.reduce((sum, s) => sum + s.average, 0) /
                              subjectsWithData.length
                            ).toFixed(2)
                          : "N/A";
                      })()}
                    </p>
                    <p className="text-xs text-yellow-300/70 mt-1">(out of 10)</p>
                  </div>
                  <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20 text-center hover:bg-purple-500/15 transition-all">
                    <div className="flex items-center justify-center mb-2">
                      <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <p className="text-purple-200 text-xs mb-1">Total Passed</p>
                    <p className="text-2xl font-bold text-purple-400">
                      {subjectComparisonData.reduce((sum, s) => sum + s.passed, 0).toLocaleString()}
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
                              console.log('Taking screenshot of chart...');
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
                              console.log('Screenshot captured successfully:', chartImage.length, 'chars');
                            }
                          } catch (screenshotError) {
                            console.warn('Screenshot capture failed, trying SVG method:', screenshotError);
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
                                    // Force green gradient colors for bars
                                    const offset = stop.getAttribute('offset');
                                    if (originalId === 'subjectPassGradient' || originalId?.includes('Pass')) {
                                      if (offset === '0%' || offset === '0') {
                                        stop.setAttribute('stop-color', '#22c55e');
                                        stop.setAttribute('stop-opacity', '1');
                                      } else {
                                        stop.setAttribute('stop-color', '#16a34a');
                                        stop.setAttribute('stop-opacity', '0.9');
                                      }
                                    } else if (!stopColor) {
                                      // Default green gradient if missing
                                      if (offset === '0%' || offset === '0') {
                                        stop.setAttribute('stop-color', '#22c55e');
                                        stop.setAttribute('stop-opacity', '1');
                                      } else {
                                        stop.setAttribute('stop-color', '#16a34a');
                                        stop.setAttribute('stop-opacity', '0.9');
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
                                stop1.setAttribute('stop-color', '#22c55e');
                                stop1.setAttribute('stop-opacity', '1');
                                const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                                stop2.setAttribute('offset', '100%');
                                stop2.setAttribute('stop-color', '#16a34a');
                                stop2.setAttribute('stop-opacity', '0.9');
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
                                  // Force green gradient
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
                                      console.log('Chart captured successfully via base64');
                                      resolve();
                                    } catch (e) {
                                      console.error('Canvas draw error:', e);
                                      reject(e);
                                    }
                                  };
                                  img.onerror = (e) => {
                                    console.warn('Base64 method failed, trying blob URL');
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
                                        console.log('Chart captured successfully via blob URL');
                                        resolve();
                                      } catch (e) {
                                        URL.revokeObjectURL(blobUrl);
                                        console.error('Canvas draw error:', e);
                                        reject(e);
                                      }
                                    };
                                    img.onerror = (e) => {
                                      URL.revokeObjectURL(blobUrl);
                                      console.error('Blob URL method also failed:', e);
                                      reject(new Error('Both methods failed'));
                                    };
                                    img.src = blobUrl;
                                  });
                                } catch (blobError) {
                                  console.error('All chart capture methods failed:', blobError);
                                  throw blobError;
                                }
                              }
                            } else {
                              console.warn('SVG element not found. Container:', chartContainerElement);
                              // Try alternative: look for SVG anywhere in the document
                              const anySvg = document.querySelector('#subject-comparison-chart svg, .recharts-wrapper svg');
                              if (anySvg) {
                                console.log('Found SVG via alternative method');
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
                            console.error('Could not capture chart image:', err);
                            // Continue without chart image if capture fails
                          }
                          
                          console.log('Chart image captured:', chartImage ? 'Yes' : 'No', chartImage ? `(${chartImage.length} chars)` : '');
                          
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
                              svgHtml = clonedSvgForPrint.outerHTML;
                              console.log('SVG HTML captured:', svgHtml.length, 'chars');
                            }
                          } catch (e) {
                            console.warn('Could not capture SVG HTML:', e);
                          }
                          
                          const printWindow = window.open('', '_blank');
                          
                          // Build the HTML content
                          const firstDiv = printContent.querySelector('div:first-child')?.outerHTML || '';
                          const lastDiv = printContent.querySelector('div:last-child')?.outerHTML || '';
                          
                          // Check if lastDiv already contains the Detailed Subject Comparison table
                          const lastDivHasTable = lastDiv && lastDiv.includes('Detailed Subject Comparison');
                          
                          // Get Detailed Subject Comparison table from the visible table only if not already in lastDiv
                          let detailedTableHtml = '';
                          if (!lastDivHasTable) {
                            try {
                              // Find the table by looking for "Detailed Subject Comparison" heading
                              const allHeadings = Array.from(document.querySelectorAll('h4'));
                              const detailedHeading = allHeadings.find(h => h.textContent?.includes('Detailed Subject Comparison'));
                              
                              if (detailedHeading) {
                                // Find the table container (parent or sibling)
                                let tableContainer = detailedHeading.closest('.bg-white\\/5') || 
                                                     detailedHeading.parentElement?.nextElementSibling ||
                                                     detailedHeading.closest('div')?.querySelector('.overflow-x-auto');
                                
                                if (!tableContainer) {
                                  // Try to find by traversing up and down
                                  let current = detailedHeading.parentElement;
                                  while (current && !tableContainer) {
                                    tableContainer = current.querySelector('table');
                                    if (!tableContainer) current = current.parentElement;
                                  }
                                }
                                
                                const table = tableContainer?.querySelector('table') || tableContainer;
                                
                                if (table && table.tagName === 'TABLE') {
                                  // Clone the table and update styles for print
                                  const clonedTable = table.cloneNode(true);
                                  
                                  // Remove any inline styles that might interfere
                                  clonedTable.removeAttribute('class');
                                  clonedTable.style.width = '100%';
                                  clonedTable.style.borderCollapse = 'collapse';
                                  clonedTable.style.marginTop = '20px';
                                  clonedTable.style.marginBottom = '30px';
                                  clonedTable.style.fontSize = '12px';
                                  
                                  // Update header styles
                                  clonedTable.querySelectorAll('th').forEach(th => {
                                    th.style.backgroundColor = '#05A3C7';
                                    th.style.color = 'white';
                                    th.style.padding = '10px';
                                    th.style.border = '1px solid #ddd';
                                    th.style.textAlign = 'center';
                                    th.style.fontWeight = 'bold';
                                    th.style.fontSize = '12px';
                                    // Remove any classes
                                    th.removeAttribute('class');
                                  });
                                  
                                  // Update cell styles
                                  clonedTable.querySelectorAll('td').forEach(td => {
                                    td.style.padding = '10px';
                                    td.style.border = '1px solid #ddd';
                                    td.style.textAlign = 'center';
                                    td.style.color = '#000';
                                    td.style.fontSize = '12px';
                                    // Remove any classes
                                    td.removeAttribute('class');
                                  });
                                  
                                  // Update row styles - alternate row colors
                                  clonedTable.querySelectorAll('tbody tr').forEach((tr, idx) => {
                                    tr.removeAttribute('class');
                                    if (idx % 2 === 0) {
                                      tr.style.backgroundColor = '#f9f9f9';
                                    } else {
                                      tr.style.backgroundColor = '#ffffff';
                                    }
                                  });
                                  
                                  detailedTableHtml = `
                                    <div style="margin-top: 40px; page-break-inside: avoid;">
                                      <h2 style="color: #05A3C7; margin-bottom: 15px; font-size: 20px; font-weight: bold;">Detailed Subject Comparison</h2>
                                      ${clonedTable.outerHTML}
                      </div>
                                  `;
                                  console.log('Detailed table captured for print');
                                } else {
                                  console.warn('Table not found in container');
                                }
                              } else {
                                console.warn('Detailed Subject Comparison heading not found');
                              }
                            } catch (e) {
                              console.warn('Could not capture detailed table:', e);
                            }
                          } else {
                            console.log('Detailed table already in lastDiv, skipping duplicate');
                          }
                          
                          // Determine chart content - prefer image, fallback to SVG
                          let chartContent = '';
                          if (chartImage) {
                            chartContent = `
                              <div class="chart-container">
                                <h2>Pass Rate Comparison Chart</h2>
                                <img src="${chartImage}" alt="Pass Rate Comparison Chart" class="chart-image" style="-webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;" onload="console.log('Image loaded');" onerror="console.error('Image failed to load'); this.style.display='none'; this.nextElementSibling.style.display='block';" />
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
                          } else {
                            chartContent = `
                              <div class="chart-container">
                                <h2>Pass Rate Comparison Chart</h2>
                                <p style="color: #666; text-align: center; padding: 40px; border: 1px dashed #ddd;">
                                  Chart could not be captured. Please ensure the chart is visible on screen before printing.
                                </p>
                              </div>
                            `;
                          }
                          
                          printWindow.document.write(`
                            <!DOCTYPE html>
                            <html>
                              <head>
                                <meta charset="UTF-8">
                                <title>Subject Comparison Report</title>
                                <style>
                                  * { box-sizing: border-box; }
                                  body { 
                                    font-family: Arial, sans-serif; 
                                    padding: 20px; 
                                    background: white;
                                    color: black;
                                    margin: 0;
                                  }
                                  h1 { color: #1a1f29; margin-bottom: 10px; font-size: 24px; }
                                  h2 { color: #05A3C7; margin-top: 30px; margin-bottom: 15px; font-size: 20px; }
                                  .info { margin-bottom: 20px; color: #666; }
                                  .chart-image {
                                    width: 100%;
                                    max-width: 900px;
                                    height: auto;
                                    margin: 20px auto;
                                    border: 1px solid #ddd;
                                    border-radius: 8px;
                                    display: block;
                                    background: white;
                                  }
                                  .chart-container {
                                    margin: 30px 0;
                                    page-break-inside: avoid;
                                    text-align: center;
                                  }
                                  .chart-svg-wrapper {
                                    overflow: visible;
                                  }
                                  .chart-svg-wrapper svg {
                                    width: 100%;
                                    height: auto;
                                    max-width: 900px;
                                  }
                                  table { 
                                    width: 100%; 
                                    border-collapse: collapse; 
                                    margin-top: 20px;
                                    margin-bottom: 30px;
                                    font-size: 12px;
                                  }
                                  th, td { 
                                    border: 1px solid #ddd; 
                                    padding: 10px; 
                                    text-align: left; 
                                  }
                                  th { 
                                    background-color: #05A3C7; 
                                    color: white; 
                                    font-weight: bold;
                                    text-align: center;
                                  }
                                  td { text-align: center; }
                                  tr:nth-child(even) { background-color: #f9f9f9; }
                                  .summary { 
                                    display: grid; 
                                    grid-template-columns: repeat(5, 1fr); 
                                    gap: 15px; 
                                    margin-bottom: 30px;
                                  }
                                  .summary-card { 
                                    border: 1px solid #ddd; 
                                    padding: 15px; 
                                    border-radius: 8px; 
                                    text-align: center;
                                    background: #f9f9f9;
                                  }
                                  .summary-card h3 { 
                                    margin: 0 0 10px 0; 
                                    font-size: 14px; 
                                    color: #666; 
                                  }
                                  .summary-card p { 
                                    margin: 0; 
                                    font-size: 24px; 
                                    font-weight: bold; 
                                    color: #05A3C7; 
                                  }
                                  @media print {
                                    body { padding: 10px; }
                                    .no-print { display: none; }
                                    .chart-container { page-break-inside: avoid; }
                                    table { page-break-inside: auto; }
                                    tr { page-break-inside: avoid; page-break-after: auto; }
                                    /* Ensure colors print */
                                    * { 
                                      -webkit-print-color-adjust: exact !important;
                                      print-color-adjust: exact !important;
                                      color-adjust: exact !important;
                                    }
                                    img { 
                                      -webkit-print-color-adjust: exact !important;
                                      print-color-adjust: exact !important;
                                      color-adjust: exact !important;
                                    }
                                    svg {
                                      -webkit-print-color-adjust: exact !important;
                                      print-color-adjust: exact !important;
                                      color-adjust: exact !important;
                                    }
                                  }
                                </style>
                              </head>
                              <body>
                                ${firstDiv}
                                ${chartContent}
                                ${lastDiv}
                                ${detailedTableHtml}
                              </body>
                            </html>
                          `);
                          printWindow.document.close();
                          
                          // Wait for content to load before printing
                          printWindow.onload = () => {
                            console.log('Print window loaded');
                            setTimeout(() => {
                              printWindow.print();
                            }, 1000);
                          };
                          
                          // Fallback if onload doesn't fire
                          setTimeout(() => {
                            if (printWindow.document.readyState === 'complete') {
                              printWindow.print();
                            }
                          }, 1500);
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
                        <h3>Avg Pass Rate</h3>
                        <p>{(() => {
                          const subjectsWithData = subjectComparisonData.filter(s => s.hasData);
                          return subjectsWithData.length > 0
                            ? (subjectsWithData.reduce((sum, s) => sum + s.passRate, 0) / subjectsWithData.length).toFixed(1)
                            : 0;
                        })()}%</p>
                      </div>
                      <div className="summary-card">
                        <h3>Total Students</h3>
                        <p>{subjectComparisonData.reduce((sum, s) => sum + s.totalStudents, 0).toLocaleString()}</p>
                      </div>
                      <div className="summary-card">
                        <h3>Avg Grade</h3>
                        <p>{(() => {
                          const subjectsWithData = subjectComparisonData.filter(s => s.hasData && s.average > 0);
                          return subjectsWithData.length > 0
                            ? (subjectsWithData.reduce((sum, s) => sum + s.average, 0) / subjectsWithData.length).toFixed(2)
                            : "N/A";
                        })()}</p>
                      </div>
                      <div className="summary-card">
                        <h3>Total Passed</h3>
                        <p>{subjectComparisonData.reduce((sum, s) => sum + s.passed, 0).toLocaleString()}</p>
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
                            <th>Pass Rate (%)</th>
                            <th>Avg Grade</th>
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
                                  <td>{s.totalStudents.toLocaleString()}</td>
                                  <td>{s.passed.toLocaleString()}</td>
                                  <td>{s.failed.toLocaleString()}</td>
                                  <td>{s.passRate.toFixed(1)}%</td>
                                  <td>{s.average > 0 ? s.average.toFixed(2) : "N/A"}</td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <ResponsiveContainer width="100%" height={400} id="subject-comparison-chart-container">
                    <BarChart 
                      data={subjectComparisonData.filter(s => s.hasData)} 
                      margin={{ top: 30, right: 20, left: 50, bottom: 80 }}
                    >
                      <defs>
                        <linearGradient id="subjectPassGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={1} />
                          <stop offset="100%" stopColor="#16a34a" stopOpacity={0.9} />
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
                            return [`${value}%`, `${name} - ${data.passed} passed / ${data.totalStudents} total`];
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
                        fill="url(#subjectPassGradient)"
                        radius={[8, 8, 0, 0]}
                        name="Pass Rate (%)"
                        animationDuration={800}
                      >
                        <LabelList 
                          dataKey="passRate" 
                          position="top" 
                          formatter={(value) => `${value}%`}
                          style={{ fill: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                        />
                      </Bar>
                </BarChart>
              </ResponsiveContainer>
                </div>
                
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
                          ["Subject Code", "Subject Name", "Total Students", "Passed", "Failed", "Pass Rate (%)", "Avg Grade"],
                          ...subjectComparisonData
                            .filter(s => s.hasData)
                            .map(s => {
                              const subject = basketSubjects.find(bs => bs.code === s.subject);
                              return [
                                s.subject,
                                subject?.name || "N/A",
                                s.totalStudents,
                                s.passed,
                                s.failed,
                                s.passRate.toFixed(1),
                                s.average > 0 ? s.average.toFixed(2) : "N/A"
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
                          <th className="px-4 py-3 text-center text-sm font-bold text-emerald-400 bg-emerald-500/10">Pass Rate</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-yellow-400 bg-yellow-500/10">Avg Grade</th>
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
                                <td className="px-4 py-3 text-sm text-center text-white/70 font-semibold">{s.totalStudents.toLocaleString()}</td>
                                <td className="px-4 py-3 text-sm text-center text-emerald-400 font-bold">{s.passed.toLocaleString()}</td>
                                <td className="px-4 py-3 text-sm text-center text-red-400 font-bold">{s.failed.toLocaleString()}</td>
                                <td className="px-4 py-3 text-sm text-center text-emerald-400 font-bold">{s.passRate.toFixed(1)}%</td>
                                <td className="px-4 py-3 text-sm text-center text-yellow-400 font-bold">
                                  {s.average > 0 ? s.average.toFixed(2) : "N/A"}
                                </td>
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
                    ? "Select one or more subjects from CUTM1 database (up to 6) to compare Pass Rate and Fail Rate"
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
                      Subjects are loaded from the CUTM1 database. Comparison data comes from uploaded grade records.
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
                      <p>• Verify that subject codes exist in the CUTM1 database</p>
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
                      Please upload grade records to the CUTM1 database first, or check if the database has any subject records.
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

