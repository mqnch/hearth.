"use client";

import Link from "next/link";
import Image from "next/image";

export default function Header() {
  return (
    <header 
      className="sticky top-0 z-50 w-full border-b border-[#D4A574]/20 backdrop-blur-sm"
      style={{
        background: 'linear-gradient(to bottom, rgba(255, 248, 231, 0.95) 0%, rgba(255, 248, 231, 0.3) 100%)'
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center">
          <Link 
            href="/" 
            className="flex items-center gap-2 text-[#5C4033] hover:text-[#D2691E] transition-colors"
          >
            <Image 
              src="/hearth.svg" 
              alt="hearth logo" 
              width={40} 
              height={40}
              className="h-10 w-10"
            />
            <span className="text-xl font-bold text-[#5C4033]">hearth.</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

