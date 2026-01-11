"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PropertyAnalysis } from "../../../../lib/mock-data";

interface PropertySidebarProps {
  analysis: PropertyAnalysis;
}

export default function PropertySidebar({ analysis }: PropertySidebarProps) {
  const [newLink, setNewLink] = useState("");
  const [animatedScore, setAnimatedScore] = useState(0);
  const [showPotential, setShowPotential] = useState(false);
  const router = useRouter();
  const totalCost = analysis.originalPrice + analysis.renovationCost;

  const handleNewLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newLink.trim()) {
      // TODO: Navigate to analysis with new link
      router.push("/?url=" + encodeURIComponent(newLink));
    }
  };

  // Calculate animation percentage for accessibility score
  const currentScore = analysis.accessibilityScore.current;
  const potentialScore = analysis.accessibilityScore.potential || currentScore;
  const radius = 65;
  const scoreCircumference = 2 * Math.PI * radius;
  const circleSize = 180; // Size of the SVG container
  const circleCenter = circleSize / 2; // Center point for the circle
  
  // Animate the score: first to current, then to potential
  useEffect(() => {
    // Reset animation state
    setAnimatedScore(0);
    setShowPotential(false);

    // Phase 1: Animate to current score (1 second)
    const phase1Timeout = setTimeout(() => {
      setAnimatedScore(currentScore);
    }, 50); // Small delay to trigger animation

    // Phase 2: After current score animation completes, show potential and animate to potential score
    const phase2Timeout = setTimeout(() => {
      if (potentialScore > currentScore) {
        // First, show the potential circle at current score position (fade in)
        setShowPotential(true);
        // Then animate from currentScore to potentialScore after a brief delay
        // This ensures the green circle is visible at the starting position first
        setTimeout(() => {
          setAnimatedScore(potentialScore);
        }, 150); // Small delay to ensure green circle fades in at current position first
      }
    }, 1100); // Wait for phase 1 to complete (1000ms + 100ms buffer)

    return () => {
      clearTimeout(phase1Timeout);
      clearTimeout(phase2Timeout);
    };
  }, [currentScore, potentialScore]);

  const currentOffset = scoreCircumference - (currentScore / 100) * scoreCircumference;
  const potentialOffset = scoreCircumference - (potentialScore / 100) * scoreCircumference;
  
  // Calculate offset for blue circle (current score)
  const getCurrentCircleOffset = () => {
    if (!showPotential) {
      // Phase 1: animating from 0 to current score
      return scoreCircumference - (animatedScore / 100) * scoreCircumference;
    }
    // Phase 2: keep blue circle at current score (don't change it)
    return currentOffset;
  };
  
  // Calculate offset for green circle (potential score)
  const getPotentialCircleOffset = () => {
    if (!showPotential) {
      // Phase 1: green circle not visible yet, but prepare it at current position
      return currentOffset;
    }
    // Phase 2: animate from currentScore (where it started) to potentialScore
    // When showPotential becomes true, animatedScore is still currentScore
    // Then it animates to potentialScore
    return scoreCircumference - (animatedScore / 100) * scoreCircumference;
  };

  return (
    <div className="space-y-6">
      {/* Paste a new link */}
      <div className="bg-white rounded-lg p-4 shadow-md border border-[#E8F4FD]">
        <form onSubmit={handleNewLinkSubmit} className="flex gap-2">
          <Input
            type="url"
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
            placeholder="Enter new property URL"
            className="flex-1 text-base"
          />
          <Button type="submit" size="lg" className="bg-[#4A90E2] hover:bg-[#2C5F8D]">
            <Link2 className="h-5 w-5" />
          </Button>
        </form>
      </div>

      {/* Accessibility Score - Circular Display */}
      <div className="bg-white rounded-lg p-6 shadow-md border border-[#E8F4FD]">
        <h2 className="text-xl font-bold text-[#1E3A5F] mb-4 text-center">
          Accessibility Score
        </h2>
        <div className="flex justify-center mb-4">
          <div className="relative" style={{ width: `${circleSize}px`, height: `${circleSize}px` }}>
            {/* SVG Circle for score visualization */}
            <svg className="transform -rotate-90" width={circleSize} height={circleSize} style={{ width: `${circleSize}px`, height: `${circleSize}px` }}>
              {/* Background circle */}
              <circle
                cx={circleCenter}
                cy={circleCenter}
                r={radius}
                stroke="#E8F4FD"
                strokeWidth="10"
                fill="none"
              />
              {/* Current score circle (light blue) - animates first */}
              <circle
                cx={circleCenter}
                cy={circleCenter}
                r={radius}
                stroke="#6BA3E8"
                strokeWidth="10"
                fill="none"
                strokeDasharray={scoreCircumference}
                strokeDashoffset={getCurrentCircleOffset()}
                className="transition-all duration-1000 ease-out"
                strokeLinecap="round"
              />
              {/* Potential score circle (darker blue) - animates after current score */}
              {analysis.accessibilityScore.potential && potentialScore > currentScore && (
                <circle
                  cx={circleCenter}
                  cy={circleCenter}
                  r={radius}
                  stroke="#4A90E2"
                  strokeWidth="10"
                  fill="none"
                  strokeDasharray={scoreCircumference}
                  strokeDashoffset={getPotentialCircleOffset()}
                  className={`transition-all duration-1000 ease-out ${showPotential ? 'opacity-100' : 'opacity-0'}`}
                  strokeLinecap="round"
                />
              )}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl font-bold text-[#1E3A5F] transition-all duration-1000 ease-out">
                  {Math.round(animatedScore)}%
                </div>
                {analysis.accessibilityScore.potential && potentialScore > currentScore && showPotential && (
                  <div className="text-sm font-semibold mt-1 animate-in fade-in duration-500">
                    <span className="text-[#1E3A5F]">{currentScore}%</span>
                    <span className="text-[#6BA3E8] mx-1">→</span>
                    <span className="text-[#4A90E2]">{potentialScore}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="bg-white rounded-lg p-6 shadow-md border border-[#E8F4FD] space-y-4">
        <h2 className="text-xl font-bold text-[#1E3A5F] mb-4">
          Cost Breakdown
        </h2>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-base font-semibold text-[#2C5F8D]">
              Original Cost:
            </span>
            <span className="text-xl font-bold text-[#1E3A5F]">
              ${analysis.originalPrice.toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-base font-semibold text-[#2C5F8D]">
              Estimated Renovation:
            </span>
            <span className="text-xl font-bold text-[#4A90E2]">
              +${analysis.renovationCost.toLocaleString()}
            </span>
          </div>

          <div className="border-t border-[#6BA3E8] pt-3 mt-3">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-[#1E3A5F]">
                Total Cost:
              </span>
              <span className="text-2xl font-bold text-[#1E3A5F]">
                ${totalCost.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Info */}
      {analysis.additionalInfo && (
        <div className="bg-white rounded-lg p-6 shadow-md border border-[#E8F4FD] space-y-4">
          <h2 className="text-xl font-bold text-[#1E3A5F] mb-4">
            Additional Information
          </h2>
          
          <div className="space-y-3 text-base">
            <div className="flex justify-between">
              <span className="font-semibold text-[#2C5F8D]">Noise level:</span>
              <span className="text-[#1E3A5F]">{analysis.additionalInfo.noiseLevel}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-[#2C5F8D]">Average age:</span>
              <span className="text-[#1E3A5F]">{analysis.additionalInfo.averageAge}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-[#2C5F8D]">Air quality:</span>
              <span className="text-[#1E3A5F]">{analysis.additionalInfo.airQuality}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-[#2C5F8D]">Elevation:</span>
              <span className="text-[#1E3A5F]">{analysis.additionalInfo.elevation}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-[#2C5F8D]">Safety Index:</span>
              <span className="text-[#1E3A5F]">{analysis.additionalInfo.safetyIndex}</span>
            </div>
            <div className="pt-3 border-t border-[#6BA3E8]">
              <span className="font-semibold text-[#2C5F8D] block mb-2">
                Local amenities:
              </span>
              <ul className="space-y-1 text-[#1E3A5F]">
                {analysis.additionalInfo.localAmenities.map((amenity, index) => (
                  <li key={index} className="text-sm">
                    • {amenity}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
