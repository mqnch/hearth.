"use client";

import { motion } from "framer-motion";
import type { PropertyAnalysis } from "../../../../lib/mock-data";

interface GalleryProps {
  analysis: PropertyAnalysis;
  selectedIndex: number;
  onImageSelect: (index: number) => void;
  generatingImages?: Set<number>;
  renovatedImages?: { [key: number]: string };
}

export default function Gallery({ 
  analysis, 
  selectedIndex, 
  onImageSelect,
  generatingImages = new Set(),
  renovatedImages = {}
}: GalleryProps) {
  if (!analysis.images || analysis.images.length === 0) {
    return (
      <div className="bg-white rounded-[1px] p-6 shadow-md border border-[#F5E6D3]">
        <h2 className="text-2xl font-bold text-[#5C4033] mb-4">
          Image Gallery
        </h2>
        <p className="text-[#B8860B]">No images available</p>
      </div>
    );
  }

  return (
    <motion.div 
      className="bg-white rounded-[1px] p-6 shadow-md border border-[#F5E6D3]"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <h2 className="text-2xl font-bold text-[#5C4033] mb-4">
        Image Gallery
      </h2>
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
        {analysis.images.map((image, index) => (
          <motion.button
            key={index}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut", delay: index * 0.05 }}
            onClick={() => onImageSelect(index)}
            className={`flex-shrink-0 rounded-[1px] overflow-hidden border-4 transition-all ${
              selectedIndex === index
                ? "border-[#D2691E] scale-105 shadow-lg"
                : "border-transparent hover:border-[#D4A574]"
            }`}
          >
            <div className="relative w-32 h-24">
              {image.original ? (
                <>
                  <img
                    src={image.original}
                    alt={`${image.label} thumbnail`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.error(`Failed to load image ${index}:`, image.original);
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  {/* Loading overlay */}
                  {generatingImages.has(index) && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="animate-spin rounded-[1px] h-6 w-6 border-b-2 border-white"></div>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  <span className="text-xs text-gray-500">No image</span>
                </div>
              )}
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
