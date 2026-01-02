"use client";
import { appendSchoolParams } from "@/lib/api-helper";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function DomainRegistrationPage() {
    const [domains, setDomains] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [search, setSearch] = useState("");
    const [expandedDomains, setExpandedDomains] = useState(new Set());

    // Add Domain modal state
    const [addDomainModal, setAddDomainModal] = useState(false);
    const [addDomainForm, setAddDomainForm] = useState({
        DomainName: "",
        DomainSubjectCode: "",
        Credits: ""
    });

    // Add Subject modal state
    const [addSubjectModal, setAddSubjectModal] = useState(false);
    const [selectedDomain, setSelectedDomain] = useState(null);
    const [addSubjectForm, setAddSubjectForm] = useState({
        SubjectCode: "",
        SubjectName: "",
        Credits: ""
    });

    // Edit Domain modal state
    const [editDomainModal, setEditDomainModal] = useState({ show: false, item: null });
    const [editDomainForm, setEditDomainForm] = useState({
        DomainName: "",
        DomainSubjectCode: "",
        Credits: ""
    });

    // Edit Subject modal state
    const [editSubjectModal, setEditSubjectModal] = useState({ show: false, item: null });
    const [editSubjectForm, setEditSubjectForm] = useState({
        SubjectCode: "",
        SubjectName: "",
        Credits: ""
    });

    async function fetchData() {
        setError("");
        try {
            setLoading(true);
            const qs = new URLSearchParams({
                search,
                limit: "0"
            }).toString();
            const res = await fetch(`/api/honours/domain?${qs}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to load");

            const allItems = data.items || [];

            // Separate domains and subjects
            // Domain is identified by: SubjectName matches Domain name (when domain is added, SubjectName = DomainName)
            const domainMap = new Map();
            const subjectList = [];

            allItems.forEach(item => {
                const domainName = item.Domain || "";
                const subjectName = item.Subject_Name || "";

                // If SubjectName matches Domain name, it's a domain header
                // This happens when we add a domain - we set SubjectName = DomainName
                if (domainName && subjectName && domainName === subjectName) {
                    domainMap.set(item.Domain, {
                        _id: item._id,
                        Domain: item.Domain,
                        DomainSubjectCode: item["Subject Code"] || item.SubjectCode || "",
                        DomainSubjectName: item.Subject_Name || "",
                        Credits: item.Credits || "",
                        Type: item.Type || ""
                    });
                } else {
                    subjectList.push(item);
                }
            });

            setDomains(Array.from(domainMap.values()));
            setSubjects(subjectList);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchData();
    }, [search]);

    const toggleDomain = (domainName) => {
        const newSet = new Set(expandedDomains);
        if (newSet.has(domainName)) {
            newSet.delete(domainName);
        } else {
            newSet.add(domainName);
        }
        setExpandedDomains(newSet);
    };

    const openAddDomainModal = () => {
        setAddDomainForm({ DomainName: "", DomainSubjectCode: "", Credits: "" });
        setAddDomainModal(true);
    };

    const openAddSubjectModal = (domain) => {
        setSelectedDomain(domain);
        setAddSubjectForm({ SubjectCode: "", SubjectName: "", Credits: "" });
        setAddSubjectModal(true);
    };

    const openEditDomainModal = (domain) => {
        setEditDomainForm({
            DomainName: domain.Domain,
            DomainSubjectCode: domain.DomainSubjectCode,
            Credits: domain.Credits
        });
        setEditDomainModal({ show: true, item: domain });
    };

    const openEditSubjectModal = (subject) => {
        setEditSubjectForm({
            SubjectCode: subject["Subject Code"] || subject.SubjectCode || "",
            SubjectName: subject.Subject_Name || "",
            Credits: subject.Credits || "",
        });
        setEditSubjectModal({ show: true, item: subject });
    };

    const [addingDomain, setAddingDomain] = useState(false);

    const handleAddDomain = async (e) => {
        e.preventDefault();
        if (addingDomain) return; // Prevent double submission

        setError("");
        setSuccess("");
        setAddingDomain(true);

        try {
            const url = appendSchoolParams("/api/honours/domain");
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    Domain: addDomainForm.DomainName,
                    SubjectCode: addDomainForm.DomainSubjectCode,
                    SubjectName: addDomainForm.DomainName,
                    Credits: addDomainForm.Credits
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Add failed");
            setSuccess("Domain added successfully!");
            setAddDomainModal(false);
            setAddDomainForm({ DomainName: "", DomainSubjectCode: "", Credits: "" });
            fetchData();
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setAddingDomain(false);
        }
    };

    const [addingSubject, setAddingSubject] = useState(false);

    const handleAddSubject = async (e) => {
        e.preventDefault();
        if (addingSubject) return; // Prevent double submission

        setError("");
        setSuccess("");
        setAddingSubject(true);

        try {
            const url = appendSchoolParams("/api/honours/domain");
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    Domain: selectedDomain.Domain,
                    SubjectCode: addSubjectForm.SubjectCode,
                    SubjectName: addSubjectForm.SubjectName,
                    Credits: addSubjectForm.Credits,
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Add failed");
            setSuccess("Subject added successfully!");
            setAddSubjectModal(false);
            setSelectedDomain(null);
            setAddSubjectForm({ SubjectCode: "", SubjectName: "", Credits: "" });
            fetchData();
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            setError(err.message);
        } finally {
            setAddingSubject(false);
        }
    };

    const handleEditDomain = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        try {
            const res = await fetch(`/api/honours/domain/${editDomainModal.item._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    Domain: editDomainForm.DomainName,
                    SubjectCode: editDomainForm.DomainSubjectCode,
                    SubjectName: editDomainForm.DomainName,
                    Credits: editDomainForm.Credits
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Update failed");
            setSuccess("Domain updated successfully!");
            setEditDomainModal({ show: false, item: null });
            fetchData();
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleEditSubject = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        try {
            const res = await fetch(`/api/honours/domain/${editSubjectModal.item._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    Domain: editSubjectModal.item.Domain,
                    SubjectCode: editSubjectForm.SubjectCode,
                    SubjectName: editSubjectForm.SubjectName,
                    Credits: editSubjectForm.Credits,
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Update failed");
            setSuccess("Subject updated successfully!");
            setEditSubjectModal({ show: false, item: null });
            fetchData();
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            setError(err.message);
        }
    };

    const removeDomain = async (id) => {
        if (!confirm("Delete this domain and all its subjects?")) return;
        setError("");
        try {
            const res = await fetch(`/api/honours/domain/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Delete failed");
            fetchData();
            setSuccess("Domain deleted!");
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            setError(err.message);
        }
    };

    const removeSubject = async (id) => {
        if (!confirm("Delete this subject?")) return;
        setError("");
        try {
            const res = await fetch(`/api/honours/domain/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Delete failed");
            fetchData();
            setSuccess("Subject deleted!");
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            setError(err.message);
        }
    };

    // Group subjects by domain
    const subjectsByDomain = {};
    subjects.forEach(subject => {
        const domain = subject.Domain || "";
        if (!subjectsByDomain[domain]) {
            subjectsByDomain[domain] = [];
        }
        subjectsByDomain[domain].push(subject);
    });

    return (
        <div
            className="min-h-screen pb-10"
            style={{
                background: "linear-gradient(to bottom, #F5F8FA 0%, #E8F4F8 50%, #D1E9F6 100%)",
            }}
        >
            <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 pt-6 sm:pt-8 lg:pt-12">
                {/* Header */}
                <div className="mb-6 sm:mb-8 text-center">
                    <h2
                        className="text-2xl sm:text-3xl md:text-4xl font-black mb-2"
                        style={{
                            background: "linear-gradient(135deg, #05A3C7 0%, #04748F 50%, #023945 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            backgroundClip: "text",
                        }}
                    >
                        🌐 Domain Registration
                    </h2>
                    <p className="text-[#5A6C7D] text-sm sm:text-base font-medium">
                        Manage domains and their subjects
                    </p>
                </div>

                {/* Messages */}
                {error && (
                    <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm whitespace-pre-line">
                        ⚠️ {error}
                    </div>
                )}
                {success && (
                    <div className="mb-4 p-4 bg-green-50 border-2 border-green-200 rounded-xl text-green-700 text-sm">
                        ✅ {success}
                    </div>
                )}

                {/* Actions Bar */}
                <div
                    className="rounded-xl border-2 p-4 sm:p-6 mb-6"
                    style={{ borderColor: "rgba(5,163,199,0.2)", background: "white" }}
                >
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="flex-1 w-full sm:w-auto">
                            <label className="block text-sm font-bold text-[#1A1F29] mb-2">Search:</label>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search domains or subjects..."
                                className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-sm"
                                style={{ borderColor: "rgba(5,163,199,0.3)" }}
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={openAddDomainModal}
                                className="px-4 py-2 rounded-lg text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95"
                                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
                            >
                                ➕ Add Domain
                            </button>
                        </div>
                    </div>
                </div>

                {/* Domains List */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="flex items-center justify-center gap-2">
                            <div className="w-5 h-5 border-2 border-[#05A3C7] border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-[#5A6C7D]">Loading...</span>
                        </div>
                    </div>
                ) : domains.length === 0 ? (
                    <div
                        className="rounded-xl border-2 p-8 text-center"
                        style={{ borderColor: "rgba(5,163,199,0.2)", background: "white" }}
                    >
                        <p className="text-[#5A6C7D]">No domains found. Add your first domain!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {domains.map(domain => {
                            const domainSubjects = subjectsByDomain[domain.Domain] || [];
                            const isExpanded = expandedDomains.has(domain.Domain);

                            return (
                                <div
                                    key={domain._id}
                                    className="rounded-xl border-2 overflow-hidden"
                                    style={{ borderColor: "rgba(5,163,199,0.2)", background: "white" }}
                                >
                                    {/* Domain Header */}
                                    <div
                                        className="p-4 cursor-pointer hover:bg-[#05A3C7]/5 transition-colors"
                                        onClick={() => toggleDomain(domain.Domain)}
                                        style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                                    >
                                        <div className="flex items-center justify-between text-white">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl">{isExpanded ? "▼" : "▶"}</span>
                                                <div>
                                                    <div className="font-black text-lg">{domain.Domain}</div>
                                                    <div className="text-sm opacity-90">
                                                        Code: <span className="font-bold">{domain.DomainSubjectCode}</span> |
                                                        Credits: <span className="font-bold">{domain.Credits}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => openAddSubjectModal(domain)}
                                                    className="px-3 py-1 rounded-lg text-white text-xs font-bold transition-all hover:shadow-lg"
                                                    style={{ background: "rgba(255,255,255,0.2)" }}
                                                >
                                                    ➕ Add Subject
                                                </button>
                                                <button
                                                    onClick={() => openEditDomainModal(domain)}
                                                    className="px-3 py-1 rounded-lg text-white text-xs font-bold transition-all hover:shadow-lg"
                                                    style={{ background: "rgba(255,255,255,0.2)" }}
                                                >
                                                    ✏️ Edit
                                                </button>
                                                <button
                                                    onClick={() => removeDomain(domain._id)}
                                                    className="px-3 py-1 rounded-lg text-white text-xs font-bold transition-all hover:shadow-lg"
                                                    style={{ background: "rgba(239,68,68,0.8)" }}
                                                >
                                                    🗑️ Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Domain Subjects */}
                                    {isExpanded && (
                                        <div className="p-4">
                                            {domainSubjects.length === 0 ? (
                                                <p className="text-center text-[#5A6C7D] py-4">No subjects in this domain yet.</p>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr
                                                                className="text-white"
                                                                style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                                                            >
                                                                <th className="px-4 py-2 text-left">Subject Code</th>
                                                                <th className="px-4 py-2 text-left">Subject Name</th>
                                                                <th className="px-4 py-2 text-left">Credits</th>
                                                                <th className="px-4 py-2 text-left">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {domainSubjects.map(subject => {
                                                                const id = String(subject._id);
                                                                return (
                                                                    <tr
                                                                        key={id}
                                                                        className="border-b hover:bg-[#05A3C7]/5"
                                                                        style={{ borderColor: "rgba(5,163,199,0.1)" }}
                                                                    >
                                                                        <td className="px-4 py-3 font-bold" style={{ color: "#05A3C7" }}>
                                                                            {subject["Subject Code"] || subject.SubjectCode || ""}
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                            {subject.Subject_Name || ""}
                                                                        </td>
                                                                        <td className="px-4 py-3">{subject.Credits || ""}</td>
                                                                        <td className="px-4 py-3">
                                                                            <button
                                                                                onClick={() => openEditSubjectModal(subject)}
                                                                                className="px-3 py-1 rounded-lg text-white text-xs font-bold mr-2 transition-all hover:shadow-lg"
                                                                                style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
                                                                            >
                                                                                Edit
                                                                            </button>
                                                                            <button
                                                                                onClick={() => removeSubject(id)}
                                                                                className="px-3 py-1 rounded-lg text-white text-xs font-bold transition-all hover:shadow-lg"
                                                                                style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
                                                                            >
                                                                                Delete
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Back Button */}
                <div className="text-center mt-6">
                    <Link
                        href="/dashboard/admin/domain-skill"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95"
                        style={{ background: "linear-gradient(135deg, #6b7280, #4b5563)" }}
                    >
                        ← Back to Domain & Skill Selection
                    </Link>
                </div>

                {/* Add Domain Modal */}
                {addDomainModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                            <h3 className="text-xl font-black text-[#1A1F29] mb-4">Add Domain</h3>
                            <form onSubmit={handleAddDomain}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-[#1A1F29] mb-2">Domain Name:</label>
                                        <input
                                            type="text"
                                            value={addDomainForm.DomainName}
                                            onChange={(e) => setAddDomainForm({ ...addDomainForm, DomainName: e.target.value })}
                                            placeholder="e.g., Embedded System Design"
                                            className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-sm"
                                            style={{ borderColor: "rgba(5,163,199,0.3)" }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-[#1A1F29] mb-2">Domain Subject Code:</label>
                                        <input
                                            type="text"
                                            value={addDomainForm.DomainSubjectCode}
                                            onChange={(e) => setAddDomainForm({ ...addDomainForm, DomainSubjectCode: e.target.value })}
                                            placeholder="e.g., ESCU2050"
                                            className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-sm"
                                            style={{ borderColor: "rgba(5,163,199,0.3)" }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-[#1A1F29] mb-2">Credits:</label>
                                        <input
                                            type="text"
                                            value={addDomainForm.Credits}
                                            onChange={(e) => setAddDomainForm({ ...addDomainForm, Credits: e.target.value })}
                                            placeholder="e.g., 20 or 4+10+6"
                                            className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-sm"
                                            style={{ borderColor: "rgba(5,163,199,0.3)" }}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setAddDomainModal(false)}
                                        className="flex-1 px-4 py-2 border-2 rounded-lg font-bold transition-all"
                                        style={{ borderColor: "rgba(5,163,199,0.3)" }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={addingDomain}
                                        className="flex-1 px-4 py-2 rounded-lg text-white font-bold transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                        style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                                    >
                                        {addingDomain ? "Adding..." : "Add Domain"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Add Subject Modal */}
                {addSubjectModal && selectedDomain && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                            <h3 className="text-xl font-black text-[#1A1F29] mb-4">
                                Add Subject to: {selectedDomain.Domain}
                            </h3>
                            <form onSubmit={handleAddSubject}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-[#1A1F29] mb-2">Subject Code:</label>
                                        <input
                                            type="text"
                                            value={addSubjectForm.SubjectCode}
                                            onChange={(e) => setAddSubjectForm({ ...addSubjectForm, SubjectCode: e.target.value })}
                                            placeholder="e.g., CUES2050"
                                            className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-sm"
                                            style={{ borderColor: "rgba(5,163,199,0.3)" }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-[#1A1F29] mb-2">Subject Name:</label>
                                        <input
                                            type="text"
                                            value={addSubjectForm.SubjectName}
                                            onChange={(e) => setAddSubjectForm({ ...addSubjectForm, SubjectName: e.target.value })}
                                            placeholder="e.g., Micro-Controller Based Embedded System Design"
                                            className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-sm"
                                            style={{ borderColor: "rgba(5,163,199,0.3)" }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-[#1A1F29] mb-2">Credits:</label>
                                        <input
                                            type="text"
                                            value={addSubjectForm.Credits}
                                            onChange={(e) => setAddSubjectForm({ ...addSubjectForm, Credits: e.target.value })}
                                            placeholder="e.g., 4 or 4+10+6"
                                            className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-sm"
                                            style={{ borderColor: "rgba(5,163,199,0.3)" }}
                                            required
                                        />
                                        <p className="mt-1 text-xs text-[#5A6C7D]">Enter credits as number or sum format (e.g., 4 or 4+10+6)</p>
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAddSubjectModal(false);
                                            setSelectedDomain(null);
                                        }}
                                        className="flex-1 px-4 py-2 border-2 rounded-lg font-bold transition-all"
                                        style={{ borderColor: "rgba(5,163,199,0.3)" }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={addingSubject}
                                        className="flex-1 px-4 py-2 rounded-lg text-white font-bold transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                        style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                                    >
                                        {addingSubject ? "Adding..." : "Add Subject"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit Domain Modal */}
                {editDomainModal.show && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                            <h3 className="text-xl font-black text-[#1A1F29] mb-4">Edit Domain</h3>
                            <form onSubmit={handleEditDomain}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-[#1A1F29] mb-2">Domain Name:</label>
                                        <input
                                            type="text"
                                            value={editDomainForm.DomainName}
                                            onChange={(e) => setEditDomainForm({ ...editDomainForm, DomainName: e.target.value })}
                                            className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-sm"
                                            style={{ borderColor: "rgba(5,163,199,0.3)" }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-[#1A1F29] mb-2">Domain Subject Code:</label>
                                        <input
                                            type="text"
                                            value={editDomainForm.DomainSubjectCode}
                                            onChange={(e) => setEditDomainForm({ ...editDomainForm, DomainSubjectCode: e.target.value })}
                                            className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-sm"
                                            style={{ borderColor: "rgba(5,163,199,0.3)" }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-[#1A1F29] mb-2">Credits:</label>
                                        <input
                                            type="text"
                                            value={editDomainForm.Credits}
                                            onChange={(e) => setEditDomainForm({ ...editDomainForm, Credits: e.target.value })}
                                            className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-sm"
                                            style={{ borderColor: "rgba(5,163,199,0.3)" }}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setEditDomainModal({ show: false, item: null })}
                                        className="flex-1 px-4 py-2 border-2 rounded-lg font-bold transition-all"
                                        style={{ borderColor: "rgba(5,163,199,0.3)" }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 rounded-lg text-white font-bold transition-all hover:shadow-lg"
                                        style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                                    >
                                        Update Domain
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit Subject Modal */}
                {editSubjectModal.show && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                            <h3 className="text-xl font-black text-[#1A1F29] mb-4">Edit Subject</h3>
                            <form onSubmit={handleEditSubject}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-[#1A1F29] mb-2">Subject Code:</label>
                                        <input
                                            type="text"
                                            value={editSubjectForm.SubjectCode}
                                            onChange={(e) => setEditSubjectForm({ ...editSubjectForm, SubjectCode: e.target.value })}
                                            className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-sm"
                                            style={{ borderColor: "rgba(5,163,199,0.3)" }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-[#1A1F29] mb-2">Subject Name:</label>
                                        <input
                                            type="text"
                                            value={editSubjectForm.SubjectName}
                                            onChange={(e) => setEditSubjectForm({ ...editSubjectForm, SubjectName: e.target.value })}
                                            className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-sm"
                                            style={{ borderColor: "rgba(5,163,199,0.3)" }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-[#1A1F29] mb-2">Credits:</label>
                                        <input
                                            type="text"
                                            value={editSubjectForm.Credits}
                                            onChange={(e) => setEditSubjectForm({ ...editSubjectForm, Credits: e.target.value })}
                                            className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-sm"
                                            style={{ borderColor: "rgba(5,163,199,0.3)" }}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setEditSubjectModal({ show: false, item: null })}
                                        className="flex-1 px-4 py-2 border-2 rounded-lg font-bold transition-all"
                                        style={{ borderColor: "rgba(5,163,199,0.3)" }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 rounded-lg text-white font-bold transition-all hover:shadow-lg"
                                        style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                                    >
                                        Update Subject
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
