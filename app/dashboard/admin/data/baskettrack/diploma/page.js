"use client";
import { Suspense } from "react";
import { BasketTrackerContent } from "../page";

export default function DiplomaBasketTracker() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading diploma basket progress...</p>
                </div>
            </div>
        }>
            <BasketTrackerContent schoolType="diploma" />
        </Suspense>
    );
}
