"use client";

import { useEffect, useState } from "react";
import { normalizeLicense, LICENSE_META, type LicenseCategory } from "./licenses";

export interface MarketEntry {
  floorEth: number | null;
  license: string | null;
  licenseCategory: LicenseCategory;
}

export interface MarketData {
  projects: Record<string, MarketEntry>;
  ethUsd: number | null;
  loading: boolean;
  error: boolean;
}

// Module-level cache — shared across all components
let _cache: { data: MarketData; ts: number } | null = null;
let _inflight: Promise<MarketData> | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function loadMarketData(): Promise<MarketData> {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL) return _cache.data;
  if (_inflight) return _inflight;

  _inflight = (async () => {
    try {
      const res = await fetch("/api/prices");
      if (!res.ok) throw new Error(`${res.status}`);
      const json = (await res.json()) as {
        ethUsd: number | null;
        projects: Record<string, { floorEth: number | null; license: string | null }>;
      };
      const projects: Record<string, MarketEntry> = {};
      for (const [id, p] of Object.entries(json.projects)) {
        projects[id] = {
          floorEth: p.floorEth,
          license: p.license,
          licenseCategory: normalizeLicense(p.license),
        };
      }
      const data: MarketData = { projects, ethUsd: json.ethUsd, loading: false, error: false };
      _cache = { data, ts: Date.now() };
      return data;
    } catch {
      return { projects: {}, ethUsd: null, loading: false, error: true };
    } finally {
      _inflight = null;
    }
  })();

  return _inflight;
}

export function useMarketData(): MarketData {
  const [state, setState] = useState<MarketData>(() =>
    _cache ? _cache.data : { projects: {}, ethUsd: null, loading: true, error: false },
  );

  useEffect(() => {
    if (_cache && Date.now() - _cache.ts < CACHE_TTL) {
      setState(_cache.data);
      return;
    }
    loadMarketData().then(setState);
  }, []);

  return state;
}

// -------------------------------------------------------------------------
// Filter types & helpers
// -------------------------------------------------------------------------

/** USD price range buckets */
export type PriceRange = "any" | "under-100" | "under-500" | "500-2000" | "2000-10000" | "over-10000";

/** License filter aligned to the business display question */
export type LicenseFilter =
  | "any"
  | "display-included"   // open licenses — anyone can display commercially
  | "owner-display"      // NFT ownership grants commercial display
  | "non-commercial"     // personal use only
  | "restricted";        // all rights reserved / unknown

export interface FilterState {
  priceRange: PriceRange;
  licenseFilter: LicenseFilter;
  budgetMode: boolean;
  /** Total budget in USD */
  budgetUsd: string;
  budgetPieces: string;
}

export const DEFAULT_FILTERS: FilterState = {
  priceRange: "any",
  licenseFilter: "any",
  budgetMode: false,
  budgetUsd: "",
  budgetPieces: "1",
};

export function isFilterActive(f: FilterState): boolean {
  if (f.budgetMode && f.budgetUsd !== "") return true;
  if (!f.budgetMode && f.priceRange !== "any") return true;
  if (f.licenseFilter !== "any") return true;
  return false;
}

/** Per-piece budget in USD, or null if not set */
export function perPieceBudgetUsd(f: FilterState): number | null {
  const total = parseFloat(f.budgetUsd);
  const pieces = parseInt(f.budgetPieces) || 1;
  if (isNaN(total) || total <= 0) return null;
  return total / pieces;
}

/** Format USD for display */
export function fmtUsd(usd: number): string {
  if (usd < 1000) return `$${Math.round(usd)}`;
  if (usd < 10000) return `$${(usd / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `$${Math.round(usd / 1000)}K`;
}

/** Format USD with full precision for cards */
export function fmtUsdFull(usd: number): string {
  return `$${Math.round(usd).toLocaleString()}`;
}

function licenseMatchesFilter(cat: LicenseCategory, filter: LicenseFilter): boolean {
  if (filter === "any") return true;
  if (filter === "display-included") return cat === "display-included";
  if (filter === "owner-display") return cat === "owner-display";
  if (filter === "non-commercial") return cat === "non-commercial";
  if (filter === "restricted") return cat === "all-rights-reserved" || cat === "other";
  return true;
}

export function meetsFilter(
  entry: MarketEntry | undefined,
  f: FilterState,
  ethUsd: number | null,
): boolean {
  if (!isFilterActive(f)) return true;

  // Convert floor to USD
  const floorUsd =
    entry?.floorEth != null && ethUsd != null ? entry.floorEth * ethUsd : null;

  // Price check
  if (f.budgetMode) {
    const ppb = perPieceBudgetUsd(f);
    if (ppb !== null) {
      if (floorUsd == null) return false;
      if (floorUsd > ppb) return false;
    }
  } else if (f.priceRange !== "any") {
    if (floorUsd === null) return false;
    switch (f.priceRange) {
      case "under-100":   if (floorUsd >= 100)             return false; break;
      case "under-500":   if (floorUsd >= 500)             return false; break;
      case "500-2000":    if (floorUsd < 500 || floorUsd >= 2000)   return false; break;
      case "2000-10000":  if (floorUsd < 2000 || floorUsd >= 10000) return false; break;
      case "over-10000":  if (floorUsd < 10000)            return false; break;
    }
  }

  // License check
  if (f.licenseFilter !== "any") {
    const cat = entry?.licenseCategory ?? "other";
    if (!licenseMatchesFilter(cat, f.licenseFilter)) return false;
  }

  return true;
}
