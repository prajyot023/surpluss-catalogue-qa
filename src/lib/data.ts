export type Product = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  mrp?: number;
  quantity: number;
  moq: number;
  image: string;
  description: string;
  attributes: Record<string, string>;
  featured?: boolean;
};

export const catalogue = {
  slug: "premium-corporate-essentials",
  title: "Premium corporate essentials",
  eyebrow: "Corporate gifting · July 2026",
  description:
    "A considered selection of travel, work and lifestyle essentials available for bulk procurement.",
  currency: "INR",
  validUntil: "31 July 2026",
};

export const products: Product[] = [
  {
    id: "atlas-cabin",
    sku: "TRV-1024",
    name: "Atlas cabin trolley",
    brand: "Aristocrat",
    category: "Travel",
    price: 2499,
    mrp: 5999,
    quantity: 240,
    moq: 20,
    image: "https://images.unsplash.com/photo-1565026057447-bc90a3dceb87?auto=format&fit=crop&w=1200&q=85",
    description: "A lightweight hard-shell cabin trolley with silent spinner wheels and an integrated combination lock.",
    attributes: { Material: "Polycarbonate", Size: "55 cm", Colour: "Midnight blue" },
    featured: true,
  },
  {
    id: "studio-headphones",
    sku: "AUD-0842",
    name: "Studio wireless headphones",
    brand: "Soundcore",
    category: "Electronics",
    price: 1899,
    mrp: 4499,
    quantity: 180,
    moq: 25,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=85",
    description: "Comfortable wireless headphones with deep bass, fast charging and up to 40 hours of playback.",
    attributes: { Connectivity: "Bluetooth 5.3", Battery: "40 hours", Colour: "Graphite" },
    featured: true,
  },
  {
    id: "terra-flask",
    sku: "HOM-2291",
    name: "Terra insulated flask",
    brand: "Borosil",
    category: "Lifestyle",
    price: 649,
    mrp: 1299,
    quantity: 520,
    moq: 50,
    image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1200&q=85",
    description: "Double-wall stainless-steel flask designed to keep beverages at temperature throughout the workday.",
    attributes: { Capacity: "750 ml", Material: "Stainless steel", Colour: "Sage" },
  },
  {
    id: "folio-organiser",
    sku: "OFF-3380",
    name: "Folio work organiser",
    brand: "Daily Objects",
    category: "Office",
    price: 899,
    mrp: 1799,
    quantity: 310,
    moq: 30,
    image: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1200&q=85",
    description: "A refined vegan-leather folio with document storage, card slots and an undated notebook.",
    attributes: { Material: "Vegan leather", Format: "A5", Colour: "Tan" },
  },
  {
    id: "pulse-smartwatch",
    sku: "WBL-9014",
    name: "Pulse smart watch",
    brand: "Noise",
    category: "Electronics",
    price: 2199,
    mrp: 4999,
    quantity: 95,
    moq: 20,
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=85",
    description: "A crisp edge-to-edge display with health tracking, call alerts and a seven-day battery.",
    attributes: { Display: "1.85 inch", Battery: "7 days", Colour: "Black" },
  },
  {
    id: "commuter-backpack",
    sku: "BAG-7312",
    name: "Commuter laptop backpack",
    brand: "American Tourister",
    category: "Travel",
    price: 1499,
    mrp: 3299,
    quantity: 160,
    moq: 25,
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=85",
    description: "A minimal daily backpack with padded laptop storage, breathable back support and concealed pockets.",
    attributes: { Capacity: "24 L", Laptop: "Up to 15.6 inch", Colour: "Charcoal" },
  },
  {
    id: "desk-lamp",
    sku: "OFF-6108",
    name: "Halo desk lamp",
    brand: "Wipro",
    category: "Office",
    price: 999,
    mrp: 2199,
    quantity: 75,
    moq: 15,
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1200&q=85",
    description: "Adjustable LED task light with touch controls, three colour temperatures and a clean silhouette.",
    attributes: { Power: "8 W", Modes: "3 temperatures", Colour: "White" },
  },
  {
    id: "coffee-set",
    sku: "LIF-4012",
    name: "Pour-over coffee set",
    brand: "Wonderchef",
    category: "Lifestyle",
    price: 1299,
    mrp: 2699,
    quantity: 110,
    moq: 20,
    image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=85",
    description: "A presentation-ready brewing set with glass carafe, reusable filter and measuring scoop.",
    attributes: { Pieces: "4", Capacity: "600 ml", Packaging: "Gift box" },
  },
];

