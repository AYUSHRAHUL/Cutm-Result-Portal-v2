
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

export default function UnifiedAnalytics() {
    const router = useRouter();
    
    // Initialize from URL params or default to "All"
    const [category, setCategory] = useState("All");
    const [branch, setBranch] = useState("All");
    const [batch, setBatch] = useState("All");
    const [sem, setSem] = useState("All");
    const [isInitialized, setIsInitialized] = useState(false);

    const categories = ["All", "Basket I", "Basket II", "Basket III", "Basket IV", "Basket V", "Skill", "Domain"];
    const branches = ["All", "CSE", "ECE", "EEE", "Mechanical", "Civil", "AIML"];
    const batches = ["All", "2021", "2022", "2023", "2024", "2025"];
    const semesters = ["All", "1", "2", "3", "4", "5", "6", "7", "8"];

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalStudents: 0,
        totalItems: 0
    });

    // Expanded view for specific item
    const [expandedItem, setExpandedItem] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/analytics/unified?category=${encodeURIComponent(category)}&branch=${branch}&batch=${batch}&sem=${sem}`);
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            setItems(data.items || []);
            setStats({
                totalStudents: data.totalStudents || 0,
                totalItems: (data.items || []).length
            });
            setExpandedItem(null); // Collapse all on refetch
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Initialize filters from URL params on mount (client-side only)
    useEffect(() => {
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        const urlCategory = params.get("category") || "All";
        const urlBranch = params.get("branch") || "All";
        const urlBatch = params.get("batch") || "All";
        const urlSem = params.get("sem") || "All";
        
        setCategory(urlCategory);
        setBranch(urlBranch);
        setBatch(urlBatch);
        setSem(urlSem);
        setIsInitialized(true);
    }, []); // Only run on mount

    // Sync filter changes to URL
    useEffect(() => {
        if (!isInitialized) return;
        
        const params = new URLSearchParams();
        if (category !== "All") params.append("category", category);
        if (branch !== "All") params.append("branch", branch);
        if (batch !== "All") params.append("batch", batch);
        if (sem !== "All") params.append("sem", sem);
        
        const queryString = params.toString();
        router.push(`?${queryString}`, { shallow: true });
    }, [category, branch, batch, sem, isInitialized, router]);

    // Fetch data when filters change
    useEffect(() => {
        if (!isInitialized) return;
        fetchData();
    }, [category, branch, batch, sem, isInitialized]);

    const downloadDetailedExcel = () => {
        if (!items.length) return;

        // Determine column names based on category
        const nameColumn = category === "Domain" ? "Domain Name" : "Subject Name";
        const codeColumn = category === "Domain" ? "Domain Code" : "Subject Code";

        // Flatten for Excel
        let dump = [];
        items.forEach(item => {
            item.Students.forEach(stu => {
                const row = {
                    "Category": category,
                    [nameColumn]: item.Name,
                    "Type": item.Type,
                    "Reg No": stu.Reg_No,
                    "Name": stu.Name,
                    "Branch": stu.Branch,
                    "Batch": stu.Batch
                };
                // Only add code column if code exists or not domain
                if (category !== "Domain" || item.Code) {
                    row[codeColumn] = item.Code || "-";
                }
                // Add Credits if available
                row["Credits"] = item.Credits || item.Credits === 0 ? item.Credits : "-";
                dump.push(row);
            });
        });

        const worksheet = XLSX.utils.json_to_sheet(dump);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Detailed Data");
        XLSX.writeFile(workbook, `Detailed_Analytics_${category.replace(/ /g, '_')}_${batch}.xlsx`);
    };

    const downloadSummaryExcel = () => {
        if (!items.length) return;

        // Determine column names based on category
        const nameColumn = category === "Domain" ? "Domain Name" : "Subject Name";
        const codeColumn = category === "Domain" ? "Domain Code" : "Subject Code";

        // Summary Data
        let dump = items.map(item => {
            const row = {
                [nameColumn]: item.Name,
                "Type": item.Type,
                "Total Students": item.TotalStudents
            };
            // Only add code column if code exists or not domain
            if (category !== "Domain" || item.Code) {
                row[codeColumn] = item.Code || "-";
            }
            // Add Credits column
            row["Credits"] = item.Credits || item.Credits === 0 ? item.Credits : "-";
            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(dump);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Summary Data");
        XLSX.writeFile(workbook, `Summary_Analytics_${category.replace(/ /g, '_')}_${batch}.xlsx`);
    };

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen font-sans text-slate-900">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
                        📊 Domain, Skill & Basket Report
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm font-medium">
                        Analyze student registrations by Basket, Skill, or Domain
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={downloadSummaryExcel}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg shadow-sm hover:shadow transition-all font-semibold text-sm"
                    >
                        <span>📊</span> Export Report
                    </button>
                    <button
                        onClick={downloadDetailedExcel}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-sm hover:shadow transition-all font-semibold text-sm"
                    >
                        <span>📥</span> Export Detailed Report
                    </button>
                    <button
                        onClick={() => router.back()}
                        className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold text-sm transition-colors shadow-sm"
                    >
                        Back
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Category</label>
                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white font-medium text-slate-700"
                    >
                        {categories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Branch</label>
                    <select
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white font-medium text-slate-700"
                    >
                        {branches.map((b) => (
                            <option key={b} value={b}>{b}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Batch</label>
                    <select
                        value={batch}
                        onChange={(e) => setBatch(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white font-medium text-slate-700"
                    >
                        {batches.map((b) => (
                            <option key={b} value={b}>{b}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Semester</label>
                    <select
                        value={sem}
                        onChange={(e) => setSem(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white font-medium text-slate-700"
                    >
                        {semesters.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-5 text-white shadow-lg shadow-indigo-200">
                    <p className="text-indigo-100 font-semibold text-sm uppercase tracking-wide">Total Students Filtered</p>
                    <h3 className="text-4xl font-black mt-1">{loading ? "..." : stats.totalStudents}</h3>
                </div>
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                    <p className="text-slate-500 font-semibold text-sm uppercase tracking-wide">
                        Active {category === "Domain" ? "Domains" : "Subjects"}
                    </p>
                    <h3 className="text-4xl font-black text-slate-800 mt-1">{loading ? "..." : stats.totalItems}</h3>
                </div>
            </div>

            {/* Items List Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="border-b border-slate-200 px-6 py-4 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800">
                        {category} Enrollment
                    </h3>
                    <span className="text-xs font-medium text-slate-500">
                        {items.length} records found
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                                <th className="p-4 font-bold">{category === "Domain" ? "Domain Name" : "Subject Name"}</th>
                                <th className="p-4 font-bold w-24">Subject Code</th>
                                <th className="p-4 font-bold w-20">Credits</th>
                                <th className="p-4 font-bold w-32">Type</th>
                                <th className="p-4 font-bold text-center w-32">Total Students</th>
                                <th className="p-4 font-bold text-center w-24">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan={category === "Domain" ? "5" : "6"} className="p-8 text-center text-slate-400">Loading data...</td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={category === "Domain" ? "5" : "6"} className="p-8 text-center text-slate-400 font-medium">No records found matching filters.</td>
                                </tr>
                            ) : (
                                items.map((item) => (
                                    <React.Fragment key={item.Code || item.Name}>
                                        <tr className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-4 font-bold text-slate-800 border-l-4 border-transparent group-hover:border-indigo-500 transition-all">
                                                {item.Name}{(sem === "6" || sem === "8") && item.Type === "Domain" ? " (Project)" : ""}
                                            </td>
                                            <td className="p-4 font-mono text-sm text-slate-600">
                                                {item.Code || "-"}
                                            </td>
                                            <td className="p-4 text-slate-600 text-center font-medium">
                                                {item.Credits || item.Credits === 0 ? String(item.Credits) : "-"}
                                            </td>
                                            <td className="p-4 text-slate-500">
                                                {item.Type}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                                                    {item.TotalStudents}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => setExpandedItem(expandedItem === item.Name ? null : item.Name)}
                                                    className="text-indigo-600 hover:text-indigo-800 font-bold text-xs"
                                                >
                                                    {expandedItem === item.Name ? "Hide List" : "View List"}
                                                </button>
                                            </td>
                                        </tr>
                                        {/* Expanded Student List */}
                                        {expandedItem === item.Name && (
                                            <tr>
                                                <td colSpan={category === "Domain" ? "5" : "6"} className="bg-slate-50 p-4 border-b border-slate-200 inset-shadow">
                                                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                                        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 font-bold text-xs text-slate-600 uppercase">
                                                            Students {category === "Domain" ? "Registered in" : "Enrolled in"} {item.Name}
                                                        </div>
                                                        <div className="max-h-64 overflow-y-auto">
                                                            <table className="w-full text-xs">
                                                                <thead className="bg-slate-50 sticky top-0">
                                                                    <tr>
                                                                        <th className="px-4 py-2 text-left border-b">Reg No</th>
                                                                        <th className="px-4 py-2 text-left border-b">Name</th>
                                                                        <th className="px-4 py-2 text-left border-b">Branch</th>
                                                                        <th className="px-4 py-2 text-left border-b">Batch</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-100">
                                                                    {item.Students.map(stu => (
                                                                        <tr key={stu.Reg_No}>
                                                                            <td className="px-4 py-2 font-mono">{stu.Reg_No}</td>
                                                                            <td className="px-4 py-2">{stu.Name}</td>
                                                                            <td className="px-4 py-2">{stu.Branch}</td>
                                                                            <td className="px-4 py-2">{stu.Batch}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
