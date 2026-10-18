"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { orderStopsAlongRoute } from "@/lib/routeOrder";
import RouteDrawer, { distanceToPath, parseLatLng, pathKm, pathPoints, type DrawnRoute, type Point, type RouteStop } from "@/app/components/RouteDrawer";

/**
 * Redraws an existing route's path on the roads: the current path is shown dashed underneath,
 * the drawing can start from the route's stops, and only a road path is saved (PATCH
 * /api/vias/[id] with geoLocationPath and paragensIds).
 */

interface Via {
  id: string;
  nome: string;
  codigo: string;
  cor: string;
  geoLocationPath: string | null;
  municipio: { nome: string } | null;
  paragens: Array<{ paragem: RouteStop }>;
}

const NEAR_ROUTE_M = 50;

const toPoints = (path: string | null): Point[] =>
  (path || "")
    .split(";")
    .map((p) => p.split(",").map(Number) as Point)
    .filter((p) => p.length === 2 && p.every(Number.isFinite));

export default function RedesenharPercurso() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [via, setVia] = useState<Via | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [allParagens, setAllParagens] = useState<RouteStop[]>([]);
  const [drawn, setDrawn] = useState<DrawnRoute>({ points: 0, path: [], hasRoute: false, ready: false, failed: false });
  const onDrawn = useCallback((route: DrawnRoute) => setDrawn(route), []);
  const [excluded, setExcluded] = useState<string[]>([]); // stops the user unticked
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showNotification = (message: string, type: "success" | "error" | "info" = "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    fetch(`/api/vias/${params.id}`)
      .then((r) => {
        if (r.status === 404) setNotFound(true);
        return r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`));
      })
      .then(setVia)
      .catch((error) => console.error("Erro ao carregar via:", error));
    fetch("/api/paragens?limit=10000")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((result) => setAllParagens(result.data || []))
      .catch((error) => console.error("Erro ao carregar paragens:", error));
  }, [params.id]);

  const current = useMemo(() => toPoints(via?.geoLocationPath ?? null), [via]);
  const linked = useMemo(() => via?.paragens.map((vp) => vp.paragem) ?? [], [via]);
  // A few points of the current path: the router puts the path between them on the roads
  const seed = useMemo(() => ({ label: "Começar pelo percurso atual", points: pathPoints(current) }), [current]);

  const { hasRoute, ready, failed, path } = drawn;
  // Stops on the new path, in travel order, and the linked ones it no longer passes
  const nearby = useMemo(() => {
    if (path.length < 2) return [];
    const near = allParagens.filter((p) => {
      const at = parseLatLng(p.geoLocation);
      return at !== null && distanceToPath(at, path) <= NEAR_ROUTE_M;
    });
    return orderStopsAlongRoute(near, path.map(([lng, lat]) => `${lng},${lat}`).join(";"), (p) => p.geoLocation);
  }, [path, allParagens]);
  const nearIds = useMemo(() => new Set(nearby.map((p) => p.id)), [nearby]);
  const linkedIds = useMemo(() => new Set(linked.map((p) => p.id)), [linked]);
  const away = path.length >= 2 ? linked.filter((p) => !nearIds.has(p.id)) : [];
  const keep = [...nearby, ...away].filter((p) => !excluded.includes(p.id));
  const toggle = (id: string) => setExcluded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = async () => {
    if (!via) return;
    if (!hasRoute) return showNotification("Desenhe o novo percurso no mapa (clique para adicionar pontos)", "error");
    if (!ready) return showNotification("Aguarde: o percurso pelas estradas ainda está a ser calculado.", "info");
    if (failed || path.length < 2) {
      return showNotification("Não foi possível calcular o percurso pelas estradas. Verifique a ligação e mova ou adicione um ponto.", "error");
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/vias/${via.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          geoLocationPath: path.map(([lng, lat]) => `${lng},${lat}`).join(";"),
          paragensIds: keep.map((p) => p.id),
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        showNotification(error.error || `Erro ao guardar o percurso: ${response.status}`, "error");
        return;
      }
      showNotification("Percurso guardado", "success");
      setTimeout(() => router.push(`/vias/${via.id}`), 1200);
    } catch (error) {
      console.error("Erro ao guardar o percurso:", error);
      showNotification(error instanceof Error ? error.message : "Erro ao guardar o percurso", "error");
    } finally {
      setSaving(false);
    }
  };

  if (notFound) {
    return (
      <div className="max-w-[1600px] mx-auto p-6">
        <h2 className="text-2xl font-bold text-slate-900">Via não encontrada</h2>
        <button onClick={() => router.push("/vias")} className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl font-medium">
          Voltar para Vias
        </button>
      </div>
    );
  }

  const stopRow = (p: RouteStop, i: number | null, tag: string) => (
    <label
      key={p.id}
      className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer ${
        excluded.includes(p.id) ? "border-slate-200 hover:border-slate-300" : "border-slate-900 bg-slate-50"
      }`}
    >
      <input
        type="checkbox"
        checked={!excluded.includes(p.id)}
        onChange={() => toggle(p.id)}
        className="w-4 h-4 text-slate-900 border-slate-300 rounded-lg focus:ring-slate-900"
      />
      {i !== null && <span className="text-xs text-slate-500 w-5 text-right">{i + 1}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-900 truncate">{p.nome}</span>
        <span className="block text-xs text-slate-600 font-mono">{p.codigo}</span>
      </span>
      <span className="text-xs text-slate-600 shrink-0">{tag}</span>
    </label>
  );

  return (
    <div className="bg-white min-h-screen">
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div
            className={`rounded-xl shadow-lg p-4 min-w-[300px] border ${
              notification.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : notification.type === "error"
                  ? "bg-red-50 border-red-200 text-red-800"
                  : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            <p className="text-sm font-medium">{notification.message}</p>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-4 min-w-0">
            <button
              onClick={() => router.push(`/vias/${params.id}`)}
              className="p-2 rounded-xl hover:bg-slate-100 flex-shrink-0"
              aria-label="Voltar à via"
            >
              <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 truncate">Redesenhar percurso</h2>
              <p className="text-slate-600 mt-1 truncate">
                {via ? `${via.codigo} · ${via.nome}${via.municipio ? ` · ${via.municipio.nome}` : ""}` : "A carregar…"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/vias/${params.id}`)}
              className="px-4 py-2 bg-slate-200 text-slate-900 rounded-xl font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving || !via || !ready || failed}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium disabled:opacity-50"
            >
              {saving ? "A guardar…" : "Guardar percurso"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Como redesenhar</h3>
              <p className="text-sm text-slate-600 mt-1">
                A linha cinzenta tracejada é o percurso atual. Comece pelo percurso atual (alguns pontos ao longo dele), ou
                clique no mapa, e mova, junte ou remova pontos até a linha seguir as estradas por onde o transporte passa. Só um percurso calculado pelas estradas pode
                ser guardado. Os autocarros simulados e as estimativas de chegada passam a usar o novo percurso.
              </p>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-700" data-testid="route-counts">
              <span>
                Percurso atual: <strong className="text-slate-900">{current.length > 1 ? `${pathKm(current).toFixed(1)} km` : "nenhum"}</strong>
              </span>
              <span>
                Pontos: <strong className="text-slate-900">{drawn.points}</strong>
              </span>
              <span>
                Paragens ligadas: <strong className="text-slate-900">{linked.length}</strong>
              </span>
            </div>

            {path.length >= 2 ? (
              <>
                <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">
                    Paragens no novo percurso ({nearby.filter((p) => !excluded.includes(p.id)).length} de {nearby.length})
                  </h4>
                  {nearby.length ? (
                    <div className="space-y-2 max-h-[320px] overflow-y-auto">
                      {nearby.map((p, i) => stopRow(p, i, linkedIds.has(p.id) ? "ligada" : "nova"))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">Nenhuma paragem a menos de {NEAR_ROUTE_M} m do novo percurso.</p>
                  )}
                </div>
                {away.length > 0 && (
                  <div className="pt-4 border-t border-slate-200">
                    <h4 className="text-sm font-semibold text-slate-900">Paragens ligadas fora do novo percurso ({away.length})</h4>
                    <p className="text-xs text-slate-600 mt-1 mb-3">
                      A mais de {NEAR_ROUTE_M} m da nova linha. Ficam ligadas à via enquanto estiverem marcadas; desmarque as que a via
                      já não serve.
                    </p>
                    <div className="space-y-2 max-h-[240px] overflow-y-auto">{away.map((p) => stopRow(p, null, "fora"))}</div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-600 pt-4 border-t border-slate-200">
                Desenhe o novo percurso para ver as paragens por onde passa.
              </p>
            )}
          </div>

          <RouteDrawer
            title="Novo percurso"
            color={via?.cor || "#3B82F6"}
            stops={allParagens}
            nearIds={path.length >= 2 ? nearIds : linkedIds}
            reference={current}
            seed={seed}
            onChange={onDrawn}
            className="order-first lg:order-none lg:sticky lg:top-6 lg:self-start"
          />
        </div>
      </div>
    </div>
  );
}
