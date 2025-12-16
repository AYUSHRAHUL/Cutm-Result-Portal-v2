/**
 * SOVET Diploma Registration Parser API
 * Handles Diploma registration number parsing and branch/batch detection
 * 
 * Format: YY II PP BB SSSS (12 digits)
 * Program Code: 07 (Diploma)
 * Branch code from index 5-7 (positions 5, 6, 7)
 */

import { NextResponse } from "next/server";
import { parseDiplomaRegistration } from "@/lib/parse-diploma-registration";

/**
 * GET /api/sovet/parse-registration?registration=241107130001
 * Parse a Diploma registration number
 */
export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const registration = searchParams.get('registration');

        if (!registration) {
            return NextResponse.json({ 
                error: 'Registration number is required' 
            }, { status: 400 });
        }

        const parsed = parseDiplomaRegistration(registration);

        if (!parsed) {
            return NextResponse.json({ 
                error: 'Invalid Diploma registration number',
                isValid: false
            }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            ...parsed
        });
    } catch (error) {
        console.error('Error parsing Diploma registration:', error);
        return NextResponse.json({ 
            error: 'Failed to parse registration number' 
        }, { status: 500 });
    }
}

/**
 * POST /api/sovet/parse-registration
 * Parse multiple Diploma registration numbers
 */
export async function POST(req) {
    try {
        const body = await req.json();
        const { registration, registrations } = body;

        // Single registration
        if (registration) {
            const parsed = parseDiplomaRegistration(registration);
            return NextResponse.json({
                success: true,
                result: parsed
            });
        }

        // Multiple registrations
        if (registrations && Array.isArray(registrations)) {
            const results = registrations.map(reg => ({
                registration: reg,
                parsed: parseDiplomaRegistration(reg)
            }));

            return NextResponse.json({
                success: true,
                results: results
            });
        }

        return NextResponse.json({ 
            error: 'Registration number(s) required' 
        }, { status: 400 });
    } catch (error) {
        console.error('Error parsing Diploma registrations:', error);
        return NextResponse.json({ 
            error: 'Failed to parse registration numbers' 
        }, { status: 500 });
    }
}

/**
 * Check if a registration number belongs to a diploma student
 */
export function isDiplomaStudent(registration) {
  if (!registration || typeof registration !== 'string') return false;
  const parsed = parseDiplomaRegistration(registration);
  return parsed ? parsed.isValid && parsed.isDiploma : false;
}

/**
 * Check if a diploma student is lateral entry
 * Lateral entry indicator: 8th index (0-based) is '1'
 * @param {string} registration - Registration number
 * @returns {boolean} True if lateral entry
 */
export function isDiplomaLateralEntry(registration) {
  if (!registration || typeof registration !== 'string') return false;
  const reg = registration.trim();
  // If 8th index (0-based) is '1', it's lateral entry
  return reg.length > 8 && reg[8] === '1';
}

/**
 * Get diploma branch name from registration number
 */
export function getDiplomaBranchName(registration) {
  const parsed = parseDiplomaRegistration(registration);
  if (!parsed || !parsed.isValid || !parsed.isDiploma) return null;

  // Branch codes from index 5-7: 711=Electrical, 712=Mechanical, 713=Civil, 714=CSE, 715=Automobile, 716=Mining
  const branchMap = {
    '711': 'Electrical Engineering (Diploma)',
    '712': 'Mechanical Engineering (Diploma)',
    '713': 'Civil Engineering (Diploma)',
    '714': 'Computer Science Engineering (Diploma)',
    '715': 'Automobile Engineering (Diploma)',
    '716': 'Mining Engineering (Diploma)'
  };

  return branchMap[parsed.branchCode] || parsed.branch || null;
}

/**
 * Get branch from registration (for compatibility)
 */
export function getBranchFromRegistration(registration, department = null) {
  const parsed = parseDiplomaRegistration(registration);
  if (!parsed || !parsed.isValid || !parsed.isDiploma) {
    return department || 'Unknown';
  }
  const branchName = getDiplomaBranchName(registration);
  return branchName || department || 'Unknown';
}

// Export parser function for use in other API routes
export { parseDiplomaRegistration };
