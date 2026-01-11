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
    <section className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-16 text-center bg-[#FAFAF9]">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        {/* Headline - VERY large typography for elderly users */}
        <h1 className="font-heading text-5xl font-bold leading-tight tracking-tight text-slate-900 sm:text-6xl">
          Find a home that grows with you
        </h1>

        {/* Subheadline - Large body text */}
        <p className="mx-auto max-w-2xl text-xl leading-8 text-slate-600">
          Visualize accessibility renovations for your future home and make informed decisions about aging in place.
        </p>

        {/* Search Form */}
        <form onSubmit={handleAnalyze} className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste image URL here..."
              className="pl-12"
              aria-label="Image URL for accessibility analysis"
              required
            />
          </div>
          <Button
            type="submit"
            disabled={isLoading}
            size="lg"
            className="bg-blue-600 sm:whitespace-nowrap"
          >
            {isLoading ? "Analyzing... (this may take a minute)" : "Analyze Home"}
          </Button>
        </form>

        {/* Error Message */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">
            {error}
          </p>
        )}

        {/* Helper Text */}
        <p className="text-sm text-slate-500">
          Paste an image URL to analyze accessibility and visualize renovations
        </p>
      </div>
    </section>
  );
}