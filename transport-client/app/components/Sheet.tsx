"use client";

import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";

/**
 * O painel das páginas de mapa: um cartão à esquerda num computador, uma folha em baixo num
 * telemóvel. A folha tem três alturas: baixa (só se vê o topo), meio ecrã e ecrã inteiro (o mapa
 * escondido). Move-se com o dedo a partir do topo, e também a partir da lista, como nas aplicações
 * de mapas: empurrar a lista para cima sobe a folha até encher o ecrã, e só então desliza a lista;
 * puxá-la para baixo no topo da lista desce a folha. Um toque na barra sobe-a um degrau.
 * Porquê assim: num telemóvel o mapa e a lista disputam o mesmo ecrã pequeno.
 */

export type SheetSnap = "peek" | "half" | "full";

const ORDER: SheetSnap[] = ["peek", "half", "full"];
/** Um movimento mais curto do que isto é um toque */
const TAP_PX = 6;
/** Mais rápido do que isto (px/ms) ao largar, a folha segue para a altura seguinte nesse sentido */
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
  /** Altura em px da folha baixa */
  peek: number;
  /** Topo do painel: sempre num computador; num telemóvel só quando a folha enche o ecrã */
  header?: ReactNode;
  label: string;
  children: ReactNode;
}) {
  const sheet = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  // Um arrasto largado sobre a pega também lhe faz um clique; esse clique não é um toque
  const dragged = useRef(false);
  // As props mais recentes, para os ouvintes de toque registados uma só vez
  const latest = useRef({ snap, onSnap, peek });
  useEffect(() => {
    latest.current = { snap, onSnap, peek };
  }, [snap, onSnap, peek]);

  /**
   * Um arrasto da folha a partir de `y0`. Durante o movimento a altura é posta no próprio elemento
   * (sem redesenhar o conteúdo do painel a cada movimento) e a folha fica acima da barra do topo.
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
        // A altura mais próxima, ou a seguinte no sentido de um gesto rápido
        const heights = ORDER.map((s) => heightOf(s, min));
        let i = heights.reduce((best, x, k) => (Math.abs(x - h) < Math.abs(heights[best] - h) ? k : best), 0);
        if (speed < -FLICK) i = heights.findIndex((x) => x > h + 1) === -1 ? ORDER.length - 1 : heights.findIndex((x) => x > h + 1);
        if (speed > FLICK) i = Math.max(0, heights.filter((x) => x < h - 1).length - 1);
        // De volta à altura da classe, animada a partir de onde o dedo a deixou
        el.style.transition = "";
        el.style.height = "";
        el.style.zIndex = "";
        dragged.current = true;
        setTimeout(() => (dragged.current = false), 0);
        latest.current.onSnap(ORDER[i]);
      },
    };
  };

  // A pega e o cabeçalho: seguidos na janela, para o rato poder sair da pega
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
      drag?.end(ev.clientY); // sem arrasto foi um toque: os botões tratam dele
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  // A lista: um dedo move primeiro a folha, depois desliza (só toque; o rato desliza)
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
    // startDrag lê o elemento e as props mais recentes através de refs
  }, []);

  // Um toque na pega: sobe um degrau, ou volta a meio a partir do ecrã inteiro
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
