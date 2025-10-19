"use client";

import Link from "next/link";
import { useState } from "react";

export default function AdminCBCSIndex() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [selectedSemester, setSelectedSemester] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  // Available semesters
  const semesters = [
    'Semester 1', 'Semester 2', 'Semester 3', 'Semester 4',
    'Semester 5', 'Semester 6', 'Semester 7', 'Semester 8'
  ];

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadMessage("Please select a file to upload");
      return;
    }
    
    if (!selectedSemester) {
      setUploadMessage("Please select a semester for the registration data");
      return;
    }

    setUploading(true);
    setUploadMessage("");

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('semester', selectedSemester);

      const response = await fetch('/api/upload/registration', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (response.ok) {
        setUploadMessage(`✅ Success! ${result.message}`);
        setUploadFile(null);
        setSelectedSemester("");
        // Reset file input
        const fileInput = document.getElementById('registrationFile');
        if (fileInput) fileInput.value = '';
      } else {
        let errorMsg = `❌ Error: ${result.error}`;
        if (result.debugInfo) {
          errorMsg += `\n\nDebug Info:\n- Total rows: ${result.debugInfo.totalRows}\n- Available columns: ${result.debugInfo.availableColumns?.join(', ')}\n- Sample row: ${JSON.stringify(result.debugInfo.sampleRow, null, 2)}`;
        }
        setUploadMessage(errorMsg);
      }
    } catch (error) {
      setUploadMessage(`❌ Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen text-gray-900 flex items-center justify-center bg-[linear-gradient(135deg,#667eea_0%,#764ba2_100%)] p-6">
      <div className="w-full max-w-4xl rounded-3xl bg-white p-10 shadow-[0_20px_40px_rgba(0,0,0,0.1)] text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#2c3e50] mb-4">📚 Data Management</h1>
        <p className="text-[#6c757d] mb-8 text-base leading-relaxed">Manage CBCS subjects and registration data</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* CBCS Management */}
          <div className="bg-gray-50 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-[#2c3e50] mb-4">🗂️ CBCS Management</h2>
            <p className="text-[#6c757d] mb-4 text-sm">Manage CBCS subjects and baskets</p>
            <div className="flex flex-col gap-3">
              <Link href="/dashboard/admin/data/basket" className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-semibold transition-transform hover:-translate-y-0.5 shadow-[0_8px_20px_rgba(102,126,234,0.4)]" style={{ background: "linear-gradient(45deg, #667eea, #764ba2)" }}>
                🗂️ View Baskets
              </Link>
              <Link href="/dashboard/admin/data/baskettrack" className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-semibold transition-transform hover:-translate-y-0.5 shadow-[0_8px_20px_rgba(86,171,47,0.4)]" style={{ background: "linear-gradient(45deg, #56ab2f, #a8e6cf)" }}>
                📊 Track Progress
              </Link>
            </div>
          </div>

          {/* Registration Data Upload */}
          <div className="bg-gray-50 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-[#2c3e50] mb-4">📤 Registration Data</h2>
            <p className="text-[#6c757d] mb-4 text-sm">Upload student registration data</p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-semibold transition-transform hover:-translate-y-0.5 shadow-[0_8px_20px_rgba(255,107,107,0.4)]"
              style={{ background: "linear-gradient(45deg, #ff6b6b, #feca57)" }}
            >
              📤 Upload Registration Data
            </button>
          </div>
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full">
              <h3 className="text-xl font-bold text-[#2c3e50] mb-4">📤 Upload Registration Data</h3>
              
              <div className="mb-6">
                <h4 className="font-semibold text-gray-700 mb-2">📋 Expected Format:</h4>
                <div className="bg-gray-100 rounded-lg p-3 text-sm text-left">
                  <div className="font-mono text-xs">
                    <div>Sr. | Rollno | Name | Subject | Code | Type | Credit</div>
                    <div className="text-gray-500 mt-1">
                      Example:<br/>
                      1 | 220101120188 | Subrata Das | ROBOTIC AUTOMATION | CUTM1020 | PP | 1<br/>
                      2 | 220101120188 | Subrata Das | ROBOTIC AUTOMATION | CUTM1020 | PR | 2
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleFileUpload}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Semester:
                  </label>
                  <select
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Choose a semester...</option>
                    {semesters.map((sem) => (
                      <option key={sem} value={sem}>
                        {sem}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select CSV/Excel File:
                  </label>
                  <input
                    id="registrationFile"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {uploadMessage && (
                  <div className={`mb-4 p-3 rounded-lg text-sm whitespace-pre-line ${
                    uploadMessage.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {uploadMessage}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadMessage("");
                      setUploadFile(null);
                      setSelectedSemester("");
                    }}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || !selectedSemester || !uploadFile}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="mt-8">
          <Link href="/dashboard/admin" className="text-[#6c757d] hover:text-[#495057]">← Back to Admin</Link>
        </div>
      </div>
    </div>
  );
}


