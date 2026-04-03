"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { appendSchoolParams, getSchoolApiUrl } from "@/lib/api-helper";

function AdminCBCSBasketPageContent() {
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

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Edit modal state
  const [editModal, setEditModal] = useState({ show: false, item: null });
  const [editForm, setEditForm] = useState({ Branch: "", Basket: "", SubjectCode: "", SubjectName: "", Credits: "" });

  // Add subject modal state
  const [addModal, setAddModal] = useState({ show: false, mode: "manual" }); // "manual" or "upload"
  const [addForm, setAddForm] = useState({ Branch: "", Basket: "", SubjectCode: "", SubjectName: "", Credits: "" });
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const branches = useMemo(() => Array.from(new Set(items.map(i => i.Branch).filter(Boolean))).sort(), [items]);
  const baskets = useMemo(() => Array.from(new Set(items.map(i => i.Basket).filter(Boolean))).sort(), [items]);

  async function fetchItems() {
    setError("");
    try {
      setLoading(true);
      const qs = new URLSearchParams({ branch, basket, search, limit: "0" }).toString();
      const baseUrl = getSchoolApiUrl("cbcs");
      const separator = baseUrl.includes('?') ? '&' : '?';
      const res = await fetch(baseUrl + separator + qs);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setItems(data.items || []);
      setSelectedIds(new Set());
      setSelectAll(false);
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
  // Auto-hide success after a few seconds
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  // Trigger search when search term changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchItems();
    }, 300); // Debounce search by 300ms

    return () => clearTimeout(timeoutId);
  }, [search, branch, basket]);

  function toggleSelectAll(checked) {
    setSelectAll(checked);
    if (checked) {
      setSelectedIds(new Set(items.map(i => String(i._id))));
    } else {
      setSelectedIds(new Set());
    }
  }

  function toggleSelect(id, checked) {
    const next = new Set(selectedIds);
    if (checked) next.add(String(id)); else next.delete(String(id));
    setSelectedIds(next);
    setSelectAll(next.size === items.length && items.length > 0);
  }

  async function removeOne(id) {
    try {
      const res = await fetch(getSchoolApiUrl(`cbcs/${id}`), { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setSuccess("Deleted");
      await fetchItems();
    } catch (err) {
      setError(err.message);
    }
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    try {
      setLoading(true);
      await Promise.all(Array.from(selectedIds).map(id => fetch(getSchoolApiUrl(`cbcs/${id}`), { method: "DELETE" })));
      setSuccess(`Deleted ${selectedIds.size} item(s)`);
      await fetchItems();
    } catch (err) {
      setError("Some deletions failed");
    } finally { setLoading(false); }
  }

  function openEditModal(item) {
    setError("");
    setSuccess("");
    setEditForm({
      Branch: item.Branch || "",
      Basket: item.Basket || "",
      SubjectCode: item["Subject Code"] || item.SubjectCode || "",
      SubjectName: item.Subject_name || item.Subject_Name || "",
      Credits: item.Credits || ""
    });
    setEditModal({ show: true, item });
  }

  function closeEditModal() {
    setEditModal({ show: false, item: null });
    setEditForm({ Branch: "", Basket: "", SubjectCode: "", SubjectName: "", Credits: "" });
  }

  async function saveEdit() {
    if (!editModal.item) return;
    try {
      setLoading(true);
      setError("");
      // Fallback to original values if user leaves fields blank
      const payload = {
        Branch: ((editForm.Branch || editModal.item.Branch) || '').trim(),
        Basket: ((editForm.Basket || editModal.item.Basket) || '').trim(),
        SubjectCode: ((editForm.SubjectCode || editModal.item["Subject Code"] || editModal.item.SubjectCode) || '').trim().toUpperCase(),
        SubjectName: ((editForm.SubjectName || editModal.item.Subject_name || editModal.item.Subject_Name) || '').trim(),
        Credits: (editForm.Credits ?? editModal.item.Credits ?? '').toString().trim(),
      };
      if (!payload.Branch || !payload.SubjectCode || !payload.SubjectName) {
        throw new Error("Branch, Subject Code and Subject Name are required");
      }
      const res = await fetch(getSchoolApiUrl(`cbcs/${editModal.item._id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setSuccess("Subject updated successfully");
      // Briefly show success inside modal, then close and refresh
      setTimeout(async () => {
        closeEditModal();
        await fetchItems();
      }, 800);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  function openAddModal(mode) {
    setAddModal({ show: true, mode });
    setAddForm({ Branch: "", Basket: "", SubjectCode: "", SubjectName: "", Credits: "" });
    setUploadFile(null);
    setUploadProgress(0);
  }

  function closeAddModal() {
    setAddModal({ show: false, mode: "manual" });
    setAddForm({ Branch: "", Basket: "", SubjectCode: "", SubjectName: "", Credits: "" });
    setUploadFile(null);
    setUploadProgress(0);
  }

  async function saveManualSubject() {
    try {
      setLoading(true);
      const payload = {
        Branch: (addForm.Branch || '').trim(),
        Basket: (addForm.Basket || '').trim(),
        SubjectCode: (addForm.SubjectCode || '').trim(),
        SubjectName: (addForm.SubjectName || '').trim(),
        Credits: (addForm.Credits ?? '').toString().trim(),
      };
      const cbcsUrl = getSchoolApiUrl("cbcs");
      const res = await fetch(cbcsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add subject");
      setSuccess("Subject added successfully");
      closeAddModal();
      await fetchItems();
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  async function uploadSubjects() {
    if (!uploadFile) return;
    try {
      setLoading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append("file", uploadFile);

      const uploadUrl = getSchoolApiUrl("upload/cbcs");
      const res = await fetch(uploadUrl, {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setSuccess(`Successfully uploaded ${data.count || 0} subjects`);
      closeAddModal();
      await fetchItems();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      if (!validTypes.includes(file.type)) {
        setError("Please select a valid CSV or Excel file");
        return;
      }
      setUploadFile(file);
      setError("");
    }
  }

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
            <Link href="/dashboard/admin" className="btn-secondary">← Back to Admin</Link>
            <Link href="/dashboard/admin/data/baskettrack" className="btn-info">Track Progress</Link>
            <button onClick={() => openAddModal("manual")} className="btn btn-success">+ Add Subject</button>
            <button onClick={() => openAddModal("upload")} className="btn btn-primary">📁 Upload File</button>
          </div>
        </div>

        {/* Alerts */}
        {success && <div className="alert alert-success mb-4">{success}</div>}
        {error && <div className="alert alert-error mb-4">{error}</div>}

        {/* Success Toast */}
        {success && (
          <div className="toast-success">
            <div className="toast-content">
              <span className="toast-check">✓</span>
              <span className="toast-text">{success}</span>
              <button onClick={() => setSuccess("")} className="toast-close">×</button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="stat-card"><div className="stat-number">{totalSubjects}</div><div className="stat-label">Total Subjects</div></div>
          <div className="stat-card"><div className="stat-number">{5}</div><div className="stat-label">Branches</div></div>
          <div className="stat-card"><div className="stat-number">{baskets.length}</div><div className="stat-label">Baskets</div></div>
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="bulk-actions mb-4">
            <span>{selectedIds.size}</span> subjects selected
            <button onClick={bulkDelete} className="btn btn-danger ml-2">Delete Selected</button>
            <button onClick={() => { setSelectedIds(new Set()); setSelectAll(false); }} className="btn btn-secondary ml-2">Clear Selection</button>
          </div>
        )}

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
                <th><input type="checkbox" checked={selectAll} onChange={e => toggleSelectAll(e.target.checked)} /></th>
                <th>Branch</th>
                <th>Basket</th>
                <th>Subject Code</th>
                <th>Subject Name</th>
                <th>Credits</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="no-data">No subjects to display.</td>
                </tr>
              )}
              {items.map(s => {
                const id = String(s._id);
                return (
                  <tr key={id}>
                    <td><input type="checkbox" checked={selectedIds.has(id)} onChange={e => toggleSelect(id, e.target.checked)} /></td>
                    <td>{s.Branch || ""}</td>
                    <td>{s.Basket || ""}</td>
                    <td><strong>{s["Subject Code"] || s.SubjectCode || ""}</strong></td>
                    <td>{s.Subject_name || s.Subject_Name || ""}</td>
                    <td>{s.Credits || ""}</td>
                    <td>
                      <button onClick={() => openEditModal(s)} className="btn btn-warning">Edit</button>
                      <button onClick={() => removeOne(id)} className="btn btn-danger ml-2">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Edit Modal */}
        {editModal.show && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Edit Subject</h3>
                <button onClick={closeEditModal} className="modal-close">&times;</button>
              </div>
              {success && (
                <div className="modal-success">
                  ✓ {success}
                </div>
              )}
              {error && (
                <div className="modal-error">⚠️ {error}</div>
              )}
              <div className="modal-body">
                <div className="form-group">
                  <label>Branch</label>
                  <select value={editForm.Branch} onChange={e => setEditForm({ ...editForm, Branch: e.target.value })} className="form-control">
                    <option value="">Select Branch</option>
                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Basket</label>
                  <select value={editForm.Basket} onChange={e => setEditForm({ ...editForm, Basket: e.target.value })} className="form-control">
                    <option value="">Select Basket</option>
                    {baskets.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Subject Code</label>
                  <input value={editForm.SubjectCode} onChange={e => setEditForm({ ...editForm, SubjectCode: e.target.value })} className="form-control" />
                </div>
                <div className="form-group">
                  <label>Subject Name</label>
                  <input value={editForm.SubjectName} onChange={e => setEditForm({ ...editForm, SubjectName: e.target.value })} className="form-control" />
                </div>
                <div className="form-group">
                  <label>Credits</label>
                  <input value={editForm.Credits} onChange={e => setEditForm({ ...editForm, Credits: e.target.value })} className="form-control" placeholder="e.g., 3 or 1+2+0" />
                  <small className="text-muted">You can use formats like 3 or 1+2+0</small>
                </div>
              </div>
              <div className="modal-footer">
                <button onClick={closeEditModal} className="btn btn-secondary">Cancel</button>
                <button onClick={saveEdit} className="btn btn-success" disabled={loading}>Save Changes</button>
              </div>
            </div>
          </div>
        )}

        {/* Add Subject Modal */}
        {addModal.show && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>{addModal.mode === "manual" ? "Add New Subject" : "Upload Subjects"}</h3>
                <button onClick={closeAddModal} className="modal-close">&times;</button>
              </div>
              <div className="modal-body">
                {addModal.mode === "manual" ? (
                  <>
                    <div className="form-group">
                      <label>Branch</label>
                      <select value={addForm.Branch} onChange={e => setAddForm({ ...addForm, Branch: e.target.value })} className="form-control">
                        <option value="">Select Branch</option>
                        {branches.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Basket</label>
                      <select value={addForm.Basket} onChange={e => setAddForm({ ...addForm, Basket: e.target.value })} className="form-control">
                        <option value="">Select Basket</option>
                        {baskets.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Subject Code</label>
                      <input value={addForm.SubjectCode} onChange={e => setAddForm({ ...addForm, SubjectCode: e.target.value })} className="form-control" placeholder="e.g., CS101" />
                    </div>
                    <div className="form-group">
                      <label>Subject Name</label>
                      <input value={addForm.SubjectName} onChange={e => setAddForm({ ...addForm, SubjectName: e.target.value })} className="form-control" placeholder="e.g., Data Structures" />
                    </div>
                    <div className="form-group">
                      <label>Credits</label>
                      <input value={addForm.Credits} onChange={e => setAddForm({ ...addForm, Credits: e.target.value })} className="form-control" placeholder="e.g., 3 or 1+2+0" />
                      <small className="text-muted">You can use formats like 3 or 1+2+0</small>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-group">
                      <label>Select File (CSV or Excel)</label>
                      <input type="file" onChange={handleFileChange} accept=".csv,.xlsx,.xls" className="form-control" />
                      <small className="text-muted">Supported formats: CSV, Excel (.xlsx, .xls)</small>
                    </div>
                    {uploadFile && (
                      <div className="alert alert-info">
                        <strong>Selected File:</strong> {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                      </div>
                    )}
                    <div className="alert alert-info">
                      <strong>File Format Requirements:</strong>
                      <ul className="mt-2 text-sm">
                        <li>First row should contain headers: Branch, Basket, Subject Code, Subject Name, Credits</li>
                        <li>Each subsequent row should contain subject data</li>
                        <li>Subject Code will be automatically converted to uppercase</li>
                      </ul>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button onClick={closeAddModal} className="btn btn-secondary">Cancel</button>
                {addModal.mode === "manual" ? (
                  <button onClick={saveManualSubject} className="btn btn-success" disabled={loading || !addForm.Branch || !addForm.Basket || !addForm.SubjectCode || !addForm.SubjectName || !addForm.Credits}>
                    {loading ? "Adding..." : "Add Subject"}
                  </button>
                ) : (
                  <button onClick={uploadSubjects} className="btn btn-primary" disabled={loading || !uploadFile}>
                    {loading ? "Uploading..." : "Upload File"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
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
        .toast-success { position: fixed; right: 20px; bottom: 20px; z-index: 3000; animation: slideIn 0.3s ease-out; }
        .toast-content { display: flex; align-items: center; gap: 10px; background: #10b981; color: #fff; padding: 12px 16px; border-radius: 10px; box-shadow: 0 10px 20px rgba(0,0,0,0.15); }
        .toast-check { font-weight: 700; background: rgba(255,255,255,0.2); width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; }
        .toast-text { font-weight: 600; }
        .toast-close { background: transparent; border: none; color: #fff; font-size: 18px; cursor: pointer; margin-left: 4px; opacity: 0.9; }
        .toast-close:hover { opacity: 1; }
        @keyframes slideIn { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-content { background: white; border-radius: 10px; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid #dee2e6; }
        .modal-header h3 { margin: 0; color: #2c3e50; }
        .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #6c757d; }
        .modal-success { margin: 12px 20px 0; background: #d4edda; color: #155724; border: 1px solid #c3e6cb; border-radius: 8px; padding: 10px 12px; font-weight: 600; }
        .modal-error { margin: 12px 20px 0; background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 8px; padding: 10px 12px; font-weight: 600; }
        .modal-body { padding: 20px; }
        .modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 20px; border-top: 1px solid #dee2e6; }
        .text-muted { color: #6c757d; font-size: 0.875em; }
        .alert-info { background-color: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
        @media (max-width: 768px) { .filter-row { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

export default function AdminCBCSBasketPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading basket data...</p>
        </div>
      </div>
    }>
      <AdminCBCSBasketPageContent />
    </Suspense>
  );
}


