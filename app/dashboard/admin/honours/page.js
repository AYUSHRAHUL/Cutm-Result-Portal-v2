"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminHonoursPage() {
  const router = useRouter();
  
  return (
    <div 
      className="min-h-screen pb-10"
      style={{
        background: "linear-gradient(to bottom, #F5F8FA 0%, #E8F4F8 50%, #D1E9F6 100%)",
      }}
    >
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 pt-6 sm:pt-8 lg:pt-12">
        {/* Header */}
        <div className="mb-6 sm:mb-8 text-center">
          <h2 
            className="text-2xl sm:text-3xl md:text-4xl font-black mb-2"
            style={{
              background: "linear-gradient(135deg, #05A3C7 0%, #04748F 50%, #023945 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            🎓 Honours Degree Management
          </h2>
          <p className="text-[#5A6C7D] text-sm sm:text-base font-medium">
            Manage domain subjects and check honours students
          </p>
        </div>
        
        {/* Management Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Honours Degree Management */}
          <div 
            className="rounded-xl sm:rounded-2xl border-2 p-4 sm:p-5 lg:p-6 shadow-lg transition-all hover:shadow-xl hover:-translate-y-1"
            style={{ borderColor: "rgba(5,163,199,0.2)", background: "white" }}
          >
            <h2 className="text-lg sm:text-xl font-black text-[#1A1F29] mb-3 sm:mb-4 flex items-center gap-2">
              📚 Honours Degree Management
            </h2>
            <p className="text-[#5A6C7D] mb-4 text-xs sm:text-sm">
              Manage domain subjects for honours degree programs. Add, edit, and delete domain subjects with their codes, names, and credits.
            </p>
            <div className="flex flex-col gap-2 sm:gap-3">
              <button
                onClick={() => router.push("/dashboard/admin/honours/management")}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95 min-h-[44px]"
                style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
              >
                📚 Manage Domain Subjects
              </button>
            </div>
            <ul 
              className="text-[10px] sm:text-xs space-y-1.5 sm:space-y-2 mt-4 rounded-lg p-2 sm:p-3"
              style={{ background: "rgba(5,163,199,0.05)" }}
            >
              <li className="flex items-center gap-2 text-[#1A1F29]">
                <span className="text-green-500 text-sm">✓</span> 
                <span className="font-medium">Add Domain Subjects</span>
              </li>
              <li className="flex items-center gap-2 text-[#1A1F29]">
                <span className="text-green-500 text-sm">✓</span> 
                <span className="font-medium">Edit & Delete Subjects</span>
              </li>
              <li className="flex items-center gap-2 text-[#1A1F29]">
                <span className="text-green-500 text-sm">✓</span> 
                <span className="font-medium">Filter by Branch & Domain</span>
              </li>
            </ul>
          </div>

          {/* Check for Honours Student */}
          <div 
            className="rounded-xl sm:rounded-2xl border-2 p-4 sm:p-5 lg:p-6 shadow-lg transition-all hover:shadow-xl hover:-translate-y-1"
            style={{ borderColor: "rgba(5,163,199,0.2)", background: "white" }}
          >
            <h2 className="text-lg sm:text-xl font-black text-[#1A1F29] mb-3 sm:mb-4 flex items-center gap-2">
              👥 Check for Honours Student
            </h2>
            <p className="text-[#5A6C7D] mb-4 text-xs sm:text-sm">
              View and manage the honours student list. Add students to honours program, check their status, and manage honours student records.
            </p>
            <div className="flex flex-col gap-2 sm:gap-3">
              <button
                onClick={() => router.push("/dashboard/admin/honours/students")}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95 min-h-[44px]"
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
              >
                👥 Check Honours Students
              </button>
            </div>
            <ul 
              className="text-[10px] sm:text-xs space-y-1.5 sm:space-y-2 mt-4 rounded-lg p-2 sm:p-3"
              style={{ background: "rgba(34,197,94,0.05)" }}
            >
              <li className="flex items-center gap-2 text-[#1A1F29]">
                <span className="text-green-500 text-sm">✓</span> 
                <span className="font-medium">View Honours Students</span>
              </li>
              <li className="flex items-center gap-2 text-[#1A1F29]">
                <span className="text-green-500 text-sm">✓</span> 
                <span className="font-medium">Add/Remove Students</span>
              </li>
              <li className="flex items-center gap-2 text-[#1A1F29]">
                <span className="text-green-500 text-sm">✓</span> 
                <span className="font-medium">Search & Filter Options</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Back Button */}
        <div className="text-center">
          <Link
            href="/dashboard/admin"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95"
            style={{ background: "linear-gradient(135deg, #6b7280, #4b5563)" }}
          >
            ← Back to Admin Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

