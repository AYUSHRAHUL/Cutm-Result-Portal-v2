"use client";

import { useEffect, useRef, useState } from "react";
import { appendSchoolParams, getSchoolApiUrl } from "@/lib/api-helper";

export default function AdminUploadPage() {
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const onScroll = () => {};
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function onFilesSelected(list) {
    const valid = [];
    const allowed = ["csv", "xls", "xlsx"];
    const existing = new Set(files.map(f => `${f.name}:${f.size}`));
    Array.from(list || []).forEach(f => {
      const ext = f.name.split(".").pop().toLowerCase();
      if (!allowed.includes(ext)) return;
      const key = `${f.name}:${f.size}`;
      if (!existing.has(key)) valid.push(f);
    });
    if (valid.length === 0) return;
    setFiles(prev => [...prev, ...valid]);
    setMessage(null); setError(null);
  }

  function removeAt(idx) { setFiles(prev => prev.filter((_, i) => i !== idx)); }

  async function onSubmit(e) {
    e.preventDefault();
    setMessage(null); setError(null);
    if (files.length === 0) { setError("Please select at least one file"); return; }

    try {
      setProgress(0); setStatus("Preparing files...");
      const form = new FormData();
      files.forEach(f => form.append("files", f));

      // Progress simulation for UX only (fetch doesn't expose upload progress)
      let pct = 0;
      const timer = setInterval(() => { pct = Math.min(90, pct + Math.random() * 15); setProgress(Math.floor(pct)); setStatus("Uploading..."); }, 180);

      const uploadUrl = getSchoolApiUrl("upload");
      const res = await fetch(uploadUrl, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      clearInterval(timer);
      setProgress(100);
      setStatus("Processing complete");

      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      
      // Enhanced success message with detailed results
      let successMessage = data.message || "Upload successful";
      if (data.results && data.results.length > 0) {
        successMessage += "\n\nFile Results:";
        data.results.forEach(result => {
          successMessage += `\n• ${result.filename}: ${result.inserted} inserted, ${result.updated} updated`;
        });
      }
      
      if (data.errors && data.errors.length > 0) {
        successMessage += "\n\nErrors:";
        data.errors.forEach(error => {
          successMessage += `\n• ${error}`;
        });
      }
      
      setMessage(successMessage);
      setFiles([]);
    } catch (err) {
      setError("Upload failed. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_30%,rgba(59,130,246,0.1),transparent_50%),radial-gradient(circle_at_80%_30%,rgba(16,185,129,0.08),transparent_50%),radial-gradient(circle_at_40%_70%,rgba(245,158,11,0.06),transparent_50%),radial-gradient(circle_at_60%_80%,rgba(139,92,246,0.08),transparent_50%)]">
      <div className="pt-16 pb-10">
        <div className="mx-auto max-w-5xl px-6">
          <header className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-3xl shadow-lg">☁️</div>
            <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-white to-blue-300 bg-clip-text text-transparent">Data Upload Center</h1>
            <p className="text-blue-100/80 mt-2">Upload CSV/XLS/XLSX files to update student records.</p>
          </header>

          {message && (
            <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2"><span>✅</span><span>{message}</span></div>
              <button onClick={() => setMessage(null)} className="opacity-75 hover:opacity-100">✕</button>
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2"><span>⚠️</span><span>{error}</span></div>
              <button onClick={() => setError(null)} className="opacity-75 hover:opacity-100">✕</button>
            </div>
          )}

          <form onSubmit={onSubmit}>
            <div
              className={`rounded-3xl border-2 ${dragOver ? "border-blue-400 bg-white/10" : "border-blue-400/50 bg-white/5"} border-dashed p-10 text-center transition-all relative`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
              onDrop={e => { e.preventDefault(); setDragOver(false); onFilesSelected(e.dataTransfer.files); }}
            >
              <div className="text-4xl text-blue-400 mb-3">⬆️</div>
              <div className="text-xl font-semibold text-white mb-1">Drag & Drop Files Here</div>
              <div className="text-blue-100/80 mb-4">or click to browse and select files</div>

              <div className="flex items-center justify-center gap-2 text-xs text-blue-100/80 mb-4 flex-wrap">
                <span className="rounded-md px-2 py-1 border border-white/10 bg-white/10">CSV</span>
                <span className="rounded-md px-2 py-1 border border-white/10 bg-white/10">XLS</span>
                <span className="rounded-md px-2 py-1 border border-white/10 bg-white/10">XLSX</span>
              </div>

              <button type="button" className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold shadow hover:from-blue-600 hover:to-blue-700" onClick={() => inputRef.current?.click()}>Browse Files</button>
              <input ref={inputRef} type="file" accept=".csv,.xls,.xlsx" multiple className="hidden" onChange={e => onFilesSelected(e.target.files)} />
            </div>

            {files.length > 0 && (
              <div className="mt-6 space-y-3" id="fileList">
                {files.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 p-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center">{iconFor(f.name)}</div>
                    <div className="flex-1">
                      <div className="text-white/90 text-sm font-semibold">{f.name}</div>
                      <div className="text-white/70 text-xs">{formatSize(f.size)}</div>
                    </div>
                    <button type="button" className="w-8 h-8 rounded-full border border-rose-400/40 text-rose-300 hover:bg-rose-500/10" onClick={() => removeAt(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {files.length > 0 && (
              <div className="mt-6 rounded-xl border border-white/10 bg-white/10 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-white font-semibold text-sm">Uploading Files...</div>
                  <div className="text-blue-200 font-bold text-sm">{progress}%</div>
                </div>
                <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-[width]" style={{ width: `${progress}%` }} />
                </div>
                <div className="text-white/70 text-xs mt-2">{status || "Preparing..."}</div>
              </div>
            )}

            <div className="flex items-center gap-3 mt-6 flex-wrap">
              <button type="submit" disabled={files.length === 0} className="px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold shadow disabled:opacity-50">Upload & Process</button>
              <a href="https://docs.google.com/spreadsheets/d/1hwmCRQwFYEUsCy_ZCov0yKS15PhrEGBK/edit?usp=sharing&ouid=104118655440603258258&rtpof=true&sd=true" target="_blank" rel="noreferrer" className="px-5 py-2.5 rounded-full border border-white/15 text-white/90 hover:bg-white/10">Download Template</a>
            </div>
          </form>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/10 p-6">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">ℹ️ Upload Guidelines</h3>
            <ul className="text-white/80 text-sm space-y-2">
              <li>Supported formats: CSV, XLS, XLSX files up to 50MB each</li>
              <li>Multiple files can be uploaded simultaneously for batch processing</li>
              <li><strong>Required columns:</strong> Reg_No, Subject_Code</li>
              <li><strong>Optional columns:</strong> Name, Sem, Subject_Name, Credits, Grade, Subject_Type</li>
              <li>Existing records with grades F, S, M, I, R will be updated</li>
              <li>New records will be inserted automatically</li>
              <li>Data validation performed automatically before database updates</li>
              <li>Progress tracking and detailed error reporting available</li>
              <li>All uploads are logged for security and audit purposes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function iconFor(name) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "csv") return "CSV";
  if (ext === "xls" || ext === "xlsx") return "XLS";
  return "FILE";
}

function formatSize(bytes) {
  if (!bytes) return "0 B";
  const k = 1024; const sizes = ["B", "KB", "MB", "GB"]; const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}


