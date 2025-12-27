/**
 * Centurion University Registration System
 * Parses registration numbers and derives academic information
 */

// Centurion Registration Number Format
// YYYYPPPNNN
// YYYY = Year (2024, 2023, etc.)
// PPP = Program Code (AI, IOT, CYBER, BLK, DIP)
// NNN = Student Number (001-999)

export const programCodes = {
  'AI': { name: 'B.Tech AI & Machine Learning', branch: 'AI', school: 'SOVET', duration: 4 },
  'IOT': { name: 'B.Tech IoT & Automation', branch: 'IOT', school: 'SOVET', duration: 4 },
  'CYBER': { name: 'B.Tech Cybersecurity', branch: 'Cyber', school: 'SOVET', duration: 4 },
  'BLK': { name: 'B.Tech Blockchain', branch: 'Blockchain', school: 'SOVET', duration: 4 },
  'DIP': { name: 'Diploma Programs', branch: 'Diploma', school: 'SOVET', duration: 3 },
  'CSE': { name: 'B.Tech CSE', branch: 'CSE', school: 'SOET', duration: 4 },
  'ECE': { name: 'B.Tech ECE', branch: 'ECE', school: 'SOET', duration: 4 },
  'EEE': { name: 'B.Tech EEE', branch: 'EEE', school: 'SOET', duration: 4 }
};

export const campusMap = {
  'bbsr': 'BBSR Campus',
  'pkd': 'PKD Campus',
  'BBSR': 'BBSR Campus',
  'PKD': 'PKD Campus'
};

/**
 * Parse Centurion University Registration Number
 * @param {string} regNo - Registration number (e.g., 2024AI001)
 * @returns {object} Parsed registration details
 */
export function parseRegistrationNo(regNo) {
  if (!regNo || typeof regNo !== 'string') {
    return {
      isValid: false,
      regNo: regNo,
      error: 'Invalid registration number'
    };
  }

  const regNoClean = regNo.trim().toUpperCase();

  // Try Centurion format: YYYYPPPNNN (e.g., 2024AI001)
  const centurionMatch = regNoClean.match(/^(\d{4})([A-Z]+)(\d+)$/);

  if (centurionMatch) {
    const [, year, programCode, studentNo] = centurionMatch;
    const batch = parseInt(year);
    const programInfo = programCodes[programCode] || {
      name: `Program ${programCode}`,
      branch: programCode,
      school: 'Unknown',
      duration: 4
    };

    const currentYear = new Date().getFullYear();
    const enrollmentYear = parseInt(year);
    const currentSemester = Math.min(8, Math.ceil((currentYear - enrollmentYear + 1) * 2));

    return {
      isValid: true,
      regNo: regNoClean,
      year: batch,
      batch: `Batch ${year}`,
      programCode: programCode,
      studentNo: studentNo,
      program: programInfo.name,
      branch: programInfo.branch,
      school: programInfo.school,
      campus: 'BBSR', // Default to BBSR
      duration: programInfo.duration,
      currentSemester: currentSemester,
      currentYear: currentYear,
      expectedGraduation: enrollmentYear + programInfo.duration
    };
  }

  // Try old CUTM format: YYXXXXXXN (e.g., 20220115006)
  const oldFormat = regNoClean.match(/^(\d{2})(\d{6})(\d)$/);
  if (oldFormat) {
    const [, yy, _, branchCode] = oldFormat;
    const year = parseInt('20' + yy);
    const branchMap = {
      '3': 'Civil', '4': 'CSE',
      '1': 'EEE', '2': 'Mechanical'
    };

    return {
      isValid: true,
      regNo: regNoClean,
      year: year,
      batch: `Batch ${yy}`,
      branch: branchMap[branchCode] || 'Unknown',
      school: 'SOET',
      campus: 'BBSR'
    };
  }

  return {
    isValid: false,
    regNo: regNoClean,
    error: 'Registration format not recognized'
  };
}

/**
 * Extract batch from registration number
 * @param {string} regNo - Registration number
 * @returns {string} Batch year
 */
export function extractBatchFromReg(regNo) {
  const parsed = parseRegistrationNo(regNo);
  return parsed.isValid ? String(parsed.year) : '';
}

/**
 * Extract program from registration number
 * @param {string} regNo - Registration number
 * @returns {string} Program code or branch
 */
export function extractProgramFromReg(regNo) {
  const parsed = parseRegistrationNo(regNo);
  return parsed.isValid ? parsed.branch : '';
}

/**
 * Get school from registration number
 * @param {string} regNo - Registration number
 * @returns {string} School name
 */
export function getSchoolFromReg(regNo) {
  const parsed = parseRegistrationNo(regNo);
  return parsed.isValid ? parsed.school : '';
}

