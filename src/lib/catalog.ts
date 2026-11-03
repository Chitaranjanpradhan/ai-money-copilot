export const CATALOG = [
  { name: "Aurora Desk Lamp", price: "49.00", blurb: "Warm ambient light with sunrise mode" },
  { name: "Drift Mechanical Keyboard", price: "129.00", blurb: "Hot-swappable, whisper-quiet switches" },
  { name: "Nimbus Travel Mug", price: "24.50", blurb: "Keeps coffee hot for 8 hours" },
  { name: "Orbit Phone Stand", price: "19.99", blurb: "Weighted aluminum, rotates 360°" },
];
export type CatalogItem = (typeof CATALOG)[number];
