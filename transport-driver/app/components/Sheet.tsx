"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";

/**
 * The panel of the map pages: a card on the left on a computer, a bottom sheet on a phone. The
 * sheet is dragged by its top (or tapped) between three heights: lowered (only its top shows),
 * half the screen, and the whole screen (the map hidden).
 */

export type SheetSnap = "peek" | "half" | "full";

const ORDER: SheetSnap[] = ["peek", "half", "full"];
/** A move shorter than this is a tap */
const TAP_PX = 6;
/** Faster than this (px/ms) when let go, the sheet goes on to the next height that way */
const FLICK = 0.5;

function heightOf(snap: SheetSnap, peek: number) {
  return snap === "full" ? window.innerHeight : snap === "half" ? window.innerHeight * 0.5 : peek;
}

export default function Sheet({
  snap,
  onSnap,
  peek,
  header,
  label,
  children,
}: {
  snap: SheetSnap;
  onSnap: (snap: SheetSnap) => void;
  /** Height in px of the lowered sheet */
  peek: number;
  /** Top of the panel: always on a computer; on a phone only when the sheet fills the screen */
  header?: ReactNode;
  label: string;
  children: ReactNode;
}) {
  const [dragH, setDragH] = useState<number | null>(null);
  const sheet = useRef<HTMLElement>(null);
  // A drag let go over the handle also clicks it; that click is not a tap
  const dragged = useRef(false);

  // Followed on the window, so the drag goes on when the pointer leaves the handle (a mouse)
  const onDown = (e: PointerEvent) => {
    if (window.matchMedia("(min-width: 768px)").matches) return;
    const y0 = e.clientY;
    const h0 = sheet.current?.getBoundingClientRect().height ?? heightOf(snap, peek);
    const t0 = performance.now();
    let moving = false;
    const clamp = (y: number) => Math.max(peek, Math.min(window.innerHeight, h0 - (y - y0)));
    const move = (ev: globalThis.PointerEvent) => {
      if (!moving && Math.abs(ev.clientY - y0) < TAP_PX) return;
      moving = true;
      setDragH(clamp(ev.clientY));
    };
    const up = (ev: globalThis.PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (!moving) return; // a tap: the buttons in the handle and header take it
      dragged.current = true;
      setTimeout(() => (dragged.current = false), 0);
      const h = clamp(ev.clientY);
      const speed = (ev.clientY - y0) / Math.max(1, performance.now() - t0);
      // The nearest height, or the next one in the direction of a flick
      const heights = ORDER.map((s) => heightOf(s, peek));
      let i = heights.reduce((best, x, k) => (Math.abs(x - h) < Math.abs(heights[best] - h) ? k : best), 0);
      if (speed < -FLICK) i = heights.findIndex((x) => x > h + 1) === -1 ? ORDER.length - 1 : heights.findIndex((x) => x > h + 1);
      if (speed > FLICK) i = Math.max(0, heights.filter((x) => x < h - 1).length - 1);
      setDragH(null);
      onSnap(ORDER[i]);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  // A tap on the handle: up a step, or back to half from the whole screen
  const cycle = () => !dragged.current && onSnap(snap === "peek" ? "half" : snap === "half" ? "full" : "half");

  const full = snap === "full" && dragH === null;
  const height = dragH !== null ? `${dragH}px` : snap === "full" ? "100dvh" : snap === "half" ? "50dvh" : `${peek}px`;

  return (
    <section
      ref={sheet}
      aria-label={label}
      style={{ "--sheet-h": height } as React.CSSProperties}
      className={`absolute left-0 right-0 bottom-0 flex flex-col bg-white shadow-2xl max-md:h-(--sheet-h) md:left-3 md:right-auto md:top-3 md:bottom-3 md:w-[420px] md:rounded-2xl ${
        full ? "z-50" : "z-30 rounded-t-3xl"
      } ${dragH === null ? "transition-[height] duration-300 ease-out" : ""}`}
    >
      <div className="shrink-0 touch-none md:touch-auto" onPointerDown={onDown}>
        <button
          type="button"
          className="md:hidden flex w-full justify-center pt-2 pb-1.5"
          onClick={cycle}
          aria-label={snap === "full" ? "Mostrar o mapa" : "Subir o painel"}
        >
          <span className="h-1.5 w-10 rounded-full bg-slate-300" />
        </button>
        {header && <div className={`${full ? "flex" : "hidden"} md:flex items-center justify-between gap-2 border-b border-slate-100 px-4 pb-3 md:pt-3`}>{header}</div>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 md:pt-4">{children}</div>
    </section>
  );
}
