/**
 * SOET B.Tech Registration Parser API
 * Handles B.Tech registration number parsing and branch/batch detection
 * 
 * Format: YY IIII BB SSSS (12 digits)
 * Branch code from index 5-7 (positions 5, 6, 7)
 */

import { NextResponse } from "next/server";

// SOET B.Tech branch codes (index 5-7)
const soetBtechBranchMap = {
    '111': 'Civil Engineering',
    '112': 'Computer Science Engineering',
    '113': 'Electronics & Communication Engineering',
    '115': 'Electrical & Electronics Engineering',
    '116': 'Mechanical Engineering',
    // AIML registrations use 137
    '137': 'CSE AIML'
};

// Campus codes
const campusCodes = {
    '0101': 'PKD',
    '0201': 'BBSR',
    '6401': 'PKD'  // 2026 batch onwards - CSE and CSE AIML new series
};

/**
 * Parse B.Tech registration number
 * @param {string} registration - Registration number (e.g., 220101120003)
 * @returns {object} Parsed details or null if invalid
 */
function parseBTechRegistration(registration) {
    if (!registration || typeof registration !== 'string') return null;

    const reg = registration.trim().toUpperCase();

    // Must be exactly 12 characters
    if (reg.length !== 12) {
        return null;
    }

    const year = reg.slice(0, 2);
    const instituteCode = reg.slice(2, 6); // 4 digits
    const programCode = reg.slice(4, 6);  // 2 digits
    const branchCode = reg.slice(5, 8);   // 3 digits (index 5-7)
    const studentSerial = reg.slice(8);  // 4 digits

    // Check if it's B.Tech (not diploma - program code should not be '07')
    if (programCode === '07') {
        return null; // This is Diploma, not B.Tech
    }

    // Check if branch code exists in SOET B.Tech map
    if (!soetBtechBranchMap[branchCode]) {
        return null;
    }

    const branch = soetBtechBranchMap[branchCode];
    const campus = campusCodes[instituteCode] || 'Unknown';

    return {
        isValid: true,
        isDiploma: false,
        isBTech: true,
        year: `20${year}`,
        yearCode: year,
        campus: campus,
        instituteCode: instituteCode,
        programCode: '03',
        program: 'B.Tech',
        school: 'SOET',
        schoolCode: '13',
        branchCode: branchCode,
        branch: branch,
        studentSerial: studentSerial,
        fullRegNo: reg
    };
}

/**
 * GET /api/soet/parse-registration?registration=220101120003
 * Parse a B.Tech registration number
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

        const parsed = parseBTechRegistration(registration);

        if (!parsed) {
            return NextResponse.json({
                error: 'Invalid B.Tech registration number',
                isValid: false
            }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            ...parsed
        });
    } catch (error) {
        console.error('Error parsing B.Tech registration:', error);
        return NextResponse.json({
            error: 'Failed to parse registration number'
        }, { status: 500 });
    }
}

/**
 * POST /api/soet/parse-registration
 * Parse multiple B.Tech registration numbers
 */
export async function POST(req) {
    try {
        const body = await req.json();
        const { registration, registrations } = body;

        // Single registration
        if (registration) {
            const parsed = parseBTechRegistration(registration);
            return NextResponse.json({
                success: true,
                result: parsed
            });
        }

        // Multiple registrations
        if (registrations && Array.isArray(registrations)) {
            const results = registrations.map(reg => ({
                registration: reg,
                parsed: parseBTechRegistration(reg)
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
        console.error('Error parsing B.Tech registrations:', error);
        return NextResponse.json({
            error: 'Failed to parse registration numbers'
        }, { status: 500 });
    }
}

/**
 * Check if a registration number belongs to a B.Tech student
 */
export function isBTechStudent(registration) {
    if (!registration || typeof registration !== 'string') return false;
    const parsed = parseBTechRegistration(registration);
    return parsed ? parsed.isValid && parsed.isBTech : false;
}

/**
 * Get branch from registration (for compatibility)
 */
export function getBranchFromRegistration(registration, department = null) {
    const parsed = parseBTechRegistration(registration);
    if (!parsed || !parsed.isValid || !parsed.isBTech) {
        return department || 'Unknown';
    }

    const branchMap = {
        '111': 'Civil Engineering',
        '112': 'Computer Science Engineering',
        '113': 'Electronics & Communication Engineering',
        '115': 'Electrical & Electronics Engineering',
        '116': 'Mechanical Engineering',
        // AIML registrations use 137
        '137': 'CSE AIML'
    };

    return branchMap[parsed.branchCode] || department || 'Unknown';
}

// Export parser function for use in other API routes
export { parseBTechRegistration };
