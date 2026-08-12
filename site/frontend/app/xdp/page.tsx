import { defaultLocale } from "@/lib/i18n";
import { MetaRedirect } from "@/components/MetaRedirect";

// Bare /xdp → default-locale XDP landing. Keeps the URL the main landing links
// to short, while the content and its language switcher live under /[lang]/xdp
// (so swapping the leading path segment stays correct — the pattern /config uses).
export default function XdpIndexRedirect() {
  return <MetaRedirect to={`/${defaultLocale}/xdp/`} />;
}
