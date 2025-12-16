# Backend Organization - SOET & SOVET Separation

## 📁 Folder Structure Created

```
app/api/
├── soet/                    # ✅ SOET (B.Tech) specific routes
│   ├── batch/
│   │   └── route.js         # Batch data for B.Tech students
│   ├── backlogs/
│   │   └── route.js          # Backlog management for B.Tech
│   └── README.md             # SOET documentation
│
├── sovet/                    # ✅ SOVET (Diploma) specific routes
│   ├── batch/
│   │   └── route.js         # Batch data for Diploma students
│   ├── backlogs/
│   │   └── route.js          # Backlog management for Diploma
│   └── README.md             # SOVET documentation
│
└── [existing routes]         # Shared routes remain in main api folder
```

## 🎯 What Was Created

### SOET Routes (`/api/soet/`)
1. **`/api/soet/batch`** - B.Tech batch data
   - Automatically filters for B.Tech students only
   - Supports all B.Tech branches (CSE, ECE, EEE, Civil, Mechanical, AIML)
   - Uses databases: `CUTMPKD` or `CUTMSOETBBSR`

2. **`/api/soet/backlogs`** - B.Tech backlog management
   - B.Tech students only
   - Role-based access control
   - Supports clearing backlogs (admin only)

### SOVET Routes (`/api/sovet/`)
1. **`/api/sovet/batch`** - Diploma batch data
   - Automatically filters for Diploma students only
   - Supports all Diploma branches (EE, ME, CE, CSE, AE, MiE, ECE)
   - Uses databases: `CUTMSOVETPKD` or `CUTMSOVETBBSR`

2. **`/api/sovet/backlogs`** - Diploma backlog management
   - Diploma students only
   - Role-based access control
   - Supports clearing backlogs (admin only)
   - Uses 8th digit mapping for branch detection

## 🔑 Key Features

### School Enforcement
- Both SOET and SOVET routes **automatically set** the school parameter
- No need to pass `school` parameter - it's forced based on route

### Program Filtering
- **SOET routes:** Only process B.Tech students (`isBTech === true`)
- **SOVET routes:** Only process Diploma students (`isDiploma === true`)

### Database Selection
- Routes automatically select correct database based on:
  - Campus (PKD/BBSR) from query params or JWT
  - School (forced: SOET or SOVET)

## 📊 Usage Examples

### SOET Batch Data
```javascript
// Fetch B.Tech batch data
POST /api/soet/batch
{
  "branch": "CSE",
  "batch": "2023",
  "campus": "pkd"  // optional
}
```

### SOVET Batch Data
```javascript
// Fetch Diploma batch data
POST /api/sovet/batch
{
  "branch": "Diploma-CSE",
  "batch": "2023",
  "campus": "bbsr"  // optional
}
```

### SOET Backlogs
```javascript
// Fetch B.Tech backlogs
POST /api/soet/backlogs
{
  "branch": "CSE",
  "year": "2023",
  "semesters": ["Sem 1", "Sem 2"]
}
```

### SOVET Backlogs
```javascript
// Fetch Diploma backlogs
POST /api/sovet/backlogs
{
  "branch": "Diploma-EE",
  "year": "2023",
  "semesters": ["Sem 1"]
}
```

## 🔄 Migration Notes

### Existing Routes
- Main `/api/batch` and `/api/backlogs` routes **still work**
- They handle both SOET and SOVET based on `school` parameter
- New school-specific routes are **additions**, not replacements

### When to Use Which?

**Use School-Specific Routes (`/api/soet/*` or `/api/sovet/*`):**
- When you know the school upfront
- When you want to ensure only correct program type is processed
- When you want cleaner, more focused code

**Use Generic Routes (`/api/*`):**
- When school is dynamic or unknown
- When you need to support multiple schools in one call
- For backward compatibility

## 🚀 Future Enhancements

You can add more school-specific routes:
- `/api/soet/analytics/route.js`
- `/api/sovet/analytics/route.js`
- `/api/soet/students/route.js`
- `/api/sovet/students/route.js`
- `/api/soet/result/route.js`
- `/api/sovet/result/route.js`

## 📝 Documentation

Each folder has its own README:
- `app/api/soet/README.md` - SOET documentation
- `app/api/sovet/README.md` - SOVET documentation

---

**Created:** 2025-01-27  
**Status:** ✅ Complete
