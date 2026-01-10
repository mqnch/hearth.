export interface PropertyAnalysis {
  id: string;
  address: string;
  listingPrice: number;
  renovationCost: number;
  accessibilityScore: {
    current: number; // 0-100 scale
    potential?: number; // 0-100 scale after renovations
  };
  mainTransformation: {
    before: string; // URL for the original image
    after: string; // URL for the renovated image
    caption: string; // Explanation of the transformation
  };
  gallery: {
    original: string;
    renovated: string;
    label: string;
  }[];
}

export const MOCK_ANALYSIS: PropertyAnalysis = {
  id: "123",
  address: "142 Evergreen Terrace, Springfield, ON",
  listingPrice: 450000,
  renovationCost: 15000,
  accessibilityScore: {
    current: 45,
    potential: 92,
  },
  mainTransformation: {
    before: "https://images.unsplash.com/photo-1505873242700-f289a29e1e0f?q=80&w=2676&auto=format&fit=crop",
    after: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=2600&auto=format&fit=crop",
    caption: "Added reinforced handrails and stair lift to improve accessibility and reduce fall risk",
  },
  gallery: [
    {
      label: "Living Room",
      original: "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?q=80&w=2670&auto=format&fit=crop",
      renovated: "https://images.unsplash.com/photo-1560185007-cde436f6a4d0?q=80&w=2670&auto=format&fit=crop",
    },
    {
      label: "Kitchen",
      original: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?q=80&w=2670&auto=format&fit=crop",
      renovated: "https://images.unsplash.com/photo-1556911220-bff31c812dba?q=80&w=2560&auto=format&fit=crop",
    },
    {
      label: "Bathroom",
      original: "https://images.unsplash.com/photo-1620626011761-996317b8d101?q=80&w=2670&auto=format&fit=crop",
      renovated: "https://images.unsplash.com/photo-1620626011761-996317b8d101?q=80&w=2670&auto=format&fit=crop",
    },
  ],
};