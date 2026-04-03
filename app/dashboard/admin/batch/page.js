"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSchoolAndCampus } from "@/lib/api-helper";

function BatchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Get school from URL params or localStorage
    const urlSchool = searchParams.get('school');
    const { school: lsSchool } = getSchoolAndCampus();
    const school = urlSchool || lsSchool;

    // Normalize school value
    const schoolLower = school ? String(school).toLowerCase() : null;
    
    // Redirect to school-specific page
    if (schoolLower === 'soet' || schoolLower === 'soe') {
      const campus = searchParams.get('campus') || 'pkd';
      router.replace(`/dashboard/admin/batch/soet?school=SOET&campus=${campus}`);
    } else if (schoolLower === 'sovet' || schoolLower === 'sov') {
      const campus = searchParams.get('campus') || 'pkd';
      router.replace(`/dashboard/admin/batch/sovet?school=SOVET&campus=${campus}`);
    } else if (schoolLower === 'som' || schoolLower === 'soms') {
      const campus = searchParams.get('campus') || 'pkd';
      router.replace(`/dashboard/admin/batch/som?school=SOM&campus=${campus}`);
    } else {
      // Default to SOET if no school specified
      const campus = searchParams.get('campus') || 'pkd';
      router.replace(`/dashboard/admin/batch/soet?school=SOET&campus=${campus}`);
    }
  }, [router, searchParams]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading batch page...</p>
      </div>
    </div>
  );
}

export default function AdminBatchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading batch page...</p>
        </div>
      </div>
    }>
      <BatchContent />
    </Suspense>
  );
}
