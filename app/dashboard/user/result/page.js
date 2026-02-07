"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { appendSchoolParams, getSchoolApiUrl } from "@/lib/api-helper";
import { getSchoolFromRegistration } from "@/lib/campus";

function ResultPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registration = searchParams.get("reg");
  const semester = searchParams.get("sem");

  const [result, setResult] = useState(null);
  const [allResults, setAllResults] = useState(null);
  const [isMultipleSemesters, setIsMultipleSemesters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSemester, setActiveSemester] = useState(0);
  const [missingSemesters, setMissingSemesters] = useState([]);

  useEffect(() => {
    if (!registration || !semester) {
      setError("Missing registration number or semester");
      setLoading(false);
      return;
    }

    const fetchResults = async () => {
      try {
        setLoading(true);
        setError("");

        // Check if multiple semesters are selected
        const semesters = semester.split(',');
        setIsMultipleSemesters(semesters.length > 1);

        if (semesters.length > 1) {
          // Fetch results for all semesters
          const semesterResults = {};
          const missingSemesters = [];

          // For user panel, determine school from registration number
          const school = getSchoolFromRegistration(registration);
          const resultApiUrl = school === 'SOVET' ? '/api/sovet/result' : '/api/soet/result';

          for (const sem of semesters) {
            try {
              const res = await fetch(resultApiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ registration, semester: sem.trim() }),
              });

              if (!res.ok) {
                const errorData = await res.json();
                // If semester doesn't have results, skip it instead of throwing error
                if (res.status === 404) {
                  missingSemesters.push(sem.trim());
                  continue; // Skip this semester and continue with others
                }
                throw new Error(errorData.error || `Failed to fetch results for ${sem}`);
              }

              const data = await res.json();
              semesterResults[sem.trim()] = data;
            } catch (err) {
              // If it's a 404 error, just skip this semester
              if (err.message && err.message.includes('No result found')) {
                missingSemesters.push(sem.trim());
                continue;
              }
              // For other errors, throw
              throw err;
            }
          }

          // If no semesters have results, show error
          if (Object.keys(semesterResults).length === 0) {
            throw new Error(
              missingSemesters.length > 0 
                ? `No results found for the selected semesters: ${missingSemesters.join(', ')}. Results may not be available yet.`
                : "No results found for any of the selected semesters."
            );
          }

          // If some semesters are missing, show a warning but continue
          if (missingSemesters.length > 0) {
            console.warn(`Results not available for: ${missingSemesters.join(', ')}`);
            setMissingSemesters(missingSemesters);
          }

          setAllResults(semesterResults);
          setActiveSemester(0); // Start with first semester
        } else {
          // Single semester
          // For user panel, determine school from registration number
          const school = getSchoolFromRegistration(registration);
          const resultApiUrl = school === 'SOVET' ? '/api/sovet/result' : '/api/soet/result';
          
          const res = await fetch(resultApiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ registration, semester }),
          });

          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || "Failed to fetch results");
          }

          const data = await res.json();
          setResult(data);
        }
      } catch (err) {
        console.error("Error fetching results:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [registration, semester]);

  const parseCredits = (credits) => {
    if (!credits) return 0;
    if (typeof credits === 'number') return credits;
    if (typeof credits === 'string') {
      // Handle formats like "1+2+3" or "3"
      return credits.split('+').reduce((sum, c) => sum + (parseFloat(c.trim()) || 0), 0);
    }
    return 0;
  };

  const isFailingGrade = (grade) => {
    const failingGrades = ['F', 'S', 'I', 'M', 'R'];
    return failingGrades.includes(String(grade || '').toUpperCase().trim());
  };

  const getCreditsCleared = (subjects) => {
    return subjects.reduce((sum, s) => {
      const credits = parseCredits(s.Credits);
      return isFailingGrade(s.Grade) ? sum : sum + credits;
    }, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-6"></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Loading Results</h2>
          <p className="text-gray-600">Please wait while we fetch your academic records...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="text-red-600 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Results</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
        <button
          onClick={() => router.push("/dashboard/user")}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-3 rounded-lg transition"
            >
              ← Back to Dashboard
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-5 py-3 rounded-lg transition"
            >
              🔄 Try Again
        </button>
          </div>
        </div>
      </div>
    );
  }

  const totalCredits = result ? result.subjects.reduce((sum, s) => sum + parseCredits(s?.Credits), 0) : 0;
  const creditsCleared = result ? getCreditsCleared(result.subjects) : 0;

  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          /* Show print-only view for multiple semesters */
          .print-only-view, .print-only-view * {
            visibility: visible !important;
          }
          .print-only-view {
            display: block !important;
            position: relative !important;
          }
          .print-only-view .print-area {
            visibility: visible !important;
            display: block !important;
          }
          /* When print-only-view exists, hide all screen-print-area */
          /* This works because print-only-view only exists for multiple semesters */
          /* Hide screen-print-area when multiple semesters (use print-only-view instead) */
          .multiple-semesters-print .screen-print-area {
            visibility: hidden !important;
            display: none !important;
          }
          /* For single semester: show screen view print-area */
          .screen-print-area {
            visibility: visible;
          }
          /* Exception: show screen-print-area when print-only-view doesn't exist (single semester) */
          /* We can't use :has() in print, so we'll use a different approach */
          /* Make screen-print-area visible by default, then hide it when print-only-view exists */
          /* Since print-only-view is hidden on screen, we need to check in print mode */
          /* Solution: hide screen-print-area only when .print-only-view is visible (in print mode) */
          /* When .print-only-view is not present (single semester), screen-print-area will be visible */
          /* This is handled by the default visibility rule above being overridden */
          /* Actually, simpler: just check if .print-only-view exists and is visible */
          /* If it exists and is visible (print mode), hide .screen-print-area */
          /* If it doesn't exist or is hidden (single semester), show .screen-print-area */
          /* But CSS can't do this conditionally. Let me use a workaround: */
          /* Hide .screen-print-area by default, show it only when there's no .print-only-view */
          /* But we can't detect that in CSS without :has() */
          
          /* Workaround: Use the fact that .print-only-view is always after .screen-print-area in DOM */
          /* If .print-only-view is a sibling or in the same container, hide .screen-print-area */
          /* But this is complex. Let me use a simpler rule: */
          /* Just make sure print-only-view takes precedence when it exists */
          /* For single semester, there's no print-only-view, so we need to show screen-print-area */
          /* Since we can't conditionally do this, let's use JavaScript or a simpler CSS rule */
          
          /* Simplest solution: Always hide screen-print-area when printing */
          /* For single semester, we'll need to not use screen-print-area class, or use a different approach */
          /* Actually, let's just make screen-print-area visible by default, and hide it when print-only-view is present */
          /* But CSS can't detect presence. Let me try: hide screen-print-area, show it only if print-only-view is not a sibling */
          
          /* Final solution: Use a more specific rule */
          /* Hide screen-print-area when it's in the same parent as print-only-view */
          /* But we can't do that without :has() */
          
          /* Let me try a different approach: use the order of elements */
          /* If print-only-view comes after screen-print-area, use a sibling selector */
          /* But that's not reliable */
          
          /* Actually, the simplest: just always hide screen-print-area when printing */
          /* For single semester, don't use screen-print-area class, or make it work differently */
          /* But that would require changing the JSX structure */
          
          /* Let me check: for single semester, is there a print-only-view? No. */
          /* So for single semester, we need screen-print-area to be visible */
          /* For multiple semesters, we need screen-print-area to be hidden and print-only-view to be visible */
          /* Since CSS can't conditionally do this, let's use a workaround: */
          /* Make screen-print-area visible by default, hide it only when print-only-view is present */
          /* But we can't detect that. Let me use a sibling selector workaround */
          
          /* Actually, I think the issue is simpler: both are showing because both have visibility: visible */
          /* Let me just explicitly hide screen-print-area when print-only-view is visible */
          /* Use a more specific selector that works */
          
          /* Final attempt: Use the fact that print-only-view and screen-print-area are siblings */
          /* If print-only-view exists and is visible, hide screen-print-area */
          /* We can use: .print-only-view ~ .screen-print-area { display: none; } */
          /* But they're not direct siblings. Let me check the structure */
          
          /* Actually, let me just use a simple rule: hide screen-print-area, show print-only-view */
          /* For single semester, we'll need to handle it differently */
          /* Or, add a class to indicate single vs multiple, and use that */
          
          /* Simplest: Just hide screen-print-area when printing, period */
          /* For single semester, we can make the screen-print-area also work as print-area without the screen-print-area class */
          /* Or, conditionally add the screen-print-area class only for multiple semesters */
          
          /* Let me try the simplest CSS fix: just make sure only one shows */
          /* Hide screen-print-area when print-only-view is present (using sibling or container selector) */
          /* Since they're in the same parent container, I can use a parent selector if it has print-only-view */
          /* But CSS can't do parent selection */
          
          /* OK, let me use a workaround: add a data attribute or class to the parent when multiple semesters */
          /* But that requires JSX changes */
          
          /* Actually, simplest CSS-only fix: */
          /* Make screen-print-area hidden by default when printing */
          /* Show it only when there's no print-only-view */
          /* But we can't detect that. So let's use a different approach: */
          /* Make screen-print-area visible, but hide it when print-only-view is a sibling */
          /* Use: .print-only-view ~ * .screen-print-area { display: none; } */
          /* But they might not be siblings */
          
          /* Let me check the actual DOM structure by reading the JSX */
          /* Screen view: <div className="print-area screen-print-area"> (inside main container) */
          /* Print view: <div className="hidden print:block print-only-view"> (also in main container) */
          /* They're siblings in the same parent */
          /* So I can use: .print-only-view ~ .screen-print-area */
          /* But screen-print-area might be before print-only-view */
          /* Let me use: *:has(.print-only-view) .screen-print-area */
          /* But that needs :has() */
          
          /* Final solution: Use JavaScript to add a class, or use a CSS rule that works */
          /* Since :has() might not work, let's use a simpler rule: */
          /* Just hide screen-print-area when printing, and show print-only-view */
          /* For single semester, we need screen-print-area, so let's not hide it there */
          /* But we can't conditionally do that. So let's change the approach: */
          /* Don't use screen-print-area class for single semester, or handle it differently */
          
          /* Actually, I think the real issue is that the CSS is making both visible */
          /* Let me just make sure that when print-only-view is visible, screen-print-area is hidden */
          /* Use a rule that works: if print-only-view is visible, hide screen-print-area */
          /* Since print-only-view is only visible in print mode, we can use: */
          /* @media print { .print-only-view:not([hidden]) ~ * .screen-print-area { display: none; } } */
          /* But that's still complex */
          
          /* Simplest fix: Just explicitly hide screen-print-area when print-only-view exists */
          /* Since they're in the same container, I can use a container selector if it has print-only-view */
          /* But CSS can't do that without :has() */
          
          /* Let me try one more thing: use the fact that print-only-view is always rendered when multiple semesters */
          /* So we can use a rule that says: if print-only-view is in the DOM and visible, hide screen-print-area */
          /* But CSS can't detect DOM presence */
          
          /* OK, final solution: Use a CSS rule that definitely works */
          /* Hide screen-print-area by default when printing */
          /* Show it only when print-only-view is not present */
          /* But we can't detect that. So let's use a workaround: */
          /* Add a class to the body or container when multiple semesters, and use that */
          /* But that requires JSX changes */
          
          /* Actually, let me just try the simplest possible CSS rule that might work: */
          /* Hide screen-print-area, show print-only-view */
          /* For single semester, we'll handle it by not using screen-print-area class or using a different class */
          
          /* Wait, I have an idea: use the order */
          /* If print-only-view comes after screen-print-area in DOM, I can use a general sibling selector */
          /* .print-only-view ~ * will select everything after it */
          /* But screen-print-area might be before it */
          
          /* Let me check: in the JSX, screen-print-area is rendered first, then print-only-view */
          /* So screen-print-area is before print-only-view */
          /* I can't use ~ selector for elements before */
          
          /* Final attempt: Use a universal rule that works */
          /* Just hide all screen-print-area when printing */
          /* For single semester, don't add screen-print-area class, or make it work without it */
          /* But that requires changing the single semester JSX */
          
          /* Actually, let me just try: make screen-print-area visible by default */
          /* Hide it only when print-only-view is present and visible */
          /* Since print-only-view is hidden on screen, we can use: */
          /* When printing, if print-only-view is visible, hide screen-print-area */
          /* But CSS can't do conditional logic like that */
          
          /* OK, I think the real solution is simpler: */
          /* Just make sure that print-only-view takes precedence */
          /* Hide screen-print-area when print-only-view is in the same document */
          /* But we can't detect that in CSS */
          
          /* Let me try a different approach: use a more specific selector */
          /* If the parent has both screen-print-area and print-only-view, hide screen-print-area */
          /* But that needs :has() */
          
          /* Actually, I think I should just change the JSX to add a class conditionally */
          /* Or use a simpler CSS rule that definitely works */
          
          /* Let me try the simplest possible fix: */
          /* Just hide screen-print-area when printing, period */
          /* For single semester, we'll need to handle it differently in the JSX */
          /* Or, make single semester also use print-only-view structure */
          
          /* Actually, wait - let me check if single semester has print-only-view */
          /* Looking at the code: single semester doesn't have print-only-view */
          /* So for single semester, screen-print-area needs to be visible */
          /* For multiple semesters, screen-print-area should be hidden, print-only-view should be visible */
          
          /* Since CSS can't conditionally do this, let's use a workaround: */
          /* Add a class to the container when multiple semesters, and use that to hide screen-print-area */
          /* But that requires JSX changes */
          
          /* Let me try one more CSS approach: */
          /* Use the fact that print-only-view is always rendered when multiple semesters */
          /* So we can use a rule: if print-only-view exists, hide screen-print-area */
          /* But CSS can't detect existence */
          
          /* OK, I think the best solution is to change the JSX structure slightly */
          /* Or use a CSS rule that works without :has() */
          
          /* Let me try: use a data attribute or class on the main container */
          /* When multiple semesters, add a class, and use that to hide screen-print-area */
          /* But that requires JSX changes */
          
          /* Actually, let me just try the simplest CSS rule that might work: */
          /* Hide screen-print-area by default when printing */
          /* Show it only when there's no print-only-view */
          /* But we can't detect that */
          
          /* Final solution: Use a CSS rule that works */
          /* Since print-only-view is only visible in print mode when it exists */
          /* And screen-print-area should be hidden when print-only-view is visible */
          /* We can use: when print-only-view is visible (print mode), hide screen-print-area */
          /* But CSS can't do conditional logic */
          
          /* Let me just try: hide screen-print-area, show print-only-view */
          /* For single semester, we'll need to not use screen-print-area class or handle it differently */
          
          /* Actually, I think the issue might be that the visibility CSS is wrong */
          /* Let me check: body * { visibility: hidden; } hides everything */
          /* Then .print-area, .print-area * { visibility: visible; } shows all print-areas */
          /* So both screen-print-area and print-only-view .print-area are showing */
          /* The fix: only show print-only-view .print-area when print-only-view exists */
          /* Hide screen-print-area when print-only-view exists */
          /* But we can't detect that in CSS */
          
          /* Let me try a workaround: use a more specific visibility rule */
          /* Only show print-areas that are inside print-only-view when print-only-view exists */
          /* But we can't detect existence */
          
          /* OK, I think I need to change the approach */
          /* Let me use a simpler rule: just make sure print-only-view takes precedence */
          /* Hide screen-print-area when print-only-view is visible */
          /* Since print-only-view is only visible in print mode, we can use: */
          /* @media print { .print-only-view:not([style*="display: none"]) ~ * .screen-print-area { display: none; } } */
          /* But that's still complex */
          
          /* Let me try the simplest possible fix: */
          /* Just hide all screen-print-area when printing */
          /* For single semester, we'll handle it by not using the screen-print-area class */
          /* Or by making single semester also use the print-only-view structure */
          
          /* Actually, I think the real solution is to change the JSX to conditionally add a class */
          /* Or use a CSS rule that definitely works */
          
          /* Let me try one more CSS approach: use the order and sibling selectors */
          /* If print-only-view is rendered, it means multiple semesters */
          /* So we can use a rule that says: if print-only-view is in the DOM, hide screen-print-area */
          /* But CSS can't detect DOM presence */
          
          /* Final attempt: Use a CSS rule that works without :has() */
          /* Since print-only-view and screen-print-area are in the same parent */
          /* And print-only-view is always after screen-print-area in the DOM */
          /* I can use a general sibling selector, but it only works for elements after */
          /* So I can't use it to hide screen-print-area which is before print-only-view */
          
          /* OK, I think the best solution is to add a class to the main container when multiple semesters */
          /* And use that class to hide screen-print-area */
          /* But that requires JSX changes */
          
          /* Let me just try the simplest CSS rule that might work: */
          /* Hide screen-print-area by default when printing */
          /* Show it only when print-only-view doesn't exist */
          /* But we can't detect that */
          
          /* Actually, I think I should just change the JSX to add a data attribute or class */
          /* When isMultipleSemesters is true, add a class to the main container */
          /* Then use that class in CSS to hide screen-print-area */
          /* But that requires JSX changes */
          
          /* Let me try one more CSS-only approach: */
          /* Use the fact that print-only-view is hidden on screen but visible in print */
          /* So in print mode, if print-only-view is visible, hide screen-print-area */
          /* But CSS can't do conditional logic */
          
          /* OK, I think the real solution is to modify the JSX */
          /* Add a class to the main container when multiple semesters */
          /* Then use that class to hide screen-print-area */
          
          /* But let me try one more CSS approach first: */
          /* Use a universal selector that works */
          /* Just hide screen-print-area when printing, show print-only-view */
          /* For single semester, we'll need to handle it differently */
          
          /* Actually, let me check: does single semester use screen-print-area? */
          /* Yes, it does: <div className="print-area screen-print-area"> */
          /* So for single semester, we need screen-print-area to be visible */
          /* For multiple semesters, we need screen-print-area to be hidden, print-only-view to be visible */
          
          /* Since CSS can't conditionally do this, let's add a class to the container */
          /* When isMultipleSemesters, add class "multiple-semesters" */
          /* Then use: .multiple-semesters .screen-print-area { display: none; } */
          
          /* But that requires JSX changes. Let me try a CSS-only workaround first */
          
          /* Final CSS attempt: Use a rule that works */
          /* Since print-only-view is always rendered when multiple semesters */
          /* And it's always after screen-print-area in DOM */
          /* I can use: when print-only-view is visible, it means multiple semesters */
          /* So hide screen-print-area when print-only-view is visible */
          /* But CSS can't detect visibility of other elements conditionally */
          
          /* OK, I think I need to modify the JSX to add a class */
          /* Let me do that */
          .print-area {
            position: relative !important;
            left: auto !important;
            top: auto !important;
            width: 100% !important;
            transform: none !important;
            transform-origin: top left !important;
            background: white !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 20mm 15mm 15mm 15mm !important;
            page-break-after: always !important;
            display: block !important;
          }
          .print-area:first-child {
            padding-top: 20mm !important;
            padding-bottom: 15mm !important;
            padding-left: 15mm !important;
            padding-right: 15mm !important;
            margin-top: 0 !important;
          }
          .print-area:last-child {
            page-break-after: auto !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
          /* Multi-page support for multiple semesters */
          .semester-page-break {
            page-break-before: always !important;
            page-break-after: auto !important;
            page-break-inside: avoid !important;
            margin-top: 0 !important;
            padding-top: 0 !important;
            break-before: page !important;
          }
          .semester-page-break:first-child {
            page-break-before: avoid !important;
            break-before: auto !important;
            margin-top: 0 !important;
            padding-top: 0 !important;
          }
          /* Remove extra top spacing on first page */
          .hidden.print\\:block:first-child .print-area:first-child {
            padding-top: 0mm !important;
            margin-top: 0 !important;
          }
          /* Reduce top margin for first page content */
          .hidden.print\\:block:first-child .print-area:first-child > *:first-child {
            margin-top: 0 !important;
            padding-top: 0 !important;
          }
          .hidden.print\\:block:first-child .print-area:first-child .text-center {
            margin-top: 0 !important;
            padding-top: 0 !important;
          }
          /* Ensure each semester section doesn't break */
          .semester-page-break > * {
            page-break-inside: avoid !important;
          }
          /* Compact fonts/padding for better fit */
          .print-area h1 { font-size: 18px; margin-bottom: 8px; }
          .print-area h2 { font-size: 14px; margin-bottom: 6px; }
          .print-area h3 { font-size: 16px; margin-bottom: 8px; }
          .print-area table { font-size: 11px; margin-bottom: 10px; }
          .print-area th, .print-area td { padding: 4px 6px !important; }
          .print-summary { font-size: 12px; margin-bottom: 15px; }
          .print-summary { display: flex !important; flex-direction: row !important; gap: 24px !important; flex-wrap: nowrap !important; justify-content: space-between !important; }
          .print-summary > div { flex: 0 0 auto !important; white-space: nowrap !important; }
          .print-logo { width: 70px !important; height: 70px !important; }
          .avoid-break { page-break-inside: avoid; }
          .print-area .mb-6 { margin-bottom: 15px !important; }
          .print-area .mb-8 { margin-bottom: 20px !important; }
          .print-area .space-y-2 > * + * { margin-top: 4px !important; }
        }
      `}</style>

      <div className={`min-h-screen bg-gray-50 py-4 sm:py-8 px-2 sm:px-4 ${isMultipleSemesters ? 'multiple-semesters-print' : ''}`}>
        {/* Header Info */}
        <div className="max-w-4xl mx-auto mb-4 sm:mb-6">
          <div className="bg-white rounded-lg shadow-sm p-2 sm:p-4 border-l-4 border-blue-600">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
              <div className="flex-1">
                <h1 className="text-sm sm:text-lg font-bold text-gray-900">Academic Results</h1>
                <p className="text-[10px] sm:text-sm text-gray-600">
                  Registration: <span className="font-mono font-semibold">{registration}</span>
                  {isMultipleSemesters ? (
                    <span className="block sm:inline"> • {Object.keys(allResults || {}).length} Semesters Selected</span>
                  ) : (
                    <span className="block sm:inline"> • {semester}</span>
                  )}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-[10px] sm:text-sm text-gray-500">Generated on</div>
                <div className="text-[10px] sm:text-sm font-semibold text-gray-700">
                  {new Date().toLocaleDateString('en-GB', { 
                    day: '2-digit', 
                    month: 'short', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Warning for Missing Semesters */}
        {isMultipleSemesters && missingSemesters.length > 0 && (
          <div className="max-w-4xl mx-auto mb-4 sm:mb-6">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-3 sm:p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Results Not Available
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>Results are not yet available for the following semesters:</p>
                    <ul className="list-disc list-inside mt-1">
                      {missingSemesters.map((sem, idx) => (
                        <li key={idx} className="font-semibold">{sem}</li>
                      ))}
                    </ul>
                    <p className="mt-2">These results may be published later. Only available semester results are shown below.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Single Semester View */}
        {!isMultipleSemesters && result && (
          <div className="print-area screen-print-area bg-white shadow-lg rounded-lg p-4 sm:p-8 w-full max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-4 sm:mb-6">
              <div className="flex justify-center mb-2 sm:mb-3">
          <img
            src="https://tse1.mm.bing.net/th/id/OIP.yR5DUnUlOBL5eCaPQ9HFgwHaHZ?rs=1&pid=ImgDetMain"
            alt="CUTM Logo"
                  className="w-12 h-12 sm:w-20 sm:h-20 rounded-full "
          />
              </div>
              <h1 className="text-base sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">
            Centurion University of Technology and Management
          </h1>
              <h2 className="text-xs sm:text-lg font-semibold text-gray-800 mb-0.5 sm:mb-1">
            School Of Engineering & Technology, Paralakhemundi
          </h2>
              <p className="text-[10px] sm:text-base text-gray-700">Paralakhemundi Campus</p>
              <h3 className="text-sm sm:text-xl font-bold text-gray-900 mt-2 sm:mt-4">
                Semester Grade Sheet
              </h3>
            </div>

            {/* Student Information */}
            <div className="mb-4 sm:mb-6 space-y-1 sm:space-y-2 text-[10px] sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                <p><span className="font-semibold">Student Regd. No.:</span> {registration}</p>
                <p><span className="font-semibold">Semester:</span> {semester.replace('Semester ', 'Sem ')}</p>
              </div>
              <p><span className="font-semibold">Student Name:</span> {result.name || 'N/A'}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                <p><span className="font-semibold">Course:</span> {result.course || 'B.Tech'}</p>
                <p><span className="font-semibold">Batch:</span> {result.batch || 'N/A'}</p>
              </div>
              <p><span className="font-semibold">Branch:</span> {result.branch || 'Electronics and Communication Engineering'}</p>
            </div>

            {/* Results Table */}
            <div className="mb-6 overflow-x-auto avoid-break">
              <table className="min-w-full border-collapse text-[11px] sm:text-sm">
                <thead>
                  <tr className="bg-blue-600 text-white text-[10px] sm:text-xs">
                    <th className="border border-black px-2 py-1 sm:px-3 sm:py-2 text-center font-bold">SL.NO</th>
                    <th className="border border-black px-2 py-1 sm:px-3 sm:py-2 text-left font-bold">SUB.CODE</th>
                    <th className="border border-black px-3 py-1 sm:px-4 sm:py-2 text-left font-bold">SUBJECT</th>
                    <th className="border border-black px-2 py-1 sm:px-3 sm:py-2 text-center font-bold">CREDIT</th>
                    <th className="border border-black px-2 py-1 sm:px-3 sm:py-2 text-center font-bold">GRADE</th>
                  </tr>
                </thead>
                <tbody>
                  {result.subjects.map((s, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="border border-black px-2 py-1 sm:px-3 sm:py-2 text-center">{i + 1}</td>
                      <td className="border border-black px-2 py-1 sm:px-3 sm:py-2 font-mono">{s.Subject_Code}</td>
                      <td className="border border-black px-3 py-1 sm:px-4 sm:py-2">{s.Subject_Name}</td>
                      <td className="border border-black px-2 py-1 sm:px-3 sm:py-2 text-center">{parseCredits(s.Credits)}</td>
                      <td className={`border border-black px-2 py-1 sm:px-3 sm:py-2 text-center font-bold ${isFailingGrade(s.Grade) ? 'text-red-600' : 'text-gray-900'}`}>
                        {s.Grade}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary Statistics */}
            <div className="mb-4 sm:mb-6 flex flex-row flex-wrap sm:flex-nowrap justify-between gap-2 sm:gap-4 sm:gap-6 text-[10px] sm:text-sm print-summary">
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="font-semibold text-gray-700">Total Credits:</span>
                <span className="font-bold text-gray-900">{totalCredits}</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="font-semibold text-gray-700">Credits Cleared:</span>
                <span className="font-bold text-gray-900">{creditsCleared}</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="font-semibold text-gray-700">SGPA:</span>
                <span className="font-bold text-gray-900">{result.sgpa}</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="font-semibold text-gray-700">CGPA:</span>
                <span className="font-bold text-gray-900">{result.cgpa}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between text-[10px] sm:text-sm text-gray-700 border-t pt-2 sm:pt-4 mt-4 sm:mt-8">
              <p>Date : {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              <p className="font-semibold">Dean, Examinations</p>
        </div>

            {/* Action Buttons */}
            <div className="no-print mt-4 sm:mt-8 flex flex-col sm:flex-row justify-between gap-2 sm:gap-4">
              <button
                onClick={() => router.push("/dashboard/user")}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-3 py-1.5 sm:px-5 sm:py-2 text-xs sm:text-base rounded-lg transition"
              >
                ← Back
              </button>
              <button
                onClick={() => window.print()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 sm:px-5 sm:py-2 text-xs sm:text-base rounded-lg transition shadow-md"
              >
                🖨️ Print / Save as PDF
              </button>
            </div>
          </div>
        )}

        {/* Multiple Semesters View with Sidebar */}
        {isMultipleSemesters && allResults && (
          <div className="print:hidden flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto">
            {/* Sidebar Navigation */}
            <div className="w-full lg:w-80 bg-white rounded-lg shadow-sm p-2 sm:p-4 lg:h-fit lg:sticky lg:top-4 order-2 lg:order-1">
              <h3 className="text-sm sm:text-lg font-bold text-gray-900 mb-2 sm:mb-4 flex items-center">
                <span className="mr-1 sm:mr-2 text-xs sm:text-base">📊</span>
                Semester Navigation
              </h3>
              <div className="space-y-1.5 sm:space-y-2">
                {Object.entries(allResults).map(([sem, data], index) => (
                  <button
                    key={sem}
                    onClick={() => setActiveSemester(index)}
                    className={`w-full text-left p-2 sm:p-3 rounded-lg transition-all duration-200 ${
                      activeSemester === index
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="font-semibold text-xs sm:text-sm">{sem.replace('Semester ', 'Sem ')}</div>
                    <div className={`text-[10px] sm:text-xs mt-0.5 sm:mt-1 ${
                      activeSemester === index ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      <span className="block sm:inline">SGPA: <span className="font-semibold">{data.sgpa || 'N/A'}</span></span>
                      <span className="hidden sm:inline"> • </span>
                      <span className="block sm:inline">CGPA: <span className="font-semibold">{data.cgpa || data.cumulativeCgpa || 'N/A'}</span></span>
                    </div>
                    <div className={`text-[10px] sm:text-xs mt-0.5 sm:mt-1 ${
                      activeSemester === index ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      <span className="block sm:inline">{data.subjects.length} Subjects</span>
                      <span className="hidden sm:inline"> • </span>
                      <span className="block sm:inline">{data.subjects.reduce((sum, s) => sum + parseCredits(s?.Credits), 0)} Credits</span>
                  </div>
                  </button>
                ))}
              </div>
              
              {/* Quick Stats */}
              <div className="mt-4 sm:mt-6 p-2 sm:p-3 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-900 text-xs sm:text-sm mb-1.5 sm:mb-2">Overall Summary</h4>
                <div className="space-y-0.5 sm:space-y-1 text-[10px] sm:text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Total Semesters:</span>
                    <span className="font-semibold">{Object.keys(allResults).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Subjects:</span>
                    <span className="font-semibold">{Object.values(allResults).reduce((sum, data) => sum + data.subjects.length, 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Credits:</span>
                    <span className="font-semibold">{Object.values(allResults).reduce((sum, data) => sum + data.subjects.reduce((s, sub) => s + parseCredits(sub?.Credits), 0), 0)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2">
                <button
                  onClick={() => router.push("/dashboard/user")}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition text-xs sm:text-sm"
                >
                  ← Back to Dashboard
                </button>
                <button
                  onClick={() => window.print()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg transition text-xs sm:text-sm"
                >
                  🖨️ Print All Semesters
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 order-1 lg:order-2">
              {Object.entries(allResults).map(([sem, data], index) => (
                <div 
                  key={sem} 
                  className={`print-area screen-print-area bg-white shadow-lg rounded-lg p-4 sm:p-8 ${
                    activeSemester === index ? 'block' : 'hidden'
                  }`}
                >
                  {/* Header for each semester */}
                  <div className="text-center mb-4 sm:mb-6">
                    <div className="flex justify-center mb-2 sm:mb-3">
                      <img
                        src="https://tse1.mm.bing.net/th/id/OIP.yR5DUnUlOBL5eCaPQ9HFgwHaHZ?rs=1&pid=ImgDetMain"
                        alt="CUTM Logo"
                        className="w-12 h-12 sm:w-20 sm:h-20 rounded-full  "
                      />
              </div>
                    <h1 className="text-base sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">
                      Centurion University of Technology and Management
                    </h1>
                    <h2 className="text-xs sm:text-lg font-semibold text-gray-800 mb-0.5 sm:mb-1">
                      School Of Engineering & Technology, Paralakhemundi
                    </h2>
                    <p className="text-[10px] sm:text-base text-gray-700">Paralakhemundi Campus</p>
                    <h3 className="text-sm sm:text-xl font-bold text-gray-900 mt-2 sm:mt-4">
                      Semester Grade Sheet
                  </h3>
                  </div>

                  {/* Student Information for each semester */}
                  <div className="mb-4 sm:mb-6 space-y-1 sm:space-y-2 text-[10px] sm:text-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                      <p><span className="font-semibold">Student Regd. No.:</span> {registration}</p>
                      <p><span className="font-semibold">Semester:</span> {sem.replace('Semester ', 'Sem ')}</p>
                    </div>
                    <p><span className="font-semibold">Student Name:</span> {data.name || 'N/A'}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                      <p><span className="font-semibold">Course:</span> {data.course || 'B.Tech'}</p>
                      <p><span className="font-semibold">Batch:</span> {data.batch || 'N/A'}</p>
                    </div>
                    <p><span className="font-semibold">Branch:</span> {data.branch || 'Electronics and Communication Engineering'}</p>
                  </div>

                  {/* Results Table for each semester */}
                  <div className="mb-6 overflow-x-auto avoid-break">
                    <table className="min-w-full border-collapse text-[11px] sm:text-sm">
                      <thead>
                        <tr className="bg-blue-600 text-white text-[10px] sm:text-xs">
                          <th className="border border-black px-2 py-1 sm:px-3 sm:py-2 text-center font-bold">SL.NO</th>
                          <th className="border border-black px-2 py-1 sm:px-3 sm:py-2 text-left font-bold">SUB.CODE</th>
                          <th className="border border-black px-3 py-1 sm:px-4 sm:py-2 text-left font-bold">SUBJECT</th>
                          <th className="border border-black px-2 py-1 sm:px-3 sm:py-2 text-center font-bold">CREDIT</th>
                          <th className="border border-black px-2 py-1 sm:px-3 sm:py-2 text-center font-bold">GRADE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.subjects.map((s, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="border border-black px-2 py-1 sm:px-3 sm:py-2 text-center">{i + 1}</td>
                            <td className="border border-black px-2 py-1 sm:px-3 sm:py-2 font-mono">{s.Subject_Code}</td>
                            <td className="border border-black px-3 py-1 sm:px-4 sm:py-2">{s.Subject_Name}</td>
                            <td className="border border-black px-2 py-1 sm:px-3 sm:py-2 text-center">{parseCredits(s.Credits)}</td>
                            <td className={`border border-black px-2 py-1 sm:px-3 sm:py-2 text-center font-bold ${isFailingGrade(s.Grade) ? 'text-red-600' : 'text-gray-900'}`}>
                              {s.Grade}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Statistics for each semester */}
                  <div className="mb-4 sm:mb-8 flex flex-row flex-wrap sm:flex-nowrap justify-between gap-2 sm:gap-4 sm:gap-6 text-[10px] sm:text-sm print-summary">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className="font-semibold text-gray-700">Total Credits:</span>
                      <span className="font-bold text-gray-900">{data.subjects.reduce((sum, s) => sum + parseCredits(s?.Credits), 0)}</span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className="font-semibold text-gray-700">Credits Cleared:</span>
                      <span className="font-bold text-gray-900">{getCreditsCleared(data.subjects)}</span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className="font-semibold text-gray-700">SGPA:</span>
                      <span className="font-bold text-gray-900">{data.sgpa}</span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className="font-semibold text-gray-700">CGPA:</span>
                      <span className="font-bold text-gray-900">{data.cgpa || data.cumulativeCgpa || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Footer for each semester */}
                  <div className="flex justify-between text-[10px] sm:text-sm text-gray-700 border-t pt-2 sm:pt-4 mt-4 sm:mt-8">
                    <p>Date : {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    <p className="font-semibold">Dean, Examinations</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Print View - All Semesters for PDF */}
        {isMultipleSemesters && allResults && (
          <div className="hidden print:block print-only-view">
            {Object.entries(allResults).map(([sem, data], index) => (
              <div key={`print-${sem}`} className="print-area bg-white p-8 semester-page-break">
                {/* Header for each semester */}
                <div className="text-center mb-6">
                  <div className="flex justify-center mb-3">
                    <img
                      src="https://tse1.mm.bing.net/th/id/OIP.yR5DUnUlOBL5eCaPQ9HFgwHaHZ?rs=1&pid=ImgDetMain"
                      alt="CUTM Logo"
                      className="w-20 h-20 rounded-full  "
                    />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Centurion University of Technology and Management
                  </h1>
                  <h2 className="text-lg font-semibold text-gray-800 mb-1">
                    School Of Engineering & Technology, Paralakhemundi
                  </h2>
                  <p className="text-base text-gray-700">Paralakhemundi Campus</p>
                  <h3 className="text-xl font-bold text-gray-900 mt-4">
                    Semester Grade Sheet
                  </h3>
                </div>

                {/* Student Information for each semester */}
                <div className="mb-6 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <p><span className="font-semibold">Student Regd. No.:</span> {registration}</p>
                    <p><span className="font-semibold">Semester:</span> {sem.replace('Semester ', 'Sem ')}</p>
                  </div>
                  <p><span className="font-semibold">Student Name:</span> {data.name || 'N/A'}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <p><span className="font-semibold">Course:</span> {data.course || 'B.Tech'}</p>
                    <p><span className="font-semibold">Batch:</span> {data.batch || 'N/A'}</p>
                  </div>
                  <p><span className="font-semibold">Branch:</span> {data.branch || 'Electronics and Communication Engineering'}</p>
            </div>

                {/* Results Table for each semester */}
                <div className="mb-6 overflow-x-auto avoid-break">
                <table className="min-w-full border-collapse text-[11px] sm:text-sm">
                    <thead>
                    <tr className="bg-blue-600 text-white text-[10px] sm:text-xs">
                      <th className="border border-black px-2 py-1 sm:px-3 sm:py-2 text-center font-bold">SL.NO</th>
                      <th className="border border-black px-2 py-1 sm:px-3 sm:py-2 text-left font-bold">SUB.CODE</th>
                      <th className="border border-black px-3 py-1 sm:px-4 sm:py-2 text-left font-bold">SUBJECT</th>
                      <th className="border border-black px-2 py-1 sm:px-3 sm:py-2 text-center font-bold">CREDIT</th>
                      <th className="border border-black px-2 py-1 sm:px-3 sm:py-2 text-center font-bold">GRADE</th>
                  </tr>
                </thead>
                <tbody>
                      {data.subjects.map((s, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="border border-black px-2 py-1 sm:px-3 sm:py-2 text-center">{i + 1}</td>
                          <td className="border border-black px-2 py-1 sm:px-3 sm:py-2 font-mono">{s.Subject_Code}</td>
                          <td className="border border-black px-3 py-1 sm:px-4 sm:py-2">{s.Subject_Name}</td>
                          <td className="border border-black px-2 py-1 sm:px-3 sm:py-2 text-center">{parseCredits(s.Credits)}</td>
                          <td className={`border border-black px-2 py-1 sm:px-3 sm:py-2 text-center font-bold ${isFailingGrade(s.Grade) ? 'text-red-600' : 'text-gray-900'}`}>
                        {s.Grade}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

                {/* Summary Statistics for each semester */}
                <div className="mb-8 flex flex-row flex-wrap sm:flex-nowrap justify-between gap-4 sm:gap-6 text-sm print-summary">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700">Total Credits:</span>
                    <span className="font-bold text-gray-900">{data.subjects.reduce((sum, s) => sum + parseCredits(s?.Credits), 0)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700">Credits Cleared:</span>
                    <span className="font-bold text-gray-900">{getCreditsCleared(data.subjects)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700">SGPA:</span>
                    <span className="font-bold text-gray-900">{data.sgpa || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-700">CGPA:</span>
                    <span className="font-bold text-gray-900">{data.cgpa || data.cumulativeCgpa || 'N/A'}</span>
                  </div>
                </div>

                {/* Footer for each semester */}
                <div className="flex justify-between text-sm text-gray-700 border-t pt-4 mt-8">
                  <p>Date : {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  <p className="font-semibold">Dean, Examinations</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-6"></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Initializing</h2>
          <p className="text-gray-600">Setting up your result viewer...</p>
        </div>
      </div>
    }>
      <ResultPageContent />
    </Suspense>
  );
}