# SOET (School of Engineering & Technology) Backend API

यह folder SOET (B.Tech) students के लिए dedicated backend routes contain करता है।

## 📁 Structure

```
soet/
├── batch/          # Batch-wise data (B.Tech only)
├── backlogs/       # Backlog management (B.Tech only)
└── README.md       # This file
```

## 🔧 Available Routes

### `/api/soet/batch` (POST)
- **Purpose:** Batch-wise result data for B.Tech students
- **School:** SOET (forced)
- **Program:** B.Tech only
- **Parameters:**
  - `branch`: Branch filter (CSE, ECE, EEE, Civil, Mechanical, AIML)
  - `batch`: Batch year (e.g., "2022", "2023")
  - `campus`: Optional campus parameter (pkd/bbsr)

### `/api/soet/backlogs` (POST)
- **Purpose:** Backlog management for B.Tech students
- **School:** SOET (forced)
- **Program:** B.Tech only
- **Parameters:**
  - `registration`: Student registration number
  - `branch`: Branch filter
  - `year`: Batch year
  - `semesters`: Array of semesters
  - `action`: "clear" (admin only)

## 🎯 Key Features

1. **B.Tech Only:** All routes automatically filter for B.Tech students
2. **School Enforced:** School is automatically set to "SOET"
3. **Campus Support:** Supports both PKD and BBSR campuses
4. **Role-Based Access:** Proper RBAC implementation

## 📊 Database

Routes use:
- `CUTMPKD` (PKD campus, SOET)
- `CUTMSOETBBSR` (BBSR campus, SOET)

## 🔐 Authentication

All routes require:
- Valid JWT token
- Appropriate role (admin/teacher/user)

## 📝 Notes

- These routes are school-specific and should be used when you know the school is SOET
- For generic routes that handle multiple schools, use the main `/api/*` routes
- All B.Tech branch codes are supported (CSE, ECE, EEE, Civil, Mechanical, AIML)
