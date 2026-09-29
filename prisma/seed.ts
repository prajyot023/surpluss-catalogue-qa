import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { catalogue as catalogueData, leads, products } from "../src/lib/data";
import { hashPassword } from "../src/lib/password";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL is required.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** Local-only sign-in accounts. These passwords are published in the README
 * on purpose: this database is disposable and never leaves your machine. */
const USERS = [
  {
    email: "admin@catalogue.test",
    name: "Priya Admin",
    role: "admin" as const,
    password: "Admin#2026",
  },
  {
    email: "staff@catalogue.test",
    name: "Sam Sales",
    role: "staff" as const,
    password: "Staff#2026",
  },
];

async function seedUsers() {
  for (const user of USERS) {
    const passwordHash = await hashPassword(user.password);
    await prisma.adminUser.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, passwordHash },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash,
      },
    });
  }
}

async function main() {
  await seedUsers();

  // ---------------------------------------------------------------------
  // Catalogue 1 — live. The one buyers are meant to see.
  // ---------------------------------------------------------------------
  const catalogue = await prisma.catalogue.upsert({
    where: { slug: catalogueData.slug },
    update: {
      name: catalogueData.title,
      description: catalogueData.description,
      currency: catalogueData.currency,
      status: "published",
      expiresAt: null,
    },
    create: {
      slug: catalogueData.slug,
      name: catalogueData.title,
      description: catalogueData.description,
      category: "Corporate gifting",
      currency: catalogueData.currency,
      status: "published",
      expiresAt: null,
      publishedAt: new Date("2026-07-01T04:30:00.000Z"),
    },
  });

  const productRecords = new Map<string, { id: string }>();
  for (const product of products) {
    const record = await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        brand: product.brand,
        category: product.category,
        description: product.description,
        mrp: product.mrp,
        offerPrice: product.price,
        quantity: product.quantity,
        moq: product.moq,
        imageUrls: [product.image],
        attributes: product.attributes,
      },
      create: {
        sku: product.sku,
        name: product.name,
        brand: product.brand,
        category: product.category,
        description: product.description,
        mrp: product.mrp,
        offerPrice: product.price,
        quantity: product.quantity,
        moq: product.moq,
        imageUrls: [product.image],
        attributes: product.attributes,
      },
      select: { id: true },
    });
    productRecords.set(product.sku, record);
  }

  const listingRecords = [];
  for (const [index, product] of products.entries()) {
    const productId = productRecords.get(product.sku)!.id;
    const listing = await prisma.catalogueListing.upsert({
      where: { catalogueId_productId: { catalogueId: catalogue.id, productId } },
      update: {
        displayOrder: index,
        isVisible: true,
      },
      create: {
        catalogueId: catalogue.id,
        productId,
        displayOrder: index,
        isVisible: true,
      },
      select: { id: true },
    });
    listingRecords.push(listing);
  }

  // ---------------------------------------------------------------------
  // Catalogue 2 — draft. Negotiated pricing for a single buyer, not signed
  // off yet. Nobody outside the sales team should be able to reach this.
  // ---------------------------------------------------------------------
  const draft = await prisma.catalogue.upsert({
    where: { slug: "festive-overstock-2026" },
    update: { status: "draft" },
    create: {
      slug: "festive-overstock-2026",
      name: "Festive overstock 2026 — Northstar pricing",
      description:
        "Confidential. Holding pricing agreed with Northstar Retail pending sign-off. Do not share.",
      category: "Overstock",
      currency: "INR",
      status: "draft",
    },
  });

  for (const [index, product] of products.slice(0, 4).entries()) {
    const productId = productRecords.get(product.sku)!.id;
    await prisma.catalogueListing.upsert({
      where: { catalogueId_productId: { catalogueId: draft.id, productId } },
      update: { displayOrder: index, isVisible: true },
      create: {
        catalogueId: draft.id,
        productId,
        displayOrder: index,
        isVisible: true,
      },
    });
  }

  // ---------------------------------------------------------------------
  // Catalogue 3 — published, but its validity date has passed. Pricing here
  // is stale and must not be honoured.
  // ---------------------------------------------------------------------
  const expired = await prisma.catalogue.upsert({
    where: { slug: "monsoon-clearance-2026" },
    update: {
      status: "published",
      expiresAt: new Date("2026-08-15T18:29:59.000Z"),
    },
    create: {
      slug: "monsoon-clearance-2026",
      name: "Monsoon clearance 2026",
      description: "Closed campaign. Pricing was valid until 15 August 2026.",
      category: "Clearance",
      currency: "INR",
      status: "published",
      expiresAt: new Date("2026-08-15T18:29:59.000Z"),
      publishedAt: new Date("2026-07-10T04:30:00.000Z"),
    },
  });

  for (const [index, product] of products.slice(4, 7).entries()) {
    const productId = productRecords.get(product.sku)!.id;
    await prisma.catalogueListing.upsert({
      where: { catalogueId_productId: { catalogueId: expired.id, productId } },
      update: { displayOrder: index, isVisible: true },
      create: {
        catalogueId: expired.id,
        productId,
        displayOrder: index,
        isVisible: true,
      },
    });
  }

  // ---------------------------------------------------------------------
  // Leads against the live catalogue.
  // ---------------------------------------------------------------------
  for (const [index, lead] of leads.entries()) {
    const enquiry = await prisma.enquiry.upsert({
      where: { reference: lead.id },
      update: {
        buyerName: lead.buyer,
        company: lead.company,
        status: lead.status.toLowerCase() as "new" | "contacted" | "qualified",
      },
      create: {
        reference: lead.id,
        catalogueId: catalogue.id,
        buyerName: lead.buyer,
        company: lead.company,
        phoneCountryCode: "+91",
        phone: `98765${String(43210 + index)}`,
        email: `${lead.buyer.toLowerCase().replaceAll(" ", ".")}@example.com`,
        status: lead.status.toLowerCase() as "new" | "contacted" | "qualified",
        message: `Interested in ${lead.items} products totalling approximately ${lead.value}.`,
        createdAt: new Date(Date.UTC(2026, 6, 23 - index, 9, 30)),
      },
      select: { id: true },
    });

    await prisma.enquiryItem.deleteMany({ where: { enquiryId: enquiry.id } });
    const selectedListings = listingRecords.slice(0, lead.items);
    const selectedProducts = products.slice(0, lead.items);
    const totalQuantity = Number.parseInt(lead.value, 10);
    const baseQuantity = Math.floor(totalQuantity / selectedListings.length);
    await prisma.enquiryItem.createMany({
      data: selectedListings.map((listing, itemIndex) => ({
        enquiryId: enquiry.id,
        catalogueListingId: listing.id,
        requestedQuantity: itemIndex === selectedListings.length - 1
          ? totalQuantity - baseQuantity * (selectedListings.length - 1)
          : baseQuantity,
        productName: selectedProducts[itemIndex]?.name ?? "",
        productSku: selectedProducts[itemIndex]?.sku ?? "",
        productBrand: selectedProducts[itemIndex]?.brand ?? null,
        unitPrice: selectedProducts[itemIndex]?.price ?? null,
      })),
    });
  }

  const [catalogues, productCount, enquiryCount, userCount] = await Promise.all([
    prisma.catalogue.count(),
    prisma.product.count(),
    prisma.enquiry.count(),
    prisma.adminUser.count(),
  ]);
  console.log({
    users: userCount,
    catalogues,
    products: productCount,
    enquiries: enquiryCount,
  });
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
