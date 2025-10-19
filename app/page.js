"use client";

import { useState, useEffect } from 'react';
import Link from "next/link";

export default function HomePage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const heroImages = [
    { 
      title: "Academic Excellence", 
      subtitle: "Your results, instantly accessible", 
      bg: "from-blue-600 to-indigo-700",
      icon: "🎓"
    },
    { 
      title: "Secure & Reliable", 
      subtitle: "Protected with enterprise-grade security", 
      bg: "from-purple-600 to-fuchsia-700",
      icon: "🔐"
    },
    { 
      title: "Real-time Analytics", 
      subtitle: "Track your academic progress", 
      bg: "from-emerald-600 to-teal-700",
      icon: "📊"
    },
    { 
      title: "Seamless Experience", 
      subtitle: "Access from any device, anywhere", 
      bg: "from-amber-500 to-orange-600",
      icon: "📱"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroImages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen text-white bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-lg">C</div>
              <span className="font-bold text-lg">CUTM Portal</span>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#home" className="text-white/90 hover:text-white transition-colors">Home</a>
              <a href="#features" className="text-white/90 hover:text-white transition-colors">Features</a>
              <a href="#about" className="text-white/90 hover:text-white transition-colors">About</a>
              <a href="#contact" className="text-white/90 hover:text-white transition-colors">Contact</a>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Link href="/login" className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white transition-colors">
                Login
              </Link>
              <Link href="/register" className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-sm font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all">
                Register
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2">
              <div className="w-6 h-5 flex flex-col justify-between">
                <span className={`w-full h-0.5 bg-white transition-all ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
                <span className={`w-full h-0.5 bg-white transition-all ${mobileMenuOpen ? 'opacity-0' : ''}`}></span>
                <span className={`w-full h-0.5 bg-white transition-all ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
              </div>
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-white/10">
              <div className="flex flex-col gap-4">
                <a href="#home" className="text-white/90 hover:text-white transition-colors">Home</a>
                <a href="#features" className="text-white/90 hover:text-white transition-colors">Features</a>
                <a href="#about" className="text-white/90 hover:text-white transition-colors">About</a>
                <a href="#contact" className="text-white/90 hover:text-white transition-colors">Contact</a>
                <div className="flex gap-3 pt-2">
                  <Link href="/login" className="flex-1 px-4 py-2 text-center rounded-lg border border-white/20 text-sm font-medium">Login</Link>
                  <Link href="/register" className="flex-1 px-4 py-2 text-center rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-sm font-semibold">Register</Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section with Auto-rotating Images */}
      <section id="home" className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0">
          {heroImages.map((slide, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentSlide ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${slide.bg} opacity-20`}></div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_70%)]"></div>
            </div>
          ))}
        </div>

        <div className="relative mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm text-sm mb-6">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>System Online</span>
              </div>

              <div className="flex items-center justify-center lg:justify-start gap-4 mb-4">
                <span className="text-5xl">{heroImages[currentSlide].icon}</span>
                <div className="h-12 w-0.5 bg-white/20 rounded-full"></div>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight">
                <span className="bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text text-transparent">
                  {heroImages[currentSlide].title}
                </span>
              </h1>

              <p className="text-xl text-white/90 mb-4 leading-relaxed">
                {heroImages[currentSlide].subtitle}
              </p>

              <p className="text-white/80 mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0">
                A comprehensive platform designed for students, teachers, and administrators to access, manage, and analyze academic results with ease and security.
              </p>

              <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                <Link href="/login" className="px-8 py-4 rounded-xl bg-white text-indigo-700 font-semibold text-lg hover:bg-indigo-50 transition-all hover:shadow-2xl hover:scale-105">
                  Get Started →
                </Link>
                <a href="#features" className="px-8 py-4 rounded-xl border-2 border-white/30 bg-white/10 backdrop-blur-sm font-semibold text-lg hover:bg-white/20 transition-all">
                  Learn More
                </a>
              </div>

              {/* Slide Indicators */}
              <div className="flex gap-2 mt-8 justify-center lg:justify-start">
                {heroImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`h-1.5 rounded-full transition-all ${
                      index === currentSlide ? 'w-8 bg-white' : 'w-1.5 bg-white/40'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-2xl p-8 shadow-2xl">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {[
                    { t: "Secure Access", d: "Role-based authentication", i: "🛡" },
                    { t: "Fast Lookup", d: "Instant result retrieval", i: "⚡" },
                    { t: "Bulk Upload", d: "CSV/XLSX imports", i: "☁" },
                    { t: "Analytics", d: "Performance insights", i: "📈" },
                  ].map((c, i) => (
                    <div key={i} className="rounded-2xl border border-white/15 bg-gradient-to-br from-white/15 to-white/5 p-5 hover:scale-105 transition-transform">
                      <div className="text-3xl mb-3">{c.i}</div>
                      <div className="font-bold text-lg mb-1">{c.t}</div>
                      <div className="text-sm text-white/80">{c.d}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold">System Status</span>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">Operational</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full w-[95%] bg-gradient-to-r from-emerald-400 to-green-500 rounded-full"></div>
                  </div>
                  <div className="mt-2 text-sm text-white/70">99.9% uptime · All systems running smoothly</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gradient-to-b from-transparent to-slate-900/50">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-sm mb-6">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-indigo-200 font-medium">Cutting-edge Features</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
              Powerful Result Management
            </h2>
            <p className="text-white/80 text-lg max-w-3xl mx-auto">
              Everything you need to manage academic results efficiently and securely, designed for students, teachers, and administrators
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="rounded-3xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-transparent p-8 hover:scale-105 transition-transform hover:shadow-lg hover:shadow-blue-500/10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-3xl mb-6 shadow-lg">
                🎒
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium mb-3">For Students</div>
              <h3 className="text-2xl font-bold mb-3">Student Portal</h3>
              <p className="text-white/80 mb-4">View semester results, calculate CGPA/SGPA, download transcripts, and track academic progress in real-time.</p>
              <Link href="/login" className="inline-flex items-center gap-2 text-blue-300 hover:text-blue-200 font-semibold group">
                Access Portal <span className="group-hover:translate-x-1 transition-transform">→</span>
              </Link>
            </div>

            <div className="rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-transparent p-8 hover:scale-105 transition-transform hover:shadow-lg hover:shadow-purple-500/10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-3xl mb-6 shadow-lg">
                👩‍🏫
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-medium mb-3">For Faculty</div>
              <h3 className="text-2xl font-bold mb-3">Teacher Dashboard</h3>
              <p className="text-white/80 mb-4">Search student results, review backlogs, generate reports, and monitor class performance analytics.</p>
              <Link href="/login" className="inline-flex items-center gap-2 text-purple-300 hover:text-purple-200 font-semibold">
                Explore Features <span>→</span>
              </Link>
            </div>

            <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent p-8 hover:scale-105 transition-transform">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-3xl mb-6 shadow-lg">
                🛠
              </div>
              <h3 className="text-2xl font-bold mb-3">Admin Control</h3>
              <p className="text-white/80 mb-4">Manage records, bulk upload results, configure system settings, and access comprehensive analytics dashboard.</p>
              <Link href="/login" className="inline-flex items-center gap-2 text-emerald-300 hover:text-emerald-200 font-semibold">
                Manage System <span>→</span>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { t: "Reliable Infrastructure", d: "Powered by MongoDB with secure session management and data encryption", i: "✅" },
              { t: "High Performance", d: "Built with Next.js App Router and edge middleware for lightning-fast response", i: "🚀" },
              { t: "Export Ready", d: "Generate PDF reports and CSV exports for comprehensive documentation", i: "📄" },
            ].map((f, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 hover:bg-white/10 transition-colors">
                <div className="text-3xl mb-3">{f.i}</div>
                <div className="font-bold text-lg mb-2">{f.t}</div>
                <div className="text-white/70">{f.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enhanced About Section - Full Page Style */}
      <section id="about" className="py-20 bg-gradient-to-b from-slate-900/50 to-transparent min-h-screen flex items-center">
        <div className="mx-auto max-w-7xl px-6 w-full">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-purple-200 to-indigo-200 bg-clip-text text-transparent">
              About CUTM Portal
            </h2>
            <p className="text-white/80 text-xl max-w-3xl mx-auto leading-relaxed">
              Transforming academic result management through innovative technology and user-centric design
            </p>
          </div>

          {/* Mission & Vision Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-16">
            {/* Our Mission */}
            <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent p-10 backdrop-blur-sm hover:scale-105 transition-transform">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-4xl mb-6 shadow-xl">
                🎯
              </div>
              <h3 className="text-3xl font-bold mb-4 bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent">
                Our Mission
              </h3>
              <p className="text-white/80 leading-relaxed text-lg mb-4">
                To provide a seamless, secure, and efficient platform that empowers students, educators, and administrators with instant access to academic results and performance analytics.
              </p>
              <p className="text-white/70 leading-relaxed">
                We are committed to eliminating the complexity of result management by delivering a user-friendly interface that prioritizes accuracy, transparency, and accessibility for all stakeholders in the educational ecosystem.
              </p>
            </div>

            {/* Our Vision */}
            <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent p-10 backdrop-blur-sm hover:scale-105 transition-transform">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-4xl mb-6 shadow-xl">
                🌟
              </div>
              <h3 className="text-3xl font-bold mb-4 bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent">
                Our Vision
              </h3>
              <p className="text-white/80 leading-relaxed text-lg mb-4">
                To become the leading academic result management system that sets the standard for educational institutions worldwide through innovation, reliability, and exceptional user experience.
              </p>
              <p className="text-white/70 leading-relaxed">
                We envision a future where academic data is universally accessible, insights are actionable, and every student has the tools they need to track and improve their academic journey with confidence.
              </p>
            </div>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
            {[
              { value: "99.9%", label: "Uptime", icon: "⏱" },
              { value: "10K+", label: "Students", icon: "🎓" },
              { value: "500+", label: "Faculty", icon: "👨‍🏫" },
              { value: "24/7", label: "Support", icon: "💬" },
            ].map((stat, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-sm hover:bg-white/10 transition-all hover:scale-105">
                <div className="text-4xl mb-3">{stat.icon}</div>
                <div className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
                  {stat.value}
                </div>
                <div className="text-white/70 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Core Values */}
          <div className="rounded-3xl border border-white/20 bg-white/5 backdrop-blur-xl p-10">
            <h3 className="text-3xl font-bold text-center mb-10 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
              Our Core Values
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { title: "Innovation", desc: "Constantly evolving with the latest technology to deliver cutting-edge solutions", icon: "💡" },
                { title: "Security", desc: "Your data is protected with enterprise-grade encryption and secure protocols", icon: "🔒" },
                { title: "Accessibility", desc: "Designed for everyone, ensuring seamless access across all devices and platforms", icon: "🌐" },
              ].map((value, i) => (
                <div key={i} className="text-center">
                  <div className="text-5xl mb-4">{value.icon}</div>
                  <h4 className="text-xl font-bold mb-3">{value.title}</h4>
                  <p className="text-white/70 leading-relaxed">{value.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-gradient-to-b from-transparent to-slate-900/50">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
              Get in Touch
            </h2>
            <p className="text-white/80 text-lg">
              Have questions? We're here to help you succeed
            </p>
          </div>

          <div className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-2xl p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl flex-shrink-0">
                    📧
                  </div>
                  <div>
                    <div className="font-semibold text-lg mb-1">Email Support</div>
                    <div className="text-white/70">support@cutmportal.edu</div>
                    <div className="text-white/70">admin@cutmportal.edu</div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-xl flex-shrink-0">
                    📞
                  </div>
                  <div>
                    <div className="font-semibold text-lg mb-1">Phone Support</div>
                    <div className="text-white/70">+91 1234-567-890</div>
                    <div className="text-white/70 text-sm">Mon-Fri, 9AM-6PM IST</div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xl flex-shrink-0">
                    📍
                  </div>
                  <div>
                    <div className="font-semibold text-lg mb-1">Campus Location</div>
                    <div className="text-white/70">Centurion University</div>
                    <div className="text-white/70">Paralakhemundi, Odisha</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Your Name"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 focus:border-indigo-400 outline-none transition-colors placeholder:text-white/50"
                />
                <input
                  type="email"
                  placeholder="Your Email"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 focus:border-indigo-400 outline-none transition-colors placeholder:text-white/50"
                />
                <textarea
                  placeholder="Your Message"
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 focus:border-indigo-400 outline-none transition-colors placeholder:text-white/50 resize-none"
                ></textarea>
                <button className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 font-semibold hover:from-indigo-500 hover:to-purple-500 transition-all hover:shadow-lg">
                  Send Message
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-gradient-to-b from-slate-900/50 to-slate-900/80">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-teal-500/20 border border-teal-500/30 text-sm mb-6">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span className="text-teal-200 font-medium">User Experiences</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-teal-200 bg-clip-text text-transparent">
              What Our Users Say
            </h2>
            <p className="text-white/80 text-lg max-w-3xl mx-auto">
              Hear from students, faculty, and administrators who use the CUTM Result Portal
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "Priya Sharma",
                role: "Computer Science Student",
                quote: "The CUTM Portal has made tracking my academic progress so much easier. I can access all my results in one place!",
                avatar: "👩‍🎓",
                color: "blue"
              },
              {
                name: "Dr. Rajesh Kumar",
                role: "Associate Professor",
                quote: "As a faculty member, the analytics dashboard helps me identify students who need additional support.",
                avatar: "👨‍🏫",
                color: "purple"
              },
              {
                name: "Amit Patel",
                role: "Department Administrator",
                quote: "The bulk upload feature saves hours of manual data entry. The system is reliable and secure.",
                avatar: "👨‍💼",
                color: "emerald"
              }
            ].map((testimonial, i) => (
              <div key={i} className={`rounded-3xl border border-${testimonial.color}-500/30 bg-gradient-to-br from-${testimonial.color}-500/10 to-transparent p-8 hover:shadow-lg hover:shadow-${testimonial.color}-500/10 transition-all`}>
                <div className="flex flex-col items-center text-center">
                  <div className={`w-20 h-20 rounded-full bg-gradient-to-br from-${testimonial.color}-500 to-${testimonial.color}-600 flex items-center justify-center text-4xl mb-6`}>
                    {testimonial.avatar}
                  </div>
                  <p className="text-white/90 mb-6 italic">"{testimonial.quote}"</p>
                  <h4 className="font-bold text-lg">{testimonial.name}</h4>
                  <p className="text-white/70 text-sm">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Stats Section */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "10,000+", label: "Students" },
              { value: "500+", label: "Faculty Members" },
              { value: "99.9%", label: "Uptime" },
              { value: "24/7", label: "Support" }
            ].map((stat, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent mb-2">{stat.value}</div>
                <div className="text-white/70">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="rounded-3xl border border-white/20 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 backdrop-blur-2xl p-12 text-center">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">Ready to Get Started?</h3>
            <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
              Join thousands of students and faculty members already using CUTM Portal for seamless result management
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/login" className="px-8 py-4 rounded-xl bg-white text-indigo-700 font-semibold text-lg hover:bg-indigo-50 transition-all hover:shadow-xl">
                Login Now
              </Link>
              <Link href="/register" className="px-8 py-4 rounded-xl border-2 border-white/30 bg-white/10 backdrop-blur-sm font-semibold text-lg hover:bg-white/20 transition-all">
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-slate-900/50 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-lg">C</div>
                <span className="font-bold text-lg">CUTM Portal</span>
              </div>
              <p className="text-white/70 text-sm leading-relaxed">
                Your trusted platform for academic result management and performance tracking.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <div className="space-y-2">
                <a href="#home" className="block text-white/70 hover:text-white text-sm transition-colors">Home</a>
                <a href="#features" className="block text-white/70 hover:text-white text-sm transition-colors">Features</a>
                <a href="#about" className="block text-white/70 hover:text-white text-sm transition-colors">About</a>
                <a href="#contact" className="block text-white/70 hover:text-white text-sm transition-colors">Contact</a>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <div className="space-y-2">
                <Link href="/login" className="block text-white/70 hover:text-white text-sm transition-colors">Login</Link>
                <Link href="/register" className="block text-white/70 hover:text-white text-sm transition-colors">Register</Link>
                <a href="#" className="block text-white/70 hover:text-white text-sm transition-colors">Help Center</a>
                <a href="#" className="block text-white/70 hover:text-white text-sm transition-colors">Documentation</a>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <div className="space-y-2">
                <a href="#" className="block text-white/70 hover:text-white text-sm transition-colors">Privacy Policy</a>
                <a href="#" className="block text-white/70 hover:text-white text-sm transition-colors">Terms of Service</a>
                <a href="#" className="block text-white/70 hover:text-white text-sm transition-colors">Cookie Policy</a>
                <a href="#" className="block text-white/70 hover:text-white text-sm transition-colors">Disclaimer</a>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-white/70 text-sm">
                © {new Date().getFullYear()} CUTM Result Portal. All rights reserved.
              </div>
              <div className="flex items-center gap-4 text-sm text-white/70">
                <span>Built with Next.js</span>
                <span>•</span>
                <span>Powered by MongoDB</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}