export type Lead = {
  id: string;
  buyer: string;
  company: string;
  items: number;
  value: string;
  date: string;
  status: "New" | "Contacted" | "Qualified";
};

export const leads: Lead[] = [
  { id: "ENQ-24071", buyer: "Rahul Mehta", company: "Northstar Retail", items: 3, value: "240 units", date: "2 min ago", status: "New" },
  { id: "ENQ-24070", buyer: "Ananya Shah", company: "Vertex Events", items: 1, value: "100 units", date: "42 min ago", status: "New" },
  { id: "ENQ-24069", buyer: "Mohit Rao", company: "Elevate Works", items: 4, value: "520 units", date: "Yesterday", status: "Contacted" },
  { id: "ENQ-24068", buyer: "Sana Khan", company: "Brightline Co.", items: 2, value: "75 units", date: "21 Jul", status: "Qualified" },
  { id: "ENQ-24067", buyer: "Aarav Kapoor", company: "Meridian Hotels", items: 2, value: "120 units", date: "21 Jul", status: "Contacted" },
  { id: "ENQ-24066", buyer: "Ishita Verma", company: "Bluepeak Consulting", items: 1, value: "50 units", date: "20 Jul", status: "Qualified" },
  { id: "ENQ-24065", buyer: "Karan Malhotra", company: "Orbit Experiences", items: 5, value: "640 units", date: "20 Jul", status: "Contacted" },
  { id: "ENQ-24064", buyer: "Naina Iyer", company: "Studio North", items: 2, value: "80 units", date: "19 Jul", status: "Qualified" },
  { id: "ENQ-24063", buyer: "Dev Patel", company: "Prism Retail", items: 3, value: "310 units", date: "19 Jul", status: "Contacted" },
  { id: "ENQ-24062", buyer: "Rhea Banerjee", company: "Atlas Procurement", items: 1, value: "25 units", date: "18 Jul", status: "Qualified" },
  { id: "ENQ-24061", buyer: "Kabir Singh", company: "Crestline Media", items: 2, value: "95 units", date: "18 Jul", status: "Contacted" },
  { id: "ENQ-24060", buyer: "Mira Nair", company: "Juniper Foods", items: 4, value: "480 units", date: "17 Jul", status: "Qualified" },
  { id: "ENQ-24059", buyer: "Rohan Das", company: "Nexon Services", items: 1, value: "30 units", date: "17 Jul", status: "Contacted" },
  { id: "ENQ-24058", buyer: "Priya Menon", company: "Aster Healthcare", items: 3, value: "225 units", date: "16 Jul", status: "Qualified" },
  { id: "ENQ-24057", buyer: "Aditya Joshi", company: "Fieldstone India", items: 2, value: "140 units", date: "16 Jul", status: "Contacted" },
  { id: "ENQ-24056", buyer: "Neha Kulkarni", company: "Common Ground", items: 1, value: "60 units", date: "15 Jul", status: "Qualified" },
  { id: "ENQ-24055", buyer: "Vikram Sethi", company: "Summit Rewards", items: 6, value: "820 units", date: "15 Jul", status: "Contacted" },
  { id: "ENQ-24054", buyer: "Tara George", company: "Canvas Events", items: 2, value: "110 units", date: "14 Jul", status: "Qualified" },
  { id: "ENQ-24053", buyer: "Arjun Bhat", company: "Urban Hive", items: 3, value: "270 units", date: "14 Jul", status: "Contacted" },
];
