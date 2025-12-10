"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for error message from URL params (e.g., from Google OAuth callback)
    const error = searchParams?.get("error");
    if (error) {
      setMessage(decodeURIComponent(error));
    }
  }, [searchParams]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!data.success) {
        setMessage(data.error || "Invalid credentials, please try again.");
        setLoading(false);
        return;
      }

      setMessage("✅ Login successful! Redirecting...");

      const role = String(data?.user?.role || "user").toLowerCase();
      const target =
        role === "admin"
          ? "/dashboard/admin"
          : role === "teacher"
          ? "/dashboard/teacher"
          : "/dashboard/user";

      window.location.replace(target);
    } catch (err) {
      console.error("Login error:", err);
      setMessage("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col lg:flex-row bg-[#F4F7FA] text-[#1A1F29] overflow-hidden">
      {/* LEFT PANEL */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[#05A3C7] via-[#04748F] to-[#023945] text-white items-center justify-center relative overflow-hidden">
        {/* Decorative gradient orbs */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-32 w-80 h-80 bg-[#F18F01]/30 blur-3xl rounded-full animate-pulse" />
          <div className="absolute bottom-20 right-32 w-80 h-80 bg-white/25 blur-3xl rounded-full animate-pulse" />
        </div>

        <div className="relative z-10 max-w-lg px-8">
          <div className="w-24 h-24 mx-auto mb-5 rounded-3xl overflow-hidden shadow-2xl ring-4 ring-white/20 bg-white p-1">
            <Image
              src="/cutmlogo.png"
              alt="CUTM Logo"
              width={96}
              height={96}
              className="object-contain w-full h-full"
              priority
            />
          </div>
          <h1 className="text-3xl xl:text-4xl font-bold mb-3 leading-snug text-center">
            Welcome to{" "}
            <span className="text-[#F18F01] block">
              CUTM Academic Tracker
            </span>
          </h1>
          <p className="text-white/90 text-base xl:text-lg leading-relaxed mb-6 text-center">
            Your one-stop academic management system — track progress, backlog,
            and results seamlessly.
          </p>

          <div className="space-y-2.5">
            {[
              { icon: "📘", text: "Access Academic Results" },
              { icon: "🧾", text: "Manage CBCS & Backlogs" },
              { icon: "🧑‍🏫", text: "Faculty & Student Portals" },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-white/10 p-2.5 rounded-xl border border-white/20 hover:bg-white/20 transition"
              >
                <div className="text-lg">{item.icon}</div>
                <span className="font-semibold text-sm">{item.text}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            {[
              { value: "10K+", label: "Students" },
              { value: "500+", label: "Faculty" },
              { value: "99.9%", label: "Uptime" },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl xl:text-3xl font-extrabold text-[#F18F01]">
                  {stat.value}
                </div>
                <div className="text-xs text-white/80">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-full lg:w-1/2 flex items-center justify-center relative bg-white overflow-y-auto">
        {/* Background circles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-20 w-80 h-80 bg-[#05A3C7]/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-[#F18F01]/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-md px-6 py-8 lg:py-4">
          {/* Logo on mobile */}
          <div className="lg:hidden text-center mb-4">
            <div className="w-16 h-16 mx-auto mb-2 rounded-2xl overflow-hidden shadow-xl ring-2 ring-[#05A3C7]/30 bg-white p-1">
              <Image
                src="/cutmlogo.png"
                alt="CUTM Logo"
                width={64}
                height={64}
                className="object-contain w-full h-full"
              />
            </div>
            <h2 className="text-xl font-extrabold">CUTM Portal</h2>
          </div>

          {/* Login Card */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-2xl border border-gray-100">
            <h1 className="text-2xl sm:text-3xl font-extrabold mb-1 text-[#1A1F29]">
              Welcome Back 👋
            </h1>
            <p className="text-[#5A6C7D] mb-4 text-xs sm:text-sm font-medium">
              Sign in to continue to your CUTM Portal
            </p>

            {/* Message */}
            {message && (
              <div
                className={`text-center mb-4 p-2.5 rounded-lg text-xs sm:text-sm font-semibold ${
                  message.includes("✅")
                    ? "bg-green-50 text-green-700 border border-green-300"
                    : "bg-red-50 text-red-700 border border-red-300"
                }`}
              >
                {message}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block font-semibold text-xs sm:text-sm mb-1 text-[#2E4057]">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="Enter your email"
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#05A3C7] focus:ring-2 focus:ring-[#05A3C7]/20 outline-none transition"
                />
              </div>

              <div>
                <label className="block font-semibold text-xs sm:text-sm mb-1 text-[#2E4057]">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  placeholder="Enter your password"
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-[#05A3C7] focus:ring-2 focus:ring-[#05A3C7]/20 outline-none transition"
                />
              </div>

              <div className="flex justify-between items-center text-xs sm:text-sm">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" className="text-[#05A3C7]" />
                  <span className="text-[#5A6C7D]">Remember me</span>
                </label>
                <a
                  href="/forgot-password"
                  className="text-[#05A3C7] font-semibold hover:underline"
                >
                  Forgot password?
                </a>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#05A3C7] to-[#04748F] text-white font-black py-3 rounded-lg shadow-lg hover:opacity-90 transition disabled:opacity-60 text-sm sm:text-base"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center my-4">
              <div className="flex-1 border-t border-gray-200" />
              <span className="px-2 text-gray-400 text-xs font-semibold">OR</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            {/* Google Button */}
            <button
              type="button"
              onClick={() => {
                window.location.href = "/api/auth/google";
              }}
              className="w-full flex items-center justify-center gap-2 border-2 border-gray-200 rounded-lg py-2.5 font-bold text-[#2E4057] hover:border-[#05A3C7] hover:bg-[#05A3C7]/10 transition text-sm"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25a10.1 10.1 0 0 0-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57a9 9 0 0 0 3.28-8.09Z" />
                <path fill="#34A853" d="M12 23a11 11 0 0 0 7.28-2.66l-3.57-2.77a6.9 6.9 0 0 1-10.87-3.47H2.18v2.84A11 11 0 0 0 12 23Z" />
                <path fill="#FBBC05" d="M5.84 14.09a7.5 7.5 0 0 1 0-4.18V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38a6.4 6.4 0 0 1 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.07l3.66 2.84a6.9 6.9 0 0 1 6.16-4.53Z" />
              </svg>
              Continue with Google
            </button>

            {/* Signup */}
            <p className="text-center text-xs sm:text-sm text-[#5A6C7D] mt-4">
              Don't have an account?{" "}
              <a
                href="/register"
                className="text-[#05A3C7] font-bold hover:underline"
              >
                Create one
              </a>
            </p>

            <p className="text-center text-xs text-[#A8B2BC] mt-3">
              © {new Date().getFullYear()} CUTM Portal. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#05A3C7] mx-auto"></div>
          <p className="mt-4 text-[#5A6C7D]">Loading...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}