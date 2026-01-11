"use client";

import Image from "next/image";
import type { PropertyAnalysis } from "../../../../lib/mock-data";

interface GalleryProps {
  analysis: PropertyAnalysis;
  selectedIndex: number;
  onImageSelect: (index: number) => void;
}

export default function Gallery({ 
  analysis, 
  selectedIndex, 
  onImageSelect 
}: GalleryProps) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-md border border-[#E8F4FD]">
      <h2 className="text-2xl font-bold text-[#1E3A5F] mb-4">
        Image Gallery
      </h2>
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
        {analysis.images.map((image, index) => (
          <button
            key={index}
            onClick={() => onImageSelect(index)}
            className={`flex-shrink-0 rounded-lg overflow-hidden border-4 transition-all ${
              selectedIndex === index
                ? "border-[#4A90E2] scale-105 shadow-lg"
                : "border-transparent hover:border-[#6BA3E8]"
            }`}
          >
            <div className="relative w-32 h-24">
              <Image
                src={image.original}
                alt={`${image.label} thumbnail`}
                fill
                className="object-cover"
                sizes="128px"
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
