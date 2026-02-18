/**
 * Campus detection utility
 * Detects campus based on the 4th character of employee ID
 * 4th character 'B' → BBSR campus
 * Otherwise → PKD campus
 * Examples: EMPPKD0029 → PKD, EMPBBSR0029 → BBSR
 */

export function detectCampus(employeeId) {
  if (!employeeId) {
    console.warn('[detectCampus] No employee ID provided');
    return null;
  }

  const empId = String(employeeId).toUpperCase().trim();
  console.log(`[detectCampus] Input: ${employeeId} → Normalized: ${empId}`);

  // Check 4th character (index 3)
  if (empId.length >= 4) {
    const fourthChar = empId[3];
    console.log(`[detectCampus] 4th character: ${fourthChar}`);

    if (fourthChar === 'B') {
      console.log(`[detectCampus] MATCHED BBSR for: ${employeeId}`);
      return 'bbsr';
    } else {
      console.log(`[detectCampus] MATCHED PKD for: ${employeeId}`);
      return 'pkd';
    }
  }

  // If less than 4 characters, default to PKD
  console.warn(`[detectCampus] Employee ID too short (${empId.length} chars), defaulting to PKD`);
  return 'pkd';
}

export function getCampusDatabase(campus) {
  if (campus === 'pkd') {
    return 'CUTMPKD';
  }
  if (campus === 'bbsr') {
    return 'CUTMBBSR';
  }
  return 'CUTMPKD'; // Default to PKD
}

/**
 * Get database name based on campus and school
 * Pattern: CUTM + SCHOOL + CAMPUS (e.g., CUTMSOETBBSR, CUTMSOMPKD)
 * Returns: 
 * - BBSR: CUTMSOETBBSR, CUTMSOMBBSR, CUTMSOVEETBBSR
 * - PKD: CUTMSOETPKD, CUTMSOMPKD, CUTMSOVEETPKD (or base CUTMPKD if no school/SOET)
 * Note: Based on actual database structure:
 * - Pattern is SCHOOL first, then CAMPUS
 * - For PKD without school or SOET, use base CUTMPKD
 */
export function getCampusSchoolDatabase(campus, school) {
  // Sanitize campus parameter - remove any query string parameters that might have been incorrectly included
  let cleanCampus = String(campus || '').trim();
  // Remove any query string parameters (e.g., "pkd?batch=2023" -> "pkd")
  if (cleanCampus.includes('?')) {
    cleanCampus = cleanCampus.split('?')[0];
  }
  // Remove any additional parameters after & (e.g., "pkd&batch=2023" -> "pkd")
  if (cleanCampus.includes('&')) {
    cleanCampus = cleanCampus.split('&')[0];
  }

  const campusUpper = cleanCampus.toUpperCase();
  const schoolUpper = String(school || '').toUpperCase();

  // BBSR databases - pattern: CUTM + SCHOOL + BBSR
  if (campusUpper === 'BBSR' || campusUpper === 'BBS') {
    if (schoolUpper === 'SOET') {
      return 'CUTMSOETBBSR';
    }
    if (schoolUpper === 'SOM') {
      return 'CUTMSOMBBSR';
    }
    if (schoolUpper === 'SOVET') {
      return 'CUTMSOVETBBSR'; // Database name: CUTMSOVETBBSR for SOVET diploma (BBSR campus)
    }
    // If BBSR but no school, default to SOET
    return 'CUTMSOETBBSR';
  }

  // PKD databases - pattern: CUTM + SCHOOL + PKD
  if (campusUpper === 'PKD' || campusUpper === 'PK') {
    // For PKD SOET, use base CUTMPKD database
    if (schoolUpper === 'SOET') {
      return 'CUTMPKD';
    }
    if (schoolUpper === 'SOM') {
      return 'CUTMSOMPKD';
    }
    if (schoolUpper === 'SOVET') {
      return 'CUTMSOVETPKD'; // Database name: CUTMSOVETPKD for SOVET diploma (PKD campus)
    }
    // For PKD, if no school specified, use base CUTMPKD
    return 'CUTMPKD';
  }

  // Default fallback - return base campus database
  return getCampusDatabase(campus);
}

/**
 * Get database name from request based on campus and school in JWT token or query params
 */
