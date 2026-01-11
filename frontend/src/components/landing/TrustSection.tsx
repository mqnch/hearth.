"use client";

import { useEffect } from "react";
import Image from "next/image";

// Mock success story images - examples of accessible renovations
const successStories = [
  {
    title: "Accessible Entryway",
    image: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=2600&auto=format&fit=crop",
    description: "Added ramp and handrails",
  },
  {
    title: "Bright Living Space",
    image: "https://images.unsplash.com/photo-1560185007-cde436f6a4d0?q=80&w=2670&auto=format&fit=crop",
    description: "Enhanced lighting and widened doorways",
  },
  {
    title: "Modern Kitchen",
    image: "https://images.unsplash.com/photo-1556911220-bff31c812dba?q=80&w=2560&auto=format&fit=crop",
    description: "Accessible counter heights and layout",
  },
];

export default function TrustSection() {
  useEffect(() => {
    // Simple auto-scroll carousel
    const carousel = document.getElementById("success-carousel");
    if (!carousel) return;

    let scrollPosition = 0;
    const scrollSpeed = 1;
    const scrollInterval = 30;

    const scroll = () => {
      scrollPosition += scrollSpeed;
      if (scrollPosition >= carousel.scrollWidth - carousel.clientWidth) {
        scrollPosition = 0;
      }
      carousel.scrollTo({ left: scrollPosition, behavior: "smooth" });
    };

    const intervalId = setInterval(scroll, scrollInterval);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <section className="py-16 px-4 bg-[#F0F7FF]">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl font-bold text-center text-[#1E3A5F] mb-8 sm:text-4xl">
          Case Studies
        </h2>
        <div
          id="success-carousel"
          className="flex gap-6 overflow-x-auto scrollbar-hide pb-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {successStories.map((story, index) => (
            <div
              key={index}
              className="flex-shrink-0 w-80 rounded-lg overflow-hidden bg-white shadow-md border border-[#E8F4FD]"
            >
              <div className="relative h-48 w-full">
                <Image
                  src={story.image}
                  alt={story.title}
                  fill
                  className="object-cover"
                  sizes="320px"
                />
              </div>
              <div className="p-4">
                <h3 className="text-xl font-semibold text-[#1E3A5F] mb-1">
                  {story.title}
                </h3>
                <p className="text-base text-[#2C5F8D]">{story.description}</p>
              </div>
            </div>
          ))}
          {/* Duplicate items for seamless loop */}
          {successStories.map((story, index) => (
            <div
              key={`duplicate-${index}`}
              className="flex-shrink-0 w-80 rounded-lg overflow-hidden bg-white shadow-md border border-[#E8F4FD]"
            >
              <div className="relative h-48 w-full">
                <Image
                  src={story.image}
                  alt={story.title}
                  fill
                  className="object-cover"
                  sizes="320px"
                />
              </div>
              <div className="p-4">
                <h3 className="text-xl font-semibold text-[#1E3A5F] mb-1">
                  {story.title}
                </h3>
                <p className="text-base text-[#2C5F8D]">{story.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
