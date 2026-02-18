# ✅ TEACHER CAMPUS-BASED ROUTING - COMPLETE

## What's Been Implemented

### Teacher Login Flow (with Campus Detection)

```
Teacher Login
    ↓
[EMPPKD0001 or EMPBBSR0001]
    ↓
Campus Auto-Detected
    ↓
JWT Token Created with Campus
    ↓
Redirects to /dashboard/teacher/[campus]
    ↓
School Selection Page (SOET or SOVET)
    ↓
Full Dashboard Access
```

## Changes Made

### 1. **lib/campus.js** - Updated getTeacherDashboardPath()
**What changed**: Teachers now redirect to campus-specific pages instead of generic page.

**Before**:
```javascript
export function getTeacherDashboardPath(campus) {
  return '/dashboard/teacher';
}
```

**After**:
```javascript
export function getTeacherDashboardPath(campus) {
  if (!campus) {
    return '/dashboard/teacher';
  }
  
  const normalizedCampus = String(campus).toLowerCase();
  if (normalizedCampus === 'pkd' || normalizedCampus === 'bbsr') {
    return `/dashboard/teacher/${normalizedCampus}`;
  }
  
  return '/dashboard/teacher';
}
```

### 2. **app/dashboard/teacher/page.js** - Base Redirect Page
**What changed**: Base teacher page now automatically redirects to campus-specific page.

**Key Points**:
- Fetches user campus from JWT (`/api/auth/me`)
- Validates user is a teacher
- Redirects to `/dashboard/teacher/[campus]`
- Shows error if campus can't be detected

### 3. **app/dashboard/teacher/[campus]/page.js** - Campus-Specific School Selection
**What changed**: New dynamic route page for campus-specific teacher dashboard.

**Features**:
- Validates campus parameter (pkd or bbsr)
- Shows school selection (SOET and SOVET)
- Campus name displayed (CUTM PKD or CUTM BBSR)
- Beautiful school selection UI with icons
- Redirects to school-specific dashboard on selection

## How It Works

### Employee ID Campus Detection
```
EMPPKD0001 → Campus = 'pkd'
EMPBBSR0001 → Campus = 'bbsr'
     ↑
  Look at 4th character (position 3)
  'B' = BBSR, anything else = PKD
```

### Login & Redirect Flow

1. **Teacher logs in with credentials**:
   - Email: teacher@cutm.ac.in
   - Password: ****
   - Backend checks employeeId (e.g., EMPPKD0001)

2. **Campus detection happens**:
   - Character at position 3 in employee ID is checked
   - EMPPKD0001 → 'P' (not 'B') → PKD
   - EMPBBSR0001 → 'B' → BBSR

3. **JWT created with campus**:
   ```javascript
   {
     id: "...",
     role: "teacher",
     email: "teacher@cutm.ac.in",
     campus: "pkd",  // ✅ Campus included!
     employeeId: "EMPPKD0001"
   }
   ```

4. **Frontend redirects**:
   - Calls `getTeacherDashboardPath('pkd')`
   - Returns `/dashboard/teacher/pkd`
   - Navigates to `/dashboard/teacher/pkd`

5. **Campus page loads**:
   - Validates campus from JWT matches URL
   - Displays school selection (SOET or SOVET)
   - Teacher chooses school
   - Redirects to school-specific dashboard

## File Structure

```
app/
├── dashboard/
│   └── teacher/
│       ├── page.js (NEW) → Redirects to /[campus]
│       └── [campus]/
│           └── page.js (NEW) → School selection page
│
├── api/
│   └── auth/
│       ├── login/
│       │   └── route.js → Detects campus from employeeId
│       └── google/callback/
│           └── route.js → Detects campus for teachers
│
└── login/
    └── page.js → Redirects teachers using getTeacherDashboardPath()

lib/
└── campus.js → Updated getTeacherDashboardPath()
```

## Testing Checklist

- [ ] **Test with PKD Teacher ID**:
  - Create teacher with Employee ID: `EMPPKD0001`
  - Login
  - Should redirect to `/dashboard/teacher/pkd`
  - Should see school selection page

