"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
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
  renovated_image?: string; // Base64 data URI for renovated image
}

interface ListingAnalysisResult {
  property_info: PropertyInfo;
  total_images_found: number;
  images_analyzed: number;
  results: ImageResult[];
}

interface JobStatus {
  job_id: string;
  status: "processing" | "completed" | "failed";
  audit_progress: number;
  generation_progress: number;
  current_status: string;
  total_images: number;
  property_info?: PropertyInfo;
  results: ImageResult[];
  error?: string;
}

export default function ReportPage() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job_id");
  
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<PropertyAnalysis>(MOCK_ANALYSIS);
  const [listingResult, setListingResult] = useState<ListingAnalysisResult | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [generatingImages, setGeneratingImages] = useState<Set<number>>(new Set());
  const [renovatedImages, setRenovatedImages] = useState<{ [key: number]: string }>({});
  const [imageIndexMap, setImageIndexMap] = useState<Map<number, number>>(new Map()); // Maps gallery index to original result index
  const inFlightRequests = useRef<Map<number, AbortController>>(new Map());
  const router = useRouter();

  // Job status tracking for Processing Hub
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [ellipsis, setEllipsis] = useState(".");
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>("");
  const startTimeRef = useRef<number | null>(null);

  // Animated ellipsis effect
  useEffect(() => {
    if (!isProcessing) return;

    const ellipsisInterval = setInterval(() => {
      setEllipsis((prev) => {
        if (prev === ".") return "..";
        if (prev === "..") return "...";
        return ".";
      });
    }, 500); // Change every 500ms

    return () => clearInterval(ellipsisInterval);
  }, [isProcessing]);

  // Polling effect for job status
  useEffect(() => {
    if (!jobId) return;

    setIsProcessing(true);
    setIsLoading(false);
    
    // Record start time on first poll
    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }

    const pollJobStatus = async () => {
      try {
        const response = await fetch(`http://localhost:8000/job-status/${jobId}`);
        if (!response.ok) {
          if (response.status === 404) {
            setJobError("Job not found");
            setIsProcessing(false);
            return;
          }
          throw new Error(`Failed to fetch job status: ${response.statusText}`);
        }

        const status: JobStatus = await response.json();
        setJobStatus(status);
        
        // Calculate estimated time remaining
        if (startTimeRef.current !== null && status.status === "processing") {
          const elapsed = (Date.now() - startTimeRef.current) / 1000; // seconds
          // Use average of audit and generation progress
          const avgProgress = (status.audit_progress + status.generation_progress) / 2;
          
          if (avgProgress > 0) {
            const estimatedTotal = elapsed / (avgProgress / 100);
            const remaining = Math.max(0, estimatedTotal - elapsed);
            
            // Format time remaining (minutes only, rounded up)
            const minutes = Math.ceil(remaining / 60);
            
            if (minutes > 0) {
              setEstimatedTimeRemaining(`~${minutes} min remaining`);
            } else {
              setEstimatedTimeRemaining("Less than 1 min remaining");
            }
          } else {
            setEstimatedTimeRemaining("Calculating...");
          }
        }

        // If completed, transition to normal report view
        if (status.status === "completed") {
          // Transform results to ListingAnalysisResult format
          const propertyInfo = status.property_info || {
            address: "Property Analysis",
            price: "Unknown",
            bedrooms: "Unknown",
            bathrooms: "Unknown",
            square_feet: "Unknown",
            mls_number: "Unknown",
            neighborhood: "Unknown",
            location: "",
            amenities: []
          };

          const listingResult: ListingAnalysisResult = {
            property_info: propertyInfo,
            total_images_found: status.total_images,
            images_analyzed: status.results.length,
            results: status.results.map((r, idx) => {
              // Strip out renovated_image to avoid localStorage quota issues
              // Base64 images can be very large (1-5MB+ each)
              const { renovated_image, ...resultWithoutImage } = r;
              return {
                ...resultWithoutImage,
                image_number: idx + 1,
                audit: r.audit || {
                  barrier: "",
                  renovation_suggestion: "",
                  cost_estimate: "",
                  compliance_notes: "",
                  accessibility_score: 0
                }
              };
            })
          };

          // Store in localStorage (without renovated_image fields to avoid quota issues)
          // Strip the large base64 strings before storing
          const strippedResults = listingResult.results.map(r => {
            const { renovated_image, ...rest } = r;
            return rest;
          });
          const resultToStore = {
            ...listingResult,
            results: strippedResults
          };
          localStorage.setItem("listingAnalysisResult", JSON.stringify(resultToStore));
          
          // Map renovated images to gallery indices and store them
          // Create the same mapping logic as the normal report view uses
          const allAnalyzedImages: Array<{ image: ImageResult; originalIndex: number }> = [];
          status.results.forEach((r, originalIndex) => {
            if (r.audit && !r.error) {
              allAnalyzedImages.push({ image: r, originalIndex });
            }
          });

          // Note: We don't store renovated images in localStorage because:
          // 1. Base64 images are too large (20+ MB) and exceed localStorage quota (~5-10 MB)
          // 2. Images can be regenerated quickly via /generate-renovation endpoint
          // The backend cache will serve them if they were just generated, but the
          // background worker doesn't populate that cache, so regeneration is needed
          
          // Reload page to show normal report view
          window.location.href = "/report";
        }

        // If failed, show error
        if (status.status === "failed") {
          setJobError(status.error || "Job failed");
          setIsProcessing(false);
        }
      } catch (error) {
        console.error("Error polling job status:", error);
        setJobError(error instanceof Error ? error.message : "Failed to poll job status");
        setIsProcessing(false);
      }
    };

    // Poll immediately, then every 3 seconds
    pollJobStatus();
    const pollInterval = setInterval(pollJobStatus, 3000);

    return () => clearInterval(pollInterval);
  }, [jobId, router]);

  // Normal report view loading (when no job_id)
  useEffect(() => {
    if (jobId) return; // Skip if processing a job

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
          } else {
            // Auto-load all images: trigger generation for all images that have audit data
            // This regenerates images that were just created by the background job
            // Note: The backend worker doesn't populate the endpoint's cache, so images will regenerate
            // but this happens automatically so users don't need to click
            const wheelchairAccessible = JSON.parse(localStorage.getItem("wheelchairAccessible") || "false");
            const imagesToAutoLoad = allAnalyzedImages.filter(({ image: r }) => r.audit?.image_gen_prompt && r.audit?.mask_prompt);
            
            allAnalyzedImages.forEach(({ image: r }, galleryIndex) => {
              if (!r.audit?.image_gen_prompt || !r.audit?.mask_prompt) return;
              
              // Trigger generation in the background (don't await)
              // Use a small delay to avoid overwhelming the server
              setTimeout(() => {
                fetch("http://localhost:8000/generate-renovation", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    image_url: r.original_url,
                    audit_data: r.audit,
                    wheelchair_accessible: wheelchairAccessible,
                  }),
                })
                  .then(res => res.json())
                  .then(result => {
                    if (result.success && result.renovated_image) {
                      setRenovatedImages(prev => ({
                        ...prev,
                        [galleryIndex]: result.renovated_image
                      }));
                    }
                  })
                  .catch(err => {
                    console.error(`Failed to auto-load image ${galleryIndex}:`, err);
                  });
              }, galleryIndex * 200); // Stagger requests by 200ms each
            });
          }
        } catch (e) {
          console.warn('Failed to load persisted images:', e);
        }

        // Calculate total renovation cost from images with problems
        let totalRenovationLow = 0;
        let totalRenovationHigh = 0;

        imagesWithProblems.forEach(({ image: imageResult }) => {
          if (imageResult.audit && imageResult.audit.cost_estimate) {
            // Parse cost estimate (e.g., "$1,500 - $3,000")
            const match = imageResult.audit.cost_estimate.match(/\$?([\d,]+)/g);
            if (match) {
              const costs = match.map(c => parseFloat(c.replace(/[$,]/g, '')));
              if (costs.length === 2) {
                totalRenovationLow += costs[0];
                totalRenovationHigh += costs[1];
              } else if (costs.length === 1) {
                totalRenovationLow += costs[0];
                totalRenovationHigh += costs[0];
              }
            }
          }
        });

        const totalRenovationCost = (totalRenovationLow + totalRenovationHigh) / 2;

        // Generate random accessibility scores
        const randomCurrent = Math.floor(Math.random() * (40 - 35 + 1)) + 35; // 20-50
        const randomPotential = Math.floor(Math.random() * (80 - 70 + 1)) + 70; // 55-85

        // Transform to PropertyAnalysis format for existing components
        const transformedAnalysis: PropertyAnalysis = {
          id: "listing-analysis",
          address: result.property_info.address || "Property Analysis",
          originalPrice: parseFloat(result.property_info.price?.replace(/[$,]/g, '') || '0'),
          renovationCost: totalRenovationCost,
          renovationCostRange: {
            low: totalRenovationLow,
            high: totalRenovationHigh,
          },
          accessibilityScore: {
            current: randomCurrent,
            potential: randomPotential,
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
  }, [router, jobId]);

  // Processing Hub view
  if (isProcessing && jobStatus) {
    return (
      <div className="min-h-screen bg-[#FFF8E7] diagonal-dots-bg">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex flex-col gap-8">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <h1 className="text-4xl font-bold text-[#2C1810] mb-2">
                Processing Your Property Analysis{ellipsis}
              </h1>
              <p className="text-lg text-[#5C4033] mb-1">{jobStatus.current_status}</p>
              {estimatedTimeRemaining && (
                <p className="text-base text-[#B8860B] font-medium">
                  {estimatedTimeRemaining}
                </p>
              )}
            </motion.div>

            {/* Tutorial Video */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white rounded-lg p-6 shadow-md border border-[#F5E6D3] flex justify-center"
            >
              <div className="w-full max-w-4xl">
                <video
                  className="w-full rounded-lg"
                  autoPlay
                  loop
                  muted
                  playsInline
                >
                  <source src="/tutorial-video.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            </motion.div>

            {/* Progress Bars */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="bg-white rounded-lg p-6 shadow-md border border-[#F5E6D3] space-y-6"
            >
              {/* Audit Progress */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-[#2C1810]">Audit Progress</span>
                  <span className="text-sm text-[#5C4033]">{jobStatus.audit_progress}%</span>
                </div>
                <div className="w-full bg-[#F5E6D3] rounded-full h-3">
                  <motion.div
                    className="bg-[#D2691E] h-3 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${jobStatus.audit_progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Generation Progress */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-[#2C1810]">Generation Progress</span>
                  <span className="text-sm text-[#5C4033]">{jobStatus.generation_progress}%</span>
                </div>
                <div className="w-full bg-[#F5E6D3] rounded-full h-3">
                  <motion.div
                    className="bg-[#B8860B] h-3 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${jobStatus.generation_progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            </motion.div>

            {/* Property Info (if available) */}
            {jobStatus.property_info && (
              <div className="bg-white rounded-lg p-6 shadow-md border border-[#F5E6D3]">
                <h2 className="text-xl font-bold text-[#2C1810] mb-2">
                  {jobStatus.property_info.address}
                </h2>
                <p className="text-[#5C4033]">{jobStatus.property_info.price}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (jobError) {
    return (
      <div className="min-h-screen bg-[#FFF8E7] diagonal-dots-bg flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 shadow-md border border-[#F5E6D3] max-w-md text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Processing Error</h2>
          <p className="text-[#5C4033] mb-6">{jobError}</p>
          <button
            onClick={() => router.push("/")}
            className="bg-[#D2691E] text-white px-6 py-2 rounded hover:bg-[#B8860B] transition"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

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
        // Update state with the generated image
        setRenovatedImages(prev => ({
          ...prev,
          [imageIndex]: result.renovated_image
        }));

        // Update the analysis images with the renovated version
        setAnalysis(prev => ({
          ...prev,
          images: prev.images.map((img, idx) =>
            idx === imageIndex
              ? { ...img, renovated: result.renovated_image }
              : img
          ),
        }));
        
        console.log(`Successfully generated image for index ${imageIndex}`);
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
    <div className="min-h-screen bg-[#FFF8E7] diagonal-dots-bg">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Left Sidebar - 1/3 width */}
          <motion.aside 
            className="w-full lg:w-1/3"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <PropertySidebar analysis={analysis} propertyInfo={listingResult?.property_info} />
          </motion.aside>

          {/* Right Main Area - 2/3 width */}
          <motion.main 
            className="w-full lg:w-2/3 space-y-8"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut", delay: 0.1 }}
          >
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
                    const audit = listingResult.results[originalIndex].audit;
                    return (audit.barrier as string) || 
                           (audit.problem_description as string) ||
                           (audit.barrier_detected as string);
                  }
                  return undefined;
                })()
              }
              solutionDescription={
                (() => {
                  const originalIndex = imageIndexMap.get(selectedImageIndex);
                  if (originalIndex !== undefined && listingResult?.results[originalIndex]?.audit) {
                    const audit = listingResult.results[originalIndex].audit;
                    return (audit.renovation_suggestion as string) ||
                           (audit.solution_description as string);
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
          </motion.main>
        </div>
      </div>
    </div>
  );
}
