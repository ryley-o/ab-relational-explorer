"use client";

import { useState, useEffect } from "react";
import { DEFAULT_FILTERS, type FilterState } from "./use-market-data";

// Module-level store — survives client-side navigation within the same session
let _filters: FilterState = DEFAULT_FILTERS;
const _listeners = new Set<(f: FilterState) => void>();

export function useFilterState(): [FilterState, (f: FilterState) => void] {
  const [filters, setLocal] = useState<FilterState>(_filters);

  useEffect(() => {
    _listeners.add(setLocal);
    setLocal(_filters); // sync on mount in case another page updated it
    return () => { _listeners.delete(setLocal); };
  }, []);

  function setFilters(f: FilterState) {
    _filters = f;
    _listeners.forEach((fn) => fn(f));
  }

  return [filters, setFilters];
}
