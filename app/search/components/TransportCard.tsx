"use client";

import React from "react";

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
  userJourney?: {
    from: string;
    to: string;
  };
}

interface TransportCardProps {
  transport: Transport;
  onTrack: (id: string) => void;
}

export default function TransportCard({ transport, onTrack }: TransportCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start space-x-4">
              <div className="bg-slate-100 rounded-xl p-3">
                <svg className="w-8 h-8 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">{transport.matricula}</h3>
                <p className="text-slate-600 font-medium">{transport.via}</p>
                <p className="text-sm text-slate-500">{transport.direcao}</p>
              </div>
            </div>
            <button
              onClick={() => onTrack(transport.id)}
              className="bg-slate-800 hover:bg-slate-900 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center space-x-2 whitespace-nowrap"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <span>Acompanhar</span>
            </button>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-1">
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs text-slate-600 font-medium">Tempo Estimado</span>
              </div>
              <p className="text-lg font-bold text-slate-900">{transport.tempoEstimado} min</p>
            </div>

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

            <div className="bg-slate-50 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-1">
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-xs text-slate-600 font-medium">Velocidade</span>
              </div>
              <p className="text-lg font-bold text-slate-900">{transport.velocidade} km/h</p>
            </div>

            {transport.fare && (
              <div className="bg-green-50 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  <span className="text-xs text-green-600 font-medium">Preço</span>
                </div>
                <p className="text-lg font-bold text-green-700">{transport.fare} MT</p>
              </div>
            )}
          </div>

          {/* Journey Details */}
          {(transport.journeyTime || transport.fare) && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="text-sm font-bold text-blue-900 mb-3 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Detalhes da Viagem
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="bg-white p-3 rounded-lg border border-blue-200">
                  <div className="text-blue-600 font-medium mb-1">⏱️ Autocarro chega em:</div>
                  <div className="text-lg font-bold text-blue-900">{transport.tempoEstimado} min</div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-blue-200">
                  <div className="text-blue-600 font-medium mb-1">📏 Distância autocarro:</div>
                  <div className="text-lg font-bold text-blue-900">
                    {transport.distancia > 1000
                      ? `${(transport.distancia / 1000).toFixed(1)} km`
                      : `${transport.distancia} m`}
                  </div>
                </div>

                {transport.journeyTime && (
                  <div className="bg-white p-3 rounded-lg border border-green-200">
                    <div className="text-green-600 font-medium mb-1">🚶 Tempo de viagem:</div>
                    <div className="text-lg font-bold text-green-900">{transport.journeyTime} min</div>
                  </div>
                )}

                {transport.fare && (
                  <div className="bg-white p-3 rounded-lg border border-green-200">
                    <div className="text-green-600 font-medium mb-1">💰 Preço viagem:</div>
                    <div className="text-lg font-bold text-green-900">{transport.fare} MT</div>
                  </div>
                )}
              </div>

              {transport.journeyDistance && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-blue-600 font-medium">📍 Distância da sua viagem:</span>
                    <span className="text-blue-900 font-bold">
                      {transport.journeyDistance > 1000
                        ? `${(transport.journeyDistance / 1000).toFixed(1)} km`
                        : `${transport.journeyDistance} m`}
                    </span>
                  </div>
                </div>
              )}

              {transport.userJourney && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <div className="text-center">
                    <span className="text-sm text-blue-600 font-medium">
                      🎯 Sua viagem: {transport.userJourney.from} → {transport.userJourney.to}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
