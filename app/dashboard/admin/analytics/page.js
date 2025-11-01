"use client";

import AnalyticsDashboard from "@/components/AnalyticsDashboard";

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_30%,rgba(59,130,246,0.15),transparent_50%),radial-gradient(circle_at_80%_30%,rgba(16,185,129,0.12),transparent_50%),radial-gradient(circle_at_40%_70%,rgba(245,158,11,0.10),transparent_50%),radial-gradient(circle_at_60%_80%,rgba(139,92,246,0.12),transparent_50%),radial-gradient(circle_at_90%_10%,rgba(236,72,153,0.08),transparent_50%)]">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 h-1.5 bg-gradient-to-r from-blue-500 via-emerald-500 to-blue-500 z-40 animate-pulse" style={{ width: "100%", opacity: 0.2 }} />

      {/* Header */}
      {/* <section className="pt-16 pb-8 text-center">
        <div className="mx-auto max-w-5xl px-6">
          <div className="w-28 h-28 rounded-full mx-auto mb-6 flex items-center justify-center text-white text-4xl shadow-[0_0_40px_rgba(59,130,246,0.5)] bg-gradient-to-br from-blue-500 to-blue-600 relative overflow-hidden hover:scale-105 transition-transform duration-300">
            <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent,rgba(255,255,255,0.3),transparent)] animate-[spin_4s_linear_infinite]" />
            <span className="relative animate-bounce">📊</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-white via-blue-300 to-emerald-300 bg-clip-text text-transparent tracking-tight hover:scale-105 transition-transform duration-300">
            Analytics Dashboard
          </h1>
          <p className="mt-3 text-blue-100/90 max-w-xl mx-auto">Comprehensive data visualization and insights from CUTM Result Portal</p>
          <div className="mt-5 inline-flex items-center gap-2 px-5 py-2 rounded-full border border-emerald-500/40 text-emerald-300 text-sm backdrop-blur-sm shadow-lg hover:shadow-emerald-500/20 hover:border-emerald-500/60 transition-all duration-300">
            <span className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse" /> Real-time Analytics
          </div>
        </div>
      </section> */}

      {/* Analytics Content */}
      <section className="py-8">
        <div className="mx-auto max-w-7xl px-6">
          <AnalyticsDashboard />
        </div>
      </section>

      {/* Scroll to top */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-transform hover:-translate-y-0.5"
        aria-label="Scroll to top"
      >
        ↑
      </button>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
