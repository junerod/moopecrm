"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LARGURA_PASSO_COLUNA } from "@/lib/kanban/board-scroll";

export { LARGURA_PASSO_COLUNA } from "@/lib/kanban/board-scroll";

export interface BoardScrollState {
  canScrollLeft: boolean;
  canScrollRight: boolean;
  /** Id da coluna cujo centro está mais perto do centro do viewport do board. */
  activeStageId: string | null;
}

/**
 * Scroll horizontal do quadro: setas, chips e Alt+←/→.
 * Mede overflow real — setas só aparecem quando há o que rolar.
 */
export function useBoardScroll(stageIds: string[]) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<BoardScrollState>({
    canScrollLeft: false,
    canScrollRight: false,
    activeStageId: stageIds[0] ?? null,
  });

  const medir = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const left = el.scrollLeft;
    const eps = 2;
    const canScrollLeft = left > eps;
    const canScrollRight = left < max - eps;

    let activeStageId: string | null = stageIds[0] ?? null;
    const mid = left + el.clientWidth / 2;
    const cols = el.querySelectorAll<HTMLElement>("[data-stage-column]");
    let bestDist = Number.POSITIVE_INFINITY;
    for (const col of cols) {
      const id = col.dataset.stageColumn;
      if (!id) continue;
      const center = col.offsetLeft + col.offsetWidth / 2;
      const dist = Math.abs(center - mid);
      if (dist < bestDist) {
        bestDist = dist;
        activeStageId = id;
      }
    }

    setState((prev) => {
      if (
        prev.canScrollLeft === canScrollLeft &&
        prev.canScrollRight === canScrollRight &&
        prev.activeStageId === activeStageId
      ) {
        return prev;
      }
      return { canScrollLeft, canScrollRight, activeStageId };
    });
  }, [stageIds]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    medir();
    el.addEventListener("scroll", medir, { passive: true });
    const ro = new ResizeObserver(() => medir());
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", medir);
      ro.disconnect();
    };
  }, [medir]);

  const scrollByColumns = useCallback((dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * LARGURA_PASSO_COLUNA, behavior: "smooth" });
  }, []);

  const scrollToStage = useCallback((stageId: string) => {
    const el = scrollerRef.current;
    if (!el) return;
    const col = el.querySelector<HTMLElement>(`[data-stage-column="${stageId}"]`);
    if (!col) return;
    const target =
      col.offsetLeft - (el.clientWidth - col.offsetWidth) / 2;
    el.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const el = scrollerRef.current;
      if (!el) return;
      // Só quando o foco está no board ou dentro dele.
      if (!el.contains(document.activeElement) && document.activeElement !== el) {
        return;
      }
      e.preventDefault();
      scrollByColumns(e.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scrollByColumns]);

  return { scrollerRef, state, scrollByColumns, scrollToStage, remeasure: medir };
}
