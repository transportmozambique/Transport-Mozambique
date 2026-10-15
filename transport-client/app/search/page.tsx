"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Transport } from "../types";
import LoadingScreen from "../components/LoadingScreen";
import UserAvatar from "../components/UserAvatar";

interface Municipio {
  id: string;
  nome: string;
  codigo: string;
}

interface Via {
  id: string;
  nome: string;
  codigo: string;
  municipioId: string;
  terminalPartida: string;
  terminalChegada: string;
}

interface Paragem {
  id: string;
  nome: string;
  codigo: string;
  geoLocation: string;
  viaIds: string[];
  orderByVia?: Record<string, number>; // Order index for each via
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [transports, setTransports] = useState<Transport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [selectedMunicipio, setSelectedMunicipio] = useState("");
  const [selectedVia, setSelectedVia] = useState("");
  const [selectedParagem, setSelectedParagem] = useState(""); // Origem
  const [selectedDestino, setSelectedDestino] = useState(""); // Destino
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [vias, setVias] = useState<Via[]>([]);
  const [paragens, setParagens] = useState<Paragem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [utente, setUtente] = useState<{ nome: string; telefone: string } | null>(null);
  const [loadingVias, setLoadingVias] = useState(false);
  const [loadingParagens, setLoadingParagens] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Check if user is logged in
  useEffect(() => {
    const utenteData = localStorage.getItem("utente");
    if (utenteData) {
      setUtente(JSON.parse(utenteData));
    }
  }, []);

  useEffect(() => {
    const municipio = searchParams.get('municipio');
    const via = searchParams.get('via');
    const paragem = searchParams.get('paragem');
    const destino = searchParams.get('destino');

    // If no search params, show the search form
    if (!municipio || !via || !paragem || !destino) {
      setShowForm(true);
      
      // Only fetch initial data once
      if (!initialLoadDone) {
        // Fetch ONLY municipios with available buses
        fetch('/api/available-routes')
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
          })
          .then((data) => {
            setMunicipios(data.municipios || []);
            // Don't set vias or paragens here - they'll be loaded when municipio is selected
            setLoading(false);
            setInitialLoadDone(true);
          })
          .catch((error) => {
            console.error('Error fetching locations:', error);
            setError('Erro ao carregar dados. Por favor, tente novamente.');
            setMunicipios([]);
            setLoading(false);
            setInitialLoadDone(true);
          });
      } else {
        setLoading(false);
      }
      return;
    }

    setShowForm(false);
    setLoading(true); // Set loading to true when starting search
    
