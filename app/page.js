


"use client";

import { useState, useEffect } from 'react';
import Link from "next/link";

export default function HomePage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collegeSlide, setCollegeSlide] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isClient, setIsClient] = useState(false);

  const heroSlides = [
    {
      title: "Academic Excellence",
      subtitle: "CUTM Result Portal",
      description: "Access your academic results instantly with our comprehensive portal system",
      badge: "Result Portal",
      gradient: "from-blue-600 via-indigo-600 to-blue-700"
    },
    {
      title: "Track Your Progress",
      subtitle: "CBCS Basket Tracking",
      description: "Monitor your basket progress with real-time updates and analytics",
      badge: "Basket System",
      gradient: "from-indigo-600 via-purple-600 to-indigo-700"
    },
    {
      title: "Seamless Integration",
      subtitle: "Lateral Entry Support",
      description: "Specialized tracking designed for lateral entry students",
      badge: "Lateral Entry",
      gradient: "from-teal-600 via-cyan-600 to-teal-700"
    },
    {
      title: "Complete Overview",
      subtitle: "Multi-Semester View",
      description: "View and analyze results across all your semesters",
      badge: "Analytics",
      gradient: "from-blue-600 via-cyan-600 to-blue-700"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Set client-side flag
    setIsClient(true);

    // Check if window is available (client-side)
    if (typeof window === 'undefined') return;

    const handleScroll = () => setScrollY(window.scrollY);
    const handleMouseMove = (e) => setMousePosition({ x: e.clientX, y: e.clientY });

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const collegeImages = ["/cutmpkd.jpg", "/cutmpkd1.jpg"];

  useEffect(() => {
    const t = setInterval(() => {
      setCollegeSlide((p) => (p + 1) % collegeImages.length);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white overflow-x-hidden animate-gradient-x relative">
      {/* Enhanced Subtle Professional Background Orbs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {isClient && (
          <div
            className="absolute w-[600px] h-[600px] bg-gradient-to-r from-blue-500/10 via-indigo-500/15 to-purple-500/10 rounded-full blur-3xl"
            style={{
              top: mousePosition.y * 0.03 + 'px',
              left: mousePosition.x * 0.03 + 'px',
              transition: 'top 0.5s ease-out, left 0.5s ease-out'
            }}
          />
        )}
        <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-gradient-to-r from-indigo-500/10 to-blue-500/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] bg-gradient-to-r from-cyan-500/10 to-teal-500/10 rounded-full blur-3xl animate-pulse-slow delay-2000" />

        {/* Additional Animated Orb for Depth */}
        <div className="absolute w-[400px] h-[400px] bg-gradient-to-r from-purple-500/8 via-pink-500/5 to-indigo-500/8 rounded-full blur-3xl top-1/2 left-1/4 animate-ping" style={{ animationDelay: '3s' }} />

        {/* Mouse-Following Gradient Orb - Only render on client */}
        {isClient && (
          <div
            className="absolute w-[300px] h-[300px] rounded-full blur-2xl opacity-30"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #06b6d4 100%)',
              top: (mousePosition.y * 0.02 + (typeof window !== 'undefined' ? window.innerHeight * 0.1 : 100)) + 'px',
              left: (mousePosition.x * 0.02 + (typeof window !== 'undefined' ? window.innerWidth * 0.1 : 100)) + 'px',
              transition: 'top 0.3s ease-out, left 0.3s ease-out',
              transform: 'scale(0.8)'
            }}
          />
        )}

        {/* Modern Floating Geometric Shapes */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-gradient-to-r from-blue-400/20 to-indigo-400/20 rounded-2xl rotate-45 animate-float" />
        <div className="absolute top-40 right-20 w-16 h-16 bg-gradient-to-r from-purple-400/20 to-pink-400/20 rounded-full animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-40 left-20 w-24 h-24 bg-gradient-to-r from-cyan-400/20 to-teal-400/20 rounded-3xl rotate-12 animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-20 right-10 w-12 h-12 bg-gradient-to-r from-indigo-400/20 to-blue-400/20 rounded-xl rotate-45 animate-float" style={{ animationDelay: '3s' }} />

        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      {/* Professional Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-900 to-indigo-900 rounded-xl blur-md opacity-40 group-hover:opacity-70 transition-opacity" />
                <img
                  src="/spinner.jpg"
                  alt="CUTM"
                  className="relative h-20 w-20 sm:h-16 sm:w-16 rounded-xl   ring-blue-600/30 group-hover:ring-blue-600/100 transition-all duration-300 shadow-md group-hover:scale-105"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-lg sm:text-xl text-slate-900">CUTM Portal</span>
                <span className="text-xs font-bold text-blue-600 hidden sm:block">Academic Results</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              {['Home', 'Features', 'About', 'Contact'].map((item, i) => (
                <a
                  key={i}
                  href={`#${item.toLowerCase()}`}
                  className="relative text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors group"
                >
                  {item}
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300" />
                </a>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-4">
              <Link
                href="/login"
                className="px-6 py-2.5 text-sm font-bold text-slate-700 hover:text-blue-600 transition-colors"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="relative px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold overflow-hidden group shadow-lg hover:shadow-xl transition-all"
              >
                <span className="relative z-10">Get Started</span>
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <div className="w-6 h-5 flex flex-col justify-between">
                <span className={`w-full h-0.5 bg-slate-900 transition-all ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
                <span className={`w-full h-0.5 bg-slate-900 transition-all ${mobileMenuOpen ? 'opacity-0' : ''}`} />
                <span className={`w-full h-0.5 bg-slate-900 transition-all ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
              </div>
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-6 border-t border-slate-200 animate-fadeIn bg-white">
              <div className="flex flex-col gap-1">
                {['Home', 'Features', 'About', 'Contact'].map((item, i) => (
                  <a
                    key={i}
                    href={`#${item.toLowerCase()}`}
                    className="px-4 py-3 text-sm font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                  >
                    {item}
                  </a>
                ))}
                <div className="flex gap-3 pt-4">
                  <Link href="/login" className="flex-1 px-4 py-3 text-center rounded-xl border-2 border-blue-600 text-blue-600 text-sm font-bold hover:bg-blue-50 transition-all">Login</Link>
                  <Link href="/register" className="flex-1 px-4 py-3 text-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold hover:shadow-lg transition-all">Get Started</Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Enhanced Hero Section with Professional Colors */}
      <section id="home" className="relative pt-32 pb-24 min-h-screen flex items-center bg-gradient-to-br from-blue-50 via-white to-purple-50 animate-gradient-xy overflow-hidden">
        {/* Enhanced Subtle Pattern */}
        <div className="absolute inset-0 opacity-40" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgb(59 130 246 / 0.12) 1px, transparent 1px)`,
          backgroundSize: '32px 32px'
        }} />

        {/* Modern Hero Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-blue-400/5 to-indigo-400/5 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gradient-to-r from-purple-400/5 to-pink-400/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left Content */}
            <div className="space-y-8 animate-slideInLeft">
              {/* Professional Badge */}
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${heroSlides[currentSlide].gradient} shadow-md`}>
                <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  {heroSlides[currentSlide].badge}
                </span>
              </div>

              {/* Main Heading */}
              <div className="space-y-4 sm:space-y-6">
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-tight text-slate-900 relative">
                  <span className="relative z-10">{heroSlides[currentSlide].title}</span>
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-purple-600/20 blur-xl opacity-50 animate-pulse-slow" />
                </h1>
                <h2 className={`text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r ${heroSlides[currentSlide].gradient} bg-clip-text text-transparent relative`}>
                  <span className="relative z-10">{heroSlides[currentSlide].subtitle}</span>
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 blur-lg opacity-30" />
                </h2>
              </div>

              {/* Description */}
              <p className="text-lg text-slate-600 leading-relaxed max-w-xl">
                {heroSlides[currentSlide].description}
              </p>

              {/* Professional Feature Tags */}
              <div className="flex flex-wrap gap-3">
                {[
                  { name: 'CBCS System', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
                  { name: 'Secure Access', bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
                  { name: 'Real-time Updates', bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
                  { name: 'Multi-Semester', bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' }
                ].map((tag, i) => (
                  <span
                    key={i}
                    className={`px-4 py-2 rounded-lg text-sm font-bold ${tag.bg} ${tag.text} border-2 ${tag.border} hover:scale-105 hover:shadow-md transition-all cursor-default`}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-6">
                <Link
                  href="/login"
                  className="group relative px-6 sm:px-8 py-3 sm:py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm sm:text-base overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 text-center"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2 sm:gap-3">
                    Access Portal
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-600 translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </Link>
                <a
                  href="#features"
                  className="group relative px-6 sm:px-8 py-3 sm:py-4 rounded-2xl border-2 border-blue-600 text-blue-600 font-bold text-sm sm:text-base hover:bg-blue-600 hover:text-white transition-all duration-300 hover:scale-105 hover:shadow-xl overflow-hidden text-center"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Learn More
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                  <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                </a>
              </div>

              {/* Slide Indicators */}
              <div className="flex gap-2 pt-8">
                {heroSlides.map((slide, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`h-1.5 rounded-full transition-all ${index === currentSlide
                        ? `w-12 bg-gradient-to-r ${slide.gradient}`
                        : 'w-8 bg-slate-300'
                      }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Right Image Card */}
            <div className="relative animate-slideInRight">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-200/50 bg-white hover:scale-[1.02] transition-all duration-500 hover:shadow-3xl group">
                <div className="aspect-[4/3] relative overflow-hidden">
                  {collegeImages.map((src, idx) => (
                    <img
                      key={src}
                      src={src}
                      alt="CUTM Campus"
                      className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 group-hover:scale-110 ${idx === collegeSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
                        }`}
                    />
                  ))}

                  {/* Enhanced Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 via-transparent to-transparent" />

                  {/* Modern Glass Effect Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent backdrop-blur-[1px]" />
                </div>

                {/* Image Indicators */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3">
                  {collegeImages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCollegeSlide(idx)}
                      className={`h-2 rounded-full transition-all duration-300 ${idx === collegeSlide
                          ? 'w-10 bg-white shadow-lg'
                          : 'w-2 bg-white/60 hover:bg-white/80 hover:w-6'
                        }`}
                      aria-label={`Go to image ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>

              {/* Enhanced Modern Floating Elements */}
              <div className="absolute -top-6 -right-6 w-32 h-32 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-full blur-3xl animate-pulse-slow" />
              <div className="absolute -bottom-6 -left-6 w-28 h-28 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
              <div className="absolute top-1/3 right-6 w-20 h-20 bg-gradient-to-r from-cyan-500/20 to-teal-500/20 rounded-full blur-2xl animate-float" />

              {/* Modern Geometric Accents */}
              <div className="absolute top-4 right-4 w-8 h-8 bg-gradient-to-r from-blue-400/30 to-indigo-400/30 rounded-lg rotate-45 animate-float" style={{ animationDelay: '2s' }} />
              <div className="absolute bottom-4 left-4 w-6 h-6 bg-gradient-to-r from-purple-400/30 to-pink-400/30 rounded-full animate-float" style={{ animationDelay: '3s' }} />
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Features Section with Professional Background */}
      <section id="features" className="py-24 bg-gradient-to-r from-white via-blue-50 to-white relative animate-pulse-slow">
        <div className="relative mx-auto max-w-7xl px-6">
          {/* Section Header */}
          <div className="text-center mb-20">
            <div className="inline-block px-5 py-2 rounded-full bg-blue-100 text-blue-700 border-2 border-blue-200 text-sm font-bold mb-6">
              Features
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6">
              Everything You Need
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Comprehensive tools for students, faculty, and administrators
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: "📚",
                title: "Student Portal",
                badge: "For Students",
                bgColor: "bg-blue-50",
                borderColor: "border-blue-200",
                accentColor: "text-blue-600",
                gradientFrom: "from-blue-600",
                gradientTo: "to-indigo-600",
                description: "View semester results, calculate CGPA/SGPA, download transcripts, and track your academic progress in real-time.",
                features: ["Result Dashboard", "CGPA Calculator", "Transcript Download"],
                link: "/login"
              },
              {
                icon: "👨‍🏫",
                title: "Teacher Dashboard",
                badge: "For Faculty",
                bgColor: "bg-indigo-50",
                borderColor: "border-indigo-200",
                accentColor: "text-indigo-600",
                gradientFrom: "from-indigo-600",
                gradientTo: "to-purple-600",
                description: "Search student results, review backlogs, generate comprehensive reports, and monitor class performance analytics.",
                features: ["Student Search", "Performance Reports", "Class Analytics"],
                link: "/login"
              },
              {
                icon: "⚙️",
                title: "Admin Control",
                badge: "For Administrators",
                bgColor: "bg-teal-50",
                borderColor: "border-teal-200",
                accentColor: "text-teal-600",
                gradientFrom: "from-teal-600",
                gradientTo: "to-cyan-600",
                description: "Manage student records, bulk upload results, configure system settings, and access comprehensive analytics.",
                features: ["Bulk Upload", "System Settings", "Admin Analytics"],
                link: "/login"
              }
            ].map((feature, i) => (
              <div
                key={i}
                className={`group relative p-8 rounded-2xl border-2 ${feature.borderColor} ${feature.bgColor} hover:shadow-2xl transition-all duration-500 hover:-translate-y-2`}
              >
                {/* Icon */}
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-r ${feature.gradientFrom} ${feature.gradientTo} flex items-center justify-center text-4xl mb-6 group-hover:scale-110 transition-transform shadow-md`}>
                  <span className="filter drop-shadow-sm">{feature.icon}</span>
                </div>

                {/* Badge */}
                <div className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold mb-4 bg-white ${feature.accentColor} border-2 ${feature.borderColor}`}>
                  {feature.badge}
                </div>

                {/* Title */}
                <h3 className="text-2xl font-black text-slate-900 mb-4">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="text-slate-600 mb-6 leading-relaxed">
                  {feature.description}
                </p>

                {/* Feature List */}
                <ul className="space-y-2 mb-6">
                  {feature.features.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                      <svg className={`w-5 h-5 ${feature.accentColor}`} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>

                {/* Link */}
                <Link
                  href={feature.link}
                  className={`inline-flex items-center gap-2 font-bold ${feature.accentColor} group-hover:gap-3 transition-all`}
                >
                  Explore Features
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enhanced About Section with Professional Background */}
      <section id="about" className="py-24 bg-gradient-to-b from-indigo-50 via-slate-50 to-teal-50 relative animate-gradient-y">
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6">
              About CUTM Portal
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Transforming academic result management through innovative technology
            </p>
          </div>

          {/* Mission & Vision */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-20">
            {[
              {
                icon: "🎯",
                title: "Our Mission",
                bgColor: "bg-blue-50",
                borderColor: "border-blue-200",
                accentColor: "text-blue-600",
                content: "To provide a seamless, secure, and efficient platform that empowers students, educators, and administrators with instant access to academic results and performance analytics. We are committed to eliminating the complexity of result management."
              },
              {
                icon: "🌟",
                title: "Our Vision",
                bgColor: "bg-teal-50",
                borderColor: "border-teal-200",
                accentColor: "text-teal-600",
                content: "To become the leading academic result management system that sets the standard for educational institutions worldwide through innovation, reliability, and exceptional user experience. We envision a future where academic data is universally accessible."
              }
            ].map((item, i) => (
              <div
                key={i}
                className={`p-10 rounded-2xl border-2 ${item.borderColor} ${item.bgColor} hover:shadow-xl transition-all duration-500 hover:-translate-y-2`}
              >
                <div className={`w-20 h-20 rounded-xl bg-white border-2 ${item.borderColor} flex items-center justify-center text-5xl mb-6 shadow-sm`}>
                  {item.icon}
                </div>
                <h3 className={`text-3xl font-black mb-4 ${item.accentColor}`}>
                  {item.title}
                </h3>
                <p className="text-slate-600 leading-relaxed text-lg">
                  {item.content}
                </p>
              </div>
            ))}
          </div>

          {/* Professional Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
            {[
              { value: "99.9%", label: "Uptime", icon: "⏱️", bgColor: "bg-blue-50", borderColor: "border-blue-200", accentColor: "text-blue-600" },
              { value: "10K+", label: "Students", icon: "🎓", bgColor: "bg-indigo-50", borderColor: "border-indigo-200", accentColor: "text-indigo-600" },
              { value: "500+", label: "Faculty", icon: "👨‍🏫", bgColor: "bg-teal-50", borderColor: "border-teal-200", accentColor: "text-teal-600" },
              { value: "24/7", label: "Support", icon: "💬", bgColor: "bg-cyan-50", borderColor: "border-cyan-200", accentColor: "text-cyan-600" }
            ].map((stat, i) => (
              <div
                key={i}
                className={`p-8 rounded-2xl border-2 ${stat.borderColor} ${stat.bgColor} text-center hover:shadow-xl transition-all duration-500 hover:-translate-y-2 cursor-default`}
              >
                <div className="text-5xl mb-4">{stat.icon}</div>
                <div className={`text-4xl font-black mb-2 ${stat.accentColor}`}>
                  {stat.value}
                </div>
                <div className="text-sm text-slate-600 font-semibold uppercase tracking-wide">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Core Values with Enhanced Gradient Background */}
          <div className="p-12 rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/80 animate-gradient-x">
            <h3 className="text-4xl font-black text-center mb-12 text-slate-900">
              Our Core Values
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {[
                { title: "Innovation", desc: "Constantly evolving with the latest technology", icon: "💡", bgColor: "bg-amber-50", borderColor: "border-amber-200", accentColor: "text-amber-600" },
                { title: "Security", desc: "Enterprise-grade encryption and secure protocols", icon: "🔒", bgColor: "bg-teal-50", borderColor: "border-teal-200", accentColor: "text-teal-600" },
                { title: "Accessibility", desc: "Seamless access across all devices", icon: "🌐", bgColor: "bg-blue-50", borderColor: "border-blue-200", accentColor: "text-blue-600" }
              ].map((value, i) => (
                <div key={i} className="text-center group">
                  <div className={`w-20 h-20 rounded-xl ${value.bgColor} border-2 ${value.borderColor} flex items-center justify-center text-5xl mx-auto mb-6 shadow-sm group-hover:scale-110 transition-transform`}>
                    {value.icon}
                  </div>
                  <h4 className={`text-2xl font-black mb-3 ${value.accentColor}`}>
                    {value.title}
                  </h4>
                  <p className="text-slate-600">{value.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Developer Section with Professional Colors */}
      <section id="developer" className="py-24 bg-gradient-to-r from-indigo-50 via-white to-blue-50 relative animate-gradient-y">
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="text-center mb-20">
            <div className="inline-block px-5 py-2 rounded-full bg-indigo-100 text-indigo-700 border-2 border-indigo-200 text-sm font-bold mb-6">
              Meet the Developer
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6">
              Behind the Portal
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start max-w-6xl mx-auto">
            {/* Developer Card */}
            <div className="p-8 rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/50">
              <div className="relative">
                {/* Image Container */}
                <div className="relative aspect-square max-w-xs mx-auto rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 overflow-hidden mb-6 border-2 border-indigo-200">
                  <img
                    src="/ayush.png"
                    alt="Developer"
                    className="relative w-full h-full object-cover"
                  />
                </div>
              </div>

              <div className="text-center">
                <h3 className="text-2xl font-black text-slate-900 mb-2">
                  Ayush Kumar Singh
                </h3>
                <p className="text-lg font-bold text-indigo-600 mb-2">
                  Full Stack Developer
                </p>
                <p className="text-slate-700 font-semibold mb-4 text-sm">
                  ECE Student | 2022 Batch
                </p>
                <p className="text-slate-600 mb-6 text-sm">
                  Passionate about creating innovative solutions for education
                </p>


                {/* Social Links */}
                <div className="flex justify-center gap-3 mb-6">
                  {[
                    {
                      href: "https://github.com", bg: "bg-slate-700", icon: (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                      )
                    },
                    {
                      href: "https://www.linkedin.com/in/ayush-kumar-singh7/", bg: "bg-blue-600", icon: (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
                      )
                    },
                    {
                      href: "rahulkrsingh4321@gmail.com", bg: "bg-teal-600", icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      )
                    }
                  ].map((social, i) => (
                    <a
                      key={i}
                      href={social.href}
                      className={`w-11 h-11 rounded-xl ${social.bg} text-white flex items-center justify-center hover:scale-110 hover:shadow-lg transition-all`}
                    >
                      {social.icon}
                    </a>
                  ))}
                </div>

                <a
                  href="https://protfolio-seven-roan.vercel.app"
                  className="inline-block px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold hover:shadow-lg hover:scale-105 transition-all text-sm"
                >
                  View Portfolio
                </a>
              </div>
            </div>

            {/* Info Cards */}
            <div className="space-y-6">
              <div className="p-6 rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50/80 to-white hover:shadow-xl transition-all">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 flex items-center justify-center text-2xl shadow-md">
                    🎓
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-blue-600">Under Guidance</h4>
                    <p className="text-sm text-slate-900 font-bold">Prof Sn Padhay</p>
                  </div>
                </div>
                <p className="text-slate-600 text-sm">
                  Developed under expert guidance .
                </p>
              </div>

              <div className="p-6 rounded-2xl border-2 border-teal-200 bg-gradient-to-br from-teal-50/80 to-white hover:shadow-xl transition-all">
                <h4 className="text-lg font-black text-teal-600 mb-4 flex items-center justify-center gap-2">
                  <span className="text-2xl">🛠️</span>
                  Technologies Used
                </h4>

                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { name: 'Next.js', bg: 'bg-slate-700' },
                    { name: 'MongoDB', bg: 'bg-teal-600' },
                    { name: 'Tailwind', bg: 'bg-cyan-600' },
                    { name: 'Prisma', bg: 'bg-indigo-600' },
                    { name: 'Redis', bg: 'bg-red-600' },
                    { name: 'Vercel', bg: 'bg-slate-800' }
                  ].map((tech, i) => (
                    <div
                      key={i}
                      className={`px-3 py-2 rounded-lg text-xs font-bold ${tech.bg} text-white text-center shadow-md hover:scale-105 transition-all`}
                    >
                      {tech.name}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-white hover:shadow-xl transition-all">
                <h4 className="text-lg font-black text-indigo-600 mb-4 flex items-center gap-2">
                  <span className="text-2xl">✨</span>
                  Project Highlights
                </h4>
                <ul className="space-y-2">
                  {[
                    "Real-time data synchronization",
                    "Role-based access control",
                    "Advanced analytics dashboard",
                    "Mobile-responsive design"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                      <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Professional Footer with Gradient Accent */}
      <footer className="border-t-2 border-slate-200 bg-gradient-to-r from-slate-100 via-blue-50 to-slate-100">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md">C</div>
                <span className="font-black text-xl text-slate-900">CUTM Portal</span>
              </div>
              <p className="text-slate-600 text-sm">
                Academic result management platform for CUTM
              </p>
            </div>

            {[
              { title: "Quick Links", links: ['Home', 'Features', 'About', 'Contact'] },
              { title: "Resources", links: ['Login', 'Register', 'Help', 'Docs'] },
              { title: "Legal", links: ['Privacy', 'Terms', 'Cookies', 'Disclaimer'] }
            ].map((section, i) => (
              <div key={i}>
                <h4 className="font-black text-slate-900 mb-4">{section.title}</h4>
                <div className="space-y-3">
                  {section.links.map((link, idx) => (
                    <a key={idx} href="#" className="block text-sm text-slate-600 hover:text-blue-600 transition-colors font-medium">
                      {link}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t-2 border-slate-200 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-600 font-medium">
              © {new Date().getFullYear()} CUTM Portal. All rights reserved.
            </p>
            
          </div>
        </div>
      </footer>

      {/* Enhanced Custom CSS for Animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* New Gradient Animations */
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        @keyframes gradient-xy {
          0%, 100% { 
            background-position: 0% 0%, 0% 50%, 0% 100%; 
          }
          50% { 
            background-position: 100% 0%, 100% 50%, 100% 100%; 
          }
        }
        
        @keyframes gradient-y {
          0%, 100% { background-position: 50% 0%; }
          50% { background-position: 50% 100%; }
        }

        .animate-pulse-slow {
          animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        
        .animate-fadeInUp {
          animation: fadeInUp 0.8s ease-out forwards;
        }
        
        .animate-slideInLeft {
          animation: slideInLeft 0.8s ease-out;
        }
        
        .animate-slideInRight {
          animation: slideInRight 0.8s ease-out;
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 15s ease infinite;
        }
        
        .animate-gradient-xy {
          background-size: 200% 200%, 200% 100%, 200% 200%;
          animation: gradient-xy 20s ease infinite;
        }
        
        .animate-gradient-y {
          background-size: 100% 200%;
          animation: gradient-y 12s ease infinite;
        }
        
        .delay-2000 {
          animation-delay: 2s;
        }
        
        /* Enhanced Responsive Styles */
        @media (max-width: 768px) {
          .animate-gradient-x,
          .animate-gradient-xy,
          .animate-gradient-y {
            background-size: 150% 150% !important;
          }
        }

        /* Modern Glass Morphism Effect */
        .glass-morphism {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        /* Enhanced Shadow Effects */
        .shadow-3xl {
          box-shadow: 0 35px 60px -12px rgba(0, 0, 0, 0.25);
        }

        /* Modern Hover Effects */
        .hover-lift {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .hover-lift:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }

        /* Gradient Text Animation */
        @keyframes gradient-text {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .animate-gradient-text {
          background-size: 200% 200%;
          animation: gradient-text 3s ease infinite;
        }

        /* Modern Button Hover Effects */
        .btn-modern {
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
        }

        .btn-modern::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          transition: left 0.5s;
        }

        .btn-modern:hover::before {
          left: 100%;
        }
      `}</style>
    </div>
  );
}
