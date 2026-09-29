import { after, NextResponse } from "next/server";
import { z } from "zod";
import { notifyTeam } from "@/lib/notifications";
import { getPrisma } from "@/lib/prisma";

const enquirySchema = z
  .object({
    catalogueId: z.string().uuid(),
    name: z.string().trim().min(2).max(100),
    company: z.string().trim().max(120).optional(),
    countryCode: z.string().regex(/^\+\d{1,4}$/).default("+91"),
    phone: z.string().regex(/^\d{6,10}$/).optional().or(z.literal("")),
    email: z.string().email().optional().or(z.literal("")),
    location: z.string().trim().max(120).optional(),
    message: z.string().trim().max(1000).optional(),
    referralPerson: z.string().trim().max(100).optional(),
    items: z
      .array(
        z.object({
          productId: z.string().uuid(),
          quantity: z.number().int().positive(),
        }),
      )
      .min(1)
      .max(100),
  })
  .refine((data) => Boolean(data.phone) || Boolean(data.email), {
    message: "Add a WhatsApp number or an email address.",
  });

export async function POST(request: Request) {
  const parsed = enquirySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check the enquiry details." }, { status: 400 });
  const reference = `ENQ-${Date.now().toString().slice(-7)}`;
  const { items, ...lead } = parsed.data;
  try {
    const prisma = getPrisma();
    const [listings, catalogueRecord] = await Promise.all([
      prisma.catalogueListing.findMany({
        where: {
          catalogueId: lead.catalogueId,
          productId: { in: items.map(({ productId }) => productId) },
          isVisible: true,
        },
        select: {
          id: true,
          productId: true,
          product: {
            select: {
              name: true,
              sku: true,
              brand: true,
              offerPrice: true,
              priceOnRequest: true,
              moq: true,
              quantity: true,
            },
          },
        },
      }),
      prisma.catalogue.findUnique({ where: { id: lead.catalogueId }, select: { notifyNumber: true } }),
    ]);
    if (listings.length !== items.length) return NextResponse.json({ error: "One or more products are unavailable." }, { status: 409 });
    const listingByProduct = new Map(listings.map((listing) => [listing.productId, listing]));
    for (const item of items) {
      const listing = listingByProduct.get(item.productId)!;
      if (item.quantity < listing.product.moq || item.quantity > listing.product.quantity) {
        return NextResponse.json({ error: "A requested quantity is outside the allowed range." }, { status: 400 });
      }
    }
    await prisma.enquiry.create({
      data: {
        reference,
        catalogueId: lead.catalogueId,
        buyerName: lead.name,
        company: lead.company,
        phoneCountryCode: lead.countryCode,
        phone: lead.phone || "",
        email: lead.email || null,
        location: lead.location,
        message: lead.message,
        referralPerson: lead.referralPerson,
        items: {
          create: items.map((item) => {
            const listing = listingByProduct.get(item.productId)!;
            return {
              catalogueListingId: listing.id,
              requestedQuantity: item.quantity,
              // Snapshot so the lead keeps its details even if the listing goes away.
              productName: listing.product.name,
              productSku: listing.product.sku,
              productBrand: listing.product.brand,
              unitPrice: listing.product.priceOnRequest ? null : listing.product.offerPrice,
            };
          }),
        },
      },
    });
    const summary = items
      .map((item) => {
        const listing = listingByProduct.get(item.productId)!;
        return `• ${listing.product.name} — ${item.quantity} units`;
      })
      .join("\n");
    after(() => notifyTeam({
      reference,
      name: lead.name,
      company: lead.company,
      phone: lead.phone ? `${lead.countryCode}${lead.phone}` : "Not provided",
      email: lead.email || undefined,
      summary,
      notifyNumber: catalogueRecord?.notifyNumber,
    }));
    return NextResponse.json({ ok: true, reference }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not save the enquiry." }, { status: 500 });
  }
}
