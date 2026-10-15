"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import LoadingScreen from "../components/LoadingScreen";
import SearchForm from "./components/SearchForm";
import TransportCard from "./components/TransportCard";

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
}

interface Paragem {
  id: string;
  nome: string;
  codigo: string;
  geoLocation: string;
  viaIds: string[];
}

interface Transport {
  id: string;
  matricula: string;
  via: string;
  direcao: string;
  tempoEstimado: number;
  distancia: number;
  velocidade: number;
  fare?: number;
  journeyTime?: number;
  journeyDistance?: number;
  userJourney?: { from: string; to: string };
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [transports, setTransports] = useState<Transport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [utente, setUtente] = useState<{ nome: string; telefone: string } | null>(null);
  
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [vias, setVias] = useState<Via[]>([]);
  const [paragens, setParagens] = useState<Paragem[]>([]);
  
  const [selectedMunicipio, setSelectedMunicipio] = useState("");
  const [selectedVia, setSelectedVia] = useState("");
  const [selectedParagem, setSelectedParagem] = useState("");
  const [selectedDestination, setSelectedDestination] = useState("");
  
  const hasFetchedData = useRef(false);

  useEffect(() => {
    const utenteData = localStorage.getItem("utente");
    if (utenteData) setUtente(JSON.parse(utenteData));
  }, []);

  useEffect(() => {
    const municipio = searchParams.get('municipio');
    const via = searchParams.get('via');
    const paragem = searchParams.get('paragem');
    const destination = searchParams.get('destination');

    if (!municipio || !via || !paragem) {
      setShowForm(true);
      
      if (!hasFetchedData.current) {
        hasFetchedData.current = true;
        
        fetch('/api/locations', { cache: 'no-store' })
          .then((res) => res.ok ? res.json() : null)
          .then((data) => {
            if (data) {
              setMunicipios(data.municipios || []);
              setVias(data.vias || []);
              setParagens(data.paragens || []);
            }
            setLoading(false);
          })
          .catch(() => {
            setError('Erro ao carregar dados.');
            hasFetchedData.current = false;
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
      return;
    }

    setShowForm(false);
    let apiUrl = `/api/buses?paragemId=${paragem}&viaId=${via}`;
    if (destination) apiUrl += `&destinationId=${destination}`;

    fetch(apiUrl)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        setTransports(data?.buses || []);
        setLoading(false);
      })
      .catch(() => {
        setTransports([]);
        setLoading(false);
      });
  }, [searchParams]);

  const viasFiltered = React.useMemo(() => 
    vias.filter((via) => via.municipioId === selectedMunicipio),
    [vias, selectedMunicipio]
  );

  const paragensFiltered = React.useMemo(() => 
    paragens.filter((p) => p.viaIds.includes(selectedVia)),
    [paragens, selectedVia]
  );

  const destinationsFiltered = React.useMemo(() => 
    paragens.filter((p) => p.viaIds.includes(selectedVia) && p.id !== selectedParagem),
    [paragens, selectedVia, selectedParagem]
  );

  const handleSearch = () => {
    if (selectedMunicipio && selectedVia && selectedParagem) {
      let url = `/search?municipio=${selectedMunicipio}&via=${selectedVia}&paragem=${selectedParagem}`;
      if (selectedDestination) url += `&destination=${selectedDestination}`;
      router.push(url);
    }
  };

  const handleTrackTransport = (transportId: string) => {
    const paragem = searchParams.get('paragem');
    const destination = searchParams.get('destination');
    
    let url = `/track/${transportId}`;
    if (paragem) {
      url += `?paragem=${paragem}`;
      if (destination) url += `&destination=${destination}`;
    }
    router.push(url);
  };

  if (loading) return <LoadingScreen message={showForm ? "Carregando..." : "Procurando transportes"} />;

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
            <button onClick={() => window.location.reload()} className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-xl font-medium">
              Tentar Novamente
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-white">
        <div className="bg-white border-b border-slate-200 shadow-sm">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <button onClick={() => router.push("/")} className="flex items-center space-x-2 text-slate-600 hover:text-slate-800">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium text-lg">Voltar</span>
              </button>

              <svg className="w-10 h-10 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              
              {utente ? (
                <button onClick={() => router.push("/my-transports")} className="flex items-center justify-center w-10 h-10 bg-slate-800 text-white rounded-full hover:bg-slate-900 font-semibold text-sm" title={utente.nome}>
                  {(() => {
                    const names = utente.nome.trim().split(' ');
                    return (names[0]?.[0] || '') + (names[names.length - 1]?.[0] || '');
                  })().toUpperCase()}
                </button>
              ) : (
                <button onClick={() => router.push("/auth")} className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-medium">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  <span>Entrar</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <SearchForm
              municipios={municipios}
              vias={viasFiltered}
              paragens={paragensFiltered}
              destinations={destinationsFiltered}
              selectedMunicipio={selectedMunicipio}
              selectedVia={selectedVia}
              selectedParagem={selectedParagem}
              selectedDestination={selectedDestination}
              onMunicipioChange={(id) => {
                setSelectedMunicipio(id);
                setSelectedVia("");
                setSelectedParagem("");
                setSelectedDestination("");
              }}
              onViaChange={(id) => {
                setSelectedVia(id);
                setSelectedParagem("");
                setSelectedDestination("");
              }}
              onParagemChange={(id) => {
                setSelectedParagem(id);
                setSelectedDestination("");
              }}
              onDestinationChange={setSelectedDestination}
              onSearch={handleSearch}
            />

            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm text-blue-900 mb-1">
                    Selecione sua localização para ver transportes disponíveis em tempo real.
                  </p>
                  <p className="text-xs text-blue-700">
                    💡 <strong>Dica:</strong> Adicione um destino para ver preços e tempos de viagem.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <button onClick={() => router.push("/search")} className="flex items-center space-x-2 text-slate-600 hover:text-slate-800">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium text-lg">Voltar</span>
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Transportes Disponíveis</h1>
            <p className="text-slate-600">{transports.length} transporte{transports.length !== 1 ? "s" : ""} em circulação</p>
          </div>

          {transports.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
              <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Nenhum transporte disponível</h3>
              <p className="text-slate-600">Não há transportes circulando nesta via no momento.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transports.map((transport) => (
                <TransportCard key={transport.id} transport={transport} onTrack={handleTrackTransport} />
              ))}
            </div>
          )}

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
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