export async function getCampusSchoolDatabaseFromRequest(req) {
  try {
    const campus = await getCampusFromRequest(req);
    const school = await getSchoolFromRequest(req);
    return getCampusSchoolDatabase(campus, school);
  } catch {
    const campus = await getCampusFromRequest(req);
    return getCampusDatabase(campus);
  }
}

export function getCampusName(campus) {
  if (campus === 'pkd') {
    return 'CUTM PKD';
  }
  if (campus === 'bbsr') {
    return 'CUTM BBSR';
  }
  return 'CUTM';
}

export function getTeacherDashboardPath(campus) {
  // Always redirect to school selection page first
  // The school selection page will then redirect to /dashboard/teacher/{campus}
  return '/dashboard/teacher';
}

export function getAdminDashboardPath(campus) {
  if (campus === 'pkd') {
    return '/dashboard/admin/pkd';
  }
  if (campus === 'bbsr') {
    return '/dashboard/admin/bbsr';
  }
  return '/dashboard/admin'; // Default fallback
}

export function getUserDashboardPath(campus) {
  if (campus === 'pkd') {
    return '/dashboard/user/pkd';
  }
  if (campus === 'bbsr') {
    return '/dashboard/user/bbsr';
  }
  return '/dashboard/user'; // Default fallback
}

export function getDashboardPath(role, campus) {
  if (role === 'admin') {
    return getAdminDashboardPath(campus);
  }
  if (role === 'teacher') {
    return getTeacherDashboardPath(campus);
  }
  if (role === 'user') {
    return getUserDashboardPath(campus);
  }
  return '/dashboard/user'; // Default fallback
}

/**
 * Get campus from JWT token in request
 * Used in API routes to determine which database to use
 */
export async function getCampusFromRequest(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return null;

    const { jwtVerify } = await import("jose");
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
    const { payload } = await jwtVerify(token, secret);

    return payload.campus || null;
  } catch {
    return null;
  }
}

/**
 * Get database name from request based on campus in JWT token
 */
export async function getCampusDatabaseFromRequest(req) {
  const campus = await getCampusFromRequest(req);
  return getCampusDatabase(campus);
}

/**
 * Get school from request (query parameter or JWT payload)
 */
