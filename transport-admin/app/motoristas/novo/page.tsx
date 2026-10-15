"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NovoMotorista() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string>("");
  const [showTransportModal, setShowTransportModal] = useState(false);
  const [transportes, setTransportes] = useState<any[]>([]);
  const [loadingTransportes, setLoadingTransportes] = useState(false);
  const [searchTransporte, setSearchTransporte] = useState("");
  const [selectedTransporte, setSelectedTransporte] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    nome: "",
    bi: "",
    cartaConducao: "",
    telefone: "",
    email: "",
    dataNascimento: "",
    endereco: "",
    foto: "",
    nacionalidade: "Moçambicana",
    genero: "Masculino",
    estadoCivil: "Solteiro",
    numeroEmergencia: "",
    contatoEmergencia: "",
    deficiencia: "",
    dataEmissaoBI: "",
    dataValidadeBI: "",
    dataEmissaoCarta: "",
    dataValidadeCarta: "",
    categoriaCarta: "D",
    experienciaAnos: "0",
    password: "",
    observacoes: "",
    status: "ativo"
  });

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  async function fetchTransportes() {
    setLoadingTransportes(true);
    try {
      const response = await fetch('/api/transportes?availableOnly=true&limit=1000');
      const data = await response.json();
      
      setTransportes(data.data || []);
    } catch (error) {
      console.error('Erro ao carregar transportes:', error);
      showNotification('Erro ao carregar transportes', 'error');
    } finally {
      setLoadingTransportes(false);
    }
  }

  const handleOpenTransportModal = () => {
    setShowTransportModal(true);
    fetchTransportes();
  };

  const handleSelectTransporte = (transporte: any) => {
    setSelectedTransporte(transporte);
    setShowTransportModal(false);
    showNotification(`Transporte ${transporte.matricula} selecionado`, 'success');
  };

  const handleRemoveTransporte = () => {
    setSelectedTransporte(null);
    showNotification('Transporte removido', 'info');
  };

  const filteredTransportes = transportes.filter(t => 
    t.matricula?.toLowerCase().includes(searchTransporte.toLowerCase()) ||
    t.modelo?.toLowerCase().includes(searchTransporte.toLowerCase()) ||
    t.marca?.toLowerCase().includes(searchTransporte.toLowerCase())
  );

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showNotification('Por favor, selecione uma imagem válida', 'error');
        return;
      }

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validações
    if (!formData.nome.trim()) {
      showNotification('Por favor, insira o nome completo', 'error');
      return;
    }

    if (!formData.bi.trim()) {
      showNotification('Por favor, insira o BI', 'error');
      return;
    }

    if (!formData.cartaConducao.trim()) {
      showNotification('Por favor, insira o número da carta de condução', 'error');
      return;
    }

    if (!formData.telefone.trim() || !/^\d{9}$/.test(formData.telefone)) {
      showNotification('O telefone deve ter 9 dígitos', 'error');
      return;
    }

    if (!formData.numeroEmergencia.trim() || !/^\d{9}$/.test(formData.numeroEmergencia)) {
      showNotification('O telefone de emergência deve ter 9 dígitos', 'error');
      return;
    }

    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      showNotification('Por favor, insira um email válido', 'error');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/motoristas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          experienciaAnos: parseInt(formData.experienciaAnos) || 0,
          transporteId: selectedTransporte?.id || null,
        })
      });

      if (response.ok) {
        const data = await response.json();
        showNotification('Motorista criado com sucesso!', 'success');
        setTimeout(() => {
          router.push(`/motoristas/${data.id}`);
        }, 1500);
      } else {
        const error = await response.json();
        showNotification(error.error || 'Erro ao criar motorista', 'error');
      }
    } catch (error) {
      console.error('Erro ao criar motorista:', error);
      showNotification('Erro ao criar motorista', 'error');
    } finally {
      setSaving(false);
    }
  }

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

      <div className="max-w-[1400px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/motoristas')}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Novo Motorista</h2>
            <p className="text-gray-600 mt-1">Adicione um novo motorista ao sistema</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Coluna Esquerda - Foto */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Foto do Motorista</h3>
                
                <div className="flex flex-col items-center">
                  <div className="w-40 h-40 bg-gray-100 rounded-full flex items-center justify-center mb-4 overflow-hidden">
                    {fotoPreview ? (
                      <img src={fotoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-20 h-20 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                  </div>
                  
                  <label className="w-full cursor-pointer">
                    <div className="w-full px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-lg font-medium text-center">
                      Escolher Foto
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
              {/* Informações Pessoais */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Informações Pessoais</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      value={formData.nome}
                      onChange={(e) => setFormData({...formData, nome: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      placeholder="Ex: Abasi Muthisse"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Data de Nascimento *
                    </label>
                    <input
                      type="date"
                      value={formData.dataNascimento}
                      onChange={(e) => setFormData({...formData, dataNascimento: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
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
                      Género *
                    </label>
                    <select
                      value={formData.genero}
                      onChange={(e) => setFormData({...formData, genero: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white"
                      required
                    >
                      <option value="Masculino">Masculino</option>
                      <option value="Feminino">Feminino</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Estado Civil *
                    </label>
                    <select
                      value={formData.estadoCivil}
                      onChange={(e) => setFormData({...formData, estadoCivil: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white"
                      required
                    >
                      <option value="Solteiro">Solteiro</option>
                      <option value="Casado">Casado</option>
                      <option value="Divorciado">Divorciado</option>
                      <option value="Viúvo">Viúvo</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Endereço *
                    </label>
                    <textarea
                      value={formData.endereco}
                      onChange={(e) => setFormData({...formData, endereco: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      placeholder="Ex: Av. Muthisse, 162, Maputo"
                      rows={2}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Documentos - Bilhete de Identidade */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Bilhete de Identidade</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Número *
                    </label>
                    <input
                      type="text"
                      value={formData.bi}
                      onChange={(e) => setFormData({...formData, bi: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      placeholder="Ex: 110200000062K"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Data de Emissão *
                    </label>
                    <input
                      type="date"
                      value={formData.dataEmissaoBI}
                      onChange={(e) => setFormData({...formData, dataEmissaoBI: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Data de Validade *
                    </label>
                    <input
                      type="date"
                      value={formData.dataValidadeBI}
                      onChange={(e) => setFormData({...formData, dataValidadeBI: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Documentos - Carta de Condução */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Carta de Condução</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Número *
                    </label>
                    <input
                      type="text"
                      value={formData.cartaConducao}
                      onChange={(e) => setFormData({...formData, cartaConducao: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      placeholder="Ex: CC-2022-000063"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Categoria *
                    </label>
                    <select
                      value={formData.categoriaCarta}
                      onChange={(e) => setFormData({...formData, categoriaCarta: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white"
                      required
                    >
                      <option value="A">A - Motociclos</option>
                      <option value="B">B - Ligeiros</option>
                      <option value="C">C - Pesados</option>
                      <option value="D">D - Transporte Público</option>
                      <option value="E">E - Reboques</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Data de Emissão *
                    </label>
                    <input
                      type="date"
                      value={formData.dataEmissaoCarta}
                      onChange={(e) => setFormData({...formData, dataEmissaoCarta: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Data de Validade *
                    </label>
                    <input
                      type="date"
                      value={formData.dataValidadeCarta}
                      onChange={(e) => setFormData({...formData, dataValidadeCarta: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Contacto */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Contacto</h3>
                
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
                        value={formData.telefone}
                        onChange={(e) => setFormData({...formData, telefone: e.target.value.replace(/\D/g, '').slice(0, 9)})}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                        placeholder="861621434"
                        maxLength={9}
                        required
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">9 dígitos</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      placeholder="Ex: abasi.muthisse@transport.co.mz"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Contacto de Emergência */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Contacto de Emergência</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Nome do Contacto *
                    </label>
                    <input
                      type="text"
                      value={formData.contatoEmergencia}
                      onChange={(e) => setFormData({...formData, contatoEmergencia: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      placeholder="Ex: Isabel Nhaca (Familiar)"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Telefone de Emergência *
                    </label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 border border-r-0 border-gray-300 bg-gray-50 text-gray-900 rounded-l-lg">
                        +258
                      </span>
                      <input
                        type="text"
                        value={formData.numeroEmergencia}
                        onChange={(e) => setFormData({...formData, numeroEmergencia: e.target.value.replace(/\D/g, '').slice(0, 9)})}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                        placeholder="845622062"
                        maxLength={9}
                        required
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">9 dígitos</p>
                  </div>
                </div>
              </div>

              {/* Experiência Profissional */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Experiência Profissional</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Anos de Experiência *
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={formData.experienciaAnos}
                      onChange={(e) => setFormData({...formData, experienciaAnos: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      placeholder="Ex: 5"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Password (para Login) *
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      placeholder="Digite a senha para o driver login"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Status *
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900 bg-white"
                      required
                    >
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                      <option value="suspenso">Suspenso</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Deficiência (se houver)
                    </label>
                    <input
                      type="text"
                      value={formData.deficiencia}
                      onChange={(e) => setFormData({...formData, deficiencia: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      placeholder="Descreva qualquer deficiência (opcional)"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Observações
                    </label>
                    <textarea
                      value={formData.observacoes}
                      onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                      placeholder="Ex: Trabalha para Transporte Popular"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Transporte Atribuído */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Transporte Atribuído (Opcional)</h3>
                
                {selectedTransporte ? (
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900">{selectedTransporte.matricula}</h4>
                          <p className="text-sm text-gray-600">{selectedTransporte.modelo} - {selectedTransporte.marca}</p>
                          {selectedTransporte.via && (
                            <p className="text-xs text-gray-500">Via: {selectedTransporte.via.nome}</p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveTransporte}
                        className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed border-gray-300 rounded-lg">
                    <svg className="w-10 h-10 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <p className="text-sm text-gray-600 mb-3">Nenhum transporte selecionado</p>
                    <button
                      type="button"
                      onClick={handleOpenTransportModal}
                      className="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-sm font-medium"
                    >
                      Selecionar Transporte
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => router.push('/motoristas')}
              className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gray-900 hover:bg-black text-white rounded-lg font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Criando...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Criar Motorista</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Transport Selection Modal */}
        {showTransportModal && (
          <div 
            className="fixed inset-0 z-50 backdrop-blur-sm min-h-screen" 
            style={{ minHeight: '100vh', height: '100%' }}
            onClick={() => setShowTransportModal(false)}
          >
            <div className="flex items-center justify-center min-h-screen p-4">
              <div 
                className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 animate-scale-in border border-gray-200 my-8 max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">Selecionar Transporte</h3>
                  <button
                    onClick={() => setShowTransportModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Search */}
                <div className="mb-4">
                  <input
                    type="text"
                    value={searchTransporte}
                    onChange={(e) => setSearchTransporte(e.target.value)}
                    placeholder="Pesquisar por matrícula, modelo ou marca..."
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                  />
                </div>

                {/* Transport List */}
                {loadingTransportes ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                ) : filteredTransportes.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <p className="text-gray-600">Nenhum transporte disponível</p>
                    <p className="text-sm text-gray-500 mt-1">Todos os transportes já têm motorista atribuído</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredTransportes.map((transporte) => (
                      <button
                        key={transporte.id}
                        onClick={() => handleSelectTransporte(transporte)}
                        className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900">{transporte.matricula}</h4>
                            <p className="text-sm text-gray-600">{transporte.modelo} - {transporte.marca}</p>
                            {transporte.via && (
                              <p className="text-xs text-gray-500">Via: {transporte.via.nome} ({transporte.via.codigo})</p>
                            )}
                          </div>
                          <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
