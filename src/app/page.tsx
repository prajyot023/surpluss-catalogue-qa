import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  IconArrowRight,
  IconFileSearch,
  IconHeadset,
  IconHeartHandshake,
  IconLayoutGrid,
  IconMessageDots,
  IconPackage,
  IconPercentage,
  IconTag,
  IconUsersGroup,
  IconWorld,
} from "@tabler/icons-react";
import { PublicHeader } from "@/components/public-header";
import { CatalogueLink } from "@/components/about/catalogue-link";
import { TrackedLink } from "@/components/analytics/tracked-link";
import { SiteFooter } from "@/components/catalogue/site-footer";
import { waHref, WhatsAppIcon } from "@/components/catalogue/whatsapp-cta";
import { Marquee } from "@/components/ui/marquee";
import CountUp from "@/components/CountUp";

export const metadata: Metadata = {
  title: "About Surpluss",
  description:
    "Surpluss connects businesses with curated products and inventory from brands, manufacturers and distributors, at highly competitive prices.",
};

const CONTACT_EMAIL = "sales@surpluss.co";

const STEPS = [
  {
    number: "01",
    icon: IconPackage,
    title: "We Curate",
    text: "We source and select quality products and inventory with strong pricing.",
  },
  {
    number: "02",
    icon: IconMessageDots,
    title: "You Enquire",
    text: "Browse what’s available and tell us what you’re interested in and the quantity required.",
  },
  {
    number: "03",
    icon: IconHeartHandshake,
    title: "We Handle the Rest",
    text: "We confirm the best available price, availability and coordinate the deal through execution.",
  },
];

const STATS = [
  {
    icon: IconUsersGroup,
    value: 3000,
    separator: ",",
    label: "Verified Buyers",
  },
  { icon: IconWorld, value: 10, separator: "", label: "Countries" },
  {
    icon: IconLayoutGrid,
    value: 7,
    separator: "",
    label: "Product Categories",
  },
];

const BACKERS = [
  {
    name: "Antler",
    src: "/brand-logo/antler-logo.png",
    width: 1952,
    height: 470,
  },
  {
    name: "Science and Technology Park Pune",
    src: "/brand-logo/stp-logo.png",
    width: 3259,
    height: 599,
  },
  {
    name: "Netherlands India Chamber of Commerce and Trade",
    src: "/brand-logo/nicct-logo.svg",
    width: 170,
    height: 50,
  },
  {
    name: "Global India Business Forum",
    src: "/brand-logo/gibf-logo.png",
    width: 2170,
    height: 2155,
    tall: true,
  },
  {
    name: "Ideas to Impacts",
    src: "/brand-logo/ideas-to-impact-logo.png",
    width: 131,
    height: 84,
  },
];

const HIGHLIGHTS = [
  { icon: IconTag, label: "Curated products" },
  { icon: IconPercentage, label: "Highly competitive prices" },
  { icon: IconHeadset, label: "End-to-end support" },
];

