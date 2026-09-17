export const FREE_BETA = process.env.FREE_BETA !== "false";

export const PLANS = Object.freeze({
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    monthlyCredits: 25,
    maxDuration: 60,
    commercialLicense: false,
    features: ["25 monthly credits", "Up to 60-second tracks", "Personal use"],
  },
  creator: {
    id: "creator",
    name: "Creator",
    priceMonthly: 12,
    monthlyCredits: 150,
    maxDuration: 180,
    commercialLicense: true,
    features: ["150 monthly credits", "Commercial license", "MP3 and WAV export"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 29,
    monthlyCredits: 500,
    maxDuration: 300,
    commercialLicense: true,
    features: ["500 monthly credits", "Stems and priority queue", "Advanced editing"],
  },
  studio: {
    id: "studio",
    name: "Studio",
    priceMonthly: 79,
    monthlyCredits: 1800,
    maxDuration: 600,
    commercialLicense: true,
    features: ["1,800 monthly credits", "5 team seats", "API access"],
  },
});

export function generationCost({ duration, quality, mode }) {
  const lengthUnits = Math.max(1, Math.ceil(duration / 60));
  const qualityMultiplier = quality === "studio" ? 2 : 1;
  const vocalCost = mode === "vocal" ? 1 : 0;
  return lengthUnits * qualityMultiplier + vocalCost;
}
