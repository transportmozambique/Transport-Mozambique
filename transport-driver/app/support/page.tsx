"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SupportPage() {
  const router = useRouter();
  const [motorista, setMotorista] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const motoristaData = localStorage.getItem("motorista");
    if (!motoristaData) {
      router.push("/");
      return;
    }

    setMotorista(JSON.parse(motoristaData));
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    setTimeout(() => {
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setMessage("");
        setCategory("");
      }, 3000);
    }, 1000);
  };

  if (!motorista) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                ← Voltar
              </Link>
              <div className="w-px h-6 bg-gray-300"></div>
              <h1 className="text-xl font-bold text-gray-900">Suporte</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Como podemos ajudar?</h2>
              <p className="text-gray-600 mb-6">
                Envie sua mensagem e nossa equipe responderá o mais breve possível.
              </p>

              {submitted ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-4xl">✅</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Mensagem Enviada!</h3>
                  <p className="text-gray-600">Entraremos em contato em breve.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Categoria *
                    </label>
                    <select
                      required
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Selecione uma categoria</option>
                      <option value="tecnico">🔧 Suporte Técnico</option>
                      <option value="pagamento">💰 Pagamentos</option>
                      <option value="conta">👤 Minha Conta</option>
                      <option value="app">📱 Problemas com o App</option>
                      <option value="sugestao">💡 Sugestão</option>
                      <option value="outro">📝 Outro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mensagem *
                    </label>
                    <textarea
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={6}
                      placeholder="Descreva sua dúvida ou problema..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Enviar Mensagem
                  </button>
                </form>
              )}
            </div>

            {/* FAQ */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Perguntas Frequentes</h3>
              <div className="space-y-4">
                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <span className="font-medium text-gray-900">Como atualizo minha localização?</span>
                    <span className="text-gray-500 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="p-4 text-sm text-gray-600">
                    A localização é atualizada automaticamente quando você está online. Certifique-se de que o GPS do seu dispositivo está ativado.
                  </div>
                </details>

                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <span className="font-medium text-gray-900">Como recebo meus pagamentos?</span>
                    <span className="text-gray-500 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="p-4 text-sm text-gray-600">
                    Os pagamentos são processados semanalmente e depositados na conta bancária registada no sistema.
                  </div>
                </details>

                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <span className="font-medium text-gray-900">O que fazer em caso de acidente?</span>
                    <span className="text-gray-500 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="p-4 text-sm text-gray-600">
                    1. Garanta a segurança de todos<br/>
                    2. Ligue para a polícia (119)<br/>
                    3. Reporte o incidente através do app<br/>
                    4. Aguarde instruções da central
                  </div>
                </details>

                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <span className="font-medium text-gray-900">Como altero minha senha?</span>
                    <span className="text-gray-500 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="p-4 text-sm text-gray-600">
                    Entre em contato com o suporte através deste formulário ou ligue para a central para solicitar a alteração de senha.
                  </div>
                </details>
              </div>
            </div>
          </div>

          {/* Contact Info Sidebar */}
          <div className="space-y-6">
            {/* Contact Cards */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contactos</h3>
              <div className="space-y-4">
                <a
                  href="tel:+258840000000"
                  className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xl text-white">📞</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Telefone</p>
                    <p className="text-sm text-gray-600">+258 84 000 0000</p>
                    <p className="text-xs text-gray-500 mt-1">Seg-Sex: 08:00-18:00</p>
                  </div>
                </a>

                <a
                  href="mailto:suporte@transportmz.com"
                  className="flex items-start gap-4 p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                >
                  <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xl text-white">✉️</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Email</p>
                    <p className="text-sm text-gray-600">suporte@transportmz.com</p>
                    <p className="text-xs text-gray-500 mt-1">Resposta em 24h</p>
                  </div>
                </a>

                <div className="flex items-start gap-4 p-4 bg-purple-50 rounded-lg">
                  <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xl text-white">💬</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">WhatsApp</p>
                    <p className="text-sm text-gray-600">+258 85 000 0000</p>
                    <p className="text-xs text-gray-500 mt-1">Disponível 24/7</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Emergency */}
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                  <span className="text-xl text-white">🚨</span>
                </div>
                <h3 className="text-lg font-bold text-red-900">Emergência</h3>
              </div>
              <p className="text-sm text-red-800 mb-4">
                Em situações de emergência, ligue imediatamente:
              </p>
              <div className="space-y-2">
                <a
                  href="tel:119"
                  className="block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-center text-sm"
                >
                  Polícia: 119
                </a>
                <a
                  href="tel:117"
                  className="block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-center text-sm"
                >
                  Ambulância: 117
                </a>
              </div>
            </div>

            {/* Hours */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Horário de Atendimento</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Segunda - Sexta</span>
                  <span className="font-medium text-gray-900">08:00 - 18:00</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Sábado</span>
                  <span className="font-medium text-gray-900">09:00 - 13:00</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Domingo</span>
                  <span className="font-medium text-red-600">Fechado</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