export default function Home() {
  const whatsappNumber =
    process.env.WATI_WHATSAPP_NUMBER || process.env.WATI_TEAM_NUMBER || null;
  const browseHref = waHref(
    whatsappNumber,
    "Hi Surpluss team, I’d like access to the catalogue.",
  );
  const requirementHref = waHref(
    whatsappNumber,
    "Hi Surpluss team, I have a requirement I’d like to share.",
  );
  const chatHref = waHref(whatsappNumber, "Hi Surpluss team!");

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <PublicHeader
        activePage="about"
        browseHref={browseHref}
        chatHref={chatHref}
      />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-[#eef4fd]">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:py-20">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand/70">
                About Surpluss
              </p>
              <span className="mt-2 block h-1 w-8 rounded-full bg-gold" />
              <h1 className="mt-6 text-4xl leading-tight tracking-[-0.03em] text-brand sm:text-5xl">
                Better products.
                <br />
                Better <span className="text-gold">prices.</span>
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-slate-600">
                Surpluss connects businesses with curated products and inventory
                from brands, manufacturers and distributors, at highly
                competitive prices.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <CatalogueLink
                  fallbackHref={browseHref}
                  trackLocation="about_hero"
                  className="focus-ring inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
                >
                  Browse Catalogue
                  <IconArrowRight className="size-4" />
                </CatalogueLink>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="focus-ring inline-flex h-11 items-center rounded-lg border border-brand/30 bg-white px-6 text-sm font-semibold text-brand transition-colors hover:bg-slate-50"
                >
                  Contact Us
                </a>
              </div>
              <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
                {HIGHLIGHTS.map((item, index) => (
                  <div key={item.label} className="flex items-center gap-5">
                    {index > 0 && (
                      <span className="hidden h-5 w-px bg-slate-300 sm:block" />
                    )}
                    <span className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
                      <item.icon className="size-4 text-brand/70" />
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl">
              <Image
                src="/about-hero.png"
                alt="Curated products from the Surpluss catalogue, including bags, luggage and corporate gifting sets"
                width={729}
                height={447}
                priority
                className="h-auto w-full"
              />
            </div>
          </div>
        </section>

        {/* How Surpluss works */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="text-center">
            <h2 className="text-3xl tracking-[-0.02em] text-brand">
              How Surpluss works
            </h2>
            <span className="mx-auto mt-3 block h-1 w-10 rounded-full bg-gold" />
          </div>
          <div className="mt-12 flex flex-col items-stretch gap-6 lg:flex-row lg:items-center">
            {STEPS.map((step, index) => (
              <div key={step.number} className="contents">
                {index > 0 && (
                  <IconArrowRight className="mx-auto size-5 shrink-0 rotate-90 text-slate-400 lg:rotate-0" />
                )}
                <div className="flex-1 rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center">
                  <span className="mx-auto grid size-9 place-items-center rounded-full bg-brand text-xs font-semibold text-white">
                    {step.number}
                  </span>
                  <span className="mx-auto mt-5 grid size-16 place-items-center rounded-full bg-[#eef4fd] text-brand">
                    <step.icon className="size-7" stroke={1.7} />
                  </span>
                  <h3 className="mt-5 text-lg text-brand">{step.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-600">
                    {step.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-slate-500">
            An enquiry starts a conversation, not an order.
          </p>
        </section>

        {/* Stats and backers */}
        <section className="bg-brand text-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
            <div className="mx-auto grid w-fit gap-8 sm:w-auto sm:grid-cols-3 sm:gap-10">
              {STATS.map((stat, index) => (
                <div
                  key={stat.label}
                  className={
                    index > 0
                      ? "flex items-center gap-4 sm:justify-center sm:border-l sm:border-white/15"
                      : "flex items-center gap-4 sm:justify-center"
                  }
                >
                  <stat.icon
                    className="size-9 shrink-0 text-gold"
                    stroke={1.6}
                  />
                  <div>
                    <p className="text-3xl font-bold tracking-[-0.02em]">
                      <CountUp to={stat.value} separator={stat.separator} />+
                    </p>
                    <p className="mt-1 text-sm text-white/70">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-white/10 py-12">
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
              Backed by
            </p>
            <div className="relative mt-8 overflow-hidden">
              <Marquee
                pauseOnHover
                className="[--duration:35s] [--gap:1.5rem] px-0 py-1"
              >
                {BACKERS.map((backer) => (
                  <div
                    key={backer.name}
                    className="group/logo flex h-16 w-44 shrink-0 items-center justify-center rounded-xl bg-white px-6 transition-transform duration-300 hover:-translate-y-0.5 sm:h-20 sm:w-56 sm:px-8"
                  >
                    <Image
                      src={backer.src}
                      alt={backer.name}
                      width={backer.width}
                      height={backer.height}
                      className={
                        backer.tall
                          ? "max-h-12 w-auto max-w-full object-contain opacity-90 grayscale transition duration-300 group-hover/logo:opacity-100 group-hover/logo:grayscale-0 sm:max-h-16"
                          : "max-h-9 w-auto max-w-full object-contain opacity-90 grayscale transition duration-300 group-hover/logo:opacity-100 group-hover/logo:grayscale-0 sm:max-h-11"
                      }
                    />
                  </div>
                ))}
              </Marquee>
              <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-linear-to-r from-brand via-brand/70 to-transparent sm:w-56 sm:from-15%" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-brand via-brand/70 to-transparent sm:w-56 sm:from-15%" />
            </div>
          </div>
        </section>

        {/* Requirement CTA */}
        <section className="bg-amber-50">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4 sm:gap-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-brand/20 bg-white text-brand sm:size-13">
                <IconFileSearch className="size-5 sm:size-6" stroke={1.7} />
              </span>
              <div>
                <h2 className="text-xl tracking-[-0.02em] text-brand sm:text-2xl">
                  Can’t find what you’re looking for?
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  Tell us what you need and we’ll help identify relevant
                  products and opportunities.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {requirementHref && (
                <TrackedLink
                  event="whatsapp_click"
                  params={{ link_location: "about_requirement" }}
                  href={requirementHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
                >
                  Share Your Requirement
                  <IconArrowRight className="size-4" />
                </TrackedLink>
              )}
              {chatHref && (
                <TrackedLink
                  event="whatsapp_click"
                  params={{ link_location: "about_requirement_chat" }}
                  href={chatHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-brand transition-colors hover:bg-slate-50"
                >
                  <WhatsAppIcon className="size-4.5 text-whatsapp" />
                  WhatsApp Us
                </TrackedLink>
              )}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter whatsappNumber={whatsappNumber} />
      <p className="sr-only">
        <Link href="/login">Team sign in</Link>
      </p>
    </div>
  );
}
