"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Link2, Home, Bed, Bath, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PropertyAnalysis } from "../../../../lib/mock-data";

interface PropertyInfo {
  address: string;
  price: string;
  bedrooms: string;
  bathrooms: string;
  square_feet: string;
  mls_number: string;
  neighborhood: string;
  location: string;
  amenities: string[];
}

interface PropertySidebarProps {
  analysis: PropertyAnalysis;
  propertyInfo?: PropertyInfo;
}

export default function PropertySidebar({ analysis, propertyInfo }: PropertySidebarProps) {
  const [newLink, setNewLink] = useState("");
  const [animatedScore, setAnimatedScore] = useState(0);
  const [showPotential, setShowPotential] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const totalCost = analysis.originalPrice + analysis.renovationCost;

  const handleNewLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLink.trim()) return;

    setIsLoading(true);
    try {
      // Get wheelchair accessible preference from localStorage
      const wheelchairAccessible = JSON.parse(localStorage.getItem("wheelchairAccessible") || "false");

      // Make API call to analyze the listing
      const response = await fetch("http://localhost:8000/analyze-from-listing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listing_url: newLink.trim(),
          max_images: 6,
          wheelchair_accessible: wheelchairAccessible
        }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.job_id) {
        // Navigate to report page with job_id for background processing
        router.push(`/report?job_id=${result.job_id}`);
        return;
      }

      if ('error' in result) {
        throw new Error(result.error as string);
      }

      if (result.results && result.results.length > 0) {
        // Store the result in localStorage
        localStorage.setItem("listingAnalysisResult", JSON.stringify(result));
        localStorage.setItem("wheelchairAccessible", JSON.stringify(wheelchairAccessible));
        // Force a hard reload to ensure the page updates with new data
        window.location.href = "/report";
      } else if (result.total_images_found === 0) {
        throw new Error("No images found in listing. Please try a different URL.");
      } else {
        throw new Error(`Analysis failed: Found ${result.total_images_found} images but none could be analyzed.`);
      }
    } catch (err) {
      console.error("Failed to analyze listing:", err);
      alert(err instanceof Error ? err.message : "An error occurred during analysis");
      setIsLoading(false);
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
      <motion.div 
        className="bg-white rounded-[1px] p-4 shadow-md border border-[#F5E6D3]"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <form onSubmit={handleNewLinkSubmit} className="flex gap-2">
          <Input
            type="url"
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
            placeholder="Enter new listing URL"
            className="flex-1 text-base"
          />
          <Button type="submit" size="lg" className="bg-[#D2691E] hover:bg-[#B8860B]" disabled={isLoading}>
            {isLoading ? (
              <div className="animate-spin rounded-[1px] h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <Link2 className="h-5 w-5" />
            )}
          </Button>
        </form>
      </motion.div>

      {/* Property Information */}
      {propertyInfo && (
        <motion.div 
          className="bg-white rounded-[1px] p-6 shadow-md border border-[#F5E6D3] space-y-4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut", delay: 0.1 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Home className="h-5 w-5 text-[#D2691E]" />
            <h2 className="text-xl font-bold text-[#5C4033]">Property Details</h2>
          </div>

          <div className="space-y-3">
            {propertyInfo.address && (
              <div>
                <div className="text-sm font-semibold text-[#B8860B] mb-1">Address</div>
                <div className="text-base text-[#5C4033]">{propertyInfo.address}</div>
              </div>
            )}

            {propertyInfo.price && (
              <div>
                <div className="text-sm font-semibold text-[#B8860B] mb-1">Price</div>
                <div className="text-xl font-bold text-[#D2691E] font-mono">
                  {(() => {
                    // Extract numeric value and format with commas
                    const numericValue = propertyInfo.price.replace(/[$,]/g, '');
                    const num = parseFloat(numericValue);
                    if (isNaN(num)) return propertyInfo.price; // Return original if not a valid number
                    return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
                  })()}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-2">
              {propertyInfo.bedrooms && (
                <div className="flex items-center gap-2">
                  <Bed className="h-4 w-4 text-[#D4A574]" />
                  <div>
                    <div className="text-xs text-[#B8860B]">Bedrooms</div>
                    <div className="text-sm font-semibold text-[#5C4033]">{propertyInfo.bedrooms}</div>
                  </div>
                </div>
              )}

              {propertyInfo.bathrooms && (
                <div className="flex items-center gap-2">
                  <Bath className="h-4 w-4 text-[#D4A574]" />
                  <div>
                    <div className="text-xs text-[#B8860B]">Bathrooms</div>
                    <div className="text-sm font-semibold text-[#5C4033]">{propertyInfo.bathrooms}</div>
                  </div>
                </div>
              )}

              {propertyInfo.square_feet && (
                <div className="flex items-center gap-2 col-span-2">
                  <Maximize className="h-4 w-4 text-[#D4A574]" />
                  <div>
                    <div className="text-xs text-[#B8860B]">Square Feet</div>
                    <div className="text-sm font-semibold text-[#5C4033]">{propertyInfo.square_feet}</div>
                  </div>
                </div>
              )}
            </div>

            {propertyInfo.amenities && propertyInfo.amenities.length > 0 && (
              <div className="pt-2 border-t border-[#F5E6D3]">
                <div className="text-sm font-semibold text-[#B8860B] mb-2">Nearby Amenities</div>
                <ul className="space-y-1">
                  {propertyInfo.amenities.slice(0, 5).map((amenity, idx) => (
                    <li key={idx} className="text-xs text-[#5C4033]">• {amenity}</li>
                  ))}
                </ul>
              </div>
            )}

            {propertyInfo.mls_number && (
              <div className="pt-2 border-t border-[#F5E6D3]">
                <div className="text-xs text-[#D4A574] font-mono">MLS® {propertyInfo.mls_number}</div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Accessibility Score - Circular Display */}
      <motion.div 
        className="bg-white rounded-[1px] p-6 shadow-md border border-[#F5E6D3]"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut", delay: 0.2 }}
      >
        <h2 className="text-xl font-bold text-[#5C4033] mb-4 text-center">
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
                stroke="#F5E6D3"
                strokeWidth="10"
                fill="none"
              />
              {/* Current score circle (light blue) - animates first */}
              <circle
                cx={circleCenter}
                cy={circleCenter}
                r={radius}
                stroke="#D4A574"
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
                  stroke="#D2691E"
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
                <div className="text-3xl font-bold text-[#5C4033] transition-all duration-1000 ease-out font-mono">
                  {Math.round(animatedScore)}%
                </div>
                {analysis.accessibilityScore.potential && potentialScore > currentScore && showPotential && (
                  <div className="text-sm font-semibold mt-1 animate-in fade-in duration-500">
                    <span className="text-[#5C4033] font-mono">{currentScore}%</span>
                    <span className="text-[#D4A574] mx-1">→</span>
                    <span className="text-[#D2691E] font-mono">{potentialScore}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Cost Breakdown */}
      <motion.div 
        className="bg-white rounded-[1px] p-6 shadow-md border border-[#F5E6D3] space-y-4"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut", delay: 0.3 }}
      >
        <h2 className="text-xl font-bold text-[#5C4033] mb-4">
          Cost Breakdown
        </h2>
        
        <div className="space-y-6">
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-[#B8860B] mb-1">
              Original Cost
            </span>
            <div className="flex justify-between items-baseline">
              <div className="h-px flex-1 bg-[#F5E6D3] mr-4 opacity-50" />
              <span className="text-xl font-bold text-[#5C4033] font-mono">
                ${analysis.originalPrice.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-[#B8860B] mb-1">
              Estimated Renovation
            </span>
            <div className="flex flex-col items-end gap-1">
              {analysis.renovationCostRange ? (
                <>
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-bold text-[#D4A574] uppercase">Low end</span>
                    <span className="text-xl font-bold text-[#D2691E] font-mono">
                      +${analysis.renovationCostRange.low.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-bold text-[#D4A574] uppercase">High end</span>
                    <span className="text-xl font-bold text-[#D2691E] font-mono">
                      +${analysis.renovationCostRange.high.toLocaleString()}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <div className="h-px flex-1 bg-[#F5E6D3] mr-4 opacity-50" />
                  <span className="text-xl font-bold text-[#D2691E] font-mono">
                    +${analysis.renovationCost.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5C4033] mb-2 block">
              Total Projected Cost
            </span>
            <div className="bg-[#FFF8E7] p-4 rounded-[1px] border-2 border-[#D4A574] shadow-inner relative overflow-hidden">
              <div className="absolute top-0 right-0 p-1 opacity-10">
                <Home size={40} className="text-[#5C4033]" />
              </div>
              <div className="flex flex-col items-end gap-1 relative z-10">
                {analysis.renovationCostRange ? (
                  <>
                    <span className="text-2xl font-black text-[#5C4033] font-mono">
                      ${(analysis.originalPrice + analysis.renovationCostRange.low).toLocaleString()}
                    </span>
                    <div className="flex items-center gap-2 w-full">
                      <div className="h-px flex-1 bg-[#D4A574] opacity-30" />
                      <span className="text-[10px] font-bold text-[#D4A574] uppercase tracking-widest">to</span>
                      <div className="h-px flex-1 bg-[#D4A574] opacity-30" />
                    </div>
                    <span className="text-2xl font-black text-[#5C4033] font-mono">
                      ${(analysis.originalPrice + analysis.renovationCostRange.high).toLocaleString()}
                    </span>
                  </>
                ) : (
                  <span className="text-3xl font-black text-[#5C4033] font-mono">
                    ${totalCost.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Additional Info */}
      {analysis.additionalInfo && (
        <motion.div 
          className="bg-white rounded-[1px] p-6 shadow-md border border-[#F5E6D3] space-y-4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut", delay: 0.4 }}
        >
          <h2 className="text-xl font-bold text-[#5C4033] mb-4">
            Additional Information
          </h2>
          
          <div className="space-y-3 text-base">
            <div className="flex justify-between">
              <span className="font-semibold text-[#B8860B]">Noise level:</span>
              <span className="text-[#5C4033]">{analysis.additionalInfo.noiseLevel}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-[#B8860B]">Average age:</span>
              <span className="text-[#5C4033]">{analysis.additionalInfo.averageAge}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-[#B8860B]">Air quality:</span>
              <span className="text-[#5C4033]">{analysis.additionalInfo.airQuality}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-[#B8860B]">Elevation:</span>
              <span className="text-[#5C4033]">{analysis.additionalInfo.elevation}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-[#B8860B]">Safety Index:</span>
              <span className="text-[#5C4033]">{analysis.additionalInfo.safetyIndex}</span>
            </div>
            <div className="pt-3 border-t border-[#D4A574]">
              <span className="font-semibold text-[#B8860B] block mb-2">
                Local amenities:
              </span>
              <ul className="space-y-1 text-[#5C4033]">
                {analysis.additionalInfo.localAmenities.map((amenity, index) => (
                  <li key={index} className="text-sm">
                    • {amenity}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
