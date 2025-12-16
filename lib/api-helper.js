/**
 * API Helper Utility
 * Provides functions to append campus and school parameters to API URLs
 */

/**
 * Get school and campus from localStorage and URL parameters
 * Priority: URL params > localStorage
 * @returns {Object} { school: string|null, campus: string|null }
 */
export function getSchoolAndCampus() {
  if (typeof window === 'undefined') {
    return { school: null, campus: null };
  }
  
  // First, try to get from URL parameters (highest priority)
  const urlParams = new URLSearchParams(window.location.search);
  const urlSchool = urlParams.get('school');
  const urlCampus = urlParams.get('campus');
  
  // Fallback to localStorage if not in URL
  const lsSchool = localStorage.getItem('selectedSchool') || localStorage.getItem('school');
  const lsCampus = localStorage.getItem('selectedCampus') || localStorage.getItem('campus');
  
  // Use URL params if available, otherwise use localStorage
  const school = urlSchool || lsSchool || null;
  const campus = urlCampus || lsCampus || null;
  
  // If we got values from URL, also store them in localStorage for future use
  if (urlSchool && urlSchool !== lsSchool) {
    localStorage.setItem('selectedSchool', urlSchool);
    localStorage.setItem('school', urlSchool);
  }
  if (urlCampus && urlCampus !== lsCampus) {
    localStorage.setItem('selectedCampus', urlCampus);
    localStorage.setItem('campus', urlCampus);
  }
  
  return {
    school: school || null,
    campus: campus || null
  };
}

/**
 * Append school and campus parameters to a URL
 * @param {string} url - Base URL (can include existing query params)
 * @returns {string} URL with school and campus parameters appended
 */
export function appendSchoolParams(url) {
  if (typeof window === 'undefined') {
    return url;
  }
  
  const { school, campus } = getSchoolAndCampus();
  
  if (!school && !campus) {
    return url;
  }
  
  try {
    // Handle relative URLs
    const baseUrl = url.startsWith('http') ? url : window.location.origin + url;
    const urlObj = new URL(baseUrl);
    
    if (school) {
      urlObj.searchParams.set('school', school);
    }
    
    if (campus) {
      urlObj.searchParams.set('campus', campus);
    }
    
    // Return relative URL if input was relative
    if (!url.startsWith('http')) {
      return urlObj.pathname + urlObj.search;
    }
    
    return urlObj.toString();
  } catch (e) {
    // If URL parsing fails, manually append
    const separator = url.includes('?') ? '&' : '?';
    const params = [];
    
    if (school) params.push(`school=${encodeURIComponent(school)}`);
    if (campus) params.push(`campus=${encodeURIComponent(campus)}`);
    
    const result = params.length > 0 ? `${url}${separator}${params.join('&')}` : url;
    
    // Clean up any malformed query strings (e.g., ?param=value?param2=value2)
    return result.replace(/\?([^&]*)\?/g, '?$1&').replace(/\?([^&]*)\?/g, '?$1&');
  }
}

/**
 * Create fetch options with school and campus in URL
 * @param {string} url - Base API URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export async function fetchWithSchool(url, options = {}) {
  const urlWithParams = appendSchoolParams(url);
  return fetch(urlWithParams, {
    ...options,
    credentials: 'include'
  });
}

/**
 * Get school-specific API route
 * Automatically routes to /api/soet/* or /api/sovet/* based on school
 * @param {string} endpoint - API endpoint (e.g., "batch", "backlogs", "result")
 * @returns {string} School-specific API route
 */
export function getSchoolApiRoute(endpoint) {
  if (typeof window === 'undefined') {
    return `/api/${endpoint}`;
  }

  const { school } = getSchoolAndCampus();
  
  // Normalize school value
  const schoolLower = school ? String(school).toLowerCase() : null;
  
  // Map to school-specific route
  if (schoolLower === 'soet' || schoolLower === 'soe') {
    return `/api/soet/${endpoint}`;
  } else if (schoolLower === 'sovet' || schoolLower === 'sov') {
    return `/api/sovet/${endpoint}`;
  }
  
  // Default fallback (for backward compatibility or when school is unknown)
  return `/api/${endpoint}`;
}

/**
 * Append school params and route to school-specific endpoint
 * @param {string} endpoint - API endpoint (e.g., "batch", "backlogs", "cbcs/123")
 * @returns {string} School-specific URL with campus params
 */
export function getSchoolApiUrl(endpoint) {
  // Handle nested endpoints like "cbcs/123" or "upload/cbcs"
  if (endpoint.includes('/')) {
    const parts = endpoint.split('/');
    const baseEndpoint = parts[0];
    const subPath = parts.slice(1).join('/');
    const route = getSchoolApiRoute(baseEndpoint);
    const fullRoute = `${route}/${subPath}`;
    return appendSchoolParams(fullRoute);
  }
  
  const route = getSchoolApiRoute(endpoint);
  return appendSchoolParams(route);
}

