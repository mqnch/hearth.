"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { MOCK_ANALYSIS, PropertyAnalysis } from "../../../../lib/mock-data";
import PropertySidebar from "@/components/report/PropertySidebar";
import TransformationViewer from "@/components/report/TransformationViewer";
import Gallery from "@/components/report/Gallery";
import LoadingSkeleton from "@/components/report/LoadingSkeleton";

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

interface AuditData {
  barrier: string;
  renovation_suggestion: string;
  cost_estimate: string;
  compliance_notes: string;
  accessibility_score: number;
  image_gen_prompt?: string;
  mask_prompt?: string;
  clear_mask?: string;
  clear_prompt?: string;
  build_mask?: string;
  build_prompt?: string;
  [key: string]: unknown;
}

interface ImageResult {
  image_number: number;
  original_url: string;
  audit: AuditData;
  error?: string;
}

interface ListingAnalysisResult {
  property_info: PropertyInfo;
  total_images_found: number;
  images_analyzed: number;
  results: ImageResult[];
}

export default function ReportPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [analysis, setAnalysis] = useState<PropertyAnalysis>(MOCK_ANALYSIS);
  const [listingResult, setListingResult] = useState<ListingAnalysisResult | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [generatingImages, setGeneratingImages] = useState<Set<number>>(new Set());
  const [renovatedImages, setRenovatedImages] = useState<{ [key: number]: string }>({});
  const [imageIndexMap, setImageIndexMap] = useState<Map<number, number>>(new Map()); // Maps gallery index to original result index
  const inFlightRequests = useRef<Map<number, AbortController>>(new Map());
  const router = useRouter();

  useEffect(() => {
    // Read listing analysis result from localStorage
    const storedListingResult = localStorage.getItem("listingAnalysisResult");

    if (storedListingResult) {
      try {
        const result: ListingAnalysisResult = JSON.parse(storedListingResult);
        setListingResult(result);

        // Include all images that were successfully analyzed
        // Filter to only show images with identified problems for features/costs
        // CRITICAL FIX: Create mapping between gallery indices and original result indices
        const allAnalyzedImages: Array<{ image: ImageResult; originalIndex: number }> = [];
        const indexMap = new Map<number, number>(); // gallery index -> original result index
        
        result.results.forEach((r, originalIndex) => {
          if (r.audit && !r.error) {
            const galleryIndex = allAnalyzedImages.length;
            allAnalyzedImages.push({ image: r, originalIndex });
            indexMap.set(galleryIndex, originalIndex);
          }
        });
        
        const imagesWithProblems = allAnalyzedImages.filter(({ image: r }) => {
          // Check if barrier is meaningful (not N/A, empty, or "none")
          const barrier = r.audit?.barrier?.toLowerCase() || '';
          if (!barrier || barrier === 'n/a' || barrier === 'none' || barrier === 'no barrier') {
            return false;
          }
          return true;
        });

        // Log for debugging
        console.log('Total results:', result.results.length);
        console.log('Successfully analyzed:', allAnalyzedImages.length);
        console.log('Images with problems:', imagesWithProblems.length);
        console.log('Index mapping:', Array.from(indexMap.entries()));
        
        // Store the index mapping
        setImageIndexMap(indexMap);
        
        // Load persisted generated images from localStorage
        const persistedImagesKey = `renovatedImages_${result.property_info.address || 'default'}`;
        try {
          const persisted = localStorage.getItem(persistedImagesKey);
          if (persisted) {
            const parsed = JSON.parse(persisted);
            setRenovatedImages(parsed);
            console.log('Loaded persisted images:', Object.keys(parsed).length);
          }
        } catch (e) {
          console.warn('Failed to load persisted images:', e);
        }

        // Calculate total renovation cost from images with problems
        const totalRenovationCost = imagesWithProblems.reduce((sum, imageResult) => {
          if (imageResult.audit && imageResult.audit.cost_estimate) {
            // Parse cost estimate (e.g., "$1,500 - $3,000" -> average)
            const match = imageResult.audit.cost_estimate.match(/\$?([\d,]+)/g);
            if (match) {
              const costs = match.map(c => parseFloat(c.replace(/[$,]/g, '')));
              const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length;
              return sum + avgCost;
            }
          }
          return sum;
        }, 0);

        // Calculate average accessibility score from images with problems
        const avgAccessibilityScore = imagesWithProblems.length > 0
          ? imagesWithProblems.reduce((sum, imageResult) => {
              return sum + (imageResult.audit?.accessibility_score || 0);
            }, 0) / imagesWithProblems.length
          : 100;

        // Transform to PropertyAnalysis format for existing components
        const transformedAnalysis: PropertyAnalysis = {
          id: "listing-analysis",
          address: result.property_info.address || "Property Analysis",
          originalPrice: parseFloat(result.property_info.price?.replace(/[$,]/g, '') || '0'),
          renovationCost: totalRenovationCost,
          accessibilityScore: {
            current: Math.round(100 - avgAccessibilityScore), // Round to whole number
            potential: Math.round(avgAccessibilityScore), // Round to whole number
          },
          features: imagesWithProblems.map(({ image: r }, idx) => ({
            name: r.audit.barrier || "Accessibility Barrier",
            riskLevel: "High" as const,
            description: r.audit.renovation_suggestion || "",
          })),
          // Show ALL analyzed images, not just ones with problems
          images: allAnalyzedImages.map(({ image: r }, idx) => ({
            label: `Room ${idx + 1}`,
            original: r.original_url || "",
            renovated: r.original_url || "", // Will be replaced when user clicks
          })),
        };

        setAnalysis(transformedAnalysis);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to parse listing analysis result:", error);
        setIsLoading(false);
      }
    } else {
      // No stored result, redirect to home
      router.push("/");
    }
  }, [router]);

  const handleImageClick = async (imageIndex: number) => {
    // If image already generated, just select it
    if (renovatedImages[imageIndex]) {
      setSelectedImageIndex(imageIndex);
      return;
    }

    // Cancel any in-flight request for this image
    const existingController = inFlightRequests.current.get(imageIndex);
    if (existingController) {
      console.log(`Cancelling existing request for image ${imageIndex}`);
      existingController.abort();
      inFlightRequests.current.delete(imageIndex);
    }

    // If request already in progress, don't start another
    if (generatingImages.has(imageIndex)) {
      console.log(`Request already in progress for image ${imageIndex}`);
      setSelectedImageIndex(imageIndex);
      return;
    }

    // CRITICAL FIX: Use mapped index to access correct result
    const originalIndex = imageIndexMap.get(imageIndex);
    if (originalIndex === undefined) {
      console.error(`No mapping found for gallery index ${imageIndex}`);
      setSelectedImageIndex(imageIndex);
      return;
    }

    // If no listing result, can't generate
    if (!listingResult || !listingResult.results[originalIndex]) {
      console.error(`No result found at original index ${originalIndex}`);
      setSelectedImageIndex(imageIndex);
      return;
    }

    const imageResult = listingResult.results[originalIndex];

    // Validate that imageResult has required fields
    if (!imageResult.audit) {
      console.error(`No audit data for image at index ${originalIndex}`);
      setSelectedImageIndex(imageIndex);
      return;
    }

    // Check if audit data has prompts for generation
    if (!imageResult.audit.image_gen_prompt || !imageResult.audit.mask_prompt) {
      console.warn("No generation prompts available for this image");
      setSelectedImageIndex(imageIndex);
      return;
    }

    // Create AbortController for this request
    const abortController = new AbortController();
    inFlightRequests.current.set(imageIndex, abortController);

    // Set loading state for this specific image
    setGeneratingImages(prev => new Set(prev).add(imageIndex));
    setSelectedImageIndex(imageIndex);

    try {
      console.log(`Generating renovation for gallery index ${imageIndex} (original index ${originalIndex})`);
      // Get wheelchair_accessible flag from localStorage
      const wheelchairAccessible = JSON.parse(localStorage.getItem("wheelchairAccessible") || "false");

      const response = await fetch("http://localhost:8000/generate-renovation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: imageResult.original_url,
          audit_data: imageResult.audit,
          wheelchair_accessible: wheelchairAccessible,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Generation failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.renovated_image) {
        // Cache the generated image
        const updatedImages = {
          ...renovatedImages,
          [imageIndex]: result.renovated_image,
        };
        setRenovatedImages(updatedImages);

        // Persist to localStorage
        if (listingResult?.property_info?.address) {
          try {
            const persistedImagesKey = `renovatedImages_${listingResult.property_info.address}`;
            localStorage.setItem(persistedImagesKey, JSON.stringify(updatedImages));
          } catch (e) {
            console.warn('Failed to persist images to localStorage:', e);
          }
        }

        // Update the analysis images with the renovated version
        setAnalysis(prev => ({
          ...prev,
          images: prev.images.map((img, idx) =>
            idx === imageIndex
              ? { ...img, renovated: result.renovated_image }
              : img
          ),
        }));
        
        console.log(`Successfully generated and cached image for index ${imageIndex}`);
      } else {
        const errorMsg = result.error || "Unknown error";
        console.error("Image generation failed:", errorMsg);
        // Show user-friendly error (could be enhanced with toast notification)
        alert(`Failed to generate renovation preview: ${errorMsg}`);
      }
    } catch (error: any) {
      // Don't log aborted requests as errors
      if (error.name === 'AbortError') {
        console.log(`Request for image ${imageIndex} was aborted`);
        return;
      }
      console.error("Error generating renovation image:", error);
      alert(`Error generating renovation preview: ${error.message || 'Network error'}`);
    } finally {
      // Clean up
      inFlightRequests.current.delete(imageIndex);
      setGeneratingImages(prev => {
        const next = new Set(prev);
        next.delete(imageIndex);
        return next;
      });
    }
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[#FFF8E7]">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Left Sidebar - 1/3 width */}
          <aside className="w-full lg:w-1/3">
            <PropertySidebar analysis={analysis} propertyInfo={listingResult?.property_info} />
          </aside>

          {/* Right Main Area - 2/3 width */}
          <main className="w-full lg:w-2/3 space-y-8">
            <TransformationViewer
              analysis={analysis}
              selectedImageIndex={selectedImageIndex}
              originalImageUrl={analysis.images[selectedImageIndex]?.original || ""}
              renovatedImageData={renovatedImages[selectedImageIndex] || null}
              isGenerating={generatingImages.has(selectedImageIndex)}
              problemDescription={
                (() => {
                  const originalIndex = imageIndexMap.get(selectedImageIndex);
                  if (originalIndex !== undefined && listingResult?.results[originalIndex]?.audit) {
                    return listingResult.results[originalIndex].audit.barrier || 
                           listingResult.results[originalIndex].audit.problem_description ||
                           listingResult.results[originalIndex].audit.barrier_detected;
                  }
                  return undefined;
                })()
              }
              solutionDescription={
                (() => {
                  const originalIndex = imageIndexMap.get(selectedImageIndex);
                  if (originalIndex !== undefined && listingResult?.results[originalIndex]?.audit) {
                    return listingResult.results[originalIndex].audit.renovation_suggestion ||
                           listingResult.results[originalIndex].audit.solution_description;
                  }
                  return undefined;
                })()
              }
            />
            <Gallery
              analysis={analysis}
              selectedIndex={selectedImageIndex}
              onImageSelect={handleImageClick}
              generatingImages={generatingImages}
              renovatedImages={renovatedImages}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
