export type ProjectMeta = {
  /** URL-safe slug, e.g. "chromie-squiggle-by-snowfro" */
  slug: string;
  /** Display name, e.g. "Chromie Squiggle" */
  name: string;
  /** Artist display name */
  artistName: string;
  /** Full project description */
  description: string;
  /** Art Blocks tags, e.g. ["curated series 1", "animated"] */
  tags: string[];
  /** Script type, e.g. "p5@1.0.0" */
  scriptType: string;
  /** Vertical category: "curated", "playground", "factory", etc. */
  vertical: string;
  /** Number of minted tokens */
  invocations: number;
  /** ISO datetime of first mint */
  startDatetime: string;
  /** Canonical Art Blocks project URL */
  artBlocksUrl: string;
  /** Preview image URL for a featured token */
  featuredTokenImageUrl: string;
  /** Optional artist website */
  website?: string;
};
