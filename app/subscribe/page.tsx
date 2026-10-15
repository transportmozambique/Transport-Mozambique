"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SubscribePage() {
  const router = useRouter();
  const [step, setStep] = useState<"initial" | "confirm" | "phone" | "success">("initial");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userExists, setUserExists] = useState(false);

  const handleInitialSubscribe = () => {
    setStep("confirm");
  };

  const handleConfirmSubscription = () => {
    setStep("phone");
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!acceptTerms) {
      alert("Por favor, aceite os termos e condições para continuar.");
      return;
    }

    setIsLoading(true);

    // Simular verificação no sistema
    setTimeout(() => {
      // Simular verificação se o número já existe
      const existingUser = phoneNumber === "+258 84 000 0000";
      
      if (existingUser) {
        setUserExists(true);
      }
      
      setIsLoading(false);
      setStep("success");
    }, 2000);
  };

  const handleGoToSearch = () => {
    router.push("/search");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xl font-bold">T</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">TransportMZ</h1>
                <p className="text-xs text-gray-500">Sistema de Transportes</p>
              </div>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Initial Step */}
        {step === "initial" && (
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 border border-gray-100">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">📱</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                Subscrever ao Serviço
              </h1>
              <p className="text-gray-600 text-lg">
                Tenha acesso a informações em tempo real sobre transportes públicos
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg">
                <span className="text-2xl">✅</span>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Localização em Tempo Real</h3>
                  <p className="text-sm text-gray-600">Saiba onde está o seu transporte a qualquer momento</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg">
                <span className="text-2xl">⏱️</span>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Tempo de Chegada</h3>
                  <p className="text-sm text-gray-600">Estimativa precisa de quando o transporte chegará</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg">
                <span className="text-2xl">📍</span>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Rotas e Paragens</h3>
                  <p className="text-sm text-gray-600">Informação completa sobre todas as rotas disponíveis</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg">
                <span className="text-2xl">💬</span>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Notificações SMS</h3>
                  <p className="text-sm text-gray-600">Receba atualizações diretamente no seu telemóvel</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleInitialSubscribe}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
            >
              Subscrever Agora
            </button>

            <p className="text-center text-sm text-gray-500 mt-6">
              Já tem subscrição?{" "}
              <Link href="/search" className="text-blue-600 hover:underline font-medium">
                Pesquisar Transportes
              </Link>
            </p>
          </div>
        )}

        {/* Confirmation Step */}
        {step === "confirm" && (
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 border border-gray-100">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">⚠️</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                Confirmar Subscrição
              </h1>
              <p className="text-gray-600 text-lg">
                Tem certeza que deseja subscrever ao serviço?
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 mb-8">
              <h3 className="font-semibold text-gray-900 mb-4">O que vai acontecer:</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold">1.</span>
                  <span className="text-gray-700">Será criado um identificador único para si no sistema</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold">2.</span>
                  <span className="text-gray-700">O seu número de telefone será registado</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold">3.</span>
                  <span className="text-gray-700">Receberá um SMS com os termos e condições</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold">4.</span>
                  <span className="text-gray-700">Poderá começar a usar o serviço imediatamente</span>
                </li>
              </ul>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep("initial")}
                className="flex-1 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold text-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSubscription}
                className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors shadow-lg"
              >
                Confirmar
              </button>
            </div>
          </div>
        )}

        {/* Phone Number Step */}
        {step === "phone" && (
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 border border-gray-100">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">📞</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                Número de Telefone
              </h1>
              <p className="text-gray-600 text-lg">
                Insira o seu número para completar a subscrição
              </p>
            </div>

            <form onSubmit={handlePhoneSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Telefone *
                </label>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+258 84 123 4567"
                  className="w-full px-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Este número será usado para enviar notificações SMS
                </p>
              </div>

              <div className="bg-blue-50 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-3">📋 Termos e Condições</h3>
                <div className="text-sm text-gray-700 space-y-2 max-h-48 overflow-y-auto">
                  <p>1. O serviço fornece informações em tempo real sobre transportes públicos.</p>
                  <p>2. As estimativas de tempo são aproximadas e podem variar.</p>
                  <p>3. O utilizador é responsável pelos custos de SMS do seu operador.</p>
                  <p>4. Os dados pessoais serão protegidos conforme a lei de proteção de dados.</p>
                  <p>5. O serviço pode ser descontinuado a qualquer momento mediante aviso prévio.</p>
                  <p>6. O utilizador pode cancelar a subscrição a qualquer momento.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="terms"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="terms" className="text-sm text-gray-700">
                  Li e aceito os termos e condições do serviço
                </label>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep("confirm")}
                  className="flex-1 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold text-lg hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2 group"
                  disabled={isLoading}
                >
                  <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Voltar</span>
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !acceptTerms}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Processando..." : "Subscrever"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Success Step */}
        {step === "success" && (
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 border border-gray-100">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                <span className="text-4xl">✅</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                {userExists ? "Bem-vindo de Volta!" : "Subscrição Confirmada!"}
              </h1>
              <p className="text-gray-600 text-lg">
                {userExists 
                  ? "A sua subscrição já existe no sistema"
                  : "A sua subscrição foi realizada com sucesso"
                }
              </p>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-6 mb-8">
              <div className="flex items-start gap-4 mb-4">
                <span className="text-2xl">📱</span>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">SMS Enviado</h3>
                  <p className="text-sm text-gray-700">
                    Foi enviado um SMS para <strong>{phoneNumber}</strong> com:
                  </p>
                  <ul className="text-sm text-gray-700 mt-2 space-y-1 ml-4">
                    <li>• Confirmação da subscrição</li>
                    <li>• Termos e condições completos</li>
                    <li>• Instruções de uso do serviço</li>
                  </ul>
                </div>
              </div>

              {!userExists && (
                <div className="flex items-start gap-4 pt-4 border-t border-gray-200">
                  <span className="text-2xl">🆔</span>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Identificador Único</h3>
                    <p className="text-sm text-gray-700">
                      Foi criado um identificador único para si no sistema
                    </p>
                    <div className="mt-2 inline-block bg-white px-4 py-2 rounded-lg border border-gray-200">
                      <code className="text-blue-600 font-mono font-semibold">
                        USER-{Math.random().toString(36).substring(2, 10).toUpperCase()}
                      </code>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <button
                onClick={handleGoToSearch}
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
              >
                Pesquisar Transportes
              </button>

              <Link
                href="/"
                className="flex items-center justify-center space-x-2 w-full py-4 text-center border-2 border-gray-300 text-gray-700 rounded-xl font-semibold text-lg hover:bg-gray-50 transition-colors group"
              >
                <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Voltar ao Início</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
