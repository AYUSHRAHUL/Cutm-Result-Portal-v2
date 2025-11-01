import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavbarWrapper from "@/components/NavbarWrapper";
import FooterWrapper from "@/components/FooterWrapper";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ✅ Enhanced SEO Metadata
export const metadata = {
  title: "CUTM Acadmic Tracker",
  description:
    "Access your CUTM results, AOD (Analysis of Data) reports, and backlog details easily through the official CUTM Result Portal. Designed for students of Centurion University.",
  keywords: [
    "CUTM Result Portal",
    "Centurion University Results",
    "CUTM AOD Portal",
    "CUTM Backlog Portal",
    "Result Portal CUTM",
    "CUTM University Results",
    "CUTM Exam Portal",
    "Centurion Result Portal",
    "CUTM Bhubaneswar Result",
    "CUTM Student Portal",
    "CUTM Grade Report",
    "CUTM Academic Results",
    "CUTM Exam Results",
    "CUTM Backlog Information",
    "CUTM AOD Reports",
    "Centurion University Exam Results",
    "CUTM Official Results",
    "CUTM Result Checker",
    "CUTM Results Online",
    "CUTM Exam Scores",
    "CUTM Result System", 
    "cutm",
    "CUTM",
    "Cutm erp"
  ],
  authors: [{ name: "CUTM Result Portal Team" }],
  creator: "CUTM Result Portal",
  publisher: "Centurion University of Technology and Management",

  // ✅ For Google / SEO
  alternates: {
    canonical: "https://cutm-result-portal-v2.vercel.app/",
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      maxVideoPreview: -1,
      maxImagePreview: "large",
      maxSnippet: -1,
    },
  },

  // ✅ Open Graph for social media (Facebook, WhatsApp, LinkedIn)
  openGraph: {
    title: "CUTM Result Portal | Centurion University Results",
    description:
      "Get your Centurion University (CUTM) results, AOD reports, and backlog details in one place.",
    url: "https://cutm-result-portal-v2.vercel.app/",
    siteName: "CUTM Result Portal",
    images: [
      {
        url: "https://cutm-result-portal-v2.vercel.app/og-image.png", // replace with your actual image
        width: 1200,
        height: 630,
        alt: "CUTM Result Portal Preview",
      },
    ],
    locale: "en_IN",
    type: "website",
  },

  // ✅ Twitter metadata
  twitter: {
    card: "summary_large_image",
    title: "CUTM Result Portal | Official AOD & Backlog Portal",
    description:
      "View your Centurion University results, AOD data, and backlog details instantly on the CUTM Result Portal.",
    creator: "@CUTM",
    images: ["https://cutm-result-portal-v2.vercel.app//og-image.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-svh flex flex-col">
          <NavbarWrapper />
          <main className="flex-1">
            {children}
            <Analytics />
          </main>
          <FooterWrapper />
        </div>
      </body>
    </html>
  );
}
 