/**
 * Get expected semester based on registration and current date
 * @param {string} regNo - Registration number
 * @returns {number} Expected current semester
 */
export function getExpectedSemester(regNo) {
  const parsed = parseRegistrationNo(regNo);
  return parsed.isValid ? parsed.currentSemester : 0;
}

/**
 * Generate registration number from details
 * @param {number} year - Enrollment year (2024)
 * @param {string} programCode - Program code (AI, IOT, etc.)
 * @param {number} studentNo - Student number (1-999)
 * @returns {string} Registration number
 */
export function generateRegistrationNo(year, programCode, studentNo) {
  return `${year}${programCode.toUpperCase()}${String(studentNo).padStart(3, '0')}`;
}

/**
 * Get all students by batch from registration list
 * @param {array} registrations - Array of registration numbers
 * @returns {object} Grouped by batch
 */
export function groupByBatch(registrations = []) {
  const grouped = {};
  registrations.forEach(reg => {
    const parsed = parseRegistrationNo(reg);
    if (parsed.isValid) {
      const batch = parsed.batch;
      if (!grouped[batch]) grouped[batch] = [];
      grouped[batch].push(parsed);
    }
  });
  return grouped;
}

/**
 * Get all students by program
 * @param {array} registrations - Array of registration numbers
 * @returns {object} Grouped by program
 */
export function groupByProgram(registrations = []) {
  const grouped = {};
  registrations.forEach(reg => {
    const parsed = parseRegistrationNo(reg);
    if (parsed.isValid) {
      const program = parsed.program;
      if (!grouped[program]) grouped[program] = [];
      grouped[program].push(parsed);
    }
  });
  return grouped;
}

/**
 * Get all students by branch
 * @param {array} registrations - Array of registration numbers
 * @returns {object} Grouped by branch
 */
export function groupByBranch(registrations = []) {
  const grouped = {};
  registrations.forEach(reg => {
    const parsed = parseRegistrationNo(reg);
    if (parsed.isValid) {
      const branch = parsed.branch;
      if (!grouped[branch]) grouped[branch] = [];
      grouped[branch].push(parsed);
    }
  });
  return grouped;
}

/**
 * Filter students by criteria
 * @param {array} registrations - Array of registration numbers
 * @param {object} criteria - Filter criteria {batch, program, branch, school}
 * @returns {array} Filtered students
 */
export function filterStudents(registrations = [], criteria = {}) {
  return registrations.filter(reg => {
    const parsed = parseRegistrationNo(reg);
    if (!parsed.isValid) return false;

    if (criteria.batch && parsed.year !== parseInt(criteria.batch)) return false;
    if (criteria.program && parsed.branch !== criteria.program) return false;
    if (criteria.branch && parsed.branch !== criteria.branch) return false;
    if (criteria.school && parsed.school !== criteria.school) return false;

    return true;
  });
}

/**
 * Validate registration number
 * @param {string} regNo - Registration number
 * @returns {boolean} Is valid Centurion registration
 */
export function isValidRegistration(regNo) {
  const parsed = parseRegistrationNo(regNo);
  return parsed.isValid;
}

/**
 * Get all batches from registration list
 * @param {array} registrations - Array of registration numbers
 * @returns {array} Sorted batch years
 */
export function getAllBatches(registrations = []) {
  const batches = new Set();
  registrations.forEach(reg => {
    const parsed = parseRegistrationNo(reg);
    if (parsed.isValid) batches.add(String(parsed.year));
  });
  return Array.from(batches).sort().reverse();
}

/**
 * Get all programs from registration list
 * @param {array} registrations - Array of registration numbers
 * @returns {array} Unique programs
 */
export function getAllPrograms(registrations = []) {
  const programs = new Set();
  registrations.forEach(reg => {
    const parsed = parseRegistrationNo(reg);
    if (parsed.isValid) programs.add(parsed.program);
  });
  return Array.from(programs).sort();
}

/**
 * Get all branches from registration list
 * @param {array} registrations - Array of registration numbers
 * @returns {array} Unique branches
 */
export function getAllBranches(registrations = []) {
  const branches = new Set();
  registrations.forEach(reg => {
    const parsed = parseRegistrationNo(reg);
    if (parsed.isValid) branches.add(parsed.branch);
  });
  return Array.from(branches).sort();
}

export default {
  parseRegistrationNo,
  extractBatchFromReg,
  extractProgramFromReg,
  getSchoolFromReg,
  getExpectedSemester,
  generateRegistrationNo,
  groupByBatch,
  groupByProgram,
  groupByBranch,
  filterStudents,
  isValidRegistration,
  getAllBatches,
  getAllPrograms,
  getAllBranches,
  programCodes,
  campusMap
};
