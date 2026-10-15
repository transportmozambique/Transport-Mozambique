"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Transport } from "../../types";
import type { Stop } from "../../components/TransportMap";
import LoadingScreen from "../../components/LoadingScreen";
import UserAvatar from "../../components/UserAvatar";

// How often the bus position and estimates are re-read
const REFRESH_MS = 10000;

const TransportMap = dynamic(() => import("../../components/TransportMap"), {
  ssr: false,
  loading: () => (
    <div className="bg-slate-50 rounded-xl h-96 flex items-center justify-center border border-slate-200">
      <div className="text-center">
        <div className="relative mb-4">
          <div className="w-12 h-12 border-4 border-slate-200 rounded-full mx-auto"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-slate-700 rounded-full border-t-transparent animate-spin"></div>
          </div>
        </div>
        <p className="text-sm text-slate-600 font-medium">Carregando mapa...</p>
      </div>
    </div>
  ),
});

function TrackTransportContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const transportId = params.id as string;
  const paragemId = searchParams.get('paragem'); // User's origin (EMBARQUE)
  const destinoId = searchParams.get('destino'); // User's destination (DESTINO)

  const [transport, setTransport] = useState<Transport | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "loading" | "success" | "error" | "already-saved">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [paragem, setParagem] = useState<{ lat: number; lng: number; nome: string } | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Position and estimates come from the server (same numbers as the search and USSD);
  // re-read them every REFRESH_MS
  useEffect(() => {
    let cancelled = false;
    let first = true;
    const query = new URLSearchParams();
    if (paragemId) query.set('paragem', paragemId);
    if (destinoId) query.set('destino', destinoId);
    const apiUrl = `/api/bus/${transportId}${query.size ? `?${query}` : ''}`;

    const load = async () => {
      try {
        const data = await fetch(apiUrl).then((res) => res.json());
        if (cancelled) return;
        if (data.error) {
          console.error('Error fetching bus:', data.error);
          return;
        }

        setTransport({
          id: data.id,
          matricula: data.matricula,
          via: data.via,
          direcao: data.direcao,
          distancia: data.distancia,
          tempoEstimado: data.tempoEstimado,
          tempoViagem: data.tempoViagem,
          journeyDistance: data.distanciaViagem,
          jaPassou: data.jaPassou,
          velocidade: data.velocidade,
          latitude: data.latitude,
          longitude: data.longitude,
          status: data.status || 'Em Circulação',
          fare: data.fare,
        });
        setLastUpdate(new Date());

        if (first) {
          first = false;
          setRouteCoords(data.routeCoords || []);
          setStops(data.stops || []);

          // The user's stop, or the end of the route when none was chosen
          const stop = (data.stops as Stop[] | undefined)?.find((st) => st.id === paragemId) ?? data.stops?.[data.stops.length - 1];
          if (stop) setParagem({ lat: stop.latitude, lng: stop.longitude, nome: stop.nome });

          // Check if mission already exists for this user
          const utenteData = localStorage.getItem("utente");
          if (utenteData && paragemId) {
            const utente = JSON.parse(utenteData);
            fetch(`/api/user/missions?utenteId=${utente.id}`)
              .then(res => res.json())
              .then(missionsData => {
                if (!cancelled && missionsData.missions?.some((m: { paragemId: string }) => m.paragemId === paragemId)) {
                  setSaveStatus("already-saved");
                  setSaveMessage("Este transporte já está nos seus favoritos");
                }
              })
              .catch(err => console.error('Error checking existing missions:', err));
          }
        }
      } catch (error) {
        console.error('Error fetching bus:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [transportId, paragemId, destinoId]);

  const handleStopTracking = () => {
    router.push("/search");
  };

  const handleSaveToMyTransports = async () => {
    // Get utente from localStorage
    const utenteData = localStorage.getItem("utente");
    if (!utenteData) {
      setSaveStatus("error");
      setSaveMessage("Você precisa estar logado para salvar transportes");
      return;
    }

    const utente = JSON.parse(utenteData);
    
    if (!paragemId) {
      setSaveStatus("error");
      setSaveMessage("Paragem não identificada");
      return;
    }

    setSaveStatus("loading");
    setSaveMessage("");

    try {
      const response = await fetch("/api/user/missions/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          utenteId: utente.id,
          transporteId: transportId,
          paragemId: paragemId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.message.includes("já está")) {
          setSaveStatus("already-saved");
          setSaveMessage("Este transporte já está nos seus favoritos");
        } else {
          setSaveStatus("success");
          setSaveMessage("Transporte adicionado aos seus favoritos!");
        }
      } else {
        setSaveStatus("error");
        setSaveMessage(data.error || "Erro ao salvar transporte");
      }
    } catch (error) {
      console.error("Error saving transport:", error);
      setSaveStatus("error");
      setSaveMessage("Erro ao conectar com o servidor");
    }
  };

  if (loading) {
    return <LoadingScreen message="Carregando localização" />;
  }

  if (!transport) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-sm border border-slate-200 p-12 max-w-md">
          <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Transporte não encontrado</h3>
          <p className="text-slate-600 mb-6">O transporte que procura não está disponível.</p>
          <button
            onClick={() => router.push("/")}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-xl font-medium transition-colors group"
          >
            <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Voltar ao início</span>
          </button>
        </div>
      </div>
    );
  }

  // The API reports a bus past the stop as jaPassou, with the wait until its next pass
  const hasDeparted = !!transport.jaPassou;
  const hasArrived = !hasDeparted && transport.distancia < 100;
  const isArriving = !hasDeparted && !hasArrived && transport.distancia < 500;
  // Estimates are minutes from when they were read
  const chegadaDestino = lastUpdate
    ? new Date(lastUpdate.getTime() + (transport.tempoEstimado + (transport.tempoViagem ?? 0)) * 60000)
        .toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors group"
          >
            <svg className="w-6 h-6 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium text-lg">Voltar</span>
          </button>
          <UserAvatar />
        </div>

        <div className="max-w-6xl mx-auto">
          {/* Status Banner */}
          {hasDeparted ? (
            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Transporte já passou</h2>
                  <p className="text-sm text-slate-600">Volta à sua paragem na próxima volta, em cerca de {transport.tempoEstimado} min</p>
                </div>
              </div>
            </div>
          ) : hasArrived ? (
            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Transporte Chegou</h2>
                  <p className="text-sm text-slate-600">O transporte está na sua paragem</p>
                </div>
              </div>
            </div>
          ) : isArriving ? (
            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Chegando</h2>
                  <p className="text-sm text-slate-600">O transporte está próximo da sua paragem</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Em Trânsito</h2>
                  <p className="text-sm text-slate-600">Acompanhando em tempo real</p>
                </div>
              </div>
            </div>
          )}

          {/* Save to My Transports Button */}
          {saveStatus !== "success" && saveStatus !== "already-saved" && (
            <div className="mb-6">
              <button
                onClick={handleSaveToMyTransports}
                disabled={saveStatus === "loading"}
                className="w-full bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-medium py-4 px-6 rounded-xl transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                {saveStatus === "loading" ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    <span>Adicionar aos Meus Transportes</span>
                  </>
                )}
              </button>
              {saveStatus === "error" && saveMessage && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-700">{saveMessage}</p>
                </div>
              )}
            </div>
          )}

          {/* Success Message */}
          {(saveStatus === "success" || saveStatus === "already-saved") && (
            <div className="mb-6">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start space-x-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-green-900 mb-1">
                    {saveStatus === "success" ? "Salvo com Sucesso!" : "Já nos Favoritos"}
                  </h3>
                  <p className="text-sm text-green-700 mb-3">{saveMessage}</p>
                  <button
                    onClick={() => router.push("/user-info?tab=missoes")}
                    className="text-sm font-medium text-green-700 hover:text-green-800 underline"
                  >
                    Ver Meus Transportes →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Transport Info Header */}
            <div className="bg-neutral-50 border-b border-neutral-200 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-neutral-700 rounded-lg p-3">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-neutral-900 mb-0.5">
                      {transport.matricula}
                    </h3>
                    <div className="flex items-center space-x-3 text-sm text-neutral-600">
                      <span className="font-medium">{transport.via}</span>
                      <span className="text-neutral-400">•</span>
                      <span>{transport.direcao}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Metrics Grid - Enhanced with 6 metrics */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Tempo de Chegada */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Tempo de Chegada</p>
                  </div>
                  <p className="text-3xl font-bold text-slate-900">
                    {hasArrived ? "0" : transport.tempoEstimado}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">minutos</p>
                </div>

                {/* Distância até Autocarro */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Distância Autocarro</p>
                  </div>
                  <p className="text-3xl font-bold text-slate-900">
                    {transport.distancia > 1000
                      ? (transport.distancia / 1000).toFixed(1)
                      : transport.distancia}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    {transport.distancia > 1000 ? "km" : "metros"}
                  </p>
                </div>

                {/* Velocidade */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Chegada ao Destino</p>
                  </div>
                  <p className="text-3xl font-bold text-slate-900">{chegadaDestino}</p>
                  <p className="text-sm text-slate-500 mt-1">hora prevista</p>
                </div>

                {/* Preço */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                    <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Preço</p>
                  </div>
                  <p className="text-3xl font-bold text-slate-900">
                    {transport.fare ?? "-"}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">MT</p>
                </div>

                {/* Tempo de Viagem */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Tempo de Viagem</p>
                  </div>
                  <p className="text-3xl font-bold text-slate-900">
                    {transport.tempoViagem ?? "-"}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">minutos no autocarro</p>
                </div>

                {/* Distância da Viagem */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Distância Viagem</p>
                  </div>
                  <p className="text-3xl font-bold text-slate-900">
                    {transport.journeyDistance === undefined
                      ? "-"
                      : transport.journeyDistance >= 1000
                        ? (transport.journeyDistance / 1000).toFixed(1)
                        : transport.journeyDistance}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    {(transport.journeyDistance ?? 0) >= 1000 ? "km" : "metros"}
                  </p>
                </div>
              </div>

              {/* Mapa */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide">
                    Rota Completa
                  </h3>
                  <span className="text-xs text-neutral-500">
                    {transport.latitude.toFixed(4)}, {transport.longitude.toFixed(4)}
                  </span>
                </div>
                <div className="border border-neutral-200 rounded-xl overflow-hidden">
                  <TransportMap
                    transportLat={transport.latitude}
                    transportLng={transport.longitude}
                    paragemLat={paragem?.lat ?? transport.latitude}
                    paragemLng={paragem?.lng ?? transport.longitude}
                    transportMatricula={transport.matricula}
                    routeCoords={routeCoords}
                    stops={stops}
                    paragemNome={paragem?.nome ?? "Sua Paragem"}
                  />
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleStopTracking}
                className="w-full bg-neutral-800 hover:bg-neutral-900 text-white font-medium py-4 px-6 rounded-xl transition-colors duration-200"
              >
                Parar Rastreamento
              </button>
            </div>
          </div>

          {/* Footer Info */}
          <div className="mt-6 text-center">
            <p className="text-sm text-neutral-600">
              Atualização automática a cada {REFRESH_MS / 1000} segundos
              {lastUpdate && ` · última às ${lastUpdate.toLocaleTimeString('pt-PT')}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


export default function TrackTransport() {
  return (
    <Suspense fallback={<LoadingScreen message="Carregando localização" />}>
      <TrackTransportContent />
    </Suspense>
  );
}
