"use client";

import Link from "next/link";
import { Home } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#6BA3E8]/20 bg-[#F0F7FF]/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center">
          <Link 
            href="/" 
            className="flex items-center gap-2 text-[#1E3A5F] hover:text-[#4A90E2] transition-colors"
          >
            {/* Temporary logo - simple home icon */}
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#4A90E2] text-white">
              <Home className="h-6 w-6" />
            </div>
            <span className="text-xl font-bold text-[#1E3A5F]">hearth.</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

