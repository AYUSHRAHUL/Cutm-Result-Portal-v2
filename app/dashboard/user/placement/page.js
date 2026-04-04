"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function PlacementPortal() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [placementData, setPlacementData] = useState(null);

    useEffect(() => {
        async function fetchPlacementData() {
            try {
                const response = await fetch("/api/user/placement", { credentials: "include" });
                const data = await response.json().catch(() => ({}));

                if (!response.ok || !data.eligible) {
                    router.replace("/dashboard/user");
                    return;
                }
                setPlacementData(data);
            } catch {
                router.replace("/dashboard/user");
            } finally {
                setLoading(false);
            }
        }

        fetchPlacementData();
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-lg animate-pulse">Loading Placement Profile...</p>
                </div>
            </div>
        );
    }

    if (!placementData) return null;

    const { offers, joinedCompany } = placementData;
    const offerCount = offers?.length || 0;

    // Calculate highest package
    const highestPackage = offers?.reduce((max, offer) => {
        const pkg = parseFloat(offer.package) || 0;
        return pkg > max ? pkg : max;
    }, 0) || 0;

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white pb-24 pt-12 px-4 shadow-lg">
                <div className="container mx-auto max-w-5xl">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6">
                        <button
                            onClick={() => router.push('/dashboard/user')}
                            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors mb-4 md:mb-0"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                            </svg>
                            Back to Dashboard
                        </button>
                        <div className="text-right">
                            <h1 className="text-3xl font-bold">My Placement Profile</h1>
                            <p className="text-white/80">Track your offers and career progress</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto max-w-5xl px-4 -mt-16">

                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Total Offers Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 flex items-center justify-between"
                    >
                        <div>
                            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Offers</p>
                            <h3 className="text-4xl font-bold text-gray-800 mt-1">{offerCount}</h3>
                        </div>
                        <div className={`p-4 rounded-full ${offerCount > 0 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </motion.div>

                    {/* Highest Package Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 flex items-center justify-between"
                    >
                        <div>
                            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Highest Package</p>
                            <h3 className="text-4xl font-bold text-blue-600 mt-1">₹{highestPackage} <span className="text-lg text-gray-400 font-normal">LPA</span></h3>
                        </div>
                        <div className={`p-4 rounded-full ${highestPackage > 0 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </motion.div>

                    {/* Joined Status Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className={`rounded-2xl shadow-lg p-6 border flex items-center justify-between ${joinedCompany ? 'bg-gradient-to-br from-green-500 to-green-600 text-white border-transparent' : 'bg-white border-gray-100'}`}
                    >
                        <div>
                            <p className={`text-sm font-semibold uppercase tracking-wider ${joinedCompany ? 'text-green-100' : 'text-gray-500'}`}>Journey Status</p>
                            <h3 className={`text-xl font-bold mt-2 ${joinedCompany ? 'text-white' : 'text-gray-800'}`}>
                                {joinedCompany ? 'OFFER ACCEPTED' : offerCount > 0 ? 'OFFERS RECEIVED' : 'OPEN TO WORK'}
                            </h3>
                            {joinedCompany && <p className="text-green-100 text-sm mt-1">Joined: {joinedCompany}</p>}
                        </div>
                        <div className={`p-3 rounded-full ${joinedCompany ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                    </motion.div>
                </div>

                {/* Offers List */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800 text-lg">My Offers</h3>
                        <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">{offerCount} Offers</span>
                    </div>

                    {offerCount === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                                💼
                            </div>
                            <p className="text-lg font-medium">No offers received yet.</p>
                            <p className="text-sm mt-2">Keep preparing and applying! Your opportunity is coming soon.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {offers.map((offer, index) => (
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.1 * index }}
                                    key={index}
                                    className={`p-6 hover:bg-gray-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${joinedCompany === offer.companyName ? 'bg-green-50/50' : ''}`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl uppercase flex-shrink-0">
                                            {offer.companyName.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                                {offer.companyName}
                                                {joinedCompany === offer.companyName && (
                                                    <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded border border-green-200">JOINED</span>
                                                )}
                                            </h4>
                                            <p className="text-gray-600 text-sm">{offer.jobRole}</p>

                                        </div>
                                    </div>

                                    <div className="text-right flex flex-col items-end">
                                        <div className="text-2xl font-bold text-gray-800">
                                            ₹{offer.package} <span className="text-sm font-normal text-gray-500">LPA</span>
                                        </div>
                                        <div className={`mt-1 text-xs font-semibold px-2 py-1 rounded inline-block ${offer.status?.toLowerCase() === 'selected' ? 'bg-green-100 text-green-700' :
                                            offer.status?.toLowerCase() === 'shortlisted' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {offer.status || 'Selected'}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
