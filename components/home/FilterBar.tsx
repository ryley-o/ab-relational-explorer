"use client";

import { useState } from "react";
import {
  type FilterState,
  type PriceRange,
  type LicenseFilter,
  DEFAULT_FILTERS,
  isFilterActive,
  perPieceBudgetUsd,
  fmtUsdFull,
} from "@/lib/use-market-data";

export { fmtUsdFull };
import { LICENSE_META, type LicenseCategory } from "@/lib/licenses";

// ─────────────────────────────────────────────────────────────────────────────
// FilterBar
// ─────────────────────────────────────────────────────────────────────────────

const PRICE_RANGES: { value: PriceRange; label: string }[] = [
  { value: "any",        label: "Any price" },
  { value: "under-100",  label: "Under $100" },
  { value: "under-500",  label: "Under $500" },
  { value: "500-2000",   label: "$500 – $2K" },
  { value: "2000-10000", label: "$2K – $10K" },
  { value: "over-10000", label: "$10K+" },
];

interface LicenseOption {
  value: LicenseFilter;
  label: string;
  hint: string;
}

const LICENSE_OPTIONS: LicenseOption[] = [
  {
    value: "any",
    label: "Any",
    hint: "Show all projects regardless of license",
  },
  {
    value: "display-included",
    label: "Free to display",
    hint: "CC0, CC BY — commercial display is fine for anyone, no purchase required",
  },
  {
    value: "owner-display",
    label: "Owner display rights",
    hint: "NFT License, NIFTY — buying the NFT grants you the right to display it in your business",
  },
  {
    value: "non-commercial",
    label: "Personal use only",
    hint: "CC BY-NC variants — not for commercial display in hotels or businesses",
  },
  {
    value: "restricted",
    label: "Restricted",
    hint: "All rights reserved — contact the artist for any commercial use",
  },
];

interface FilterBarProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  matchCount?: number;
  totalCount?: number;
  ethUsd?: number | null;
}