export async function getSchoolFromRequest(req) {
  try {
    // First try query parameter
    const { searchParams } = new URL(req.url);
    const schoolParam = searchParams.get('school');
    if (schoolParam) {
      return detectSchool(schoolParam);
    }

    // Then try JWT payload
    const token = req.cookies.get("token")?.value;
    if (token) {
      const { jwtVerify } = await import("jose");
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
      const { payload } = await jwtVerify(token, secret);
      return payload.school || null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * School detection utility
 * Detects school from user data (SOET, SOM, SOVET)
 * Case insensitive
 */
export function detectSchool(school) {
  if (!school) return null;

  const schoolName = String(school).toUpperCase().trim();

  if (schoolName === 'SOET' || schoolName.includes('SCHOOL OF ENGINEERING')) {
    return 'soet';
  }

  if (schoolName === 'SOM' || schoolName.includes('SCHOOL OF MANAGEMENT')) {
    return 'som';
  }

  if (schoolName === 'SOVET' || schoolName.includes('SCHOOL OF VOCATIONAL')) {
    return 'sovet';
  }

  return null; // Default or unknown
}

export function getSchoolName(school) {
  if (school === 'soet') {
    return 'SOET';
  }
  if (school === 'som') {
    return 'SOM';
  }
  if (school === 'sovet') {
    return 'SOVET';
  }
  return 'CUTM';
}

export function getAdminDashboardPathBySchool(school) {
  if (school === 'soet') {
    return '/dashboard/admin/soet';
  }
  if (school === 'som') {
    return '/dashboard/admin/som';
  }
  if (school === 'sovet') {
    return '/dashboard/admin/sovet';
  }
  return '/dashboard/admin'; // Default fallback
}

export function getTeacherDashboardPathBySchool(school) {
  if (school === 'soet') {
    return '/dashboard/teacher/soet';
  }
  if (school === 'som') {
    return '/dashboard/teacher/som';
  }
  if (school === 'sovet') {
    return '/dashboard/teacher/sovet';
  }
  return '/dashboard/teacher'; // Default fallback
}

export function getUserDashboardPathBySchool(school) {
  if (school === 'soet') {
    return '/dashboard/user/soet';
  }
  if (school === 'som') {
    return '/dashboard/user/som';
  }
  if (school === 'sovet') {
    return '/dashboard/user/sovet';
  }
  return '/dashboard/user'; // Default fallback
}

export function getDashboardPathBySchool(role, school) {
  if (role === 'admin') {
    return getAdminDashboardPathBySchool(school);
  }
  if (role === 'teacher') {
    return getTeacherDashboardPathBySchool(school);
  }
  if (role === 'user') {
    return getUserDashboardPathBySchool(school);
  }
  return '/dashboard/user'; // Default fallback
}

/**
 * Get database name from registration number (for user panel)
 * Based on indices 2-5 of registration number:
 * Pattern interpretation: The 4-digit code is split into:
 * - First 2 digits (indices 2-3): Campus code
 * - Last 2 digits (indices 4-5): School code
 * 
 * Campus codes:
 * - "10" → PKD
 * - "30" → BBSR
 * 
 * School codes:
 * - "11" → SOET
 * - "71" → SOVET
 * 
 * Examples:
 * - 220101110003: indices 2-5 = "0101" → campus="01" (not matched, fallback), school="01" (not matched, fallback)
 *   Actually: Wait, the code "0101" means indices 2-3="01", indices 4-5="01"
 *   But we need "10" for PKD and "11" for SOET, so "0101" doesn't match directly.
 *   However, looking at the pattern, maybe we should check if the code contains "10" and "11"?
 * 
 * Revised approach: Check if the 4-digit code contains the campus/school patterns:
 * - If contains "10" (campus) and "11" (school) → PKD + SOET → CUTMPKD
 * - If contains "10" (campus) and "71" (school) → PKD + SOVET → CUTMSOVETPKD
 * - If contains "30" (campus) and "11" (school) → BBSR + SOET → CUTMSOETBBSR
 * - If contains "30" (campus) and "71" (school) → BBSR + SOVET → CUTMSOVETBBSR
 * 
 * @param {string} registration - Student registration number
 * @returns {string} Database name
 */
export function getDatabaseFromRegistration(registration) {
  if (!registration || typeof registration !== 'string') {
    return 'CUTMPKD'; // Default fallback
  }

  const regStr = String(registration).trim();

  // Need at least 6 characters (indices 0-5)
  if (regStr.length < 6) {
    return 'CUTMPKD'; // Default fallback
  }

  // Extract indices 2-5 (4-digit code) and indices 3-6 (also 4-digit, shifted by 1)
  const code = regStr.slice(2, 6);
  const codeShifted = regStr.length >= 7 ? regStr.slice(3, 7) : null;

  // First, try exact pattern matching on indices 3-6 (which often contains the pattern like 1011, 1071, 3011, 3071)
  if (codeShifted) {
    if (codeShifted === '1011') {
      return 'CUTMPKD'; // PKD + SOET
    } else if (codeShifted === '1071') {
      return 'CUTMSOVETPKD'; // PKD + SOVET
    } else if (codeShifted === '3011') {
      return 'CUTMSOETBBSR'; // BBSR + SOET
    } else if (codeShifted === '3071') {
      return 'CUTMSOVETBBSR'; // BBSR + SOVET
    }
  }

  // Also try exact pattern matching on indices 2-5
  if (code === '1011') {
    return 'CUTMPKD'; // PKD + SOET
  } else if (code === '1071') {
    return 'CUTMSOVETPKD'; // PKD + SOVET
  } else if (code === '3011') {
    return 'CUTMSOETBBSR'; // BBSR + SOET
  } else if (code === '3071') {
    return 'CUTMSOVETBBSR'; // BBSR + SOVET
  }

  // Parse campus code (first 2 digits: indices 2-3)
  const campusCode = code.slice(0, 2);
  // Parse school code (last 2 digits: indices 4-5)
  const schoolCode = code.slice(2, 4);

  // Determine campus from first 2 digits
  let campus = null;
  if (campusCode === '10') {
    campus = 'PKD';
  } else if (campusCode === '30') {
    campus = 'BBSR';
  }

  // Determine school from last 2 digits
  let school = null;
  if (schoolCode === '11') {
    school = 'SOET';
  } else if (schoolCode === '71') {
    school = 'SOVET';
  }

  // If we have both campus and school, use them
  if (campus && school) {
    return getCampusSchoolDatabase(campus.toLowerCase(), school);
  }

  // Fallback: try pattern matching in the full 4-digit code or adjacent positions
  // This handles cases like "0101" where patterns might appear in different positions
  // For registration like "220101130056", code="0101" contains "10" (campus) but we need to check indices 3-6 for school
  if (regStr.length >= 7) {
    const extendedCode = regStr.slice(2, 7); // Check indices 2-6 (5 digits)
    if ((code.includes('10') || extendedCode.includes('10')) && (code.includes('11') || extendedCode.includes('11'))) {
      return 'CUTMPKD'; // PKD + SOET
    } else if ((code.includes('10') || extendedCode.includes('10')) && (code.includes('71') || extendedCode.includes('71'))) {
      return 'CUTMSOVETPKD'; // PKD + SOVET
    } else if ((code.includes('30') || extendedCode.includes('30')) && (code.includes('11') || extendedCode.includes('11'))) {
      return 'CUTMSOETBBSR'; // BBSR + SOET
    } else if ((code.includes('30') || extendedCode.includes('30')) && (code.includes('71') || extendedCode.includes('71'))) {
      return 'CUTMSOVETBBSR'; // BBSR + SOVET
    }
  } else {
    // Standard 4-digit code matching
    if (code.includes('10') && code.includes('11')) {
      return 'CUTMPKD'; // PKD + SOET
    } else if (code.includes('10') && code.includes('71')) {
      return 'CUTMSOVETPKD'; // PKD + SOVET
    } else if (code.includes('30') && code.includes('11')) {
      return 'CUTMSOETBBSR'; // BBSR + SOET
    } else if (code.includes('30') && code.includes('71')) {
      return 'CUTMSOVETBBSR'; // BBSR + SOVET
    }
  }

  // Final fallback: if code contains "10" (PKD campus pattern), default to CUTMPKD for SOET
  // This handles cases where school code is not clearly visible in indices 2-5
  if (code.includes('10') || (regStr.length >= 7 && regStr.slice(2, 7).includes('10'))) {
    return 'CUTMPKD'; // Default to PKD SOET
  } else if (code.includes('30') || (regStr.length >= 7 && regStr.slice(2, 7).includes('30'))) {
    return 'CUTMSOETBBSR'; // Default to BBSR SOET
  }

  // Final fallback: use default
  return 'CUTMPKD';
}

/**
 * Get school from registration number (for user panel)
 * Based on indices 3-6 or 4-7 of registration number
 * 
 * @param {string} registration - Student registration number
 * @returns {string|null} School name (SOET or SOVET) or null
 */
export function getSchoolFromRegistration(registration) {
  if (!registration || typeof registration !== 'string') {
    return null;
  }

  const regStr = String(registration).trim();

  // Need at least 7 characters
  if (regStr.length < 7) {
    return null;
  }

  // Check indices 3-6 first (pattern like 1011, 1071, 3011, 3071)
  const codeShifted = regStr.slice(3, 7);

  // Check indices 2-5 as backup
  const code = regStr.length >= 6 ? regStr.slice(2, 6) : null;

  // Exact pattern matching first (most reliable)
  if (codeShifted === '1011' || codeShifted === '3011') {
    return 'SOET';
  } else if (codeShifted === '1071' || codeShifted === '3071') {
    return 'SOVET';
  }

  // Pattern matching: check if code ends with "11" (SOET) or "71" (SOVET) and starts with campus code
  if (codeShifted.endsWith('11') && (codeShifted.startsWith('10') || codeShifted.startsWith('30'))) {
    return 'SOET';
  } else if (codeShifted.endsWith('71') && (codeShifted.startsWith('10') || codeShifted.startsWith('30'))) {
    return 'SOVET';
  }

  // Fallback: check indices 4-5 (digits 6-7) for school code
  if (regStr.length >= 7) {
    const schoolCode = regStr.slice(5, 7); // indices 5-6 (6th and 7th characters)
    if (schoolCode === '11') {
      return 'SOET';
    } else if (schoolCode === '71') {
      return 'SOVET';
    }
  }

  // Additional fallback: check indices 2-5
  if (code) {
    const schoolCode = code.slice(2, 4);
    if (schoolCode === '11') {
      return 'SOET';
    } else if (schoolCode === '71') {
      return 'SOVET';
    }
  }

  return null;
}

