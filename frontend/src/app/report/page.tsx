"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MOCK_ANALYSIS, PropertyAnalysis } from "../../../../lib/mock-data";
import PropertySidebar from "@/components/report/PropertySidebar";
import TransformationViewer from "@/components/report/TransformationViewer";
import Gallery from "@/components/report/Gallery";
import LoadingSkeleton from "@/components/report/LoadingSkeleton";

interface ApiAudit {
  barrier_detected: string;
  renovation_suggestion: string;
  estimated_cost_usd: number;
  compliance_note: string;
  accessibility_score: number;
  [key: string]: unknown;
}

interface ApiResult {
  audit: ApiAudit;
  image_data: string | null;
}

export default function ReportPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [analysis, setAnalysis] = useState<PropertyAnalysis>(MOCK_ANALYSIS);
  const [originalImageUrl, setOriginalImageUrl] = useState<string>("");
  const [renovatedImageData, setRenovatedImageData] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const router = useRouter();

  useEffect(() => {
    // Read analysis result from localStorage
    const storedResult = localStorage.getItem("analysisResult");
    const storedOriginalUrl = localStorage.getItem("originalImageUrl");

    if (storedResult && storedOriginalUrl) {
      try {
        const apiResult: ApiResult = JSON.parse(storedResult);
        
        // Store original URL and renovated image data
        setOriginalImageUrl(storedOriginalUrl);
        setRenovatedImageData(apiResult.image_data);
        
        // Transform API response to PropertyAnalysis format
        const transformedAnalysis: PropertyAnalysis = {
          id: "api-result",
          address: "Accessibility Analysis",
          originalPrice: 0,
          renovationCost: apiResult.audit.estimated_cost_usd,
          accessibilityScore: {
            current: 100 - apiResult.audit.accessibility_score, // Current accessibility (before renovation)
            potential: apiResult.audit.accessibility_score, // Accessibility after renovation
          },
          features: [
            {
              name: apiResult.audit.barrier_detected,
              riskLevel: "High",
              description: apiResult.audit.renovation_suggestion,
            },
          ],
          images: [
            {
              label: "Analyzed Image",
              original: storedOriginalUrl,
              renovated: apiResult.image_data || storedOriginalUrl,
            },
          ],
        };
        
        setAnalysis(transformedAnalysis);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to parse analysis result:", error);
        setIsLoading(false);
      }
    } else {
      // No stored result, redirect to home
      router.push("/");
    }
  }, [router]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Left Sidebar - 1/3 width */}
          <aside className="w-full lg:w-1/3">
            <PropertySidebar analysis={analysis} />
          </aside>

          {/* Right Main Area - 2/3 width */}
          <main className="w-full lg:w-2/3 space-y-8">
            <TransformationViewer 
              analysis={analysis} 
              selectedImageIndex={selectedImageIndex}
              originalImageUrl={originalImageUrl}
              renovatedImageData={renovatedImageData}
            />
            <Gallery 
              analysis={analysis} 
              selectedIndex={selectedImageIndex}
              onImageSelect={setSelectedImageIndex}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