export function FilterBar({ filters, onChange, matchCount, totalCount, ethUsd }: FilterBarProps) {
  const active = isFilterActive(filters);
  const ppb = perPieceBudgetUsd(filters);

  function set(patch: Partial<FilterState>) {
    onChange({ ...filters, ...patch });
  }

  const activePriceRange = !filters.budgetMode ? filters.priceRange : "any";

  return (
    <div className="mb-10 rounded-xl border border-ink-faint/12 bg-canvas-raised/25 divide-y divide-ink-faint/10">

      {/* ── PRICE SECTION ─────────────────────────────────────────── */}
      <div className="px-4 py-3 sm:px-5">
        <p className="mb-2.5 font-mono text-[9px] uppercase tracking-[0.22em] text-ink-faint">
          Price
        </p>

        {/* Price range pills + budget mode toggle in one row (wrap on mobile) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {PRICE_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => set({ priceRange: r.value, budgetMode: false })}
              className={[
                "rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-150",
                activePriceRange === r.value
                  ? "bg-accent/15 text-accent"
                  : "text-ink-dim hover:text-ink",
              ].join(" ")}
            >
              {r.label}
            </button>
          ))}

          <div className="mx-1 h-3.5 w-px bg-ink-faint/20 hidden sm:block" />

          {/* Budget mode toggle */}
          <button
            onClick={() => set({ budgetMode: !filters.budgetMode, priceRange: "any" })}
            className={[
              "rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-150",
              filters.budgetMode
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-ink-faint/20 text-ink-dim hover:text-ink",
            ].join(" ")}
          >
            Budget mode
          </button>
        </div>

        {/* Budget inputs — shown when budget mode is active */}
        {filters.budgetMode && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-accent/15 bg-accent/5 px-4 py-3">
            <label className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-dim whitespace-nowrap">
              Total budget
            </label>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-sm text-accent">$</span>
              <input
                type="number"
                min="0"
                step="100"
                placeholder="0"
                value={filters.budgetUsd}
                onChange={(e) => set({ budgetUsd: e.target.value })}
                className="w-28 rounded-md border border-ink-faint/20 bg-canvas px-2.5 py-1.5 font-mono text-sm text-ink placeholder-ink-faint focus:border-accent/50 focus:outline-none"
              />
            </div>
            <label className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-dim">for</label>
            <input
              type="number"
              min="1"
              step="1"
              placeholder="1"
              value={filters.budgetPieces}
              onChange={(e) => set({ budgetPieces: e.target.value })}
              className="w-16 rounded-md border border-ink-faint/20 bg-canvas px-2.5 py-1.5 font-mono text-sm text-ink placeholder-ink-faint focus:border-accent/50 focus:outline-none"
            />
            <label className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-dim">artworks</label>
            {ppb !== null && (
              <span className="font-mono text-sm font-semibold text-accent whitespace-nowrap">
                = {fmtUsdFull(ppb)}/ea
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── LICENSE SECTION ──────────────────────────────────────── */}
      <div className="px-4 py-3 sm:px-5">
        <div className="mb-2.5 flex items-center gap-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-faint">
            License
          </p>
          <LicenseInfoTip />
        </div>

        {/* License pills */}
        <div className="flex flex-wrap gap-1.5">
          {LICENSE_OPTIONS.map((o) => (
            <LicensePill
              key={o.value}
              option={o}
              active={filters.licenseFilter === o.value}
              onClick={() => set({ licenseFilter: o.value })}
            />
          ))}
        </div>
      </div>

      {/* ── FOOTER: match count + clear ──────────────────────────── */}
      {active && totalCount !== undefined && matchCount !== undefined && (
        <div className="flex items-center justify-between px-4 py-2.5 sm:px-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-dim/70">
            {matchCount === 0
              ? "No projects match"
              : `${matchCount} of ${totalCount} projects match`}
          </p>
          <button
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-dim/60 transition-colors hover:text-ink-dim"
          >
            × Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// License pill with tooltip
// ─────────────────────────────────────────────────────────────────────────────

function LicensePill({
  option,
  active,
  onClick,
}: {
  option: LicenseOption;
  active: boolean;
  onClick: () => void;
}) {
  const [showTip, setShowTip] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={onClick}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        onFocus={() => setShowTip(true)}
        onBlur={() => setShowTip(false)}
        className={[
          "rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-150 border",
          active
            ? "border-accent/40 bg-accent/12 text-accent"
            : "border-transparent text-ink-dim hover:border-ink-faint/20 hover:text-ink",
        ].join(" ")}
      >
        {option.label}
      </button>

      {/* Tooltip */}
      {showTip && option.value !== "any" && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-lg border border-ink-faint/20 bg-canvas-raised/95 p-3 shadow-xl backdrop-blur-md pointer-events-none">
          <p className="text-xs leading-relaxed text-ink-dim">{option.hint}</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// License info tooltip
// ─────────────────────────────────────────────────────────────────────────────

function LicenseInfoTip() {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-ink-faint/30 font-mono text-[9px] text-ink-faint/60 hover:border-ink-faint/50 hover:text-ink-dim"
      >
        ?
      </button>
      {show && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-lg border border-ink-faint/20 bg-canvas-raised/95 p-3.5 shadow-xl backdrop-blur-md pointer-events-none">
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-dim">About Art Blocks licenses</p>
          <p className="text-xs leading-relaxed text-ink-dim/80">
            Most Art Blocks works use <strong className="text-ink/80">NFT License</strong> — buying the NFT gives you the right to display it in your home or business. CC0 and CC BY works are even more open. CC BY-NC works are for personal use only.
          </p>
          <p className="mt-2 text-xs text-ink-faint/70">
            When in doubt, check the project&rsquo;s page on Art Blocks for the exact terms.
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Price badge — USD only
// ─────────────────────────────────────────────────────────────────────────────

interface PriceBadgeProps {
  floorEth: number | null | undefined;
  ethUsd: number | null | undefined;
  loading?: boolean;
  size?: "sm" | "xs";
}

export function PriceBadge({ floorEth, ethUsd, loading, size = "sm" }: PriceBadgeProps) {
  const cls = size === "xs" ? "text-[9px]" : "text-[10px]";
  if (loading) {
    return <span className={`font-mono ${cls} text-ink-faint animate-pulse`}>…</span>;
  }
  if (floorEth == null || ethUsd == null) {
    return <span className={`font-mono ${cls} text-ink-faint/40`}>—</span>;
  }
  return (
    <span className={`font-mono ${cls} text-accent/80`}>
      {fmtUsdFull(floorEth * ethUsd)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// License badge for project cards
// ─────────────────────────────────────────────────────────────────────────────

interface LicenseBadgeProps {
  category: LicenseCategory;
  size?: "sm" | "xs";
}

export function LicenseBadge({ category, size = "xs" }: LicenseBadgeProps) {
  const cls = size === "xs" ? "text-[8px]" : "text-[9px]";
  const meta = LICENSE_META[category];
  const color =
    category === "display-included"
      ? "border-emerald-500/25 text-emerald-400/70"
      : category === "owner-display"
        ? "border-accent/25 text-accent/70"
        : category === "non-commercial"
          ? "border-amber-500/25 text-amber-400/70"
          : "border-ink-faint/20 text-ink-faint/60";
  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono ${cls} uppercase tracking-[0.1em] ${color}`}>
      {meta.shortLabel}
    </span>
  );
}
