"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export default function Hero() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    // TODO: Add URL validation and API call
    // For now, navigate to report page with mock data
    router.push("/report");
  };

  return (
    <section className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        {/* Headline */}
        <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
          Find a home that grows with you
        </h1>

        {/* Subheadline */}
        <p className="mx-auto max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
          Visualize accessibility renovations for your future home and make informed decisions about aging in place.
        </p>

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste Realtor.ca link here..."
              className="h-14 w-full rounded-lg border border-slate-300 bg-white pl-12 pr-4 text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 sm:text-lg"
              aria-label="Realtor.ca listing URL"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="h-14 rounded-lg bg-blue-600 px-8 text-lg font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:whitespace-nowrap"
          >
            {isLoading ? "Analyzing..." : "Analyze Home"}
          </button>
        </form>

        {/* Helper Text */}
        <p className="text-sm text-slate-500">
          Simply paste any Realtor.ca listing URL to get started
        </p>
      </div>
    </section>
  );
}