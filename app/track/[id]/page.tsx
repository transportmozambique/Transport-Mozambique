"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Transport } from "../../types";
import LoadingScreen from "../../components/LoadingScreen";

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
  const paragemId = searchParams.get('paragem');
  const destinationId = searchParams.get('destination');
  
  // Debug logging
  console.log('🔍 Track Page URL Params:', {
    transportId,
    paragemId,
    destinationId,
    allParams: Object.fromEntries(searchParams.entries())
  });

  const [transport, setTransport] = useState<Transport | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(true);
  const [transportStatus, setTransportStatus] = useState<"approaching" | "arrived" | "departed">("approaching");
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [stops, setStops] = useState<any[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "loading" | "success" | "error" | "already-saved">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  
  // Coordenadas da paragem (destino do utente) - will be updated from data
  const [paragemLat, setParagemLat] = useState(-25.9592);
  const [paragemLng, setParagemLng] = useState(32.5832);
  const [paragemNome, setParagemNome] = useState("Sua Paragem");
  
  // Destination coordinates
  const [destinationLat, setDestinationLat] = useState<number | null>(null);
  const [destinationLng, setDestinationLng] = useState<number | null>(null);
  const [destinationNome, setDestinationNome] = useState<string | null>(null);

  // Simular atualização em tempo real
  useEffect(() => {
    // Carregar dados iniciais
    let apiUrl = `/api/bus/${transportId}`;
    if (paragemId) {
      apiUrl += `?paragem=${paragemId}`;
      if (destinationId) {
        apiUrl += `&destination=${destinationId}`;
      }
    }
    
    console.log('🔍 Track Page - Calling API:', apiUrl);
    console.log('🔍 Track Page - Parameters:', { paragemId, destinationId });
    
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
          distancia: 1200,
          tempoEstimado: 5,
          velocidade: data.velocidade,
          latitude: data.latitude,
          longitude: data.longitude,
          status: data.status,
          // Add new fields if available
          journeyTime: data.journeyTime || 3,
          journeyDistance: data.journeyDistance || 2000,
          totalTime: data.totalTime || 8,
          fare: data.fare || 15,
          fullRoute: data.fullRoute,
          userJourney: data.userJourney,
        };

        setTransport(mockTransport);
        setRouteCoords(data.routeCoords);
        setStops(data.stops);
        
        console.log('🔍 Track Page - Received stops from API:', data.stops?.length || 0);
        console.log('🔍 Track Page - Stops with isPickup:', data.stops?.filter((s: any) => s.isPickup).length || 0);
        console.log('🔍 Track Page - Stops with isDestination:', data.stops?.filter((s: any) => s.isDestination).length || 0);
        if (data.stops && data.stops.length > 0) {
          console.log('🔍 Track Page - Sample stops:', data.stops.slice(0, 3).map((s: any) => ({
            nome: s.nome,
            isPickup: s.isPickup,
            isDestination: s.isDestination
          })));
        }

        // Set paragem to the user's selected stop or last stop as fallback
        if (paragemId && data.stops && data.stops.length > 0) {
          // Find the stop that matches the user's selection
          const selectedStop = data.stops.find((stop: any) => stop.id === paragemId);
          if (selectedStop) {
            console.log('Using user selected stop:', selectedStop.nome);
            setParagemLat(selectedStop.latitude);
            setParagemLng(selectedStop.longitude);
            setParagemNome(selectedStop.nome);
          } else {
            // Fallback to last stop if selected stop not found
            console.log('Selected stop not found, using last stop');
            const lastStop = data.stops[data.stops.length - 1];
            setParagemLat(lastStop.latitude);
            setParagemLng(lastStop.longitude);
            setParagemNome(lastStop.nome);
          }
        } else if (data.stops && data.stops.length > 0) {
          // No paragemId provided, use last stop
          console.log('No paragem selected, using last stop');
          const lastStop = data.stops[data.stops.length - 1];
          setParagemLat(lastStop.latitude);
          setParagemLng(lastStop.longitude);
          setParagemNome(lastStop.nome);
        }

        // Set destination if provided
        if (destinationId && data.stops && data.stops.length > 0) {
          const destStop = data.stops.find((stop: any) => stop.id === destinationId);
          if (destStop) {
            console.log('Using user selected destination:', destStop.nome);
            setDestinationLat(destStop.latitude);
            setDestinationLng(destStop.longitude);
            setDestinationNome(destStop.nome);
          }
        }

        setLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching bus:', error);
        setLoading(false);
      });

    // Simular atualização de posição a cada 5 segundos
    const interval = setInterval(() => {
      setTransport((prev) => {
        if (!prev) return prev;
        
        // Simular movimento do transporte
        const newDistancia = Math.max(0, prev.distancia - 100);
        const newTempoEstimado = Math.max(0, Math.ceil(newDistancia / 240));
        
        // Calcular distância até a paragem
        const distanceToStop = Math.sqrt(
          Math.pow((prev.latitude - paragemLat) * 111000, 2) +
          Math.pow((prev.longitude - paragemLng) * 111000, 2)
        );

        // Atualizar status baseado na distância
        if (distanceToStop < 50) {
          // Transporte chegou (menos de 50m)
          if (transportStatus !== "arrived") {
            setTransportStatus("arrived");
            // Após 10 segundos, marcar como partiu
            setTimeout(() => {
              setTransportStatus("departed");
            }, 10000);
          }
        } else if (distanceToStop > 200 && transportStatus === "arrived") {
          // Transporte saiu da paragem (mais de 200m)
          setTransportStatus("departed");
        }
        
        return {
          ...prev,
          distancia: newDistancia,
          tempoEstimado: newTempoEstimado,
          latitude: prev.latitude + 0.001,
          longitude: prev.longitude + 0.001,
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
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors group"
          >
            <svg className="w-6 h-6 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium text-lg">Voltar</span>
          </button>
        </div>

        <div className="max-w-6xl mx-auto">
          {/* Status Banner */}
          {hasDeparted ? (
            <div className="bg-neutral-100 border border-neutral-300 rounded-xl p-4 mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-neutral-500 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">Transporte Partiu</h2>
                  <p className="text-sm text-neutral-600">O transporte saiu da sua paragem</p>
                </div>
              </div>
            </div>
          ) : hasArrived ? (
            <div className="bg-neutral-100 border border-neutral-300 rounded-xl p-4 mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-neutral-700 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">Transporte Chegou</h2>
                  <p className="text-sm text-neutral-600">O transporte está na sua paragem</p>
                </div>
              </div>
            </div>
          ) : isArriving ? (
            <div className="bg-white border border-neutral-300 rounded-xl p-4 mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-neutral-900 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">Chegando</h2>
                  <p className="text-sm text-neutral-600">O transporte está próximo da sua paragem</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-neutral-300 rounded-xl p-4 mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-neutral-900 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">Em Trânsito</h2>
                  <p className="text-sm text-neutral-600">Acompanhando em tempo real</p>
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
                    onClick={() => router.push("/my-transports")}
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
              {/* Metrics Grid - Updated with all information */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Tempo Estimado */}
                <div className="bg-neutral-50 rounded-xl p-5 border border-neutral-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Tempo Estimado</p>
                  </div>
                  <p className="text-3xl font-bold text-neutral-900">
                    {hasDeparted ? "-" : hasArrived ? "0" : transport.tempoEstimado}
                  </p>
                  <p className="text-sm text-neutral-500 mt-1">minutos</p>
                </div>

                {/* Distância */}
                <div className="bg-neutral-50 rounded-xl p-5 border border-neutral-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Distância</p>
                  </div>
                  <p className="text-3xl font-bold text-neutral-900">
                    {transport.distancia > 1000
                      ? (transport.distancia / 1000).toFixed(1)
                      : transport.distancia}
                  </p>
                  <p className="text-sm text-neutral-500 mt-1">
                    {transport.distancia > 1000 ? "km" : "metros"}
                  </p>
                </div>

                {/* Velocidade */}
                <div className="bg-neutral-50 rounded-xl p-5 border border-neutral-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Velocidade</p>
                  </div>
                  <p className="text-3xl font-bold text-neutral-900">{transport.velocidade}</p>
                  <p className="text-sm text-neutral-500 mt-1">km/h</p>
                </div>

                {/* Preço da viagem */}
                {transport.fare && (
                  <div className="bg-green-50 rounded-xl p-5 border border-green-200">
                    <div className="flex items-center space-x-2 mb-3">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                      <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Preço</p>
                    </div>
                    <p className="text-3xl font-bold text-green-700">{transport.fare}</p>
                    <p className="text-sm text-green-600 mt-1">MT</p>
                  </div>
                )}
              </div>

              {/* Additional Journey Information - Always show */}
              <div className="mb-6 p-5 bg-blue-50 rounded-xl border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-900 mb-4 flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Informações Detalhadas da Viagem
                </h4>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Tempo até o autocarro chegar */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-700 mb-1">
                      {hasDeparted ? "-" : hasArrived ? "0" : transport.tempoEstimado}
                    </div>
                    <div className="text-xs text-blue-600 font-medium">
                      ⏱️ Tempo até o autocarro
                    </div>
                    <div className="text-xs text-blue-500">minutos</div>
                  </div>

                  {/* Tempo até ao destino - only if destination selected */}
                  {transport.journeyTime && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-700 mb-1">
                        {transport.journeyTime}
                      </div>
                      <div className="text-xs text-blue-600 font-medium">
                        🚶 Tempo de viagem
                      </div>
                      <div className="text-xs text-blue-500">minutos</div>
                    </div>
                  )}

                  {/* Distância do autocarro */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-700 mb-1">
                      {transport.distancia > 1000
                        ? `${(transport.distancia / 1000).toFixed(1)}`
                        : transport.distancia}
                    </div>
                    <div className="text-xs text-blue-600 font-medium">
                      📏 Distância autocarro
                    </div>
                    <div className="text-xs text-blue-500">
                      {transport.distancia > 1000 ? "km" : "metros"}
                    </div>
                  </div>

                  {/* Tempo total - only if destination selected */}
                  {transport.totalTime && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-700 mb-1">
                        {transport.totalTime}
                      </div>
                      <div className="text-xs text-blue-600 font-medium">
                        ⏰ Tempo total
                      </div>
                      <div className="text-xs text-blue-500">minutos</div>
                    </div>
                  )}

                  {/* Preço - only if destination selected */}
                  {transport.fare && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-700 mb-1">
                        {transport.fare}
                      </div>
                      <div className="text-xs text-blue-600 font-medium">
                        💰 Preço viagem
                      </div>
                      <div className="text-xs text-blue-500">MT</div>
                    </div>
                  )}
                </div>

                {/* Journey distance if available */}
                {transport.journeyDistance && (
                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-blue-600 font-medium">
                        📍 Distância da sua viagem:
                      </span>
                      <span className="text-sm text-blue-900 font-bold">
                        {transport.journeyDistance > 1000
                          ? `${(transport.journeyDistance / 1000).toFixed(1)} km`
                          : `${transport.journeyDistance} m`}
                      </span>
                    </div>
                  </div>
                )}

                {/* User journey info if available */}
                {transport.userJourney && (
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <div className="text-center">
                      <span className="text-sm text-blue-600 font-medium">
                        🎯 Sua viagem: {transport.userJourney.from} → {transport.userJourney.to}
                      </span>
                    </div>
                  </div>
                )}

                {/* Hint if no destination selected */}
                {!transport.journeyTime && (
                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <div className="text-center">
                      <span className="text-xs text-blue-600">
                        💡 Para ver preço e tempo de viagem, selecione um destino na pesquisa
                      </span>
                    </div>
                  </div>
                )}
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
                    destinationLat={destinationLat || undefined}
                    destinationLng={destinationLng || undefined}
                    destinationNome={destinationNome || undefined}
                    userJourney={transport.userJourney}
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
