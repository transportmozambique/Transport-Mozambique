"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NovoProprietario() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string>("");
  const [formData, setFormData] = useState({
    nome: "",
    bi: "",
    nacionalidade: "Moçambicana",
    birthDate: "",
    endereco: "",
    contacto1: "",
    contacto2: "",
    foto: "",
    certificado: "",
  });

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        showNotification('Por favor, selecione uma imagem válida', 'error');
        return;
      }

      // Validar tamanho (máx 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showNotification('A imagem deve ter no máximo 5MB', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setFotoPreview(base64String);
        setFormData({...formData, foto: base64String});
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCertificadoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de arquivo
      if (file.type !== 'application/pdf') {
        showNotification('Por favor, selecione um arquivo PDF', 'error');
        return;
      }

      // Validar tamanho (máx 10MB)
      if (file.size > 10 * 1024 * 1024) {
        showNotification('O PDF deve ter no máximo 10MB', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setFormData({...formData, certificado: base64String});
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação
    if (!formData.nome.trim()) {
      showNotification('Por favor, insira o nome da empresa', 'error');
      return;
    }
    
    if (!formData.bi.trim()) {
      showNotification('Por favor, insira o BI/NUIT', 'error');
      return;
    }
    
    if (!formData.nacionalidade.trim()) {
      showNotification('Por favor, insira a nacionalidade', 'error');
      return;
    }
    
    if (!formData.birthDate) {
      showNotification('Por favor, selecione a data de nascimento/fundação', 'error');
      return;
    }
    
    if (!formData.endereco.trim()) {
      showNotification('Por favor, insira o endereço', 'error');
      return;
    }
    
    if (!formData.contacto1.trim()) {
      showNotification('Por favor, insira o contacto principal', 'error');
      return;
    }

    // Validar formato do contacto (9 dígitos)
    if (!/^\d{9}$/.test(formData.contacto1)) {
      showNotification('O contacto principal deve ter 9 dígitos', 'error');
      return;
    }

    if (formData.contacto2 && !/^\d{9}$/.test(formData.contacto2)) {
      showNotification('O contacto secundário deve ter 9 dígitos', 'error');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/proprietarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nome: formData.nome.trim(),
          bi: formData.bi.trim(),
          nacionalidade: formData.nacionalidade.trim(),
          birthDate: formData.birthDate,
          endereco: formData.endereco.trim(),
          contacto1: formData.contacto1.trim(),
          contacto2: formData.contacto2.trim() || null,
          foto: formData.foto || null,
          certificado: formData.certificado || null,
        }),
      });

      if (response.ok) {
        showNotification('Proprietário criado com sucesso!', 'success');
        setTimeout(() => {
          router.push('/proprietarios');
        }, 1500);
      } else {
        const error = await response.json();
        showNotification(error.error || 'Erro ao criar proprietário', 'error');
      }
    } catch (error) {
      console.error('Erro ao criar proprietário:', error);
      showNotification('Erro ao criar proprietário', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`rounded-lg shadow-lg p-4 min-w-[300px] ${
            notification.type === 'success' ? 'bg-green-50 border border-green-200' :
            notification.type === 'error' ? 'bg-red-50 border border-red-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-center space-x-3">
              {notification.type === 'success' && (
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {notification.type === 'info' && (
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <p className={`text-sm font-medium ${
                notification.type === 'success' ? 'text-green-800' :
                notification.type === 'error' ? 'text-red-800' :
                'text-blue-800'
              }`}>
                {notification.message}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1200px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/proprietarios')}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Novo Proprietário</h2>
            <p className="text-gray-600 mt-1">Criar um novo proprietário (empresa) no sistema</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Coluna Esquerda - Foto/Logo */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Logo da Empresa</h3>
                
                <div className="flex flex-col items-center">
                  <div className="w-40 h-40 bg-gray-100 rounded-full flex items-center justify-center mb-4 overflow-hidden">
                    {fotoPreview ? (
                      <img src={fotoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-20 h-20 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    )}
                  </div>
                  
                  <label className="w-full cursor-pointer">
                    <div className="w-full px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-lg font-medium text-center">
                      Escolher Logo
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFotoChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-gray-600 mt-2 text-center">
                    PNG, JPG ou JPEG (máx. 5MB)
                  </p>
                </div>
              </div>
            </div>

            {/* Coluna Direita - Formulário */}
            <div className="lg:col-span-3 space-y-6">
              {/* Informações da Empresa */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Informações da Empresa</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Nome da Empresa *
                    </label>
                    <input
                      type="text"
                      value={formData.nome}
                      onChange={(e) => setFormData({...formData, nome: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      placeholder="Ex: Transportes Rápidos Lda"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      NUIT *
                    </label>
                    <input
                      type="text"
                      value={formData.bi}
                      onChange={(e) => setFormData({...formData, bi: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      placeholder="Ex: 100000000006F"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Nacionalidade *
                    </label>
                    <input
                      type="text"
                      value={formData.nacionalidade}
                      onChange={(e) => setFormData({...formData, nacionalidade: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      placeholder="Ex: Moçambicana"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Data de Início de Operações *
                    </label>
                    <input
                      type="date"
                      value={formData.birthDate}
                      onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Endereço *
                    </label>
                    <textarea
                      value={formData.endereco}
                      onChange={(e) => setFormData({...formData, endereco: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      placeholder="Ex: Av. 24 de Julho, 789, Maputo"
                      rows={3}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Contactos */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Contactos</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Telefone *
                    </label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 border border-r-0 border-gray-300 bg-gray-50 text-gray-900 rounded-l-lg">
                        +258
                      </span>
                      <input
                        type="text"
                        value={formData.contacto1}
                        onChange={(e) => setFormData({...formData, contacto1: e.target.value.replace(/\D/g, '').slice(0, 9)})}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                        placeholder="840000000"
                        maxLength={9}
                        required
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">9 dígitos</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Telefone Secundário
                    </label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 border border-r-0 border-gray-300 bg-gray-50 text-gray-900 rounded-l-lg">
                        +258
                      </span>
                      <input
                        type="text"
                        value={formData.contacto2}
                        onChange={(e) => setFormData({...formData, contacto2: e.target.value.replace(/\D/g, '').slice(0, 9)})}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                        placeholder="840000000"
                        maxLength={9}
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Opcional - 9 dígitos</p>
                  </div>
                </div>
              </div>

              {/* Certificado */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Certificado de Autenticidade</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Upload do Certificado (PDF)
                    </label>
                    <div className="flex items-center space-x-4">
                      <label className="cursor-pointer flex-1">
                        <div className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                          <div className="flex items-center justify-center space-x-2">
                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm text-gray-600">
                              {formData.certificado ? 'Certificado carregado ✓' : 'Clique para escolher PDF'}
                            </span>
                          </div>
                        </div>
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={handleCertificadoChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      Arquivo PDF (máx. 10MB) - Opcional
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => router.push('/proprietarios')}
              className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-gray-900 hover:bg-black text-white rounded-lg font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Criando...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Criar Proprietário</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
