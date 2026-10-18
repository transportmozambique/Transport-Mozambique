"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CriarAdministrador() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    senha: "",
    confirmarSenha: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.nome.trim()) {
      newErrors.nome = "Nome é obrigatório";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email é obrigatório";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Email inválido";
    }

    if (!formData.senha) {
      newErrors.senha = "Senha é obrigatória";
    } else if (formData.senha.length < 6) {
      newErrors.senha = "Senha deve ter pelo menos 6 caracteres";
    }

    if (formData.senha !== formData.confirmarSenha) {
      newErrors.confirmarSenha = "Senhas não coincidem";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      showNotification('Por favor, corrija os erros no formulário', 'error');
      return;
    }

    setSaving(true);

    try {
      const createData = {
        nome: formData.nome,
        email: formData.email,
        senha: formData.senha,
      };

      const response = await fetch('/api/administradores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createData),
      });

      if (response.ok) {
        const newAdmin = await response.json();
        showNotification('Administrador criado com sucesso!', 'success');
        setTimeout(() => router.push(`/administradores`), 1500);
      } else {
        const error = await response.json();
        showNotification(error.error || 'Erro ao criar administrador', 'error');
      }
    } catch (error) {
      console.error('Erro ao criar administrador:', error);
      showNotification('Erro ao criar administrador', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Notificação */}
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

      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/administradores')}
              className="p-2 rounded-xl hover:bg-slate-100"
            >
              <svg className="w-6 h-6 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Novo Administrador</h2>
              <p className="text-slate-600 mt-1">Crie um novo administrador do sistema</p>
            </div>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="max-w-3xl">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-900 pb-3 border-b border-slate-200">
              Informações Pessoais
            </h3>

            {/* Nome */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Nome Completo <span className="text-slate-900">*</span>
              </label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 placeholder:text-slate-600 ${
                  errors.nome ? 'border-slate-700' : 'border-slate-300'
                }`}
                placeholder="Nome completo do administrador"
              />
              {errors.nome && (
                <p className="mt-1 text-sm text-slate-900">{errors.nome}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Email <span className="text-slate-900">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 placeholder:text-slate-600 ${
                  errors.email ? 'border-slate-700' : 'border-slate-300'
                }`}
                placeholder="email@exemplo.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-slate-900">{errors.email}</p>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200">
              <h4 className="text-md font-bold text-slate-900 mb-4">Segurança</h4>

              {/* Nova Senha */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Senha <span className="text-slate-900">*</span>
                </label>
                <input
                  type="password"
                  value={formData.senha}
                  onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 placeholder:text-slate-600 ${
                    errors.senha ? 'border-slate-700' : 'border-slate-300'
                  }`}
                  placeholder="Mínimo 6 caracteres"
                />
                {errors.senha && (
                  <p className="mt-1 text-sm text-slate-900">{errors.senha}</p>
                )}
              </div>

              {/* Confirmar Senha */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Confirmar Senha <span className="text-slate-900">*</span>
                </label>
                <input
                  type="password"
                  value={formData.confirmarSenha}
                  onChange={(e) => setFormData({ ...formData, confirmarSenha: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-900 placeholder:text-slate-600 ${
                    errors.confirmarSenha ? 'border-slate-700' : 'border-slate-300'
                  }`}
                  placeholder="Repita a senha"
                />
                {errors.confirmarSenha && (
                  <p className="mt-1 text-sm text-slate-900">{errors.confirmarSenha}</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => router.push('/administradores')}
                className="px-6 py-3 border border-slate-300 rounded-xl font-medium text-slate-900 hover:bg-slate-50"
                disabled={saving}
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
                    <span>Criando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Criar Administrador</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
