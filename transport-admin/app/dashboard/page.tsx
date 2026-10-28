"use client";
import LoadingScreen from "../components/LoadingScreen";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { RouteStop } from '@/lib/routeOrder';

interface Stats {
  transportes: number;
  proprietarios: number;
  vias: number;
  paragens: number;
  motoristas: number;
  motoristasActivos: number;
  transportesSemMotorista: number;
  provincias: number;
  municipios: number;
}

interface MunicipioData {
  name: string;
  count: number;
  percentage: number;
}

interface MunicipioSimpleData {
  name: string;
  count: number;
}

interface ViaData {
  id: string;
  name: string;
  count: number;
  color: string;
  path: string;
  start: string;
  end: string;
  stops?: RouteStop[];
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stats, setStats] = useState<Stats>({
    transportes: 0,
    proprietarios: 0,
    vias: 0,
    paragens: 0,
    motoristas: 0,
    motoristasActivos: 0,
    transportesSemMotorista: 0,
    provincias: 0,
    municipios: 0,
  });
  const [municipioData, setMunicipioData] = useState<MunicipioData[]>([]);
  const [viasData, setViasData] = useState<ViaData[]>([]);
  const [viasMunicipioData, setViasMunicipioData] = useState<MunicipioSimpleData[]>([]);
  const [paragensMunicipioData, setParagensMunicipioData] = useState<MunicipioSimpleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVia, setSelectedVia] = useState<string | null>(null);
  const { admin } = useAuth();
  // O que os veículos estão a fazer agora (GPS ou horário), da mesma fonte da lista de veículos
  const [agora, setAgora] = useState<{ circulacao: number; parados: number; gps: number; semPosicao: number } | null>(null);
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const routesProcessed = useRef<Set<string>>(new Set());

  // Validar e corrigir códigos de cor
  const getValidColor = (color: string | undefined): string => {
    const defaultColor = '#3B82F6';
    if (!color || typeof color !== 'string' || !color.startsWith('#')) {
      return defaultColor;
    }
    
    const hexPart = color.substring(1);
    // Só caracteres hexadecimais válidos?
    if (!/^[0-9A-Fa-f]+$/.test(hexPart)) {
      return defaultColor;
    }
    
    if (hexPart.length === 6) {
      return color;
    } else if (hexPart.length < 6) {
      // Completar com zeros
      return '#' + hexPart.padEnd(6, '0');
    } else {
      // Cortar a 6 caracteres
      return '#' + hexPart.substring(0, 6);
    }
  };

  const fetchStats = async () => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      setRefreshing(true);
      setError(null);
      
      // Tempo limite para o pedido
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 10000); // limite de 10 segundos
      
      const response = await fetch('/api/dashboard/stats', {
        signal: controller.signal
      });
      
      if (timeoutId) clearTimeout(timeoutId);
      
      if (!response.ok) {
        // Códigos de erro HTTP específicos
        if (response.status === 500) {
          setError('Erro no servidor. Por favor, verifique se o servidor está a funcionar correctamente.');
        } else if (response.status === 503) {
          setError('Serviço temporariamente indisponível. Por favor, tente novamente mais tarde.');
        } else if (response.status === 404) {
          setError('Endpoint não encontrado. Por favor, verifique a configuração do servidor.');
        } else {
          setError(`Erro HTTP: ${response.status}. Por favor, tente novamente.`);
        }
        return;
      }
      
      const data = await response.json();
      
      // A resposta traz um erro?
      if (data.error) {
        console.error('Erro da API:', data.error);
        setError('Erro ao carregar dados: ' + data.error);
        return;
      }
      
      // As estatísticas existem e são válidas?
      if (data.stats && typeof data.stats === 'object') {
        setStats(data.stats);
        setMunicipioData(data.municipioData || []);
        setViasData(data.viasData || []);
        setViasMunicipioData(data.viasMunicipioData || []);
        setParagensMunicipioData(data.paragensMunicipioData || []);
        setLastUpdated(new Date());
      } else {
        console.error('Resposta da API inválida:', data);
        setError('Resposta inválida da API. Por favor, tente novamente.');
      }
    } catch (error: any) {
      console.error('Erro ao carregar estatísticas:', error);
      
      // Os vários tipos de erro
      if (error.name === 'AbortError') {
        setError('Tempo de espera excedido. Verifique a sua conexão à internet e tente novamente.');
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        setError('Sem conexão à internet. Por favor, verifique a sua conexão e tente novamente.');
      } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
        setError('Erro de rede. Verifique se o servidor está a correr e se tem conexão à internet.');
      } else if (error.message.includes('JSON')) {
        setError('Erro ao processar resposta do servidor. Por favor, tente novamente.');
      } else {
        setError('Erro inesperado. Por favor, tente novamente ou contacte o suporte.');
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    return () => {
      setLoading(false);
      setRefreshing(false);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/transportes/estado')
        .then((r) => (r.ok ? r.json() : null))
        .then((d: Record<string, { estado: string; gps: boolean }> | null) => {
          if (!alive || !d) return;
          const all = Object.values(d);
          setAgora({
            circulacao: all.filter((v) => v.estado === 'circulacao').length,
            parados: all.filter((v) => v.estado === 'terminal' || v.estado === 'fora-de-servico').length,
            gps: all.filter((v) => v.gps).length,
            semPosicao: all.filter((v) => v.estado === 'sem-posicao').length,
          });
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  // Parâmetro via na query
  useEffect(() => {
    const viaId = searchParams.get('via');
    if (viaId && viasData.length > 0) {
      // A via existe nos dados?
      const viaExists = viasData.some(v => v.id === viaId);
      if (viaExists) {
        setSelectedVia(viaId);
      }
    }
  }, [searchParams, viasData]);

  // Criar o mapa
  useEffect(() => {
    if (!mapContainer.current || map.current || viasData.length === 0) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/positron',
      attributionControl: { compact: true },
      center: [32.5892, -25.9655], // Centro de Maputo
      zoom: 11,
      pitch: 45, // mapa inclinado para ver os edifícios em 3D
      bearing: 0
    });

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    map.current.on('load', () => {
      // Edifícios em 3D
      const layers = map.current!.getStyle().layers;
      let firstSymbolId: string | undefined;
      for (const layer of layers) {
        if (layer.type === 'symbol') {
          firstSymbolId = layer.id;
          break;
        }
      }

      // Juntar a fonte dos edifícios se ainda não existir
      if (!map.current!.getSource('openmaptiles')) {
        map.current!.addSource('openmaptiles', {
          'type': 'vector',
          'url': 'https://tiles.openfreemap.org/planet'
        });
      }

      // Camada dos edifícios em 3D
      map.current!.addLayer(
        {
          'id': '3d-buildings',
          'source': 'openmaptiles',
          'source-layer': 'building',
          'type': 'fill-extrusion',
          'minzoom': 15,
          'paint': {
            'fill-extrusion-color': '#d1d5db',
            'fill-extrusion-height': [
              'case',
              ['has', 'render_height'],
              ['get', 'render_height'],
              5
            ],
            'fill-extrusion-base': [
              'case',
              ['has', 'render_min_height'],
              ['get', 'render_min_height'],
              0
            ],
            'fill-extrusion-opacity': 0.8
          }
        },
        firstSymbolId
      );

      // Desenhar cada via a partir do percurso guardado ("lng,lat;lng,lat;..."), que já segue as estradas
      viasData.forEach((via) => {
        if (!via.path || !map.current || routesProcessed.current.has(via.id)) return;

        try {
          const coordinates = via.path.split(';').map(coord => {
            const [lng, lat] = coord.split(',').map(Number);
            return [lng, lat];
          });

          if (coordinates.length < 2) return;

          addRouteToMap(via.id, coordinates, via.color);
          routesProcessed.current.add(via.id);
        } catch (error) {
          console.error(`Erro ao tratar a via ${via.name}:`, error);
        }
      });

      // As paragens de cada via, depois de todas as linhas, para ficarem por cima delas
      viasData.forEach((via) => addStopsToMap(via.id, via.stops ?? []));
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [viasData]);

  const addRouteToMap = (viaId: string, coordinates: any[], color: string) => {
    if (!map.current) return;

    try {
      const validColor = getValidColor(color);
      console.log(`Via ${viaId}: cor original="${color}", cor válida="${validColor}"`);

      // Fonte de dados do mapa
      if (!map.current.getSource(`route-${viaId}`)) {
        map.current.addSource(`route-${viaId}`, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: coordinates
            }
          }
        });
      }

      // Camada do mapa
      if (!map.current.getLayer(`route-${viaId}`)) {
        map.current.addLayer({
          id: `route-${viaId}`,
          type: 'line',
          source: `route-${viaId}`,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': validColor,
            'line-width': 4,
            'line-opacity': 0.7
          }
        });
      }
    } catch (error) {
      console.error(`Erro ao juntar a via ${viaId} ao mapa:`, error);
    }
  };

  // As paragens de uma via: um círculo por paragem (preto nos terminais), o nome ao clicar
  const addStopsToMap = (viaId: string, stops: RouteStop[]) => {
    const m = map.current;
    if (!m || stops.length === 0 || m.getSource(`stops-${viaId}`)) return;
    m.addSource(`stops-${viaId}`, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: stops.map((s) => ({
          type: 'Feature',
          properties: { nome: s.nome, terminal: s.isTerminal },
          geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] },
        })),
      },
    });
    m.addLayer({
      id: `stops-${viaId}`,
      type: 'circle',
      source: `stops-${viaId}`,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, ['case', ['get', 'terminal'], 4, 2.5], 15, ['case', ['get', 'terminal'], 8, 6]],
        'circle-color': ['case', ['get', 'terminal'], '#1e293b', '#ffffff'],
        'circle-stroke-color': '#1e293b',
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 15, 2],
      },
    });
    m.on('click', `stops-${viaId}`, (e) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== 'Point') return;
      const box = document.createElement('div');
      box.style.color = '#000';
      const nome = document.createElement('strong');
      nome.textContent = String(f.properties?.nome ?? '');
      box.appendChild(nome);
      if (f.properties?.terminal) box.append(document.createElement('br'), 'Terminal');
      new maplibregl.Popup({ offset: 8 })
        .setLngLat(f.geometry.coordinates as [number, number])
        .setDOMContent(box)
        .addTo(m);
    });
    m.on('mouseenter', `stops-${viaId}`, () => { m.getCanvas().style.cursor = 'pointer'; });
    m.on('mouseleave', `stops-${viaId}`, () => { m.getCanvas().style.cursor = ''; });
  };

  // Escolha de uma via
  useEffect(() => {
    if (!map.current) return;

    // As paragens acompanham a via: só as da via escolhida, ou as de todas
    viasData.forEach((via) => {
      if (map.current?.getLayer(`stops-${via.id}`)) {
        map.current.setLayoutProperty(`stops-${via.id}`, 'visibility', !selectedVia || via.id === selectedVia ? 'visible' : 'none');
      }
    });

    if (selectedVia) {
      // Esconder todas as vias menos a escolhida
      viasData.forEach((via) => {
        if (map.current?.getLayer(`route-${via.id}`)) {
          if (via.id === selectedVia) {
            // Mostrar e realçar a via escolhida
            map.current.setLayoutProperty(`route-${via.id}`, 'visibility', 'visible');
            map.current.setPaintProperty(`route-${via.id}`, 'line-width', 6);
            map.current.setPaintProperty(`route-${via.id}`, 'line-opacity', 1);
          } else {
            // Esconder as outras vias
            map.current.setLayoutProperty(`route-${via.id}`, 'visibility', 'none');
          }
        }
      });

      // Aproximar à via escolhida
      const via = viasData.find(v => v.id === selectedVia);
      if (via && via.path) {
        const coordinates = via.path.split(';').map(coord => {
          const [lng, lat] = coord.split(',').map(Number);
          return [lng, lat] as [number, number];
        });

        if (coordinates.length > 0) {
          const bounds = coordinates.reduce((bounds, coord) => {
            return bounds.extend(coord);
          }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));

          map.current.fitBounds(bounds, { 
            padding: 50,
            pitch: 45, // manter a inclinação ao aproximar
            bearing: 0
          });
        }
      }
    } else {
      // Mostrar todas as vias com o estilo normal
      viasData.forEach((via) => {
        if (map.current?.getLayer(`route-${via.id}`)) {
          map.current.setLayoutProperty(`route-${via.id}`, 'visibility', 'visible');
          map.current.setPaintProperty(`route-${via.id}`, 'line-width', 4);
          map.current.setPaintProperty(`route-${via.id}`, 'line-opacity', 0.7);
        }
      });
    }
  }, [selectedVia, viasData]);

  if (loading) {
    return <LoadingScreen layout="admin" />;
  }

  // Estado de erro
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Erro de Conexão</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={fetchStats}
            className="px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  const motoristasPercentage = stats.transportes > 0
    ? Math.round((stats.motoristasActivos / stats.transportes) * 100)
    : 0;
  const viasComVeiculos = viasData.filter((v) => v.count > 0).length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = admin?.nome.trim().split(/\s+/)[0];
  const maxVia = Math.max(...viasData.map((v) => v.count), 1);

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:py-8">
        {/* Saudação e acções rápidas */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">
              {greeting}
              {firstName ? `, ${firstName}` : ''}
            </p>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Visão geral da rede</h1>
            {lastUpdated && (
              <p className="mt-1 text-xs text-slate-500">
                Actualizado às {lastUpdated.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} · os números podem demorar até 5 min a mudar
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => router.push('/transportes/novo')} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              + Transporte
            </button>
            <button onClick={() => router.push('/vias/novo')} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100">
              + Via
            </button>
            <button onClick={() => router.push('/motoristas/novo')} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100">
              + Motorista
            </button>
            <button
              onClick={fetchStats}
              disabled={refreshing}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
            >
              {refreshing ? 'A actualizar…' : 'Actualizar'}
            </button>
          </div>
        </div>

        {stats.transportesSemMotorista > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-white px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white" aria-hidden>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
                </svg>
              </span>
              <div>
                <p className="font-semibold text-slate-900">
                  {stats.transportesSemMotorista} {stats.transportesSemMotorista === 1 ? 'transporte está' : 'transportes estão'} sem motorista
                </p>
                <p className="text-sm text-slate-800">Cada transporte precisa de um motorista atribuído para operar.</p>
              </div>
            </div>
            <button onClick={() => router.push('/motoristas/atribuir')} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Atribuir motoristas
            </button>
          </div>
        )}

        {/* Counters */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Kpi
            label="Transportes"
            value={stats.transportes}
            note={stats.transportesSemMotorista > 0 ? `${stats.transportesSemMotorista} sem motorista` : 'todos com motorista'}
            icon={ICONS.bus}
            onClick={() => router.push('/transportes')}
          />
          <Kpi
            label="Motoristas"
            value={stats.motoristas}
            note={`${stats.motoristasActivos} activos (${motoristasPercentage}%)`}
            icon={ICONS.driver}
            onClick={() => router.push('/motoristas')}
          />
          <Kpi label="Vias activas" value={stats.vias} note={`${viasComVeiculos} com veículos`} icon={ICONS.route} onClick={() => router.push('/vias')} />
          <Kpi label="Paragens" value={stats.paragens} note="pontos de paragem" icon={ICONS.stop} onClick={() => router.push('/paragens')} />
        </div>

        {/* O mapa, o que os veículos estão a fazer agora, e as vias */}
        <div className="grid gap-4 xl:grid-cols-3">
          <Card
            className="xl:col-span-2"
            title="Mapa de vias"
            subtitle={selectedVia ? viasData.find((v) => v.id === selectedVia)?.name : 'Toque numa via da lista para a ver sozinha'}
            action={
              selectedVia ? (
                <button onClick={() => setSelectedVia(null)} className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                  Mostrar todas
                </button>
              ) : null
            }
          >
            <div ref={mapContainer} className="min-h-[420px] w-full flex-1 overflow-hidden rounded-2xl bg-slate-100 lg:min-h-[520px]" />
          </Card>

          <div className="flex min-w-0 flex-col gap-4">
            <Card title="Agora" subtitle="O que cada veículo está a fazer (GPS, ou a viagem do motorista)">
              {agora ? (
                <div className="grid grid-cols-2 gap-2">
                  <MiniStat value={agora.circulacao} label="Em circulação" />
                  <MiniStat value={agora.parados} label="Parados" />
                  <MiniStat value={agora.gps} label="Com GPS activo" />
                  <MiniStat value={agora.semPosicao} label="Sem rota" />
                </div>
              ) : (
                <p className="text-sm text-slate-500">A carregar…</p>
              )}
            </Card>

            <Card title="Vias" subtitle={`${viasData.length} vias, as com mais veículos primeiro`} className="min-h-0 flex-1">
              <ul className="-mx-2 max-h-[300px] overflow-y-auto">
                {viasData.map((via) => (
                  <li key={via.id}>
                    <button
                      onClick={() => setSelectedVia(selectedVia === via.id ? null : via.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-slate-50 ${selectedVia === via.id ? 'bg-slate-100' : ''}`}
                    >
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: getValidColor(via.color) }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{via.name}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {via.start} → {via.end}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{via.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>

        {/* Como a rede está distribuída */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card title="Vias por município">
            <BarList items={viasMunicipioData.map((m) => ({ label: m.name, value: m.count }))} total={stats.vias} />
          </Card>
          <Card title="Paragens por município">
            <BarList items={paragensMunicipioData.map((m) => ({ label: m.name, value: m.count }))} total={stats.paragens} />
          </Card>
          <Card title="Vias com mais veículos">
            <BarList items={viasData.slice(0, 5).map((v) => ({ label: v.name, value: v.count }))} total={maxVia} />
          </Card>
          <Card title="Estado">
            <dl className="space-y-3 text-sm">
              <Split label="Transportes com motorista" a={stats.transportes - stats.transportesSemMotorista} b={stats.transportesSemMotorista} bLabel="sem" />
              <Split label="Motoristas activos" a={stats.motoristasActivos} b={stats.motoristas - stats.motoristasActivos} bLabel="disponíveis" />
              <Split label="Vias com veículos" a={viasComVeiculos} b={stats.vias - viasComVeiculos} bLabel="sem" />
            </dl>
          </Card>
        </div>

        {/* O resto do registo */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <LinkStat label="Proprietários" note="Empresas registadas" value={stats.proprietarios} onClick={() => router.push('/proprietarios')} />
          <LinkStat label="Províncias" note="Regiões administrativas" value={stats.provincias} onClick={() => router.push('/provincias')} />
          <LinkStat label="Municípios" note="Distritos urbanos" value={stats.municipios} onClick={() => router.push('/municipios')} />
        </div>
      </div>
    </div>
  );
}

const ICONS = {
  bus: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  driver: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  route: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
  stop: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z',
};


function Kpi({ label, value, note, icon, onClick }: { label: string; value: number; note: string; icon: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
      <div className="flex items-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-900" aria-hidden>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
        </span>
      </div>
      <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
      <p className="text-3xl font-bold tabular-nums text-slate-900 sm:text-4xl">{value.toLocaleString('pt-PT')}</p>
      <p className="mt-1 truncate text-xs text-slate-500">{note}</p>
    </button>
  );
}

function Card({ title, subtitle, action, className = '', children }: { title: string; subtitle?: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={`flex min-w-0 flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MiniStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-slate-100 px-3 py-3 text-slate-900">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs font-medium opacity-80">{label}</p>
    </div>
  );
}

/** Barras horizontais, cada uma como parte de `total` */
function BarList({ items, total }: { items: { label: string; value: number }[]; total: number }) {
  if (!items.length) return <p className="text-sm text-slate-500">Sem dados.</p>;
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={`${item.label}-${i}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-slate-700">{item.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-900">{item.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.min(100, (item.value / Math.max(total, 1)) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** `a` em `a + b`, como uma barra */
function Split({ label, a, b, bLabel }: { label: string; a: number; b: number; bLabel: string }) {
  const total = Math.max(a + b, 1);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <dt className="text-slate-700">{label}</dt>
        <dd className="shrink-0 text-xs text-slate-500">
          <span className="font-semibold text-slate-900">{a}</span> · {b} {bLabel}
        </dd>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-slate-900" style={{ width: `${(a / total) * 100}%` }} />
      </div>
    </div>
  );
}

function LinkStat({ label, note, value, onClick }: { label: string; note: string; value: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center justify-between rounded-3xl bg-slate-900 px-5 py-4 text-left text-white transition hover:bg-slate-800">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-slate-400">{note}</span>
      </span>
      <span className="text-3xl font-bold tabular-nums">{value}</span>
    </button>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<LoadingScreen layout="admin" />}>
      <DashboardContent />
    </Suspense>
  );
}
