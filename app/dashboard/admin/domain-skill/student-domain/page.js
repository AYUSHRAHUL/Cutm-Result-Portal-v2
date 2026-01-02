"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

export default function StudentDomainAnalytics() {
    const router = useRouter();
    const [branch, setBranch] = useState("All");
    const [batch, setBatch] = useState("All");
    const [sem, setSem] = useState("All");

    const branches = ["All", "CSE", "ECE", "EEE", "Mechanical", "Civil", "AIML"];
    const batches = ["All", "2021", "2022", "2023", "2024", "2025"];
    const semesters = ["All", "1", "2", "3", "4", "5", "6", "7", "8"];

    const [domains, setDomains] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalStudents: 0,
        totalDomains: 0
    });

    // Expanded view for specific domain
    const [expandedDomain, setExpandedDomain] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/domain-skill/student-domain?branch=${branch}&batch=${batch}&sem=${sem}`);
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            setDomains(data.domains || []);
            setStats({
                totalStudents: data.totalStudents || 0,
                totalDomains: (data.domains || []).length
            });
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [branch, batch, sem]);

    const downloadExcel = () => {
        if (!domains.length) return;

        // Flatten for Excel
        let dump = [];
        domains.forEach(dom => {
            dom.Students.forEach(stu => {
                dump.push({
                    "Domain": dom.DomainName,
                    "Reg No": stu.Reg_No,
                    "Name": stu.Name,
                    "Branch": stu.Branch,
                    "Batch": stu.Batch
                });
            });
        });

        const worksheet = XLSX.utils.json_to_sheet(dump);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Domain Data");
        XLSX.writeFile(workbook, `Domain_Analysis_${branch}_${batch}.xlsx`);
    };

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen font-sans text-slate-900">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
                        🌐 Student Domain Analytics
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm font-medium">
                        Analyze student registrations across various domains
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={downloadExcel}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg shadow-sm hover:shadow transition-all font-semibold text-sm"
                    >
                        <span>📥</span> Export Report
                    </button>
                    <button
                        onClick={() => router.back()}
                        className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold text-sm transition-colors shadow-sm"
                    >
                        Back
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
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
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl p-5 text-white shadow-lg shadow-indigo-200">
                    <p className="text-indigo-100 font-semibold text-sm uppercase tracking-wide">Total Students Filtered</p>
                    <h3 className="text-4xl font-black mt-1">{loading ? "..." : stats.totalStudents}</h3>
                </div>
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                    <p className="text-slate-500 font-semibold text-sm uppercase tracking-wide">Active Domains</p>
                    <h3 className="text-4xl font-black text-slate-800 mt-1">{loading ? "..." : stats.totalDomains}</h3>
                </div>
            </div>

            {/* Domains List Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="border-b border-slate-200 px-6 py-4 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800">Domain Enrollment</h3>
                    <span className="text-xs font-medium text-slate-500">
                        {domains.length} domains found
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                                <th className="p-4 font-bold">Domain Name</th>
                                <th className="p-4 font-bold text-center w-32">Total Students</th>
                                <th className="p-4 font-bold text-center w-24">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                            {loading ? (
                                <tr>
                                    <td colSpan="3" className="p-8 text-center text-slate-400">Loading data...</td>
                                </tr>
                            ) : domains.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="p-8 text-center text-slate-400 font-medium">No records found matching filters.</td>
                                </tr>
                            ) : (
                                domains.map((dom) => (
                                    <React.Fragment key={dom.DomainName}>
                                        <tr className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-4 font-bold text-slate-800 border-l-4 border-transparent group-hover:border-indigo-500 transition-all">
                                                {dom.DomainName}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                                                    {dom.TotalStudents}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => setExpandedDomain(expandedDomain === dom.DomainName ? null : dom.DomainName)}
                                                    className="text-indigo-600 hover:text-indigo-800 font-bold text-xs"
                                                >
                                                    {expandedDomain === dom.DomainName ? "Hide List" : "View List"}
                                                </button>
                                            </td>
                                        </tr>
                                        {/* Expanded Student List for Domain */}
                                        {expandedDomain === dom.DomainName && (
                                            <tr>
                                                <td colSpan="3" className="bg-slate-50 p-4 border-b border-slate-200 inset-shadow">
                                                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                                        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 font-bold text-xs text-slate-600 uppercase">
                                                            Students Registered in {dom.DomainName}
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
                                                                    {dom.Students.map((stu, i) => (
                                                                        <tr key={i}>
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
