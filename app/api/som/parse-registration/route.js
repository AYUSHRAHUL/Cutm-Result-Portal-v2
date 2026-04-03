/**
 * SOM Registration Parser API
 * Handles SOM registration number parsing and branch/batch detection
 * 
 * Format: YY IIII BB SSSS (12 digits)
 * Branch code from index 5-7 (positions 5, 6, 7)
 */

import { NextResponse } from "next/server";

// SOM branch codes (index 5-7)
const somBranchMap = {
    '912': 'BBA',
    '214': 'MBA'
};

/**
 * Parse SOM registration number
 * @param {string} registration - Registration number (e.g., 230209120046)
 * @returns {object} Parsed details or null if invalid
 */
function parseSOMRegistration(registration) {
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

    // Check if branch code exists in SOM map
    if (!somBranchMap[branchCode]) {
        return null; // Not a SOM program we know
    }

    const branch = somBranchMap[branchCode];
    
    // Attempt campus lookup, defaults to checking prefix
    let campus = 'Unknown';
    if (instituteCode.startsWith('01')) campus = 'PKD';
    else if (instituteCode.startsWith('02')) campus = 'BBSR';
    else if (instituteCode.startsWith('03')) campus = 'BLS';
    else if (instituteCode.startsWith('04')) campus = 'RYD';
    else if (instituteCode.startsWith('05')) campus = 'BPR';
    else if (instituteCode.startsWith('06')) campus = 'CKD';

    return {
        isValid: true,
        isSOM: true,
        year: `20${year}`,
        yearCode: year,
        campus: campus,
        instituteCode: instituteCode,
        programCode: programCode,
        program: branch, // BBA or MBA
        school: 'SOM',
        schoolCode: 'SOM',
        branchCode: branchCode,
        branch: branch,
        studentSerial: studentSerial,
        fullRegNo: reg
    };
}

/**
 * GET /api/som/parse-registration?registration=230209120046
 * Parse a SOM registration number
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

        const parsed = parseSOMRegistration(registration);

        if (!parsed) {
            return NextResponse.json({
                error: 'Invalid SOM registration number',
                isValid: false
            }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            ...parsed
        });
    } catch (error) {
        console.error('Error parsing SOM registration:', error);
        return NextResponse.json({
            error: 'Failed to parse registration number'
        }, { status: 500 });
    }
}

/**
 * POST /api/som/parse-registration
 * Parse multiple SOM registration numbers
 */
export async function POST(req) {
    try {
        const body = await req.json();
        const { registration, registrations } = body;

        // Single registration
        if (registration) {
            const parsed = parseSOMRegistration(registration);
            return NextResponse.json({
                success: true,
                result: parsed
            });
        }

        // Multiple registrations
        if (registrations && Array.isArray(registrations)) {
            const results = registrations.map(reg => ({
                registration: reg,
                parsed: parseSOMRegistration(reg)
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
        console.error('Error parsing SOM registrations:', error);
        return NextResponse.json({
            error: 'Failed to parse registration numbers'
        }, { status: 500 });
    }
}

/**
 * Check if a registration number belongs to a SOM student
 */
export function isSOMStudent(registration) {
    if (!registration || typeof registration !== 'string') return false;
    const parsed = parseSOMRegistration(registration);
    return parsed ? parsed.isValid && parsed.isSOM : false;
}

/**
 * Get branch from registration (for compatibility)
 */
export function getBranchFromRegistration(registration, department = null) {
    const parsed = parseSOMRegistration(registration);
    if (!parsed || !parsed.isValid || !parsed.isSOM) {
        return department || 'Unknown';
    }

    return parsed.branch || department || 'Unknown';
}

// Export parser function for use in other API routes
export { parseSOMRegistration };
