"use client";

import React from "react";

interface Municipio {
  id: string;
  nome: string;
}

interface Via {
  id: string;
  nome: string;
}

interface Paragem {
  id: string;
  nome: string;
}

interface SearchFormProps {
  municipios: Municipio[];
  vias: Via[];
  paragens: Paragem[];
  destinations: Paragem[];
  selectedMunicipio: string;
  selectedVia: string;
  selectedParagem: string;
  selectedDestination: string;
  onMunicipioChange: (id: string) => void;
  onViaChange: (id: string) => void;
  onParagemChange: (id: string) => void;
  onDestinationChange: (id: string) => void;
  onSearch: () => void;
}

export default function SearchForm({
  municipios,
  vias,
  paragens,
  destinations,
  selectedMunicipio,
  selectedVia,
  selectedParagem,
  selectedDestination,
  onMunicipioChange,
  onViaChange,
  onParagemChange,
  onDestinationChange,
  onSearch,
}: SearchFormProps) {
  const isStepComplete = (step: number) => {
    switch (step) {
      case 1: return !!selectedMunicipio;
      case 2: return !!selectedVia;
      case 3: return !!selectedParagem;
      case 4: return !!selectedDestination;
      default: return false;
    }
  };

  return (
    <>
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((step, index) => (
            <div key={step} className="flex items-center" style={{ flex: index < 3 ? '1 1 0%' : '0 0 auto' }}>
              <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-200 ${
                isStepComplete(step) 
                  ? 'bg-slate-700 border-slate-700 text-white shadow-md' 
                  : step === 4 && !selectedVia
                  ? 'bg-slate-100 border-slate-200 text-slate-300'
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
        
        <div className="flex justify-between mt-3 text-xs text-slate-600">
          <span>Município</span>
          <span>Via</span>
          <span>Origem</span>
          <span className={selectedVia ? 'text-slate-600' : 'text-slate-300'}>Destino (opcional)</span>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-8">
        <h2 className="text-xl font-bold text-slate-900 mb-6">Pesquisar Transporte</h2>

        <div className="flex flex-col gap-5">
          {/* Município */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Município</label>
            <select
              value={selectedMunicipio}
              onChange={(e) => onMunicipioChange(e.target.value)}
              className="w-full px-4 py-3.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 text-slate-900 bg-white"
            >
              <option value="">Selecione o município</option>
              {municipios.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>

          {/* Via */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Via / Rota</label>
            <select
              value={selectedVia}
              onChange={(e) => onViaChange(e.target.value)}
              disabled={!selectedMunicipio}
              className="w-full px-4 py-3.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 text-slate-900 bg-white disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">Selecione a via</option>
              {vias.map((via) => (
                <option key={via.id} value={via.id}>
                  {via.nome.length > 35 ? via.nome.substring(0, 35) + '...' : via.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Paragem */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Sua Paragem (Origem)</label>
            <select
              value={selectedParagem}
              onChange={(e) => onParagemChange(e.target.value)}
              disabled={!selectedVia}
              className="w-full px-4 py-3.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 text-slate-900 bg-white disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">Selecione sua paragem</option>
              {paragens.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome.length > 35 ? p.nome.substring(0, 35) + '...' : p.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Destination */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Seu Destino <span className="text-xs text-slate-500 font-normal">(opcional)</span>
            </label>
            <select
              value={selectedDestination}
              onChange={(e) => onDestinationChange(e.target.value)}
              disabled={!selectedParagem}
              className="w-full px-4 py-3.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 text-slate-900 bg-white disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">Selecione o destino (opcional)</option>
              {destinations.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome.length > 35 ? p.nome.substring(0, 35) + '...' : p.nome}
                </option>
              ))}
            </select>
            {selectedParagem && !selectedDestination && (
              <p className="text-xs text-slate-500 mt-2">
                💡 Selecione um destino para ver preços e tempos de viagem detalhados
              </p>
            )}
          </div>

          <button
            onClick={onSearch}
            disabled={!selectedMunicipio || !selectedVia || !selectedParagem}
            className="w-full bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white font-semibold py-4 px-6 rounded-xl transition-all flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Pesquisar Transportes</span>
          </button>
        </div>
      </div>
    </>
  );
}
