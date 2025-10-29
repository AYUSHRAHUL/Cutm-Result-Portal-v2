"use client";

import { useState } from "react";
import Link from "next/link";

const BRANCHES = [
  "Civil Engineering",
  "Computer Science Engineering",
  "Electronics & Communication Engineering",
  "Electrical & Electronics Engineering",
  "Mechanical Engineering",
  "AIML",
];

export default function BranchChangePage() {
  const [reg, setReg] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState(null);
  const [target, setTarget] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function lookup(e) {
    e.preventDefault();
    setErr(""); setMsg(""); setInfo(null);
    if (!reg) { setErr("Enter registration number"); return; }
    try {
      setLoading(true);
      const res = await fetch(`/api/branch-change?reg=${encodeURIComponent(reg)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      setInfo(data);
      setTarget(data.override || data.detected || "");
    } catch (e) {
      setErr(e.message);
    } finally { setLoading(false); }
  }

  async function applyChange(e) {
    e.preventDefault();
    setErr(""); setMsg("");
    if (!reg || !target) { setErr("Select a new branch"); return; }
    try {
      setLoading(true);
      const res = await fetch("/api/branch-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reg, newBranch: target })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setMsg("Branch override saved successfully.");
      setInfo(prev => ({ ...prev, override: target }));
    } catch (e) {
      setErr(e.message);
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6 space-y-6">
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
            onChange={e=>setReg(e.target.value.toUpperCase())}
            placeholder="e.g., 220101130056"
            className="w-full rounded-md border px-3 py-2"
          />
          <button disabled={loading} className="rounded-md bg-blue-600 text-white px-4 py-2">
            {loading ? "Loading..." : "Lookup"}
          </button>
        </form>

        {info && (
          <div className="space-y-4 border-t pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-md bg-gray-50 p-3">
                <div className="text-xs text-gray-500">Detected (current)</div>
                <div className="font-semibold">{info.detected || "N/A"}</div>
              </div>
              <div className="rounded-md bg-gray-50 p-3">
                <div className="text-xs text-gray-500">Existing Override</div>
                <div className="font-semibold">{info.override || "—"}</div>
              </div>
            </div>

            <form onSubmit={applyChange} className="space-y-3">
              <label className="block text-sm font-medium">Set New Branch</label>
              <select value={target} onChange={e=>setTarget(e.target.value)} className="w-full rounded-md border px-3 py-2">
                <option value="">Select Branch</option>
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <button disabled={loading || !target} className="rounded-md bg-green-600 text-white px-4 py-2">
                {loading ? "Saving..." : "Save Override"}
              </button>
              <p className="text-xs text-gray-600">
                This creates an override for this registration. All panels and reports will reflect the new branch immediately.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}


