# SOVET (School of Vocational Education & Training) Backend API

यह folder SOVET (Diploma) students के लिए dedicated backend routes contain करता है।

## 📁 Structure

```
sovet/
├── batch/          # Batch-wise data (Diploma only)
├── backlogs/       # Backlog management (Diploma only)
└── README.md       # This file
```

## 🔧 Available Routes

### `/api/sovet/batch` (POST)
- **Purpose:** Batch-wise result data for Diploma students
- **School:** SOVET (forced)
- **Program:** Diploma only
- **Parameters:**
  - `branch`: Branch filter (Diploma-EE, Diploma-ME, Diploma-CE, Diploma-CSE, Diploma-AE, Diploma-MiE, Diploma-ECE)
  - `batch`: Batch year (e.g., "2022", "2023")
  - `campus`: Optional campus parameter (pkd/bbsr)

### `/api/sovet/backlogs` (POST)
- **Purpose:** Backlog management for Diploma students
- **School:** SOVET (forced)
- **Program:** Diploma only
- **Parameters:**
  - `registration`: Student registration number
  - `branch`: Branch filter (Diploma branch codes)
  - `year`: Batch year
  - `semesters`: Array of semesters
  - `action`: "clear" (admin only)

## 🎯 Key Features

1. **Diploma Only:** All routes automatically filter for Diploma students
2. **School Enforced:** School is automatically set to "SOVET"
3. **Campus Support:** Supports both PKD and BBSR campuses
4. **Role-Based Access:** Proper RBAC implementation
5. **8th Digit Mapping:** Uses 8th digit of registration for branch detection (SOVET specific logic)

## 📊 Database

Routes use:
- `CUTMSOVETPKD` (PKD campus, SOVET)
- `CUTMSOVETBBSR` (BBSR campus, SOVET)

## 🔐 Authentication

All routes require:
- Valid JWT token
- Appropriate role (admin/teacher/user)

## 📝 Notes

- These routes are school-specific and should be used when you know the school is SOVET
- For generic routes that handle multiple schools, use the main `/api/*` routes
- All Diploma branch codes are supported:
  - EE (Electrical) - Code: 11
  - ME (Mechanical) - Code: 12
  - CE (Civil) - Code: 13
  - CSE (Computer Science) - Codes: 40, 41, 14, 43
  - AE (Automobile) - Code: 15
  - MiE (Mining) - Code: 16
  - ECE (Electronics) - Code: 47

## 🔍 Branch Detection Logic

SOVET uses 8th digit mapping for branch detection:
- Digit '1' → EE (Electrical)
- Digit '2' → ME (Mechanical)
- Digit '3' → CE (Civil)
- Digit '4' → CSE (Computer Science)
- Digit '6' → Mining
- Digit '7' → Automobile
