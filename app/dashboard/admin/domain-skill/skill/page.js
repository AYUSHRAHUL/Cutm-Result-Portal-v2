"use client";
import { appendSchoolParams } from "@/lib/api-helper";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function SkillRegistrationPage() {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [search, setSearch] = useState("");

    // Add Course modal state
    const [addModal, setAddModal] = useState(false);
    const [addForm, setAddForm] = useState({
        SubjectCode: "",
        SubjectName: "",
        Credits: "",
        Type: "Skill"
    });

    // Edit Course modal state
    const [editModal, setEditModal] = useState({ show: false, item: null });
    const [editForm, setEditForm] = useState({
        SubjectCode: "",
        SubjectName: "",
        Credits: "",
        Type: "Skill"
    });

    async function fetchData() {
        setError("");
        try {
            setLoading(true);
            const qs = new URLSearchParams({ search, limit: "0" }).toString();
            const res = await fetch(`/api/skill/course?${qs}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to load");
            setCourses(data.items || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchData();
    }, [search]);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        setError("");
        setSuccess("");
        setLoading(true);

        try {
            const url = appendSchoolParams("/api/skill/course/upload");
            const res = await fetch(url, {
                method: "POST",
                body: formData
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Upload failed");

            setSuccess(data.message || "File uploaded successfully!");
            fetchData();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            // Reset input
            e.target.value = null;
        }
    };

    // Handlers
    const handleAdd = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        try {
            const url = appendSchoolParams("/api/skill/course");
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(addForm)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Add failed");

            setSuccess("Skill course added successfully!");
            setAddModal(false);
            setAddForm({ SubjectCode: "", SubjectName: "", Credits: "", Type: "Skill" });
            fetchData();
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleEdit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        try {
            const res = await fetch(`/api/skill/course/${editModal.item._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editForm)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Update failed");

            setSuccess("Course updated successfully!");
            setEditModal({ show: false, item: null });
            fetchData();
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this course?")) return;
        setError("");
        try {
            const res = await fetch(`/api/skill/course/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Delete failed");

            setSuccess("Course deleted!");
            fetchData();
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            setError(err.message);
        }
    };

    const openEditModal = (item) => {
        setEditForm({
            SubjectCode: item.SubjectCode,
            SubjectName: item.SubjectName,
            Credits: item.Credits,
            Type: item.Type || "Skill",
            Category: item.Category || ""
        });
        setEditModal({ show: true, item });
    };

    return (
        <div
            className="min-h-screen pb-10"
            style={{
                background: "linear-gradient(to bottom, #FFF7ED 0%, #FFEDD5 50%, #FED7AA 100%)",
            }}
        >
            <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 pt-6 sm:pt-8 lg:pt-12">
                {/* Header */}
                <div className="mb-6 sm:mb-8 text-center">
                    <h2
                        className="text-2xl sm:text-3xl md:text-4xl font-black mb-2"
                        style={{
                            background: "linear-gradient(135deg, #EA580C 0%, #C2410C 50%, #9A3412 100%)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            backgroundClip: "text",
                        }}
                    >
                        ⚡ Skill Course Registration
                    </h2>
                    <p className="text-[#9A3412] text-sm sm:text-base font-medium">
                        Manage skill development courses
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
                    style={{ borderColor: "rgba(249,115,22,0.2)", background: "white" }}
                >
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="flex-1 w-full sm:w-auto">
                            <label className="block text-sm font-bold text-[#1A1F29] mb-2">Search:</label>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search skill courses..."
                                className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#F97316]/20 outline-none text-sm"
                                style={{ borderColor: "rgba(249,115,22,0.3)" }}
                            />
                        </div>
                        <div className="flex gap-2">
                            <label
                                className="px-4 py-2 rounded-lg text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95 cursor-pointer flex items-center gap-2"
                                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
                            >
                                <span>📂 Import Excel</span>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                            </label>
                            <button
                                onClick={() => setAddModal(true)}
                                className="px-4 py-2 rounded-lg text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95"
                                style={{ background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)" }}
                            >
                                ➕ Add Skill Course
                            </button>
                        </div>
                    </div>
                </div>

                {/* Courses List */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="flex items-center justify-center gap-2">
                            <div className="w-5 h-5 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-[#7C2D12]">Loading...</span>
                        </div>
                    </div>
                ) : courses.length === 0 ? (
                    <div
                        className="rounded-xl border-2 p-8 text-center"
                        style={{ borderColor: "rgba(249,115,22,0.2)", background: "white" }}
                    >
                        <p className="text-[#7C2D12]">No skill courses found. Add your first course!</p>
                    </div>
                ) : (
                    <div
                        className="rounded-xl border-2 overflow-hidden shadow-sm"
                        style={{ borderColor: "rgba(249,115,22,0.2)", background: "white" }}
                    >
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr
                                        className="text-white"
                                        style={{ background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)" }}
                                    >
                                        <th className="px-4 py-3 text-left">Course Code</th>
                                        <th className="px-4 py-3 text-left">Course Name</th>
                                        <th className="px-4 py-3 text-left">Credits</th>
                                        <th className="px-4 py-3 text-left">Category</th>
                                        <th className="px-4 py-3 text-left">Type</th>
                                        <th className="px-4 py-3 text-left">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {courses.map((course) => (
                                        <tr
                                            key={course._id}
                                            className="border-b hover:bg-[#FFF7ED]"
                                            style={{ borderColor: "rgba(249,115,22,0.1)" }}
                                        >
                                            <td className="px-4 py-3 font-bold text-[#EA580C]">
                                                {course.SubjectCode}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-[#1A1F29]">
                                                {course.SubjectName}
                                            </td>
                                            <td className="px-4 py-3 text-[#5A6C7D]">{course.Credits}</td>
                                            <td className="px-4 py-3 text-[#5A6C7D]">{course.Category || "-"}</td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                                    {course.Type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => openEditModal(course)}
                                                        className="px-3 py-1 rounded-lg text-white text-xs font-bold transition-all hover:shadow-lg"
                                                        style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(course._id)}
                                                        className="px-3 py-1 rounded-lg text-white text-xs font-bold transition-all hover:shadow-lg"
                                                        style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Back Button */}
                <div className="text-center mt-6">
                    <Link
                        href="/dashboard/admin/domain-skill"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95"
                        style={{ background: "linear-gradient(135deg, #7C2D12, #431407)" }}
                    >
                        ← Back to Domain & Skill Selection
                    </Link>
                </div>

                {/* Add Modal */}
                {addModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                            <h3 className="text-xl font-black text-[#1A1F29] mb-4">Add Skill Course</h3>
                            <form onSubmit={handleAdd}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-[#1A1F29] mb-2">Subject Code:</label>
                                        <input
                                            type="text"
                                            value={addForm.SubjectCode}
                                            onChange={(e) => setAddForm({ ...addForm, SubjectCode: e.target.value })}
                                            placeholder="e.g. SKILL101"
                                            className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#F97316]/20 outline-none text-sm"
                                            style={{ borderColor: "rgba(249,115,22,0.3)" }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-[#1A1F29] mb-2">Subject Name:</label>
                                        <input
                                            type="text"
                                            value={addForm.SubjectName}
                                            onChange={(e) => setAddForm({ ...addForm, SubjectName: e.target.value })}
                                            placeholder="e.g. Advanced Python Programming"
                                            className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#F97316]/20 outline-none text-sm"
                                            style={{ borderColor: "rgba(249,115,22,0.3)" }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-[#1A1F29] mb-2">Credits:</label>
                                        <input
                                            type="text"
                                            value={addForm.Credits}
                                            onChange={(e) => setAddForm({ ...addForm, Credits: e.target.value })}
                                            placeholder="e.g. 4"
                                            className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#F97316]/20 outline-none text-sm"
                                            style={{ borderColor: "rgba(249,115,22,0.3)" }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-[#1A1F29] mb-2">Category:</label>
                                        <select
                                            value={addForm.Category || ""}
                                            onChange={(e) => setAddForm({ ...addForm, Category: e.target.value })}
                                            className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#F97316]/20 outline-none text-sm"
                                            style={{ borderColor: "rgba(249,115,22,0.3)" }}
                                            required
                                        >
                                            <option value="">Select Category</option>
                                            <option value="I">I</option>
                                            <option value="II">II</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setAddModal(false)}
                                        className="flex-1 px-4 py-2 border-2 rounded-lg font-bold transition-all text-[#7C2D12]"
                                        style={{ borderColor: "rgba(249,115,22,0.3)" }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 rounded-lg text-white font-bold transition-all hover:shadow-lg"
                                        style={{ background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)" }}
                                    >
                                        Add Course
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {editModal.show && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                            <h3 className="text-xl font-black text-[#1A1F29] mb-4">Edit Skill Course</h3>
                            <form onSubmit={handleEdit}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-[#1A1F29] mb-2">Subject Code:</label>
                                        <input
                                            type="text"
                                            value={editForm.SubjectCode}
                                            onChange={(e) => setEditForm({ ...editForm, SubjectCode: e.target.value })}
                                            className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#F97316]/20 outline-none text-sm"
                                            style={{ borderColor: "rgba(249,115,22,0.3)" }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-[#1A1F29] mb-2">Subject Name:</label>
                                        <input
                                            type="text"
                                            value={editForm.SubjectName}
                                            onChange={(e) => setEditForm({ ...editForm, SubjectName: e.target.value })}
                                            className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#F97316]/20 outline-none text-sm"
                                            style={{ borderColor: "rgba(249,115,22,0.3)" }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-[#1A1F29] mb-2">Credits:</label>
                                        <input
                                            type="text"
                                            value={editForm.Credits}
                                            onChange={(e) => setEditForm({ ...editForm, Credits: e.target.value })}
                                            className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#F97316]/20 outline-none text-sm"
                                            style={{ borderColor: "rgba(249,115,22,0.3)" }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-[#1A1F29] mb-2">Category:</label>
                                        <select
                                            value={editForm.Category || ""}
                                            onChange={(e) => setEditForm({ ...editForm, Category: e.target.value })}
                                            className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#F97316]/20 outline-none text-sm"
                                            style={{ borderColor: "rgba(249,115,22,0.3)" }}
                                            required
                                        >
                                            <option value="">Select Category</option>
                                            <option value="I">I</option>
                                            <option value="II">II</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setEditModal({ show: false, item: null })}
                                        className="flex-1 px-4 py-2 border-2 rounded-lg font-bold transition-all text-[#7C2D12]"
                                        style={{ borderColor: "rgba(249,115,22,0.3)" }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2 rounded-lg text-white font-bold transition-all hover:shadow-lg"
                                        style={{ background: "linear-gradient(135deg, #F97316 0%, #EA580C 100%)" }}
                                    >
                                        Update Course
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
