"use client";

import { useState, useEffect } from 'react';
import {
  DepartmentChart,
  SemesterChart,
  GradeChart,
  DataSourceChart,
  BatchChart,
  PerformanceChart,
  GradeCreditCorrelationChart,
  StudentPerformanceDistributionChart,
  SubjectDifficultyChart,
  GradeTrendsOverTimeChart,
  TopPerformingStudentsTable
} from './charts/ChartComponents';

export default function AnalyticsDashboard() {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics');
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch analytics data');
      }
      
      setAnalyticsData(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white/80">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-400 text-xl mb-4">⚠️</div>
        <p className="text-red-300 mb-4">Failed to load analytics data</p>
        <p className="text-white/60 text-sm">{error}</p>
        <button 
          onClick={fetchAnalyticsData}
          className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="text-center py-12">
        <p className="text-white/80">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-blue-300 bg-clip-text text-transparent mb-2">
          📊 Data Analytics Dashboard
        </h2>
        <p className="text-blue-100/80">Comprehensive insights from CUTM1 and Registration Data</p>
        <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-emerald-500 mx-auto mt-4 rounded-full"></div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Records"
          value={analyticsData.dataSourceStats.totalRecords.toLocaleString()}
          icon="📄"
          color="text-blue-400"
          trend=""
        />
        <MetricCard
          title="CUTM1 Records"
          value={analyticsData.dataSourceStats.cutm1Records.toLocaleString()}
          icon="🗄️"
          color="text-emerald-400"
          trend=""
        />
        <MetricCard
          title="Registration Records"
          value={analyticsData.dataSourceStats.registrationRecords.toLocaleString()}
          icon="📝"
          color="text-cyan-400"
          trend=""
        />
        {analyticsData.performanceMetrics && analyticsData.performanceMetrics.passRate !== undefined ? (
          <MetricCard
            title="Pass Rate"
            value={`${analyticsData.performanceMetrics.passRate}%`}
            icon="📈"
            color="text-green-400"
            trend=""
          />
        ) : (
          <MetricCard
            title="Data Sources"
            value={analyticsData.dataSourceStats.cutm1Records > 0 && analyticsData.dataSourceStats.registrationRecords > 0 ? "2" : "1"}
            icon="📊"
            color="text-purple-400"
            trend=""
          />
        )}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Data Source Distribution - Always show */}
        <ChartCard title="Data Source Distribution" icon="📊">
          <DataSourceChart data={analyticsData.dataSourceStats} />
        </ChartCard>

        {/* Department Distribution - Only if data exists */}
        {analyticsData.departmentStats && analyticsData.departmentStats.length > 0 && (
          <ChartCard title="Department Distribution" icon="🏢">
            <DepartmentChart data={analyticsData.departmentStats} />
          </ChartCard>
        )}

        {/* Semester Distribution - Only if data exists */}
        {analyticsData.semesterStats && analyticsData.semesterStats.length > 0 && (
          <ChartCard title="Semester Distribution" icon="📚">
            <SemesterChart data={analyticsData.semesterStats} />
          </ChartCard>
        )}

        {/* Batch Distribution - Only if data exists */}
        {analyticsData.batchStats && analyticsData.batchStats.length > 0 && (
          <ChartCard title="Batch Distribution" icon="👥">
            <BatchChart data={analyticsData.batchStats} />
          </ChartCard>
        )}

        {/* Grade Distribution - Only if data exists */}
        {analyticsData.gradeStats && analyticsData.gradeStats.length > 0 && (
          <ChartCard title="Grade Distribution" icon="🎯">
            <GradeChart data={analyticsData.gradeStats} />
          </ChartCard>
        )}

        {/* Performance Metrics - Only if data exists */}
        {analyticsData.performanceMetrics && analyticsData.performanceMetrics.totalRecords > 0 && (
          <ChartCard title="Performance Metrics" icon="⚡">
            <PerformanceChart data={analyticsData.performanceMetrics} />
          </ChartCard>
        )}
      </div>

      {/* Subject Popularity - Only if data exists */}
      {analyticsData.subjectStats && analyticsData.subjectStats.length > 0 && (
        <ChartCard title="Top 10 Most Popular Subjects" icon="📖" fullWidth>
          <SubjectTable data={analyticsData.subjectStats} />
        </ChartCard>
      )}

      {/* Advanced Analytics Section - Only show if we have advanced data */}
      {(analyticsData.gradeCreditCorrelation || 
        analyticsData.studentPerformanceDistribution || 
        analyticsData.subjectDifficultyAnalysis || 
        analyticsData.topPerformingStudents || 
        analyticsData.gradeTrendsOverTime) && (
        <div className="mt-12">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-purple-300 bg-clip-text text-transparent mb-2">
              🔬 Advanced Analytics
            </h3>
            <p className="text-purple-100/80">Deep insights and correlations</p>
            <div className="w-24 h-1 bg-gradient-to-r from-purple-500 to-pink-500 mx-auto mt-4 rounded-full"></div>
          </div>

          {/* Advanced Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Grade vs Credit Correlation - Only if data exists */}
            {analyticsData.gradeCreditCorrelation && analyticsData.gradeCreditCorrelation.length > 0 && (
              <ChartCard title="Grade vs Credit Correlation" icon="🔗">
                <GradeCreditCorrelationChart data={analyticsData.gradeCreditCorrelation} />
              </ChartCard>
            )}

            {/* Student Performance Distribution - Only if data exists */}
            {analyticsData.studentPerformanceDistribution && analyticsData.studentPerformanceDistribution.length > 0 && (
              <ChartCard title="Student Performance Distribution" icon="📊">
                <StudentPerformanceDistributionChart data={analyticsData.studentPerformanceDistribution} />
              </ChartCard>
            )}

            {/* Grade Trends Over Time - Only if data exists */}
            {analyticsData.gradeTrendsOverTime && analyticsData.gradeTrendsOverTime.length > 0 && (
              <ChartCard title="Grade Trends Over Time" icon="📈">
                <GradeTrendsOverTimeChart data={analyticsData.gradeTrendsOverTime} />
              </ChartCard>
            )}
          </div>

          {/* Subject Difficulty Analysis - Only if data exists */}
          {analyticsData.subjectDifficultyAnalysis && analyticsData.subjectDifficultyAnalysis.length > 0 && (
            <ChartCard title="Subject Difficulty Analysis" icon="🎯" fullWidth>
              <SubjectDifficultyChart data={analyticsData.subjectDifficultyAnalysis} />
            </ChartCard>
          )}

          {/* Top Performing Students - Only if data exists */}
          {analyticsData.topPerformingStudents && analyticsData.topPerformingStudents.length > 0 && (
            <ChartCard title="Top 10 Performing Students" icon="🏆" fullWidth>
              <TopPerformingStudentsTable data={analyticsData.topPerformingStudents} />
            </ChartCard>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, icon, color, trend }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-6 text-center text-white transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:border-white/30 hover:bg-white/15">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-emerald-500 scale-x-0 origin-left group-hover:scale-x-100 transition-transform duration-500" />
      
      <div className={`text-4xl mb-4 ${color} group-hover:scale-125 transition-transform duration-300`}>
        {icon}
      </div>
      
      <div className="text-3xl font-extrabold group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-blue-300 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300">
        {value}
      </div>
      
      <div className="text-xs uppercase tracking-wide text-white/70 mt-2 font-medium">
        {title}
      </div>
      
      <div className="mt-4 pt-3 border-t border-white/15 text-sm font-semibold text-emerald-400 flex items-center justify-center gap-1">
        <span className="group-hover:animate-pulse">▲</span>
        <span>{trend}</span>
      </div>
      
      <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-300 -z-10" />
    </div>
  );
}

function ChartCard({ title, icon, children, fullWidth = false }) {
  return (
    <div className={`group relative overflow-hidden rounded-3xl border border-white/20 bg-white/10 backdrop-blur-xl p-6 text-white transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-500/20 hover:border-white/30 ${fullWidth ? 'col-span-1 lg:col-span-2' : ''}`}>
      {/* Background glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-300 -z-10" />
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="text-2xl group-hover:animate-bounce">{icon}</div>
        <h3 className="text-xl font-bold group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-blue-300 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300">
          {title}
        </h3>
      </div>
      
      {/* Chart Content */}
      <div className="relative">
        {children}
      </div>
    </div>
  );
}

function SubjectTable({ data }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-white">
        <thead>
          <tr className="border-b border-white/20">
            <th className="text-left py-3 px-4 font-semibold">Rank</th>
            <th className="text-left py-3 px-4 font-semibold">Subject Code</th>
            <th className="text-left py-3 px-4 font-semibold">Records</th>
            <th className="text-left py-3 px-4 font-semibold">Percentage</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            const total = data.reduce((sum, item) => sum + item.count, 0);
            const percentage = ((item.count / total) * 100).toFixed(1);
            
            return (
              <tr key={item.subject} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                <td className="py-3 px-4">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 text-sm font-bold">
                    {index + 1}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-blue-300">{item.subject}</td>
                <td className="py-3 px-4">{item.count.toLocaleString()}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-white/20 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-white/80">{percentage}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
