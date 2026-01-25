## Turbopack workspace-root warning

If you see this in `npm run dev`:

`Next.js inferred your workspace root ... detected multiple lockfiles ... selected C:\Users\rahul\package-lock.json`

It means there is another `package-lock.json` outside this repo (likely at `C:\Users\rahul\package-lock.json`), and Turbopack picks the wrong root.

### Fix options

1. **Recommended:** Delete the extra lockfile:
   - Remove `C:\Users\rahul\package-lock.json` if it is not needed.

2. **Alternative:** Set Turbopack root in `next.config.mjs`:
   - Configure `turbopack.root` to point to this repo directory.

This warning can cause confusing module resolution issues in dev, so it’s best to fix it early.