    // Fetch vias for the municipio to get all vias in the same route
    fetch(`/api/available-routes?municipioId=${municipio}`)
      .then((res) => res.json())
      .then((viasData) => {
        const fetchedVias = viasData.vias || [];
        
        // Get all via IDs for the selected route
        const viasForMunicipio = fetchedVias.filter((v: Via) => v.municipioId === municipio);
        const uniqueRoutes = viasForMunicipio.reduce((acc: Record<string, { viaIds: string[] }>, v: Via) => {
          const routeKey = `${v.terminalPartida} → ${v.terminalChegada}`;
          if (!acc[routeKey]) {
            acc[routeKey] = { viaIds: [] };
          }
          acc[routeKey].viaIds.push(v.id);
          return acc;
        }, {} as Record<string, { viaIds: string[] }>);
        
        const routeValues = Object.values(uniqueRoutes) as Array<{ viaIds: string[] }>;
        const selectedRoute = routeValues.find((route) => route.viaIds.includes(via));
        const viaIdsParam = selectedRoute ? selectedRoute.viaIds.join(',') : via;
        
        const apiUrl = `/api/buses?paragemId=${paragem}&destinoId=${destino}&viaIds=${viaIdsParam}`;

        // Fetch buses from API
        return fetch(apiUrl);
      })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.error) {
          console.error('API returned error:', data.error);
          setTransports([]);
        } else if (data.buses) {
          setTransports(data.buses);
        } else {
          setTransports([]);
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching buses:', error);
        setTransports([]);
        setLoading(false);
      });
  }, [searchParams, initialLoadDone]);

  const handleSearch = () => {
    if (selectedMunicipio && selectedVia && selectedParagem && selectedDestino) {
      router.push(
        `/search?municipio=${selectedMunicipio}&via=${selectedVia}&paragem=${selectedParagem}&destino=${selectedDestino}`
      );
    }
  };

  const handleTrackTransport = (transportId: string) => {
    const paragem = searchParams.get('paragem'); // origem
    const destino = searchParams.get('destino'); // destino
    
    const queryParams = [];
    if (paragem) queryParams.push(`paragem=${paragem}`);
    if (destino) queryParams.push(`destino=${destino}`);
    
    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
    
    router.push(`/track/${transportId}${queryString}`);
  };

  // Load vias when municipio changes
  const handleMunicipioChange = (municipioId: string) => {
    setSelectedMunicipio(municipioId);
    setSelectedVia("");
    setSelectedParagem("");
    setSelectedDestino("");
    setVias([]); // Clear vias immediately
    setParagens([]); // Clear paragens immediately
    
    if (municipioId) {
      setLoadingVias(true);
      // Fetch vias for this municipio that have buses
      fetch(`/api/available-routes?municipioId=${municipioId}`)
        .then((res) => res.json())
        .then((data) => {
          setVias(data.vias || []);
          setLoadingVias(false);
        })
        .catch((error) => {
          console.error('Error fetching vias:', error);
          setVias([]);
          setLoadingVias(false);
        });
    } else {
      setLoadingVias(false);
    }
  };

  // Load paragens when via changes
  const handleViaChange = (viaId: string) => {
    setSelectedVia(viaId);
    setSelectedParagem("");
    setSelectedDestino("");
    setParagens([]); // Clear paragens immediately
    
    if (viaId) {
      setLoadingParagens(true);
      // Fetch paragens for this via that have buses
      fetch(`/api/available-routes?municipioId=${selectedMunicipio}&viaId=${viaId}`)
        .then((res) => res.json())
        .then((data) => {
          setParagens(data.paragens || []);
          setLoadingParagens(false);
        })
        .catch((error) => {
          console.error('Error fetching paragens:', error);
          setParagens([]);
          setLoadingParagens(false);
        });
    } else {
      setLoadingParagens(false);
    }
  };

  // Group vias by unique routes (terminalPartida → terminalChegada)
  // No need to filter by municipioId - API already returns filtered vias
  const uniqueRoutes = (vias || []).reduce((acc, via) => {
    const routeKey = `${via.terminalPartida} → ${via.terminalChegada}`;
    if (!acc[routeKey]) {
      acc[routeKey] = {
        displayName: routeKey,
        viaIds: [],
        firstVia: via
      };
    }
    acc[routeKey].viaIds.push(via.id);
    return acc;
  }, {} as Record<string, { displayName: string; viaIds: string[]; firstVia: Via }>);
  
  const routeOptions = Object.values(uniqueRoutes);
  
  // Get all paragens from all vias in the selected route
  const selectedRouteData = routeOptions.find(route => 
    selectedVia && route.viaIds.includes(selectedVia)
  );
  
  const paragensFiltered = selectedRouteData
    ? paragens?.filter((paragem) => 
        selectedRouteData.viaIds.some(viaId => paragem.viaIds.includes(viaId))
      ) || []
    : [];

  const isStepComplete = (step: number) => {
    switch (step) {
      case 1: return !!selectedMunicipio;
      case 2: return !!selectedVia;
      case 3: return !!selectedParagem;
      case 4: return !!selectedDestino;
      default: return false;
    }
  };

  if (loading) {
    return <LoadingScreen message={showForm ? "Carregando..." : "Procurando transportes"} />;
  }

  // Show search form
  if (showForm) {
    if (error) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center bg-white rounded-2xl shadow-sm border border-red-200 p-12 max-w-md mx-4">
            <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Erro ao Carregar</h3>
            <p className="text-slate-600 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-xl font-medium transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 shadow-sm">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => router.push("/")}
                className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors group"
              >
                <svg className="w-6 h-6 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium text-lg">Voltar</span>
              </button>

              <div className="flex items-center space-x-3">
                <svg className="w-10 h-10 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              
              {/* User Avatar or Auth Button */}
              {utente ? (
                <UserAvatar />
              ) : (
                <button
                  onClick={() => router.push("/auth")}
                  className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium shadow-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  <span>Entrar</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 overflow-x-hidden">
          <div className="max-w-3xl mx-auto">
            {/* Progress Steps */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                {[1, 2, 3, 4].map((step, index) => (
                  <div key={step} className="flex items-center" style={{ flex: index < 3 ? '1 1 0%' : '0 0 auto' }}>
                    <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-200 ${
                      isStepComplete(step) 
                        ? 'bg-slate-700 border-slate-700 text-white shadow-md' 
                        : 'bg-white border-slate-300 text-slate-400'
                    }`}>
                      {isStepComplete(step) ? (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <span className="text-base font-bold leading-none">{step}</span>
                      )}
                    </div>
                    {index < 3 && (
                      <div className={`flex-1 h-1 rounded-full transition-all duration-200 ${
                        isStepComplete(step) ? 'bg-slate-700' : 'bg-slate-300'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Form Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-8 overflow-hidden">
              <h2 className="text-xl font-bold text-slate-900 mb-6">
                Pesquisar Transporte
              </h2>

              <style jsx global>{`
                body {
                  overflow-x: hidden;
                }
                select {
                  max-width: 100% !important;
                  box-sizing: border-box !important;
                }
                select option {
                  max-width: 100% !important;
                  overflow: hidden !important;
                  text-overflow: ellipsis !important;
                  white-space: nowrap !important;
                  padding: 8px 12px !important;
                  box-sizing: border-box !important;
                }
              `}</style>

              <div className="flex flex-col gap-5">
                {/* Município */}
                <div className="flex-1 min-w-0">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Município
                  </label>
                  <div className="relative">
                    <select
                      value={selectedMunicipio}
                      onChange={(e) => handleMunicipioChange(e.target.value)}
                      className="w-full px-4 py-3.5 pr-10 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent text-slate-900 bg-white transition-all appearance-none cursor-pointer hover:border-slate-400"
                      style={{ maxWidth: '100%' }}
                    >
                      <option value="">Selecione o município</option>
                      {municipios.map((municipio) => (
                        <option key={municipio.id} value={municipio.id}>
                          {municipio.nome}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Via */}
                <div className="flex-1 min-w-0">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Rota (Direção)
                  </label>
                  <div className="relative">
                    <select
                      key={`via-select-${selectedMunicipio}-${vias.length}`}
                      value={selectedVia}
                      onChange={(e) => handleViaChange(e.target.value)}
                      disabled={!selectedMunicipio || loadingVias}
                      className="w-full px-4 py-3.5 pr-10 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent text-slate-900 bg-white disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed transition-all appearance-none cursor-pointer hover:border-slate-400 disabled:hover:border-slate-300"
                      style={{ maxWidth: '100%' }}
                    >
                      <option value="">
                        {loadingVias ? 'Carregando rotas...' : 'Selecione a rota'}
                      </option>
                      {!loadingVias && routeOptions.map((route) => {
                        // Use first via ID as the value (will search all vias in this route)
                        const routeValue = route.viaIds[0];
                        // Truncate long route names for mobile
                        const maxLength = 40;
                        const displayName = route.displayName.length > maxLength 
                          ? route.displayName.substring(0, maxLength) + '...'
                          : route.displayName;
                        return (
                          <option key={routeValue} value={routeValue}>
                            {displayName}
                          </option>
                        );
                      })}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      {loadingVias ? (
                        <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  {!loadingVias && selectedMunicipio && routeOptions.length > 0 && (
                    <p className="text-xs text-green-600 mt-1">
                      {routeOptions.length} rota{routeOptions.length !== 1 ? 's' : ''} disponível{routeOptions.length !== 1 ? 'eis' : ''}
                    </p>
                  )}

                </div>

                {/* Paragem Origem */}
                <div className="flex-1 min-w-0">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Sua Paragem (Origem)
                  </label>
                  <div className="relative">
                    <select
                      value={selectedParagem}
                      onChange={(e) => setSelectedParagem(e.target.value)}
                      disabled={!selectedVia || loadingParagens}
                      className="w-full px-4 py-3.5 pr-10 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent text-slate-900 bg-white disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed transition-all appearance-none cursor-pointer hover:border-slate-400 disabled:hover:border-slate-300"
                      style={{ maxWidth: '100%' }}
                    >
                      <option value="">
                        {loadingParagens ? 'Carregando paragens...' : 'Onde você está?'}
                      </option>
                      {!loadingParagens && paragensFiltered.map((paragem) => {
                        // Truncate long stop names for mobile
                        const maxLength = 35;
                        const displayName = paragem.nome.length > maxLength 
                          ? paragem.nome.substring(0, maxLength) + '...'
                          : paragem.nome;
                        return (
                          <option key={paragem.id} value={paragem.id}>
                            {displayName}
                          </option>
                        );
                      })}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      {loadingParagens ? (
                        <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  {!loadingParagens && selectedVia && paragensFiltered.length > 0 && (
                    <p className="text-xs text-green-600 mt-1">
                      {paragensFiltered.length} paragen{paragensFiltered.length !== 1 ? 's' : 's'} disponível{paragensFiltered.length !== 1 ? 'eis' : ''}
                    </p>
                  )}
                </div>

                {/* Paragem Destino */}
                <div className="flex-1 min-w-0">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Destino
                  </label>
                  <div className="relative">
                    <select
                      value={selectedDestino}
                      onChange={(e) => setSelectedDestino(e.target.value)}
                      disabled={!selectedVia || !selectedParagem || loadingParagens}
                      className="w-full px-4 py-3.5 pr-10 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent text-slate-900 bg-white disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed transition-all appearance-none cursor-pointer hover:border-slate-400 disabled:hover:border-slate-300"
                      style={{ maxWidth: '100%' }}
                    >
                      <option value="">
                        {loadingParagens ? 'Carregando destinos...' : 'Para onde você vai?'}
                      </option>
                      {!loadingParagens && paragensFiltered
                        .filter(p => {
                          // Don't show origem as destino
                          if (p.id === selectedParagem) return false;
                          
                          // Filter to show only stops that come AFTER origem in the route
                          if (selectedParagem && p.orderByVia && selectedVia) {
                            const origemParagem = paragensFiltered.find(pg => pg.id === selectedParagem);
                            if (origemParagem && origemParagem.orderByVia) {
                              // Get order for the selected via
                              const origemOrder = origemParagem.orderByVia[selectedVia];
                              const destinoOrder = p.orderByVia[selectedVia];
                              
                              // Only show if destino comes AFTER origem
                              if (origemOrder !== undefined && destinoOrder !== undefined) {
                                return destinoOrder > origemOrder;
                              }
                            }
                          }
                          
                          // If no order info, don't show (prevents wrong direction)
                          return false;
                        })
                        .map((paragem) => {
                          // Truncate long stop names for mobile
                          const maxLength = 35;
                          const displayName = paragem.nome.length > maxLength 
                            ? paragem.nome.substring(0, maxLength) + '...'
                            : paragem.nome;
                          return (
                            <option key={paragem.id} value={paragem.id}>
                              {displayName}
                            </option>
                          );
                        })}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      {loadingParagens ? (
                        <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  {!loadingParagens && selectedParagem && (() => {
                    const availableDestinos = paragensFiltered.filter(p => {
                      if (p.id === selectedParagem) return false;
                      if (selectedParagem && p.orderByVia && selectedVia) {
                        const origemParagem = paragensFiltered.find(pg => pg.id === selectedParagem);
                        if (origemParagem && origemParagem.orderByVia) {
                          const origemOrder = origemParagem.orderByVia[selectedVia];
                          const destinoOrder = p.orderByVia[selectedVia];
                          if (origemOrder !== undefined && destinoOrder !== undefined) {
                            return destinoOrder > origemOrder;
                          }
                        }
                      }
                      // If no order info, don't show (prevents wrong direction)
                      return false;
                    });
                    return availableDestinos.length > 0 && (
                      <p className="text-xs text-green-600 mt-1">
                        {availableDestinos.length} destino{availableDestinos.length !== 1 ? 's' : ''} disponível{availableDestinos.length !== 1 ? 'eis' : ''}
                      </p>
                    );
                  })()}
                </div>

                <button
                  onClick={handleSearch}
                  disabled={!selectedMunicipio || !selectedVia || !selectedParagem || !selectedDestino}
                  className="w-full bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 shadow-md hover:shadow-lg disabled:shadow-none"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Pesquisar Transportes</span>
                </button>
              </div>
            </div>

            {/* Info Card */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-blue-900">
                  Selecione sua localização (origem) e destino para ver transportes disponíveis em tempo real.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show search results
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <button
            onClick={() => router.push("/search")}
            className="flex items-center space-x-2 text-slate-600 hover:text-slate-800 transition-colors group"
          >
            <svg className="w-6 h-6 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium text-lg">Voltar</span>
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Results Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Transportes Disponíveis
            </h1>
            <p className="text-slate-600">
              {transports.length} transporte{transports.length !== 1 ? "s" : ""} em circulação
            </p>
          </div>

          {transports.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
              <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Nenhum transporte disponível
              </h3>
              <p className="text-slate-600">
                Não há transportes circulando nesta via no momento.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {transports.map((transport) => (
                <div
                  key={transport.id}
                  className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
                >
                  {/* Header with Transport Info and Action Button */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    {/* Transport Info */}
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="bg-slate-100 rounded-xl p-3">
                        <svg className="w-8 h-8 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 mb-1">
                          {transport.matricula}
                        </h3>
                        <p className="text-slate-600 font-medium">{transport.via}</p>
                        <p className="text-sm text-slate-500">{transport.direcao}</p>
                      </div>
                    </div>

                    {/* Action Button - Top Right */}
                    <button
                      onClick={() => handleTrackTransport(transport.id)}
                      className="bg-slate-800 hover:bg-slate-900 text-white font-semibold py-3 px-5 rounded-xl transition-colors duration-200 flex items-center space-x-2 whitespace-nowrap flex-shrink-0"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      <span>Acompanhar</span>
                    </button>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Existing: Tempo Estimado */}
                        <div className="bg-slate-50 rounded-lg p-3">
                          <div className="flex items-center space-x-2 mb-1">
                            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs text-slate-600 font-medium">Tempo Estimado</span>
                          </div>
                          <p className="text-lg font-bold text-slate-900">
                            {transport.tempoEstimado} min
                          </p>
                        </div>

                        {/* Existing: Distância */}
                        <div className="bg-slate-50 rounded-lg p-3">
                          <div className="flex items-center space-x-2 mb-1">
                            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            <span className="text-xs text-slate-600 font-medium">Distância</span>
                          </div>
                          <p className="text-lg font-bold text-slate-900">
                            {transport.distancia > 1000
                              ? `${(transport.distancia / 1000).toFixed(1)} km`
                              : `${transport.distancia} m`}
                          </p>
                        </div>

                        {/* Existing: Velocidade */}
                        <div className="bg-slate-50 rounded-lg p-3">
                          <div className="flex items-center space-x-2 mb-1">
                            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span className="text-xs text-slate-600 font-medium">Velocidade</span>
                          </div>
                          <p className="text-lg font-bold text-slate-900">
                            {transport.velocidade} km/h
                          </p>
                        </div>

                        {/* New: Preço da viagem - Same gray background */}
                        <div className="bg-slate-50 rounded-lg p-3">
                          <div className="flex items-center space-x-2 mb-1">
                            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                            <span className="text-xs text-slate-600 font-medium">Preço</span>
                          </div>
                          <p className="text-lg font-bold text-slate-900">
                            {transport.fare || 10} MT
                          </p>
                        </div>
                      </div>
                </div>
              ))}
            </div>
          )}

          {/* Info Footer */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-blue-900">
                Clique em "Acompanhar" para ver a localização do transporte no mapa em tempo real.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SearchContent />
    </Suspense>
  );
}

