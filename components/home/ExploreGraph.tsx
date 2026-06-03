"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import type { ClientGraph, ClientGraphNode, GraphCluster } from "@/lib/semantic-graph/types";
import type { ProjectMeta } from "@/lib/projects/types";

// ---------------------------------------------------------------------------
// Card size constants
// ---------------------------------------------------------------------------

const FOCUS_W = 320;
const FOCUS_H = 380;
const D1_W = 220;
const D1_H = 280;
const D2_W = 160;
const D2_H = 200;

// ---------------------------------------------------------------------------
// Layout computation
// ---------------------------------------------------------------------------

interface GraphItem {
  id: string;
  depth: 0 | 1 | 2;
  pos: { x: number; y: number };
  parentId?: string;
  linkKind?: "near" | "bridge";
}

interface GraphEdge {
  fromId: string;
  toId: string;
  kind: "near" | "bridge";
}

function buildLayout(
  focusedNode: ClientGraphNode<ProjectMeta>,
  nodeMap: Map<string, ClientGraphNode<ProjectMeta>>,
  cw: number,
  ch: number,
): { items: GraphItem[]; edges: GraphEdge[] } {
  const CX = cw / 2;
  const CY = ch / 2;

  const MIN_R1 = (FOCUS_W + D1_W) / 2 + 40;
  const R1 = Math.max(MIN_R1, Math.min(460, Math.min(cw, ch) * 0.4));

  const MIN_R2 = (D1_W + D2_W) / 2 + 30;
  const R2 = Math.max(MIN_R2, Math.min(300, R1 * 0.76));

  const items: GraphItem[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>([focusedNode.id]);

  items.push({ id: focusedNode.id, depth: 0, pos: { x: CX, y: CY } });

  const d1 = focusedNode.similar.slice(0, 3);
  d1.forEach((link, i) => {
    if (seen.has(link.id)) return;
    const angle = (2 * Math.PI * i) / d1.length;
    items.push({
      id: link.id,
      depth: 1,
      pos: { x: CX + Math.cos(angle) * R1, y: CY + Math.sin(angle) * R1 },
      parentId: focusedNode.id,
      linkKind: link.kind,
    });
    edges.push({ fromId: focusedNode.id, toId: link.id, kind: link.kind });
    seen.add(link.id);
  });

  d1.forEach((parentLink, pi) => {
    const parent = nodeMap.get(parentLink.id);
    if (!parent) return;
    const parentAngle = (2 * Math.PI * pi) / d1.length;
    const px = CX + Math.cos(parentAngle) * R1;
    const py = CY + Math.sin(parentAngle) * R1;

    const children = parent.similar.filter((s) => !seen.has(s.id)).slice(0, 2);
    children.forEach((childLink, ci) => {
      const spread = children.length === 1 ? 0 : (ci - 0.5) * 1.7;
      const childAngle = parentAngle + spread;
      items.push({
        id: childLink.id,
        depth: 2,
        pos: {
          x: px + Math.cos(childAngle) * R2,
          y: py + Math.sin(childAngle) * R2,
        },
        parentId: parentLink.id,
        linkKind: childLink.kind,
      });
      edges.push({ fromId: parentLink.id, toId: childLink.id, kind: childLink.kind });
      seen.add(childLink.id);
    });
  });

  return { items, edges };
}

// ---------------------------------------------------------------------------
// Pan/zoom
// ---------------------------------------------------------------------------

interface Transform { scale: number; tx: number; ty: number }
const IDENTITY: Transform = { scale: 1, tx: 0, ty: 0 };

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ExploreGraphProps {
  graph: ClientGraph<ProjectMeta>;
  focusedNodeId: string;
  onFocusNode: (nodeId: string) => void;
  onBack: () => void;
}

export function ExploreGraph({ graph, focusedNodeId, onFocusNode, onBack }: ExploreGraphProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1280));
  const [ch, setCh] = useState(() => (typeof window !== "undefined" ? window.innerHeight : 800));
  const [xf, setXf] = useState<Transform>(IDENTITY);
  const xfRef = useRef<Transform>(IDENTITY);
  const dragRef = useRef<{ sx: number; sy: number } | null>(null);
  const didDragRef = useRef(false);

  useEffect(() => { xfRef.current = xf; }, [xf]);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { setCw(el.offsetWidth); setCh(el.offsetHeight); });
    ro.observe(el);
    setCw(el.offsetWidth);
    setCh(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
      setXf((t) => {
        const newScale = clamp(t.scale * factor, 0.25, 3);
        const mx = e.clientX - el.getBoundingClientRect().left;
        const my = e.clientY - el.getBoundingClientRect().top;
        return {
          scale: newScale,
          tx: mx - (mx - t.tx) * (newScale / t.scale),
          ty: my - (my - t.ty) * (newScale / t.scale),
        };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;

    let touchDragStart: { sx: number; sy: number } | null = null;
    let touchStartPos: { x: number; y: number } | null = null;
    let lastPinchDist: number | null = null;

    const onTouchStart = (e: TouchEvent) => {
      didDragRef.current = false;
      if (e.touches.length === 1) {
        const t = e.touches[0];
        if (!(t.target as HTMLElement).closest("[data-card]")) {
          touchDragStart = { sx: t.clientX - xfRef.current.tx, sy: t.clientY - xfRef.current.ty };
          touchStartPos = { x: t.clientX, y: t.clientY };
        } else {
          touchDragStart = null; touchStartPos = null;
        }
        lastPinchDist = null;
      } else if (e.touches.length === 2) {
        touchDragStart = null; touchStartPos = null;
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        lastPinchDist = Math.hypot(dx, dy);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2 && lastPinchDist !== null) {
        const [t0, t1] = [e.touches[0], e.touches[1]];
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const factor = dist / lastPinchDist;
        const midX = (t0.clientX + t1.clientX) / 2;
        const midY = (t0.clientY + t1.clientY) / 2;
        const rect = el.getBoundingClientRect();
        setXf((cur) => {
          const newScale = clamp(cur.scale * factor, 0.25, 3);
          const mx = midX - rect.left;
          const my = midY - rect.top;
          return { scale: newScale, tx: mx - (mx - cur.tx) * (newScale / cur.scale), ty: my - (my - cur.ty) * (newScale / cur.scale) };
        });
        lastPinchDist = dist;
        didDragRef.current = true;
      } else if (e.touches.length === 1 && touchDragStart !== null) {
        const t = e.touches[0];
        const newTx = t.clientX - touchDragStart.sx;
        const newTy = t.clientY - touchDragStart.sy;
        if (touchStartPos && (Math.abs(t.clientX - touchStartPos.x) > 4 || Math.abs(t.clientY - touchStartPos.y) > 4)) {
          didDragRef.current = true;
        }
        setXf((prev) => ({ scale: prev.scale, tx: newTx, ty: newTy }));
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) lastPinchDist = null;
      if (e.touches.length === 0) { touchDragStart = null; touchStartPos = null; }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  useEffect(() => { setXf(IDENTITY); }, [focusedNodeId]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    didDragRef.current = false;
    if ((e.target as HTMLElement).closest("[data-card]")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { sx: e.clientX - xf.tx, sy: e.clientY - xf.ty };
  }, [xf]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    if (!dragRef.current) return;
    const newTx = e.clientX - dragRef.current.sx;
    const newTy = e.clientY - dragRef.current.sy;
    if (Math.abs(newTx - xf.tx) > 4 || Math.abs(newTy - xf.ty) > 4) didDragRef.current = true;
    setXf((t) => ({ ...t, tx: newTx, ty: newTy }));
  }, [xf]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    dragRef.current = null;
  }, []);

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n as ClientGraphNode<ProjectMeta>]));
  const focusedNode = nodeMap.get(focusedNodeId);
  if (!focusedNode) return null;

  const { items, edges } = buildLayout(focusedNode, nodeMap, cw, ch);

  return (
    <motion.div
      ref={overlayRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-40 overflow-hidden"
      style={{ cursor: dragRef.current ? "grabbing" : "grab", touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Pan/zoom world */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${xf.tx}px,${xf.ty}px) scale(${xf.scale})`,
          transformOrigin: "0 0",
        }}
      >
        {/* Connection lines */}
        <svg
          style={{ position: "absolute", inset: 0, width: cw, height: ch, overflow: "visible", pointerEvents: "none" }}
        >
          <AnimatePresence>
            {edges.map((edge, ei) => {
              const from = items.find((n) => n.id === edge.fromId);
              const to = items.find((n) => n.id === edge.toId);
              if (!from || !to) return null;
              return (
                <motion.line
                  key={`${edge.fromId}→${edge.toId}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 + ei * 0.04 }}
                  x1={from.pos.x} y1={from.pos.y}
                  x2={to.pos.x} y2={to.pos.y}
                  stroke={edge.kind === "bridge" ? "rgb(80 200 180 / 0.4)" : "rgb(238 238 242 / 0.15)"}
                  strokeWidth={edge.kind === "bridge" ? 1.5 : 1}
                  strokeDasharray={edge.kind === "bridge" ? "5 4" : undefined}
                />
              );
            })}
          </AnimatePresence>
        </svg>

        {/* Cards */}
        <AnimatePresence mode="sync">
          {items.map((item, idx) => {
            const node = nodeMap.get(item.id);
            if (!node) return null;
            const cluster = graph.clusters.find((c) => c.id === node.primaryClusterId);
            const isFocused = item.id === focusedNodeId;
            const w = item.depth === 0 ? FOCUS_W : item.depth === 1 ? D1_W : D2_W;
            const h = item.depth === 0 ? FOCUS_H : item.depth === 1 ? D1_H : D2_H;

            return (
              <ExploreCard
                key={item.id}
                node={node}
                cluster={cluster}
                item={item}
                w={w}
                h={h}
                isFocused={isFocused}
                animDelay={idx * 0.045}
                onFocus={item.depth > 0 ? () => { if (!didDragRef.current) onFocusNode(item.id); } : undefined}
              />
            );
          })}
        </AnimatePresence>
      </div>

      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        transition={{ delay: 0.25, duration: 0.3 }}
        onClick={onBack}
        data-card
        className="absolute left-6 top-20 z-50 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-dim transition-colors hover:text-ink"
      >
        ← All projects
      </motion.button>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-faint"
      >
        scroll · pinch to zoom · drag to pan
      </motion.p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Individual card
