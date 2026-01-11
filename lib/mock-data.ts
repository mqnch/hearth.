export interface PropertyAnalysis {
  id: string;
  address: string;
  originalPrice: number;
  renovationCost: number;
  renovationCostRange?: {
    low: number;
    high: number;
  };
  accessibilityScore: {
    current: number; // 0-100
    potential: number; // 0-100
  };
  features: {
    name: string;
    riskLevel: "High" | "Medium" | "Low";
    description: string;
  }[];
  images: {
    label: string;
    original: string; // URL
    renovated: string; // URL
  }[];
  additionalInfo?: {
    noiseLevel: string;
    averageAge: string;
    airQuality: string;
    elevation: string;
    safetyIndex: string;
    localAmenities: string[];
  };
}

export const MOCK_ANALYSIS: PropertyAnalysis = {
  id: "prop-123",
  address: "142 Evergreen Terrace, Springfield, ON",
  originalPrice: 450000,
  renovationCost: 15000,
  accessibilityScore: {
    current: 45,
    potential: 92,
  },
  features: [
    {
      name: "Steep Entry Stairs",
      riskLevel: "High",
      description: "Steep concrete stairs at the main entrance pose a significant fall risk, especially in winter conditions. No handrails present on either side.",
    },
    {
      name: "Narrow Doorway",
      riskLevel: "Medium",
      description: "Front doorway width is only 28 inches, which may restrict wheelchair access and make furniture moving difficult.",
    },
    {
      name: "Low Lighting in Hallway",
      riskLevel: "Low",
      description: "Insufficient lighting in the main hallway creates visibility challenges, particularly for users with vision impairments.",
    },
  ],
  images: [
    {
      label: "Main Entryway - Before/After",
      original: "https://images.unsplash.com/photo-1505873242700-f289a29e1e0f?q=80&w=2676&auto=format&fit=crop",
      renovated: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=2600&auto=format&fit=crop",
    },
    {
      label: "Living Room",
      original: "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?q=80&w=2670&auto=format&fit=crop",
      renovated: "https://images.unsplash.com/photo-1560185007-cde436f6a4d0?q=80&w=2670&auto=format&fit=crop",
    },
    {
      label: "Kitchen Entry",
      original: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?q=80&w=2670&auto=format&fit=crop",
      renovated: "https://images.unsplash.com/photo-1556911220-bff31c812dba?q=80&w=2560&auto=format&fit=crop",
    },
  ],
  additionalInfo: {
    noiseLevel: "Low",
    averageAge: "15 years",
    airQuality: "Good",
    elevation: "120m",
    safetyIndex: "85/100",
    localAmenities: [
      "Grocery Store (0.5km)",
      "Pharmacy (0.8km)",
      "Hospital (2.0km)",
      "Public Transit (0.3km)",
      "Parks (0.4km)",
    ],
  },
};
