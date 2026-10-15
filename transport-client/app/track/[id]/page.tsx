"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Transport } from "../../types";
import LoadingScreen from "../../components/LoadingScreen";
import UserAvatar from "../../components/UserAvatar";

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

  console.log('🎯 Track Page Parameters:');
  console.log('   paragemId (EMBARQUE):', paragemId);
  console.log('   destinoId (DESTINO):', destinoId);

  const [transport, setTransport] = useState<Transport | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(true);
  const [transportStatus, setTransportStatus] = useState<"approaching" | "arrived" | "departed">("approaching");
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [stops, setStops] = useState<any[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "loading" | "success" | "error" | "already-saved">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  
  // Coordenadas da paragem (destino do utente) - will be updated from real API data
  const [paragemLat, setParagemLat] = useState(-25.8797790); // Fim do Murro (exemplo real)
  const [paragemLng, setParagemLng] = useState(32.4757846); // Fim do Murro (exemplo real)
  const [paragemNome, setParagemNome] = useState("Sua Paragem");

  // Simular atualização em tempo real
  useEffect(() => {
    // Build API URL with origem and destino
    let apiUrl = `/api/bus/${transportId}`;
    const queryParams = [];
    if (paragemId) queryParams.push(`paragem=${paragemId}`);
    if (destinoId) queryParams.push(`destino=${destinoId}`); // Use destino to match API
    if (queryParams.length > 0) {
      apiUrl += `?${queryParams.join('&')}`;
    }

    console.log('Fetching bus data from:', apiUrl);

    // Carregar dados iniciais
    console.log('🔍 Track Page - API URL:', apiUrl);
    
    fetch(apiUrl)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          console.error('Error fetching bus:', data.error);
          setLoading(false);
          return;
        }

        const mockTransport: Transport = {
          id: data.id,
          matricula: data.matricula,
          via: data.via,
          direcao: data.direcao,
          distancia: data.distancia || 1200,
          tempoEstimado: data.tempoEstimado || 5,
          velocidade: data.velocidade || 45,
          latitude: data.latitude, // Use real coordinates from API
          longitude: data.longitude, // Use real coordinates from API
          status: data.status || 'Em Circulação',
          // Add new fields if available from API
          journeyTime: data.journeyTime,
          journeyDistance: data.journeyDistance,
          totalTime: data.totalTime,
          fare: data.fare || Math.max(10, Math.ceil(((data.distancia || 1200) / 1000) * 10)), // Calculate fare if not provided
          fullRoute: data.fullRoute,
          userJourney: data.userJourney,
        };

        console.log('Transport initialized at:', data.latitude, data.longitude);
        console.log('Route coords received:', data.routeCoords?.length || 0, 'points');
        console.log('Stops received:', data.stops?.length || 0, 'stops');

        setTransport(mockTransport);
        setRouteCoords(data.routeCoords || []);
        setStops(data.stops || []);

        console.log('=== TRACKING PAGE DEBUG ===');
        console.log('Transport coordinates:', mockTransport.latitude, mockTransport.longitude);
        console.log('Route coordinates count:', data.routeCoords?.length || 0);
        console.log('Stops count:', data.stops?.length || 0);
        
        // DETAILED STOP LOGGING
        if (data.stops && data.stops.length > 0) {
          console.log('🔍 DETAILED STOPS ANALYSIS:');
          console.log('Stops with isPickup:', data.stops.filter((s: any) => s.isPickup).length);
          console.log('Stops with isDestination:', data.stops.filter((s: any) => s.isDestination).length);
          console.log('All stops:');
          data.stops.forEach((s: any, i: number) => {
            const marker = s.isPickup ? '🔴 PICKUP (EMBARQUE)' : s.isDestination ? '🔵 DESTINATION (DESTINO)' : '⚪ Regular';
            console.log(`  ${i + 1}. [${marker}] ${s.nome} (isPickup: ${s.isPickup}, isDestination: ${s.isDestination})`);
          });
          
          // Verify order
          const pickupIndex = data.stops.findIndex((s: any) => s.isPickup);
          const destinationIndex = data.stops.findIndex((s: any) => s.isDestination);
          if (pickupIndex !== -1 && destinationIndex !== -1) {
            if (pickupIndex < destinationIndex) {
              console.log('✅ CORRECT ORDER: Pickup (index', pickupIndex, ') comes BEFORE Destination (index', destinationIndex, ')');
            } else {
              console.error('❌ WRONG ORDER: Pickup (index', pickupIndex, ') comes AFTER Destination (index', destinationIndex, ')');
              console.error('   This means the bus will pass destination before pickup!');
            }
          }
        }
        
        if (data.routeCoords && data.routeCoords.length > 0) {
          console.log('First route point:', data.routeCoords[0]);
          console.log('Last route point:', data.routeCoords[data.routeCoords.length - 1]);
        }
        if (data.stops && data.stops.length > 0) {
          console.log('First stop:', data.stops[0].nome, 'at', data.stops[0].latitude, data.stops[0].longitude);
          console.log('Last stop:', data.stops[data.stops.length - 1].nome, 'at', data.stops[data.stops.length - 1].latitude, data.stops[data.stops.length - 1].longitude);
        }

        // Set paragem to the user's selected stop or last stop as fallback
        if (paragemId && data.stops && data.stops.length > 0) {
          // Find the stop that matches the user's selection
          const selectedStop = data.stops.find((stop: any) => stop.id === paragemId);
          if (selectedStop) {
            console.log('Using user selected stop:', selectedStop.nome, 'at', selectedStop.latitude, selectedStop.longitude);
            setParagemLat(selectedStop.latitude);
            setParagemLng(selectedStop.longitude);
            setParagemNome(selectedStop.nome);
          } else {
            // Fallback to last stop if selected stop not found
            console.log('Selected stop not found, using last stop');
            const lastStop = data.stops[data.stops.length - 1];
            console.log('Last stop:', lastStop.nome, 'at', lastStop.latitude, lastStop.longitude);
            setParagemLat(lastStop.latitude);
            setParagemLng(lastStop.longitude);
            setParagemNome(lastStop.nome);
          }
        } else if (data.stops && data.stops.length > 0) {
          // No paragemId provided, use last stop
          console.log('No paragem selected, using last stop');
          const lastStop = data.stops[data.stops.length - 1];
          console.log('Last stop:', lastStop.nome, 'at', lastStop.latitude, lastStop.longitude);
          setParagemLat(lastStop.latitude);
          setParagemLng(lastStop.longitude);
          setParagemNome(lastStop.nome);
        } else {
          // No stops available, keep default coordinates but log warning
          console.warn('No stops available, using default coordinates');
        }

        setLoading(false);
        
        // Check if mission already exists for this user
        const utenteData = localStorage.getItem("utente");
        if (utenteData && paragemId) {
          const utente = JSON.parse(utenteData);
          fetch(`/api/user/missions?utenteId=${utente.id}`)
            .then(res => res.json())
            .then(missionsData => {
              if (missionsData.missions) {
                const existingMission = missionsData.missions.find(
                  (m: any) => m.paragemId === paragemId
                );
                if (existingMission) {
                  setSaveStatus("already-saved");
                  setSaveMessage("Este transporte já está nos seus favoritos");
                }
              }
            })
            .catch(err => console.error('Error checking existing missions:', err));
        }
      })
      .catch((error) => {
        console.error('Error fetching bus:', error);
        setLoading(false);
      });

    // Simular atualização de posição a cada 5 segundos
    const interval = setInterval(() => {
      setTransport((prev) => {
        if (!prev) return prev;
        
        // Calcular distância até a paragem usando as coordenadas atuais
        const distanceToStop = Math.sqrt(
          Math.pow((prev.latitude - paragemLat) * 111000, 2) +
          Math.pow((prev.longitude - paragemLng) * 111000, 2)
        );

        // Simular movimento do transporte em direção à paragem
        const latDiff = paragemLat - prev.latitude;
        const lngDiff = paragemLng - prev.longitude;
        const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
        
        // Movimento incremental em direção à paragem (velocidade simulada)
        const moveSpeed = 0.0005; // Ajustar conforme necessário
        let newLat = prev.latitude;
        let newLng = prev.longitude;
        let newDistancia = Math.round(distanceToStop);
        
        if (distance > 0.0001) { // Se ainda não chegou muito perto
          newLat = prev.latitude + (latDiff / distance) * moveSpeed;
          newLng = prev.longitude + (lngDiff / distance) * moveSpeed;
          
          // Recalcular distância com as novas coordenadas
          const newDistanceToStop = Math.sqrt(
            Math.pow((newLat - paragemLat) * 111000, 2) +
            Math.pow((newLng - paragemLng) * 111000, 2)
          );
          newDistancia = Math.round(newDistanceToStop);
        }

        // Calcular tempo estimado baseado na distância real
        const velocidade = 45; // km/h
        let newTempoEstimado = Math.max(1, Math.ceil(newDistancia / 1000 / velocidade * 60));
        
        // Se muito próximo, definir valores mínimos
        if (newDistancia < 50) {
          newTempoEstimado = 1;
          newDistancia = 0;
        }

        // Atualizar status baseado na distância
        if (newDistancia < 50) {
          // Transporte chegou (menos de 50m)
          if (transportStatus !== "arrived") {
            setTransportStatus("arrived");
            // Após 10 segundos, marcar como partiu
            setTimeout(() => {
              setTransportStatus("departed");
            }, 10000);
          }
        } else if (newDistancia > 200 && transportStatus === "arrived") {
          // Transporte saiu da paragem (mais de 200m)
          setTransportStatus("departed");
        }
        
        return {
          ...prev,
          distancia: newDistancia,
          tempoEstimado: newTempoEstimado,
          latitude: newLat,
          longitude: newLng,
        };
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [transportId, paragemLat, paragemLng, transportStatus]);

  const handleStopTracking = () => {
    setIsTracking(false);
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

  const isArriving = transport.distancia < 500 && transportStatus === "approaching";
  const hasArrived = transportStatus === "arrived";
  const hasDeparted = transportStatus === "departed";

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
                  <h2 className="text-lg font-semibold text-slate-900">Transporte Partiu</h2>
                  <p className="text-sm text-slate-600">O transporte saiu da sua paragem</p>
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
                    {hasDeparted ? "-" : hasArrived ? "0" : transport.tempoEstimado}
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
                    <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Velocidade</p>
                  </div>
                  <p className="text-3xl font-bold text-slate-900">{transport.velocidade}</p>
                  <p className="text-sm text-slate-500 mt-1">km/h</p>
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
                    {transport.fare || Math.max(10, Math.ceil((transport.distancia / 1000) * 10))}
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
                    {(() => {
                      // Calculate journey time from user's paragem to final destination
                      if (!stops || stops.length === 0) return 15;
                      
                      // Find user's paragem in the route
                      const userParagemIndex = stops.findIndex(stop => stop.latitude === paragemLat && stop.longitude === paragemLng);
                      if (userParagemIndex === -1) return 15;
                      
                      // Calculate distance from user's paragem to final destination (last stop)
                      const lastStop = stops[stops.length - 1];
                      const R = 6371e3; // Earth's radius in meters
                      
                      let journeyDistance = 0;
                      // Sum distances between stops from user's paragem to final destination
                      for (let i = userParagemIndex; i < stops.length - 1; i++) {
                        const currentStop = stops[i];
                        const nextStop = stops[i + 1];
                        
                        const φ1 = (currentStop.latitude * Math.PI) / 180;
                        const φ2 = (nextStop.latitude * Math.PI) / 180;
                        const Δφ = ((nextStop.latitude - currentStop.latitude) * Math.PI) / 180;
                        const Δλ = ((nextStop.longitude - currentStop.longitude) * Math.PI) / 180;

                        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                                Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        journeyDistance += R * c;
                      }
                      
                      // Calculate journey time based on average bus speed (30 km/h in city)
                      const journeyTimeMinutes = Math.ceil(journeyDistance / 1000 / 30 * 60);
                      return Math.max(5, journeyTimeMinutes); // Minimum 5 minutes
                    })()}
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
                    {(() => {
                      // Calculate journey distance from user's paragem to final destination
                      if (!stops || stops.length === 0) return "2.5";
                      
                      // Find user's paragem in the route
                      const userParagemIndex = stops.findIndex(stop => stop.latitude === paragemLat && stop.longitude === paragemLng);
                      if (userParagemIndex === -1) return "2.5";
                      
                      const R = 6371e3; // Earth's radius in meters
                      let journeyDistance = 0;
                      
                      // Sum distances between stops from user's paragem to final destination
                      for (let i = userParagemIndex; i < stops.length - 1; i++) {
                        const currentStop = stops[i];
                        const nextStop = stops[i + 1];
                        
                        const φ1 = (currentStop.latitude * Math.PI) / 180;
                        const φ2 = (nextStop.latitude * Math.PI) / 180;
                        const Δφ = ((nextStop.latitude - currentStop.latitude) * Math.PI) / 180;
                        const Δλ = ((nextStop.longitude - currentStop.longitude) * Math.PI) / 180;

                        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                                Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        journeyDistance += R * c;
                      }
                      
                      // Convert to km if > 1000m, otherwise show in meters
                      if (journeyDistance > 1000) {
                        return (journeyDistance / 1000).toFixed(1);
                      } else {
                        return Math.round(journeyDistance).toString();
                      }
                    })()}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    {(() => {
                      if (!stops || stops.length === 0) return "km";
                      
                      const userParagemIndex = stops.findIndex(stop => stop.latitude === paragemLat && stop.longitude === paragemLng);
                      if (userParagemIndex === -1) return "km";
                      
                      const R = 6371e3;
                      let journeyDistance = 0;
                      
                      for (let i = userParagemIndex; i < stops.length - 1; i++) {
                        const currentStop = stops[i];
                        const nextStop = stops[i + 1];
                        
                        const φ1 = (currentStop.latitude * Math.PI) / 180;
                        const φ2 = (nextStop.latitude * Math.PI) / 180;
                        const Δφ = ((nextStop.latitude - currentStop.latitude) * Math.PI) / 180;
                        const Δλ = ((nextStop.longitude - currentStop.longitude) * Math.PI) / 180;

                        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                                Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        journeyDistance += R * c;
                      }
                      
                      return journeyDistance > 1000 ? "km" : "metros";
                    })()}
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
                    paragemLat={paragemLat}
                    paragemLng={paragemLng}
                    transportMatricula={transport.matricula}
                    routeCoords={routeCoords}
                    stops={stops}
                    paragemNome={paragemNome}
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
              Atualização automática a cada 5 segundos
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
