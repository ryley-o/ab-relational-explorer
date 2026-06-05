/**
 * License categories are organized around the question that matters most to buyers:
 * "If I purchase this NFT, can I display it in my business?"
 */

export type LicenseCategory =
  | "display-included"    // CC0, CC BY, CC BY-SA — commercial display OK for anyone
  | "owner-display"       // NFT License, NIFTY, CBE — display rights via NFT ownership
  | "non-commercial"      // CC BY-NC variants — personal/editorial use only
  | "all-rights-reserved" // Copyright — all rights reserved by artist
  | "other";              // GPL, custom, or unknown

export interface LicenseMeta {
  id: LicenseCategory;
  label: string;
  shortLabel: string;
  /** What it means for a business that purchases the NFT */
  businessRights: string;
  /** Concise description of the license */
  description: string;
  /** Whether a business can display this commercially */
  canDisplayCommercially: boolean;
  /** Whether ownership is required for display rights */
  requiresOwnership: boolean;
}

export const LICENSE_META: Record<LicenseCategory, LicenseMeta> = {
  "display-included": {
    id: "display-included",
    label: "Display rights included",
    shortLabel: "Open license",
    businessRights: "You can display this in any context — no ownership or attribution required in most cases.",
    description: "Covers CC0 (public domain), CC BY, and CC BY-SA. The most open licenses available.",
    canDisplayCommercially: true,
    requiresOwnership: false,
  },
  "owner-display": {
    id: "owner-display",
    label: "Display rights via ownership",
    shortLabel: "NFT License",
    businessRights: "Purchasing this NFT grants you the right to display it commercially in your space.",
    description: "Covers NFT License, NIFTY, and Can't Be Evil licenses. Standard for most Art Blocks works.",
    canDisplayCommercially: true,
    requiresOwnership: true,
  },
  "non-commercial": {
    id: "non-commercial",
    label: "Personal use only",
    shortLabel: "Non-commercial",
    businessRights: "This license does not allow commercial display. Not suitable for hotels or businesses.",
    description: "Covers CC BY-NC, CC BY-NC-ND, and CC BY-NC-SA. Sharing and personal display is OK.",
    canDisplayCommercially: false,
    requiresOwnership: false,
  },
  "all-rights-reserved": {
    id: "all-rights-reserved",
    label: "All rights reserved",
    shortLabel: "All rights reserved",
    businessRights: "Traditional copyright. Contact the artist directly for commercial display permissions.",
    description: "All rights are retained by the artist. No use without explicit permission.",
    canDisplayCommercially: false,
    requiresOwnership: false,
  },
  other: {
    id: "other",
    label: "Custom / other",
    shortLabel: "Other",
    businessRights: "Custom or unlisted license. Review the specific terms before commercial display.",
    description: "Non-standard license. Review directly with the artist.",
    canDisplayCommercially: false,
    requiresOwnership: false,
  },
};

export function normalizeLicense(raw: string | null | undefined): LicenseCategory {
  if (!raw) return "other";
  const k = raw.trim().toLowerCase().replace(/\s+/g, " ");

  // CBE (Can't Be Evil) — owner gets commercial display rights
  if (k.includes("cbe") || k.includes("can't be evil") || k.includes("cant be evil")) return "owner-display";

  // CC0 — fully open
  if (k === "cc0" || k.startsWith("cc0 ") || k.includes("cc0 1.0") || k.includes("cc0") || k.includes("public domain")) return "display-included";

  // The images/animations are CC0 style
  if (k.includes("is cc0")) return "display-included";

  // CC BY-NC-ND → non-commercial (check before BY-NC and BY)
  if (k.includes("by-nc-nd") || k.includes("by nc nd")) return "non-commercial";

  // CC BY-NC-SA → non-commercial
  if (k.includes("by-nc-sa") || k.includes("by nc sa") || k.includes("by-nc sa") || k.includes("by nc-sa")) return "non-commercial";

  // CC BY-NC → non-commercial
  if (k.includes("by-nc") || k.includes("by nc") || k.includes("attribution-noncommercial")) return "non-commercial";

  // CC BY-SA → display-included (commercial OK with share-alike)
  if (k.includes("by-sa") || k.includes("by sa")) return "display-included";

  // CC BY or plain CC → display-included
  if (k.startsWith("cc by") || k === "cc 4.0") return "display-included";
  if (k.startsWith("creative commons attribution") && !k.includes("noncommercial") && !k.includes("non-commercial")) return "display-included";

  // NIFTY → owner-display
  if (k.includes("nifty")) return "owner-display";

  // NFT License (all versions) → owner-display
  if (k.includes("nft license") || k === "nft 2.0" || k === "nft ownership license" || k.includes("niftylicense.org")) return "owner-display";

  // All Rights Reserved / Copyright
  if (
    k.includes("all rights reserved") ||
    k.startsWith("copyright") ||
    k.startsWith("©") ||
    k === "none" ||
    k.startsWith("no license") ||
    k === "n/a" ||
    k.includes("all rights")
  ) return "all-rights-reserved";

  // GPL etc.
  if (k.includes("gpl") || k.includes("gnu")) return "other";

  return "other";
}

/** Badge color classes for license category */
export function licenseBadgeClass(cat: LicenseCategory): string {
  if (cat === "display-included") return "border-emerald-500/30 text-emerald-400/80";
  if (cat === "owner-display") return "border-accent/30 text-accent/80";
  if (cat === "non-commercial") return "border-amber-500/30 text-amber-400/80";
  return "border-ink-faint/25 text-ink-faint";
}
