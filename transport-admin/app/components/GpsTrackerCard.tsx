"use client";

import { useCallback, useEffect, useState } from "react";

interface GpsStatus {
  configurado: boolean;
  ultimaPosicaoEm: string | null;
  ativo: boolean;
  velocidadeKmh: number | null;
  servidor: string;
}

/**
 * Dispositivo GPS de um veículo: cria ou revoga o código que um telemóvel (Traccar Client) ou um
 * rastreador GPS usa para enviar a posição real do veículo. O código é mostrado uma só vez.
 */
export default function GpsTrackerCard({ transporteId }: { transporteId: string }) {
  const [status, setStatus] = useState<GpsStatus | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/transportes/${transporteId}/gps`);
    if (r.ok) setStatus(await r.json());
  }, [transporteId]);

  useEffect(() => {
    let alive = true;
    const poll = () =>
      fetch(`/api/transportes/${transporteId}/gps`)
        .then((r) => (r.ok ? r.json() : null))
        .then((s: GpsStatus | null) => { if (alive && s) setStatus(s); })
        .catch(() => {});
    poll();
    const timer = setInterval(poll, 30000);
    return () => { alive = false; clearInterval(timer); };
  }, [transporteId]);

  async function gerar() {
    setBusy(true);
    setErro(null);
    try {
      const r = await fetch(`/api/transportes/${transporteId}/gps`, { method: "POST" });
      if (!r.ok) throw new Error((await r.json()).error || "Erro ao gerar código");
      setCodigo((await r.json()).codigo);
      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar código");
    } finally {
      setBusy(false);
    }
  }

  async function revogar() {
    setBusy(true);
    setErro(null);
    try {
      const r = await fetch(`/api/transportes/${transporteId}/gps`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error || "Erro ao revogar");
      setCodigo(null);
      setConfirmRevoke(false);
      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao revogar");
    } finally {
      setBusy(false);
    }
  }

  const ultima = status?.ultimaPosicaoEm
    ? new Date(status.ultimaPosicaoEm).toLocaleString("pt-PT", { timeZone: "Africa/Maputo" })
    : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6" data-testid="gps-card">
      <div className="flex items-start justify-between mb-4 pb-3 border-b border-slate-200">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Rastreador GPS</h3>
          <p className="text-sm text-slate-900">
            Posição real enviada pelo telemóvel do motorista ou por um rastreador. Sem GPS, a posição é estimada pelo horário.
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
            status?.ativo ? "bg-slate-900 text-white" : status?.configurado ? "bg-slate-200 text-slate-800" : "bg-slate-100 text-slate-600"
          }`}
        >
          {status?.ativo ? "GPS ativo" : status?.configurado ? "Sem sinal recente" : "Não configurado"}
        </span>
      </div>

      {status && (
        <p className="text-sm text-slate-900 mb-4">
          {ultima ? `Última posição recebida: ${ultima}` : "Ainda não recebeu nenhuma posição."}
          {status.ativo && status.velocidadeKmh != null ? ` · ${status.velocidadeKmh} km/h` : ""}
        </p>
      )}

      {codigo && status && (
        <div className="mb-4 rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm text-slate-900 space-y-2">
          <p className="font-semibold">Código do dispositivo (só é mostrado agora; guarde-o):</p>
          <code className="block select-all rounded-lg bg-white border border-slate-200 px-3 py-2 font-mono text-base" data-testid="gps-code">
            {codigo}
          </code>
          <p className="font-semibold pt-2">Configurar a app Traccar Client no telemóvel do motorista:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              URL do servidor: <code className="select-all">{status.servidor}</code>
            </li>
            <li>Identificador do dispositivo: o código acima</li>
            <li>Frequência: 15 segundos · Precisão: alta</li>
          </ul>
          <p className="text-xs text-slate-600">
            Outros sistemas: POST para o mesmo URL com o cabeçalho &quot;Authorization: Bearer &lt;código&gt;&quot; e
            {" {\"latitude\", \"longitude\", \"speed\" (km/h), \"heading\"}"}.
          </p>
        </div>
      )}

      {erro && <p className="mb-3 text-sm text-slate-800">{erro}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={gerar}
          disabled={busy}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-900 text-white rounded-xl text-sm font-medium disabled:opacity-50"
        >
          {status?.configurado ? "Gerar novo código" : "Gerar código do dispositivo"}
        </button>
        {status?.configurado &&
          (confirmRevoke ? (
            <>
              <button
                type="button"
                onClick={revogar}
                disabled={busy}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                Confirmar revogação
              </button>
              <button
                type="button"
                onClick={() => setConfirmRevoke(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-900"
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRevoke(true)}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-xl text-sm font-medium text-slate-900"
            >
              Revogar dispositivo
            </button>
          ))}
      </div>
      {status?.configurado && !codigo && (
        <p className="mt-3 text-xs text-slate-600">
          Gerar um novo código desliga o dispositivo atual até ser configurado com o novo código.
        </p>
      )}
    </div>
  );
}
