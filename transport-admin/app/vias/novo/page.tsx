"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { orderStopsAlongRoute } from "@/lib/routeOrder";
import RouteDrawer, { distanceToPath, parseLatLng, type DrawnRoute, type RouteStop } from "@/app/components/RouteDrawer";

interface Municipio {
  id: string;
  nome: string;
}

const NEAR_ROUTE_M = 50;

export default function NovaVia() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [drawn, setDrawn] = useState<DrawnRoute>({ points: 0, path: [], hasRoute: false, ready: false, failed: false });
  const onDrawn = useCallback((route: DrawnRoute) => setDrawn(route), []);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [allParagens, setAllParagens] = useState<RouteStop[]>([]);
  const [excludedParagens, setExcludedParagens] = useState<string[]>([]); // paragens perto da via que o administrador desmarcou

  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    cor: '#3B82F6',
    terminalPartida: '',
    terminalChegada: '',
    municipioId: '',
  });

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    fetch('/api/municipios?limit=1000')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((result) => setMunicipios(result.data || []))
      .catch((error) => {
        console.error('Erro ao carregar municípios:', error);
        setNotification({ message: 'Erro ao carregar municípios', type: 'error' });
      });
    // Todas as paragens (são mais de 1000)
    fetch('/api/paragens?limit=10000')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((result) => setAllParagens(result.data || []))
      .catch((error) => console.error('Erro ao carregar paragens:', error));
  }, []);

  const { hasRoute, ready: routeReady, failed: routingFailed, path: routedPath } = drawn;

  // Paragens perto da via, pela ordem de viagem
  const nearbyParagens = useMemo(() => {
    if (routedPath.length < 2) return [];
    const near = allParagens.filter((p) => {
      const at = parseLatLng(p.geoLocation);
      return at !== null && distanceToPath(at, routedPath) <= NEAR_ROUTE_M;
    });
    const stored = routedPath.map(([lng, lat]) => `${lng},${lat}`).join(';');
    return orderStopsAlongRoute(near, stored, (p) => p.geoLocation);
  }, [routedPath, allParagens]);
  const selectedParagens = nearbyParagens.filter((p) => !excludedParagens.includes(p.id));
  const terminalPartida = formData.terminalPartida.trim() || selectedParagens[0]?.nome || '';
  const terminalChegada = formData.terminalChegada.trim() || selectedParagens[selectedParagens.length - 1]?.nome || '';

  const nearIds = useMemo(() => new Set(nearbyParagens.map((p) => p.id)), [nearbyParagens]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome || !formData.codigo || !formData.municipioId) {
      showNotification('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    if (!hasRoute) {
      showNotification('Desenhe a rota no mapa (clique para adicionar pontos)', 'error');
      return;
    }

    if (!routeReady) {
      showNotification('Aguarde: o percurso pelas estradas ainda está a ser calculado.', 'info');
      return;
    }

    if (routingFailed || routedPath.length < 2) {
      showNotification('Não foi possível calcular o percurso pelas estradas. Verifique a ligação e mova ou adicione um ponto.', 'error');
      return;
    }

    if (!terminalPartida || !terminalChegada) {
      showNotification('Indique os terminais de partida e de chegada', 'error');
      return;
    }

    setLoading(true);
    try {
      // Guardar o percurso pelas estradas no formato guardado "lng,lat;lng,lat"
      const geoLocationPath = routedPath.map(([lng, lat]) => `${lng},${lat}`).join(';');

      const response = await fetch('/api/vias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          terminalPartida,
          terminalChegada,
          geoLocationPath,
          paragensIds: selectedParagens.map((p) => p.id),
        }),
      });

      if (response.ok) {
        showNotification('Via criada com sucesso!', 'success');
        setTimeout(() => router.push('/vias'), 1500);
      } else {
        const errorText = await response.text();
        console.error('Resposta de erro:', errorText);
        try {
          const error = JSON.parse(errorText);
          showNotification(error.details || error.error || 'Erro ao criar via', 'error');
        } catch {
          showNotification(`Erro ao criar via: ${response.status} ${response.statusText}`, 'error');
        }
      }
    } catch (error) {
      console.error('Excepção ao criar via:', error);
      showNotification(
        error instanceof Error ? error.message : 'Erro ao criar via',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Notificação */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`rounded-xl shadow-lg p-4 min-w-[300px] ${
            notification.type === 'success' ? 'bg-slate-50 border border-slate-200' :
            notification.type === 'error' ? 'bg-slate-100 border border-slate-400' :
            'bg-slate-50 border border-slate-200'
          }`}>
            <div className="flex items-center space-x-3">
              {notification.type === 'success' && (
                <svg className="w-5 h-5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg className="w-5 h-5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <p className={`text-sm font-medium ${
                notification.type === 'success' ? 'text-slate-800' :
                notification.type === 'error' ? 'text-slate-900' :
                'text-slate-800'
              }`}>
                {notification.message}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/vias')}
            className="p-2 rounded-xl hover:bg-slate-100 flex-shrink-0"
            aria-label="Voltar às vias"
          >
            <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Nova Via</h2>
            <p className="text-slate-600 mt-1">Criar uma nova via no sistema</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulário */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Informações da Via</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Nome da Via *
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                  placeholder="Ex: Via Principal Centro"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Código *
                </label>
                <input
                  type="text"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                  placeholder="Ex: VP-001"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Município *
                </label>
                <select
                  value={formData.municipioId}
                  onChange={(e) => setFormData({ ...formData, municipioId: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                  required
                >
                  <option value="">Selecione um município</option>
                  {municipios.map((m) => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Terminal de Partida *
                  </label>
                  <input
                    type="text"
                    value={formData.terminalPartida}
                    onChange={(e) => setFormData({ ...formData, terminalPartida: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                    placeholder={selectedParagens[0] ? `${selectedParagens[0].nome} (1.ª paragem)` : 'Ex: Terminal Central'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Terminal de Chegada *
                  </label>
                  <input
                    type="text"
                    value={formData.terminalChegada}
                    onChange={(e) => setFormData({ ...formData, terminalChegada: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                    placeholder={selectedParagens.length > 1 ? `${selectedParagens[selectedParagens.length - 1].nome} (última paragem)` : 'Ex: Terminal Norte'}
                  />
                </div>
              </div>
              {selectedParagens.length > 0 && (
                <p className="text-xs text-slate-600 -mt-2">Em branco: usa a primeira e a última paragem da rota.</p>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Cor da Rota
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={formData.cor}
                    onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                    className="h-10 w-20 border border-slate-300 rounded-lg cursor-pointer"
                  />
                  <span className="text-sm text-slate-600">{formData.cor}</span>
                </div>
              </div>

              {/* Paragens ao longo da via desenhada, pela ordem de viagem */}
              {nearbyParagens.length > 0 && (
                <div className="pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-900">
                      Paragens da Rota ({selectedParagens.length} de {nearbyParagens.length})
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        setExcludedParagens(
                          selectedParagens.length === nearbyParagens.length ? nearbyParagens.map((p) => p.id) : [],
                        )
                      }
                      className="text-xs font-medium text-slate-900 hover:text-slate-700 px-3 py-1 border border-slate-300 rounded-xl hover:bg-slate-50"
                    >
                      {selectedParagens.length === nearbyParagens.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {nearbyParagens.map((paragem, i) => {
                      const selected = !excludedParagens.includes(paragem.id);
                      return (
                        <label
                          key={paragem.id}
                          className={`flex items-center space-x-3 p-3 border rounded-xl cursor-pointer transition-all ${
                            selected ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() =>
                              setExcludedParagens((prev) =>
                                prev.includes(paragem.id) ? prev.filter((id) => id !== paragem.id) : [...prev, paragem.id],
                              )
                            }
                            className="w-4 h-4 text-slate-900 border-slate-300 rounded-lg focus:ring-slate-900"
                          />
                          <span className="text-xs text-slate-500 w-5 text-right">{i + 1}</span>
                          <span>
                            <span className="block text-sm font-medium text-slate-900">{paragem.nome}</span>
                            <span className="block text-xs text-slate-600 font-mono">{paragem.codigo}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-slate-700" data-testid="route-counts">
                  <span>Pontos na rota: <strong className="text-slate-900">{drawn.points}</strong></span>
                  <span>Paragens próximas: <strong className="text-slate-900">{nearbyParagens.length}</strong></span>
                </div>
                <p className="text-xs text-slate-600">
                  * Campos obrigatórios. Clique no mapa para desenhar a rota.
                </p>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-medium disabled:opacity-50"
                >
                  {loading ? 'Criando...' : 'Criar Via'}
                </button>
              </div>
            </form>
          </div>

          {/* Mapa: fica à vista enquanto o formulário desliza */}
          <RouteDrawer
            color={formData.cor}
            stops={allParagens}
            nearIds={nearIds}
            onChange={onDrawn}
            className="lg:sticky lg:top-6 lg:self-start"
          />
        </div>
      </div>
    </div>
  );
}
