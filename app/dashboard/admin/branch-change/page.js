"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { appendSchoolParams } from "@/lib/api-helper";

const BTECH_BRANCHES = [
  "Civil Engineering",
  "Computer Science Engineering",
  "Electronics & Communication Engineering",
  "Electrical & Electronics Engineering",
  "Mechanical Engineering",
  "AIML",
];

const DIPLOMA_BRANCHES = [
  "Civil Engineering",
  "Computer Science Engineering",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Automobile Engineering",
  "Mining Engineering"
];

const BATCHES = ["2022", "2023", "2024", "2025", "2026", "2027", "2028"];

function BranchChangeContent() {
  const searchParams = useSearchParams();
  const school = searchParams.get("school");
  const isDiploma = school === "SOVET";
  const branchOptions = isDiploma ? DIPLOMA_BRANCHES : BTECH_BRANCHES;

  const [reg, setReg] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState(null);
  const [target, setTarget] = useState("");
  const [targetBatch, setTargetBatch] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [overrides, setOverrides] = useState([]);
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [overridesError, setOverridesError] = useState("");

  async function lookup(e) {
    e.preventDefault();
    setErr(""); setMsg(""); setInfo(null);
    if (!reg) { setErr("Enter registration number"); return; }
    try {
      setLoading(true);
      const url = appendSchoolParams(`/api/branch-change?reg=${encodeURIComponent(reg)}`);
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      setInfo(data);
      // Set default to "-" (No Change) when lookup is done
      setTarget("-");
      setTargetBatch("-");
    } catch (e) {
      setErr(e.message);
    } finally { setLoading(false); }
  }

  async function loadOverrides() {
    try {
      setLoadingOverrides(true);
      setOverridesError("");
      const url = appendSchoolParams("/api/branch-change?all=1");
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load overrides");
      setOverrides(data.overrides || []);
    } catch (e) {
      setOverridesError(e.message);
    } finally {
      setLoadingOverrides(false);
    }
  }

  // Load recent overrides on mount
  useEffect(() => {
    loadOverrides();
  }, []);

  async function applyChange(e) {
    e.preventDefault();
    setErr(""); setMsg("");
    if (!reg) { setErr("Enter registration number"); return; }

    // Check if both are set to "-" (No Change)
    if (target === "-" && targetBatch === "-") {
      setErr("Please select a branch or batch to change, or choose a different option");
      return;
    }

    try {
      setLoading(true);
      // Send fields - "-" means no change (don't send), other values mean update
      const payload = { reg };
      if (target !== "-" && target !== "") {
        payload.newBranch = target;
      } else if (target === "-") {
        // "-" means remove override (set to null)
        payload.newBranch = null;
      }

      if (targetBatch !== "-" && targetBatch !== "") {
        payload.newBatch = targetBatch;
      } else if (targetBatch === "-") {
        // "-" means remove override (set to null)
        payload.newBatch = null;
      }

      const url = appendSchoolParams("/api/branch-change");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setMsg("Override saved successfully.");
      setInfo(prev => ({
        ...prev,
        override: target === "-" ? null : (target !== "-" && target ? target : prev?.override || null),
        overrideBatch: targetBatch === "-" ? null : (targetBatch !== "-" && targetBatch ? targetBatch : prev?.overrideBatch || null)
      }));
      // Reset to default "-" after save
      setTarget("-");
      setTargetBatch("-");
      // Refresh list
      loadOverrides();
    } catch (e) {
      setErr(e.message);
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#0a4b78]">Branch Change</h1>
          <Link href="/dashboard/admin" className="text-sm text-blue-600 hover:underline">← Back</Link>
        </div>

        {err && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        {msg && <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{msg}</div>}

        <form onSubmit={lookup} className="space-y-3">
          <label className="block text-sm font-medium">Registration No</label>
          <input
            value={reg}
            onChange={e => setReg(e.target.value.toUpperCase())}
            placeholder="e.g., 220101130056"
            className="w-full rounded-md border px-3 py-2"
          />
          <button disabled={loading} className="rounded-md bg-blue-600 text-white px-4 py-2">
            {loading ? "Loading..." : "Lookup"}
          </button>
        </form>

        {/* Recent Overrides */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#0a4b78]">Recent Overrides (Branch/Batch)</h2>
            <button
              onClick={loadOverrides}
              disabled={loadingOverrides}
              className="px-3 py-1.5 rounded-md bg-blue-500 text-white text-sm"
            >
              {loadingOverrides ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          {overridesError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {overridesError}
            </div>
          )}
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Reg No</th>
                  <th className="px-3 py-2 text-left">Original Branch</th>
                  <th className="px-3 py-2 text-left">Branch Override</th>
                  <th className="px-3 py-2 text-left">Original Batch</th>
                  <th className="px-3 py-2 text-left">Batch Override</th>
                  <th className="px-3 py-2 text-left">Updated</th>
                </tr>
              </thead>
              <tbody>
                {(overrides || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-center text-gray-500">
                      {loadingOverrides ? "Loading..." : "No overrides found."}
                    </td>
                  </tr>
                ) : (
                  overrides.map((o) => (
                    <tr key={`${o.reg}-${o.updatedAt || ""}`} className="border-t">
                      <td className="px-3 py-2 font-semibold">{o.reg}</td>
                      <td className="px-3 py-2 text-blue-600">{o.originalBranch || "—"}</td>
                      <td className="px-3 py-2 text-orange-600 font-medium">{o.branch || "—"}</td>
                      <td className="px-3 py-2 text-blue-600">{o.originalBatch || "—"}</td>
                      <td className="px-3 py-2 text-orange-600 font-medium">{o.batch || "—"}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {o.updatedAt ? new Date(o.updatedAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {info && (
          <div className="space-y-4 border-t pt-4">
            {/* Original Branch & Batch Section */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-[#0a4b78]">Original Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-md bg-blue-50 border-2 border-blue-200 p-3">
                  <div className="text-xs text-blue-600 font-medium mb-1">Original Branch</div>
                  <div className="font-semibold text-[#0a4b78]">{info.originalBranch || info.detected || "N/A"}</div>
                </div>
                <div className="rounded-md bg-blue-50 border-2 border-blue-200 p-3">
                  <div className="text-xs text-blue-600 font-medium mb-1">Original Batch</div>
                  <div className="font-semibold text-[#0a4b78]">{info.originalBatch || info.detectedBatch || "N/A"}</div>
                </div>
              </div>
            </div>

            {/* Override Section */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-[#0a4b78]">Override Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-md bg-orange-50 border-2 border-orange-200 p-3">
                  <div className="text-xs text-orange-600 font-medium mb-1">Branch Override</div>
                  <div className="font-semibold text-orange-700">{info.override || "—"}</div>
                </div>
                <div className="rounded-md bg-orange-50 border-2 border-orange-200 p-3">
                  <div className="text-xs text-orange-600 font-medium mb-1">Batch Override</div>
                  <div className="font-semibold text-orange-700">{info.overrideBatch || "—"}</div>
                </div>
              </div>
            </div>

            <form onSubmit={applyChange} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium">Set New Branch</label>
                  <select value={target} onChange={e => setTarget(e.target.value)} className="w-full rounded-md border px-3 py-2">
                    <option value="-">— (No Change)</option>
                    {branchOptions.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Set New Batch</label>
                  <select value={targetBatch} onChange={e => setTargetBatch(e.target.value)} className="w-full rounded-md border px-3 py-2">
                    <option value="-">— (No Change)</option>
                    {BATCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              <button disabled={loading || (target === "-" && targetBatch === "-")} className="rounded-md bg-green-600 text-white px-4 py-2">
                {loading ? "Saving..." : "Save Override"}
              </button>
              <p className="text-xs text-gray-600">
                Select a branch or batch to set override. "— (No Change)" will remove existing override. All panels and reports will reflect the changes immediately.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BranchChangePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading branch change...</p>
        </div>
      </div>
    }>
      <BranchChangeContent />
    </Suspense>
  );
}


