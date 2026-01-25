"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getSchoolApiUrl } from "@/lib/api-helper";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid
} from "recharts";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

function PlacementManagementContent() {
  const searchParams = useSearchParams();
  const school = searchParams.get('school') || 'soet';
  const campus = searchParams.get('campus') || 'pkd';
  
  const [activeTab, setActiveTab] = useState('data');
  
  const [placements, setPlacements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  
  // Advanced filtering and search
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    batch: '',
    branch: '',
    minPackage: '',
    maxPackage: ''
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  // Sorting
  const [sortField, setSortField] = useState('regNo');
  const [sortDirection, setSortDirection] = useState('asc');
  
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlacement, setEditingPlacement] = useState(null);
  const [formData, setFormData] = useState({
    batch: '',
    branch: '',
    regNo: '',
    name: '',
    companyName: '',
    package: ''
  });

  useEffect(() => {
    if (campus) localStorage.setItem('selectedCampus', campus);
    if (school) localStorage.setItem('selectedSchool', school);
  }, [campus, school]);

  useEffect(() => {
    if (activeTab === 'data') {
      fetchPlacements();
    }
  }, [activeTab, filters]);

  const fetchPlacements = async () => {
    try {
      setLoading(true);
      setError("");
      
      const baseUrl = getSchoolApiUrl('placement');
      const separator = baseUrl.includes('?') ? '&' : '?';
      const params = new URLSearchParams();
      if (filters.batch) params.append('batch', filters.batch);
      if (filters.branch) params.append('branch', filters.branch);
      
      const url = params.toString() ? `${baseUrl}${separator}${params}` : baseUrl;
      
      const response = await fetch(url, {
        credentials: 'include'
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to fetch placements';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.success) {
        setPlacements(data.placements || []);
      } else {
        setError(data.error || 'Failed to load placements');
      }
    } catch (err) {
      setError(err.message || 'Error loading placements');
      setPlacements([]);
    } finally {
      setLoading(false);
    }
  };

  // Filtered, searched, and sorted placements
  const processedPlacements = useMemo(() => {
    let filtered = [...placements];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.regNo?.toLowerCase().includes(term) ||
        p.name?.toLowerCase().includes(term) ||
        p.companyName?.toLowerCase().includes(term) ||
        p.branch?.toLowerCase().includes(term) ||
        p.batch?.toLowerCase().includes(term)
      );
    }

    // Package range filter
    if (filters.minPackage) {
      const min = parseFloat(filters.minPackage);
      if (!isNaN(min)) {
        filtered = filtered.filter(p => parseFloat(p.package || 0) >= min);
      }
    }
    if (filters.maxPackage) {
      const max = parseFloat(filters.maxPackage);
      if (!isNaN(max)) {
        filtered = filtered.filter(p => parseFloat(p.package || 0) <= max);
      }
    }

    // Sorting
    filtered.sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';
      
      if (sortField === 'package') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });

    return filtered;
  }, [placements, searchTerm, filters, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(processedPlacements.length / itemsPerPage);
  const paginatedPlacements = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedPlacements.slice(start, start + itemsPerPage);
  }, [processedPlacements, currentPage, itemsPerPage]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const baseUrl = getSchoolApiUrl("placement/upload");
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch(baseUrl, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setUploadResult(data.stats);
        fetchPlacements();
        alert(`Upload successful! Inserted: ${data.stats.inserted}, Updated: ${data.stats.updated}`);
      } else {
        alert('Upload failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Upload error: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAddClick = () => {
    setEditingPlacement(null);
    setFormData({
      batch: '',
      branch: '',
      regNo: '',
      name: '',
      companyName: '',
      package: ''
    });
    setShowAddModal(true);
  };

  const handleEditClick = (placement) => {
    setEditingPlacement(placement);
    setFormData({
      batch: placement.batch || '',
      branch: placement.branch || '',
      regNo: placement.regNo || '',
      name: placement.name || '',
      companyName: placement.companyName || '',
      package: placement.package || ''
    });
    setShowAddModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const baseUrl = getSchoolApiUrl(editingPlacement ? 'placement/update' : 'placement');
      const method = editingPlacement ? 'PUT' : 'POST';
      
      const response = await fetch(baseUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...(editingPlacement && { id: editingPlacement._id }),
          ...formData
        })
      });

      const data = await response.json();
      if (data.success) {
        alert(editingPlacement ? 'Placement updated successfully!' : 'Placement added successfully!');
        setShowAddModal(false);
        fetchPlacements();
      } else {
        alert('Error: ' + (data.error || 'Failed to save placement'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this placement record?')) {
      return;
    }

    try {
      const baseUrl = getSchoolApiUrl('placement/delete');
      const response = await fetch(baseUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id })
      });

      const data = await response.json();
      if (data.success) {
        alert('Placement deleted successfully!');
        fetchPlacements();
      } else {
        alert('Error: ' + (data.error || 'Failed to delete placement'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      alert('Please select at least one record');
      return;
    }
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} placement record(s)?`)) {
      return;
    }

    try {
      for (const id of selectedIds) {
        const baseUrl = getSchoolApiUrl('placement/delete');
        await fetch(baseUrl, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id })
        });
      }
      alert(`${selectedIds.length} record(s) deleted successfully!`);
      setSelectedIds([]);
      fetchPlacements();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleExport = (format) => {
    const dataToExport = processedPlacements.map(p => ({
      Batch: p.batch,
      Branch: p.branch,
      'Registration Number': p.regNo,
      Name: p.name,
      'Company Name': p.companyName,
      'Package (LPA)': p.package
    }));

    if (format === 'csv') {
      const headers = Object.keys(dataToExport[0] || {});
      const csv = [
        headers.join(','),
        ...dataToExport.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `placements_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } else if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Placements');
      XLSX.writeFile(wb, `placements_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if (format === 'pdf') {
      const doc = new jsPDF();
      doc.text('Placement Records', 14, 15);
      doc.autoTable({
        head: [['Batch', 'Branch', 'Reg No', 'Name', 'Company', 'Package (LPA)']],
        body: processedPlacements.map(p => [
          p.batch,
          p.branch,
          p.regNo,
          p.name,
          p.companyName,
          p.package
        ]),
        startY: 20,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [5, 163, 199] }
      });
      doc.save(`placements_${new Date().toISOString().split('T')[0]}.pdf`);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedPlacements.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedPlacements.map(p => p._id));
    }
  };

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Placement Management</h1>
          <p className="text-gray-600">Advanced placement data management and analytics</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex gap-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('data')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'data'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Placement Data
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'analytics'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Analytics & Visualization
            </button>
          </div>
        </div>

        {activeTab === 'data' && (
          <div>
            {/* Advanced Filters */}
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, reg no, company..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Batch</label>
                  <input
                    type="text"
                    value={filters.batch}
                    onChange={(e) => setFilters({...filters, batch: e.target.value})}
                    placeholder="e.g., 2022"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                  <input
                    type="text"
                    value={filters.branch}
                    onChange={(e) => setFilters({...filters, branch: e.target.value})}
                    placeholder="e.g., CSE"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Min Package</label>
                    <input
                      type="number"
                      value={filters.minPackage}
                      onChange={(e) => setFilters({...filters, minPackage: e.target.value})}
                      placeholder="Min LPA"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Package</label>
                    <input
                      type="number"
                      value={filters.maxPackage}
                      onChange={(e) => setFilters({...filters, maxPackage: e.target.value})}
                      placeholder="Max LPA"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-3 items-center">
                <label className="flex items-center px-4 py-2 bg-gray-100 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-200">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files?.[0])}
                    disabled={uploading}
                  />
                  <span className="text-sm font-semibold text-gray-700">{uploading ? "Uploading..." : "📁 Upload CSV/Excel"}</span>
                </label>
                <button
                  onClick={handleAddClick}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                >
                  + Add Placement
                </button>
                {selectedIds.length > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
                  >
                    🗑️ Delete Selected ({selectedIds.length})
                  </button>
                )}
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={() => handleExport('csv')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    📥 CSV
                  </button>
                  <button
                    onClick={() => handleExport('excel')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    📊 Excel
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    📄 PDF
                  </button>
                </div>
              </div>
              
              {uploadResult && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                  ✅ Uploaded: {uploadResult.inserted} inserted, {uploadResult.updated} updated, {uploadResult.skipped} skipped (Total: {uploadResult.total})
                </div>
              )}
            </div>

            {/* Table */}
            {loading ? (
              <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading placements...</p>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
                <p className="text-red-600">{error}</p>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-4">
                  <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      Showing {paginatedPlacements.length} of {processedPlacements.length} records
                    </span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value={10}>10 per page</option>
                      <option value={20}>20 per page</option>
                      <option value={50}>50 per page</option>
                      <option value={100}>100 per page</option>
                    </select>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left">
                            <input
                              type="checkbox"
                              checked={selectedIds.length === paginatedPlacements.length && paginatedPlacements.length > 0}
                              onChange={toggleSelectAll}
                              className="rounded"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('batch')}>
                            Batch {sortField === 'batch' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('branch')}>
                            Branch {sortField === 'branch' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('regNo')}>
                            Reg No {sortField === 'regNo' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('name')}>
                            Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('companyName')}>
                            Company {sortField === 'companyName' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('package')}>
                            Package (LPA) {sortField === 'package' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedPlacements.map((placement, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(placement._id)}
                                onChange={() => toggleSelect(placement._id)}
                                className="rounded"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{placement.batch}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{placement.branch}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{placement.regNo}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{placement.name}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{placement.companyName}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-600 font-semibold">{placement.package}</td>
                            <td className="px-4 py-3 text-sm text-center">
                              <button
                                onClick={() => handleEditClick(placement)}
                                className="mr-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(placement._id)}
                                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="bg-white rounded-2xl shadow-xl p-4 flex justify-center items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <PlacementAnalytics />
        )}

        {/* Add/Edit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                {editingPlacement ? 'Edit Placement' : 'Add New Placement'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Batch *</label>
                    <input
                      type="text"
                      required
                      value={formData.batch}
                      onChange={(e) => setFormData({...formData, batch: e.target.value})}
                      placeholder="e.g., 2022"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Branch *</label>
                    <input
                      type="text"
                      required
                      value={formData.branch}
                      onChange={(e) => setFormData({...formData, branch: e.target.value})}
                      placeholder="e.g., CSE"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Registration Number *</label>
                    <input
                      type="text"
                      required
                      value={formData.regNo}
                      onChange={(e) => setFormData({...formData, regNo: e.target.value})}
                      placeholder="e.g., 220101120003"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Student Name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Company Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.companyName}
                      onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                      placeholder="Company Name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Package (LPA) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.package}
                      onChange={(e) => setFormData({...formData, package: e.target.value})}
                      placeholder="e.g., 8.5"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                  >
                    {editingPlacement ? 'Update' : 'Add'} Placement
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
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

export default function PlacementManagement() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <PlacementManagementContent />
    </Suspense>
  );
}

// Advanced Analytics Component
function PlacementAnalytics() {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState('overview');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const baseUrl = getSchoolApiUrl('placement/analytics');
      const response = await fetch(baseUrl, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAnalyticsData(data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading analytics...</p>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
        <p className="text-gray-600">No analytics data available</p>
      </div>
    );
  }

  // Prepare chart data
  const branchChartData = Object.entries(analyticsData.branchStats || {}).map(([branch, stats]) => ({
    name: branch,
    placements: stats.count,
    avgPackage: parseFloat(stats.avgPackage?.toFixed(2) || 0),
    maxPackage: parseFloat(stats.maxPackage?.toFixed(2) || 0)
  }));

  const batchChartData = Object.entries(analyticsData.batchStats || {})
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([batch, stats]) => ({
      name: batch,
      placements: stats.count,
      avgPackage: parseFloat(stats.avgPackage?.toFixed(2) || 0)
    }));

  const companyChartData = Object.entries(analyticsData.companyStats || {})
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)
    .map(([company, stats]) => ({
      name: company.length > 15 ? company.substring(0, 15) + '...' : company,
      fullName: company,
      hires: stats.count,
      avgPackage: parseFloat(stats.avgPackage?.toFixed(2) || 0)
    }));

  const packageDistribution = branchChartData.map((item, idx) => ({
    name: item.name,
    value: item.avgPackage,
    color: COLORS[idx % COLORS.length]
  }));

  // Histogram buckets for packages (LPA)
  const allPackages = Object.values(analyticsData.companyStats || {})
    .flatMap(s => (s.packages || []).map(n => Number(n)).filter(Number.isFinite));
  const buckets = [
    { label: "0-3", min: 0, max: 3 },
    { label: "3-6", min: 3, max: 6 },
    { label: "6-10", min: 6, max: 10 },
    { label: "10-15", min: 10, max: 15 },
    { label: "15+", min: 15, max: Infinity },
  ];
  const packageHistogram = buckets.map(b => ({
    range: b.label,
    count: allPackages.filter(p => p >= b.min && p < b.max).length,
  }));

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <h3 className="text-sm font-medium opacity-90 mb-2">Total Placements</h3>
          <p className="text-4xl font-bold">{analyticsData.totalPlacements || 0}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <h3 className="text-sm font-medium opacity-90 mb-2">Average Package</h3>
          <p className="text-4xl font-bold">{analyticsData.avgPackage?.toFixed(2) || '0.00'} LPA</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <h3 className="text-sm font-medium opacity-90 mb-2">Highest Package</h3>
          <p className="text-4xl font-bold">{analyticsData.maxPackage || '0.00'} LPA</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
          <h3 className="text-sm font-medium opacity-90 mb-2">Companies</h3>
          <p className="text-4xl font-bold">{analyticsData.totalCompanies || 0}</p>
        </div>
      </div>

      {/* View Tabs */}
      <div className="bg-white rounded-2xl shadow-xl p-4">
        <div className="flex gap-2 border-b">
          {['overview', 'branch', 'batch', 'company'].map(view => (
            <button
              key={view}
              onClick={() => setSelectedView(view)}
              className={`px-4 py-2 font-semibold capitalize transition-colors ${
                selectedView === view
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {view} Analysis
            </button>
          ))}
        </div>
      </div>

      {/* Branch Analysis */}
      {selectedView === 'branch' && branchChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Placements by Branch</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={branchChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="placements" fill="#0088FE" name="Placements" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Average Package by Branch</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={branchChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgPackage" fill="#00C49F" name="Avg Package (LPA)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Branch-wise Statistics</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Placements</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Package (LPA)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Max Package (LPA)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {branchChartData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">{item.placements}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600 font-semibold">{item.avgPackage.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600 font-semibold">{item.maxPackage.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Batch Analysis */}
      {selectedView === 'batch' && batchChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Placements by Batch</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={batchChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="placements" stroke="#8884d8" strokeWidth={2} name="Placements" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Average Package Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={batchChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="avgPackage" stroke="#82ca9d" strokeWidth={2} name="Avg Package (LPA)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Batch-wise Statistics</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Placements</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Package (LPA)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Max Package (LPA)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {batchChartData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">{item.placements}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600 font-semibold">{item.avgPackage.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600 font-semibold">
                        {analyticsData.batchStats?.[item.name]?.maxPackage?.toFixed(2) || '0.00'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Company Analysis */}
      {selectedView === 'company' && companyChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Top Companies by Hires</h2>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={companyChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} />
                <Tooltip />
                <Legend />
                <Bar dataKey="hires" fill="#FF8042" name="Hires" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Package Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={packageDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {packageDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Top Companies</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Hires</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Package (LPA)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Max Package (LPA)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {companyChartData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.fullName}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">{item.hires}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600 font-semibold">{item.avgPackage.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600 font-semibold">
                        {analyticsData.companyStats?.[item.fullName]?.maxPackage?.toFixed(2) || '0.00'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Overview */}
      {selectedView === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Placements by Branch</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={branchChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="placements" fill="#0088FE" name="Placements" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Package Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={packageDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {packageDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Batch Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={batchChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="placements" stroke="#8884d8" strokeWidth={2} name="Placements" />
                <Line type="monotone" dataKey="avgPackage" stroke="#82ca9d" strokeWidth={2} name="Avg Package (LPA)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Top Companies</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={companyChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="hires" fill="#FF8042" name="Hires" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Package Distribution (Histogram)</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={packageHistogram}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#00C49F" name="Students" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
