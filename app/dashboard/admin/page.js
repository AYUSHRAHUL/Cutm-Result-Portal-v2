"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const router = useRouter();
  const statsRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [animatedOnce, setAnimatedOnce] = useState(false);
  const [counters, setCounters] = useState({ students: 0, records: 0, backlogs: 0, health: 0 });

  const targetCounts = useMemo(() => ({ students: 2847, records: 156, backlogs: 23, health: 98 }), []);

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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_30%,rgba(59,130,246,0.15),transparent_50%),radial-gradient(circle_at_80%_30%,rgba(16,185,129,0.12),transparent_50%),radial-gradient(circle_at_40%_70%,rgba(245,158,11,0.10),transparent_50%),radial-gradient(circle_at_60%_80%,rgba(139,92,246,0.12),transparent_50%),radial-gradient(circle_at_90%_10%,rgba(236,72,153,0.08),transparent_50%)]">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 h-1.5 bg-gradient-to-r from-blue-500 via-emerald-500 to-blue-500 z-40 animate-pulse" style={{ width: "100%", opacity: 0.2 }} />

      {/* Welcome Header */}
      <section className="pt-16 pb-8 text-center">
        <div className="mx-auto max-w-5xl px-6">
          <div className="w-28 h-28 rounded-full mx-auto mb-6 flex items-center justify-center text-white text-4xl shadow-[0_0_40px_rgba(59,130,246,0.5)] bg-gradient-to-br from-blue-500 to-blue-600 relative overflow-hidden hover:scale-105 transition-transform duration-300">
            <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent,rgba(255,255,255,0.3),transparent)] animate-[spin_4s_linear_infinite]" />
            <span className="relative animate-bounce">🛡️</span>
        </div>
          <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-white via-blue-300 to-emerald-300 bg-clip-text text-transparent tracking-tight hover:scale-105 transition-transform duration-300">
            Admin Dashboard
          </h1>
          <p className="mt-3 text-blue-100/90 max-w-xl mx-auto">Complete management console for the CUTM Result Portal</p>
          <div className="mt-5 inline-flex items-center gap-2 px-5 py-2 rounded-full border border-emerald-500/40 text-emerald-300 text-sm backdrop-blur-sm shadow-lg hover:shadow-emerald-500/20 hover:border-emerald-500/60 transition-all duration-300">
            <span className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse" /> Administrator Access Granted
                  </div>
                </div>
      </section>

      {/* Stats */}
      <section ref={statsRef} className="py-8 bg-white/5 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard icon="👥" color="text-blue-400" label="Total Students" value={counters.students} trend="12.5% increase" trendUp />
          <StatCard icon="📄" color="text-emerald-400" label="Active Records" value={counters.records} trend="8.3% increase" trendUp />
          <StatCard icon="⚠️" color="text-amber-400" label="Pending Backlogs" value={counters.backlogs} trend="5.2% decrease" />
          <StatCard icon="📈" color="text-cyan-400" label="System Health" value={counters.health} trend="Excellent" trendUp />
              </div>
      </section>

      {/* Modules */}
      <section className="py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-blue-300 bg-clip-text text-transparent hover:scale-105 transition-transform duration-300">Administrative Modules</h2>
            <p className="text-blue-100/80 mt-2">Comprehensive tools for managing the system</p>
            <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-emerald-500 mx-auto mt-4 rounded-full"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <ModuleCard title="Data Upload Center" icon="☁️" gradient="from-blue-500 to-blue-600" onClick={() => go("/dashboard/admin/upload")}>
              Upload and manage student data via CSV/XLSX with validation and batch processing.
            </ModuleCard>
            <ModuleCard title="Data Management" icon="👁️" gradient="from-emerald-500 to-emerald-600" onClick={() => go("/dashboard/admin/records")}>
              View, edit, and manage all student records with filtering and bulk ops.
            </ModuleCard>
            <ModuleCard title="Backlog Management" icon="🕓" gradient="from-amber-500 to-amber-600" onClick={() => go("/dashboard/admin/backlog")}>
              Monitor and manage student backlogs with tracking and reporting.
            </ModuleCard>
            <ModuleCard title="Branch/Batch Portal" icon="🗂️" gradient="from-cyan-500 to-cyan-600" onClick={() => go("/dashboard/admin/batch")}>
              Track and analyze branch and batch datasets with insights.
            </ModuleCard>
            <ModuleCard title="CBCS Management" icon="📚" gradient="from-purple-500 to-purple-600" onClick={() => go("/dashboard/admin/data")}>
              Manage CBCS subjects, baskets and mappings for academic records.
            </ModuleCard>
            <ModuleCard title="Results" icon="📝" gradient="from-rose-500 to-rose-600" onClick={() => go("/dashboard/admin/results")}>
              Search, update and export result entries with auditability.
            </ModuleCard>
            <ModuleCard title="Analytics Dashboard" icon="📊" gradient="from-indigo-500 to-indigo-600" onClick={() => go("/dashboard/admin/analytics")}>
              Comprehensive data visualization and insights with Chart.js integration.
            </ModuleCard>
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section className="py-10 bg-white/5">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-8">
            <h3 className="text-xl font-semibold text-white">Quick Actions</h3>
            <p className="text-blue-100/80">Frequently used administrative tasks</p>
              </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { t: "Add Student", i: "➕" },
              { t: "Search Records", i: "🔎" },
              { t: "Export Data", i: "⬇️" },
              { t: "Notifications", i: "🔔" },
              { t: "Analytics", i: "📊" },
              { t: "Settings", i: "⚙️" },
            ].map((a, idx) => (
              <div 
                key={idx} 
                className={`text-center rounded-xl border border-white/10 bg-white/10 backdrop-blur-md p-4 text-white/90 hover:bg-white/15 transition-transform hover:-translate-y-1 ${idx === 4 ? 'cursor-pointer' : 'cursor-default'}`}
                onClick={idx === 4 ? () => go("/dashboard/admin/analytics") : undefined}
              >
                <div className="text-2xl mb-2">{a.i}</div>
                <div className="text-sm font-semibold">{a.t}</div>
                <div className="text-xs text-white/70">{idx === 0 ? "Quick registration" : idx === 1 ? "Find data" : idx === 2 ? "Download reports" : idx === 3 ? "System alerts" : idx === 4 ? "View analytics" : "Configuration"}</div>
            </div>
            ))}
              </div>
            </div>
      </section>

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-transform hover:-translate-y-0.5"
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

