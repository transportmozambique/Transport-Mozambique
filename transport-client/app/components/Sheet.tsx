"use client";

import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";

/**
 * The panel of the map pages: a card on the left on a computer, a bottom sheet on a phone. The
 * sheet has three heights: lowered (only its top shows), half the screen, and the whole screen
 * (the map hidden). It moves with the finger from its top, and from its list too, as in map
 * apps: pushing the list up raises the sheet until it fills the screen, and only then scrolls the
 * list; pulling it down at the top of the list lowers the sheet. A tap on the bar raises it a step.
 */

export type SheetSnap = "peek" | "half" | "full";

const ORDER: SheetSnap[] = ["peek", "half", "full"];
/** A move shorter than this is a tap */
const TAP_PX = 6;
/** Faster than this (px/ms) when let go, the sheet goes on to the next height that way */
const FLICK = 0.5;
const isDesktop = () => window.matchMedia("(min-width: 768px)").matches;

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
  const sheet = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  // A drag let go over the handle also clicks it; that click is not a tap
  const dragged = useRef(false);
  // The latest props, for the touch listeners set up once
  const latest = useRef({ snap, onSnap, peek });
  useEffect(() => {
    latest.current = { snap, onSnap, peek };
  }, [snap, onSnap, peek]);

  /**
   * A drag of the sheet from `y0`. While it moves, the height is set on the element itself (no
   * render of the panel's content at every move) and the sheet stays above the page's top bar.
   */
  const startDrag = (y0: number) => {
    const el = sheet.current!;
    const { peek: min } = latest.current;
    const h0 = el.getBoundingClientRect().height;
    const t0 = performance.now();
    const clamp = (y: number) => Math.max(min, Math.min(window.innerHeight, h0 - (y - y0)));
    el.style.transition = "none";
    el.style.zIndex = "50";
    return {
      move(y: number) {
        el.style.height = `${clamp(y)}px`;
      },
      end(y: number) {
        const h = clamp(y);
        const speed = (y - y0) / Math.max(1, performance.now() - t0);
        // The nearest height, or the next one in the direction of a flick
        const heights = ORDER.map((s) => heightOf(s, min));
        let i = heights.reduce((best, x, k) => (Math.abs(x - h) < Math.abs(heights[best] - h) ? k : best), 0);
        if (speed < -FLICK) i = heights.findIndex((x) => x > h + 1) === -1 ? ORDER.length - 1 : heights.findIndex((x) => x > h + 1);
        if (speed > FLICK) i = Math.max(0, heights.filter((x) => x < h - 1).length - 1);
        // Back to the class height, animated from where the finger left it
        el.style.transition = "";
        el.style.height = "";
        el.style.zIndex = "";
        dragged.current = true;
        setTimeout(() => (dragged.current = false), 0);
        latest.current.onSnap(ORDER[i]);
      },
    };
  };

  // The handle and the header: followed on the window, so a mouse can leave the handle
  const onDown = (e: PointerEvent) => {
    if (isDesktop()) return;
    const y0 = e.clientY;
    let drag: ReturnType<typeof startDrag> | null = null;
    const move = (ev: globalThis.PointerEvent) => {
      if (!drag && Math.abs(ev.clientY - y0) < TAP_PX) return;
      drag ??= startDrag(y0);
      drag.move(ev.clientY);
    };
    const up = (ev: globalThis.PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      drag?.end(ev.clientY); // without a drag it was a tap: the buttons take it
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  // The list: a finger moves the sheet first, then scrolls (touch only; a mouse scrolls)
  useEffect(() => {
    const list = body.current;
    if (!list) return;
    let start: { x: number; y: number } | null = null;
    let mode: "undecided" | "sheet" | "scroll" = "undecided";
    let drag: ReturnType<typeof startDrag> | null = null;
    const onStart = (e: TouchEvent) => {
      if (isDesktop() || e.touches.length !== 1) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      mode = "undecided";
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const { clientX, clientY } = e.touches[0];
      const dy = clientY - start.y;
      if (mode === "undecided") {
        if (Math.abs(dy) < TAP_PX && Math.abs(clientX - start.x) < TAP_PX) return;
        const sideways = Math.abs(clientX - start.x) > Math.abs(dy);
        const notFull = latest.current.snap !== "full";
        mode = !sideways && ((dy < 0 && notFull) || (dy > 0 && list.scrollTop <= 0)) ? "sheet" : "scroll";
        if (mode === "sheet") drag = startDrag(start.y);
      }
      if (mode === "sheet" && drag) {
        if (e.cancelable) e.preventDefault();
        drag.move(clientY);
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (mode === "sheet" && drag) drag.end(e.changedTouches[0].clientY);
      start = null;
      drag = null;
      mode = "undecided";
    };
    list.addEventListener("touchstart", onStart, { passive: true });
    list.addEventListener("touchmove", onMove, { passive: false });
    list.addEventListener("touchend", onEnd);
    list.addEventListener("touchcancel", onEnd);
    return () => {
      list.removeEventListener("touchstart", onStart);
      list.removeEventListener("touchmove", onMove);
      list.removeEventListener("touchend", onEnd);
      list.removeEventListener("touchcancel", onEnd);
    };
    // startDrag reads the element and the latest props through refs
  }, []);

  // A tap on the handle: up a step, or back to half from the whole screen
  const cycle = () => !dragged.current && onSnap(snap === "peek" ? "half" : snap === "half" ? "full" : "half");

  const full = snap === "full";
  const height = full ? "100dvh" : snap === "half" ? "50dvh" : `${peek}px`;

  return (
    <section
      ref={sheet}
      aria-label={label}
      style={{ "--sheet-h": height } as React.CSSProperties}
      className={`absolute left-0 right-0 bottom-0 flex flex-col bg-white shadow-2xl transition-[height,border-radius] duration-300 ease-out max-md:h-(--sheet-h) md:left-3 md:right-auto md:top-3 md:bottom-3 md:w-[420px] md:rounded-2xl ${
        full ? "z-50 pt-[env(safe-area-inset-top)]" : "z-30 rounded-t-3xl"
      }`}
    >
      <div className="shrink-0 touch-none md:touch-auto" onPointerDown={onDown}>
        <button
          type="button"
          className="md:hidden flex w-full justify-center pt-2.5 pb-2"
          onClick={cycle}
          aria-label={full ? "Mostrar o mapa" : "Subir o painel"}
        >
          <span className="h-1.5 w-10 rounded-full bg-slate-300" />
        </button>
        {header && <div className={`${full ? "flex" : "hidden"} md:flex items-center justify-between gap-2 border-b border-slate-100 px-4 pb-3 md:pt-3`}>{header}</div>}
      </div>
      <div ref={body} className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 md:pt-4 ${full ? "pt-3" : "pt-0.5"}`}>
        {children}
      </div>
    </section>
  );
}
