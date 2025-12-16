/**
 * Database helper utility
 * Gets the appropriate database name based on campus and school
 */

import { getCampusSchoolDatabase } from "./campus";

/**
 * Get database name from request (supports both campus and school)
 * This is a convenience function that can be used in API routes
 */
export async function getDatabaseFromRequest(req) {
  try {
    const { searchParams } = new URL(req.url);
    
    // PRIORITY 1: Get from query params (most reliable for current request)
    let campus = searchParams.get('campus');
    let school = searchParams.get('school');
    
    // PRIORITY 2: If not in query params, try JWT payload
    if (!campus || !school) {
      const token = req.cookies.get("token")?.value;
      if (token) {
        const { jwtVerify } = await import("jose");
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
        const { payload } = await jwtVerify(token, secret);
        campus = campus || payload?.campus || null;
        school = school || payload?.school || null;
      }
    }
    
    // Normalize campus values (BBSR -> bbsr, PKD -> pkd)
    if (campus) {
      const campusLower = String(campus).toLowerCase();
      if (campusLower === 'bbsr' || campusLower === 'bbs') {
        campus = 'bbsr';
      } else if (campusLower === 'pkd' || campusLower === 'pk') {
        campus = 'pkd';
      }
    }
    
    // Normalize school values
    if (school) {
      const schoolLower = String(school).toLowerCase();
      if (schoolLower === 'soet' || schoolLower === 'soe') {
        school = 'soet';
      } else if (schoolLower === 'som') {
        school = 'som';
      } else if (schoolLower === 'sovet' || schoolLower === 'sov') {
        school = 'sovet';
      }
    }
    
    return getCampusSchoolDatabase(campus, school);
  } catch {
    // Fallback to default
    return 'CUTMPKD'; // Default fallback to base PKD database
  }
}