function StatCard({ icon, color, label, value, trend, trendUp }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-6 text-center text-white transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:border-white/30 hover:bg-white/15">
      {/* Top indicator bar */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-emerald-500 scale-x-0 origin-left group-hover:scale-x-100 transition-transform duration-500" />
      
      {/* Icon with animation */}
      <div className={`text-4xl mb-4 ${color} group-hover:scale-125 transition-transform duration-300`}>{icon}</div>
      
      {/* Value with animation */}
      <div className="text-4xl font-extrabold group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-blue-300 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300">{value}</div>
      
      {/* Label */}
      <div className="text-xs uppercase tracking-wide text-white/70 mt-2 font-medium">{label}</div>
      
      {/* Trend indicator */}
      <div className={`mt-4 pt-3 border-t border-white/15 text-sm font-semibold ${trendUp ? "text-emerald-400" : "text-rose-400"} flex items-center justify-center gap-1`}>
        <span className="group-hover:animate-pulse">{trendUp ? "▲" : "▼"}</span> 
        <span>{trend}</span>
      </div>
      
      {/* Background glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-300 -z-10" />
    </div>
  );
}

function ModuleCard({ title, icon, gradient, children, onClick }) {
  return (
    <button 
      onClick={onClick} 
      className="group text-left rounded-3xl border border-white/20 bg-white/10 backdrop-blur-xl p-6 text-white transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-500/20 hover:border-white/30 focus:outline-none relative overflow-hidden"
    >
      {/* Background glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-300 -z-10" />
      
      {/* Icon with animation */}
      <div className={`w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center text-3xl text-white shadow-lg bg-gradient-to-br ${gradient} group-hover:scale-110 transition-transform duration-300`}>
        <span className="group-hover:animate-bounce">{icon}</span>
      </div>
      
      {/* Title with gradient on hover */}
      <h4 className="text-xl font-bold text-center mb-2 group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-blue-300 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300">{title}</h4>
      
      {/* Description */}
      <p className="text-sm text-white/80 text-center mb-4">{children}</p>
      
      {/* Features list */}
      <ul className="text-xs text-white/70 space-y-2 mb-5 bg-white/5 rounded-xl p-3">
        <li className="flex items-center gap-2">
          <span className="text-emerald-400 group-hover:scale-125 transition-transform">✓</span> 
          <span className="group-hover:text-white transition-colors">Secure</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="text-emerald-400 group-hover:scale-125 transition-transform">✓</span> 
          <span className="group-hover:text-white transition-colors">Fast</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="text-emerald-400 group-hover:scale-125 transition-transform">✓</span> 
          <span className="group-hover:text-white transition-colors">Reliable</span>
        </li>
      </ul>
      
      {/* Button */}
      <div className="flex justify-center">
        <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-white/20 to-white/10 border border-white/20 text-sm group-hover:from-white/30 group-hover:to-white/20 group-hover:border-white/30 transition-all duration-300 shadow-md group-hover:shadow-lg">
          Open <span className="transition-transform group-hover:translate-x-1.5">→</span>
        </span>
      </div>
    </button>
  );
}