// ---------------------------------------------------------------------------

interface ExploreCardProps {
  node: ClientGraphNode<ProjectMeta>;
  cluster: GraphCluster | undefined;
  item: GraphItem;
  w: number;
  h: number;
  isFocused: boolean;
  animDelay: number;
  onFocus?: () => void;
}

function ExploreCard({ node, cluster, item, w, h, isFocused, animDelay, onFocus }: ExploreCardProps) {
  const p = node.metadata;
  const year = new Date(p.startDatetime).getFullYear();
  const targetX = item.pos.x - w / 2;
  const targetY = item.pos.y - h / 2;

  return (
    <motion.div
      data-card
      initial={{ opacity: 0, scale: 0.85, x: targetX, y: targetY }}
      animate={{ opacity: 1, scale: 1, x: targetX, y: targetY }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{
        opacity: { duration: 0.3, delay: animDelay },
        scale: { duration: 0.4, delay: animDelay, ease: [0.22, 1, 0.36, 1] },
        x: { type: "spring", stiffness: 280, damping: 32 },
        y: { type: "spring", stiffness: 280, damping: 32 },
      }}
      onClick={onFocus}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: w,
        cursor: onFocus ? "pointer" : "default",
        zIndex: isFocused ? 10 : item.depth === 1 ? 5 : 3,
      }}
      className={[
        "rounded-xl border overflow-hidden backdrop-blur-md",
        isFocused
          ? "border-ink-faint/15 bg-canvas-raised/35"
          : item.depth === 1
            ? "border-ink-faint/25 bg-canvas-raised/82 shadow-lg transition-colors hover:border-ink-faint/40 hover:bg-canvas-raised/90"
            : "border-ink-faint/10 bg-canvas-raised/38 transition-colors hover:border-ink-faint/20",
      ].join(" ")}
    >
      {/* Preview image */}
      {item.depth < 2 && (
        <div className="relative overflow-hidden bg-canvas-raised" style={{ height: isFocused ? 160 : 110 }}>
          <Image
            src={p.featuredTokenImageUrl}
            alt={p.name}
            fill
            className="object-cover"
            sizes="320px"
            unoptimized
          />
        </div>
      )}

      <div className={isFocused ? "p-5" : item.depth === 1 ? "p-3.5" : "p-3"}>
        {cluster && (
          <p className={[
            "font-mono font-light uppercase tracking-[0.22em] text-ink-dim",
            isFocused ? "mb-2 text-[9px]" : item.depth === 1 ? "mb-1.5 text-[8px]" : "mb-1 text-[7px]",
          ].join(" ")}>
            {cluster.label}
          </p>
        )}

        <h3 className={[
          "font-semibold leading-tight tracking-tight text-ink",
          isFocused ? "text-lg" : item.depth === 1 ? "text-sm" : "text-xs",
        ].join(" ")}>
          {p.name}
        </h3>

        {item.depth < 2 && (
          <p className={["text-ink-dim", isFocused ? "mt-1 text-sm" : "mt-1 text-xs"].join(" ")}>
            {p.artistName}
          </p>
        )}

        <div className={["flex items-center", isFocused ? "mt-4 gap-3" : "mt-3"].join(" ")}>
          <span className={["font-mono text-ink-faint", isFocused ? "text-[10px]" : "text-[9px]"].join(" ")}>
            {year}
          </span>

          {isFocused && (
            <div className="ml-auto flex items-center gap-2">
              <a
                href={p.artBlocksUrl}
                target="_blank"
                rel="noreferrer noopener"
                onClick={(e) => e.stopPropagation()}
                className="rounded-md border border-accent/35 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-accent transition-colors hover:border-accent hover:bg-accent/8"
              >
                Art Blocks →
              </a>
              <Link
                href={`/project/${node.id}`}
                onClick={(e) => e.stopPropagation()}
                className="rounded-md border border-ink-faint/25 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink transition-colors hover:border-accent hover:text-accent"
              >
                Details →
              </Link>
            </div>
          )}

          {!isFocused && item.linkKind === "bridge" && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent opacity-60" />
          )}
        </div>
      </div>
    </motion.div>
  );
}
