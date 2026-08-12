import type { Metadata } from "next";
import { locales, isLocale, defaultLocale, type Locale } from "@/lib/i18n";
import { xdp } from "@/lib/xdp-i18n";
import { XdpLanding } from "@/components/XdpLanding";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const loc: Locale = isLocale(lang) ? lang : defaultLocale;
  const t = xdp[loc];
  return {
    title: { absolute: t.meta.title },
    description: t.meta.description,
    alternates: { canonical: `/${loc}/xdp/` },
  };
}

export default async function LocalizedXdp({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const loc: Locale = isLocale(lang) ? lang : defaultLocale;
  return <XdpLanding locale={loc} basePath={`/${loc}`} />;
}
