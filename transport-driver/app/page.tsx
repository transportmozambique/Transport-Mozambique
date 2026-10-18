"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    telefone: "",
    senha: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/driver/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telefone: formData.telefone,
          password: formData.senha,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Erro ao fazer login');
        setIsLoading(false);
        return;
      }

      // Store driver data in localStorage
      localStorage.setItem('motorista', JSON.stringify(data));
      router.push('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError('Erro de conexão. Verifique se o servidor está a funcionar.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Transportes Moçambique</h1>
            <p className="text-sm text-slate-500">Portal do Motorista</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-xl sm:p-8">
          <h2 className="mb-1 text-2xl font-bold text-slate-900">Entrar</h2>
          <p className="mb-6 text-sm text-slate-500">Com o seu número de telefone e o PIN dado pelo administrador.</p>

          {error && <p className="mb-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="telefone" className="mb-1.5 block text-sm font-semibold text-slate-800">
                Número de telefone
              </label>
              <input
                id="telefone"
                type="tel"
                autoComplete="tel"
                required
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="Ex: 849123456"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label htmlFor="pin" className="mb-1.5 block text-sm font-semibold text-slate-800">
                PIN
              </label>
              <input
                id="pin"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                required
                value={formData.senha}
                onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                placeholder="6 dígitos"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 tracking-widest text-slate-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-full bg-slate-900 py-3.5 font-semibold text-white shadow-lg transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "A entrar…" : "Entrar"}
            </button>
          </form>

          <p className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-600">
            Não tem PIN ou esqueceu-o? <span className="font-semibold text-slate-900">Peça um novo PIN ao administrador.</span>
          </p>
        </div>

        <p className="mt-5 text-center text-xs text-slate-500">O motorista deve estar registado pelo administrador do sistema.</p>
      </div>
    </div>
  );
}
