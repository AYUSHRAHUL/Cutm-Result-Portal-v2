"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [institutionalEmail, setInstitutionalEmail] = useState("");
  const router = useRouter();

  const getPasswordStrength = (password) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const clamp = Math.min(score, 4);
    const labels = ["Very weak", "Weak", "Fair", "Good", "Strong"];
    const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500", "bg-emerald-500"];

    return { score: clamp, label: labels[clamp], color: colors[clamp] };
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Failed to send OTP");
        return;
      }

      setInstitutionalEmail(data.institutionalEmail);
      setSuccess(`✅ OTP sent to ${data.emailsSent} email address(es)`);
      setStep(2);
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Failed to reset password");
        return;
      }

      setSuccess("✅ Password updated successfully!");
      setStep(3);
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row overflow-hidden bg-gradient-to-br from-[#F5F8FA] via-[#E8F4F8] to-[#D1E9F6]">
      {/* Left Side - Branding Section (Hidden on mobile and tablet) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#05A3C7] via-[#04748F] to-[#023945] overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div
            className="absolute top-1/4 left-1/4 w-64 h-64 lg:w-80 lg:h-80 rounded-full blur-3xl opacity-20 animate-pulse"
            style={{
              background: "radial-gradient(circle, rgba(241,143,1,0.4) 0%, transparent 70%)",
              animationDuration: "4s",
            }}
          />
          <div
            className="absolute bottom-1/4 right-1/4 w-64 h-64 lg:w-80 lg:h-80 rounded-full blur-3xl opacity-20 animate-pulse"
            style={{
              background: "radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)",
              animationDuration: "6s",
              animationDelay: "1s",
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center items-center p-8 lg:p-12 text-white w-full">
          {/* Logo */}
          <div className="mb-6">
            <div className="relative w-20 h-20 lg:w-24 lg:h-24 rounded-2xl overflow-hidden shadow-2xl ring-4 ring-white/30">
              <Image
                src="/spinner.jpg"
                alt="CUTM Logo"
                fill
                className="object-cover"
                priority
                sizes="(min-width: 1024px) 96px, 80px"
              />
            </div>
          </div>

          {/* Main Heading */}
          <h1 className="text-3xl lg:text-4xl xl:text-5xl font-black text-center mb-4 leading-tight">
            Password
            <br />
            <span className="text-[#F18F01]">Recovery</span>
          </h1>

          <p className="text-base lg:text-lg xl:text-xl text-center text-white/90 mb-8 max-w-md font-medium leading-relaxed px-4">
            Don't worry! It happens to the best of us. Reset your password in just a few simple steps.
          </p>

          {/* Bottom Stats */}
          <div className="mt-8 grid grid-cols-3 gap-6 lg:gap-8 w-full max-w-md px-4">
            {[
              { value: "Secure", label: "Process" },
              { value: "Quick", label: "Recovery" },
              { value: "24/7", label: "Support" },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl lg:text-3xl font-black text-[#F18F01] mb-1">
                  {stat.value}
                </div>
                <div className="text-xs lg:text-sm text-white/80 font-bold uppercase tracking-wider">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative bg-gradient-to-br from-[#F5F8FA] via-[#E8F4F8] to-[#D1E9F6]">
        {/* Background Decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute -top-40 -right-40 w-64 h-64 lg:w-80 lg:h-80 rounded-full blur-3xl opacity-10"
            style={{
              background: "radial-gradient(circle, rgba(5,163,199,0.3) 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute -bottom-40 -left-40 w-64 h-64 lg:w-80 lg:h-80 rounded-full blur-3xl opacity-10"
            style={{
              background: "radial-gradient(circle, rgba(241,143,1,0.3) 0%, transparent 70%)",
            }}
          />
        </div>

        {/* Form Card */}
        <div className="relative w-full max-w-md z-10">
          {/* Mobile/Tablet Logo */}
          <div className="lg:hidden mb-6 text-center">
            <div className="inline-block relative w-16 h-16 rounded-xl overflow-hidden shadow-xl ring-2 ring-[#05A3C7]/30 mb-3">
              <Image
                src="/spinner.jpg"
                alt="CUTM Logo"
                fill
                className="object-cover"
                priority
                sizes="64px"
              />
            </div>
            <h2 className="text-xl font-black text-[#1A1F29]">CUTM Portal</h2>
          </div>

          <div
            className="rounded-2xl border-2 p-6 sm:p-8 shadow-2xl bg-white"
            style={{
              borderColor: "rgba(5,163,199,0.2)",
            }}
          >
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-black text-[#1A1F29] mb-2">
                {step === 1 ? "Reset Password" : step === 2 ? "Verify & Reset" : "All Set!"}
              </h1>
              <p className="text-[#5A6C7D] text-sm sm:text-base font-medium">
                {step === 1
                  ? "Enter your email to receive a reset code"
                  : step === 2
                  ? "Enter OTP and create your new password"
                  : "Your password has been successfully updated"}
              </p>
            </div>

            {/* Step Indicator */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                {[1, 2, 3].map((s) => (
                  <div key={s} className="flex-1 flex items-center">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-black transition-all duration-300 ${
                        step >= s ? "bg-[#05A3C7] text-white shadow-lg" : "bg-[#E8F4F8] text-[#5A6C7D]"
                      }`}
                    >
                      {s}
                    </div>
                    {s !== 3 && (
                      <div
                        className={`h-1 flex-1 mx-2 rounded-full transition-all duration-300 ${
                          step > s ? "bg-[#05A3C7]" : "bg-[#E8F4F8]"
                        }`}
                      ></div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-xs text-[#5A6C7D] font-bold">
                <span>Email</span>
                <span>Verify</span>
                <span>Done</span>
              </div>
            </div>

            {/* Message Alerts */}
            {error && (
              <div className="mb-4 p-3 sm:p-4 rounded-xl font-bold bg-red-50 text-red-700 border-2 border-red-200 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 sm:p-4 rounded-xl font-bold bg-green-50 text-green-700 border-2 border-green-200 text-sm">
                {success}
              </div>
            )}

            {/* Step 1: Email Form */}
            {step === 1 && (
              <form onSubmit={handleSendOTP} className="space-y-5">
                <div>
                  <label className="block text-[#2E4057] font-bold mb-2 text-sm">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#5A6C7D]">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="w-5 h-5"
                      >
                        <path d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67Z" />
                        <path d="M22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="your.email@cutm.ac.in"
                      className="w-full rounded-xl border-2 bg-white pl-11 pr-4 py-3 outline-none transition-all duration-200 text-[#1A1F29] placeholder-[#A8B2BC] font-medium text-sm sm:text-base focus:border-[#05A3C7] focus:ring-4 focus:ring-[#05A3C7]/10"
                      style={{
                        borderColor: "rgba(5,163,199,0.2)",
                      }}
                    />
                  </div>
                  <p className="text-[#5A6C7D] text-xs mt-1 font-medium">
                    Only @cutm.ac.in or @centurionuniv.edu.in emails
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl text-white font-black py-3 sm:py-3.5 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] text-sm sm:text-base bg-gradient-to-r from-[#05A3C7] to-[#04748F] hover:from-[#04748F] hover:to-[#023945]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Sending OTP...
                    </span>
                  ) : (
                    "Send Reset Code"
                  )}
                </button>
              </form>
            )}

            {/* Step 2: OTP & Password Form */}
            {step === 2 && (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div className="text-center mb-4 p-3 sm:p-4 rounded-xl bg-[#05A3C7]/5 border-2 border-[#05A3C7]/20">
                  <p className="text-[#2E4057] text-xs sm:text-sm font-bold mb-1">
                    OTP sent to:
                  </p>
                  <p className="text-[#05A3C7] font-black text-xs sm:text-sm break-all">{email}</p>
                  {institutionalEmail && (
                    <p className="text-[#05A3C7] font-black text-xs sm:text-sm break-all mt-1">
                      {institutionalEmail}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[#2E4057] font-bold mb-2 text-sm">
                    Enter 6-Digit OTP
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    maxLength={6}
                    placeholder="000000"
                    className="w-full rounded-xl border-2 bg-white px-4 py-3 sm:py-4 outline-none transition-all duration-200 text-[#1A1F29] placeholder-[#A8B2BC] font-black text-center text-xl sm:text-2xl tracking-[0.5em] focus:border-[#05A3C7] focus:ring-4 focus:ring-[#05A3C7]/10"
                    style={{
                      borderColor: "rgba(5,163,199,0.2)",
                    }}
                  />
                </div>

                <div>
                  <label className="block text-[#2E4057] font-bold mb-2 text-sm">
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#5A6C7D]">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="w-5 h-5"
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
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="Create new password"
                      className="w-full rounded-xl border-2 bg-white pl-11 pr-4 py-3 outline-none transition-all duration-200 text-[#1A1F29] placeholder-[#A8B2BC] font-medium text-sm sm:text-base focus:border-[#05A3C7] focus:ring-4 focus:ring-[#05A3C7]/10"
                      style={{
                        borderColor: "rgba(5,163,199,0.2)",
                      }}
                    />
                  </div>
                  {newPassword && (
                    <div className="mt-2">
                      {(() => {
                        const s = getPasswordStrength(newPassword);
                        return (
                          <div className="rounded-xl bg-[#05A3C7]/5 p-3 border border-[#05A3C7]/20">
                            <div className="h-2 w-full rounded-full bg-[#E8F4F8] overflow-hidden">
                              <div
                                className={`h-2 rounded-full transition-all duration-300 ${s.color}`}
                                style={{ width: `${(s.score + 1) * 20}%` }}
                              ></div>
                            </div>
                            <div className="mt-2 text-xs text-[#2E4057] font-medium">
                              Strength: <span className="font-bold">{s.label}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[#2E4057] font-bold mb-2 text-sm">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#5A6C7D]">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          fillRule="evenodd"
                          d="M2.25 12a9.75 9.75 0 1 1 19.5 0 9.75 9.75 0 0 1-19.5 0Zm13.1-2.58a.75.75 0 0 1 1.06 1.06l-5 5a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 0 1 1.06-1.06l1.47 1.47 4.47-4.47Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Confirm new password"
                      className="w-full rounded-xl border-2 bg-white pl-11 pr-4 py-3 outline-none transition-all duration-200 text-[#1A1F29] placeholder-[#A8B2BC] font-medium text-sm sm:text-base focus:border-[#05A3C7] focus:ring-4 focus:ring-[#05A3C7]/10"
                      style={{
                        borderColor: "rgba(5,163,199,0.2)",
                      }}
                    />
                  </div>
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-red-600 text-xs mt-1 font-medium">
                      Passwords do not match
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || newPassword !== confirmPassword || !otp || !newPassword}
                  className="w-full rounded-xl text-white font-black py-3 sm:py-3.5 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] text-sm sm:text-base bg-gradient-to-r from-[#05A3C7] to-[#04748F] hover:from-[#04748F] hover:to-[#023945]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Updating...
                    </span>
                  ) : (
                    "Reset Password"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full text-[#05A3C7] font-bold hover:text-[#04748F] transition-colors text-sm"
                >
                  ← Back to email
                </button>
              </form>
            )}

            {/* Step 3: Success */}
            {step === 3 && (
              <div className="text-center space-y-5 py-4">
                <div className="text-6xl">✅</div>
                <h2 className="text-2xl sm:text-3xl font-black text-[#1A1F29]">Password Updated!</h2>
                <p className="text-[#5A6C7D] text-sm sm:text-base font-medium px-2">
                  Your password has been successfully updated. You can now log in with your new password.
                </p>
                <button
                  onClick={() => router.push("/login")}
                  className="w-full rounded-xl text-white font-black py-3 sm:py-3.5 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] text-sm sm:text-base bg-gradient-to-r from-[#05A3C7] to-[#04748F] hover:from-[#04748F] hover:to-[#023945]"
                >
                  Go to Login
                </button>
              </div>
            )}

            {/* Back to Login Link */}
            {step !== 3 && (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="text-[#05A3C7] font-bold hover:text-[#04748F] transition-colors text-sm"
                >
                  ← Back to Login
                </button>
              </div>
            )}
          </div>

          {/* Footer Links */}
          <div className="mt-5 text-center space-y-2">
            <div className="flex items-center justify-center gap-4 text-sm flex-wrap">
              <a
                href="/terms"
                className="text-[#5A6C7D] hover:text-[#05A3C7] font-bold transition-colors"
              >
                Terms
              </a>
              <span className="text-[#A8B2BC]">•</span>
              <a
                href="/privacy"
                className="text-[#5A6C7D] hover:text-[#05A3C7] font-bold transition-colors"
              >
                Privacy
              </a>
              <span className="text-[#A8B2BC]">•</span>
              <a
                href="/help"
                className="text-[#5A6C7D] hover:text-[#05A3C7] font-bold transition-colors"
              >
                Help
              </a>
            </div>
            <p className="text-xs text-[#A8B2BC] font-medium">
              © {new Date().getFullYear()} CUTM Portal. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
