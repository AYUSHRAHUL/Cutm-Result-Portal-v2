"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "user",
    employeeId: "",
  });
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (step === 1) {
      const allowedDomains = ["@cutm.ac.in", "@centurionuniv.edu.in"];
      const emailDomain = form.email.substring(form.email.lastIndexOf("@"));

      if (!allowedDomains.includes(emailDomain)) {
        setError(
          "❌ Only @cutm.ac.in or @centurionuniv.edu.in email addresses are allowed"
        );
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/auth/send-registration-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });

        const data = await res.json();

        if (!data.success) {
          setError(data.error || "Failed to send OTP");
          setLoading(false);
          return;
        }

        setSuccess(`✅ OTP sent to your email address`);
        setStep(2);
      } catch (err) {
        console.error("OTP send error:", err);
        setError("Something went wrong while sending OTP");
      }
    } else if (step === 2) {
      try {
        const res = await fetch("/api/auth/verify-registration-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: form.email,
            otp,
            password: form.password,
            name: form.name,
            role: form.role,
            employeeId: form.employeeId,
          }),
        });

        const data = await res.json();

        if (!data.success) {
          setError(data.error || "Registration failed");
          setLoading(false);
          return;
        }

        setSuccess("✅ Registration successful! Redirecting to login...");
        setStep(3);

        setTimeout(() => {
          router.push("/login");
        }, 2000);
      } catch (err) {
        console.error("Registration error:", err);
        setError("Something went wrong while registering");
      }
    }

    setLoading(false);
  };

  return (
    <div className="h-screen w-screen flex flex-col lg:flex-row bg-gray-50 text-gray-900 overflow-hidden">
      {/* LEFT PANEL */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-cyan-600 via-cyan-700 to-cyan-900 text-white items-center justify-center relative overflow-hidden">
        {/* Decorative gradient orbs */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-32 w-80 h-80 bg-orange-500 opacity-30 blur-3xl rounded-full animate-pulse" />
          <div className="absolute bottom-20 right-32 w-80 h-80 bg-white opacity-25 blur-3xl rounded-full animate-pulse" style={{ animationDelay: "500ms" }} />
        </div>

        <div className="relative z-10 max-w-lg px-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-3xl overflow-hidden shadow-2xl ring-4 ring-white/30 bg-white">
            <Image
              src="/spinner.jpg"
              alt="CUTM Logo"
              width={80}
              height={80}
              className="object-cover"
              priority
            />
          </div>
          
          <h1 className="text-3xl font-bold mb-3 leading-snug text-center">
            Join the
            <span className="text-orange-400 block">CUTM Community</span>
          </h1>
          
          <p className="text-base text-center text-white/90 mb-5 font-medium leading-relaxed">
            Create your account to access academic resources, track your progress, and connect with the university ecosystem.
          </p>

          <div className="space-y-2.5">
            <div className="flex items-center gap-3 p-2.5 rounded-xl backdrop-blur-sm bg-white/10 border border-white/20 hover:bg-white/20 transition">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M11.7 2.805a.75.75 0 0 1 .6 0A60.65 60.65 0 0 1 22.83 8.72a.75.75 0 0 1-.231 1.337 49.948 49.948 0 0 0-9.902 3.912l-.003.002c-.114.06-.227.119-.34.18a.75.75 0 0 1-.707 0A50.88 50.88 0 0 0 7.5 12.173v-.224c0-.131.067-.248.172-.311a54.615 54.615 0 0 1 4.653-2.52.75.75 0 0 0-.65-1.352 56.123 56.123 0 0 0-4.78 2.589 1.858 1.858 0 0 0-.859 1.228 49.803 49.803 0 0 0-4.634-1.527.75.75 0 0 1-.231-1.337A60.653 60.653 0 0 1 11.7 2.805Z" />
                  <path d="M13.06 15.473a48.45 48.45 0 0 1 7.666-3.282c.134 1.414.22 2.843.255 4.284a.75.75 0 0 1-.46.711 47.87 47.87 0 0 0-8.105 4.342.75.75 0 0 1-.832 0 47.87 47.87 0 0 0-8.104-4.342.75.75 0 0 1-.461-.71c.035-1.442.121-2.87.255-4.286.921.304 1.83.634 2.726.99v1.27a1.5 1.5 0 0 0-.14 2.508c-.09.38-.222.753-.397 1.11.452.213.901.434 1.346.66a6.727 6.727 0 0 0 .551-1.607 1.5 1.5 0 0 0 .14-2.67v-.645a48.549 48.549 0 0 1 3.44 1.667 2.25 2.25 0 0 0 2.12 0Z" />
                </svg>
              </div>
              <span className="text-sm font-bold">Instant Result Access</span>
            </div>
            
            <div className="flex items-center gap-3 p-2.5 rounded-xl backdrop-blur-sm bg-white/10 border border-white/20 hover:bg-white/20 transition">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-sm font-bold">Secure & Private</span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-extrabold text-orange-400">10K+</div>
              <div className="text-xs text-white/80 font-bold uppercase">Students</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-extrabold text-orange-400">500+</div>
              <div className="text-xs text-white/80 font-bold uppercase">Faculty</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-extrabold text-orange-400">Secure</div>
              <div className="text-xs text-white/80 font-bold uppercase">Platform</div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-full lg:w-1/2 flex items-center justify-center relative bg-white h-full overflow-y-auto">
        {/* Background circles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-20 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-orange-400/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-md px-6 py-6">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-4">
            <div className="w-16 h-16 mx-auto mb-2 rounded-2xl overflow-hidden shadow-xl ring-2 ring-cyan-600/30 bg-cyan-600">
              <Image
                src="/spinner.jpg"
                alt="CUTM Logo"
                width={64}
                height={64}
                className="object-cover"
                priority
              />
            </div>
            <h2 className="text-xl font-extrabold">CUTM Portal</h2>
          </div>

          {/* Registration Card */}
          <div className="bg-white p-6 rounded-2xl shadow-2xl border-2 border-cyan-600/20">
            {/* Header */}
            <div className="mb-4">
              <h1 className="text-2xl font-extrabold text-gray-900 mb-1">
                {step === 1 ? "Create Account" : step === 2 ? "Verify Email" : "All Set!"}
              </h1>
              <p className="text-gray-600 text-sm font-medium">
                {step === 1
                  ? "Fill in your details to get started"
                  : step === 2
                  ? "Enter the OTP sent to your email"
                  : "Your account has been created successfully"}
              </p>
            </div>

            {/* Messages */}
            {error && (
              <div className="mb-4 p-2.5 rounded-lg font-bold bg-red-50 text-red-700 border-2 border-red-200 text-xs">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-2.5 rounded-lg font-bold bg-green-50 text-green-700 border-2 border-green-200 text-xs">
                {success}
              </div>
            )}

            {/* Step 1: Registration Form */}
            {step === 1 && (
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Full Name */}
                <div>
                  <label className="block text-gray-700 font-bold mb-1 text-xs">Full Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-600">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      placeholder="Enter your full name"
                      className="w-full rounded-lg border-2 border-cyan-600/20 bg-white pl-10 pr-4 py-2 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 transition text-sm"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-gray-700 font-bold mb-1 text-xs">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-600">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67Z" />
                        <path d="M22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                      placeholder="your.email@cutm.ac.in"
                      className="w-full rounded-lg border-2 border-cyan-600/20 bg-white pl-10 pr-4 py-2 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 transition text-sm"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-gray-700 font-bold mb-1 text-xs">Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-600">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M12 1.5a4.5 4.5 0 0 0-4.5 4.5v3H6a3 3 0 0 0-3 3v6A3 3 0 0 0 6 21h12a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3h-1.5v-3A4.5 4.5 0 0 0 12 1.5Zm-3 7.5v-3a3 3 0 1 1 6 0v3H9Z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                      placeholder="Create a secure password"
                      className="w-full rounded-lg border-2 border-cyan-600/20 bg-white pl-10 pr-4 py-2 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 transition text-sm"
                    />
                  </div>
                </div>

                {/* Account Type */}
                <div>
                  <label className="block text-gray-700 font-bold mb-1 text-xs">Account Type</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-600">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M11.7 2.805a.75.75 0 0 1 .6 0A60.65 60.65 0 0 1 22.83 8.72a.75.75 0 0 1-.231 1.337 49.948 49.948 0 0 0-9.902 3.912l-.003.002c-.114.06-.227.119-.34.18a.75.75 0 0 1-.707 0A50.88 50.88 0 0 0 7.5 12.173v-.224c0-.131.067-.248.172-.311a54.615 54.615 0 0 1 4.653-2.52.75.75 0 0 0-.65-1.352 56.123 56.123 0 0 0-4.78 2.589 1.858 1.858 0 0 0-.859 1.228 49.803 49.803 0 0 0-4.634-1.527.75.75 0 0 1-.231-1.337A60.653 60.653 0 0 1 11.7 2.805Z" />
                      </svg>
                    </div>
                    <select
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                      className="w-full rounded-lg border-2 border-cyan-600/20 bg-white pl-10 pr-4 py-2 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 transition appearance-none cursor-pointer text-sm"
                    >
                      <option value="user">Student</option>
                      <option value="teacher">Teacher</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-600">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Employee ID */}
                {form.role === "teacher" && (
                  <div>
                    <label className="block text-gray-700 font-bold mb-1 text-xs">Employee ID</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M4.5 3.75a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V6.75a3 3 0 0 0-3-3h-15Zm4.125 3a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Zm-3.873 8.703a4.126 4.126 0 0 1 7.746 0 .75.75 0 0 1-.351.92 7.47 7.47 0 0 1-3.522.877 7.47 7.47 0 0 1-3.522-.877.75.75 0 0 1-.351-.92ZM15 8.25a.75.75 0 0 0 0 1.5h3.75a.75.75 0 0 0 0-1.5H15ZM14.25 12a.75.75 0 0 1 .75-.75h3.75a.75.75 0 0 1 0 1.5H15a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h3.75a.75.75 0 0 0 0-1.5H15Z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        value={form.employeeId}
                        onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                        required
                        placeholder="Enter your employee ID"
                        className="w-full rounded-lg border-2 border-cyan-600/20 bg-white pl-10 pr-4 py-2 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 transition text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-700 text-white font-black py-2.5 transition disabled:opacity-60 shadow-lg hover:opacity-90 text-sm"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending OTP...
                    </span>
                  ) : (
                    "Send OTP"
                  )}
                </button>
              </form>
            )}

            {/* Step 2: OTP Verification */}
            {step === 2 && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="text-center mb-4 p-3 rounded-lg bg-cyan-600/5 border-2 border-cyan-600/20">
                  <p className="text-gray-700 text-xs font-bold mb-1">OTP sent to:</p>
                  <p className="text-cyan-600 font-black text-xs break-all">{form.email}</p>
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1 text-xs">Enter 6-Digit OTP</label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    maxLength={6}
                    placeholder="000000"
                    className="w-full rounded-lg border-2 border-cyan-600/20 bg-white px-4 py-3 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 transition font-black text-center text-2xl tracking-widest"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-700 text-white font-black py-2.5 transition disabled:opacity-60 shadow-lg hover:opacity-90 text-sm"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Verifying...
                    </span>
                  ) : (
                    "Verify & Complete Registration"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full text-cyan-600 font-bold hover:text-cyan-700 transition text-xs"
                >
                  ← Back to registration
                </button>
              </form>
            )}

            {/* Step 3: Success */}
            {step === 3 && (
              <div className="text-center space-y-4 py-6">
                <div className="text-6xl">✅</div>
                <h2 className="text-2xl font-black text-gray-900">Registration Complete!</h2>
                <p className="text-gray-600 text-sm font-medium">
                  Your account has been created successfully. Redirecting you to the login page...
                </p>
                <div className="flex items-center justify-center gap-2 text-cyan-600">
                  <div className="w-4 h-4 border-2 border-cyan-600/30 border-t-cyan-600 rounded-full animate-spin" />
                  <span className="font-bold text-sm">Redirecting...</span>
                </div>
              </div>
            )}

            {/* Sign In Link */}
            {step === 1 && (
              <div className="mt-4 text-center">
                <p className="text-gray-600 text-xs font-medium">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => router.push("/login")}
                    className="text-cyan-600 font-black hover:text-cyan-700 transition underline"
                  >
                    Sign in here
                  </button>
                </p>
              </div>
            )}
          </div>

          {/* Footer Links */}
          <div className="mt-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-4 text-xs">
              <a href="/terms" className="text-gray-600 hover:text-cyan-600 font-bold transition">Terms</a>
              <span className="text-gray-400">•</span>
              <a href="/privacy" className="text-gray-600 hover:text-cyan-600 font-bold transition">Privacy</a>
              <span className="text-gray-400">•</span>
              <a href="/help" className="text-gray-600 hover:text-cyan-600 font-bold transition">Help</a>
            </div>
            <p className="text-xs text-gray-400 font-medium">
              © {new Date().getFullYear()} CUTM Portal. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}