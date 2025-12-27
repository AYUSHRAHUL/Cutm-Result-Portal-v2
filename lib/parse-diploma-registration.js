/**
 * SOVET Diploma Registration Parser Utility
 * Shared function for parsing Diploma registration numbers
 * 
 * Format: YY II PP BB SSSS (12 digits)
 * Program Code: 07 (Diploma)
 * Branch code from index 5-7 (positions 5, 6, 7)
 */

// SOVET Diploma branch codes (index 5-7)
const sovetDiplomaBranchMap = {
    '711': 'Electrical',
    '712': 'Mechanical',
    '713': 'Civil',
    '714': 'CSE',
    '715': 'Automobile',
    '716': 'Mining',
   
};

// Campus codes
const campusCodes = {
    '11': 'PKD',
    '02': 'BBSR'
};

/**
 * Parse Diploma registration number
 * @param {string} registration - Registration number (e.g., 241107130001)
 * @returns {object} Parsed details or null if invalid
 */
export function parseDiplomaRegistration(registration) {
    if (!registration || typeof registration !== 'string') return null;

    const reg = registration.trim().toUpperCase();

    // Must be exactly 12 characters
    if (reg.length !== 12) {
        return null;
    }

    const year = reg.slice(0, 2);
    const instituteCode = reg.slice(2, 4);  // 2 digits
    const programCode = reg.slice(4, 6);    // 2 digits
    const branchCode = reg.slice(5, 8);     // 3 digits (index 5-7)
    const studentSerial = reg.slice(8);     // 4 digits

    // Check if it's Diploma (program code must be '07')
    if (programCode !== '07') {
        return null; // This is not Diploma
    }

    // Check if branch code exists in SOVET Diploma map
    // If not found, still return valid but with generic branch name
    const branch = sovetDiplomaBranchMap[branchCode] || 'Engineering';
    const campus = campusCodes[instituteCode] || 'Unknown';
    
    // Check for lateral entry: if 8th index (0-based) is '1', it's lateral entry
    const isLateralEntry = reg.length > 8 && reg[8] === '1';

    return {
        isValid: true,
        isDiploma: true,
        isBTech: false,
        isLateralEntry: isLateralEntry,
        year: `20${year}`,
        yearCode: year,
        campus: campus,
        instituteCode: instituteCode,
        programCode: programCode,
        program: 'Diploma',
        school: 'SOVET',
        schoolCode: '14',
        branchCode: branchCode,
        branch: branch,
        studentSerial: studentSerial,
        fullRegNo: reg,
        branchRecognized: !!sovetDiplomaBranchMap[branchCode] // Flag to indicate if branch was in map
    };
}

