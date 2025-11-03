"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [userLoading, setUserLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const isDashboard = typeof pathname === "string" && pathname.startsWith("/dashboard");

  const roleLower = String(user?.role || "").toLowerCase();
  const isUserPanel = isDashboard && user && !userLoading && (roleLower === "user" || roleLower === "student");
  const isActive = (path) => typeof pathname === "string" && pathname.startsWith(path);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setUserLoading(true);
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setUserLoading(false);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (open && !event.target.closest('.user-dropdown')) {
        setOpen(false);
      }
      if (mobileMenuOpen && !event.target.closest('.mobile-menu-container') && !event.target.closest('.mobile-menu-button')) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open, mobileMenuOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setOpen(false);
      setMobileMenuOpen(false);
      router.replace("/login");
    }
  };

  if (!mounted) {
    return (
      <nav 
        className="text-white flex justify-between items-center px-4 sm:px-6 py-3 min-h-[64px] relative z-50 shadow-lg"
        style={{
          background: "linear-gradient(135deg, #05A3C7 0%, #04748F 50%, #023945 100%)",
        }}
      >
        <button 
          className="font-black text-lg sm:text-xl flex items-center gap-2 sm:gap-3 flex-shrink-0 hover:opacity-90 transition-opacity touch-manipulation" 
          onClick={() => router.push("/")}
          aria-label="CUTM Portal Home"
        >
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden shadow-lg ring-2 ring-white/30 bg-white p-1">
            <Image 
              src="/cutmlogo.png" 
              alt="CUTM Logo" 
              width={56} 
              height={56} 
              className="object-contain w-full h-full" 
              priority 
            />
          </div>
          <span>CUTM Portal</span>
        </button>
        <div />
      </nav>
    );
  }

  return (
    <>
      <nav 
        className="text-white flex justify-between items-center px-4 sm:px-6 py-3 min-h-[64px] relative z-50 shadow-lg"
        style={{
          background: "linear-gradient(135deg, #05A3C7 0%, #04748F 50%, #023945 100%)",
        }}
      >
        <button 
          className="font-black text-lg sm:text-xl flex items-center gap-2 sm:gap-3 flex-shrink-0 hover:opacity-90 transition-opacity touch-manipulation" 
          onClick={() => router.push("/")}
          aria-label="CUTM Portal Home"
        >
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden shadow-lg ring-2 ring-white/30 bg-white p-1">
            <Image 
              src="/cutmlogo.png" 
              alt="CUTM Logo" 
              width={56} 
              height={56} 
              className="object-contain w-full h-full" 
              priority 
            />
          </div>
          <span className="hidden xs:inline">CUTM Portal</span>
          <span className="inline xs:hidden">CUTM Portal</span>
        </button>

        {/* Desktop User Panel Quick Links */}
        {isUserPanel && (
          <div className="hidden md:flex items-center gap-2 lg:gap-3 mx-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => router.push("/dashboard/user")}
              className={`px-3 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all duration-200 touch-manipulation ${
                isActive("/dashboard/user") && !isActive("/dashboard/user/")
                  ? "bg-white text-[#05A3C7] shadow-md"
                  : "bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm"
              }`}
              title="View Results"
              style={{ minHeight: "40px" }}
            >
              📊 Results
            </button>

            <button
              onClick={() => router.push("/dashboard/user/basket-track")}
              className={`px-3 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all duration-200 touch-manipulation ${
                isActive("/dashboard/user/basket-track") 
                  ? "bg-white text-[#05A3C7] shadow-md" 
                  : "bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm"
              }`}
              title="Basket Track"
              style={{ minHeight: "40px" }}
            >
              📋 Basket
            </button>

            <button
              onClick={() => router.push("/dashboard/user/backlog-track")}
              className={`px-3 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all duration-200 touch-manipulation ${
                isActive("/dashboard/user/backlog-track") 
                  ? "bg-white text-[#05A3C7] shadow-md" 
                  : "bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm"
              }`}
              title="Backlog Track"
              style={{ minHeight: "40px" }}
            >
              ⚠️ Backlogs
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Mobile Menu Button for User Panel */}
          {isUserPanel && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-200 touch-manipulation mobile-menu-button"
              aria-label="Toggle mobile menu"
              style={{ minHeight: "44px", minWidth: "44px" }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className={`w-6 h-6 transition-transform duration-300 ${mobileMenuOpen ? 'rotate-90' : ''}`}
              >
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                )}
              </svg>
            </button>
          )}

          {/* Loading State */}
          {userLoading && isDashboard && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 backdrop-blur-sm">
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span className="text-sm font-bold opacity-90 hidden sm:inline">Loading...</span>
            </div>
          )}

          {/* User Dropdown */}
          {user && !userLoading && (
            <div className="relative user-dropdown">
              <button 
                onClick={() => setOpen(v => !v)} 
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all duration-200 backdrop-blur-sm touch-manipulation"
                style={{ minHeight: "44px" }}
              >
                <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#F18F01] text-white text-sm sm:text-base font-bold shadow-md">
                  {user?.name?.charAt(0).toUpperCase() || '👤'}
                </span>
                <span className="text-sm font-bold opacity-90 capitalize hidden sm:inline">
                  {String(user.role || "user").toLowerCase()}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              
              {open && (
                <div className="absolute right-0 mt-3 w-64 rounded-2xl bg-white text-gray-900 shadow-2xl overflow-hidden z-50 border-2 border-[#05A3C7]/20 animate-fade-in">
                  <div 
                    className="px-4 py-4 border-b-2 border-[#05A3C7]/10"
                    style={{
                      background: "linear-gradient(135deg, rgba(5,163,199,0.05) 0%, rgba(241,143,1,0.05) 100%)",
                    }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 rounded-full bg-[#F18F01] text-white flex items-center justify-center text-xl font-black shadow-md">
                        {user?.name?.charAt(0).toUpperCase() || '👤'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-base font-black text-[#1A1F29] truncate">
                          {user?.name || 'User'}
                        </div>
                        <div className="text-xs font-bold text-[#5A6C7D] capitalize">
                          {String(user.role || "user").toLowerCase()}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-[#5A6C7D] font-medium truncate">
                      {user?.email || ''}
                    </div>
                  </div>
                  
                  <div className="py-2">
                    <button
                      className="w-full text-left px-4 py-3 text-sm font-bold text-[#2E4057] hover:bg-[#05A3C7]/5 transition-colors flex items-center gap-3 touch-manipulation"
                      onClick={() => {
                        setOpen(false);
                        const role = String(user.role || "user").toLowerCase();
                        const base = role === "admin" ? "/dashboard/admin" : role === "teacher" ? "/dashboard/teacher" : "/dashboard/user";
                        router.push(`${base}/profile`);
                      }}
                      style={{ minHeight: "44px" }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#05A3C7]">
                        <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clipRule="evenodd" />
                      </svg>
                      View Profile
                    </button>
                    
                    <button
                      className="w-full text-left px-4 py-3 text-sm font-bold text-[#2E4057] hover:bg-[#05A3C7]/5 transition-colors flex items-center gap-3 touch-manipulation"
                      onClick={() => {
                        setOpen(false);
                        const role = String(user.role || "user").toLowerCase();
                        const base = role === "admin" ? "/dashboard/admin" : role === "teacher" ? "/dashboard/teacher" : "/dashboard/user";
                        router.push(`${base}/profile/edit`);
                      }}
                      style={{ minHeight: "44px" }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#05A3C7]">
                        <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z" />
                        <path d="M5.25 5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h10.5a3 3 0 003-3V13.5a.75.75 0 00-1.5 0v5.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5h5.25a.75.75 0 000-1.5H5.25z" />
                      </svg>
                      Edit Profile
                    </button>
                    
                    <button
                      className="w-full text-left px-4 py-3 text-sm font-bold text-[#2E4057] hover:bg-[#05A3C7]/5 transition-colors flex items-center gap-3 touch-manipulation"
                      onClick={() => {
                        setOpen(false);
                        const role = String(user.role || "user").toLowerCase();
                        const target = role === "admin" ? "/dashboard/admin" : role === "teacher" ? "/dashboard/teacher" : "/dashboard/user";
                        router.push(target);
                      }}
                      style={{ minHeight: "44px" }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#05A3C7]">
                        <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
                        <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
                      </svg>
                      My Dashboard
                    </button>
                  </div>
                  
                  <div className="border-t-2 border-[#05A3C7]/10" />
                  
                  <button
                    className="w-full text-left px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3 touch-manipulation"
                    onClick={logout}
                    style={{ minHeight: "44px" }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm10.72 4.72a.75.75 0 011.06 0l3 3a.75.75 0 010 1.06l-3 3a.75.75 0 11-1.06-1.06l1.72-1.72H9a.75.75 0 010-1.5h10.94l-1.72-1.72a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Menu Overlay for User Panel */}
      {isUserPanel && !userLoading && mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="fixed top-[64px] left-0 right-0 bottom-0 bg-white shadow-2xl transform transition-transform duration-300 ease-out mobile-menu-container overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "linear-gradient(to bottom, #F5F8FA 0%, #E8F4F8 50%, #D1E9F6 100%)",
            }}
          >
            <div className="p-6 space-y-4">
              <h3 className="text-xl font-black text-[#1A1F29] mb-6 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-[#05A3C7]">
                  <path fillRule="evenodd" d="M3 6.75A.75.75 0 013.75 6h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 6.75zM3 12a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 12zm0 5.25a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                </svg>
                Quick Navigation
              </h3>
              
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  router.push("/dashboard/user");
                }}
                className={`w-full text-left px-5 py-4 rounded-xl text-base font-bold transition-all duration-200 flex items-center gap-4 shadow-md touch-manipulation ${
                  isActive("/dashboard/user") && !isActive("/dashboard/user/")
                    ? "bg-white text-[#05A3C7] border-2 border-[#05A3C7]"
                    : "bg-white text-[#2E4057] border-2 border-transparent hover:border-[#05A3C7]/30"
                }`}
                style={{ minHeight: "56px" }}
              >
                <span className="text-2xl">📊</span>
                <div>
                  <div>View Results</div>
                  <div className="text-xs text-[#5A6C7D] font-medium mt-0.5">Check your academic performance</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  router.push("/dashboard/user/basket-track");
                }}
                className={`w-full text-left px-5 py-4 rounded-xl text-base font-bold transition-all duration-200 flex items-center gap-4 shadow-md touch-manipulation ${
                  isActive("/dashboard/user/basket-track")
                    ? "bg-white text-[#05A3C7] border-2 border-[#05A3C7]"
                    : "bg-white text-[#2E4057] border-2 border-transparent hover:border-[#05A3C7]/30"
                }`}
                style={{ minHeight: "56px" }}
              >
                <span className="text-2xl">📋</span>
                <div>
                  <div>Basket Track</div>
                  <div className="text-xs text-[#5A6C7D] font-medium mt-0.5">Monitor your course basket</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  router.push("/dashboard/user/backlog-track");
                }}
                className={`w-full text-left px-5 py-4 rounded-xl text-base font-bold transition-all duration-200 flex items-center gap-4 shadow-md touch-manipulation ${
                  isActive("/dashboard/user/backlog-track")
                    ? "bg-white text-[#05A3C7] border-2 border-[#05A3C7]"
                    : "bg-white text-[#2E4057] border-2 border-transparent hover:border-[#05A3C7]/30"
                }`}
                style={{ minHeight: "56px" }}
              >
                <span className="text-2xl">⚠️</span>
                <div>
                  <div>Backlog Track</div>
                  <div className="text-xs text-[#5A6C7D] font-medium mt-0.5">View pending subjects</div>
                </div>
              </button>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-sm border-t-2 border-[#05A3C7]/20">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-3 rounded-xl font-bold text-[#5A6C7D] bg-white border-2 border-[#05A3C7]/20 hover:bg-[#05A3C7]/5 transition-colors touch-manipulation"
                style={{ minHeight: "48px" }}
              >
                Close Menu
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
}
