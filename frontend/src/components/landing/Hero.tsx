"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

export default function Hero() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'listing' | 'image'>('listing');
  const [wheelchairAccessible, setWheelchairAccessible] = useState(false);
  const router = useRouter();

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      if (inputMode === 'image') {
        // Single image analysis - now uses job-based workflow
        const response = await fetch("http://localhost:8000/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            image_url: url,
            wheelchair_accessible: wheelchairAccessible
          }),
        });

        if (!response.ok) {
          throw new Error(`Analysis failed: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.job_id) {
          // Store wheelchair accessible preference
          localStorage.setItem("wheelchairAccessible", JSON.stringify(wheelchairAccessible));
          // Navigate to report page with job_id
          router.push(`/report?job_id=${result.job_id}`);
        } else if (result.error) {
          throw new Error(result.error);
        } else {
          throw new Error("Analysis failed: No job_id returned");
        }
      } else {
        // Listing URL analysis - now uses job-based workflow
        const response = await fetch("http://localhost:8000/analyze-from-listing", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            listing_url: url,
            max_images: 6,
            wheelchair_accessible: wheelchairAccessible
          }),
        });

        if (!response.ok) {
          throw new Error(`Analysis failed: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.job_id) {
          // Store wheelchair accessible preference
          localStorage.setItem("wheelchairAccessible", JSON.stringify(wheelchairAccessible));
          // Navigate to report page with job_id
          router.push(`/report?job_id=${result.job_id}`);
        } else if (result.error) {
          throw new Error(result.error);
        } else {
          throw new Error("Analysis failed: No job_id returned");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred during analysis");
      setIsLoading(false);
    }
  };

  return (
    <section className="relative flex min-h-[80vh] flex-col items-center justify-center px-4 py-32 text-center overflow-hidden">
      {/* Grainy white oval background */}
      <div 
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <div 
          className="rounded-[1px]"
          style={{
            width: '1200px',
            height: '700px',
            background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.4) 0%, rgba(210, 105, 30, 0.2) 30%, rgba(184, 134, 11, 0.1) 50%, transparent 75%)',
            filter: 'blur(100px)',
            position: 'relative',
          }}
        >
          {/* Grain texture overlay */}
          <div
            className="absolute inset-0 rounded-[1px] opacity-30"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              backgroundSize: '150px 150px',
              mixBlendMode: 'overlay',
            }}
          />
        </div>
      </div>
      
      <motion.div 
        className="relative z-10 mx-auto w-full max-w-3xl space-y-8"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {/* Headline - Professional typography */}
        <motion.h1 
          className="text-5xl font-thin leading-tight tracking-tight text-[#5C4033] sm:text-6xl"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut", delay: 0.1 }}
        >
          Find & build a home that can grow with you.
        </motion.h1>

        {/* Subheadline - Professional description */}
        <motion.p 
          className="mx-auto max-w-2xl text-xl leading-8 text-[#B8860B]"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut", delay: 0.2 }}
        >
          Comprehensive AI cost evaluation and visualization of accessibility renovations for residential properties.
        </motion.p>

        {/* Mode Toggle */}
        <motion.div 
          className="flex justify-center gap-2 mb-2"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut", delay: 0.3 }}
        >
          <button
            type="button"
            onClick={() => setInputMode('listing')}
            className={`px-4 py-2 rounded-[1px] text-sm font-medium transition-colors ${
              inputMode === 'listing'
                ? 'bg-[#D2691E] text-white'
                : 'bg-white text-[#B8860B] border border-[#D4A574] hover:bg-[#F5E6D3]'
            }`}
          >
            Listing URL
          </button>
          <button
            type="button"
            onClick={() => setInputMode('image')}
            className={`px-4 py-2 rounded-[1px] text-sm font-medium transition-colors ${
              inputMode === 'image'
                ? 'bg-[#D2691E] text-white'
                : 'bg-white text-[#B8860B] border border-[#D4A574] hover:bg-[#F5E6D3]'
            }`}
          >
            Image URL
          </button>
        </motion.div>

        {/* Search Form */}
        <motion.form 
          onSubmit={handleAnalyze} 
          className="flex flex-col gap-4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut", delay: 0.4 }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Search className="h-5 w-5 text-[#D4A574]" aria-hidden="true" />
              </div>
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={
                  inputMode === 'listing'
                    ? "Enter Realtor.ca listing URL..."
                    : "Enter property image URL..."
                }
                className="pl-12 border-[#D4A574] focus:border-[#D2691E] focus:ring-[#D2691E]"
                aria-label={
                  inputMode === 'listing'
                    ? "Enter a Realtor.ca listing URL for accessibility analysis"
                    : "Enter a property image URL for accessibility analysis"
                }
                required
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              size="lg"
              className="bg-[#D2691E] hover:bg-[#B8860B] sm:whitespace-nowrap"
            >
              {isLoading ? "Processing Analysis..." : "Analyze Property"}
            </Button>
          </div>
          
          {/* Wheelchair Accessible Checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="wheelchair-accessible"
              checked={wheelchairAccessible}
              onChange={(e) => setWheelchairAccessible(e.target.checked)}
              className="w-4 h-4 text-[#D2691E] border-[#D4A574] rounded-[1px] focus:ring-[#D2691E] focus:ring-2"
            />
            <label 
              htmlFor="wheelchair-accessible" 
              className="text-sm text-[#5C4033] cursor-pointer"
            >
              Require wheelchair-accessible modifications
            </label>
          </div>
        </motion.form>

        {/* Error Message */}
        {error && (
          <p className="text-sm text-red-700 bg-red-50 px-4 py-2 rounded-[1px] border border-red-200">
            {error}
          </p>
        )}

        {/* Helper Text */}
        {inputMode === 'image' && (
          <p className="text-sm text-[#B8860B]">
            Submit a direct image URL from any property listing to analyze for accessibility
          </p>
        )}

        {/* Tips based on mode */}
        {inputMode === 'listing' && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-[#D4A574]">
              ℹ️ A browser window will open when analyzing. If you see a robot check, complete it and the scraper will continue automatically.
            </p>
            <p className="text-xs text-[#D4A574]">
              💡 Alternative: Switch to "Image URL" mode to bypass robot checks entirely.
            </p>
          </div>
        )}
        {inputMode === 'image' && (
          <p className="text-xs text-[#D4A574] mt-2">
            💡 Right-click any property photo on Realtor.ca and select "Copy Image Address"
          </p>
        )}
      </motion.div>
    </section>
  );
}