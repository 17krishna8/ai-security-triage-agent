import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "TriageMind — memory-powered vulnerability triage",
  description: "An AI triage analyst that remembers every verdict, severity call, and human override.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-h-screen flex-1 overflow-x-hidden bg-slate-100">{children}</main>
        </div>
      </body>
    </html>
  );
}
