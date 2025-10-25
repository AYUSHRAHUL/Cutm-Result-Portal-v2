"use client";

import { useState, useEffect } from 'react';
import Link from "next/link";
import { 
  HiAcademicCap, 
  HiUserGroup, 
  HiCog, 
  HiCheckCircle, 
  HiArrowRight, 
  HiChevronDown,
  HiClipboardList,
  HiCalculator,
  HiDocumentDownload,
  HiSearch,
  HiChartBar,
  HiUpload,
  HiAdjustments,
  HiClock,
  HiUsers,
  HiChatAlt2,
  HiLightBulb,
  HiShieldCheck,
  HiGlobe
} from 'react-icons/hi';
import { 
  FaGithub, 
  FaLinkedin, 
  FaEnvelope 
} from 'react-icons/fa';
import { 
  SiNextdotjs,
  SiMongodb,
  SiTailwindcss,
  SiPrisma,
  SiRedis,
  SiVercel
} from 'react-icons/si';
import { 
  MdOutlineScience 
} from 'react-icons/md';
import { 
  RiToolsFill,
  RiStarFill
} from 'react-icons/ri';

export default function HomePage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collegeSlide, setCollegeSlide] = useState(0);

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

  const collegeImages = ["/cutmpkd10.jpg", "/cutmpkd20.jpg", "/cutmpkd30.jpg", "/cutmpkd40.jpg", "/cutmpkd50.jpg"];

  useEffect(() => {
    const t = setInterval(() => {
      setCollegeSlide((p) => (p + 1) % collegeImages.length);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white overflow-x-hidden relative">
      {/* Background - Static */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-gradient-to-r from-indigo-500/10 to-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] bg-gradient-to-r from-cyan-500/10 to-teal-500/10 rounded-full blur-3xl" />
        
        {/* Static Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative">
                <img
                  src="/spinner.jpg"
                  alt="CUTM"
                  className="relative h-20 w-20 sm:h-16 sm:w-16 rounded-xl shadow-md"
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
                  className="relative text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors"
                >
                  {item}
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
                className="relative px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold shadow-lg hover:shadow-xl transition-shadow"
              >
                <span className="relative z-10">Get Started</span>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <div className="w-6 h-5 flex flex-col justify-between">
                <span className={`w-full h-0.5 bg-slate-900 transition-transform ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
                <span className={`w-full h-0.5 bg-slate-900 transition-opacity ${mobileMenuOpen ? 'opacity-0' : ''}`} />
                <span className={`w-full h-0.5 bg-slate-900 transition-transform ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
              </div>
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-6 border-t border-slate-200 bg-white">
              <div className="flex flex-col gap-1">
                {['Home', 'Features', 'About', 'Contact'].map((item, i) => (
                  <a
                    key={i}
                    href={`#${item.toLowerCase()}`}
                    className="px-4 py-3 text-sm font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    {item}
                  </a>
                ))}
                <div className="flex gap-3 pt-4">
                  <Link href="/login" className="flex-1 px-4 py-3 text-center rounded-xl border-2 border-blue-600 text-blue-600 text-sm font-bold hover:bg-blue-50 transition-colors">Login</Link>
                  <Link href="/register" className="flex-1 px-4 py-3 text-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold hover:shadow-lg transition-shadow">Get Started</Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative pt-32 pb-24 min-h-screen flex items-center bg-gradient-to-br from-blue-50 via-white to-purple-50 overflow-hidden">
        {/* Static Pattern */}
        <div className="absolute inset-0 opacity-40" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgb(59 130 246 / 0.12) 1px, transparent 1px)`,
          backgroundSize: '32px 32px'
        }} />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              {/* Badge */}
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${heroSlides[currentSlide].gradient} shadow-md`}>
                <div className="w-2 h-2 rounded-full bg-white" />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  {heroSlides[currentSlide].badge}
                </span>
              </div>

              {/* Main Heading */}
              <div className="space-y-4 sm:space-y-6">
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-tight text-slate-900 relative">
                  <span className="relative z-10">{heroSlides[currentSlide].title}</span>
                </h1>
                <h2 className={`text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r ${heroSlides[currentSlide].gradient} bg-clip-text text-transparent relative`}>
                  <span className="relative z-10">{heroSlides[currentSlide].subtitle}</span>
                </h2>
              </div>

              {/* Description */}
              <p className="text-lg text-slate-600 leading-relaxed max-w-xl">
                {heroSlides[currentSlide].description}
              </p>

              {/* Feature Tags */}
              <div className="flex flex-wrap gap-3">
                {[
                  { name: 'CBCS System', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
                  { name: 'Secure Access', bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
                  { name: 'Real-time Updates', bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
                  { name: 'Multi-Semester', bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200' }
                ].map((tag, i) => (
                  <span
                    key={i}
                    className={`px-4 py-2 rounded-lg text-sm font-bold ${tag.bg} ${tag.text} border-2 ${tag.border} cursor-default`}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-6">
                <Link
                  href="/login"
                  className="relative px-6 sm:px-8 py-3 sm:py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm sm:text-base shadow-xl hover:shadow-2xl transition-shadow text-center"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2 sm:gap-3">
                    Access Portal
                    <HiArrowRight className="w-5 h-5" />
                  </span>
                </Link>
                <a
                  href="#features"
                  className="relative px-6 sm:px-8 py-3 sm:py-4 rounded-2xl border-2 border-blue-600 text-blue-600 font-bold text-sm sm:text-base hover:bg-blue-50 transition-colors text-center"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Learn More
                    <HiChevronDown className="w-5 h-5" />
                  </span>
                </a>
              </div>

              {/* Slide Indicators */}
              <div className="flex gap-2 pt-8">
                {heroSlides.map((slide, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${index === currentSlide
                        ? `w-12 bg-gradient-to-r ${slide.gradient}`
                        : 'w-8 bg-slate-300'
                      }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Right Image Card */}
            <div className="relative">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-200/50 bg-white">
                <div className="aspect-[4/3] relative overflow-hidden">
                  {collegeImages.map((src, idx) => (
                    <img
                      key={src}
                      src={src}
                      alt={`CUTM Campus ${idx + 1}`}
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                        idx === collegeSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
                      }`}
                    />
                  ))}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 via-transparent to-transparent z-20" />
                </div>

                {/* Image Indicators */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-30">
                  {collegeImages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCollegeSlide(idx)}
                      className={`h-2 rounded-full transition-all duration-300 ${idx === collegeSlide
                          ? 'w-10 bg-white shadow-lg'
                          : 'w-2 bg-white/60'
                        }`}
                      aria-label={`Go to image ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gradient-to-r from-white via-blue-50 to-white relative">
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
                icon: <HiAcademicCap className="w-10 h-10" />,
                title: "Student Portal",
                badge: "For Students",
                bgColor: "bg-blue-50",
                borderColor: "border-blue-200",
                accentColor: "text-blue-600",
                gradientFrom: "from-blue-600",
                gradientTo: "to-indigo-600",
                description: "View semester results, calculate CGPA/SGPA, download transcripts, and track your academic progress in real-time.",
                features: [
                  { name: "Result Dashboard", icon: <HiClipboardList className="w-5 h-5" /> },
                  { name: "CGPA Calculator", icon: <HiCalculator className="w-5 h-5" /> },
                  { name: "Transcript Download", icon: <HiDocumentDownload className="w-5 h-5" /> }
                ],
                link: "/login"
              },
              {
                icon: <HiUserGroup className="w-10 h-10" />,
                title: "Teacher Dashboard",
                badge: "For Faculty",
                bgColor: "bg-indigo-50",
                borderColor: "border-indigo-200",
                accentColor: "text-indigo-600",
                gradientFrom: "from-indigo-600",
                gradientTo: "to-purple-600",
                description: "Search student results, review backlogs, generate comprehensive reports, and monitor class performance analytics.",
                features: [
                  { name: "Student Search", icon: <HiSearch className="w-5 h-5" /> },
                  { name: "Performance Reports", icon: <HiClipboardList className="w-5 h-5" /> },
                  { name: "Class Analytics", icon: <HiChartBar className="w-5 h-5" /> }
                ],
                link: "/login"
              },
              {
                icon: <HiCog className="w-10 h-10" />,
                title: "Admin Control",
                badge: "For Administrators",
                bgColor: "bg-teal-50",
                borderColor: "border-teal-200",
                accentColor: "text-teal-600",
                gradientFrom: "from-teal-600",
                gradientTo: "to-cyan-600",
                description: "Manage student records, bulk upload results, configure system settings, and access comprehensive analytics.",
                features: [
                  { name: "Bulk Upload", icon: <HiUpload className="w-5 h-5" /> },
                  { name: "System Settings", icon: <HiAdjustments className="w-5 h-5" /> },
                  { name: "Admin Analytics", icon: <HiChartBar className="w-5 h-5" /> }
                ],
                link: "/login"
              }
            ].map((feature, i) => (
              <div
                key={i}
                className={`p-8 rounded-2xl border-2 ${feature.borderColor} ${feature.bgColor} shadow-lg hover:shadow-xl transition-shadow`}
              >
                {/* Icon */}
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-r ${feature.gradientFrom} ${feature.gradientTo} flex items-center justify-center text-white mb-6 shadow-md`}>
                  {feature.icon}
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
                      <span className={`${feature.accentColor}`}>{item.icon}</span>
                      {item.name}
                    </li>
                  ))}
                </ul>

                {/* Link */}
                <Link
                  href={feature.link}
                  className={`inline-flex items-center gap-2 font-bold ${feature.accentColor} hover:gap-3 transition-all`}
                >
                  Explore Features
                  <HiArrowRight className="w-5 h-5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 bg-gradient-to-b from-indigo-50 via-slate-50 to-teal-50 relative">
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
                icon: <MdOutlineScience className="w-12 h-12" />,
                title: "Our Mission",
                bgColor: "bg-blue-50",
                borderColor: "border-blue-200",
                accentColor: "text-blue-600",
                content: "To provide a seamless, secure, and efficient platform that empowers students, educators, and administrators with instant access to academic results and performance analytics. We are committed to eliminating the complexity of result management."
              },
              {
                icon: <RiStarFill className="w-12 h-12" />,
                title: "Our Vision",
                bgColor: "bg-teal-50",
                borderColor: "border-teal-200",
                accentColor: "text-teal-600",
                content: "To become the leading academic result management system that sets the standard for educational institutions worldwide through innovation, reliability, and exceptional user experience. We envision a future where academic data is universally accessible."
              }
            ].map((item, i) => (
              <div
                key={i}
                className={`p-10 rounded-2xl border-2 ${item.borderColor} ${item.bgColor} shadow-lg hover:shadow-xl transition-shadow`}
              >
                <div className={`w-20 h-20 rounded-xl bg-white border-2 ${item.borderColor} flex items-center justify-center ${item.accentColor} mb-6 shadow-sm`}>
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

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
            {[
              { value: "99.9%", label: "Uptime", icon: <HiClock className="w-12 h-12" />, bgColor: "bg-blue-50", borderColor: "border-blue-200", accentColor: "text-blue-600" },
              { value: "10K+", label: "Students", icon: <HiAcademicCap className="w-12 h-12" />, bgColor: "bg-indigo-50", borderColor: "border-indigo-200", accentColor: "text-indigo-600" },
              { value: "500+", label: "Faculty", icon: <HiUsers className="w-12 h-12" />, bgColor: "bg-teal-50", borderColor: "border-teal-200", accentColor: "text-teal-600" },
              { value: "24/7", label: "Support", icon: <HiChatAlt2 className="w-12 h-12" />, bgColor: "bg-cyan-50", borderColor: "border-cyan-200", accentColor: "text-cyan-600" }
            ].map((stat, i) => (
              <div
                key={i}
                className={`p-8 rounded-2xl border-2 ${stat.borderColor} ${stat.bgColor} text-center shadow-lg hover:shadow-xl transition-shadow cursor-default`}
              >
                <div className={`flex justify-center mb-4 ${stat.accentColor}`}>{stat.icon}</div>
                <div className={`text-4xl font-black mb-2 ${stat.accentColor}`}>
                  {stat.value}
                </div>
                <div className="text-sm text-slate-600 font-semibold uppercase tracking-wide">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Core Values */}
          <div className="p-12 rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/80 shadow-lg">
            <h3 className="text-4xl font-black text-center mb-12 text-slate-900">
              Our Core Values
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {[
                { title: "Innovation", desc: "Constantly evolving with the latest technology", icon: <HiLightBulb className="w-12 h-12" />, bgColor: "bg-amber-50", borderColor: "border-amber-200", accentColor: "text-amber-600" },
                { title: "Security", desc: "Enterprise-grade encryption and secure protocols", icon: <HiShieldCheck className="w-12 h-12" />, bgColor: "bg-teal-50", borderColor: "border-teal-200", accentColor: "text-teal-600" },
                { title: "Accessibility", desc: "Seamless access across all devices", icon: <HiGlobe className="w-12 h-12" />, bgColor: "bg-blue-50", borderColor: "border-blue-200", accentColor: "text-blue-600" }
              ].map((value, i) => (
                <div key={i} className="text-center">
                  <div className={`w-20 h-20 rounded-xl ${value.bgColor} border-2 ${value.borderColor} flex items-center justify-center ${value.accentColor} mx-auto mb-6 shadow-sm hover:shadow-md transition-shadow`}>
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

      {/* Developer Section */}
      <section id="developer" className="py-24 bg-gradient-to-r from-indigo-50 via-white to-blue-50 relative">
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
            <div className="p-8 rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/50 shadow-lg hover:shadow-xl transition-shadow">
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
                      href: "https://github.com", bg: "bg-slate-700", icon: <FaGithub className="w-5 h-5" />
                    },
                    {
                      href: "https://www.linkedin.com/in/ayush-kumar-singh7/", bg: "bg-blue-600", icon: <FaLinkedin className="w-5 h-5" />
                    },
                    {
                      href: "mailto:rahulkrsingh4321@gmail.com", bg: "bg-teal-600", icon: <FaEnvelope className="w-5 h-5" />
                    }
                  ].map((social, i) => (
                    <a
                      key={i}
                      href={social.href}
                      className={`w-11 h-11 rounded-xl ${social.bg} text-white flex items-center justify-center shadow-md hover:shadow-lg transition-shadow`}
                    >
                      {social.icon}
                    </a>
                  ))}
                </div>

                <a
                  href="https://protfolio-seven-roan.vercel.app"
                  className="inline-block px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold shadow-lg hover:shadow-xl transition-shadow text-sm"
                >
                  View Portfolio
                </a>
              </div>
            </div>

            {/* Info Cards */}
            <div className="space-y-6">
              <div className="p-6 rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50/80 to-white shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 flex items-center justify-center text-white shadow-md">
                    <HiAcademicCap className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-blue-600">Under Guidance</h4>
                    <p className="text-sm text-slate-900 font-bold">Prof Sn Padhay</p>
                  </div>
                </div>
                <p className="text-slate-600 text-sm">
                  Developed under expert guidance.
                </p>
              </div>

              <div className="p-6 rounded-2xl border-2 border-teal-200 bg-gradient-to-br from-teal-50/80 to-white shadow-lg hover:shadow-xl transition-shadow">
                <h4 className="text-lg font-black text-teal-600 mb-4 flex items-center justify-center gap-2">
                  <RiToolsFill className="w-6 h-6" />
                  Technologies Used
                </h4>

                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { name: 'Next.js', bg: 'bg-slate-700', icon: <SiNextdotjs className="w-4 h-4" /> },
                    { name: 'MongoDB', bg: 'bg-teal-600', icon: <SiMongodb className="w-4 h-4" /> },
                    { name: 'Tailwind', bg: 'bg-cyan-600', icon: <SiTailwindcss className="w-4 h-4" /> },
                    { name: 'Prisma', bg: 'bg-indigo-600', icon: <SiPrisma className="w-4 h-4" /> },
                    { name: 'Redis', bg: 'bg-red-600', icon: <SiRedis className="w-4 h-4" /> },
                    { name: 'Vercel', bg: 'bg-slate-800', icon: <SiVercel className="w-4 h-4" /> }
                  ].map((tech, i) => (
                    <div
                      key={i}
                      className={`px-3 py-2 rounded-lg text-xs font-bold ${tech.bg} text-white text-center shadow-md hover:shadow-lg transition-shadow flex items-center justify-center gap-1.5`}
                    >
                      {tech.icon}
                      {tech.name}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-white shadow-lg hover:shadow-xl transition-shadow">
                <h4 className="text-lg font-black text-indigo-600 mb-4 flex items-center gap-2">
                  <HiCheckCircle className="w-6 h-6" />
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
                      <HiCheckCircle className="w-5 h-5 text-indigo-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
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
                    <a key={idx} href="#" className="block text-sm text-slate-600 hover:text-blue-600 font-medium transition-colors">
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
    </div>
  );
}
