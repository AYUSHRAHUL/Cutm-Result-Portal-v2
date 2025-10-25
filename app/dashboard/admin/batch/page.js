"use client";

import { useMemo, useState } from "react";

export default function AdminBatchPage() {
  const [branch, setBranch] = useState("");
  const [batch, setBatch] = useState("");
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);


  async function onSubmit(e) {
    e.preventDefault();
    setMessage(""); setError(""); setRows([]); setCount(0);
    try {
      setLoading(true);
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch, batch })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No data found");
      const records = data.records || data.result || [];
      setRows(records);
      setCount(records.length);
      setMessage(data.message || `${records.length} records loaded`);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }

  function exportCSV() {
    if (rows.length === 0) return;
    const keys = ["Reg_No","Name","Sem","Subject_Code","Subject_Name","Credits","Grade"];
    const csv = [keys.join(",")]
      .concat(rows.map(r => {
        const record = { ...r, Credits: computeCreditsSum(r.Credits) };
        return keys.map(k => escapeCsv(record[k] ?? "")).join(",");
      }))
      .join("\n");
    downloadBlob(csv, `batch_${branch || "all"}_${batch || "all"}.csv`, "text/csv;charset=utf-8;");
  }

  function exportExcel() {
    if (rows.length === 0) return;
    const header = ["Reg No","Name","Semester","Subject Code","Subject Name","Credits","Grade"];
    const table = [header].concat(rows.map(r => [r.Reg_No,r.Name,r.Sem,r.Subject_Code,r.Subject_Name,computeCreditsSum(r.Credits),r.Grade]));
    // Simple HTML table Excel-compatible
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><table>${table.map(row => `<tr>${row.map(c => `<td>${String(c ?? "").toString().replace(/&/g,'&amp;').replace(/</g,'&lt;')}</td>`).join("")}</tr>`).join("")}</table></body></html>`;
    downloadBlob(html, `batch_${branch || "all"}_${batch || "all"}.xls`, "application/vnd.ms-excel");
  }

  async function exportPDF() {
    if (rows.length === 0) return;
    // Lightweight PDF via print dialog
    const w = window.open("", "_blank");
    if (!w) return;
    const rowsHtml = rows.map(r => `<tr><td>${r.Reg_No}</td><td>${r.Name}</td><td>${r.Sem}</td><td>${r.Subject_Code}</td><td>${r.Subject_Name}</td><td>${computeCreditsSum(r.Credits)}</td><td>${r.Grade}</td></tr>`).join("");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Batch Export</title><style>table{width:100%;border-collapse:collapse}td,th{border:1px solid #000;padding:6px;text-align:left}th{background:#eee}</style></head><body><h2>Batch Data</h2><p>Generated: ${new Date().toLocaleString()}</p><table><thead><tr><th>Reg No</th><th>Name</th><th>Sem</th><th>Subject Code</th><th>Subject Name</th><th>Credits</th><th>Grade</th></tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#667eea_0%,#764ba2_100%)] text-gray-900 pb-12">
      <div className="max-w-6xl mx-auto px-6 pt-16">
        <a href="/dashboard/admin" className="inline-block mb-4 px-4 py-2 rounded-full bg-white/90 text-indigo-700 border border-indigo-400 font-semibold">← Back to Admin</a>

        <div className="rounded-2xl overflow-hidden shadow-xl bg-white">
          <div className="p-6 bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
            <h2 className="text-2xl font-bold">Batch Data Portal</h2>
            <p className="opacity-90">View student data by branch and batch</p>
          </div>
          <div className="p-6">
            <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block font-semibold mb-1">Branch</label>
                <select className="w-full border-2 rounded-lg p-2" value={branch} onChange={e => setBranch(e.target.value)}>
                  <option value="">Select Branch</option>
                  <option value="Civil">Civil Engineering</option>
                  <option value="CSE">Computer Science Engineering</option>
                  <option value="ECE">Electronics & Communication Engineering</option>
                  <option value="EEE">Electrical & Electronics Engineering</option>
                  <option value="Mechanical">Mechanical Engineering</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Batch (Year)</label>
                <input className="w-full border-2 rounded-lg p-2" placeholder="e.g., 2021 or 21" value={batch} onChange={e => setBatch(e.target.value)} />
              </div>
              <div className="md:col-span-2 text-center">
                <button className="inline-flex items-center gap-2 btn-primary px-6 py-2 rounded-full text-white font-semibold bg-gradient-to-r from-indigo-500 to-purple-500" disabled={loading}>
                  {loading ? <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : null}
                  {loading ? "Loading..." : "Get Batch Data"}
                </button>
              </div>
            </form>

            {error && <div className="mt-4 p-3 rounded-xl bg-rose-100 text-rose-700">{error}</div>}
            {message && <div className="mt-4 p-3 rounded-xl bg-indigo-50 text-indigo-700">{message}</div>}

            {rows.length > 0 && (
              <div className="mt-6">
                <div className="rounded-2xl p-4 border-2 bg-gray-50">
                  <h5 className="font-bold text-indigo-700 mb-3 text-center">Export Results</h5>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button onClick={exportCSV} className="export-btn px-4 py-2 rounded-full text-white font-semibold" style={{ background: "linear-gradient(135deg,#28a745,#20c997)" }}>Download CSV</button>
                    <button onClick={exportExcel} className="export-btn px-4 py-2 rounded-full text-white font-semibold" style={{ background: "linear-gradient(135deg,#fd7e14,#ffc107)" }}>Download Excel</button>
                    <button onClick={exportPDF} className="export-btn px-4 py-2 rounded-full text-white font-semibold" style={{ background: "linear-gradient(135deg,#dc3545,#e83e8c)" }}>Download PDF</button>
                    <button onClick={() => window.print()} className="export-btn px-4 py-2 rounded-full text-white font-semibold" style={{ background: "linear-gradient(135deg,#6c757d,#495057)" }}>Print Results</button>
                  </div>
                </div>


                <div className="mt-4 overflow-auto rounded-2xl border">
                  <table className="table table-hover w-full min-w-[900px]">
                    <thead>
                      <tr>
                        {['Reg No','Name','Semester','Subject Code','Subject Name','Credits','Grade'].map(h => (
                          <th key={h} className="px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r,i) => (
                        <tr key={i} className="odd:bg-white even:bg-gray-50">
                          <td className="px-3 py-2 text-indigo-700 font-semibold">{r.Reg_No}</td>
                          <td className="px-3 py-2">{r.Name}</td>
                          <td className="px-3 py-2">{r.Sem}</td>
                          <td className="px-3 py-2"><code>{r.Subject_Code}</code></td>
                          <td className="px-3 py-2">{r.Subject_Name}</td>
                          <td className="px-3 py-2 text-center">{computeCreditsSum(r.Credits)}</td>
                          <td className="px-3 py-2 text-center">{r.Grade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <style jsx global>{`
        @media print {
          a[href], button { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function aggregate(list, keyFn) {
  const map = {};
  for (const item of list || []) {
    const k = keyFn(item) || "Unknown";
    map[k] = (map[k] || 0) + 1;
  }
  return map;
}

function computeCreditsSum(credits) {
  if (credits === null || credits === undefined) return "";
  const s = String(credits).trim();
  if (s === "") return "";
  // If already a number-like string
  if (/^\d+(\.\d+)?$/.test(s)) {
    const num = parseFloat(s);
    return Number.isInteger(num) ? String(Math.floor(num)) : String(num);
  }
  // Split by + or whitespace, sum numeric parts
  const parts = s.split(/[+\s]+/).map(p => p.trim()).filter(Boolean);
  const sum = parts.reduce((acc, p) => acc + (parseFloat(p) || 0), 0);
  return Number.isFinite(sum) ? (Number.isInteger(sum) ? String(Math.floor(sum)) : String(sum)) : s;
}

function shortBranch(branch) {
  if (!branch) return "Unknown";
  if (branch.includes("Computer")) return "CSE";
  if (branch.includes("Electronics") && branch.includes("Communication")) return "ECE";
  if (branch.includes("Electrical")) return "EEE";
  if (branch.includes("Civil")) return "Civil";
  if (branch.includes("Mechanical")) return "Mechanical";
  return branch;
}

function escapeCsv(val) {
  const s = String(val ?? "");
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
  return s;
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}