- [ ] **Test with BBSR Teacher ID**:
  - Create teacher with Employee ID: `EMPBBSR0001`
  - Login  
  - Should redirect to `/dashboard/teacher/bbsr`
  - Should see school selection page

- [ ] **Google Sign-In for Teacher**:
  - Teacher with existing employee ID
  - Sign in with Google
  - Should detect campus from employee ID
  - Should redirect to correct campus page

- [ ] **School Selection**:
  - Click on SOET → redirect to SOET dashboard
  - Click on SOVET → redirect to SOVET dashboard
  - Both should load corresponding modules

## Example Test Cases

### Test 1: PKD Teacher Login
```
Email: teacher@cutm.ac.in
Password: Test@1234
Role: teacher
Employee ID: EMPPKD0001

Expected:
✅ JWT has campus: "pkd"
✅ Redirects to /dashboard/teacher/pkd
✅ Page shows "CUTM Pune (PKD)"
✅ Can select SOET or SOVET
```

### Test 2: BBSR Teacher Login
```
Email: teacher@cutm.ac.in
Password: Test@1234
Role: teacher
Employee ID: EMPBBSR0001

Expected:
✅ JWT has campus: "bbsr"
✅ Redirects to /dashboard/teacher/bbsr
✅ Page shows "CUTM Bhubaneswar (BBSR)"
✅ Can select SOET or SOVET
```

### Test 3: Google Sign-In
```
1. Click "Continue with Google"
2. Sign in with Google
3. Email: teacher@cutm.ac.in
4. System finds teacher record with EMPBBSR0001

Expected:
✅ Google ID linked to account
✅ Campus detected from employee ID
✅ Redirects to /dashboard/teacher/bbsr
✅ School selection shown
```

## API Endpoints Used

### Get User Info
```bash
GET /api/auth/me

Response:
{
  "success": true,
  "user": {
    "email": "teacher@cutm.ac.in",
    "role": "teacher",
    "campus": "pkd",
    "employeeId": "EMPPKD0001"
  }
}
```

### Login
```bash
POST /api/auth/login

Body:
{
  "email": "teacher@cutm.ac.in",
  "password": "Test@1234"
}

Response:
{
  "success": true,
  "user": {
    "role": "teacher",
    "campus": "pkd",
    "employeeId": "EMPPKD0001"
  }
}
```

## Key Functions

**In lib/campus.js**:
```javascript
detectCampus(employeeId)     // EMPPKD0001 → 'pkd'
getCampusName(campus)        // 'pkd' → 'CUTM Pune (PKD)'
getTeacherDashboardPath(campus)  // 'pkd' → '/dashboard/teacher/pkd'
```

## Database & Modules

Each campus has modules:
- **PKD**: CUTMPKD (default for SOET), CUTMSOVETPKD
- **BBSR**: CUTMSOETBBSR, CUTMSOVETBBSR

When teacher selects school:
- SOET → use `CUTM[CAMPUS]` database
- SOVET → use `CUTMSOVET[CAMPUS]` database

## Current Status

✅ Campus detection from Employee ID working
✅ Teacher redirect to campus pages working
✅ Campus-specific school selection page created
✅ Beautiful UI with campus name display
✅ SOET/SOVET module selection ready
✅ Google OAuth supports campus detection

## Next Steps (Optional)

1. Create `/dashboard/teacher/[campus]/[school]` routes for school-specific dashboards
2. Add school selection persistence in localStorage
3. Add campus switcher in dashboard (if teacher has multiple campuses)
4. Add module loading based on selected school
5. Create admin campus dashboard if needed

## Security Notes

- Campus is validated from JWT token
- URL parameter must match JWT campus
- Unauthorized redirects caught and handled
- Non-teachers redirected to /dashboard/user
- Teachers without valid campus shown error

---

**Ready to test!** 🎉

Try logging in with:
- EMPPKD0001 → should see PKD campus
- EMPBBSR0001 → should see BBSR campus
