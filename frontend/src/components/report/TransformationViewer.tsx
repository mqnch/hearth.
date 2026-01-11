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
    <div className="bg-white rounded-lg p-6 shadow-sm space-y-6">
      {/* Title - Large, Centered */}
      <div className="text-center">
        <h1 className="font-heading text-4xl font-bold text-slate-900 sm:text-5xl">
          {analysis.address}
        </h1>
        {analysis.features[0] && (
          <p className="mt-2 text-lg text-slate-600">
            {analysis.features[0].name}
          </p>
        )}
      </div>

      {/* Before & After Comparison Slider */}
      <div className="relative w-full h-[600px] rounded-lg overflow-hidden border-4 border-slate-200">
        <ReactCompareSlider
          itemOne={
            <div className="relative w-full h-full">
              {sliderPosition > 0 && (
                <div className="absolute top-4 left-4 z-20 bg-white/90 px-4 py-2 rounded-lg shadow-sm">
                  <span className="font-heading text-xl font-bold text-slate-900">
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
                <div className="absolute top-4 right-4 z-20 bg-white/90 px-4 py-2 rounded-lg shadow-sm">
                  <span className="font-heading text-xl font-bold text-slate-900">
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

      {/* Renovation Details */}
      {analysis.features[0] && (
        <div className="bg-slate-50 rounded-lg p-4">
          <h3 className="font-heading text-lg font-semibold text-slate-900 mb-2">
            Recommended Renovation
          </h3>
          <p className="text-slate-700">
            {analysis.features[0].description}
          </p>
        </div>
      )}
    </div>
  );
}
