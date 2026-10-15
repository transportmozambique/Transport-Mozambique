"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";

type TabType = "profile" | "security" | "settings";

export default function PerfilPage() {
  const router = useRouter();
  const { admin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("profile");
  
  // Profile edit states
  const [editingNome, setEditingNome] = useState(false);
  const [nome, setNome] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Password change states
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  useEffect(() => {
    if (admin) {
      setNome(admin.nome);
    }
  }, [admin]);

  const handleUpdateNome = async () => {
    if (!admin || !nome.trim()) return;

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch(`/api/administradores/${admin.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao atualizar perfil");
        setLoading(false);
        return;
      }

      // Update localStorage
      const updatedAdmin = { ...admin, nome: data.nome };
      localStorage.setItem("admin", JSON.stringify(updatedAdmin));
      
      setSuccess("Nome atualizado com sucesso!");
      setEditingNome(false);
      
      // Reload page to update header
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error("Error updating profile:", error);
      setError("Erro ao conectar ao servidor");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!admin) return;

    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Todos os campos são obrigatórios");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não coincidem");
      return;
    }

    setChangingPassword(true);

    try {
      const response = await fetch(`/api/administradores/${admin.id}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPasswordError(data.error || "Erro ao alterar senha");
        setChangingPassword(false);
        return;
      }

      setPasswordSuccess("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setTimeout(() => setPasswordSuccess(""), 3000);
    } catch (error) {
      console.error("Error changing password:", error);
      setPasswordError("Erro ao conectar ao servidor");
    } finally {
      setChangingPassword(false);
    }
  };

  if (!admin) {
    return null;
  }

  const getInitials = (nome: string) => {
    const names = nome.trim().split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-lg font-medium">Voltar ao Dashboard</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden sticky top-8">
              {/* User Avatar */}
              <div className="bg-gradient-to-r from-black to-gray-900 px-6 py-8">
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-3">
                    <span className="text-black font-bold text-2xl">
                      {getInitials(admin.nome)}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white text-center">{admin.nome}</h2>
                  <p className="text-sm text-gray-300 text-center mt-1">{admin.email}</p>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white text-black mt-3 capitalize">
                    {admin.role}
                  </span>
                </div>
              </div>

              {/* Navigation */}
              <nav className="p-2">
                <button
                  onClick={() => setActiveTab("profile")}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === "profile"
                      ? "bg-black text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="font-medium">Perfil</span>
                </button>

                <button
                  onClick={() => setActiveTab("security")}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === "security"
                      ? "bg-black text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="font-medium">Segurança</span>
                </button>

                <button
                  onClick={() => setActiveTab("settings")}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === "settings"
                      ? "bg-black text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="font-medium">Configurações</span>
                </button>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
              {/* Profile Tab */}
              {activeTab === "profile" && (
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-6">Informações do Perfil</h1>

                  {success && (
                    <div className="mb-6 bg-green-50 border-2 border-green-200 rounded-lg p-4 flex items-start space-x-3">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-green-800">{success}</p>
                    </div>
                  )}

                  {error && (
                    <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4 flex items-start space-x-3">
                      <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  )}

                  <div className="space-y-6">
                    {/* Nome */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-semibold text-gray-700">
                          Nome Completo
                        </label>
                        {!editingNome && (
                          <button
                            onClick={() => setEditingNome(true)}
                            className="text-sm text-black hover:text-gray-700 font-medium flex items-center space-x-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span>Editar</span>
                          </button>
                        )}
                      </div>
                      {editingNome ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-black focus:outline-none transition-colors text-gray-900"
                          />
                          <div className="flex space-x-3">
                            <button
                              onClick={handleUpdateNome}
                              disabled={loading}
                              className="flex-1 bg-black hover:bg-gray-900 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {loading ? "A guardar..." : "Guardar"}
                            </button>
                            <button
                              onClick={() => {
                                setEditingNome(false);
                                setNome(admin.nome);
                                setError("");
                              }}
                              disabled={loading}
                              className="px-4 py-2 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-lg text-gray-900">{admin.nome}</p>
                      )}
                    </div>

                    {/* Email (read-only) */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Email
                      </label>
                      <p className="text-lg text-gray-900">{admin.email}</p>
                      <p className="text-xs text-gray-500 mt-1">O email não pode ser alterado</p>
                    </div>

                    {/* Role (read-only) */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Função
                      </label>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-black text-white capitalize">
                        {admin.role}
                      </span>
                    </div>

                    {/* ID (read-only) */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        ID do Administrador
                      </label>
                      <p className="text-sm text-gray-900 font-mono bg-gray-50 px-3 py-2 rounded-lg">{admin.id}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Security Tab */}
              {activeTab === "security" && (
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-6">Segurança</h1>

                  {passwordSuccess && (
                    <div className="mb-6 bg-green-50 border-2 border-green-200 rounded-lg p-4 flex items-start space-x-3">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-green-800">{passwordSuccess}</p>
                    </div>
                  )}

                  {passwordError && (
                    <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4 flex items-start space-x-3">
                      <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-red-800">{passwordError}</p>
                    </div>
                  )}

                  <div className="space-y-6">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 mb-2">Alterar Senha</h2>
                      <p className="text-sm text-gray-600 mb-6">
                        Para sua segurança, escolha uma senha forte com pelo menos 6 caracteres.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Senha Atual
                      </label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-black focus:outline-none transition-colors text-gray-900"
                        placeholder="Digite sua senha atual"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Nova Senha
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-black focus:outline-none transition-colors text-gray-900"
                        placeholder="Digite sua nova senha"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Confirmar Nova Senha
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-black focus:outline-none transition-colors text-gray-900"
                        placeholder="Confirme sua nova senha"
                      />
                    </div>

                    <button
                      onClick={handleChangePassword}
                      disabled={changingPassword}
                      className="w-full bg-black hover:bg-gray-900 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {changingPassword ? "A alterar..." : "Alterar Senha"}
                    </button>
                  </div>
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === "settings" && (
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-6">Configurações</h1>

                  <div className="space-y-6">
                    {/* System Settings */}
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                        Sistema
                      </h2>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div>
                            <h3 className="font-semibold text-gray-900">Versão do Sistema</h3>
                            <p className="text-sm text-gray-600">TransportMZ Admin v1.0.0</p>
                          </div>
                          <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                            Atualizado
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Appearance */}
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                        Aparência
                      </h2>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div>
                            <h3 className="font-semibold text-gray-900">Tema</h3>
                            <p className="text-sm text-gray-600">Tema escuro (preto/cinza/branco)</p>
                          </div>
                          <button className="px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors">
                            Padrão
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Notifications */}
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                        Notificações
                      </h2>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div>
                            <h3 className="font-semibold text-gray-900">Notificações por Email</h3>
                            <p className="text-sm text-gray-600">Receber alertas importantes por email</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" defaultChecked />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-black/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
