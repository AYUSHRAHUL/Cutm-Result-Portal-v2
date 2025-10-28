"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function UserDashboard() {
  const router = useRouter();
  
  // Existing state
  const [registration, setRegistration] = useState("");
  const [semesters, setSemesters] = useState([]);
  const [selectedSemesters, setSelectedSemesters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  
  // Enhanced UI state
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading CUTM Portal...');
  const [loadingStatus, setLoadingStatus] = useState('Preparing your academic gateway');
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [statsAnimated, setStatsAnimated] = useState(false);
  const [showMultiSelect, setShowMultiSelect] = useState(false);

  // Refs
  const formRef = useRef(null);
  const statsRef = useRef(null);
  const multiSelectRef = useRef(null);

  // Default semester options
  const defaultSemesters = [
    'Semester 1', 'Semester 2', 'Semester 3', 'Semester 4',
    'Semester 5', 'Semester 6', 'Semester 7', 'Semester 8'
  ];

  // Loading messages sequence
  const loadingMessages = [
    { text: '🎓 Initializing Portal...', status: '⚡ Setting up secure connections' },
    { text: '📚 Loading Academic Data...', status: '🔍 Accessing student records' },
    { text: '✨ Applying Themes...', status: '🎨 Customizing your experience' },
    { text: '🚀 Almost Ready...', status: '🎯 Finalizing everything' },
    { text: '🎉 Welcome to CUTM!', status: '✅ Portal loaded successfully' }
  ];

  // Enhanced loading sequence
  useEffect(() => {
    let messageIndex = 0;
    const messageInterval = setInterval(() => {
      if (messageIndex < loadingMessages.length) {
        setLoadingMessage(loadingMessages[messageIndex].text);
        setLoadingStatus(loadingMessages[messageIndex].status);
        messageIndex++;
      }
    }, 900);

    const loadingTimer = setTimeout(() => {
      clearInterval(messageInterval);
      setIsLoading(false);
    }, 4800);

    return () => {
      clearInterval(messageInterval);
      clearTimeout(loadingTimer);
    };
  }, []);

  // Fetch user data and extract registration number
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          const userData = data.user || data; // Handle both response formats
          setUser(userData);
          
    // User data loaded successfully
    console.log('User data loaded:', userData);
    
    // Auto-fill registration number for user's own results
    if (userData.email && userData.email.includes('@cutm.ac.in')) {
      const regNumber = userData.email.split('@')[0];
      setRegistration(regNumber);
      console.log('Auto-filled registration number:', regNumber, 'Length:', regNumber.length);
      console.log('Registration type:', typeof regNumber);
    }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, []);

  // Scroll effects
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset;
      
      if (scrollTop > 100) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }

      if (statsRef.current && !statsAnimated) {
        const rect = statsRef.current.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          setStatsAnimated(true);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [statsAnimated]);

  // Your original fetchSemesters function
  const fetchSemesters = async (reg) => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/semesters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registration: reg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No semesters found");
      setSemesters(data.semesters || []);
    } catch (err) {
      setError(err.message);
      setSemesters([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle multi-select toggle
  const toggleMultiSelect = () => {
    setShowMultiSelect(!showMultiSelect);
  };

  // Handle semester checkbox change
  const handleSemesterChange = (semester) => {
    setSelectedSemesters(prev => {
      if (prev.includes(semester)) {
        return prev.filter(s => s !== semester);
      } else {
        return [...prev, semester];
      }
    });
  };

  // Click outside handler for multi-select
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (multiSelectRef.current && !multiSelectRef.current.contains(event.target)) {
        setShowMultiSelect(false);
      }
    };

    if (showMultiSelect) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMultiSelect]);

  // Your original registration change handler
  const handleRegistrationChange = (e) => {
    const reg = e.target.value.toUpperCase();
    setRegistration(reg);
    setError("");
    setSelectedSemesters([]); // Reset selection when registration changes
    
    // Auto-fetch when registration has 6+ characters
    if (reg.length >= 6) {
      fetchSemesters(reg);
    } else {
      setSemesters([]);
    }
  };

  // Your original form submission
  const handleViewResult = async (e) => {
    e.preventDefault();
    
    console.log('Form submission - Registration:', registration, 'Type:', typeof registration, 'Length:', registration?.length);
    console.log('Selected semesters:', selectedSemesters);
    
    if (!registration || registration.trim() === '') {
      setError("⚠️ Please enter a valid registration number");
      return;
    }
    
    if (selectedSemesters.length === 0) {
      setError("📅 Please select at least one semester to search");
      return;
    }

    setIsFormSubmitting(true);
    setError("");
    
    console.log('About to navigate to result page with:', {
      registration,
      selectedSemesters,
      semesterParam: selectedSemesters.join(',')
    });
    
    // Simulate processing time for better UX
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Navigate with multiple semesters
    const semestersParam = selectedSemesters.join(',');
    const resultUrl = `/dashboard/user/result?reg=${registration}&sem=${semestersParam}`;
    console.log('Navigating to:', resultUrl);
    router.push(resultUrl);
  };

  // Animated counter component
  const AnimatedCounter = ({ end, duration = 2500, suffix = "" }) => {
    const [count, setCount] = useState(0);
    
    useEffect(() => {
      if (!statsAnimated) return;
      
      let startTime;
      const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        
        // Easing function for smooth animation
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
        const easedProgress = easeOutCubic(progress);
        
        setCount(Math.floor(easedProgress * end));
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    }, [statsAnimated, end, duration]);

    return <span>{count.toLocaleString()}{suffix}</span>;
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Determine which semesters to show
  const availableSemesters = semesters.length > 0 ? semesters : defaultSemesters;
  const showSemesters = registration.length >= 6 || semesters.length > 0;

  // Get selected text for multi-select header
  const getSelectedText = () => {
    if (selectedSemesters.length === 0) {
      return "Choose your semester(s)";
    } else if (selectedSemesters.length === 1) {
      return selectedSemesters[0];
    } else {
      return `${selectedSemesters[0]} +${selectedSemesters.length - 1}`;
    }
  };

  // ENHANCED LOADING OVERLAY WITH SPINNER.JPG
  if (isLoading) {
    return (
      <div className="loading-overlay">
        {/* Floating Icons Around Spinner */}
        <div className="floating-icons">
          <div className="floating-icon" style={{top: '15%', left: '20%', color: '#ff6b6b', animationDelay: '0s'}}>🎓</div>
          <div className="floating-icon" style={{top: '25%', right: '25%', color: '#48dbfb', animationDelay: '2s'}}>📚</div>
          <div className="floating-icon" style={{bottom: '35%', left: '25%', color: '#ff9ff3', animationDelay: '4s'}}>🏆</div>
          <div className="floating-icon" style={{bottom: '25%', right: '20%', color: '#5f27cd', animationDelay: '6s'}}>📊</div>
            </div>

        {/* Colorful Particles */}
        <div className="loading-particles">
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          </div>

        {/* Main Spinner Container */}
        <div className="spinner-container">
          <div className="pulse-bg"></div>
          <div className="spinner-ring ring-3"></div>
          <div className="spinner-ring ring-2"></div>
          <div className="spinner-ring ring-1"></div>
          <div className="main-spinner">
            <img 
              className="spinner-logo" 
              src="/spinner.jpg"  
              alt="CUTM Logo Loading" 
            />
            </div>
          </div>

        {/* Enhanced Loading Text */}
        <div className="loading-text">{loadingMessage}</div>
        
        {/* Colorful Progress Bar */}
        <div className="progress-container">
          <div className="progress-bar-custom"></div>
        </div>
        
        {/* Dynamic Status */}
        <div className="loading-status">{loadingStatus}</div>

        <style jsx>{`
          .loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(
              135deg,
              #667eea 0%,
              #764ba2 25%,
              #f093fb 50%,
              #4facfe 75%,
              #00f2fe 100%
            );
            background-size: 400% 400%;
            animation: gradientShift 8s ease-in-out infinite;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 9999;
          }

          @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }

          .spinner-container {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 40px;
            animation: containerFloat 4s ease-in-out infinite;
          }

          @keyframes containerFloat {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-15px); }
          }

          .loading-particles {
            position: absolute;
            width: 400px;
            height: 400px;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
          }

          .particle {
            position: absolute;
            border-radius: 50%;
            animation: particleFloat 6s ease-in-out infinite;
          }

          .particle:nth-child(1) {
            width: 16px;
            height: 16px;
            background: linear-gradient(45deg, #ff6b6b, #feca57);
            top: 10%;
            left: 20%;
            animation-delay: 0s;
          }

          .particle:nth-child(2) {
            width: 12px;
            height: 12px;
            background: linear-gradient(45deg, #48dbfb, #0abde3);
            top: 20%;
            right: 15%;
            animation-delay: 1s;
          }

          .particle:nth-child(3) {
            width: 20px;
            height: 20px;
            background: linear-gradient(45deg, #ff9ff3, #f368e0);
            bottom: 20%;
            left: 15%;
            animation-delay: 2s;
          }

          .particle:nth-child(4) {
            width: 14px;
            height: 14px;
            background: linear-gradient(45deg, #54a0ff, #2e86de);
            bottom: 15%;
            right: 25%;
            animation-delay: 3s;
          }

          .particle:nth-child(5) {
            width: 18px;
            height: 18px;
            background: linear-gradient(45deg, #5f27cd, #a55eea);
            top: 60%;
            left: 10%;
            animation-delay: 4s;
          }

          .particle:nth-child(6) {
            width: 13px;
            height: 13px;
            background: linear-gradient(45deg, #00d2d3, #01a3a4);
            top: 40%;
            right: 10%;
            animation-delay: 5s;
          }

          @keyframes particleFloat {
            0%, 100% { 
              transform: translateY(0px) rotate(0deg); 
              opacity: 0.7;
              scale: 1;
            }
            33% { 
              transform: translateY(-25px) rotate(120deg); 
              opacity: 1;
              scale: 1.2;
            }
            66% { 
              transform: translateY(18px) rotate(240deg); 
              opacity: 0.8;
              scale: 0.9;
            }
          }

          .main-spinner {
            width: 120px;
            height: 120px;
            position: relative;
            z-index: 10;
          }

          .spinner-logo {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            object-fit: cover;
            background: linear-gradient(45deg, 
              rgba(255, 255, 255, 0.3) 0%,
              rgba(255, 255, 255, 0.1) 50%,
              rgba(255, 255, 255, 0.3) 100%
            );
            padding: 8px;
            backdrop-filter: blur(15px);
            border: 3px solid rgba(255, 255, 255, 0.4);
            animation: logoSpin 3s ease-in-out infinite;
            box-shadow: 
              0 0 40px rgba(255, 255, 255, 0.5),
              0 0 80px rgba(59, 130, 246, 0.4),
              inset 0 0 20px rgba(255, 255, 255, 0.2);
          }

          @keyframes logoSpin {
            0% { 
              transform: rotate(0deg) scale(1); 
              box-shadow: 
                0 0 40px rgba(255, 255, 255, 0.5),
                0 0 80px rgba(59, 130, 246, 0.4);
            }
            25% { 
              transform: rotate(90deg) scale(1.1); 
              box-shadow: 
                0 0 50px rgba(255, 107, 107, 0.6),
                0 0 100px rgba(255, 107, 107, 0.3);
            }
            50% { 
              transform: rotate(180deg) scale(1); 
              box-shadow: 
                0 0 45px rgba(72, 219, 251, 0.6),
                0 0 90px rgba(72, 219, 251, 0.3);
            }
            75% { 
              transform: rotate(270deg) scale(1.1); 
              box-shadow: 
                0 0 50px rgba(255, 159, 243, 0.6),
                0 0 100px rgba(255, 159, 243, 0.3);
            }
            100% { 
              transform: rotate(360deg) scale(1); 
              box-shadow: 
                0 0 40px rgba(255, 255, 255, 0.5),
                0 0 80px rgba(59, 130, 246, 0.4);
            }
          }

          .spinner-ring {
            position: absolute;
            border-radius: 50%;
            border: 3px solid transparent;
            animation: ringRotate 2s linear infinite;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
          }

          .ring-1 {
            width: 150px;
            height: 150px;
            border-top: 3px solid #ff6b6b;
            border-right: 3px solid rgba(255, 107, 107, 0.3);
            border-bottom: 3px solid #feca57;
            border-left: 3px solid rgba(254, 202, 87, 0.3);
            animation-duration: 1.5s;
            filter: drop-shadow(0 0 15px rgba(255, 107, 107, 0.5));
          }

          .ring-2 {
            width: 180px;
            height: 180px;
            border-top: 3px solid #48dbfb;
            border-right: 3px solid rgba(72, 219, 251, 0.3);
            border-bottom: 3px solid #ff9ff3;
            border-left: 3px solid rgba(255, 159, 243, 0.3);
            animation-duration: 2.5s;
            animation-direction: reverse;
            filter: drop-shadow(0 0 15px rgba(72, 219, 251, 0.5));
          }

          .ring-3 {
            width: 210px;
            height: 210px;
            border-top: 3px solid #5f27cd;
            border-right: 3px solid rgba(95, 39, 205, 0.3);
            border-bottom: 3px solid #00d2d3;
            border-left: 3px solid rgba(0, 210, 211, 0.3);
            animation-duration: 3.5s;
            filter: drop-shadow(0 0 15px rgba(95, 39, 205, 0.5));
          }

          @keyframes ringRotate {
            0% { transform: translate(-50%, -50%) rotate(0deg); }
            100% { transform: translate(-50%, -50%) rotate(360deg); }
          }

          .pulse-bg {
            position: absolute;
            width: 280px;
            height: 280px;
            background: radial-gradient(
              circle,
              rgba(255, 107, 107, 0.2) 0%,
              rgba(72, 219, 251, 0.2) 25%,
              rgba(255, 159, 243, 0.2) 50%,
              rgba(95, 39, 205, 0.2) 75%,
              transparent 100%
            );
            border-radius: 50%;
            animation: pulseGlow 2.5s ease-in-out infinite;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
          }

          @keyframes pulseGlow {
            0%, 100% { 
              transform: translate(-50%, -50%) scale(0.8); 
              opacity: 0.6; 
            }
            50% { 
              transform: translate(-50%, -50%) scale(1.3); 
              opacity: 0.9; 
            }
          }

          .loading-text {
            color: white;
            font-size: 1.4rem;
            font-weight: 800;
            text-align: center;
            margin-bottom: 20px;
            text-shadow: 
              0 0 10px rgba(255, 255, 255, 0.8),
              0 0 20px rgba(255, 107, 107, 0.6),
              0 0 30px rgba(72, 219, 251, 0.4);
            letter-spacing: 1.5px;
            font-family: 'Poppins', sans-serif;
            background: linear-gradient(
              45deg,
              #ff6b6b,
              #feca57,
              #48dbfb,
              #ff9ff3,
              #5f27cd,
              #00d2d3
            );
            background-size: 400% 400%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: gradientText 4s ease-in-out infinite;
          }

          @keyframes gradientText {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }

          .progress-container {
            width: 220px;
            height: 6px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 15px;
            overflow: hidden;
            margin-bottom: 15px;
            box-shadow: 
              inset 0 1px 3px rgba(0, 0, 0, 0.2),
              0 0 15px rgba(255, 255, 255, 0.3);
          }

          .progress-bar-custom {
            height: 100%;
            background: linear-gradient(
              90deg,
              #ff6b6b 0%,
              #feca57 20%,
              #48dbfb 40%,
              #ff9ff3 60%,
              #5f27cd 80%,
              #00d2d3 100%
            );
            background-size: 200% 100%;
            border-radius: 15px;
            animation: progressFill 4s ease-in-out infinite, progressGradient 3s ease-in-out infinite;
            box-shadow: 0 0 15px rgba(255, 107, 107, 0.6);
          }

          @keyframes progressFill {
            0% { width: 0%; }
            25% { width: 40%; }
            50% { width: 70%; }
            75% { width: 90%; }
            100% { width: 100%; }
          }

          @keyframes progressGradient {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }

          .loading-status {
            color: rgba(255, 255, 255, 0.9);
            font-size: 0.9rem;
            text-align: center;
            font-weight: 600;
            text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
            animation: statusPulse 2s ease-in-out infinite;
            letter-spacing: 1px;
          }

          @keyframes statusPulse {
            0%, 100% { opacity: 0.8; transform: translateY(0); }
            50% { opacity: 1; transform: translateY(-3px); }
          }

          .floating-icons {
            position: absolute;
            width: 100%;
            height: 100%;
            top: 0;
            left: 0;
            pointer-events: none;
            z-index: 5;
          }

          .floating-icon {
            position: absolute;
            font-size: 1.2rem;
            animation: iconFloat 8s ease-in-out infinite;
          }

          @keyframes iconFloat {
            0%, 100% { 
              transform: translateY(0px) rotate(0deg) scale(1); 
              opacity: 0.7; 
            }
            25% { 
              transform: translateY(-20px) rotate(90deg) scale(1.2); 
              opacity: 1; 
            }
            50% { 
              transform: translateY(0px) rotate(180deg) scale(0.9); 
              opacity: 0.7; 
            }
            75% { 
              transform: translateY(15px) rotate(270deg) scale(1.1); 
              opacity: 1; 
            }
          }

          @media (max-width: 768px) {
            .main-spinner {
              width: 100px;
              height: 100px;
            }

            .ring-1 { width: 130px; height: 130px; }
            .ring-2 { width: 160px; height: 160px; }
            .ring-3 { width: 190px; height: 190px; }

            .loading-text {
              font-size: 1.1rem;
            }

            .progress-container {
              width: 180px;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%)',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* Floating Background Shapes */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none'
      }}>
        <div className="shape" style={{
          position: 'absolute',
          width: '80px',
          height: '80px',
          left: '10%',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(30, 64, 175, 0.05))',
          borderRadius: '50%',
          animationName: 'floatShape',
          animationDuration: '15s',
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
          animationDelay: '0s'
        }}></div>
        <div className="shape" style={{
          position: 'absolute',
          width: '120px',
          height: '120px',
          right: '10%',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(30, 64, 175, 0.05))',
          borderRadius: '50%',
          animationName: 'floatShape',
          animationDuration: '15s',
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
          animationDelay: '5s'
        }}></div>
        <div className="shape" style={{
          position: 'absolute',
          width: '60px',
          height: '60px',
          left: '50%',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(30, 64, 175, 0.05))',
          borderRadius: '50%',
          animationName: 'floatShape',
          animationDuration: '15s',
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
          animationDelay: '10s'
        }}></div>
      </div>

      {/* Hero Section */}
      <section style={{padding: '40px 0 10px', textAlign: 'center', position: 'relative', overflow: 'hidden'}}>
        <div className="container mx-auto px-6">
          <div style={{animation: 'heroFadeInUp 1.2s ease-out'}}>
            <h1 style={{
              fontFamily: "'Poppins', serif",
              fontSize: '3rem',
              fontWeight: 700,
              color: '#ffffff',
              marginBottom: '1rem',
              textShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
              animation: 'titleSlide 1.5s ease-out',
              position: 'relative'
            }}>
              Welcome to CUTM Academic Tracker
          </h1>
            <p style={{
              fontSize: '1.25rem',
              color: 'rgba(255, 255, 255, 0.9)',
              fontWeight: 400,
              marginBottom: 0,
              textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
              animation: 'subtitleFade 1.8s ease-out'
            }}>
              Excellence in Education • Transparency in Results • Future in Your Hands
            </p>
            </div>
            </div>
      </section>

      

      {/* Main Form Section */}
      <section style={{padding: '60px 0', position: 'relative', zIndex: 10}}>
        <div className="container mx-auto px-6">
          <div className="flex justify-center">
            <div className="w-full max-w-lg">
              <div className="main-card" style={{
                background: 'rgba(255, 255, 255, 0.98)',
                borderRadius: '20px',
                padding: '2.5rem 2rem',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(59, 130, 246, 0.1)',
                transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                animation: 'cardSlideIn 1.2s ease-out 0.5s both'
              }}>
                <h2 style={{
                  fontFamily: "'Poppins', serif",
                  fontWeight: 700,
                  fontSize: '2.25rem',
                  color: '#1e40af',
                  marginBottom: '2rem',
                  position: 'relative',
                  animation: 'cardTitleFade 1s ease-out 0.8s both',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem'
                }}>
                  <span style={{color: '#3b82f6'}}>🎓</span>
                  Check Your Results
                </h2>

                {/* Error message display */}
                {error && (
                  <div style={{
                    marginBottom: '1.5rem',
                    borderRadius: '12px',
                    padding: '1rem 1.25rem',
                    border: 'none',
                    fontWeight: 500,
                    animation: 'alertSlide 0.5s ease-out',
                    background: '#fef2f2',
                    color: '#dc2626',
                    borderLeft: '4px solid #dc2626'
                  }}>
                    <i className="fas fa-exclamation-triangle" style={{marginRight: '0.5rem'}}></i>
                    {error}
              </div>
                )}

                <form ref={formRef} onSubmit={handleViewResult}>
                  <div style={{marginBottom: '1.75rem', position: 'relative', animation: 'formGroupSlide 0.8s ease-out'}}>
                    <label style={{
                      fontWeight: 600,
                      marginBottom: '0.75rem',
                      color: '#1e3a8a',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '1rem',
                      transition: 'all 0.3s ease'
                    }}>
                      <i className="fas fa-id-card" style={{color: '#3b82f6', marginRight: '0.5rem', width: '20px', textAlign: 'center'}}></i>
                  Registration Number
                </label>
                  <input
                    type="text"
                    value={registration}
                    onChange={handleRegistrationChange}
                    placeholder="Your registration number"
                    readOnly
                    required
                    style={{
                      background: 'rgba(255, 255, 255, 0.7)',
                      cursor: 'not-allowed',
                      opacity: 0.8,
                      border: '2px solid rgba(59, 130, 246, 0.1)',
                      borderRadius: '12px',
                      padding: '1rem 1.25rem',
                        fontSize: '1rem',
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        width: '100%',
                        color: '#1f2937'
                      }}
                      onFocus={(e) => {
                        e.target.style.background = 'rgba(255, 255, 255, 1)';
                        e.target.style.borderColor = '#3b82f6';
                        e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                        e.target.style.transform = 'translateY(-3px) scale(1.01)';
                      }}
                      onBlur={(e) => {
                        e.target.style.background = 'rgba(255, 255, 255, 0.9)';
                        e.target.style.borderColor = 'rgba(59, 130, 246, 0.1)';
                        e.target.style.boxShadow = 'none';
                        e.target.style.transform = 'none';
                      }}
                    />
                    
                    {/* Security notice */}
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '0.75rem',
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      color: '#1e40af',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span style={{fontSize: '1rem'}}>🔒</span>
                      <span>You can only view your own academic results for security purposes.</span>
                </div>
              </div>

                  {/* Enhanced Multi-Select for Semesters */}
                  <div style={{
                    marginBottom: '1.75rem', 
                    position: 'relative', 
                    animationName: 'formGroupSlide',
                    animationDuration: '0.8s',
                    animationTimingFunction: 'ease-out',
                    animationDelay: '1.2s', 
                    animationFillMode: 'both'
                  }}>
                    <label style={{
                      fontWeight: 600,
                      marginBottom: '0.75rem',
                      color: '#1e3a8a',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '1rem'
                    }}>
                      <i className="fas fa-calendar-alt" style={{color: '#3b82f6', marginRight: '0.5rem', width: '20px', textAlign: 'center'}}></i>
                      Select Semester(s)
                    </label>
                    <div ref={multiSelectRef} className="custom-multi-select" style={{position: 'relative', width: '100%', zIndex: 100}}>
                      <div
                        onClick={toggleMultiSelect}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleMultiSelect();
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-expanded={showMultiSelect}
                        aria-haspopup="listbox"
                        style={{
                          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.9))',
                          border: showMultiSelect ? '2px solid #3b82f6' : '2px solid rgba(59, 130, 246, 0.2)',
                          borderRadius: showMultiSelect ? '12px 12px 0 0' : '12px',
                          padding: '1rem 1.25rem',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                          color: '#1f2937',
                          fontSize: '1rem',
                          boxShadow: showMultiSelect 
                            ? '0 0 0 4px rgba(59, 130, 246, 0.1), 0 8px 25px rgba(59, 130, 246, 0.15)' 
                            : '0 4px 6px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1)',
                          outline: 'none',
                          backdropFilter: 'blur(10px)',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#3b82f6';
                          e.currentTarget.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.1), 0 8px 25px rgba(59, 130, 246, 0.15)';
                        }}
                        onBlur={(e) => {
                          if (!showMultiSelect) {
                            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.2)';
                            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1)';
                          }
                        }}
                        onMouseEnter={(e) => {
                          if (!showMultiSelect) {
                            e.currentTarget.style.borderColor = '#3b82f6';
                            e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!showMultiSelect) {
                            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.2)';
                            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1)';
                            e.currentTarget.style.transform = 'none';
                          }
                        }}
                      >
                        <div style={{display: 'flex', alignItems: 'center', flex: 1}}>
                          <span style={{
                            color: selectedSemesters.length === 0 ? '#6b7280' : '#1f2937',
                            fontWeight: selectedSemesters.length === 0 ? 400 : 500,
                            fontSize: selectedSemesters.length === 0 ? '0.95rem' : '1rem'
                          }}>
                            {getSelectedText()}
                          </span>
                          {selectedSemesters.length > 1 && (
                            <span style={{
                              background: 'linear-gradient(135deg, #3b82f6, #1e40af)',
                              color: 'white',
                              borderRadius: '12px',
                              padding: '4px 10px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              marginLeft: '0.75rem',
                              boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
                              animation: 'checkmarkPop 0.3s ease-out'
                            }}>
                              +{selectedSemesters.length - 1}
                            </span>
                  )}
                  </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                          {selectedSemesters.length > 0 && (
                            <span style={{
                              background: 'rgba(59, 130, 246, 0.1)',
                              color: '#3b82f6',
                              borderRadius: '50%',
                              width: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}>
                              {selectedSemesters.length}
                            </span>
                          )}
                          <i className="fas fa-chevron-down" style={{
                            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            color: '#3b82f6',
                            transform: showMultiSelect ? 'rotate(180deg) scale(1.1)' : 'none',
                            fontSize: '0.9rem'
                          }}></i>
                </div>
                  </div>
                      {showMultiSelect && (
                        <div 
                          role="listbox"
                          aria-label="Select semesters"
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.95))',
                            border: '2px solid #3b82f6',
                            borderTop: '1px solid rgba(59, 130, 246, 0.2)',
                            borderRadius: '0 0 12px 12px',
                            maxHeight: '280px',
                            overflowY: 'auto',
                            zIndex: 1000,
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(59, 130, 246, 0.1)',
                            backdropFilter: 'blur(20px)',
                            animation: 'slideDownOptions 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                            position: 'relative'
                          }}
                        >
                          {availableSemesters.length > 0 ? (
                            availableSemesters.map((semester, index) => (
                              <label
                                key={semester}
                                role="option"
                                aria-selected={selectedSemesters.includes(semester)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  padding: '1rem 1.25rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                  margin: 0,
                                  fontWeight: selectedSemesters.includes(semester) ? 600 : 500,
                                  borderBottom: index === availableSemesters.length - 1 ? 'none' : '1px solid rgba(59, 130, 246, 0.08)',
                                  fontSize: '1rem',
                                  position: 'relative',
                                  background: selectedSemesters.includes(semester) 
                                    ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0.05))' 
                                    : 'transparent',
                                  color: selectedSemesters.includes(semester) ? '#1e40af' : '#374151',
                                  borderRadius: index === 0 ? '0' : index === availableSemesters.length - 1 ? '0 0 10px 10px' : '0'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = selectedSemesters.includes(semester) 
                                    ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.1))' 
                                    : 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0.05))';
                                  e.currentTarget.style.transform = 'translateX(8px) scale(1.02)';
                                  e.currentTarget.style.color = '#3b82f6';
                                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = selectedSemesters.includes(semester) 
                                    ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0.05))' 
                                    : 'transparent';
                                  e.currentTarget.style.transform = 'none';
                                  e.currentTarget.style.color = selectedSemesters.includes(semester) ? '#1e40af' : '#374151';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleSemesterChange(semester);
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedSemesters.includes(semester)}
                                  onChange={() => handleSemesterChange(semester)}
                                  style={{display: 'none'}}
                                />
                                <span className="checkmark" style={{
                                  width: '22px',
                                  height: '22px',
                                  border: selectedSemesters.includes(semester) ? '2px solid #3b82f6' : '2px solid rgba(59, 130, 246, 0.3)',
                                  borderRadius: '6px',
                                  marginRight: '1rem',
                                  position: 'relative',
                                  transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                  flexShrink: 0,
                                  background: selectedSemesters.includes(semester) 
                                    ? 'linear-gradient(135deg, #3b82f6, #1e40af)' 
                                    : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: selectedSemesters.includes(semester) 
                                    ? '0 4px 12px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)' 
                                    : '0 2px 4px rgba(0, 0, 0, 0.05)',
                                  transform: selectedSemesters.includes(semester) ? 'scale(1.1)' : 'scale(1)'
                                }}>
                                  {selectedSemesters.includes(semester) && (
                                    <span style={{
                                      color: 'white', 
                                      fontWeight: 'bold', 
                                      fontSize: '12px',
                                      animation: 'checkmarkPop 0.3s ease-out',
                                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
                                    }}>✓</span>
                                  )}
                                </span>
                                <span style={{
                                  flex: 1,
                                  color: selectedSemesters.includes(semester) ? '#1e40af' : 'inherit',
                                  fontWeight: selectedSemesters.includes(semester) ? 600 : 500,
                                  fontSize: '1rem',
                                  letterSpacing: '0.025em'
                                }}>
                                  {semester}
                                </span>
                                {selectedSemesters.includes(semester) && (
                                  <span style={{
                                    background: 'linear-gradient(135deg, #3b82f6, #1e40af)',
                                    color: 'white',
                                    borderRadius: '50%',
                                    width: '20px',
                                    height: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.7rem',
                                    fontWeight: 'bold',
                                    marginLeft: '0.5rem',
                                    boxShadow: '0 2px 6px rgba(59, 130, 246, 0.3)',
                                    animation: 'checkmarkPop 0.3s ease-out'
                                  }}>
                                    ✓
                      </span>
                    )}
                  </label>
                            ))
                          ) : (
                            <div style={{
                              padding: '2rem 1.25rem',
                              textAlign: 'center',
                              color: '#6b7280',
                              fontSize: '0.95rem',
                              fontStyle: 'italic',
                              background: 'linear-gradient(135deg, rgba(107, 114, 128, 0.05), rgba(107, 114, 128, 0.02))',
                              borderRadius: '0 0 10px 10px'
                            }}>
                              <i className="fas fa-calendar-times" style={{
                                fontSize: '1.5rem',
                                marginBottom: '0.5rem',
                                color: '#9ca3af',
                                display: 'block'
                              }}></i>
                              No semesters available
                              <div style={{
                                fontSize: '0.8rem',
                                color: '#9ca3af',
                                marginTop: '0.25rem'
                              }}>
                                Enter a valid registration number
                              </div>
                </div>
              )}
                </div>
              )}
                  </div>
                    <small style={{
                      color: '#6b7280',
                      fontSize: '0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      marginTop: '0.75rem',
                      padding: '0.75rem 1rem',
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(59, 130, 246, 0.02))',
                      borderRadius: '8px',
                      border: '1px solid rgba(59, 130, 246, 0.1)',
                      fontWeight: 500
                    }}>
                      <i className="fas fa-info-circle" style={{
                        marginRight: '0.75rem', 
                        color: '#3b82f6',
                        fontSize: '1rem'
                      }}></i>
                      <span>
                        Click to select multiple semesters for comprehensive results
                        <span style={{
                          display: 'block',
                          fontSize: '0.8rem',
                          color: '#9ca3af',
                          marginTop: '0.25rem',
                          fontWeight: 400
                        }}>
                          💡 Tip: You can select multiple semesters to view combined results
                        </span>
                      </span>
                    </small>
                </div>

              <button
                type="submit"
                    disabled={!registration || selectedSemesters.length === 0 || isFormSubmitting}
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6, #1e40af)',
                      border: 'none',
                      borderRadius: '50px',
                      padding: '1rem 2rem',
                      fontWeight: 600,
                      fontSize: '1.1rem',
                      color: 'white',
                      marginTop: '1rem',
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      width: '100%',
                      cursor: (!registration || selectedSemesters.length === 0 || isFormSubmitting) ? 'not-allowed' : 'pointer',
                      opacity: (!registration || selectedSemesters.length === 0 || isFormSubmitting) ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!e.currentTarget.disabled) {
                        e.currentTarget.style.transform = 'translateY(-4px) scale(1.05)';
                        e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                    }}
              >
                {isFormSubmitting ? (
                      <span>Processing...</span>
                    ) : (
                      <><i className="fas fa-search" style={{marginRight: '0.5rem'}}></i> Search Results</>
                    )}
              </button>
            </form>
              </div>
          </div>
        </div>
        </div>
      </section>

      {/* Stats Section */}
      <section style={{
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '4rem 0',
        position: 'relative',
        backdropFilter: 'blur(10px)'
      }}>
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8" ref={statsRef}>
            <div className="stat-card" style={{
              background: 'white',
              borderRadius: '16px',
              padding: '2rem 1.5rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.05)',
              textAlign: 'center',
              transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                fontSize: '2.5rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #3b82f6, #1e40af)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                marginBottom: '0.5rem',
                display: 'block'
              }}>
                <AnimatedCounter end={50000} suffix="+" />
            </div>
              <div style={{fontSize: '1.1rem', color: '#1f2937', fontWeight: 500}}>
                Students Enrolled
          </div>
            </div>
            <div className="stat-card" style={{
              background: 'white',
              borderRadius: '16px',
              padding: '2rem 1.5rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.05)',
              textAlign: 'center',
              transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                fontSize: '2.5rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #3b82f6, #1e40af)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                marginBottom: '0.5rem',
                display: 'block'
              }}>
                <AnimatedCounter end={500} suffix="+" />
          </div>
              <div style={{fontSize: '1.1rem', color: '#1f2937', fontWeight: 500}}>
                Expert Faculty
              </div>
            </div>
            <div className="stat-card" style={{
              background: 'white',
              borderRadius: '16px',
              padding: '2rem 1.5rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.05)',
              textAlign: 'center',
              transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                fontSize: '2.5rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #3b82f6, #1e40af)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                marginBottom: '0.5rem',
                display: 'block'
              }}>
                <AnimatedCounter end={100} suffix="+" />
              </div>
              <div style={{fontSize: '1.1rem', color: '#1f2937', fontWeight: 500}}>
                Programs Offered
              </div>
            </div>
            <div className="stat-card" style={{
              background: 'white',
              borderRadius: '16px',
              padding: '2rem 1.5rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.05)',
              textAlign: 'center',
              transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                fontSize: '2.5rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #3b82f6, #1e40af)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                marginBottom: '0.5rem',
                display: 'block'
              }}>
                <AnimatedCounter end={20} suffix="+" />
              </div>
              <div style={{fontSize: '1.1rem', color: '#1f2937', fontWeight: 500}}>
                Years of Excellence
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section style={{padding: '5rem 0', background: 'white'}}>
        <div className="container mx-auto px-6">
          <div style={{textAlign: 'center', marginBottom: '4rem'}}>
            <h2 style={{
              fontFamily: "'Poppins', serif",
              fontSize: '2.5rem',
              fontWeight: 700,
              color: '#1e40af',
              marginBottom: '1rem'
            }}>
              Why Choose CUTM Portal?
            </h2>
            <p style={{
              fontSize: '1.2rem',
              color: '#6b7280',
              maxWidth: '600px',
              margin: '0 auto'
            }}>
              Experience the future of academic result management with cutting-edge technology and seamless user experience
            </p>
            </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {icon: '⚡', title: 'Instant Results', desc: 'Get your academic results instantly with our lightning-fast portal. No more waiting periods or delays.'},
              {icon: '🛡️', title: 'Secure & Reliable', desc: 'Your data is protected with enterprise-grade security protocols and reliable infrastructure.'},
              {icon: '📱', title: 'Mobile Friendly', desc: 'Access your results anytime, anywhere with fully responsive design and mobile optimization.'},
              {icon: '📊', title: 'Advanced Analytics', desc: 'Track your performance with detailed analytics and insights to help you excel academically.'},
              {icon: '📥', title: 'Easy Download', desc: 'Download your results in multiple formats with print-ready certificates available instantly.'},
              {icon: '🎧', title: '24/7 Support', desc: 'Round-the-clock dedicated support team available to assist with any queries or technical issues.'}
            ].map((feature, idx) => (
              <div key={idx} className="feature-card" style={{
                background: 'rgba(248, 250, 252, 0.8)',
                border: '1px solid rgba(59, 130, 246, 0.08)',
                borderRadius: '16px',
                padding: '2.5rem 2rem',
                height: '100%',
                textAlign: 'center',
                transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-10px)';
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.borderColor = '#3b82f6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.background = 'rgba(248, 250, 252, 0.8)';
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.08)';
              }}
              >
                <div style={{
                  fontSize: '2.5rem',
                  color: '#3b82f6',
                  marginBottom: '1.5rem',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  zIndex: 1
                }}>
                  {feature.icon}
          </div>
                <h3 style={{
                  fontSize: '1.35rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                  color: '#1f2937',
                  position: 'relative',
                  zIndex: 1
                }}>
                  {feature.title}
                </h3>
                <p style={{
                  color: '#6b7280',
                  fontSize: '1rem',
                  lineHeight: 1.6,
                  position: 'relative',
                  zIndex: 1
                }}>
                  {feature.desc}
                </p>
        </div>
            ))}
      </div>
        </div>
      </section>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="scroll-to-top"
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            width: '50px',
            height: '50px',
            background: 'linear-gradient(135deg, #3b82f6, #1e40af)',
            border: 'none',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 1000,
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px) scale(1.15)';
            e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
          }}
        >
          <i className="fas fa-chevron-up" style={{color: 'white', fontSize: '1.2rem'}}></i>
        </button>
      )}

      {/* Enhanced Footer */}
      <footer style={{
        background: 'linear-gradient(135deg, #1e3a8a, #1e40af)',
        color: 'rgba(255, 255, 255, 0.9)',
        padding: '3rem 0 2rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div className="container mx-auto px-6">
          <div style={{textAlign: 'center', position: 'relative', zIndex: 1}}>
            <h3 style={{
              fontFamily: "'Poppins', serif",
              fontWeight: 700,
              fontSize: '1.75rem',
              marginBottom: '1rem',
              color: 'white'
            }}>
              CUTM Result Portal
            </h3>
            <p style={{marginBottom: '1.5rem', opacity: 0.9}}>
              Empowering students with transparent, secure, and instant access to their academic achievements through innovative technology.
            </p>
            
            <div style={{margin: '2rem 0'}}>
              {[
                {href: 'https://github.com/AYUSHRAHUL', icon: 'fab fa-github'},
                {href: 'https://www.linkedin.com/in/ayush-kumar-singh7/', icon: 'fab fa-linkedin-in'},
                {href: '#', icon: 'fab fa-twitter'},
                {href: '#', icon: 'fab fa-facebook-f'}
              ].map((social, idx) => (
                <a
                  key={idx}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    margin: '0 1rem',
                    padding: '1rem',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '50%',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: '1.25rem',
                    width: '50px',
                    height: '50px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    backdropFilter: 'blur(10px)',
                    textDecoration: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.transform = 'translateY(-6px) scale(1.15)';
                    e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <i className={social.icon}></i>
                </a>
              ))}
              </div>
            
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.2)',
              paddingTop: '1.5rem',
              marginTop: '2rem',
              opacity: 0.8
            }}>
              <p>&copy; 2025 CUTM Result Portal. All rights reserved. | Crafted with excellence for academic success.</p>
            </div>
          </div>
        </div>
      </footer>

      <style jsx>{`
        @keyframes floatShape {
          0% { 
            transform: translateY(100vh) rotate(0deg) scale(0.5); 
            opacity: 0;
          }
          10% { 
            opacity: 0.6; 
            transform: translateY(90vh) rotate(36deg) scale(0.8); 
          }
          90% { 
            opacity: 0.4; 
            transform: translateY(10vh) rotate(324deg) scale(1.2); 
          }
          100% { 
            transform: translateY(-100px) rotate(360deg) scale(0.3); 
            opacity: 0; 
          }
        }

        @keyframes heroFadeInUp {
          0% { 
            opacity: 0; 
            transform: translateY(60px) scale(0.9); 
          }
          100% { 
            opacity: 1;
            transform: translateY(0) scale(1); 
          }
        }

        @keyframes titleSlide {
          0% { 
            opacity: 0; 
            transform: translateX(-60px) rotate(-2deg); 
          }
          100% { 
            opacity: 1; 
            transform: translateX(0) rotate(0deg); 
          }
        }

        @keyframes subtitleFade {
          0% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 0.9; transform: translateY(0); }
        }

        @keyframes cardSlideIn {
          0% { 
            opacity: 0; 
            transform: translateY(60px) scale(0.9) rotateX(10deg); 
          }
          100% { 
            opacity: 1; 
            transform: translateY(0) scale(1) rotateX(0deg); 
          }
        }

        @keyframes cardTitleFade {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes formGroupSlide {
          0% { opacity: 0; transform: translateX(-30px); }
          100% { opacity: 1; transform: translateX(0); }
        }

        @keyframes slideDownOptions {
          0% { 
            opacity: 0; 
            transform: translateY(-10px) scale(0.95); 
          }
          100% { 
            opacity: 1; 
            transform: translateY(0) scale(1); 
          }
        }

        @keyframes alertSlide {
          0% { opacity: 0; transform: translateX(-20px); }
          100% { opacity: 1; transform: translateX(0); }
        }

        @keyframes checkmarkPop {
          0% { 
            transform: scale(0); 
            opacity: 0; 
          }
          50% { 
            transform: scale(1.3); 
            opacity: 1; 
          }
          100% { 
            transform: scale(1); 
            opacity: 1; 
          }
        }

        .stat-card {
          position: relative;
        }

        .stat-card::before {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 4px;
          background: linear-gradient(90deg, #3b82f6, #1e40af);
          transform: scaleX(0);
          transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
          transform-origin: left;
        }

        .stat-card:hover::before {
          transform: scaleX(1);
        }

        .stat-card:hover {
          transform: translateY(-8px) scale(1.05);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }

        .main-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.08), transparent);
          transition: left 1s ease;
        }

        .main-card:hover::before {
          left: 100%;
        }

        .main-card:hover {
          transform: translateY(-8px) scale(1.02);
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
          border-color: #3b82f6;
        }

        /* Responsive Design */
        @media (max-width: 768px) {
          h1 {
            font-size: 2.25rem !important;
          }
          
          p {
            font-size: 1.1rem !important;
          }
          
          .main-card {
            padding: 2rem 1.5rem !important;
            margin: 0 1rem !important;
          }
          
          h2 {
            font-size: 1.75rem !important;
          }
          
          .feature-card {
            padding: 2rem 1.5rem !important;
          }
        }

        @media (max-width: 576px) {
          h1 {
            font-size: 1.75rem !important;
          }
          
          .main-card {
            padding: 1.5rem 1rem !important;
          }
        }
      `}</style>
    </div>
  );
}
