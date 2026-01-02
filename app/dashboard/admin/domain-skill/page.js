"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DomainSkillPage() {
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
                        🛠️ Domain & Skill Registration
                    </h2>
                    <p className="text-[#5A6C7D] text-sm sm:text-base font-medium">
                        Manage domain subjects and skill course registrations
                    </p>
                </div>

                {/* Management Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
                    {/* Domain Registration */}
                    <div
                        className="rounded-xl sm:rounded-2xl border-2 p-4 sm:p-5 lg:p-6 shadow-lg transition-all hover:shadow-xl hover:-translate-y-1"
                        style={{ borderColor: "rgba(5,163,199,0.2)", background: "white" }}
                    >
                        <h2 className="text-lg sm:text-xl font-black text-[#1A1F29] mb-3 sm:mb-4 flex items-center gap-2">
                            🌐 Domain subjects
                        </h2>
                        <p className="text-[#5A6C7D] mb-4 text-xs sm:text-sm">
                            Manage student registrations for domain subjects. View registered students, assign domains, and track progress.
                        </p>
                        <div className="flex flex-col gap-2 sm:gap-3">
                            <button
                                onClick={() => router.push("/dashboard/admin/domain-skill/domain")}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95 min-h-[44px]"
                                style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                            >
                                Access Domain List
                            </button>
                        </div>
                        <ul
                            className="text-[10px] sm:text-xs space-y-1.5 sm:space-y-2 mt-4 rounded-lg p-2 sm:p-3"
                            style={{ background: "rgba(5,163,199,0.05)" }}
                        >
                            <li className="flex items-center gap-2 text-[#1A1F29]">
                                <span className="text-green-500 text-sm">✓</span>
                                <span className="font-medium">Register Students for Domains</span>
                            </li>
                            <li className="flex items-center gap-2 text-[#1A1F29]">
                                <span className="text-green-500 text-sm">✓</span>
                                <span className="font-medium">View Domain Lists</span>
                            </li>
                        </ul>
                    </div>

                    {/* Skill Course Registration */}
                    <div
                        className="rounded-xl sm:rounded-2xl border-2 p-4 sm:p-5 lg:p-6 shadow-lg transition-all hover:shadow-xl hover:-translate-y-1"
                        style={{ borderColor: "rgba(5,163,199,0.2)", background: "white" }}
                    >
                        <h2 className="text-lg sm:text-xl font-black text-[#1A1F29] mb-3 sm:mb-4 flex items-center gap-2">
                            ⚡ Skill Course
                        </h2>
                        <p className="text-[#5A6C7D] mb-4 text-xs sm:text-sm">
                            Manage skill course enrollments. Assign skill courses to students and monitor their registration status.
                        </p>
                        <div className="flex flex-col gap-2 sm:gap-3">
                            <button
                                onClick={() => router.push("/dashboard/admin/domain-skill/skill")}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95 min-h-[44px]"
                                style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
                            >
                                Access Skill Course Link
                            </button>
                        </div>
                        <ul
                            className="text-[10px] sm:text-xs space-y-1.5 sm:space-y-2 mt-4 rounded-lg p-2 sm:p-3"
                            style={{ background: "rgba(245,158,11,0.05)" }}
                        >
                            <li className="flex items-center gap-2 text-[#1A1F29]">
                                <span className="text-green-500 text-sm">✓</span>
                                <span className="font-medium">Enroll in Skill Courses</span>
                            </li>
                            <li className="flex items-center gap-2 text-[#1A1F29]">
                                <span className="text-green-500 text-sm">✓</span>
                                <span className="font-medium">Track Skill Registrations</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Student Analytics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
                    {/* Student Domain Analytics */}
                    <div
                        className="rounded-xl sm:rounded-2xl border-2 p-4 sm:p-5 lg:p-6 shadow-lg transition-all hover:shadow-xl hover:-translate-y-1"
                        style={{ borderColor: "rgba(37,99,235,0.2)", background: "white" }}
                    >
                        <h2 className="text-lg sm:text-xl font-black text-[#1A1F29] mb-3 sm:mb-4 flex items-center gap-2">
                            📊 Student Domain Data
                        </h2>
                        <p className="text-[#5A6C7D] mb-4 text-xs sm:text-sm">
                            Monitor student domain registration data. Filter by branch, batch, and semester to see registration counts.
                        </p>
                        <div className="flex flex-col gap-2 sm:gap-3">
                            <button
                                onClick={() => router.push("/dashboard/admin/domain-skill/student-domain")}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95 min-h-[44px]"
                                style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)" }}
                            >
                                View Domain student List
                            </button>
                        </div>
                    </div>

                    {/* Student Skill Analytics */}
                    <div
                        className="rounded-xl sm:rounded-2xl border-2 p-4 sm:p-5 lg:p-6 shadow-lg transition-all hover:shadow-xl hover:-translate-y-1"
                        style={{ borderColor: "rgba(147,51,234,0.2)", background: "white" }}
                    >
                        <h2 className="text-lg sm:text-xl font-black text-[#1A1F29] mb-3 sm:mb-4 flex items-center gap-2">
                            📈 Student Skill Data
                        </h2>
                        <p className="text-[#5A6C7D] mb-4 text-xs sm:text-sm">
                            Monitor student skill course enrollments. Filter by batch, branch, and period to track skill adoption.
                        </p>
                        <div className="flex flex-col gap-2 sm:gap-3">
                            <button
                                onClick={() => router.push("/dashboard/admin/domain-skill/student-skill")}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95 min-h-[44px]"
                                style={{ background: "linear-gradient(135deg, #9333ea, #7e22ce)" }}
                            >
                                View Skill student List
                            </button>
                        </div>
                    </div>

                    {/* Domain, Skill & Basket Report */}
                    <div
                        className="rounded-xl sm:rounded-2xl border-2 p-4 sm:p-5 lg:p-6 shadow-lg transition-all hover:shadow-xl hover:-translate-y-1 md:col-span-2"
                        style={{ borderColor: "rgba(239,68,68,0.2)", background: "white" }}
                    >
                        <h2 className="text-lg sm:text-xl font-black text-[#1A1F29] mb-3 sm:mb-4 flex items-center gap-2">
                            🚀 Domain, Skill & Basket Report
                        </h2>
                        <p className="text-[#5A6C7D] mb-4 text-xs sm:text-sm">
                            Comprehensive report for Baskets (1-5), Skills, and Domains. View student enrollments across all categories in one place.
                        </p>
                        <div className="flex flex-col gap-2 sm:gap-3">
                            <button
                                onClick={() => router.push("/dashboard/admin/domain-skill/unified-analytics")}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95 min-h-[44px]"
                                style={{ background: "linear-gradient(135deg, #ef4444, #b91c1c)" }}
                            >
                                Open Report Dashboard
                            </button>
                        </div>
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
