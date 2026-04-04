"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

function TeacherDashboardPKDContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedSchool, setSelectedSchool] = useState(null);

  // Get school from URL query parameter
  useEffect(() => {
    const school = searchParams.get('school');

    if (school) {
      setSelectedSchool(school);
      localStorage.setItem('selectedSchool', school);
      localStorage.setItem('campus', 'pkd');
    } else {
      // Try to get from localStorage
      const savedSchool = localStorage.getItem('selectedSchool');
      if (!savedSchool) {
        // No school selected, redirect back to school selection
        router.replace('/dashboard/teacher');
      } else {
        setSelectedSchool(savedSchool);
      }
    }
  }, [searchParams, router]);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading Teacher Dashboard...');

  const go = (path) => {
    const params = new URLSearchParams();
    if (selectedSchool) params.set('school', selectedSchool);
    params.set('campus', 'pkd');

    const separator = path.includes('?') ? '&' : '?';
    router.push(`${path}${separator}${params.toString()}`);
  };

  // Loading sequence
  useEffect(() => {
    const messages = [
      'Loading Teacher Dashboard...',
      'Fetching Your Data...',
      'Preparing Tools...',
      'Almost Ready...',
      'Welcome Teacher!'
    ];

    let messageIndex = 0;
    const messageInterval = setInterval(() => {
      if (messageIndex < messages.length) {
        setLoadingMessage(messages[messageIndex]);
        messageIndex++;
      }
    }, 600);

    const loadingTimer = setTimeout(() => {
      clearInterval(messageInterval);
      setIsLoading(false);
    }, 1000);

    return () => {
      clearInterval(messageInterval);
      clearTimeout(loadingTimer);
    };
  }, []);

  // Loading Screen
  if (isLoading) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center z-50"
        style={{
          background: 'linear-gradient(135deg, #05A3C7 0%, #04748F 50%, #023945 100%)',
          backgroundSize: '400% 400%',
          animation: 'gradientShift 8s ease-in-out infinite'
        }}
      >
        {/* Spinner Container */}
        <div className="relative flex items-center justify-center mb-8">
          <div className="w-28 h-28 sm:w-32 sm:h-32 lg:w-36 lg:h-36">
            <img
              className="w-full h-full rounded-full object-cover p-2 backdrop-blur-lg"
              style={{
                border: '4px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 0 60px rgba(255, 255, 255, 0.6)',
                animation: 'logoSpin 3s ease-in-out infinite'
              }}
              src="/spinner.jpg"
              alt="CUTM Logo Loading"
            />
          </div>
        </div>

        {/* Loading Text */}
        <div
          className="text-white text-xl sm:text-2xl lg:text-3xl font-black text-center mb-6 px-4"
          style={{
            textShadow: '0 0 20px rgba(255, 255, 255, 0.8)',
            letterSpacing: '1.5px'
          }}
        >
          {loadingMessage}
        </div>

        {/* Progress Bar */}
        <div className="w-56 sm:w-64 lg:w-72 h-1.5 sm:h-2 bg-white/20 rounded-full overflow-hidden mb-4">
          <div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.5) 100%)',
              animation: 'progressFill 3s ease-in-out infinite'
            }}
          ></div>
        </div>

        {/* Status */}
        <div className="text-white/90 text-sm sm:text-base text-center px-4 font-semibold flex items-center gap-2">
          <span className="text-xl">👨‍🏫</span>
          <span>CUTM PKD - Teacher Portal</span>
        </div>

        <style jsx>{`
          @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          @keyframes logoSpin {
            0% { transform: rotate(0deg) scale(1); }
            50% { transform: rotate(180deg) scale(1.05); }
            100% { transform: rotate(360deg) scale(1); }
          }
          @keyframes progressFill {
            0% { width: 0%; }
            100% { width: 100%; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-10"
      style={{
        background: "linear-gradient(to bottom, #F5F8FA 0%, #E8F4F8 50%, #D1E9F6 100%)",
      }}
    >
      {/* Top accent bar */}
      <div className="fixed top-0 left-0 right-0 h-1 sm:h-1.5 z-50">
        <div
          className="h-full w-full animate-pulse"
          style={{
            background: "linear-gradient(90deg, #05A3C7 0%, #F18F01 50%, #04748F 100%)",
            opacity: 0.6
          }}
        />
      </div>

      {/* Back to school selection (explicit navigation — browser Back can skip this if history was replaced) */}
      <div className="mx-auto max-w-6xl px-3 sm:px-6 pt-20 sm:pt-24">
        {/* <button
          type="button"
          onClick={() => router.push("/dashboard/teacher")}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-[#04748F] bg-white/95 border-2 border-[#05A3C7]/30 shadow-sm hover:bg-white hover:border-[#05A3C7]/50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#05A3C7]/40"
        >
          Change school
        </button> */}
      </div>

      {/* Header */}
      <section className="pt-4 sm:pt-6 pb-6 sm:pb-8 px-3 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center justify-center space-y-3 sm:space-y-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div
                className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl shadow-lg hover:scale-105 transition-transform duration-300"
                style={{
                  background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                  boxShadow: "0 0 30px rgba(5,163,199,0.3)"
                }}
              >
                👨‍🏫
              </div>
              <div>
                <h1
                  className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tight"
                  style={{
                    background: "linear-gradient(135deg, #05A3C7 0%, #04748F 50%, #023945 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Teacher Dashboard
                </h1>
                <p className="text-xs sm:text-sm text-[#5A6C7D] font-semibold text-center">
                  CUTM PKD Campus {selectedSchool ? `- ${selectedSchool}` : ''}
                </p>
              </div>
            </div>
            <p className="text-xs sm:text-sm md:text-base text-[#5A6C7D] font-medium text-center max-w-2xl px-4">
              Manage student results, review backlogs, and explore batch data for PKD Campus
            </p>
          </div>
        </div>
      </section>

      {/* Main Module Cards */}
      <section className="py-6 sm:py-8 pb-12 px-3 sm:px-6">
        <div className="mx-auto max-w-6xl">

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
            <ModuleCard
              title="Results"
              icon="📝"
              gradient="from-[#05A3C7] to-[#04748F]"
              onClick={() => go("/dashboard/teacher/results")}
            >
              View student results by registration and semester, with SGPA/CGPA calculations.
            </ModuleCard>

            <ModuleCard
              title="Backlog Review"
              icon="🕓"
              gradient="from-[#F18F01] to-[#E67E00]"
              onClick={() => go("/dashboard/teacher/backlog")}
            >
              Review and update backlog-related entries for students.
            </ModuleCard>

            <ModuleCard
              title="Batch Explorer"
              icon="🗂️"
              gradient="from-[#10B981] to-[#059669]"
              onClick={() => go("/dashboard/teacher/batch")}
            >
              Explore branch/batch wise summaries and insights.
            </ModuleCard>

            <ModuleCard
              title="CBCS Tracker"
              icon="📚"
              gradient="from-[#8B5CF6] to-[#7C3AED]"
              onClick={() => go("/dashboard/teacher/data")}
            >
              Browse CBCS subjects, baskets and mappings.
            </ModuleCard>

            <ModuleCard
              title="Analytics"
              icon="📊"
              gradient="from-[#22C55E] to-[#16A34A]"
              onClick={() => go("/dashboard/teacher/analytics")}
            >
              View Passing Analysis, Subject comparisons and distributions.
            </ModuleCard>

            <ModuleCard
              title="Placement Management"
              icon="💼"
              gradient="from-[#3B82F6] to-[#2563EB]"
              onClick={() => {
                const subPath = selectedSchool?.toLowerCase() === 'som' 
                  ? "/dashboard/teacher/pkd/som/placement" 
                  : "/dashboard/teacher/pkd/soet/placement";
                go(subPath);
              }}
              badge="View Only"
            >
              View placement records, statistics and analytics (Read-only access).
            </ModuleCard>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function TeacherDashboardPKD() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading teacher dashboard...</p>
        </div>
      </div>
    }>
      <TeacherDashboardPKDContent />
    </Suspense>
  );
}

function ModuleCard({ title, icon, gradient, children, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-xl sm:rounded-2xl border-2 bg-white p-4 sm:p-5 lg:p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-[#05A3C7]/20 relative overflow-hidden"
      style={{
        borderColor: "rgba(5,163,199,0.2)",
        minHeight: "200px",
      }}
    >
      {/* Top gradient bar */}
      <div
        className={`absolute inset-x-0 top-0 h-1 scale-x-0 origin-left group-hover:scale-x-100 transition-transform duration-500 bg-gradient-to-r ${gradient}`}
      />

      {/* Badge (if provided) */}
      {badge && (
        <div className="absolute top-3 right-3 z-10">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 shadow-sm">
            👁️ {badge}
          </span>
        </div>
      )}

      {/* Icon */}
      <div
        className={`w-14 h-14 sm:w-16 sm:h-16 lg:w-18 lg:h-18 mx-auto mb-4 sm:mb-5 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl text-white shadow-lg bg-gradient-to-br ${gradient} transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`}
      >
        <span className="group-hover:animate-bounce">{icon}</span>
      </div>

      {/* Title */}
      <h4 className="text-base sm:text-lg font-black text-[#1A1F29] text-center mb-2 sm:mb-3 group-hover:text-[#05A3C7] transition-colors">
        {title}
      </h4>

      {/* Description */}
      <p className="text-xs sm:text-sm text-[#5A6C7D] text-center mb-4 sm:mb-5 font-medium leading-relaxed">
        {children}
      </p>

      {/* Features List */}
      <ul
        className="text-[10px] sm:text-xs space-y-1.5 mb-4 sm:mb-5 rounded-lg p-2 sm:p-3"
        style={{ background: "rgba(5,163,199,0.05)" }}
      >
        <li className="flex items-center gap-2 text-[#1A1F29]">
          <span className="text-green-500 group-hover:scale-125 transition-transform text-sm">✓</span>
          <span className="group-hover:text-[#05A3C7] transition-colors font-medium">Quick Access</span>
        </li>
        <li className="flex items-center gap-2 text-[#1A1F29]">
          <span className="text-green-500 group-hover:scale-125 transition-transform text-sm">✓</span>
          <span className="group-hover:text-[#05A3C7] transition-colors font-medium">Real-time Data</span>
        </li>
      </ul>

      {/* Button */}
      <div className="flex justify-center">
        <span
          className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 group-hover:gap-3"
          style={{
            background: "linear-gradient(135deg, rgba(5,163,199,0.1) 0%, rgba(241,143,1,0.1) 100%)",
            color: "#05A3C7",
            border: "2px solid rgba(5,163,199,0.2)",
          }}
        >
          Open Module
          <span className="transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </span>
      </div>

      {/* Background decoration */}
      <div
        className={`absolute top-0 right-0 w-20 h-20 sm:w-24 sm:h-24 opacity-5 pointer-events-none bg-gradient-to-br ${gradient} rounded-full blur-2xl`}
      />
    </button>
  );
}


