"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "user", isBlocked: false });
  const [isBlocking, setIsBlocking] = useState(false);

  // Fetch users
  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/users");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch users");
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Filter and search users
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = filterRole === "all" || user.role === filterRole;
      const matchesStatus = filterStatus === "all" || 
        (filterStatus === "blocked" && user.isBlocked) ||
        (filterStatus === "active" && !user.isBlocked);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, filterRole, filterStatus]);

  // Open edit modal
  function openEditModal(user) {
    setEditingUser(user);
    setEditForm({
      name: user.name || "",
      email: user.email || "",
      role: user.role || "user",
      isBlocked: user.isBlocked || false
    });
  }

  // Close edit modal
  function closeEditModal() {
    setEditingUser(null);
    setEditForm({ name: "", email: "", role: "user", isBlocked: false });
    setError("");
    setMessage("");
  }

  // Update user
  async function handleUpdateUser(e) {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const updates = {
        name: editForm.name.trim(),
        role: editForm.role,
        isBlocked: editForm.isBlocked
      };

      // Convert _id to string if it's an ObjectId
      const userId = typeof editingUser._id === 'object' ? editingUser._id.toString() : editingUser._id;

      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId,
          updates
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user");

      setMessage("User updated successfully");
      // Refresh users list and close modal
      await fetchUsers();
      setTimeout(() => {
        closeEditModal();
      }, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Toggle block status
  async function toggleBlock(user) {
    if (!confirm(`Are you sure you want to ${user.isBlocked ? "unblock" : "block"} ${user.name || user.email}?`)) {
      return;
    }

    const newBlockedStatus = !user.isBlocked;
    
    // Optimistic update - update UI immediately
    setUsers(prevUsers => 
      prevUsers.map(u => {
        // Handle both string and ObjectId comparison
        const uId = typeof u._id === 'object' ? u._id.toString() : String(u._id);
        const userId = typeof user._id === 'object' ? user._id.toString() : String(user._id);
        return uId === userId ? { ...u, isBlocked: newBlockedStatus } : u;
      })
    );

    try {
      setError("");
      setMessage("");
      setIsBlocking(true);

      // Convert _id to string if it's an ObjectId
      const userId = typeof user._id === 'object' ? user._id.toString() : String(user._id);

      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId,
          updates: { isBlocked: newBlockedStatus }
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        // Revert optimistic update on error
        setUsers(prevUsers => 
          prevUsers.map(u => {
            const uId = typeof u._id === 'object' ? u._id.toString() : String(u._id);
            const userId = typeof user._id === 'object' ? user._id.toString() : String(user._id);
            return uId === userId ? { ...u, isBlocked: user.isBlocked } : u;
          })
        );
        throw new Error(data.error || "Failed to update user");
      }

      setMessage(`User ${newBlockedStatus ? "blocked" : "unblocked"} successfully`);
      
      // Always refresh users list after successful update to ensure UI is in sync
      await fetchUsers();
    } catch (err) {
      console.error("Error updating user:", err);
      setError(err.message || "Failed to update user");
      // Try to refresh anyway to get actual state
      try {
        await fetchUsers();
      } catch (refreshErr) {
        console.error("Error refreshing users:", refreshErr);
      }
    } finally {
      setIsBlocking(false);
    }
  }

  // Auto-dismiss messages
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Role badge colors
  function getRoleBadgeColor(role) {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800 border-red-300";
      case "teacher":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "user":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  }

  // Stats
  const stats = useMemo(() => {
    return {
      total: users.length,
      admins: users.filter(u => u.role === "admin").length,
      teachers: users.filter(u => u.role === "teacher").length,
      regular: users.filter(u => u.role === "user").length,
      blocked: users.filter(u => u.isBlocked).length
    };
  }, [users]);

  if (loading && users.length === 0) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{
          background: "linear-gradient(to bottom, #F5F8FA 0%, #E8F4F8 50%, #D1E9F6 100%)",
        }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#05A3C7] mx-auto mb-4"></div>
          <p className="text-[#5A6C7D] font-medium">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen pb-10"
      style={{
        background: "linear-gradient(to bottom, #F5F8FA 0%, #E8F4F8 50%, #D1E9F6 100%)",
      }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-6 sm:pt-8 lg:pt-12">
        {/* Header */}
        <div className="mb-4 sm:mb-6 text-center">
          <h1 
            className="text-2xl sm:text-3xl md:text-4xl font-black"
            style={{
              background: "linear-gradient(135deg, #05A3C7 0%, #04748F 50%, #023945 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            User Management
          </h1>
          <p className="text-[#5A6C7D] text-sm sm:text-base font-medium mt-2">
            Block, edit, and manage registered users
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
          <div 
            className="rounded-xl border-2 bg-white p-4 text-center shadow-lg"
            style={{ borderColor: "rgba(5,163,199,0.2)" }}
          >
            <div className="text-2xl sm:text-3xl font-black text-[#05A3C7]">{stats.total}</div>
            <div className="text-xs sm:text-sm text-[#5A6C7D] font-bold mt-1">Total Users</div>
          </div>
          <div 
            className="rounded-xl border-2 bg-white p-4 text-center shadow-lg"
            style={{ borderColor: "rgba(5,163,199,0.2)" }}
          >
            <div className="text-2xl sm:text-3xl font-black text-red-600">{stats.admins}</div>
            <div className="text-xs sm:text-sm text-[#5A6C7D] font-bold mt-1">Admins</div>
          </div>
          <div 
            className="rounded-xl border-2 bg-white p-4 text-center shadow-lg"
            style={{ borderColor: "rgba(5,163,199,0.2)" }}
          >
            <div className="text-2xl sm:text-3xl font-black text-blue-600">{stats.teachers}</div>
            <div className="text-xs sm:text-sm text-[#5A6C7D] font-bold mt-1">Teachers</div>
          </div>
          <div 
            className="rounded-xl border-2 bg-white p-4 text-center shadow-lg"
            style={{ borderColor: "rgba(5,163,199,0.2)" }}
          >
            <div className="text-2xl sm:text-3xl font-black text-green-600">{stats.regular}</div>
            <div className="text-xs sm:text-sm text-[#5A6C7D] font-bold mt-1">Regular</div>
          </div>
          <div 
            className="rounded-xl border-2 bg-white p-4 text-center shadow-lg"
            style={{ borderColor: "rgba(5,163,199,0.2)" }}
          >
            <div className="text-2xl sm:text-3xl font-black text-orange-600">{stats.blocked}</div>
            <div className="text-xs sm:text-sm text-[#5A6C7D] font-bold mt-1">Blocked</div>
          </div>
        </div>

        {/* Search and Filter */}
        <div 
          className="rounded-xl sm:rounded-2xl border-2 bg-white p-4 sm:p-5 mb-4 sm:mb-6 shadow-lg"
          style={{ borderColor: "rgba(5,163,199,0.2)" }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-bold text-[#1A1F29] mb-2">Search Users</label>
              <input
                type="text"
                className="w-full rounded-xl border-2 bg-white px-3 sm:px-4 py-2.5 sm:py-3 outline-none focus:ring-4 focus:ring-[#05A3C7]/20 text-[#1A1F29] font-medium text-sm sm:text-base min-h-[44px]"
                style={{ borderColor: "rgba(5,163,199,0.3)" }}
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#1A1F29] mb-2">Filter by Role</label>
              <select
                className="w-full rounded-xl border-2 bg-white px-3 sm:px-4 py-2.5 sm:py-3 outline-none focus:ring-4 focus:ring-[#05A3C7]/20 text-[#1A1F29] font-medium text-sm sm:text-base min-h-[44px]"
                style={{ borderColor: "rgba(5,163,199,0.3)" }}
                value={filterRole}
                onChange={e => setFilterRole(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="teacher">Teacher</option>
                <option value="user">User</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-[#1A1F29] mb-2">Filter by Status</label>
              <select
                className="w-full rounded-xl border-2 bg-white px-3 sm:px-4 py-2.5 sm:py-3 outline-none focus:ring-4 focus:ring-[#05A3C7]/20 text-[#1A1F29] font-medium text-sm sm:text-base min-h-[44px]"
                style={{ borderColor: "rgba(5,163,199,0.3)" }}
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {message && (
          <div className="mb-4 rounded-xl border-2 border-green-200 bg-green-50 text-green-700 px-3 sm:px-4 py-2.5 sm:py-3 font-medium flex items-center gap-3 text-sm sm:text-base">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
            </svg>
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-xl border-2 border-red-200 bg-red-50 text-red-700 px-3 sm:px-4 py-2.5 sm:py-3 font-medium flex items-center gap-3 text-sm sm:text-base">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0">
              <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Users Table */}
        <div 
          className="rounded-xl sm:rounded-2xl overflow-hidden border-2 bg-white shadow-lg"
          style={{ borderColor: "rgba(5,163,199,0.2)" }}
        >
          <div 
            className="text-white px-4 sm:px-5 lg:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
          >
            <div className="flex items-center gap-2">
              <span className="p-1 sm:p-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }}>👥</span>
              <span className="font-black text-sm sm:text-base">Registered Users</span>
            </div>
            <div className="text-xs sm:text-sm px-2.5 sm:px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }}>
              {filteredUsers.length} {filteredUsers.length === 1 ? "User" : "Users"}
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-[#5A6C7D]">
              <p className="text-sm sm:text-base font-medium">
                {users.length === 0 
                  ? "No users found in the system" 
                  : "No users match your search or filter criteria"}
              </p>
              {(searchTerm || filterRole !== "all" || filterStatus !== "all") && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setFilterRole("all");
                    setFilterStatus("all");
                  }}
                  className="mt-3 px-4 py-2 rounded-lg text-sm font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block md:hidden divide-y-2" style={{ borderColor: "rgba(5,163,199,0.1)" }}>
                {filteredUsers.map((user) => (
                  <div key={user._id} className="p-4 hover:bg-[#05A3C7]/5 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[#1A1F29] text-sm mb-1 truncate">{user.name || "N/A"}</div>
                        <div className="text-[#5A6C7D] text-xs mb-2 truncate">{user.email}</div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getRoleBadgeColor(user.role)}`}>
                            {user.role?.toUpperCase() || "USER"}
                          </span>
                          {user.isBlocked ? (
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
                              Blocked
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-300">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[#5A6C7D] text-xs">
                          Registered: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => openEditModal(user)}
                        className="flex-1 px-3 py-2 rounded-lg text-xs font-bold text-white hover:shadow-md transition-all"
                        style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleBlock(user)}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold text-white hover:shadow-md transition-all disabled:opacity-50 ${
                          user.isBlocked 
                            ? "bg-green-600 hover:bg-green-700" 
                            : "bg-red-600 hover:bg-red-700"
                        }`}
                        disabled={isBlocking || loading}
                      >
                        {user.isBlocked ? "Unblock" : "Block"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr style={{ background: "rgba(5,163,199,0.1)" }}>
                      <th className="px-3 sm:px-4 py-3 text-left font-black text-xs uppercase tracking-wider text-[#1A1F29]">Name</th>
                      <th className="px-3 sm:px-4 py-3 text-left font-black text-xs uppercase tracking-wider text-[#1A1F29]">Email</th>
                      <th className="px-3 sm:px-4 py-3 text-left font-black text-xs uppercase tracking-wider text-[#1A1F29]">Role</th>
                      <th className="px-3 sm:px-4 py-3 text-left font-black text-xs uppercase tracking-wider text-[#1A1F29]">Status</th>
                      <th className="px-3 sm:px-4 py-3 text-left font-black text-xs uppercase tracking-wider text-[#1A1F29]">Registered</th>
                      <th className="px-3 sm:px-4 py-3 text-center font-black text-xs uppercase tracking-wider text-[#1A1F29]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2" style={{ borderColor: "rgba(5,163,199,0.1)" }}>
                    {filteredUsers.map((user) => (
                      <tr key={user._id} className="hover:bg-[#05A3C7]/5 transition-colors">
                        <td className="px-3 sm:px-4 py-3 font-bold text-[#1A1F29]">{user.name || "N/A"}</td>
                        <td className="px-3 sm:px-4 py-3 text-[#5A6C7D] break-words">{user.email}</td>
                        <td className="px-3 sm:px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getRoleBadgeColor(user.role)}`}>
                            {user.role?.toUpperCase() || "USER"}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3">
                          {user.isBlocked ? (
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
                              Blocked
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-300">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-[#5A6C7D] text-xs whitespace-nowrap">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          }) : "N/A"}
                        </td>
                        <td className="px-3 sm:px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEditModal(user)}
                              className="px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold text-white hover:shadow-md transition-all disabled:opacity-50"
                              style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                              disabled={loading || isBlocking}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => toggleBlock(user)}
                              className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold text-white hover:shadow-md transition-all disabled:opacity-50 ${
                                user.isBlocked 
                                  ? "bg-green-600 hover:bg-green-700" 
                                  : "bg-red-600 hover:bg-red-700"
                              }`}
                              disabled={loading || isBlocking}
                            >
                              {user.isBlocked ? "Unblock" : "Block"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Back Button */}
        <div className="mt-6 flex justify-center">
          <Link
            href="/dashboard/admin"
            className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl text-white font-bold text-sm sm:text-base hover:shadow-lg transition-all"
            style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Loading Overlay */}
      {(loading || isBlocking) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div 
            className="rounded-xl sm:rounded-2xl p-4 sm:p-6 flex items-center gap-3 shadow-2xl max-w-sm w-full"
            style={{
              background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
            }}
          >
            <div className="w-5 h-5 sm:w-6 sm:h-6 border-3 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0"></div>
            <span className="text-white font-bold text-sm sm:text-base">
              {isBlocking ? "Updating user status..." : "Loading..."}
            </span>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div 
            className="bg-white rounded-xl sm:rounded-2xl border-2 p-4 sm:p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto"
            style={{ borderColor: "rgba(5,163,199,0.2)" }}
          >
            <h2 
              className="text-xl sm:text-2xl font-black mb-4"
              style={{
                background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Edit User
            </h2>
            
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#1A1F29] mb-2">Name</label>
                <input
                  type="text"
                  required
                  className="w-full rounded-xl border-2 bg-white px-3 sm:px-4 py-2.5 sm:py-3 outline-none focus:ring-4 focus:ring-[#05A3C7]/20 text-[#1A1F29] font-medium text-sm sm:text-base"
                  style={{ borderColor: "rgba(5,163,199,0.3)" }}
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[#1A1F29] mb-2">Email</label>
                <input
                  type="email"
                  disabled
                  className="w-full rounded-xl border-2 bg-gray-100 px-3 sm:px-4 py-2.5 sm:py-3 outline-none text-[#5A6C7D] font-medium text-sm sm:text-base cursor-not-allowed"
                  style={{ borderColor: "rgba(5,163,199,0.3)" }}
                  value={editForm.email}
                />
                <p className="text-xs text-[#5A6C7D] mt-1">Email cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#1A1F29] mb-2">Role</label>
                <select
                  required
                  className="w-full rounded-xl border-2 bg-white px-3 sm:px-4 py-2.5 sm:py-3 outline-none focus:ring-4 focus:ring-[#05A3C7]/20 text-[#1A1F29] font-medium text-sm sm:text-base"
                  style={{ borderColor: "rgba(5,163,199,0.3)" }}
                  value={editForm.role}
                  onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                >
                  <option value="user">User</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isBlocked"
                  className="w-4 h-4 rounded border-2"
                  style={{ borderColor: "rgba(5,163,199,0.3)" }}
                  checked={editForm.isBlocked}
                  onChange={e => setEditForm({ ...editForm, isBlocked: e.target.checked })}
                />
                <label htmlFor="isBlocked" className="text-sm font-bold text-[#1A1F29]">
                  Block this user
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 px-4 py-2.5 rounded-xl border-2 text-[#1A1F29] font-bold text-sm sm:text-base hover:bg-gray-50 transition-all"
                  style={{ borderColor: "rgba(5,163,199,0.3)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-xl text-white font-bold text-sm sm:text-base hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                >
                  {loading ? "Updating..." : "Update User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

