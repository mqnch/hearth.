"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AnalysisResult {
  audit: {
    barrier_detected: string;
    renovation_suggestion: string;
    estimated_cost_usd: number;
    compliance_note: string;
    accessibility_score: number;
    [key: string]: unknown;
  };
  image_data: string | null;
}

export default function Hero() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("http://localhost:8000/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image_url: url }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const result: AnalysisResult = await response.json();

      if (result.audit) {
        // Store the result and original image URL in localStorage
        localStorage.setItem("analysisResult", JSON.stringify(result));
        localStorage.setItem("originalImageUrl", url);
        router.push("/report");
      } else {
        throw new Error("Analysis failed: No audit data returned");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred during analysis");
      setIsLoading(false);
    }
  };

  return (
    <section className="relative flex min-h-[80vh] flex-col items-center justify-center px-4 py-48 text-center bg-[#F0F7FF] overflow-hidden">
      {/* Grainy white oval background */}
      <div 
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <div 
          className="rounded-full"
          style={{
            width: '1200px',
            height: '700px',
            background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.4) 0%, rgba(41, 57, 149, 0.2) 30%, rgba(53, 6, 110, 0.1) 50%, transparent 75%)',
            filter: 'blur(100px)',
            position: 'relative',
          }}
        >
          {/* Grain texture overlay */}
          <div
            className="absolute inset-0 rounded-full opacity-30"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              backgroundSize: '150px 150px',
              mixBlendMode: 'overlay',
            }}
          />
        </div>
      </div>
      
      <div className="relative z-10 mx-auto w-full max-w-3xl space-y-8">
        {/* Headline - Professional typography */}
        <h1 className="text-5xl font-thin leading-tight tracking-tight text-[#1E3A5F] sm:text-6xl">
          Find & build a home that can grow with you.
        </h1>

        {/* Subheadline - Professional description */}
        <p className="mx-auto max-w-2xl text-xl leading-8 text-[#2C5F8D]">
          Comprehensive AI cost evaluation and visualization of accessibility renovations for residential properties.
        </p>

        {/* Search Form */}
        <form onSubmit={handleAnalyze} className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-5 w-5 text-[#6BA3E8]" aria-hidden="true" />
            </div>
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter property image URL..."
              className="pl-12 border-[#6BA3E8] focus:border-[#4A90E2] focus:ring-[#4A90E2]"
              aria-label="Enter a Zillow URL for accessibility analysis"
              required
            />
          </div>
          <Button
            type="submit"
            disabled={isLoading}
            size="lg"
            className="bg-[#4A90E2] hover:bg-[#2C5F8D] sm:whitespace-nowrap"
          >
            {isLoading ? "Processing Analysis..." : "Analyze Property"}
          </Button>
        </form>

        {/* Error Message */}
        {error && (
          <p className="text-sm text-red-700 bg-red-50 px-4 py-2 rounded-lg border border-red-200">
            {error}
          </p>
        )}

        {/* Helper Text */}
        <p className="text-sm text-[#2C5F8D]">
          Submit a property image URL to receive a detailed accessibility assessment
        </p>
      </div>
    </section>
  );
}