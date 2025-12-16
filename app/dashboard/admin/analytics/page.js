"use client";

import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import { Suspense } from "react";

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_30%,rgba(59,130,246,0.15),transparent_50%),radial-gradient(circle_at_80%_30%,rgba(16,185,129,0.12),transparent_50%),radial-gradient(circle_at_40%_70%,rgba(245,158,11,0.10),transparent_50%),radial-gradient(circle_at_60%_80%,rgba(139,92,246,0.12),transparent_50%),radial-gradient(circle_at_90%_10%,rgba(236,72,153,0.08),transparent_50%)]">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 h-1.5 bg-gradient-to-r from-blue-500 via-emerald-500 to-blue-500 z-40 animate-pulse" style={{ width: "100%", opacity: 0.2 }} />

 

      {/* Analytics Content */}
      <section className="py-8">
        <div className="mx-auto max-w-7xl px-6">
          <Suspense fallback={<div className="text-center text-sm text-gray-500 py-4">Loading analytics...</div>}>
            <AnalyticsDashboard />
          </Suspense>
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
