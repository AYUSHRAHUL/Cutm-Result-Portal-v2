"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { appendSchoolParams, getSchoolApiUrl } from "@/lib/api-helper";

function TeacherCBCSBasketPageContent() {
  const searchParams = useSearchParams();
  const school = searchParams.get('school');
  const isDiploma = school?.toUpperCase() === 'SOVET' || school?.toUpperCase()?.includes('VOCATIONAL');
  const isSom = school?.toUpperCase() === 'SOM';

  const btechBranches = [
    { value: "CIVIL", label: "CIVIL" },
    { value: "EEE", label: "EEE" },
    { value: "ECE", label: "ECE" },
    { value: "MECHANICAL", label: "MECHANICAL" },
    { value: "CSE", label: "CSE" },
    { value: "AIML", label: "AIML" }
  ];
  const diplomaBranches = [
    { value: "CIVIL", label: "CIVIL" },
    { value: "EE", label: "EE" },
    { value: "MECHANICAL", label: "MECHANICAL" },
    { value: "CSE", label: "CSE" },
    { value: "MINING", label: "MINING" },
    { value: "AUTOMOBILE", label: "AUTOMOBILE" }
  ];
  const somBranches = [
    { value: "BBA", label: "BBA" },
    { value: "MBA", label: "MBA" }
  ];
  const branchOptions = isSom ? somBranches : (isDiploma ? diplomaBranches : btechBranches);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [branch, setBranch] = useState("");
  const [basket, setBasket] = useState("");
  const [search, setSearch] = useState("");

  // Removed edit/add/delete functionality for teacher view-only access

  const branches = useMemo(() => Array.from(new Set(items.map(i => i.Branch).filter(Boolean))).sort(), [items]);
  const baskets = useMemo(() => Array.from(new Set(items.map(i => i.Basket).filter(Boolean))).sort(), [items]);

  async function fetchItems() {
    setError(""); setSuccess("");
    try {
      setLoading(true);
      const qs = new URLSearchParams({ branch, basket, search, limit: "0" }).toString();
      const baseUrl = getSchoolApiUrl("cbcs");
      const separator = baseUrl.includes('?') ? '&' : '?';
      const url = baseUrl + separator + qs;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setItems(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchItems(); }, []);
  
  // Set default branch for SOM
  useEffect(() => {
    if (isSom && !branch) {
      setBranch("BBA");
    }
  }, [isSom, branch]);

  // Trigger search when search term changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchItems();
    }, 300); // Debounce search by 300ms

    return () => clearTimeout(timeoutId);
  }, [search, branch, basket]);

  // Removed all CRUD functions for teacher view-only access

  const totalSubjects = items.length;

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#667eea_0%,#764ba2_100%)] p-5">
      <div className="max-w-[1600px] mx-auto bg-white/95 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.1)] p-6 text-gray-900">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-light text-[#2c3e50]">{isDiploma ? 'Diploma' : 'Basket'}</span>
            <h1 className="text-2xl md:text-3xl font-light text-[#2c3e50]">Subject Management</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={appendSchoolParams("/dashboard/teacher")} className="btn-secondary">← Back to Teacher</Link>
            <Link href={appendSchoolParams("/dashboard/teacher/data/baskettrack")} className="btn-info">Track Progress</Link>
          </div>
        </div>

        {/* Alerts */}
        {success && <div className="alert alert-success mb-4">{success}</div>}
        {error && <div className="alert alert-error mb-4">{error}</div>}

        {/* Stats */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="stat-card"><div className="stat-number">{totalSubjects}</div><div className="stat-label">Total Subjects</div></div>
          <div className="stat-card"><div className="stat-number">{6}</div><div className="stat-label">Branches</div></div>
          <div className="stat-card"><div className="stat-number">{baskets.length}</div><div className="stat-label">Baskets</div></div>
        </div>

        {/* Removed bulk actions for teacher view-only access */}

        {/* Filters */}
        <div className="filters mb-6 rounded-lg">
          <form onSubmit={e => { e.preventDefault(); fetchItems(); }}>
            <div className="filter-row">
              <div className="form-group">
                <label>Branch</label>
                <select value={branch} onChange={e => setBranch(e.target.value)} className="form-control">
                  <option value="">All Branches</option>
                  {branchOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Basket</label>
                <select value={basket} onChange={e => setBasket(e.target.value)} className="form-control">
                  <option value="">All Baskets</option>
                  {baskets.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Search</label>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Subject name or code" className="form-control" />
              </div>
              <div className="form-group">
                <button type="submit" className="btn btn-success">Apply Filters</button>
              </div>
              <div className="form-group">
                <button type="button" onClick={() => { setBranch(""); setBasket(""); setSearch(""); fetchItems(); }} className="btn btn-secondary">Clear Filters</button>
              </div>
            </div>
          </form>
        </div>

        {/* Table */}
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Branch</th>
                <th>Basket</th>
                <th>Subject Code</th>
                <th>Subject Name</th>
                <th>Credits</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="no-data">No subjects to display.</td>
                </tr>
              )}
              {items.map(s => {
                const id = String(s._id);
                return (
                  <tr key={id}>
                    <td>{s.Branch || ""}</td>
                    <td>{s.Basket || ""}</td>
                    <td><strong>{s["Subject Code"] || s.SubjectCode || ""}</strong></td>
                    <td>{s.Subject_name || s.Subject_Name || ""}</td>
                    <td>{s.Credits || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Removed all modals for teacher view-only access */}
      </div>

      <style jsx>{`
        .btn { padding: 12px 24px; border: none; border-radius: 25px; cursor: pointer; text-decoration: none; display: inline-block; font-weight: 500; transition: all 0.3s ease; margin: 2px; font-size: 14px; }
        .btn-primary { background: linear-gradient(45deg, #667eea, #764ba2); color: white; }
        .btn-success { background: linear-gradient(45deg, #56ab2f, #a8e6cf); color: white; }
        .btn-danger { background: linear-gradient(45deg, #ff416c, #ff4b2b); color: white; }
        .btn-secondary { background: #6c757d; color: white; padding: 10px 18px; border-radius: 22px; }
        .btn-info { background: linear-gradient(45deg, #17a2b8, #20c997); color: white; padding: 10px 18px; border-radius: 22px; }
        .btn-warning { background: linear-gradient(45deg, #ffc107, #ff8c00); color: white; padding: 10px 18px; border-radius: 22px; }
        .filters { background: #f8f9fa; border-radius: 10px; padding: 25px; }
        .filter-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; align-items: end; }
        .form-group { display: flex; flex-direction: column; }
        .form-group label { margin-bottom: 5px; font-weight: 500; color: #495057; }
        .form-control { padding: 12px; border: 2px solid #e9ecef; border-radius: 8px; font-size: 14px; }
        .form-control:focus { outline: none; border-color: #667eea; }
        .stat-card { background: linear-gradient(45deg, #667eea, #764ba2); color: white; padding: 20px; border-radius: 10px; text-align: center; flex: 1; min-width: 150px; }
        .stat-number { font-size: 2em; font-weight: bold; }
        .stat-label { font-size: 0.9em; opacity: 0.9; }
        .table-container { background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow-x: auto; }
        .table { width: 100%; border-collapse: collapse; min-width: 1000px; }
        .table th { background: #f8f9fa; padding: 15px 10px; text-align: left; font-weight: 600; color: #495057; border-bottom: 2px solid #dee2e6; white-space: nowrap; }
        .table td { padding: 12px 10px; border-bottom: 1px solid #dee2e6; vertical-align: middle; }
        .table tr:hover { background-color: #f8f9fa; }
        .no-data { text-align: center; padding: 40px; color: #6c757d; }
        .alert { padding: 15px; border-radius: 8px; }
        .alert-success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .alert-error { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-content { background: white; border-radius: 10px; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid #dee2e6; }
        .modal-header h3 { margin: 0; color: #2c3e50; }
        .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #6c757d; }
        .modal-body { padding: 20px; }
        .modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 20px; border-top: 1px solid #dee2e6; }
        .text-muted { color: #6c757d; font-size: 0.875em; }
        .alert-info { background-color: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
        @media (max-width: 768px) { .filter-row { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

export default function TeacherCBCSBasketPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading basket subjects...</p>
        </div>
      </div>
    }>
      <TeacherCBCSBasketPageContent />
    </Suspense>
  );
}