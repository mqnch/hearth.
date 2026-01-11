"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import type { PropertyAnalysis } from "../../../../lib/mock-data";

interface TransformationViewerProps {
  analysis: PropertyAnalysis;
  selectedImageIndex?: number;
  originalImageUrl?: string;
  renovatedImageData?: string | null;
  isGenerating?: boolean;
  problemDescription?: string;
  solutionDescription?: string;
}

export default function TransformationViewer({
  analysis,
  selectedImageIndex = 0,
  originalImageUrl,
  renovatedImageData,
  isGenerating = false,
  problemDescription,
  solutionDescription,
}: TransformationViewerProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  
  // Use provided URLs/data or fall back to analysis images
  const mainImage = analysis.images[selectedImageIndex] || analysis.images[0] || {
    label: "Main Entryway",
    original: "",
    renovated: "",
  };

  // Normalize empty strings to null to avoid React warnings
  const beforeImage = (originalImageUrl || mainImage.original) || null;
  const afterImage = (renovatedImageData || mainImage.renovated) || null;

  return (
    <motion.div 
      className="bg-white rounded-[1px] p-6 shadow-md border border-[#F5E6D3] space-y-6"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* Title - Professional, Centered */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#5C4033] sm:text-3xl">
          {analysis.address}
        </h1>
      </div>

      {/* Before & After Comparison Slider */}
      <div className="relative w-full aspect-[3/2] rounded-[1px] overflow-hidden border-4 border-[#D4A574]">
        {beforeImage ? (
          afterImage ? (
            // Both images available - show slider
            <ReactCompareSlider
              itemOne={
                <div className="relative w-full h-full">
                  {sliderPosition > 0 && (
                    <div className="absolute top-4 left-4 z-20 bg-white/95 px-4 py-2 rounded-[1px] shadow-md border border-[#D4A574]">
                      <span className="text-xl font-bold text-[#5C4033]">
                        BEFORE
                      </span>
                    </div>
                  )}
                  <ReactCompareSliderImage
                    src={beforeImage}
                    alt="Before renovation"
                    style={{ objectFit: "cover", width: "100%", height: "100%" }}
                  />
                </div>
              }
              itemTwo={
                <div className="relative w-full h-full">
                  {sliderPosition < 100 && (
                    <div className="absolute top-4 right-4 z-20 bg-white/95 px-4 py-2 rounded-[1px] shadow-md border border-[#D4A574]">
                      <span className="text-xl font-bold text-[#5C4033]">
                        AFTER
                      </span>
                    </div>
                  )}
                  <ReactCompareSliderImage
                    src={afterImage}
                    alt="After renovation"
                    style={{ objectFit: "cover", width: "100%", height: "100%" }}
                  />
                </div>
              }
              position={sliderPosition}
              onPositionChange={setSliderPosition}
              style={{ height: "100%" }}
            />
          ) : (
            // Only original image available - show it with loading message
            <div className="relative w-full h-full">
              <img
                src={beforeImage}
                alt="Property image"
                className="w-full h-full object-cover"
              />
              {isGenerating && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <div className="bg-white/95 px-6 py-4 rounded-[1px] shadow-lg border border-[#D4A574]">
                    <p className="text-[#5C4033] text-lg font-semibold mb-1">
                      Generating renovation preview...
                    </p>
                    <p className="text-[#B8860B] text-sm">
                      Please wait while we create your transformation
                    </p>
                  </div>
                </div>
              )}
              {!isGenerating && (
                <div className="absolute bottom-4 left-4 bg-white/95 px-4 py-2 rounded-[1px] shadow-md border border-[#D4A574]">
                  <span className="text-sm font-semibold text-[#5C4033]">
                    Click image to generate renovation preview
                  </span>
                </div>
              )}
            </div>
          )
        ) : (
          // No image available - show loading state
          <div className="flex items-center justify-center w-full h-full bg-gray-100">
            <div className="text-center">
              <p className="text-[#5C4033] text-lg font-semibold mb-2">
                Loading image...
              </p>
              <p className="text-[#B8860B] text-sm">
                Please wait
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Problem Section */}
      {(problemDescription || (analysis.features[selectedImageIndex] && analysis.features[selectedImageIndex].name)) && (
        <div className="bg-white rounded-[1px] p-6 border border-[#D4A574] shadow-sm">
          <h3 className="text-l font-bold text-[#5C4033] mb-2">
            Problem
          </h3>
          <p className="text-[#B8860B] text-base leading-relaxed">
            {problemDescription || (analysis.features[selectedImageIndex] && analysis.features[selectedImageIndex].name) || "No problem detected"}
          </p>
        </div>
      )}

      {/* Solution Section */}
      {(solutionDescription || (analysis.features[selectedImageIndex] && analysis.features[selectedImageIndex].description)) && (
        <div className="bg-[#F5E6D3] rounded-[1px] p-6 border border-[#D4A574]">
          <h3 className="text-l font-bold text-[#5C4033] mb-2">
            Solution
          </h3>
          <p className="text-[#B8860B] text-base leading-relaxed">
            {solutionDescription || (analysis.features[selectedImageIndex] && analysis.features[selectedImageIndex].description) || "No solution provided"}
          </p>
        </div>
      )}
    </motion.div>
  );
}
