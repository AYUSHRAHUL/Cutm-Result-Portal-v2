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
  
  // Get default schools for campus
  const getDefaultSchools = (campus) => {
    if (campus === 'pkd') {
      return [
        { code: 'SOET', name: 'School of Engineering & Technology' },
        // { code: 'SOM', name: 'School of Management' },
        { code: 'SOVET', name: 'School of Vocational & Engineering Technology' }
      ];
    } else if (campus === 'bbsr') {
      return [
        { code: 'SOET', name: 'School of Engineering & Technology' },
        // { code: 'SOM', name: 'School of Management' },
        { code: 'SOVET', name: 'School of Vocational & Engineering Technology' }
      ];
    }
    return [];
  };
  
  // Initialize - check localStorage first, then API
  useEffect(() => {
    let isMounted = true;
    
    const initializeCampus = async () => {
      try {
        // Step 1: Check localStorage first
        const savedCampus = localStorage.getItem('campus');
        console.log('[TEACHER DASHBOARD] Checking localStorage:', savedCampus);
        
        if (savedCampus) {
          console.log('[TEACHER DASHBOARD] Using campus from localStorage:', savedCampus);
          const schools = getDefaultSchools(savedCampus);
          if (isMounted) {
            setUserCampus(savedCampus);
            setUserSchools(schools);
            setLoadingSchools(false);
            setInitialized(true);
          }
          return;
        }
        
        // Step 2: Try API if localStorage is empty
        console.log('[TEACHER DASHBOARD] No campus in localStorage, fetching from API...');
        const res = await fetch('/api/auth/me');
        
        if (!res.ok) {
          console.error('[TEACHER DASHBOARD] API error:', res.status);
          throw new Error('Failed to fetch user info');
        }
        
        const data = await res.json();
        const campus = data.user?.campus;
        console.log('[TEACHER DASHBOARD] Campus from API:', campus);
        
        if (!campus) {
          throw new Error('No campus detected');
        }
        
        if (isMounted) {
          localStorage.setItem('campus', campus);
          const schools = getDefaultSchools(campus);
          setUserCampus(campus);
          setUserSchools(schools);
          setLoadingSchools(false);
          setInitialized(true);
        }
      } catch (err) {
        console.error('[TEACHER DASHBOARD] Initialization error:', err);
        if (isMounted) {
          setSchoolError('Unable to detect campus. Please log in again.');
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
  
  // Handle school selection
  const handleSchoolSelect = (schoolCode) => {
    if (!userCampus) {
      console.error('[TEACHER DASHBOARD] No campus set');
      setSchoolError('Campus not detected');
      return;
    }
    
    console.log('[TEACHER DASHBOARD] School selected:', schoolCode, 'Campus:', userCampus);
    localStorage.setItem('selectedSchool', schoolCode);
    
    // Redirect to campus-specific dashboard with school
    const redirectPath = userCampus === 'pkd' 
      ? `/dashboard/teacher/pkd?school=${schoolCode}`
      : `/dashboard/teacher/bbsr?school=${schoolCode}`;
    
    console.log('[TEACHER DASHBOARD] Redirecting to:', redirectPath);
    router.replace(redirectPath);
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

  // School Selection Screen - Main
  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{
        background: 'linear-gradient(135deg, #F5F8FA 0%, #E8F4F8 50%, #D1E9F6 100%)',
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

      {/* Main Container */}
      <div className="max-w-4xl w-full mx-auto mt-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg"
              style={{
                background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                boxShadow: "0 0 30px rgba(5,163,199,0.3)"
              }}
            >
              🏫
            </div>
            <h1 
              className="text-3xl sm:text-4xl md:text-5xl font-black"
              style={{
                background: "linear-gradient(135deg, #05A3C7 0%, #04748F 50%, #023945 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Select Your School
            </h1>
          </div>
          <p className="text-[#5A6C7D] text-base md:text-lg font-medium">
            Please choose your school to continue to the dashboard
          </p>
          {userCampus && (
            <p className="text-sm text-[#05A3C7] font-semibold mt-2">
              Campus: <span className="uppercase">{userCampus}</span>
            </p>
          )}
        </div>

        {/* Schools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userSchools.map((school) => (
            <button
              key={school.code}
              onClick={() => handleSchoolSelect(school.code)}
              className="group text-left rounded-2xl border-2 bg-white p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-[#05A3C7]/20 relative overflow-hidden"
              style={{
                borderColor: "rgba(5,163,199,0.2)",
              }}
            >
              {/* Top gradient bar */}
              <div 
                className="absolute inset-x-0 top-0 h-1 scale-x-0 origin-left group-hover:scale-x-100 transition-transform duration-500"
                style={{
                  background: "linear-gradient(90deg, #05A3C7 0%, #F18F01 100%)"
                }}
              />
              
              {/* Icon */}
              <div 
                className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-3xl text-white shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
                style={{
                  background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)"
                }}
              >
                📚
              </div>
              
              {/* Title */}
              <h3 className="text-lg font-black text-[#1A1F29] text-center mb-2 group-hover:text-[#05A3C7] transition-colors">
                {school.name}
              </h3>
              
              {/* Code */}
              <p className="text-sm text-[#5A6C7D] text-center mb-4 font-mono font-semibold">
                {school.code}
              </p>
              
              {/* Click to select */}
              <div className="flex justify-center">
                <span 
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 group-hover:gap-3"
                  style={{
                    background: "linear-gradient(135deg, rgba(5,163,199,0.1) 0%, rgba(241,143,1,0.1) 100%)",
                    color: "#05A3C7",
                    border: "2px solid rgba(5,163,199,0.2)",
                  }}
                >
                  Select School
                  <span className="transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </span>
              </div>

              {/* Background decoration */}
              <div 
                className="absolute top-0 right-0 w-24 h-24 opacity-5 pointer-events-none"
                style={{
                  background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                  borderRadius: "50%",
                  filter: "blur(2rem)"
                }}
              />
            </button>
          ))}
        </div>

        {/* Footer Note */}
        <div className="mt-12 p-6 bg-white/50 rounded-2xl border border-[#05A3C7]/20 text-center">
          <p className="text-[#5A6C7D] text-sm font-medium">
            💡 <span className="font-semibold">Tip:</span> You can switch schools anytime from the settings menu in the dashboard.
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}

function ModuleCard({ title, icon, gradient, children, onClick }) {
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

function StatCard({ label, value, icon, gradient }) {
  return (
    <div 
      className="relative overflow-hidden rounded-xl sm:rounded-2xl border-2 bg-white p-4 sm:p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
      style={{
        borderColor: "rgba(5,163,199,0.2)",
        minHeight: "110px",
      }}
    >
      {/* Background decoration */}
      <div 
        className={`absolute -top-8 -right-8 w-24 h-24 sm:w-28 sm:h-28 rounded-full opacity-10 blur-2xl bg-gradient-to-br ${gradient}`}
      />
      
      <div className="relative flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-xs sm:text-sm uppercase tracking-wider text-[#5A6C7D] font-bold mb-1">
            {label}
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#1A1F29]">
            {value}
          </div>
        </div>
        <div className="text-2xl sm:text-3xl ml-2 flex-shrink-0">
          {icon}
        </div>
      </div>
      
      {/* Progress indicator */}
      <div className="mt-3 w-full h-1 rounded-full bg-gray-100 overflow-hidden">
        <div 
          className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500`}
          style={{ width: '75%' }}
        />
      </div>
    </div>
  );
}
