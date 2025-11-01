"use client";

import { useState, useEffect } from 'react';
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
  HiGlobe,
  HiMenu,
  HiX,
  HiStar,
  HiSparkles
} from 'react-icons/hi';

// Simulated icons
const FaGithub = () => <HiAcademicCap className="w-5 h-5" />;
const FaLinkedin = () => <HiUserGroup className="w-5 h-5" />;
const FaEnvelope = () => <HiChatAlt2 className="w-5 h-5" />;
const SiNextdotjs = () => <HiCog className="w-4 h-4" />;
const SiMongodb = () => <HiChartBar className="w-4 h-4" />;
const SiTailwindcss = () => <HiAdjustments className="w-4 h-4" />;
const SiPrisma = () => <HiClipboardList className="w-4 h-4" />;
const SiRedis = () => <HiSearch className="w-4 h-4" />;
const SiVercel = () => <HiUpload className="w-4 h-4" />;
const MdOutlineScience = () => <HiLightBulb className="w-12 h-12" />;
const RiStarFill = () => <HiStar className="w-12 h-12" />;
const RiToolsFill = () => <HiCog className="w-6 h-6" />;

export default function HomePage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collegeSlide, setCollegeSlide] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    const handleMouseMove = (e) => setMousePosition({ x: e.clientX, y: e.clientY });
    
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const heroSlides = [
    {
      title: "Academic Excellence",
      subtitle: "CUTM ACADEMIC TRACKER",
      description: "Access your academic results instantly with our comprehensive portal system",
      badge: "Result Portal"
    },
    {
      title: "Track Your Progress",
      subtitle: "CBCS Basket Tracking",
      description: "Monitor your basket progress with real-time updates and analytics",
      badge: "Basket System"
    },
    {
      title: "Seamless Integration",
      subtitle: "Lateral Entry Support",
      description: "Specialized tracking designed for lateral entry students",
      badge: "Lateral Entry"
    },
    {
      title: "Complete Overview",
      subtitle: "Multi-Semester View",
      description: "View and analyze results across all your semesters",
      badge: "Analytics"
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
<div 
  className="min-h-screen bg-gradient-to-br from-[#F5F8FA] via-[#E8F4F8] to-[#D1E9F6] text-[#1A1F29] overflow-hidden"
  style={{ 
    zoom: 0.9
  }}
>
      {/* Dynamic Animated Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* Animated Gradient Orbs - Reduced opacity for formal look */}
        <div 
          className="absolute w-[800px] h-[800px] rounded-full blur-3xl opacity-15 animate-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(5,163,199,0.25) 0%, transparent 70%)',
            top: mousePosition.y / 20 - 400,
            left: mousePosition.x / 20 - 400,
            transition: 'all 0.3s ease-out'
          }}
        />
        <div className="absolute top-1/4 -right-48 w-[600px] h-[600px] rounded-full blur-3xl animate-pulse opacity-10" 
             style={{ 
               background: 'radial-gradient(circle, rgba(241,143,1,0.2) 0%, transparent 70%)',
               animationDelay: '1s', 
               animationDuration: '4s' 
             }} />
        <div className="absolute bottom-0 -left-48 w-[600px] h-[600px] rounded-full blur-3xl animate-pulse opacity-10" 
             style={{ 
               background: 'radial-gradient(circle, rgba(5,163,199,0.2) 0%, transparent 70%)',
               animationDelay: '2s', 
               animationDuration: '5s' 
             }} />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] rounded-full blur-3xl animate-pulse opacity-10" 
             style={{ 
               background: 'radial-gradient(circle, rgba(241,143,1,0.15) 0%, transparent 70%)',
               animationDelay: '0.5s', 
               animationDuration: '6s' 
             }} />
        
        {/* Animated Grid */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(5,163,199,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(5,163,199,0.2) 1px, transparent 1px)`,
            backgroundSize: '80px 80px',
            animation: 'gridMove 20s linear infinite'
          }} />
        </div>

        {/* Floating Particles - Fixed positions to prevent hydration mismatch */}
        <div className="absolute inset-0">
          {[
            { top: '10%', left: '15%', delay: '0s', duration: '8s' },
            { top: '20%', left: '85%', delay: '1s', duration: '12s' },
            { top: '30%', left: '25%', delay: '2s', duration: '10s' },
            { top: '40%', left: '75%', delay: '0.5s', duration: '9s' },
            { top: '50%', left: '45%', delay: '3s', duration: '11s' },
            { top: '60%', left: '15%', delay: '1.5s', duration: '7s' },
            { top: '70%', left: '85%', delay: '2.5s', duration: '13s' },
            { top: '80%', left: '35%', delay: '0.8s', duration: '8.5s' },
            { top: '90%', left: '65%', delay: '3.5s', duration: '10.5s' },
            { top: '15%', left: '55%', delay: '1.2s', duration: '9.5s' },
            { top: '25%', left: '95%', delay: '2.8s', duration: '11.5s' },
            { top: '35%', left: '5%', delay: '0.3s', duration: '7.5s' },
            { top: '45%', left: '65%', delay: '3.2s', duration: '12.5s' },
            { top: '55%', left: '25%', delay: '1.8s', duration: '8.8s' },
            { top: '65%', left: '75%', delay: '2.2s', duration: '9.8s' }
          ].map((particle, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full opacity-20"
              style={{
                background: i % 2 === 0 ? '#F18F01' : '#05A3C7',
                top: particle.top,
                left: particle.left,
                animation: `float ${particle.duration} ease-in-out infinite`,
                animationDelay: particle.delay
              }}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes gridMove {
          0% { transform: translateY(0); }
          100% { transform: translateY(80px); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-30px) translateX(10px); }
          50% { transform: translateY(-60px) translateX(-10px); }
          75% { transform: translateY(-30px) translateX(10px); }
        }
      `}</style>

      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled 
          ? 'backdrop-blur-2xl shadow-lg border-b' 
          : 'bg-transparent'
      }`}
      style={{
        backgroundColor: scrolled ? 'rgba(255,255,255,0.95)' : 'transparent',
        borderColor: scrolled ? 'rgba(5,163,199,0.15)' : 'transparent',
        boxShadow: scrolled ? '0 10px 40px rgba(5,163,199,0.1)' : 'none'
      }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center justify-between h-20">
            <a href="#" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl blur-lg opacity-30 group-hover:opacity-50 transition-all duration-300"
                     style={{ background: 'linear-gradient(135deg, #05A3C7 0%, #F18F01 100%)' }} />
                <img
                  src="/spinner.jpg"
                  alt="CUTM"
                  className="relative h-14 w-14 rounded-2xl shadow-lg   group-hover:scale-105 transition-transform duration-300"
                  style={{ ringColor: 'rgba(5,163,199,0.3)' }}
                />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-xl text-[#1A1F29]">
                  CUTM 
                </span>
                <span className="text-xs font-bold" style={{ color: '#05A3C7' }}>ACADEMIC TRACKER</span>
              </div>
            </a>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-2">
              {['Home', 'Features', 'About', 'Contact'].map((item, i) => (
                <a
                  key={i}
                  href={`#${item.toLowerCase()}`}
                  className="relative px-5 py-2 text-sm font-bold text-[#2E4057] hover:text-[#05A3C7] transition-all duration-300 group"
                >
                  <span className="relative z-10">{item}</span>
                  <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300"
                       style={{ background: 'linear-gradient(90deg, rgba(5,163,199,0) 0%, rgba(5,163,199,0.1) 50%, rgba(5,163,199,0) 100%)' }} />
                </a>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-4">
              <a
                href="/login"
                className="px-6 py-2.5 text-sm font-bold text-[#2E4057] hover:text-[#05A3C7] transition-all duration-300 hover:scale-105"
              >
                Login
              </a>
              <a
                href="/register"
                className="relative px-8 py-3 rounded-xl text-white text-sm font-black shadow-lg transition-all duration-300 hover:scale-105 overflow-hidden group"
                style={{ 
                  background: 'linear-gradient(135deg, #05A3C7 0%, #04748F 100%)',
                  boxShadow: '0 10px 30px rgba(5,163,199,0.3)'
                }}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500"
                     style={{ background: 'linear-gradient(135deg, #F18F01 0%, #C17001 100%)' }} />
                <span className="relative z-10 flex items-center gap-2">
                  Get Started
                  <HiSparkles className="w-4 h-4" />
                </span>
              </a>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl hover:bg-opacity-30 transition-all duration-300"
              style={{ backgroundColor: mobileMenuOpen ? 'rgba(5,163,199,0.15)' : 'transparent' }}
            >
              {mobileMenuOpen ? <HiX className="w-7 h-7 text-[#1A1F29]" /> : <HiMenu className="w-7 h-7 text-[#1A1F29]" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-6 border-t backdrop-blur-xl rounded-b-3xl"
                 style={{ 
                   backgroundColor: 'rgba(255,255,255,0.95)',
                   borderColor: 'rgba(5,163,199,0.15)'
                 }}>
              <div className="flex flex-col gap-2">
                {['Home', 'Features', 'About', 'Contact'].map((item, i) => (
                  <a
                    key={i}
                    href={`#${item.toLowerCase()}`}
                    className="px-4 py-3 text-sm font-bold text-[#2E4057] hover:text-[#05A3C7] rounded-xl transition-all duration-300"
                    onClick={() => setMobileMenuOpen(false)}
                    style={{ 
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(5,163,199,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {item}
                  </a>
                ))}
                <div className="flex gap-3 pt-4 px-2">
                  <a href="/login" className="flex-1 px-4 py-3 text-center rounded-xl border-2 text-sm font-bold transition-all"
                     style={{ 
                       borderColor: '#05A3C7',
                       color: '#05A3C7'
                     }}>
                    Login
                  </a>
                  <a href="/register" className="flex-1 px-4 py-3 text-center rounded-xl text-white text-sm font-bold shadow-lg"
                     style={{ 
                       background: 'linear-gradient(135deg, #05A3C7 0%, #04748F 100%)',
                       boxShadow: '0 5px 20px rgba(5,163,199,0.25)'
                     }}>
                    Get Started
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative pt-32 pb-24 min-h-screen flex items-center">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)' }} />
        
        <div className="relative mx-auto max-w-7xl px-6 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <div className="space-y-8 animate-fadeIn">
              {/* Badge */}
              

              {/* Main Heading */}
              <div className="space-y-6">
                <h3 className="text-3xl sm:text-6xl lg:text-5xl font-black leading-tight text-[#1A1F29]">
                  {heroSlides[currentSlide].title}
                </h3>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black"
                    style={{ 
                      background: 'linear-gradient(135deg, #05A3C7 0%, #F18F01 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}>
                  {heroSlides[currentSlide].subtitle}
                </h2>
              </div>

              {/* Description */}
              <p className="text-xl leading-relaxed max-w-xl font-medium text-[#5A6C7D]">
                {heroSlides[currentSlide].description}
              </p>

              {/* Feature Tags */}
              <div className="flex flex-wrap gap-3">
                {[
                  { name: 'CBCS Tracking' },
                  { name: 'Result Tracking' },
                  { name: 'Backlog Tracking' },
                  
                ].map((tag, i) => (
                  <span
                    key={i}
                    className="px-5 py-2.5 rounded-xl text-sm font-black text-white shadow-md hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-default"
                    style={{ 
                      background: i % 2 === 0 
                        ? 'linear-gradient(135deg, #05A3C7 0%, #04748F 100%)' 
                        : 'linear-gradient(135deg, #F18F01 0%, #C17001 100%)',
                      boxShadow: '0 5px 20px rgba(5,163,199,0.2)'
                    }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-5 pt-6">
                <a
                  href="/login"
                  className="group relative px-10 py-4 rounded-2xl text-white font-black text-lg shadow-xl transition-all duration-500 hover:scale-105 overflow-hidden"
                  style={{ 
                    background: 'linear-gradient(135deg, #05A3C7 0%, #04748F 100%)',
                    boxShadow: '0 15px 40px rgba(5,163,199,0.3)'
                  }}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500"
                       style={{ background: 'linear-gradient(135deg, #F18F01 0%, #C17001 100%)' }} />
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    Access Portal
                    <HiArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" />
                  </span>
                </a>
                <a
                  href="#features"
                  className="px-10 py-4 rounded-2xl border-3 text-[#05A3C7] font-black text-lg backdrop-blur-xl transition-all duration-300 hover:scale-105 bg-white/50"
                  style={{ borderColor: '#05A3C7', borderWidth: '2px' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(5,163,199,0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.5)'}
                >
                  <span className="flex items-center justify-center gap-2">
                    Learn More
                    <HiChevronDown className="w-6 h-6 animate-bounce" />
                  </span>
                </a>
              </div>

              {/* Slide Indicators */}
              <div className="flex gap-3 pt-8">
                {heroSlides.map((slide, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`h-2 rounded-full transition-all duration-500 ${
                      index === currentSlide ? 'w-16 shadow-md' : 'w-8'
                    }`}
                    style={{ 
                      background: index === currentSlide 
                        ? 'linear-gradient(90deg, #05A3C7 0%, #F18F01 100%)' 
                        : 'rgba(5,163,199,0.2)'
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Right Image Card */}
            <div className="relative">
              <div className="absolute -inset-4 top rounded-3xl blur-2xl opacity-20"
                   style={{ background: 'linear-gradient(135deg, rgba(5,163,199,0.3) 0%, rgba(241,143,1,0.3) 100%)' }} />
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-2 backdrop-blur-xl"
                   style={{ 
                     borderColor: 'rgba(5,163,199,0.2)',
                     backgroundColor: 'rgba(255,255,255,0.7)'
                   }}>
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
                  <div className="absolute inset-0 z-20"
                       style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.3) 100%)' }} />
                  
                  {/* Overlay Badge */}
                  <div className="absolute top-6 right-6 z-30 px-4 py-2 rounded-xl backdrop-blur-xl border shadow-lg"
                       style={{ 
                         background: 'linear-gradient(135deg, rgba(5,163,199,0.95) 0%, rgba(4,116,143,0.95) 100%)',
                         borderColor: 'rgba(255,255,255,0.3)'
                       }}>
                    <span className="text-white font-black text-sm flex items-center gap-2">
                      <HiStar className="w-4 h-4" />
                      Campus Life
                    </span>
                  </div>
                </div>

                {/* Image Indicators */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-30">
                  {collegeImages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCollegeSlide(idx)}
                      className={`h-2 rounded-full transition-all duration-500 ${
                        idx === collegeSlide ? 'w-12 shadow-md' : 'w-2'
                      }`}
                      style={{ 
                        background: idx === collegeSlide 
                          ? 'linear-gradient(90deg, #05A3C7 0%, #F18F01 100%)' 
                          : 'rgba(255,255,255,0.6)',
                        boxShadow: idx === collegeSlide ? '0 5px 15px rgba(5,163,199,0.4)' : 'none'
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 relative">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)' }} />
        
        <div className="relative mx-auto max-w-7xl px-6">
          {/* Section Header */}
          <div className="text-center mb-20">
            <div className="inline-block px-6 py-2 rounded-full text-white border-2 text-sm font-black mb-6 shadow-lg"
                 style={{ 
                   background: 'linear-gradient(135deg, #05A3C7 0%, #04748F 100%)',
                   borderColor: 'rgba(255,255,255,0.3)',
                   boxShadow: '0 10px 30px rgba(5,163,199,0.2)'
                 }}>
              Features
            </div>
            <h2 className="text-5xl md:text-6xl font-black mb-6 text-[#1A1F29]">
              Everything You Need
            </h2>
            <p className="text-xl max-w-2xl mx-auto font-medium text-[#5A6C7D]">
              Comprehensive tools for students, faculty, and administrators
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <HiAcademicCap className="w-12 h-12" />,
                title: "Student Portal",
                badge: "For Students",
                description: "View semester results, calculate CGPA/SGPA, download transcripts, and track your academic progress in real-time.",
                features: [
                  { name: "Result Dashboard", icon: <HiClipboardList className="w-5 h-5" /> },
                  { name: "CGPA Calculator", icon: <HiCalculator className="w-5 h-5" /> },
                  { name: "Transcript Download", icon: <HiDocumentDownload className="w-5 h-5" /> }
                ],
                link: "/login"
              },
              {
                icon: <HiUserGroup className="w-12 h-12" />,
                title: "Teacher Dashboard",
                badge: "For Faculty",
                description: "Search student results, review backlogs, generate comprehensive reports, and monitor class performance analytics.",
                features: [
                  { name: "Student Search", icon: <HiSearch className="w-5 h-5" /> },
                  { name: "Performance Reports", icon: <HiClipboardList className="w-5 h-5" /> },
                  { name: "Class Analytics", icon: <HiChartBar className="w-5 h-5" /> }
                ],
                link: "/login"
              },
              {
                icon: <HiCog className="w-12 h-12" />,
                title: "Admin Control",
                badge: "For Administrators",
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
                className="group relative p-8 rounded-3xl border-2 backdrop-blur-xl transition-all duration-500 hover:scale-105 hover:-translate-y-2"
                style={{ 
                  borderColor: 'rgba(5,163,199,0.2)',
                  backgroundColor: 'rgba(255,255,255,0.7)',
                  boxShadow: '0 15px 40px rgba(5,163,199,0.15)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(5,163,199,0.4)';
                  e.currentTarget.style.boxShadow = '0 20px 50px rgba(5,163,199,0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(5,163,199,0.2)';
                  e.currentTarget.style.boxShadow = '0 15px 40px rgba(5,163,199,0.15)';
                }}
              >
                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-500"
                     style={{ background: 'linear-gradient(135deg, rgba(5,163,199,0.05) 0%, transparent 100%)' }} />
                
                {/* Icon */}
                <div className="relative w-20 h-20 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-500"
                     style={{ background: 'linear-gradient(135deg, #05A3C7 0%, #04748F 100%)' }}>
                  <div className="absolute inset-0 rounded-2xl blur-xl opacity-30 group-hover:opacity-60 transition-all duration-500"
                       style={{ background: 'linear-gradient(135deg, #05A3C7 0%, #04748F 100%)' }} />
                  <span className="relative z-10">{feature.icon}</span>
                </div>

                {/* Badge */}
                <div className="inline-block px-4 py-1.5 rounded-full text-xs font-black mb-4 text-white shadow-md"
                     style={{ background: 'linear-gradient(135deg, #05A3C7 0%, #04748F 100%)' }}>
                  {feature.badge}
                </div>

                {/* Title */}
                <h3 className="text-3xl font-black text-[#1A1F29] mb-4">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="mb-6 leading-relaxed font-medium text-[#5A6C7D]">
                  {feature.description}
                </p>

                {/* Feature List */}
                <ul className="space-y-3 mb-6">
                  {feature.features.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-sm text-[#2E4057] font-bold group/item">
                      <span className="p-1.5 rounded-lg group-hover/item:scale-110 transition-transform"
                            style={{ background: 'linear-gradient(135deg, #05A3C7 0%, #04748F 100%)' }}>
                        <span className="text-white">{item.icon}</span>
                      </span>
                      {item.name}
                    </li>
                  ))}
                </ul>

                {/* Link */}
                <a
                  href={feature.link}
                  className="inline-flex items-center gap-2 font-black group/link hover:gap-4 transition-all duration-300 text-[#05A3C7]"
                >
                  Explore Features
                  <HiArrowRight className="w-6 h-6" style={{ color: '#F18F01' }} />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 relative">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)' }} />
        
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-black mb-6"
                style={{ 
                  background: 'linear-gradient(135deg, #05A3C7 0%, #F18F01 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
              About CUTM ACADEMIC TRACKER
            </h2>
            <p className="text-xl max-w-2xl mx-auto font-medium text-[#5A6C7D]">
              Transforming academic result management through innovative technology
            </p>
          </div>

          {/* Mission & Vision */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-20">
            {[
              {
                icon: <MdOutlineScience />,
                title: "Our Mission",
                content: "To provide a seamless, secure, and efficient platform that empowers students, educators, and administrators with instant access to academic results and performance analytics. We are committed to eliminating the complexity of result management."
              },
              {
                icon: <RiStarFill />,
                title: "Our Vision",
                content: "To become the leading academic result management system that sets the standard for educational institutions worldwide through innovation, reliability, and exceptional user experience. We envision a future where academic data is universally accessible."
              }
            ].map((item, i) => (
              <div
                key={i}
                className="group relative p-10 rounded-3xl border-2 backdrop-blur-xl transition-all duration-500 hover:scale-105"
                style={{ 
                  borderColor: 'rgba(5,163,199,0.2)',
                  backgroundColor: 'rgba(255,255,255,0.7)',
                  boxShadow: '0 15px 40px rgba(5,163,199,0.15)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(5,163,199,0.4)';
                  e.currentTarget.style.boxShadow = '0 20px 50px rgba(5,163,199,0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(5,163,199,0.2)';
                  e.currentTarget.style.boxShadow = '0 15px 40px rgba(5,163,199,0.15)';
                }}
              >
                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-500"
                     style={{ background: 'linear-gradient(135deg, rgba(5,163,199,0.05) 0%, transparent 100%)' }} />
                
                <div className="relative w-24 h-24 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg group-hover:scale-110 group-hover:rotate-12 transition-all duration-500"
                     style={{ background: 'linear-gradient(135deg, #05A3C7 0%, #F18F01 100%)' }}>
                  <div className="absolute inset-0 rounded-2xl blur-xl opacity-30 group-hover:opacity-60 transition-all duration-500"
                       style={{ background: 'linear-gradient(135deg, #05A3C7 0%, #F18F01 100%)' }} />
                  <span className="relative z-10">{item.icon}</span>
                </div>
                <h3 className="text-4xl font-black mb-5"
                    style={{ 
                      background: 'linear-gradient(135deg, #05A3C7 0%, #F18F01 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}>
                  {item.title}
                </h3>
                <p className="leading-relaxed text-lg font-medium text-[#5A6C7D]">
                  {item.content}
                </p>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
            {[
              { value: "99.9%", label: "Uptime", icon: <HiClock className="w-12 h-12" /> },
              { value: "10K+", label: "Students", icon: <HiAcademicCap className="w-12 h-12" /> },
              { value: "500+", label: "Faculty", icon: <HiUsers className="w-12 h-12" /> },
              { value: "24/7", label: "Support", icon: <HiChatAlt2 className="w-12 h-12" /> }
            ].map((stat, i) => (
              <div
                key={i}
                className="group relative p-8 rounded-2xl border-2 backdrop-blur-xl text-center hover:scale-110 transition-all duration-500"
                style={{ 
                  borderColor: 'rgba(5,163,199,0.2)',
                  backgroundColor: 'rgba(255,255,255,0.7)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(5,163,199,0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(5,163,199,0.2)';
                }}
              >
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-500"
                     style={{ background: 'linear-gradient(135deg, rgba(5,163,199,0.05) 0%, transparent 100%)' }} />
                
                <div className="flex justify-center mb-4 group-hover:scale-125 transition-transform duration-500"
                     style={{ color: '#05A3C7' }}>
                  {stat.icon}
                </div>
                <div className="text-5xl font-black mb-3"
                     style={{ 
                       background: 'linear-gradient(135deg, #05A3C7 0%, #F18F01 100%)',
                       WebkitBackgroundClip: 'text',
                       WebkitTextFillColor: 'transparent'
                     }}>
                  {stat.value}
                </div>
                <div className="text-sm font-bold uppercase tracking-wider text-[#5A6C7D]">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Core Values */}
          <div className="relative p-12 rounded-3xl border-2 backdrop-blur-xl overflow-hidden"
               style={{ 
                 borderColor: 'rgba(5,163,199,0.2)',
                 backgroundColor: 'rgba(255,255,255,0.7)'
               }}>
            <div className="absolute inset-0"
                 style={{ background: 'linear-gradient(135deg, rgba(5,163,199,0.05) 0%, rgba(241,143,1,0.05) 50%, transparent 100%)' }} />
            
            <h3 className="relative text-5xl font-black text-center mb-16 text-[#1A1F29]">
              Our Core Values
            </h3>
            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-10">
              {[
                { title: "Innovation", desc: "Constantly evolving with the latest technology", icon: <HiLightBulb className="w-14 h-14" /> },
                { title: "Security", desc: "Enterprise-grade encryption and secure protocols", icon: <HiShieldCheck className="w-14 h-14" /> },
                { title: "Accessibility", desc: "Seamless access across all devices", icon: <HiGlobe className="w-14 h-14" /> }
              ].map((value, i) => (
                <div key={i} className="group text-center">
                  <div className="relative w-24 h-24 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg group-hover:scale-125 group-hover:rotate-12 transition-all duration-500"
                       style={{ background: 'linear-gradient(135deg, #05A3C7 0%, #F18F01 100%)' }}>
                    <div className="absolute inset-0 rounded-2xl blur-xl opacity-30 group-hover:opacity-60 transition-all duration-500"
                         style={{ background: 'linear-gradient(135deg, #05A3C7 0%, #F18F01 100%)' }} />
                    <span className="relative z-10">{value.icon}</span>
                  </div>
                  <h4 className="text-3xl font-black mb-4"
                      style={{ 
                        background: 'linear-gradient(135deg, #05A3C7 0%, #F18F01 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                      }}>
                    {value.title}
                  </h4>
                  <p className="font-medium text-lg text-[#5A6C7D]">{value.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

 
   {/* Developer Section */}
<section id="developer" className="py-24 relative">
  <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)' }} />
  
  <div className="relative mx-auto max-w-7xl px-6">
    <div className="text-center mb-16">
      <div className="inline-block px-6 py-2 rounded-full text-white border-2 text-sm font-black mb-6 shadow-lg"
           style={{ 
             background: 'linear-gradient(135deg, #05A3C7 0%, #04748F 100%)',
             borderColor: 'rgba(255,255,255,0.3)',
             boxShadow: '0 10px 30px rgba(5,163,199,0.2)'
           }}>
        Meet the Developer
      </div>
      <h2 className="text-5xl md:text-6xl font-black mb-6 text-[#1A1F29]">
        Behind the Portal
      </h2>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start max-w-6xl mx-auto">
      {/* Developer Card */}
      <div className="group relative p-10 rounded-3xl border-2 backdrop-blur-xl transition-all duration-500 hover:scale-105"
           style={{ 
             borderColor: 'rgba(5,163,199,0.2)',
             backgroundColor: 'rgba(255,255,255,0.7)',
             boxShadow: '0 15px 40px rgba(5,163,199,0.15)'
           }}
           onMouseEnter={(e) => {
             e.currentTarget.style.borderColor = 'rgba(5,163,199,0.4)';
             e.currentTarget.style.boxShadow = '0 20px 50px rgba(5,163,199,0.25)';
           }}
           onMouseLeave={(e) => {
             e.currentTarget.style.borderColor = 'rgba(5,163,199,0.2)';
             e.currentTarget.style.boxShadow = '0 15px 40px rgba(5,163,199,0.15)';
           }}>
        <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-500"
             style={{ background: 'linear-gradient(135deg, rgba(5,163,199,0.05) 0%, rgba(241,143,1,0.05) 50%, transparent 100%)' }} />
        
        <div className="relative">
          <div className="relative aspect-square max-w-[200px] mx-auto rounded-2xl overflow-hidden mb-8 border-2 shadow-lg"
               style={{ 
                 borderColor: 'rgba(5,163,199,0.2)',
                 backgroundColor: 'rgba(5,163,199,0.1)'
               }}>
            <div className="absolute inset-0 blur-xl opacity-20"
                 style={{ background: 'linear-gradient(135deg, rgba(5,163,199,0.3) 0%, rgba(241,143,1,0.3) 100%)' }} />
            <img
              src="/ayush.png"
              alt="Developer"
              className="relative w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="relative text-center">
          <h3 className="text-3xl font-black text-[#1A1F29] mb-3">
            Ayush Kumar Singh
          </h3>
          <p className="text-xl font-bold mb-2"
             style={{ 
               background: 'linear-gradient(135deg, #05A3C7 0%, #F18F01 100%)',
               WebkitBackgroundClip: 'text',
               WebkitTextFillColor: 'transparent'
             }}>
            Full Stack Developer
          </p>
          <p className="font-bold mb-4" style={{ color: '#05A3C7' }}>
            ECE Student | 2022 Batch
          </p>
          <p className="mb-8 font-medium text-[#5A6C7D]">
            Passionate about creating innovative solutions for education
          </p>

          {/* Social Links */}
          <div className="flex justify-center gap-4 mb-8">
            {[
              { href: "https://github.com", icon: <FaGithub /> },
              { href: "https://www.linkedin.com/in/ayush-kumar-singh7/", icon: <FaLinkedin /> },
              { href: "mailto:rahulkrsingh4321@gmail.com", icon: <FaEnvelope /> }
            ].map((social, i) => (
              <a
                key={i}
                href={social.href}
                className="relative w-14 h-14 rounded-xl text-white flex items-center justify-center shadow-lg hover:scale-125 hover:rotate-12 transition-all duration-300 group/social"
                style={{ background: 'linear-gradient(135deg, #05A3C7 0%, #04748F 100%)' }}
              >
                <div className="absolute inset-0 rounded-xl blur-xl opacity-30 group-hover/social:opacity-60 transition-all duration-300"
                     style={{ background: 'linear-gradient(135deg, #05A3C7 0%, #04748F 100%)' }} />
                <span className="relative z-10 text-2xl">{social.icon}</span>
              </a>
            ))}
          </div>

          <a
            href="https://protfolio-seven-roan.vercel.app"
            className="inline-block px-8 py-3.5 rounded-xl text-white font-black shadow-lg transition-all duration-500 hover:scale-110"
            style={{ 
              background: 'linear-gradient(135deg, #05A3C7 0%, #04748F 100%)',
              boxShadow: '0 15px 40px rgba(5,163,199,0.3)'
            }}
          >
            View Portfolio
          </a>
        </div>
      </div>

      {/* Info Cards */}
      <div className="space-y-6">
        <div className="relative p-8 rounded-2xl border-2 backdrop-blur-xl transition-all duration-500 hover:scale-105"
             style={{ 
               borderColor: 'rgba(5,163,199,0.2)',
               backgroundColor: 'rgba(255,255,255,0.7)'
             }}
             onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(5,163,199,0.4)'}
             onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(5,163,199,0.2)'}>
          <div className="absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition-all duration-500"
               style={{ background: 'linear-gradient(135deg, rgba(5,163,199,0.05) 0%, transparent 100%)' }} />
          
          <div className="relative flex items-center gap-5 mb-5">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center text-white shadow-lg"
                 style={{ background: 'linear-gradient(135deg, #05A3C7 0%, #F18F01 100%)' }}>
              <HiAcademicCap className="w-10 h-10" />
            </div>
            <div>
              <h4 className="text-xl font-black"
                  style={{ 
                    background: 'linear-gradient(135deg, #05A3C7 0%, #F18F01 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}>
                Under Guidance
              </h4>
              <p className="text-lg text-[#1A1F29] font-bold">Prof Satyanarayan Padhy</p>
            </div>
          </div>
          <p className="relative font-medium text-[#5A6C7D]">
            Developed under expert guidance.
          </p>
        </div>

        <div className="relative p-8 rounded-2xl border-2 backdrop-blur-xl transition-all duration-500 hover:scale-105"
             style={{ 
               borderColor: 'rgba(5,163,199,0.2)',
               backgroundColor: 'rgba(255,255,255,0.7)'
             }}
             onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(5,163,199,0.4)'}
             onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(5,163,199,0.2)'}>
          <div className="absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition-all duration-500"
               style={{ background: 'linear-gradient(135deg, rgba(5,163,199,0.05) 0%, transparent 100%)' }} />
          
          <h4 className="relative text-2xl font-black mb-6 flex items-center justify-center gap-2"
              style={{ 
                background: 'linear-gradient(135deg, #05A3C7 0%, #F18F01 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
            <RiToolsFill />
            Technologies Used
          </h4>

          <div className="relative grid grid-cols-2 gap-4">
            {[
              { name: 'Next.js', image: '/font/nextjs-dark_.png' },
              { name: 'MongoDB', image: '/font/mongodb_.png' },
              { name: 'Tailwind', image: '/font/tailwindcss-dark_.png' },
              { name: 'Prisma', image: '/font/prisma_.png' },
              { name: 'Redis', image: '/font/redis-wordmark_.png' },
              { name: 'Vercel', image: '/font/vercel-wordmark_.png' }
            ].map((tech, i) => (
              <div
                key={i}
                className="group/tech relative p-4 rounded-xl backdrop-blur-sm border-2 transition-all duration-300 hover:scale-110 hover:-translate-y-2"
                style={{ 
                  borderColor: 'rgba(5,163,199,0.2)',
                  backgroundColor: 'rgba(255,255,255,0.5)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(5,163,199,0.5)';
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.9)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(5,163,199,0.2)';
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.5)';
                }}
              >
                <div className="absolute inset-0 rounded-xl blur-lg opacity-0 group-hover/tech:opacity-40 transition-all duration-300"
                     style={{ background: 'linear-gradient(135deg, #05A3C7 0%, #04748F 100%)' }} />
                <div className="relative z-10 flex flex-col items-center justify-center gap-2">
                  <img 
                    src={tech.image} 
                    alt={tech.name}
                    className="w-8 h-8 object-contain transition-transform duration-300 group-hover/tech:scale-110"
                  />
                  <span className="text-xs font-bold text-[#1A1F29] group-hover/tech:text-[#05A3C7] transition-colors">
                    {tech.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        
      </div>
    </div>
  </div>
</section>



      {/* Footer */}
      <footer className="relative border-t-2 backdrop-blur-xl"
              style={{ 
                borderColor: 'rgba(5,163,199,0.2)',
                backgroundColor: 'rgba(255,255,255,0.9)'
              }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.5) 100%)' }} />
        
        <div className="relative mx-auto max-w-7xl px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="relative w-14 h-14 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg"
                     style={{ background: 'linear-gradient(135deg, #05A3C7 0%, #04748F 100%)' }}>
                  <div className="absolute inset-0 rounded-xl blur-xl opacity-30"
                       style={{ background: 'linear-gradient(135deg, #05A3C7 0%, #04748F 100%)' }} />
                  <span className="relative z-10">C</span>
                </div>
                <span className="font-black text-2xl text-[#1A1F29]">
                  CUTM Portal
                </span>
              </div>
              <p className="font-medium text-[#5A6C7D]">
                Academic result management platform for CUTM
              </p>
            </div>

            {[
              { title: "Quick Links", links: ['Home', 'Features', 'About', 'Contact'] },
              { title: "Resources", links: ['Login', 'Register', 'Help', 'Docs'] },
              { title: "Legal", links: ['Privacy', 'Terms', 'Cookies', 'Disclaimer'] }
            ].map((section, i) => (
              <div key={i}>
                <h4 className="font-black text-[#1A1F29] text-lg mb-5">{section.title}</h4>
                <div className="space-y-3">
                  {section.links.map((link, idx) => (
                    <a key={idx} href="#" className="block font-medium transition-all duration-300 hover:translate-x-2 text-[#5A6C7D]"
                       onMouseEnter={(e) => e.currentTarget.style.color = '#05A3C7'}
                       onMouseLeave={(e) => e.currentTarget.style.color = '#5A6C7D'}>
                      {link}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t-2 pt-8 flex flex-col md:flex-row items-center justify-between gap-4"
               style={{ borderColor: 'rgba(5,163,199,0.15)' }}>
            <p className="font-bold text-[#5A6C7D]">
              © {new Date().getFullYear()} CUTM Portal. All rights reserved.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#5A6C7D]">Made with</span>
              <span className="text-xl" style={{ color: '#F18F01' }}>❤️</span>
              <span className="text-sm font-medium text-[#5A6C7D]">by Ayush Kumar Singh</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
