import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CatalogueClient } from "@/components/catalogue/catalogue-client";
import { ExpiredCatalogue } from "@/components/catalogue/expired-catalogue";
import { getPublishedCatalogue } from "@/lib/catalogue-queries";
import { socialImage } from "@/lib/social-metadata";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublishedCatalogue(slug);
  if (!data) return {};
  if ("expired" in data) {
    return { title: data.title, robots: { index: false, follow: false } };
  }
  return {
    title: data.catalogue.title,
    description: data.catalogue.description,
    openGraph: {
      title: data.catalogue.title,
      description: data.catalogue.description,
      url: `/catalogue/${slug}`,
      siteName: "Surpluss",
      type: "website",
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title: data.catalogue.title,
      description: data.catalogue.description,
      images: [socialImage],
    },
  };
}

export default async function CataloguePage({ params }: PageProps) {
  await connection();
  const { slug } = await params;
  const data = await getPublishedCatalogue(slug);
  if (!data) notFound();
  if ("expired" in data) {
    return <ExpiredCatalogue title={data.title} whatsappNumber={data.whatsappNumber} />;
  }
  return <CatalogueClient catalogue={data.catalogue} products={data.products} />;
}
