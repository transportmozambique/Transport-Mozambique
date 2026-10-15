"use client";
import LoadingScreen from "../../../components/LoadingScreen";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";

interface Administrador {
  id: string;
  nome: string;
  email: string;
}

export default function EditarAdministrador() {
  const router = useRouter();
  const params = useParams();
  const { admin, refreshAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    senha: "",
    confirmarSenha: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (params.id) {
      fetchAdministrador(params.id as string);
    }
  }, [params.id]);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  async function fetchAdministrador(id: string) {
    try {
      const response = await fetch(`/api/administradores/${id}`, {
        cache: 'no-store',
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Administrador não encontrado');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao carregar administrador');
      }
      
      const data = await response.json();
      setFormData({
        nome: data.nome,
        email: data.email,
        senha: "",
        confirmarSenha: "",
      });
    } catch (error: any) {
      console.error('Erro ao carregar administrador:', error);
      showNotification(error.message || 'Erro ao carregar administrador', 'error');
    } finally {
      setLoading(false);
    }
  }

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

    if (formData.senha && formData.senha.length < 6) {
      newErrors.senha = "Senha deve ter pelo menos 6 caracteres";
    }

    if (formData.senha && formData.senha !== formData.confirmarSenha) {
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
      const updateData: any = {
        nome: formData.nome,
        email: formData.email,
      };

      // Only include password if it was changed
      if (formData.senha) {
        updateData.senha = formData.senha;
      }

      const response = await fetch(`/api/administradores/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        const updatedAdmin = await response.json();
        
        // If editing own profile, update localStorage and refresh context
        if (admin && admin.id === params.id) {
          const currentAdminData = localStorage.getItem("admin");
          if (currentAdminData) {
            try {
              const adminData = JSON.parse(currentAdminData);
              adminData.nome = updatedAdmin.nome;
              adminData.email = updatedAdmin.email;
              localStorage.setItem("admin", JSON.stringify(adminData));
              refreshAdmin();
            } catch (error) {
              console.error("Error updating admin data:", error);
            }
          }
        }
        
        showNotification('Administrador atualizado com sucesso!', 'success');
        setTimeout(() => router.push(`/administradores/${params.id}`), 1500);
      } else {
        const error = await response.json();
        showNotification(error.error || 'Erro ao atualizar administrador', 'error');
      }
    } catch (error) {
      console.error('Erro ao atualizar administrador:', error);
      showNotification('Erro ao atualizar administrador', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingScreen layout="admin" />;
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

      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push(`/administradores/${params.id}`)}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Editar Administrador</h2>
              <p className="text-gray-600 mt-1">Atualize as informações do administrador</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="max-w-3xl">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            <h3 className="text-lg font-bold text-gray-900 pb-3 border-b border-gray-200">
              Informações Pessoais
            </h3>

            {/* Nome */}
            <div>
              <label className="block text-sm font-semibold text-black mb-2">
                Nome Completo <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-black placeholder:text-gray-600 ${
                  errors.nome ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Nome completo do administrador"
              />
              {errors.nome && (
                <p className="mt-1 text-sm text-red-600">{errors.nome}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-black mb-2">
                Email <span className="text-red-600">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-black placeholder:text-gray-600 ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="email@exemplo.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-md font-bold text-black mb-4">Alterar Senha (opcional)</h4>
              <p className="text-sm text-black mb-4">
                Deixe em branco se não quiser alterar a senha
              </p>

              {/* Nova Senha */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-black mb-2">
                  Nova Senha
                </label>
                <input
                  type="password"
                  value={formData.senha}
                  onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-black placeholder:text-gray-600 ${
                    errors.senha ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Mínimo 6 caracteres"
                />
                {errors.senha && (
                  <p className="mt-1 text-sm text-red-600">{errors.senha}</p>
                )}
              </div>

              {/* Confirmar Senha */}
              <div>
                <label className="block text-sm font-semibold text-black mb-2">
                  Confirmar Nova Senha
                </label>
                <input
                  type="password"
                  value={formData.confirmarSenha}
                  onChange={(e) => setFormData({ ...formData, confirmarSenha: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-black placeholder:text-gray-600 ${
                    errors.confirmarSenha ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Repita a nova senha"
                />
                {errors.confirmarSenha && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmarSenha}</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => router.push(`/administradores/${params.id}`)}
                className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-900 hover:bg-gray-50"
                disabled={saving}
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
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Guardar Alterações</span>
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
