"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { appendSchoolParams, getSchoolApiUrl } from "@/lib/api-helper";
import { useSearchParams } from "next/navigation";

function AdminCBCSIndexContent() {
  const searchParams = useSearchParams();
  const isDiploma = searchParams.get("school") === "SOVET";
  const isSom = searchParams.get("school") === "SOM";
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [selectedSemester, setSelectedSemester] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");


  // Available semesters
  const semesters = [
    'Sem 1', 'Sem 2', 'Sem 3', 'Sem 4',
    'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8'
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

      const url = getSchoolApiUrl("upload/registration");
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadMessage(`Success! ${result.message}`);
        setUploadFile(null);
        setSelectedSemester("");
        const fileInput = document.getElementById('registrationFile');
        if (fileInput) fileInput.value = '';
      } else {
        let errorMsg = `Error: ${result.error}`;
        if (result.debugInfo) {
          errorMsg += `\n\nDebug Info:\n- Total rows: ${result.debugInfo.totalRows}\n- Available columns: ${result.debugInfo.availableColumns?.join(', ')}\n- Sample row: ${JSON.stringify(result.debugInfo.sampleRow, null, 2)}`;
        }
        setUploadMessage(errorMsg);
      }
    } catch (error) {
      setUploadMessage(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="min-h-screen pb-10"
      style={{
        background: "linear-gradient(to bottom, #F5F8FA 0%, #E8F4F8 50%, #D1E9F6 100%)",
      }}
    >
      <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 pt-6 sm:pt-8 lg:pt-12">
        {/* Header */}
        <div className="mb-6 sm:mb-8 text-center">
          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-black mb-2"
            style={{
              background: "linear-gradient(135deg, #05A3C7 0%, #04748F 50%, #023945 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            📚 CBCS Management
          </h2>
          <p className="text-[#5A6C7D] text-sm sm:text-base font-medium">
            Manage CBCS subjects and registration data
          </p>
        </div>

        {/* Management Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* CBCS Management */}
          <div
            className="rounded-xl sm:rounded-2xl border-2 p-4 sm:p-5 lg:p-6 shadow-lg"
            style={{ borderColor: "rgba(5,163,199,0.2)", background: "white" }}
          >
            <h2 className="text-lg sm:text-xl font-black text-[#1A1F29] mb-3 sm:mb-4 flex items-center gap-2">
              🗂️ CBCS Management
            </h2>
            <p className="text-[#5A6C7D] mb-4 text-xs sm:text-sm">
              Manage CBCS subjects and baskets
            </p>
            <div className="flex flex-col gap-2 sm:gap-3">
              <Link
                href={`/dashboard/admin/data/basket?${searchParams.toString()}`}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95 min-h-[44px]"
                style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
              >
                🗂️ View Baskets
              </Link>
              {isDiploma ? (
                <Link
                  href={`/dashboard/admin/data/baskettrack/diploma?${searchParams.toString()}`}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95 min-h-[44px]"
                  style={{ background: "linear-gradient(135deg, #FF9966, #FF5E62)" }}
                >
                  🎓 Track Progress (Diploma)
                </Link>
              ) : isSom ? (
                <Link
                  href={`/dashboard/admin/data/baskettrack?${searchParams.toString()}`}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95 min-h-[44px]"
                  style={{ background: "linear-gradient(135deg, #FF9966, #FF5E62)" }}
                >
                  🎓 Track Progress (SOM)
                </Link>
              ) : (
                <Link
                  href={`/dashboard/admin/data/baskettrack?${searchParams.toString()}`}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95 min-h-[44px]"
                  style={{ background: "linear-gradient(135deg, #56ab2f, #a8e6cf)" }}
                >
                  📊 Track Progress (B.Tech)
                </Link>
              )}
            </div>
          </div>

          {/* Registration Data Management */}
          <div
            className="rounded-xl sm:rounded-2xl border-2 p-4 sm:p-5 lg:p-6 shadow-lg"
            style={{ borderColor: "rgba(5,163,199,0.2)", background: "white" }}
          >
            <h2 className="text-lg sm:text-xl font-black text-[#1A1F29] mb-3 sm:mb-4 flex items-center gap-2">
              📊 Registration Data
            </h2>
            <p className="text-[#5A6C7D] mb-4 text-xs sm:text-sm">
              View and manage student registration data
            </p>
            <div className="flex flex-col gap-2 sm:gap-3">
              <Link
                href={`/dashboard/admin/data/viewer?${searchParams.toString()}`}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95 min-h-[44px]"
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
              >
                👁️ View Registration Data
              </Link>
              <button
                onClick={() => setShowUploadModal(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-bold transition-all hover:shadow-lg active:scale-95 min-h-[44px]"
                style={{ background: "linear-gradient(135deg, #ff6b6b, #feca57)" }}
              >
                📤 Upload Registration Data
              </button>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div
          className="rounded-xl sm:rounded-2xl border-2 p-4 sm:p-5 lg:p-6 mb-6 sm:mb-8 shadow-lg"
          style={{ borderColor: "rgba(5,163,199,0.2)", background: "rgba(5,163,199,0.05)" }}
        >
          <h3 className="text-base sm:text-lg font-black text-[#1A1F29] mb-3 sm:mb-4 flex items-center gap-2">
            ℹ️ Data Management Info
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
            <div>
              <h4 className="font-bold text-[#1A1F29] mb-2">📤 Registration Data Upload:</h4>
              <ul className="text-[#5A6C7D] space-y-1">
                <li>• Updates only the selected semester</li>
                <li>• Preserves data from other semesters</li>
                <li>• Uses smart update/insert strategy</li>
                <li>• No data loss for other semesters</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-[#1A1F29] mb-2">📊 Results Data Upload:</h4>
              <ul className="text-[#5A6C7D] space-y-1">
                <li>• Updates existing records with failed grades</li>
                <li>• Inserts new records automatically</li>
                <li>• Supports CSV and Excel formats</li>
                <li>• Batch processing for multiple files</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl sm:rounded-2xl p-5 sm:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg sm:text-xl font-black text-[#1A1F29] mb-4 flex items-center gap-2">
                📤 Upload Registration Data
              </h3>

              <div className="mb-4 sm:mb-6">
                <h4 className="font-bold text-[#1A1F29] mb-2 text-sm">📋 Expected Format:</h4>
                <div
                  className="rounded-lg p-3 text-xs text-left overflow-x-auto"
                  style={{ background: "rgba(5,163,199,0.1)" }}
                >
                  <div className="font-mono text-[10px] sm:text-xs whitespace-pre">
                    <div className="font-bold text-[#05A3C7]">Sr. | Rollno | Name | Subject | Code | Type | Credit</div>
                    <div className="text-[#5A6C7D] mt-2">
                      Example:<br />
                      1 | 220101120188 | Subrata Das | ROBOTIC AUTOMATION | CUTM1020 | PP | 1
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleFileUpload}>
                <div className="mb-4">
                  <label className="block text-sm font-bold text-[#1A1F29] mb-2">
                    Select Semester:
                  </label>
                  <select
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(e.target.value)}
                    className="w-full px-3 py-2.5 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-sm min-h-[44px]"
                    style={{ borderColor: "rgba(5,163,199,0.3)" }}
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
                  <label className="block text-sm font-bold text-[#1A1F29] mb-2">
                    Select CSV/Excel File:
                  </label>
                  <input
                    id="registrationFile"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    className="w-full px-3 py-2 border-2 rounded-lg focus:ring-4 focus:ring-[#05A3C7]/20 outline-none text-sm"
                    style={{ borderColor: "rgba(5,163,199,0.3)" }}
                    required
                  />
                </div>

                {uploadMessage && (
                  <div className={`mb-4 p-3 rounded-lg text-xs sm:text-sm whitespace-pre-line ${uploadMessage.includes('Success') ? 'bg-green-100 text-green-700 border-2 border-green-200' : 'bg-red-100 text-red-700 border-2 border-red-200'
                    }`}>
                    {uploadMessage}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadMessage("");
                      setUploadFile(null);
                      setSelectedSemester("");
                    }}
                    className="flex-1 px-4 py-2.5 border-2 rounded-lg font-bold transition-all hover:bg-gray-50 active:scale-95 text-sm min-h-[44px]"
                    style={{ borderColor: "rgba(5,163,199,0.3)", color: "#1A1F29" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || !selectedSemester || !uploadFile}
                    className="flex-1 px-4 py-2.5 rounded-lg text-white font-bold transition-all hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm min-h-[44px]"
                    style={{ background: "linear-gradient(135deg, #05A3C7 0%, #04748F 100%)" }}
                  >
                    {uploading ? 'Uploading...' : 'Upload'}
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

export default function AdminCBCSIndex() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading data tools...</p>
        </div>
      </div>
    }>
      <AdminCBCSIndexContent />
    </Suspense>
  );
}
