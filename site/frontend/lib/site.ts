// Site-wide constants. Kept in one place so branding/links are easy to swap
// when the landing-page design handoff lands.
export const site = {
  name: "Kapkan",
  // No longer "RTBH mitigation": since 1.4.0 announcing a route is one of two
  // backends, the other being an in-kernel XDP drop. This string is the <title>
  // suffix for every page (app/layout.tsx), so it stays short.
  tagline: "Free, open-source DDoS detection & mitigation",
  // Latest released version, shown in the landing hero badge. It lived inline in
  // all five locale dictionaries and went stale at v1.0.0 for four releases —
  // one place now, so bumping it is a single edit at release time.
  version: "1.4.0",
  // Public GitHub repository. The Go module path is github.com/kapkan-io/kapkan
  // (see go.mod), but the repo is published under fornex/kapkan — keep this in
  // sync with the actual repository URL.
  repo: "https://github.com/fornex/kapkan",
} as const;
