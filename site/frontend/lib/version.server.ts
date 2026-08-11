// The released version the landing advertises, read from the monorepo's
// CHANGELOG.md at build time.
//
// It used to be a constant. That constant was inline in all five locale
// dictionaries and read v1.0.0 for four releases; consolidating it into one place
// bought exactly one day before v1.5.0 shipped and left it stale again. Nothing
// enforces an edit that a human has to remember, so this reads the number from
// the file that a release cannot avoid touching.
//
// SERVER ONLY — never import this from a Client Component. `components/docs/
// DocsChrome.tsx` is a client component and imports `lib/site.ts`, which is
// precisely why the filesystem read lives in its own module rather than next to
// the rest of the site constants.
//
// The site is a static export, so this runs at build time and the answer is baked
// into the prerendered HTML. There is no request-time cost and no runtime
// dependency on the file existing.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// `next build` runs with site/frontend as its working directory; the others are
// fallbacks so a build invoked from the repo root or from site/ still resolves.
const CANDIDATES = ["../../CHANGELOG.md", "../CHANGELOG.md", "CHANGELOG.md"];

// The newest released heading. Keep-a-Changelog puts `## [Unreleased]` first,
// which this skips for free by requiring a semver triple — an unreleased section
// must never become the version the landing claims to have shipped.
const HEADING = /^##\s*\[(\d+\.\d+\.\d+)\]/m;

let cached: string | undefined;

export function latestReleasedVersion(): string {
  if (cached) return cached;

  const tried: string[] = [];
  for (const candidate of CANDIDATES) {
    const path = resolve(process.cwd(), candidate);
    tried.push(path);
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    const match = text.match(HEADING);
    if (!match) {
      throw new Error(
        `version.server: ${path} has no released "## [x.y.z]" heading. ` +
          `Only an [Unreleased] section? The landing must not advertise it.`,
      );
    }
    cached = match[1];
    return cached;
  }

  // Failing the build is the point. The alternative — quietly falling back to a
  // hardcoded number — is the bug this module exists to remove.
  throw new Error(`version.server: no CHANGELOG.md found. Tried:\n  ${tried.join("\n  ")}`);
}
