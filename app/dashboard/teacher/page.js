"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function TeacherDashboard() {
  const router = useRouter();
  const [userCampus, setUserCampus] = useState(null);
  const [userSchools, setUserSchools] = useState([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [schoolError, setSchoolError] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [pickerSelected, setPickerSelected] = useState(null);

  const schoolCardUi = {
    SOET: { icon: "🏗️", gradient: "from-blue-500 to-cyan-600" },
    SOM: { icon: "💼", gradient: "from-purple-500 to-pink-600" },
    SOVET: { icon: "🎓", gradient: "from-green-500 to-emerald-600" },
  };

  const getDefaultSchools = (campus) => {
    if (campus === 'pkd') {
      return [
        { code: 'SOET', name: 'School of Engineering & Technology' },
        { code: 'SOM', name: 'School of Management' },
        { code: 'SOVET', name: 'School of Vocational Education & Training' }
      ];
    } else if (campus === 'bbsr') {
      return [
        { code: 'SOET', name: 'School of Engineering & Technology' },
        { code: 'SOM', name: 'School of Management' },
        { code: 'SOVET', name: 'School of Vocational Education & Training' }
      ];
    }
    return [];
  };

  // Initialize - check localStorage first, then API
  useEffect(() => {
    let isMounted = true;

    const initializeCampus = async () => {
      try {
        // Always prioritize API for source of truth
        console.log('[TEACHER DASHBOARD] Fetching campus from API...');
        const res = await fetch('/api/auth/me');

        if (res.ok) {
          const data = await res.json();
          const apiCampus = data.user?.campus ? data.user.campus.toLowerCase() : 'pkd';
          console.log('[TEACHER DASHBOARD] Campus from API:', apiCampus);

          if (isMounted) {
            localStorage.setItem('campus', apiCampus); // Update local storage with fresh data
            const schools = getDefaultSchools(apiCampus);
            setUserCampus(apiCampus);
            setUserSchools(schools);
            setLoadingSchools(false);
            setInitialized(true);
          }
          return;
        }

        // Fallback: Check localStorage if API failed
        const savedCampus = localStorage.getItem('campus');
        if (savedCampus) {
          const campus = savedCampus.toLowerCase();
          console.log('[TEACHER DASHBOARD] API failed, using fallback campus from localStorage:', campus);
          const schools = getDefaultSchools(campus);
          if (isMounted) {
            setUserCampus(campus);
            setUserSchools(schools);
            setLoadingSchools(false);
            setInitialized(true);
          }
          return;
        }
        
        // Final fallback: Default to PKD campus
        console.warn('[TEACHER DASHBOARD] API failed and no localStorage, defaulting to PKD campus');
        if (isMounted) {
          localStorage.setItem('campus', 'pkd');
          const schools = getDefaultSchools('pkd');
          setUserCampus('pkd');
          setUserSchools(schools);
          setLoadingSchools(false);
          setInitialized(true);
        }
      } catch (err) {
        console.error('[TEACHER DASHBOARD] Initialization error:', err);
        if (isMounted) {
          // Default to PKD campus on error
          console.warn('[TEACHER DASHBOARD] Error occurred, defaulting to PKD campus');
          localStorage.setItem('campus', 'pkd');
          const schools = getDefaultSchools('pkd');
          setUserCampus('pkd');
          setUserSchools(schools);
          setLoadingSchools(false);
          setInitialized(true);
        }
      }
    };

    initializeCampus();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("selectedSchool");
    if (saved) setPickerSelected(String(saved).toLowerCase());
  }, []);

  // Handle school selection
  const handleSchoolSelect = (schoolCode) => {
    if (!userCampus) {
      console.error('[TEACHER DASHBOARD] No campus set');
      setSchoolError('Campus not detected');
      return;
    }

    console.log('[TEACHER DASHBOARD] School selected:', schoolCode, 'Campus:', userCampus);
    localStorage.setItem("selectedSchool", schoolCode);
    localStorage.setItem("school", schoolCode);
    if (userCampus) {
      localStorage.setItem("selectedCampus", userCampus);
      localStorage.setItem("campus", userCampus);
    }
    setPickerSelected(String(schoolCode).toLowerCase());

    // Redirect to campus-specific dashboard with school
    const redirectPath = userCampus.toLowerCase() === 'pkd'
      ? `/dashboard/teacher/pkd?school=${schoolCode}`
      : `/dashboard/teacher/bbsr?school=${schoolCode}`;

    console.log('[TEACHER DASHBOARD] Redirecting to:', redirectPath);
    // Use push (not replace) so browser Back returns to school selection on PKD/BBSR hub
    router.push(redirectPath);
  };

  // Error state - show error and offer login redirect
  if (schoolError && initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-black mb-4 text-red-600">Error</h1>
          <p className="text-gray-700 mb-6">{schoolError}</p>
          <button
            onClick={() => router.replace('/login')}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (loadingSchools) {
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
          Loading School Options...
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
          <span>Preparing Your Portal...</span>
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

  // School Selection Screen - Main (aligned with admin PKD school picker)
  const campusLabel = (userCampus || "pkd").toUpperCase();
  return (
    <div
      className="min-h-screen pb-10"
      style={{
        background: "linear-gradient(to bottom, #F5F8FA 0%, #E8F4F8 50%, #D1E9F6 100%)",
      }}
    >
      <div
        className="fixed top-0 left-0 h-1 sm:h-1.5 z-50 animate-pulse"
        style={{
          width: "100%",
          background: "linear-gradient(90deg, #05A3C7 0%, #04748F 50%, #05A3C7 100%)",
          opacity: 0.6,
        }}
      />

      <section className="pt-12 sm:pt-16 pb-6 sm:pb-8 text-center px-3 sm:px-6">
        <div className="mx-auto max-w-5xl">
          
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-2 sm:mb-3"
            style={{
              background: "linear-gradient(135deg, #05A3C7 0%, #04748F 50%, #023945 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            CUTM {campusLabel} - Teacher Dashboard
          </h1>
          <p className="text-[#5A6C7D] text-sm sm:text-base font-medium">
            Manage your classes and tools - {campusLabel} Campus
          </p>
        </div>
      </section>

      <section className="py-6 sm:py-8 px-3 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-xl sm:text-2xl font-black text-center mb-4 sm:mb-6 text-[#1A1F29]">
            Select School
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
            {userSchools.map((school) => {
              const ui = schoolCardUi[school.code] || {
                icon: "🏫",
                gradient: "from-blue-500 to-cyan-600",
              };
              return (
                <TeacherSchoolCard
                  key={school.code}
                  title={school.code}
                  subtitle={school.name}
                  icon={ui.icon}
                  gradient={ui.gradient}
                  isSelected={pickerSelected === school.code.toLowerCase()}
                  onClick={() => handleSchoolSelect(school.code)}
                />
              );
            })}
          </div>
        </div>
      </section>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function TeacherSchoolCard({ title, subtitle, icon, onClick, gradient, isSelected }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br ${gradient} p-6 sm:p-8 text-white transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-white/30 ${isSelected ? "ring-4 ring-white/50 scale-105" : ""}`}
    >
      {isSelected && (
        <div className="absolute top-4 right-4 bg-white text-blue-600 px-3 py-1 rounded-full text-sm font-bold">
          Selected
        </div>
      )}
      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
      <div className="relative z-10">
        <div className="text-4xl sm:text-5xl mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
        <h3 className="text-2xl sm:text-3xl font-black mb-2">{title}</h3>
        <p className="text-sm sm:text-base opacity-90 font-medium">{subtitle}</p>
        <div className="mt-4 sm:mt-6 flex items-center gap-2 text-sm font-bold">
          <span>Select School</span>
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </div>
      </div>
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
    </button>
  );
}
