"use client";
import { appendSchoolParams } from "@/lib/api-helper";

import { useState } from "react";

export default function DuplicateDataCleaner() {
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");

  const handleScanDuplicates = async () => {
    setScanning(true);
    setError("");
    setMessage("");
    setDuplicates([]);
    setStats(null);

    try {
      const url = appendSchoolParams("/api/cleanup/scan");
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch: selectedBatch || "", semester: selectedSemester || "" })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to scan for duplicates");
      setDuplicates(data.duplicates || []);
      setStats(data.stats || null);
      setMessage(data.message || "Scan completed successfully");
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleDeleteDuplicates = async () => {
    if (duplicates.length === 0) {
      setError("No duplicates to delete");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const url = appendSchoolParams("/api/cleanup/delete");
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duplicates })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to delete duplicates");
      setMessage(`Successfully deleted ${data.deletedCount} duplicate records`);
      setDuplicates([]);
      setStats(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSpecificDuplicate = async (duplicateGroup) => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const url = appendSchoolParams("/api/cleanup/delete-specific");
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duplicateGroup })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to delete specific duplicates");
      setMessage(`Deleted ${data.deletedCount} records for ${duplicateGroup.regNo} / ${duplicateGroup.subjectCode}`);
      setDuplicates(prev => prev.filter(dup => !(dup.regNo === duplicateGroup.regNo && dup.subjectCode === duplicateGroup.subjectCode)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">🧹 Duplicate Data Cleaner</h1>
              <p className="text-gray-600">Find and remove duplicate records by Reg_No and Subject_Code</p>
            </div>
            <a href="/dashboard/admin" className="text-gray-600 hover:text-gray-800">← Back to Admin</a>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Filter Options</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Batch (Optional)</label>
              <input
                type="text"
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                placeholder="e.g., 2022 or 22"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Semester (Optional)</label>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="">All Semesters</option>
                {Array.from({ length: 8 }, (_, i) => `Sem ${i + 1}`).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex gap-4">
            <button
              onClick={handleScanDuplicates}
              disabled={scanning}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                scanning ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {scanning ? 'Scanning...' : '🔍 Scan for Duplicates'}
            </button>

            {duplicates.length > 0 && (
              <button
                onClick={handleDeleteDuplicates}
                disabled={loading}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  loading ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {loading ? 'Deleting...' : `🗑️ Delete All Duplicates (${duplicates.length} groups)`}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {message && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
            <div className="text-sm text-green-700">{message}</div>
          </div>
        )}

        {stats && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Scan Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.totalRecords}</div>
                <div className="text-sm text-blue-800">Total Records</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{stats.duplicateGroups}</div>
                <div className="text-sm text-red-800">Duplicate Groups</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{stats.duplicateRecords}</div>
                <div className="text-sm text-orange-800">Duplicate Records</div>
              </div>
            </div>
          </div>
        )}

        {duplicates.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">🔍 Found Duplicates</h3>
              <p className="text-sm text-gray-600">Click delete on a group to remove duplicates (keeps one)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registration No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Semester</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {duplicates.map((dup, idx) => (
                    <tr key={`${dup.regNo}-${dup.subjectCode}-${idx}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{dup.regNo}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dup.subjectCode}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dup.subjectName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dup.semester}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {dup.count} records
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <button
                          onClick={() => handleDeleteSpecificDuplicate(dup)}
                          disabled={loading}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                        >
                          {loading ? 'Deleting...' : 'Delete Group'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


