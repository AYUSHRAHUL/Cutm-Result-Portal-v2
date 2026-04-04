// import { NextResponse } from "next/server";
// import { jwtVerify } from "jose";

// async function verifyEdgeToken(token) {
//   try {
//     const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
//     const { payload } = await jwtVerify(token, secret);
//     return payload;
//   } catch {
//     return null;
//   }
// }

// export async function middleware(req) {
//   const token = req.cookies.get("token")?.value;
//   const path = req.nextUrl.pathname;

//   // If no token and trying to access dashboard, send to login
//   if (path.startsWith("/dashboard")) {
//     if (!token) return NextResponse.redirect(new URL("/login", req.url));

//     const decoded = await verifyEdgeToken(token);
//     if (!decoded) return NextResponse.redirect(new URL("/login", req.url));

//     // Role guard inside dashboard
//     if (path.startsWith("/dashboard/admin") && String(decoded.role).toLowerCase() !== "admin") {
//       return NextResponse.redirect(new URL("/dashboard/user", req.url));
//     }
//     if (path.startsWith("/dashboard/teacher") && String(decoded.role).toLowerCase() !== "teacher") {
//       return NextResponse.redirect(new URL("/dashboard/user", req.url));
//     }

//     return NextResponse.next();
//   }

//   // If visiting login or home and already authenticated, send to role dashboard
//   if (path === "/" || path === "/login") {
//     if (!token) return NextResponse.next();
//     const decoded = await verifyEdgeToken(token);
//     if (!decoded) return NextResponse.next();

//     const role = String(decoded.role || "user").toLowerCase();
//     const target = role === "admin"
//       ? "/dashboard/admin"
//       : role === "teacher"
//         ? "/dashboard/teacher"
//         : "/dashboard/user";
//     return NextResponse.redirect(new URL(target, req.url));
//   }

//   return NextResponse.next();
// }

// export const config = { matcher: ["/", "/login", "/dashboard/:path*"] };





import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getTeacherDashboardPath, getDashboardPathBySchool, getAdminDashboardPathBySchool, getTeacherDashboardPathBySchool, getUserDashboardPathBySchool } from "@/lib/campus";

// ✅ Verify JWT Token
async function verifyEdgeToken(token) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

