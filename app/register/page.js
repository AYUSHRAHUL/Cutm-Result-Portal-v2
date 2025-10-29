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
  const [institutionalEmail, setInstitutionalEmail] = useState("");
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

        setInstitutionalEmail("");
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
    <>
      <style jsx global>{`
        @media (min-width: 1024px) {
          body {
            zoom: 0.67;
          }
        }
        
        /* Mobile optimizations */
        @media (max-width: 768px) {
          body {
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
          }
          
          input, select, textarea {
            font-size: 16px !important; /* Prevents zoom on iOS */
          }
          
          .touch-manipulation {
            touch-action: manipulation;
          }
        }
        
        /* Prevent horizontal scroll */
        html, body {
          overflow-x: hidden;
        }
        
        /* Better mobile spacing */
        @media (max-width: 640px) {
          .mobile-padding {
            padding-left: 1rem;
            padding-right: 1rem;
          }
        }
        
        /* Fix mobile layout issues */
        @media (max-width: 1023px) {
          .min-h-screen {
            min-height: 100vh;
          }
          
          .flex-col {
            flex-direction: column;
          }
        }
        
        /* Ensure proper background coverage */
        .bg-gradient-to-br {
          background-attachment: fixed;
        }
      `}</style>

      <div className="auth-page min-h-screen flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side - Branding Section (Hidden on mobile) */}
        <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#05A3C7] via-[#04748F] to-[#023945] overflow-hidden">
          {/* Animated Background */}
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
              Join the
              <br />
              <span className="text-[#F18F01]">CUTM Community</span>
            </h1>

            <p className="text-lg xl:text-xl text-center text-white/90 mb-8 xl:mb-12 max-w-md font-medium leading-relaxed">
              Create your account to access academic resources, track your
              progress, and connect with the university ecosystem.
            </p>


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
                { value: "Secure", label: "Platform" },
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

        {/* Right Side - Registration Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-8 xl:p-12 relative min-h-screen lg:min-h-0">
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

          {/* Registration Card */}
          <div className="relative w-full max-w-md z-10">
            {/* Mobile Logo */}
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
              className="rounded-2xl sm:rounded-3xl border-2 p-6 sm:p-8 lg:p-10 shadow-2xl bg-white mobile-padding"
              style={{
                borderColor: "rgba(5,163,199,0.2)",
              }}
            >
              {/* Header */}
              <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#1A1F29] mb-2 sm:mb-3">
                  {step === 1
                    ? "Create Account"
                    : step === 2
                    ? "Verify Email"
                    : "All Set!"}
                </h1>
                <p className="text-[#5A6C7D] text-sm sm:text-base font-medium">
                  {step === 1
                    ? "Fill in your details to get started"
                    : step === 2
                    ? "Enter the OTP sent to your email"
                    : "Your account has been created successfully"}
                </p>
              </div>

              {/* Message Alerts */}
              {error && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl font-bold bg-red-50 text-red-700 border-2 border-red-200 text-xs sm:text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl font-bold bg-green-50 text-green-700 border-2 border-green-200 text-xs sm:text-sm">
                  {success}
                </div>
              )}

              {/* Step 1: Registration Form */}
              {step === 1 && (
                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 lg:space-y-6">
                  {/* Full Name */}
                  <div>
                    <label className="block text-[#2E4057] font-bold mb-1.5 sm:mb-2 text-xs sm:text-sm">
                      Full Name
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
                            d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <input
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                        required
                        placeholder="Enter your full name"
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

                  {/* Email Address */}
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
                          <path d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67Z" />
                          <path d="M22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z" />
                        </svg>
                      </div>
                      <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={(e) =>
                          setForm({ ...form, email: e.target.value })
                        }
                        required
                        placeholder="your.email@cutm.ac.in"
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

                  {/* Password */}
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
                        onChange={(e) =>
                          setForm({ ...form, password: e.target.value })
                        }
                        required
                        placeholder="Create a secure password"
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

                  {/* Account Type */}
                  <div>
                    <label className="block text-[#2E4057] font-bold mb-1.5 sm:mb-2 text-xs sm:text-sm">
                      Account Type
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none text-[#5A6C7D]">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        >
                          <path d="M11.7 2.805a.75.75 0 0 1 .6 0A60.65 60.65 0 0 1 22.83 8.72a.75.75 0 0 1-.231 1.337 49.948 49.948 0 0 0-9.902 3.912l-.003.002c-.114.06-.227.119-.34.18a.75.75 0 0 1-.707 0A50.88 50.88 0 0 0 7.5 12.173v-.224c0-.131.067-.248.172-.311a54.615 54.615 0 0 1 4.653-2.52.75.75 0 0 0-.65-1.352 56.123 56.123 0 0 0-4.78 2.589 1.858 1.858 0 0 0-.859 1.228 49.803 49.803 0 0 0-4.634-1.527.75.75 0 0 1-.231-1.337A60.653 60.653 0 0 1 11.7 2.805Z" />
                          <path d="M13.06 15.473a48.45 48.45 0 0 1 7.666-3.282c.134 1.414.22 2.843.255 4.284a.75.75 0 0 1-.46.711 47.87 47.87 0 0 0-8.105 4.342.75.75 0 0 1-.832 0 47.87 47.87 0 0 0-8.104-4.342.75.75 0 0 1-.461-.71c.035-1.442.121-2.87.255-4.286.921.304 1.83.634 2.726.99v1.27a1.5 1.5 0 0 0-.14 2.508c-.09.38-.222.753-.397 1.11.452.213.901.434 1.346.66a6.727 6.727 0 0 0 .551-1.607 1.5 1.5 0 0 0 .14-2.67v-.645a48.549 48.549 0 0 1 3.44 1.667 2.25 2.25 0 0 0 2.12 0Z" />
                        </svg>
                      </div>
                      <select
                        name="role"
                        value={form.role}
                        onChange={(e) =>
                          setForm({ ...form, role: e.target.value })
                        }
                        className="w-full rounded-xl border-2 bg-white pl-10 sm:pl-12 pr-4 sm:pr-5 py-2.5 sm:py-3 lg:py-3.5 outline-none transition-all duration-200 text-[#1A1F29] font-medium appearance-none cursor-pointer text-sm sm:text-base"
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
                      >
                        <option value="user">Student</option>
                        <option value="teacher">Teacher</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center pointer-events-none text-[#5A6C7D]">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-4 h-4 sm:w-5 sm:h-5"
                        >
                          <path
                            fillRule="evenodd"
                            d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Employee ID (conditional) */}
                  {form.role === "teacher" && (
                    <div>
                      <label className="block text-[#2E4057] font-bold mb-1.5 sm:mb-2 text-xs sm:text-sm">
                        Employee ID
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
                              d="M4.5 3.75a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V6.75a3 3 0 0 0-3-3h-15Zm4.125 3a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Zm-3.873 8.703a4.126 4.126 0 0 1 7.746 0 .75.75 0 0 1-.351.92 7.47 7.47 0 0 1-3.522.877 7.47 7.47 0 0 1-3.522-.877.75.75 0 0 1-.351-.92ZM15 8.25a.75.75 0 0 0 0 1.5h3.75a.75.75 0 0 0 0-1.5H15ZM14.25 12a.75.75 0 0 1 .75-.75h3.75a.75.75 0 0 1 0 1.5H15a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h3.75a.75.75 0 0 0 0-1.5H15Z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <input
                          type="text"
                          name="employeeId"
                          value={form.employeeId}
                          onChange={(e) =>
                            setForm({ ...form, employeeId: e.target.value })
                          }
                          required
                          placeholder="Enter your employee ID"
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
                  )}

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
                <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                  <div className="text-center mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl bg-[#05A3C7]/5 border-2 border-[#05A3C7]/20 break-words">
                    <p className="text-[#2E4057] text-xs sm:text-sm font-bold mb-2">
                      OTP sent to:
                    </p>
                    <p className="text-[#05A3C7] font-black text-xs sm:text-sm break-all">
                      {form.email}
                    </p>
                  </div>

                  <div>
                    <label className="block text-[#2E4057] font-bold mb-1.5 sm:mb-2 text-xs sm:text-sm">
                      Enter 6-Digit OTP
                    </label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) =>
                        setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      required
                      maxLength={6}
                      placeholder="000000"
                      className="w-full rounded-xl border-2 bg-white px-4 sm:px-5 py-3 sm:py-4 outline-none transition-all duration-200 text-[#1A1F29] placeholder-[#A8B2BC] font-black text-center text-2xl sm:text-3xl tracking-[0.3em] sm:tracking-[0.5em]"
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

                  <button
                    type="submit"
                    disabled={loading || otp.length !== 6}
                    className="w-full rounded-xl text-white font-black py-3 sm:py-3.5 lg:py-4 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] text-sm sm:text-base touch-manipulation"
                    style={{
                      background:
                        "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                    }}
                    onMouseEnter={(e) => {
                      if (!loading && otp.length === 6) {
                        e.currentTarget.style.background =
                          "linear-gradient(135deg, #04748F 0%, #023945 100%)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading && otp.length === 6) {
                        e.currentTarget.style.background =
                          "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)";
                      }
                    }}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Verifying...
                      </span>
                    ) : (
                      "Verify & Complete Registration"
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-full text-[#05A3C7] font-bold hover:text-[#04748F] transition-colors text-xs sm:text-sm touch-manipulation"
                  >
                    ← Back to registration
                  </button>
                </form>
              )}

              {/* Step 3: Success */}
              {step === 3 && (
                <div className="text-center space-y-4 sm:space-y-6 py-4 sm:py-6">
                  <div className="text-6xl sm:text-7xl lg:text-8xl">✅</div>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#1A1F29]">
                    Registration Complete!
                  </h2>
                  <p className="text-[#5A6C7D] text-sm sm:text-base font-medium">
                    Your account has been created successfully. Redirecting you to
                    the login page...
                  </p>
                  <div className="flex items-center justify-center gap-2 text-[#05A3C7]">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-[#05A3C7]/30 border-t-[#05A3C7] rounded-full animate-spin"></div>
                    <span className="font-bold text-sm sm:text-base">Redirecting...</span>
                  </div>
                </div>
              )}

              {/* Sign In Link */}
              {step === 1 && (
                <div className="mt-6 sm:mt-8 text-center">
                  <p className="text-[#5A6C7D] text-xs sm:text-sm font-medium">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => router.push("/login")}
                      className="text-[#05A3C7] font-black hover:text-[#04748F] transition-colors underline decoration-2 underline-offset-2 touch-manipulation"
                    >
                      Sign in here
                    </button>
                  </p>
                </div>
              )}
            </div>

            {/* Footer Links */}
            <div className="mt-5 sm:mt-6 lg:mt-8 text-center space-y-2 mobile-padding">
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

            <p className="text-[0.65rem] sm:text-xs text-[#A8B2BC] font-medium">
                1
              </p>
          </div>
        </div>
      </div>
    </>
  );
}
