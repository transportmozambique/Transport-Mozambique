"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";

/**
 * O painel das páginas de mapa: um cartão à esquerda num computador, uma folha em baixo num
 * telemóvel. A folha arrasta-se pelo topo (ou toca-se) entre três alturas: baixa (só se vê o topo),
 * meio ecrã e ecrã inteiro (o mapa escondido). Porquê: o motorista vê o mapa e a viagem no mesmo ecrã pequeno.
 */

export type SheetSnap = "peek" | "half" | "full";

const ORDER: SheetSnap[] = ["peek", "half", "full"];
/** Um movimento mais curto do que isto é um toque */
const TAP_PX = 6;
/** Mais rápido do que isto (px/ms) ao largar, a folha segue para a altura seguinte nesse sentido */
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
  /** Altura em px da folha baixa */
  peek: number;
  /** Topo do painel: sempre num computador; num telemóvel só quando a folha enche o ecrã */
  header?: ReactNode;
  label: string;
  children: ReactNode;
}) {
  const [dragH, setDragH] = useState<number | null>(null);
  const sheet = useRef<HTMLElement>(null);
  // Um arrasto largado sobre a pega também lhe faz um clique; esse clique não é um toque
  const dragged = useRef(false);

  // Seguido na janela, para o arrasto continuar quando o ponteiro sai da pega (um rato)
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
      if (!moving) return; // um toque: os botões da pega e do cabeçalho tratam dele
      dragged.current = true;
      setTimeout(() => (dragged.current = false), 0);
      const h = clamp(ev.clientY);
      const speed = (ev.clientY - y0) / Math.max(1, performance.now() - t0);
      // A altura mais próxima, ou a seguinte no sentido de um gesto rápido
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
  // Um toque na pega: sobe um degrau, ou volta a meio a partir do ecrã inteiro
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
