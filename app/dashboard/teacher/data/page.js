"use client";

import Link from "next/link";

import { useSearchParams } from "next/navigation";
import { appendSchoolParams } from "@/lib/api-helper";

export default function TeacherCBCSIndex() {
  const searchParams = useSearchParams();
  const school = searchParams.get('school');
  const isDiploma = school?.toUpperCase() === 'SOVET' || school?.toUpperCase()?.includes('VOCATIONAL');
  const title = isDiploma ? "SOVET Management" : "CBCS Management";
  return (
    <div className="min-h-screen text-gray-900 flex items-center justify-center bg-[linear-gradient(135deg,#667eea_0%,#764ba2_100%)] p-6">
      <div className="w-full max-w-xl rounded-3xl bg-white p-10 shadow-[0_20px_40px_rgba(0,0,0,0.1)] text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#2c3e50] mb-4">📚 {title}</h1>
        <p className="text-[#6c757d] mb-8 text-base leading-relaxed">Choose what you want to do with CBCS subjects</p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link href={appendSchoolParams("/dashboard/teacher/data/basket")} className="min-w-[180px] inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-white text-base font-semibold transition-transform hover:-translate-y-0.5 shadow-[0_10px_25px_rgba(102,126,234,0.4)]" style={{ background: "linear-gradient(45deg, #667eea, #764ba2)" }}>
            🗂️ View {isDiploma ? 'Subjects' : 'Baskets'}
          </Link>
          <Link href={appendSchoolParams("/dashboard/teacher/data/baskettrack")} className="min-w-[180px] inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-white text-base font-semibold transition-transform hover:-translate-y-0.5 shadow-[0_10px_25px_rgba(86,171,47,0.4)]" style={{ background: "linear-gradient(45deg, #56ab2f, #a8e6cf)" }}>
            📊 Track Progress
          </Link>
        </div>
        <div className="mt-8">
          <Link href={appendSchoolParams("/dashboard/teacher")} className="text-[#6c757d] hover:text-[#495057]">← Back to Teacher Dashboard</Link>
        </div>
      </div>
    </div>
  );
}