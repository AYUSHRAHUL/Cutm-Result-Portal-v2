"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

// --- Branch Derivation Logic ---
const regNoBranchMap = {
    // B.TECH (SOET)
    '111': 'Civil Engineering',
    '112': 'Computer Science & Engineering (CSE)',
    '113': 'Electronics & Communication Engineering (ECE)',
    '115': 'Electrical & Electronics Engineering (EEE)',
    '116': 'Mechanical Engineering',
    '117': 'CSE (AI & ML)',

    // DIPLOMA (SOVET)
    '711': 'Electrical Engineering',
    '712': 'Mechanical Engineering',
    '713': 'Civil Engineering',
    '714': 'Computer Science Engineering',
    '715': 'Automobile Engineering',
    '716': 'Mining Engineering',

    // SOM
    '912': 'BBA',
    '214': 'MBA'
};

const shortBranchFromCode = {
    '1': 'Civil', '2': 'CSE', '3': 'ECE', '4': 'ECE',
    '5': 'EEE', '6': 'Mechanical', '7': 'AIML',
    '8': 'CSE', '9': 'Civil'
};
const branchMapFull = {
    'CSE': 'Computer Science & Engineering (CSE)',
    'ECE': 'Electronics & Communication Engineering (ECE)',
    'EEE': 'Electrical & Electronics Engineering (EEE)',
    'Mechanical': 'Mechanical Engineering',
    'Civil': 'Civil Engineering',
    'AIML': 'CSE (AI & ML)'
};
function getFullBranchName(shortBranch) {
    return branchMapFull[shortBranch] || shortBranch || "";
}

function getBranchFromRegNo(regNo = "") {
    if (!regNo || regNo.length < 8) return "";

    // 1. Strict 3-digit code lookup (Index 5-7)
    const branchCode = regNo.slice(5, 8);
    if (regNoBranchMap[branchCode]) {
        return regNoBranchMap[branchCode];
    }

    // 2. Fallback to old method (position 7)
    const code = regNo.charAt(7);
    const short = shortBranchFromCode[code] || "";
    return short ? getFullBranchName(short) : "";
}
// -----------------------------

import { Suspense } from 'react';

// ... existing imports
// NOTE: I am not changing imports here as the tool Replaces blocks. I will just update the imports line and the component definition.

// -----------------------------

function StudentManagementContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Selection State
    const [selectedCampus, setSelectedCampus] = useState("pkd");
    const [selectedSchool, setSelectedSchool] = useState("SOVET");

    const [loading, setLoading] = useState(false);
    const [students, setStudents] = useState([]);
    const [searchReg, setSearchReg] = useState("");
    const [searchBatch, setSearchBatch] = useState("");
    const [searchBranch, setSearchBranch] = useState("All");
    const [statuses, setStatuses] = useState({}); // Map of RegNo -> isActive

    // Metadata
    const [batches, setBatches] = useState([]);
    const [branches, setBranches] = useState([]);

    // Initialize from URL or defaults
    useEffect(() => {
        const urlCampus = searchParams.get("campus");
        const urlSchool = searchParams.get("school");
        if (urlCampus) setSelectedCampus(urlCampus);
        if (urlSchool) setSelectedSchool(urlSchool);
    }, [searchParams]);

    // Fetch metadata when campus/school changes
    useEffect(() => {
        fetchMetadata();
    }, [selectedCampus, selectedSchool]);

    async function fetchMetadata() {
        try {
            const batchRes = await fetch(`/api/metadata/batches?school=${selectedSchool}&campus=${selectedCampus}`);
            if (batchRes.ok) {
                const data = await batchRes.json();
                setBatches(data.batches || []);
            } else {
                setBatches([]);
            }

            const branchRes = await fetch(`/api/metadata/departments?school=${selectedSchool}&campus=${selectedCampus}`);
            if (branchRes.ok) {
                const data = await branchRes.json();
                setBranches(data.departments || []);
            } else {
                setBranches([]);
            }
        } catch (e) {
            console.error("Failed to load metadata", e);
            setBatches([]);
            setBranches([]);
        }
    }

    async function searchStudents(e) {
        if (e) e.preventDefault();
        setLoading(true);
        setStudents([]);

        try {
            // Choose endpoint
            let endpoint = `/api/sovet/students?school=${selectedSchool}&campus=${selectedCampus}`;
            if (selectedSchool === "SOET") {
                endpoint = `/api/soet/students?school=${selectedSchool}&campus=${selectedCampus}`;
            }

            const payload = {};
            if (searchReg) {
                payload.registration = searchReg;
            } else {
                payload.batch = searchBatch || "All";
                let dept = searchBranch || "All";

                // Map UI friendly names to backend expected names for SOVET
                if (selectedSchool === 'SOVET' && dept !== 'All') {
                    const sovetMap = {
                        'CSE': 'Computer Science Engineering',
                        'EE': 'Electrical Engineering',
                        'ME': 'Mechanical Engineering',
                        'CE': 'Civil Engineering',
                        'AE': 'Automobile Engineering',
                        'MiE': 'Mining Engineering',
                        // Handle potential full names or other variations
                        'Diploma Computer Science': 'Computer Science Engineering',
                        'Diploma Electrical': 'Electrical Engineering',
                        'Diploma Mechanical': 'Mechanical Engineering',
                        'Diploma Civil': 'Civil Engineering',
                        'Diploma Automobile': 'Automobile Engineering',
                        'Diploma Mining': 'Mining Engineering'
                    };
                    if (sovetMap[dept]) dept = sovetMap[dept];
                }

                payload.department = dept;
            }

            // Explicitly request inactive students for management purposes
            payload.includeInactive = true;

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                const records = data.records || data.students || [];

                // Deduplicate
                const unique = [];
                const seen = new Set();
                records.forEach(r => {
                    if (!seen.has(r.Reg_No)) {
                        seen.add(r.Reg_No);
                        unique.push(r);
                    }
                });

                setStudents(unique);

                // Fetch Statuses (using generic status endpoint logic)
                // Note: effectively using sovet/student-status as generic handler
                if (unique.length > 0) {
                    const regList = unique.map(s => s.Reg_No).join(',');
                    const statusRes = await fetch(`/api/sovet/student-status?school=${selectedSchool}&campus=${selectedCampus}&reg=${regList}`);
                    if (statusRes.ok) {
                        const statusData = await statusRes.json();
                        const statusMap = {};
                        // Default active
                        unique.forEach(s => statusMap[s.Reg_No] = true);

                        // Overlay stored statuses
                        (statusData.data || []).forEach(s => {
                            statusMap[s.Reg_No] = s.isActive;
                        });
                        setStatuses(statusMap);
                    }
                }
            } else {
                // Handle error quietly or show empty
                setStudents([]);
            }
        } catch (error) {
            alert("Error fetching students: " + error.message);
        } finally {
            setLoading(false);
        }
    }

    async function toggleStatus(regNo, currentStatus) {
        const newStatus = !currentStatus;

        // Optimistic update
        setStatuses(prev => ({ ...prev, [regNo]: newStatus }));

        try {
            await fetch(`/api/sovet/student-status?school=${selectedSchool}&campus=${selectedCampus}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ regNo, isActive: newStatus })
            });
        } catch (e) {
            // Revert on error
            setStatuses(prev => ({ ...prev, [regNo]: currentStatus }));
            alert("Failed to update status");
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-10">
            <div className="max-w-7xl mx-auto px-4 pt-8">
                <h1 className="text-3xl font-black text-center mb-2 text-[#023945]">Student Status Management</h1>
                <p className="text-center text-gray-500 mb-8">Manage Active/Inactive Status for Students</p>

                {/* Global Selectors */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-center justify-center">
                    <div className="flex flex-col">
                        <label className="text-xs font-bold text-gray-500 mb-1">Campus</label>
                        <select
                            className="p-2 border rounded-lg min-w-[200px]"
                            value={selectedCampus}
                            onChange={(e) => setSelectedCampus(e.target.value)}
                        >
                            <option value="pkd">Paralakhemundi (PKD)</option>
                            <option value="bbsr">Bhubaneswar (BBSR)</option>
                            <option value="ryd">Rayagada (RYD)</option>
                            <option value="blr">Balangir (BLR)</option>
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-xs font-bold text-gray-500 mb-1">School</label>
                        <select
                            className="p-2 border rounded-lg min-w-[200px]"
                            value={selectedSchool}
                            onChange={(e) => setSelectedSchool(e.target.value)}
                        >
                            <option value="SOVET">SOVET (Diploma)</option>
                            <option value="SOET">SOET (B.Tech)</option>
                            <option value="SOMS">SOMS (Management)</option>
                            <option value="SOAS">SOAS (Applied Sciences)</option>
                            <option value="SOA">SOA (Agriculture)</option>
                        </select>
                    </div>
                    <div className="h-full flex items-end">
                        <button
                            onClick={() => fetchMetadata()}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-bold transition"
                        >
                            Refresh Data
                        </button>
                    </div>
                </div>

                {/* Search Filters */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Search Filters</h2>
                    <form onSubmit={searchStudents} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <input
                            placeholder="Search by Reg No"
                            className="p-3 border rounded-lg"
                            value={searchReg}
                            onChange={e => setSearchReg(e.target.value)}
                        />
                        <select
                            className="p-3 border rounded-lg"
                            value={searchBatch}
                            onChange={e => setSearchBatch(e.target.value)}
                        >
                            <option value="">Select Batch</option>
                            <option value="All">All Batches</option>
                            {batches.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        <select
                            className="p-3 border rounded-lg"
                            value={searchBranch}
                            onChange={e => setSearchBranch(e.target.value)}
                        >
                            <option value="All">All Branches</option>
                            {branches.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-[#05A3C7] text-white font-bold py-3 rounded-lg hover:bg-[#04748F] transition shadow-md"
                        >
                            {loading ? "Searching..." : "Search Students"}
                        </button>
                    </form>
                </div>

                {/* Results */}
                {students.length > 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-[#eff6f8] border-b border-[#e1eef3]">
                                    <tr>
                                        <th className="p-4 font-bold text-[#023945]">Reg No</th>
                                        <th className="p-4 font-bold text-[#023945]">Name</th>
                                        <th className="p-4 font-bold text-[#023945]">Branch</th>
                                        <th className="p-4 font-bold text-[#023945] text-center">Status</th>
                                        <th className="p-4 font-bold text-[#023945] text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map((student, idx) => {
                                        const isActive = statuses[student.Reg_No] !== false; // Default true
                                        // Use DB branch or derive it
                                        const branchName = student.Branch || getBranchFromRegNo(student.Reg_No) || "Unknown";
                                        return (
                                            <tr key={student.Reg_No} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                                                <td className="p-4 font-medium font-mono text-sm">{student.Reg_No}</td>
                                                <td className="p-4 text-gray-700 font-medium whitespace-nowrap">{student.Name}</td>
                                                <td className="p-4 text-gray-500 text-sm">{branchName}</td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            className="sr-only peer"
                                                            checked={isActive}
                                                            onChange={() => toggleStatus(student.Reg_No, isActive)}
                                                        />
                                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#05a3c7]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#05A3C7]"></div>
                                                    </label>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 bg-gray-50 text-center text-sm text-gray-500 border-t">
                            Showing {students.length} students
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <div className="text-4xl mb-4">🔍</div>
                        <h3 className="text-lg font-bold text-gray-700 mb-1">No Students Found</h3>
                        <p className="text-gray-400 max-w-sm mx-auto">
                            {loading ? "Fetching data from server..." : "Try adjusting the filters to find students to manage."}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function StudentManagementPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#023945]"></div>
            </div>
        }>
            <StudentManagementContent />
        </Suspense>
    );
}
