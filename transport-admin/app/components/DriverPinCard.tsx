"use client";

import { useEffect, useState } from "react";

/**
 * Driver PIN for the driver portal and the USSD driver menu (*6). A new PIN is shown only once
 * (only its hash is stored); generating another one replaces it.
 */
export default function DriverPinCard({ motoristaId }: { motoristaId: string }) {
  const [definido, setDefinido] = useState<boolean | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/motoristas/${motoristaId}/pin`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { definido: boolean } | null) => { if (alive && d) setDefinido(d.definido); })
      .catch(() => {});
    return () => { alive = false; };
  }, [motoristaId]);

  async function gerar() {
    setBusy(true);
    setErro(null);
    try {
      const r = await fetch(`/api/motoristas/${motoristaId}/pin`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erro ao gerar PIN");
      setPin(d.pin);
      setDefinido(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar PIN");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6" data-testid="pin-card">
      <h3 className="text-lg font-bold text-slate-900 mb-4 pb-3 border-b border-slate-200">PIN de Acesso</h3>
      <p className="text-sm text-slate-900 mb-3">
        Para entrar no portal do motorista e no menu USSD de motorista.
      </p>
      <p className="text-sm mb-4">
        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${definido ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
          {definido === null ? "…" : definido ? "PIN definido" : "Sem PIN: não pode entrar"}
        </span>
      </p>

      {pin && (
        <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <p className="text-xs text-slate-600 mb-1">Novo PIN (só é mostrado agora):</p>
          <p className="text-2xl font-mono font-bold tracking-widest text-slate-900" data-testid="driver-pin">{pin}</p>
          <p className="text-xs text-slate-600 mt-1">Entregue-o ao motorista. O PIN anterior deixou de funcionar.</p>
        </div>
      )}
      {erro && <p className="text-sm text-red-700 mb-3">{erro}</p>}

      <button
        type="button"
        onClick={gerar}
        disabled={busy}
        className="w-full px-4 py-2 bg-slate-900 hover:bg-slate-900 text-white rounded-xl text-sm font-medium disabled:opacity-50"
      >
        {busy ? "A gerar…" : definido ? "Gerar novo PIN" : "Gerar PIN"}
      </button>
    </div>
  );
}
