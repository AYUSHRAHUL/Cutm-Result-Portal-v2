"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const router = useRouter();
  const statsRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [animatedOnce, setAnimatedOnce] = useState(false);
  const [counters, setCounters] = useState({ students: 0, records: 0, backlogs: 0, health: 0 });
  const [selectedCampus, setSelectedCampus] = useState(null);
  const [selectedSchool, setSelectedSchool] = useState(null);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading Admin Dashboard...');

  // Load selected campus and school from localStorage on mount
  useEffect(() => {
    const savedCampus = localStorage.getItem('selectedCampus');
    const savedSchool = localStorage.getItem('selectedSchool');
    if (savedCampus) setSelectedCampus(savedCampus);
    if (savedSchool) setSelectedSchool(savedSchool);
  }, []);

  const targetCounts = useMemo(() => ({ students: 2847, records: 156, backlogs: 23, health: 98 }), []);

  // Loading sequence
  useEffect(() => {
    const messages = [
      'Loading Admin Dashboard...',
      'Fetching System Data...',
      'Preparing Analytics...',
      'Almost Ready...',
      'Welcome Back!'
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
    }, 3000);

    return () => {
      clearInterval(messageInterval);
      clearTimeout(loadingTimer);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 120);
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!statsRef.current || animatedOnce) return;
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setAnimatedOnce(true);
            animateCounters(targetCounts, 1600);
          }
        });
      },
      { threshold: 0.35 }
    );
    observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, [animatedOnce, targetCounts]);

  function animateCounters(target, duration) {
    const start = performance.now();
    const startVals = { ...counters };
    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      setCounters({
        students: Math.floor(startVals.students + (target.students - startVals.students) * progress),
        records: Math.floor(startVals.records + (target.records - startVals.records) * progress),
        backlogs: Math.floor(startVals.backlogs + (target.backlogs - startVals.backlogs) * progress),
        health: Math.floor(startVals.health + (target.health - startVals.health) * progress),
      });
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const go = (path) => router.push(path);

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
        <div className="text-white/90 text-sm sm:text-base text-center px-4 font-semibold">
          🔐 Secure Admin Access
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
      {/* Progress bar */}
      <div
        className="fixed top-0 left-0 h-1 sm:h-1.5 z-50 animate-pulse"
        style={{
          width: "100%",
          background: "linear-gradient(90deg, #05A3C7 0%, #04748F 50%, #05A3C7 100%)",
          opacity: 0.6
        }}
      />

      {/* Welcome Header */}
      <section className="pt-12 sm:pt-16 pb-6 sm:pb-8 text-center px-3 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div
            className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-full mx-auto mb-4 sm:mb-6 flex items-center justify-center text-white text-3xl sm:text-4xl shadow-lg relative overflow-hidden hover:scale-105 transition-transform duration-300"
            style={{
              background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
              boxShadow: "0 0 40px rgba(5,163,199,0.4)"
            }}
          >
            <div
              className="absolute inset-0 rounded-full opacity-30 animate-[spin_4s_linear_infinite]"
              style={{
                background: "conic-gradient(from 0deg, transparent, rgba(255,255,255,0.3), transparent)"
              }}
            />
            <span className="relative animate-bounce">🛡️</span>
          </div>
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-2 sm:mb-3"
            style={{
              background: "linear-gradient(135deg, #05A3C7 0%, #04748F 50%, #023945 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Admin Dashboard
          </h1>
          <p className="text-[#5A6C7D] text-sm sm:text-base font-medium">
            Manage and monitor your academic platform
          </p>
        </div>
      </section>

      {/* Campus Selection Section */}
      <section className="py-6 sm:py-8 px-3 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-xl sm:text-2xl font-black text-center mb-4 sm:mb-6 text-[#1A1F29]">
            Select Campus
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-12">
            <CampusCard
              title="PKD Campus"
              subtitle="Paralakhemundi Campus"
              icon="🏛️"
              isSelected={selectedCampus === 'pkd'}
              onClick={() => {
                setSelectedCampus('pkd');
                localStorage.setItem('selectedCampus', 'pkd');
                localStorage.removeItem('selectedSchool');
                router.push('/dashboard/admin/pkd');
              }}
              gradient="from-blue-500 to-cyan-600"
            />
            <CampusCard
              title="BBSR Campus"
              subtitle="Bhubaneswar Campus"
              icon="🏛️"
              isSelected={selectedCampus === 'bbsr'}
              onClick={() => {
                setSelectedCampus('bbsr');
                localStorage.setItem('selectedCampus', 'bbsr');
                localStorage.removeItem('selectedSchool');
                router.push('/dashboard/admin/bbsr');
              }}
              gradient="from-purple-500 to-pink-600"
            />
          </div>
        </div>
      </section>

      <section className="py-6 sm:py-8 px-3 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-xl sm:text-2xl font-black text-center mb-4 sm:mb-6 text-[#1A1F29]">
            Global Management
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 justify-center">
            <ModuleCard
              title="User Management"
              icon="👥"
              onClick={() => go("/dashboard/admin/users")}
              features={["User Blocking", "Role Management", "Access Control"]}
            >
              Block, edit, and manage registered users with role-based access control.
            </ModuleCard>

            <ModuleCard
              title="Student Status Management"
              icon="🎓"
              onClick={() => go("/dashboard/admin/students")}
              features={["Active/Inactive Status", "Batch-wise Status", "Hide Inactive Records"]}
            >
              Manage student study status (Active/Inactive). Inactive students are hidden from reports.
            </ModuleCard>
          </div>
        </div>
      </section>

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-10 h-10 sm:w-12 sm:h-12 rounded-full text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 active:scale-95 z-40 flex items-center justify-center text-lg sm:text-xl font-bold"
          style={{
            background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
          }}
          aria-label="Scroll to top"
        >
          ↑
        </button>
      )}

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function StatCard({ icon, label, value, trend, trendUp }) {
  return (
    <div
      className="group relative overflow-hidden rounded-xl sm:rounded-2xl border-2 bg-white p-4 sm:p-5 lg:p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
      style={{ borderColor: "rgba(5,163,199,0.2)" }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1 scale-x-0 origin-left group-hover:scale-x-100 transition-transform duration-500"
        style={{
          background: "linear-gradient(90deg, #05A3C7 0%, #04748F 100%)",
        }}
      />

      <div className="text-3xl sm:text-4xl mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>

      <div
        className="text-3xl sm:text-4xl font-black mb-1 sm:mb-2"
        style={{ color: "#05A3C7" }}
      >
        {value}
      </div>

      <div className="text-[10px] sm:text-xs uppercase tracking-wide text-[#5A6C7D] font-bold">
        {label}
      </div>

      <div
        className={`mt-3 sm:mt-4 pt-2 sm:pt-3 border-t text-xs sm:text-sm font-bold flex items-center justify-center gap-1 ${trendUp ? "text-green-600" : "text-red-600"}`}
        style={{ borderColor: "rgba(5,163,199,0.1)" }}
      >
        <span className="group-hover:animate-pulse">{trendUp ? "▲" : "▼"}</span>
        <span>{trend}</span>
      </div>

      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 -z-10 rounded-2xl"
        style={{
          background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
        }}
      />
    </div>
  );
}

function CampusCard({ title, subtitle, icon, onClick, gradient, isSelected }) {
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br ${gradient} p-8 sm:p-10 text-white transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-white/30 ${isSelected ? 'ring-4 ring-white/50 scale-105' : ''}`}
    >
      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
      {isSelected && (
        <div className="absolute top-4 right-4 bg-white text-blue-600 px-3 py-1 rounded-full text-sm font-bold">
          Selected
        </div>
      )}
      <div className="relative z-10">
        <div className="text-5xl sm:text-6xl mb-4 sm:mb-5 group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
        <h3 className="text-3xl sm:text-4xl font-black mb-3">{title}</h3>
        <p className="text-base sm:text-lg opacity-90 font-medium mb-6">{subtitle}</p>
        <div className="flex items-center gap-2 text-base font-bold">
          <span>Select Campus</span>
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </div>
      </div>
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-500" />
    </button>
  );
}

function SchoolCard({ title, subtitle, icon, onClick, gradient, isSelected }) {
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br ${gradient} p-6 sm:p-8 text-white transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-white/30 ${isSelected ? 'ring-4 ring-white/50 scale-105' : ''}`}
    >
      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
      {isSelected && (
        <div className="absolute top-4 right-4 bg-white text-blue-600 px-3 py-1 rounded-full text-sm font-bold">
          Selected
        </div>
      )}
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

function ModuleCard({ title, icon, children, onClick, features = [] }) {
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-xl sm:rounded-2xl border-2 bg-white p-4 sm:p-5 lg:p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-[#05A3C7]/20 relative overflow-hidden"
      style={{ borderColor: "rgba(5,163,199,0.2)" }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1 scale-x-0 origin-left group-hover:scale-x-100 transition-transform duration-500"
        style={{
          background: "linear-gradient(90deg, #05A3C7 0%, #04748F 100%)",
        }}
      />

      <div
        className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 mx-auto mb-3 sm:mb-4 lg:mb-5 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl text-white shadow-md group-hover:scale-110 group-hover:shadow-lg transition-all duration-300"
        style={{
          background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
        }}
      >
        <span className="group-hover:animate-bounce">{icon}</span>
      </div>

      <h4
        className="text-base sm:text-lg lg:text-xl font-black text-center mb-2 sm:mb-3 text-[#1A1F29] transition-colors group-hover:text-[#05A3C7]"
      >
        {title}
      </h4>

      <p className="text-xs sm:text-sm text-[#5A6C7D] text-center mb-3 sm:mb-4 leading-relaxed">
        {children}
      </p>

      {features.length > 0 && (
        <ul
          className="text-[10px] sm:text-xs space-y-1.5 sm:space-y-2 mb-3 sm:mb-4 lg:mb-5 rounded-lg p-2 sm:p-3"
          style={{ background: "rgba(5,163,199,0.05)" }}
        >
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2 text-[#1A1F29]">
              <span className="text-green-500 group-hover:scale-125 transition-transform text-sm">✓</span>
              <span className="group-hover:text-[#05A3C7] transition-colors font-medium">{feature}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-center">
        <span
          className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold shadow-sm group-hover:shadow-md transition-all duration-300"
          style={{
            background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
          }}
        >
          Open Module <span className="transition-transform group-hover:translate-x-1">→</span>
        </span>
      </div>

      <div
        className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 opacity-5 pointer-events-none"
        style={{
          background: "radial-gradient(circle, #05A3C7 0%, transparent 70%)",
        }}
      />
    </button>
  );
}
