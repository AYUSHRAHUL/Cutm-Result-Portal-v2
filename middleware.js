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

    // 🔒 Role-based Route Protection
    if (path.startsWith("/dashboard/admin") && role !== "admin") {
      // Non-admin trying to access admin panel
      return NextResponse.redirect(new URL(`/dashboard/${role}`, req.url));
    }

    if (path.startsWith("/dashboard/teacher") && role !== "teacher") {
      // Non-teacher trying to access teacher panel
      return NextResponse.redirect(new URL(`/dashboard/${role}`, req.url));
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

    // Redirect logged-in user to their dashboard
    const target =
      role === "admin"
        ? "/dashboard/admin"
        : role === "teacher"
        ? "/dashboard/teacher"
        : "/dashboard/user";

    return NextResponse.redirect(new URL(target, req.url));
  }

  // ✅ Default allow
  return NextResponse.next();
}

// ✅ Apply middleware to specific routes
export const config = {
  matcher: ["/", "/login", "/dashboard/:path*"],
};
