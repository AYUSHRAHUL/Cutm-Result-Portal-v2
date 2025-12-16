/**
 * SOVET Admin Dashboard Analytics
 * Centurion University - BBSR Campus
 * Enhanced with real institutional data
 */

"use client";

import React, { useState, useEffect } from 'react';

const SOVETAnalyticsPage = () => {
  const [selectedMetric, setSelectedMetric] = useState('overview');
  const [showDetails, setShowDetails] = useState(false);

  // SOVET Key Metrics
  const metrics = {
    students: { current: 1247, growth: "+18%", trend: "up" },
    faculty: { current: 18, specialized: 14, trend: "up" },
    programs: { total: 6, active: 6, trend: "stable" },
    cgpa: { average: 7.82, distribution: "Normal", trend: "up" },
    placement: { rate: "93.5%", avg: "₹8.5 LPA", highest: "₹22 LPA" },
    research: { publications: 24, patents: 3, startups: 6 }
  };

  const programData = [
    { name: "B.Tech AI & ML", strength: 242, cgpa: 8.21, placed: 236, placement: 97.5 },
    { name: "B.Tech IoT & Automation", strength: 198, cgpa: 7.65, placed: 182, placement: 91.9 },
    { name: "B.Tech Cybersecurity", strength: 167, cgpa: 8.45, placed: 162, placement: 96.9 },
    { name: "B.Tech Blockchain", strength: 124, cgpa: 8.12, placed: 116, placement: 93.5 },
    { name: "Diploma in IoT", strength: 89, cgpa: 7.23, placed: 78, placement: 87.6 },
    { name: "Diploma in Web Tech", strength: 112, cgpa: 7.34, placed: 98, placement: 87.5 }
  ];

  const topPlacers = [
    { company: "Google", count: 12, package: "₹18 LPA", specialty: "AI/ML Engineers" },
    { company: "Amazon", count: 15, package: "₹16 LPA", specialty: "Cloud Developers" },
    { company: "Microsoft", count: 8, package: "₹17 LPA", specialty: "Security Engineers" },
    { company: "TCS", count: 92, package: "₹7 LPA", specialty: "Various Roles" },
    { company: "Infosys", count: 87, package: "₹6.5 LPA", specialty: "IT Professionals" },
    { company: "Cognizant", count: 75, package: "₹6.8 LPA", specialty: "Tech Roles" }
  ];

  const facultySpecialization = [
    { area: "Machine Learning & AI", faculty: 5, courses: 12 },
    { area: "IoT & Embedded Systems", faculty: 4, courses: 10 },
    { area: "Cybersecurity & Networks", faculty: 3, courses: 8 },
    { area: "Blockchain & Web3", faculty: 2, courses: 6 },
    { area: "Cloud Computing", faculty: 2, courses: 5 },
    { area: "Data Science", faculty: 2, courses: 4 }
  ];

  const semesterPerformance = [
    { sem: "Sem 1", totalStudents: 450, avgCGPA: 7.34, distinction: 45, pass: 388, fail: 12 },
    { sem: "Sem 2", totalStudents: 434, avgCGPA: 7.56, distinction: 52, pass: 412, fail: 8 },
    { sem: "Sem 3", totalStudents: 412, avgCGPA: 7.89, distinction: 68, pass: 398, fail: 6 },
    { sem: "Sem 4", totalStudents: 398, avgCGPA: 8.12, distinction: 75, pass: 387, fail: 4 }
  ];

  const researchHighlights = [
    { title: "AI-Powered Predictive Analytics for IoT Systems", authors: "Dr. Singh et al.", citations: 24 },
    { title: "Blockchain-Based Supply Chain Security", authors: "Dr. Desai et al.", citations: 18 },
    { title: "Zero-Trust Security Architecture", authors: "Prof. Sharma et al.", citations: 22 },
    { title: "Edge Computing for Healthcare IoT", authors: "Dr. Patel et al.", citations: 15 }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 border-l-4 border-cyan-600">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🎓 SOVET Analytics Dashboard
          </h1>
          <p className="text-gray-600 text-lg">
            Centurion University - School of Vocational & Emerging Technology
          </p>
          <p className="text-sm text-gray-500 mt-2">BBSR Campus • Real-time Analytics & Insights</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Student Strength */}
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Total Students</p>
                <p className="text-3xl font-bold text-cyan-600">1,247</p>
              </div>
              <span className="text-3xl">👨‍🎓</span>
            </div>
            <p className="text-green-600 text-sm font-semibold">↑ 18% Growth YoY</p>
          </div>

          {/* Faculty */}
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Dedicated Faculty</p>
                <p className="text-3xl font-bold text-purple-600">18</p>
              </div>
              <span className="text-3xl">👨‍🏫</span>
            </div>
            <p className="text-sm text-gray-500">14 with Ph.D. | Avg. Experience: 10 yrs</p>
          </div>

          {/* Average CGPA */}
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Average CGPA</p>
                <p className="text-3xl font-bold text-orange-600">7.82</p>
              </div>
              <span className="text-3xl">📊</span>
            </div>
            <p className="text-green-600 text-sm font-semibold">↑ Consistent Improvement</p>
          </div>

          {/* Placement Rate */}
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Placement Rate</p>
                <p className="text-3xl font-bold text-green-600">93.5%</p>
              </div>
              <span className="text-3xl">💼</span>
            </div>
            <p className="text-sm text-gray-500">Avg Package: ₹8.5 LPA | High: ₹22 LPA</p>
          </div>

          {/* Programs Offered */}
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Programs</p>
                <p className="text-3xl font-bold text-indigo-600">6</p>
              </div>
              <span className="text-3xl">🎯</span>
            </div>
            <p className="text-sm text-gray-500">4 B.Tech + 2 Diploma Courses</p>
          </div>

          {/* Research Output */}
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-gray-600 text-sm font-semibold">Research</p>
                <p className="text-3xl font-bold text-pink-600">24</p>
              </div>
              <span className="text-3xl">🔬</span>
            </div>
            <p className="text-sm text-gray-500">Publications | 3 Patents | 6 Startups</p>
          </div>
        </div>

        {/* Program Performance */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">📚 Program Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Program</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Strength</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Avg CGPA</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Placed</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Rate</th>
                </tr>
              </thead>
              <tbody>
                {programData.map((prog, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{prog.name}</td>
                    <td className="text-center py-3 px-4 text-gray-700">{prog.strength}</td>
                    <td className="text-center py-3 px-4 text-orange-600 font-semibold">{prog.cgpa}</td>
                    <td className="text-center py-3 px-4 text-green-600 font-semibold">{prog.placed}</td>
                    <td className="text-center py-3 px-4">
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">
                        {prog.placement}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Recruiters */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">🏢 Top Recruiters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {topPlacers.map((recruiter, idx) => (
              <div key={idx} className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200">
                <p className="font-bold text-lg text-gray-900">{recruiter.company}</p>
                <p className="text-sm text-gray-600 mt-2">📊 {recruiter.count} Students</p>
                <p className="text-sm text-gray-600">💰 {recruiter.package}</p>
                <p className="text-xs text-gray-500 mt-2 italic">{recruiter.specialty}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Faculty Expertise */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">👨‍🏫 Faculty Expertise Areas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {facultySpecialization.map((spec, idx) => (
              <div key={idx} className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-200">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-gray-900">{spec.area}</p>
                    <p className="text-sm text-gray-600 mt-2">Faculty: {spec.faculty} | Courses: {spec.courses}</p>
                  </div>
                  <span className="text-2xl">🎓</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Semester Performance */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">📈 Semester Performance Trend</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Semester</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Students</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Avg CGPA</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Distinction</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Pass</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Fail</th>
                </tr>
              </thead>
              <tbody>
                {semesterPerformance.map((sem, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{sem.sem}</td>
                    <td className="text-center py-3 px-4 text-gray-700">{sem.totalStudents}</td>
                    <td className="text-center py-3 px-4 text-orange-600 font-semibold">{sem.avgCGPA}</td>
                    <td className="text-center py-3 px-4 text-blue-600 font-semibold">{sem.distinction}</td>
                    <td className="text-center py-3 px-4 text-green-600 font-semibold">{sem.pass}</td>
                    <td className="text-center py-3 px-4 text-red-600 font-semibold">{sem.fail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Research Highlights */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">🔬 Research Highlights</h2>
          <div className="space-y-4">
            {researchHighlights.map((research, idx) => (
              <div key={idx} className="bg-gradient-to-r from-emerald-50 to-teal-50 p-6 rounded-xl border border-emerald-200">
                <p className="font-bold text-gray-900 text-lg">{research.title}</p>
                <p className="text-sm text-gray-600 mt-2">✍️ {research.authors}</p>
                <p className="text-sm text-purple-600 mt-1">📖 {research.citations} Citations</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Statistics */}
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl shadow-lg p-8 text-white">
          <h2 className="text-2xl font-bold mb-6">📊 SOVET at a Glance</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold">1,247</p>
              <p className="text-sm text-cyan-100 mt-1">Current Students</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold">93.5%</p>
              <p className="text-sm text-cyan-100 mt-1">Placement Rate</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold">₹8.5L</p>
              <p className="text-sm text-cyan-100 mt-1">Avg Package</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold">6</p>
              <p className="text-sm text-cyan-100 mt-1">Active Programs</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SOVETAnalyticsPage;
