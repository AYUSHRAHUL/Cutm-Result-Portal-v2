import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

/**
 * Shared authentication helpers for API routes.
 *
 * next.js middleware does NOT cover /api/* - middleware.js only matches
 * ["/", "/login", "/dashboard/:path*"] - so every API route has to authenticate
 * for itself. Several routes previously parsed the token only to read
 * payload.campus, inside a swallowing try/catch, which meant a missing, expired
 * or forged token still reached the handler.
 */

/**
 * Verify the session cookie and return its payload, or null when the request
 * carries no token or an invalid one.
 */
export async function verifyRequestToken(req) {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
    const { payload } = await jwtVerify(token, secret);
    return payload?.email ? payload : null;
  } catch {
    return null;
  }
}

/**
 * Require an authenticated user holding one of `allowedRoles`.
 *
 * Returns `{ payload, error }`. When `error` is non-null it is a ready-to-return
 * NextResponse (401 or 403) and the caller must return it immediately:
 *
 *   const { payload, error } = await requireRole(req, ["admin"]);
 *   if (error) return error;
 *
 * @param {Request} req
 * @param {string[]} allowedRoles - e.g. ["admin"] or ["admin", "teacher"]
 */
export async function requireRole(req, allowedRoles) {
  const payload = await verifyRequestToken(req);

  if (!payload) {
    return {
      payload: null,
      error: NextResponse.json(
        { error: "Unauthorized - Please login first" },
        { status: 401 }
      ),
    };
  }

  const role = String(payload.role || "").toLowerCase();
  const allowed = allowedRoles.map(r => String(r).toLowerCase());

  // "superadmin" is a superset of "admin" (see app/api/auth/login/route.js, which
  // normalises superadmin / super_admin / super-admin), so it satisfies anything
  // admin would. Without this a superadmin would be denied their own admin pages.
  const held = role === "superadmin" ? ["superadmin", "admin"] : [role];

  if (!allowed.some(r => held.includes(r))) {
    return {
      payload,
      error: NextResponse.json(
        { error: `Access denied - this action requires ${allowedRoles.join(" or ")} access` },
        { status: 403 }
      ),
    };
  }

  return { payload, error: null };
}
