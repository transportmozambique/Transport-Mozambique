"use client";
import LoadingScreen from "../../../components/LoadingScreen";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function EditarUtente() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    senha: "",
    mISSION: "",
    subscrito: false,
    dataSubscricao: "",
    geoLocation: "",
  });

  useEffect(() => {
    if (params.id) {
      fetchUtente(params.id as string);
    }
  }, [params.id]);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  async function fetchUtente(id: string) {
    try {
      const response = await fetch(`/api/utentes/${id}`);
      if (response.ok) {
        const data = await response.json();
        setFormData({
          nome: data.nome || "",
          email: data.email || "",
          telefone: data.telefone || "",
          senha: "", // Don't populate password
          mISSION: data.mISSION || "",
          subscrito: data.subscrito || false,
          dataSubscricao: data.dataSubscricao ? new Date(data.dataSubscricao).toISOString().split('T')[0] : "",
          geoLocation: data.geoLocation || "",
        });
      } else {
        showNotification('Erro ao carregar utente', 'error');
      }
    } catch (error) {
      showNotification('Erro ao carregar utente', 'error');
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/utentes/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        showNotification('Utente atualizado com sucesso!', 'success');
        setTimeout(() => {
          router.push(`/utentes/${params.id}`);
        }, 1500);
      } else {
        const error = await response.json();
        showNotification(error.error || 'Erro ao atualizar utente', 'error');
      }
    } catch (error) {
      showNotification('Erro ao atualizar utente', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingScreen layout="admin" />;
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`rounded-xl shadow-lg p-4 min-w-[300px] ${
            notification.type === 'success' ? 'bg-slate-50 border border-slate-200' :
            notification.type === 'error' ? 'bg-slate-100 border border-slate-400' :
            'bg-slate-50 border border-slate-200'
          }`}>
            <div className="flex items-center space-x-3">
              {notification.type === 'success' && (
                <svg className="w-5 h-5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg className="w-5 h-5 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <p className={`text-sm font-medium ${
                notification.type === 'success' ? 'text-slate-800' :
                notification.type === 'error' ? 'text-slate-900' :
                'text-slate-800'
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
            onClick={() => router.push(`/utentes/${params.id}`)}
            className="p-2 rounded-xl hover:bg-slate-100"
          >
            <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Editar Utente</h2>
            <p className="text-slate-600 mt-1">Atualize os dados do utente</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-6 pb-3 border-b border-slate-200">
              Informações Pessoais
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Nome Completo <span className="text-slate-900">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                  placeholder="Nome completo do utente"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Email <span className="text-slate-900">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                  placeholder="email@exemplo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Telefone <span className="text-slate-900">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                  placeholder="+258 XX XXX XXXX"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Nova Senha (deixe em branco para manter a atual)
                </label>
                <input
                  type="password"
                  value={formData.senha}
                  onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                  placeholder="Nova senha (opcional)"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  MISSION ID <span className="text-slate-900">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.mISSION}
                  onChange={(e) => setFormData({ ...formData, mISSION: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 font-mono"
                  placeholder="MISSION-XXXXX"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Localização Atual (Opcional)
                </label>
                <input
                  type="text"
                  value={formData.geoLocation}
                  onChange={(e) => setFormData({ ...formData, geoLocation: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 font-mono"
                  placeholder="lat,lng"
                />
              </div>
            </div>
          </div>

          {/* Subscription */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-6 pb-3 border-b border-slate-200">
              Subscrição
            </h3>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="subscrito"
                  checked={formData.subscrito}
                  onChange={(e) => setFormData({ ...formData, subscrito: e.target.checked })}
                  className="w-5 h-5 text-slate-900 border-slate-300 rounded-lg focus:ring-slate-900"
                />
                <label htmlFor="subscrito" className="text-sm font-semibold text-slate-900">
                  Utente subscrito
                </label>
              </div>

              {formData.subscrito && (
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Data de Subscrição
                  </label>
                  <input
                    type="date"
                    value={formData.dataSubscricao}
                    onChange={(e) => setFormData({ ...formData, dataSubscricao: e.target.value })}
                    className="w-full md:w-1/2 px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.push(`/utentes/${params.id}`)}
              className="px-6 py-3 border border-slate-300 rounded-xl font-medium text-slate-900 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
