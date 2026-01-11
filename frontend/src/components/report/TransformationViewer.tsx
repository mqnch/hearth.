"use client";

import { useState } from "react";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import type { PropertyAnalysis } from "../../../../lib/mock-data";

interface TransformationViewerProps {
  analysis: PropertyAnalysis;
  selectedImageIndex?: number;
  originalImageUrl?: string;
  renovatedImageData?: string | null;
}

export default function TransformationViewer({
  analysis,
  selectedImageIndex = 0,
  originalImageUrl,
  renovatedImageData,
}: TransformationViewerProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  
  // Use provided URLs/data or fall back to analysis images
  const mainImage = analysis.images[selectedImageIndex] || analysis.images[0] || {
    label: "Main Entryway",
    original: "",
    renovated: "",
  };

  const beforeImage = originalImageUrl || mainImage.original;
  const afterImage = renovatedImageData || mainImage.renovated;

  return (
    <div className="bg-white rounded-lg p-6 shadow-md border border-[#E8F4FD] space-y-6">
      {/* Title - Professional, Centered */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#1E3A5F] sm:text-3xl">
          {analysis.address}
        </h1>
      </div>

      {/* Before & After Comparison Slider */}
      <div className="relative w-full h-[400px] rounded-lg overflow-hidden border-4 border-[#6BA3E8]">
        <ReactCompareSlider
          itemOne={
            <div className="relative w-full h-full">
              {sliderPosition > 0 && (
                <div className="absolute top-4 left-4 z-20 bg-white/95 px-4 py-2 rounded-lg shadow-md border border-[#6BA3E8]">
                  <span className="text-xl font-bold text-[#1E3A5F]">
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
                <div className="absolute top-4 right-4 z-20 bg-white/95 px-4 py-2 rounded-lg shadow-md border border-[#6BA3E8]">
                  <span className="text-xl font-bold text-[#1E3A5F]">
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
      </div>

      {/* Problem Section */}
      {analysis.features[0] && (
        <div className="bg-white rounded-sm p-6 border border-[#6BA3E8] shadow-sm">
          <h3 className="text-l font-bold text-[#1E3A5F] mb-2">
            Problem
          </h3>
          <p className="text-[#2C5F8D] text-base leading-relaxed">
            {analysis.features[0].name}
          </p>
        </div>
      )}

      {/* Solution Section */}
      {analysis.features[0] && (
        <div className="bg-[#E8F4FD] rounded-sm p-6 border border-[#6BA3E8]">
          <h3 className="text-l font-bold text-[#1E3A5F] mb-2">
            Solution
          </h3>
          <p className="text-[#2C5F8D] text-base leading-relaxed">
            {analysis.features[0].description}
          </p>
        </div>
      )}
    </div>
  );
}
