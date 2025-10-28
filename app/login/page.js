"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

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

      router.replace(target);
    } catch (err) {
      console.error("Login error:", err);
      setMessage("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex overflow-hidden bg-gradient-to-br from-[#F5F8FA] via-[#E8F4F8] to-[#D1E9F6]">
      <style jsx global>{`
        @media (min-width: 1024px) {
          body {
            zoom: 0.67;
          }
        }
      `}</style>

      {/* Left Side - Image Section (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#05A3C7] via-[#04748F] to-[#023945] overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <div
            className="absolute top-1/4 left-1/4 w-72 h-72 xl:w-96 xl:h-96 rounded-full blur-3xl opacity-20 animate-pulse"
            style={{
              background:
                "radial-gradient(circle, rgba(241,143,1,0.4) 0%, transparent 70%)",
              animationDuration: "4s",
            }}
          />
          <div
            className="absolute bottom-1/4 right-1/4 w-72 h-72 xl:w-96 xl:h-96 rounded-full blur-3xl opacity-20 animate-pulse"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)",
              animationDuration: "6s",
              animationDelay: "1s",
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center items-center p-8 xl:p-12 text-white w-full">
          {/* Logo */}
          <div className="mb-6 xl:mb-8">
            <div className="relative w-24 h-24 xl:w-32 xl:h-32 rounded-3xl overflow-hidden shadow-2xl ring-4 ring-white/30">
              <Image
                src="/spinner.jpg"
                alt="CUTM Logo"
                width={128}
                height={128}
                className="object-cover"
                priority
              />
            </div>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl xl:text-5xl font-black text-center mb-4 xl:mb-6 leading-tight">
            Welcome to
            <br />
            <span className="text-[#F18F01]">CUTM Academic Tracker</span>
          </h1>

          <p className="text-lg xl:text-xl text-center text-white/90 mb-8 xl:mb-12 max-w-md font-medium leading-relaxed">
            Your gateway to academic excellence. Access results, track progress,
            and manage your academic journey seamlessly.
          </p>

          {/* Feature List */}
          <div className="space-y-3 xl:space-y-4 w-full max-w-md">
            {[
              {
                icon: (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5 xl:w-6 xl:h-6"
                  >
                    <path d="M11.7 2.805a.75.75 0 0 1 .6 0A60.65 60.65 0 0 1 22.83 8.72a.75.75 0 0 1-.231 1.337 49.948 49.948 0 0 0-9.902 3.912l-.003.002c-.114.06-.227.119-.34.18a.75.75 0 0 1-.707 0A50.88 50.88 0 0 0 7.5 12.173v-.224c0-.131.067-.248.172-.311a54.615 54.615 0 0 1 4.653-2.52.75.75 0 0 0-.65-1.352 56.123 56.123 0 0 0-4.78 2.589 1.858 1.858 0 0 0-.859 1.228 49.803 49.803 0 0 0-4.634-1.527.75.75 0 0 1-.231-1.337A60.653 60.653 0 0 1 11.7 2.805Z" />
                    <path d="M13.06 15.473a48.45 48.45 0 0 1 7.666-3.282c.134 1.414.22 2.843.255 4.284a.75.75 0 0 1-.46.711 47.87 47.87 0 0 0-8.105 4.342.75.75 0 0 1-.832 0 47.87 47.87 0 0 0-8.104-4.342.75.75 0 0 1-.461-.71c.035-1.442.121-2.87.255-4.286.921.304 1.83.634 2.726.99v1.27a1.5 1.5 0 0 0-.14 2.508c-.09.38-.222.753-.397 1.11.452.213.901.434 1.346.66a6.727 6.727 0 0 0 .551-1.607 1.5 1.5 0 0 0 .14-2.67v-.645a48.549 48.549 0 0 1 3.44 1.667 2.25 2.25 0 0 0 2.12 0Z" />
                  </svg>
                ),
                text: "Instant Result Access",
              },
              {
                icon: (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5 xl:w-6 xl:h-6"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z"
                      clipRule="evenodd"
                    />
                  </svg>
                ),
                text: "Secure & Private",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="flex items-center gap-3 xl:gap-4 p-3 xl:p-4 rounded-xl backdrop-blur-sm bg-white/10 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105"
              >
                <div className="flex-shrink-0 w-10 h-10 xl:w-12 xl:h-12 rounded-lg bg-white/20 flex items-center justify-center">
                  {feature.icon}
                </div>
                <span className="text-base xl:text-lg font-bold">
                  {feature.text}
                </span>
              </div>
            ))}
          </div>

          {/* Bottom Stats */}
          <div className="mt-8 xl:mt-12 grid grid-cols-3 gap-6 xl:gap-8 w-full max-w-md">
            {[
              { value: "10K+", label: "Students" },
              { value: "500+", label: "Faculty" },
              { value: "99.9%", label: "Uptime" },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl xl:text-3xl font-black text-[#F18F01] mb-1">
                  {stat.value}
                </div>
                <div className="text-xs xl:text-sm text-white/80 font-bold uppercase tracking-wider">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-8 xl:p-12 relative bg-gradient-to-br from-[#F5F8FA] via-[#E8F4F8] to-[#D1E9F6]">
        {/* Background Decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute -top-40 -right-40 w-60 h-60 sm:w-80 sm:h-80 rounded-full blur-3xl opacity-10"
            style={{
              background:
                "radial-gradient(circle, rgba(5,163,199,0.3) 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute -bottom-40 -left-40 w-60 h-60 sm:w-80 sm:h-80 rounded-full blur-3xl opacity-10"
            style={{
              background:
                "radial-gradient(circle, rgba(241,143,1,0.3) 0%, transparent 70%)",
            }}
          />
        </div>

        {/* Login Card */}
        <div className="relative w-full max-w-md z-10">
          {/* Mobile Logo - Only visible on small screens */}
          <div className="lg:hidden mb-6 sm:mb-8 text-center">
            <div className="inline-block relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shadow-xl ring-2 ring-[#05A3C7]/30 mb-3 sm:mb-4">
              <Image
                src="/spinner.jpg"
                alt="CUTM Logo"
                width={80}
                height={80}
                className="object-cover"
                priority
              />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#1A1F29]">
              CUTM Portal
            </h2>
          </div>

          <div
            className="rounded-2xl sm:rounded-3xl border-2 p-6 sm:p-8 lg:p-10 shadow-2xl bg-white"
            style={{
              borderColor: "rgba(5,163,199,0.2)",
            }}
          >
            {/* Header */}
            <div className="mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#1A1F29] mb-2 sm:mb-3">
                Welcome Back
              </h1>
              <p className="text-[#5A6C7D] text-sm sm:text-base font-medium">
                Sign in to access your CUTM Portal account
              </p>
            </div>

            {/* Message Alert */}
            {message && (
              <div
                className={`text-center text-xs sm:text-sm mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl font-bold ${
                  message.includes("✅")
                    ? "bg-green-50 text-green-700 border-2 border-green-200"
                    : "bg-red-50 text-red-700 border-2 border-red-200"
                }`}
              >
                {message}
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 lg:space-y-6">
              {/* Email Field */}
              <div>
                <label className="block text-[#2E4057] font-bold mb-1.5 sm:mb-2 text-xs sm:text-sm">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none text-[#5A6C7D]">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-4 h-4 sm:w-5 sm:h-5"
                    >
                      <path d="M1.5 8.67v6.58a2.25 2.25 0 0 0 2.25 2.25h16.5a2.25 2.25 0 0 0 2.25-2.25V8.67l-9.03 4.52a2.25 2.25 0 0 1-2.01 0L1.5 8.67z" />
                      <path d="M22.5 6.75v-.21A2.25 2.25 0 0 0 20.25 4.5H3.75A2.25 2.25 0 0 0 1.5 6.54v.21l9.72 4.86a.75.75 0 0 0 .66 0L22.5 6.75z" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    placeholder="Enter your email address"
                    className="w-full rounded-xl border-2 bg-white pl-10 sm:pl-12 pr-4 sm:pr-5 py-2.5 sm:py-3 lg:py-3.5 outline-none transition-all duration-200 text-[#1A1F29] placeholder-[#A8B2BC] font-medium text-sm sm:text-base"
                    style={{
                      borderColor: "rgba(5,163,199,0.2)",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#05A3C7";
                      e.currentTarget.style.boxShadow =
                        "0 0 0 3px rgba(5,163,199,0.1)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(5,163,199,0.2)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-[#2E4057] font-bold mb-1.5 sm:mb-2 text-xs sm:text-sm">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none text-[#5A6C7D]">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-4 h-4 sm:w-5 sm:h-5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M12 1.5a4.5 4.5 0 0 0-4.5 4.5v3H6a3 3 0 0 0-3 3v6A3 3 0 0 0 6 21h12a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3h-1.5v-3A4.5 4.5 0 0 0 12 1.5Zm-3 7.5v-3a3 3 0 1 1 6 0v3H9Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <input
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    required
                    placeholder="Enter your password"
                    className="w-full rounded-xl border-2 bg-white pl-10 sm:pl-12 pr-4 sm:pr-5 py-2.5 sm:py-3 lg:py-3.5 outline-none transition-all duration-200 text-[#1A1F29] placeholder-[#A8B2BC] font-medium text-sm sm:text-base"
                    style={{
                      borderColor: "rgba(5,163,199,0.2)",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#05A3C7";
                      e.currentTarget.style.boxShadow =
                        "0 0 0 3px rgba(5,163,199,0.1)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor =
                        "rgba(5,163,199,0.2)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    className="w-4 h-4 sm:w-5 sm:h-5 rounded border-2 text-[#05A3C7] focus:ring-2 focus:ring-[#05A3C7] focus:ring-offset-0"
                    style={{ borderColor: "rgba(5,163,199,0.3)" }}
                  />
                  <span className="text-xs sm:text-sm font-bold text-[#5A6C7D] group-hover:text-[#05A3C7] transition-colors">
                    Remember me
                  </span>
                </label>
                <a
                  href="/forgot-password"
                  className="text-xs sm:text-sm font-bold text-[#05A3C7] hover:text-[#04748F] transition-colors"
                >
                  Forgot password?
                </a>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl text-white font-black py-3 sm:py-3.5 lg:py-4 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] text-sm sm:text-base touch-manipulation"
                style={{
                  background:
                    "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.background =
                      "linear-gradient(135deg, #04748F 0%, #023945 100%)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.currentTarget.style.background =
                      "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)";
                  }
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-5 sm:my-6 lg:my-8">
              <div className="absolute inset-0 flex items-center">
                <div
                  className="w-full border-t-2"
                  style={{ borderColor: "rgba(5,163,199,0.15)" }}
                ></div>
              </div>
              <div className="relative flex justify-center text-xs sm:text-sm">
                <span className="px-3 sm:px-4 font-bold text-[#5A6C7D] bg-white">
                  OR
                </span>
              </div>
            </div>

            {/* Social Login Buttons */}
            <div className="space-y-2 sm:space-y-3">
              <button
                type="button"
                className="w-full flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl border-2 font-bold text-[#2E4057] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-white text-sm sm:text-base touch-manipulation"
                style={{
                  borderColor: "rgba(5,163,199,0.2)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#05A3C7";
                  e.currentTarget.style.backgroundColor =
                    "rgba(5,163,199,0.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(5,163,199,0.2)";
                  e.currentTarget.style.backgroundColor = "white";
                }}
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="truncate">Continue with Google</span>
              </button>
            </div>

            {/* Sign Up Link */}
            <div className="mt-5 sm:mt-6 lg:mt-8 text-center">
              <p className="text-[#5A6C7D] text-xs sm:text-sm font-medium">
                Don't have an account?{" "}
                <a
                  href="/register"
                  className="text-[#05A3C7] font-black hover:text-[#04748F] transition-colors underline decoration-2 underline-offset-2"
                >
                  Create one here
                </a>
              </p>
            </div>
          </div>

          {/* Footer Links */}
          <div className="mt-5 sm:mt-6 lg:mt-8 text-center space-y-2">
            <div className="flex items-center justify-center gap-3 sm:gap-4 lg:gap-6 text-xs sm:text-sm flex-wrap">
              <a
                href="/terms"
                className="text-[#5A6C7D] hover:text-[#05A3C7] font-bold transition-colors touch-manipulation"
              >
                Terms
              </a>
              <span className="text-[#A8B2BC]">•</span>
              <a
                href="/privacy"
                className="text-[#5A6C7D] hover:text-[#05A3C7] font-bold transition-colors touch-manipulation"
              >
                Privacy
              </a>
              <span className="text-[#A8B2BC]">•</span>
              <a
                href="/help"
                className="text-[#5A6C7D] hover:text-[#05A3C7] font-bold transition-colors touch-manipulation"
              >
                Help
              </a>
            </div>
            <p className="text-[0.65rem] sm:text-xs text-[#A8B2BC] font-medium">
              © {new Date().getFullYear()} CUTM Portal. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
