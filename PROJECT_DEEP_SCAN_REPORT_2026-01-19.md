## Project deep scan (2026-01-19)

### What I scanned
- **App Router pages**: `app/dashboard/**`
- **API routes**: `app/api/**`
- **Core libs**: `lib/**`
- **Auth/middleware**: `middleware.js`, `app/api/auth/**`
- **Placement module**: `app/dashboard/admin/pkd/soet/placement/*`, `app/api/soet/placement/**`

### Key findings (high signal)
- **Turbopack root warning**
  - Dev server output shows Turbopack selecting the wrong workspace root due to an extra lockfile.
  - Notes + fix options: `TURBOPACK_ROOT_FIX.md`

- **Excessive debug logging in production paths**
  - `app/api/auth/me/route.js` + some dashboards log a lot.
  - Recommendation: gate logs behind `NODE_ENV === 'development'` (or remove).

- **Security note (existing)**
  - `components/AnalyticsDashboard.jsx` uses `innerHTML` in PDF/print flow (documented in `PROJECT_SCAN_REPORT.md`).
  - Recommendation: sanitize if any untrusted content can enter the HTML template.

### Placement module status
- **Data**
  - Upload supports **CSV + Excel**, flexible header mapping, validation, bulk upsert, and error reporting.
  - UI supports **search + filters + pagination + sorting + bulk select/delete + exports**.
- **Analytics**
  - Interactive charts: branch/batch/company analysis + package histogram.
- **Important fix applied**
  - Added numeric `packageLpa` field (alongside legacy `package` string) so filtering/analytics are numerically correct.

### Recommended next cleanup (optional)
- Gate/remove console logs:
  - `app/api/auth/me/route.js`
  - `app/dashboard/admin/result-data/page.js`
  - `app/api/soet/result-data/subjects/route.js`
- Consider sanitizing HTML template in `components/AnalyticsDashboard.jsx` print/PDF path.