// ✅ Main Middleware Function
export async function middleware(req) {
  const token = req.cookies.get("token")?.value;
  const path = req.nextUrl.pathname;

  // 🧩 Protected Dashboard Routes
  if (path.startsWith("/dashboard")) {
    // No token → redirect to login
    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Verify token
    const decoded = await verifyEdgeToken(token);
    if (!decoded) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const role = String(decoded.role || "user").toLowerCase();
    const school = decoded.school || null;

    // 🔒 Role-based Route Protection
    // Super admin can access all admin routes
    if (path.startsWith("/dashboard/admin") && role !== "admin" && role !== "superadmin") {
      // Non-admin trying to access admin panel
      return NextResponse.redirect(new URL(`/dashboard/${role}`, req.url));
    }
    
    // Super admin routing
    if (role === "superadmin") {
      if (path === "/dashboard/admin" || path.startsWith("/dashboard/admin/super")) {
        return NextResponse.next();
      }
      // Redirect super admin to super dashboard if accessing regular admin routes
      if (path.startsWith("/dashboard/admin") && !path.includes("/super")) {
        return NextResponse.redirect(new URL("/dashboard/admin/super", req.url));
      }
    }

    if (path.startsWith("/dashboard/teacher") && role !== "teacher") {
      // Non-teacher trying to access teacher panel
      return NextResponse.redirect(new URL(`/dashboard/${role}`, req.url));
    }
    
    // Campus-specific teacher routing (teachers use campus, not school)
    // Campus is detected from employee ID (EMPPKD -> PKD, EMPBBSR -> BBSR)
    if (role === "teacher" && path.startsWith("/dashboard/teacher")) {
      // Get campus from JWT, or detect from employeeId if not present
      let campus = decoded.campus || null;
      if (!campus && decoded.employeeId) {
        const { detectCampus } = await import("@/lib/campus");
        campus = detectCampus(decoded.employeeId);
      }
      
      // Allow base /dashboard/teacher route - it handles school selection
      if (path === "/dashboard/teacher" || path === "/dashboard/teacher/") {
        // Base route - let the page.js component handle school selection
        return NextResponse.next();
      }
      
      if (campus) {
        const campusPath = getTeacherDashboardPath(campus);
        
        // Only redirect if accessing wrong campus path
        // Allow all sub-routes under /dashboard/teacher/{campus}/*
        if (path.startsWith("/dashboard/teacher/") && !path.startsWith(campusPath)) {
          // Wrong campus path (e.g., /dashboard/teacher/bbsr when campus is pkd)
          // Only redirect if it's a different campus route
          const pathParts = path.split('/');
          if (pathParts.length >= 4 && pathParts[3] !== campus) {
            return NextResponse.redirect(new URL(campusPath, req.url));
          }
        }
        // Already on correct campus path or sub-route - allow
        return NextResponse.next();
      } else {
        // Teacher has no campus detected from employee ID - allow access to base teacher dashboard
        // They can manually select campus
        return NextResponse.next();
      }
    }
    
    // School-specific routing for admin and user (not teacher)
    if (school && (path.startsWith("/dashboard/admin") || path.startsWith("/dashboard/user"))) {
      const schoolPath = getDashboardPathBySchool(role, school);
      const basePath = `/dashboard/${role}`;
      const s = String(school).toLowerCase();

      // Users: only force school home for /dashboard/user; allow shared routes (result, basket-track, …)
      if (role === "user" && path.startsWith("/dashboard/user")) {
        if (path === "/dashboard/user" || path === "/dashboard/user/") {
          return NextResponse.redirect(new URL(schoolPath, req.url));
        }
        const schoolSlugs = ["soet", "som", "sovet"];
        for (const slug of schoolSlugs) {
          if (slug === s) continue;
          const prefix = `/dashboard/user/${slug}`;
          if (path === prefix || path.startsWith(`${prefix}/`)) {
            return NextResponse.redirect(new URL(schoolPath, req.url));
          }
        }
        return NextResponse.next();
      }

      if (path === basePath || (!path.includes(`/${role}/${s}`) && school)) {
        return NextResponse.redirect(new URL(schoolPath, req.url));
      }
    }

    if (path.startsWith("/dashboard/user") && role !== "user") {
      // Admin or teacher trying to access user panel
      return NextResponse.redirect(new URL(`/dashboard/${role}`, req.url));
    }

    // ✅ Authorized access → continue
    return NextResponse.next();
  }

  // 🏠 If visiting Home or Login
  if (path === "/" || path === "/login") {
    if (!token) {
      return NextResponse.next();
    }

    const decoded = await verifyEdgeToken(token);
    if (!decoded) {
      return NextResponse.next();
    }

    const role = String(decoded.role || "user").toLowerCase();
    const campus = decoded.campus || null;
    const school = decoded.school || null;

    // Redirect logged-in user to their dashboard
    let target;
    if (role === "superadmin") {
      target = "/dashboard/admin/super";
    } else if (role === "admin") {
      // Single admin dashboard for all admins
      target = "/dashboard/admin";
    } else if (role === "teacher") {
      // Teacher routing based on campus (from employee ID)
      // If campus not in JWT, try to detect from employeeId
      let teacherCampus = campus;
      if (!teacherCampus && decoded.employeeId) {
        const { detectCampus } = await import("@/lib/campus");
        teacherCampus = detectCampus(decoded.employeeId);
      }
      target = getTeacherDashboardPath(teacherCampus);
    } else {
      const sch = school ? String(school).toLowerCase() : "";
      if (sch && ["soet", "som", "sovet"].includes(sch)) {
        target = getUserDashboardPathBySchool(sch);
      } else {
        target = "/dashboard/user";
      }
    }

    return NextResponse.redirect(new URL(target, req.url));
  }

  // ✅ Default allow
  return NextResponse.next();
}

// ✅ Apply middleware to specific routes
export const config = {
  matcher: ["/", "/login", "/dashboard/:path*"],
};
