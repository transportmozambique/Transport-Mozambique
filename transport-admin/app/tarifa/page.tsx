"use client";

import { useEffect, useState } from "react";
import LoadingScreen from "../components/LoadingScreen";

interface Tarifa {
  nome: string;
  tarifaMinima: number;
  precoPorKm: number;
  velocidadeViagemKmh: number;
  velocidadeChegadaKmh: number;
  fatorEstrada: number;
  updatedAt: string;
}

type Field = "tarifaMinima" | "precoPorKm" | "velocidadeViagemKmh" | "velocidadeChegadaKmh" | "fatorEstrada";

const FIELDS: { key: Field; label: string; unit: string; step: string; help: string }[] = [
  { key: "tarifaMinima", label: "Tarifa mínima", unit: "MT", step: "1", help: "O preço de qualquer viagem curta." },
  { key: "precoPorKm", label: "Preço por km", unit: "MT/km", step: "0.5", help: "Multiplicado pela distância ao longo do percurso." },
  { key: "velocidadeViagemKmh", label: "Velocidade de viagem", unit: "km/h", step: "1", help: "Tempo de viagem do passageiro e posição dos autocarros sem GPS." },
  { key: "velocidadeChegadaKmh", label: "Velocidade de chegada", unit: "km/h", step: "1", help: "Tempo até o autocarro chegar à paragem." },
  { key: "fatorEstrada", label: "Factor de estrada", unit: "×", step: "0.1", help: "Distância por estrada ÷ linha recta, só para vias sem percurso." },
];

/** The apps' values when no rule exists (DEFAULT_RULE in transport-client/lib/fares.ts) */
const DEFAULTS: Record<Field, string> = {
  tarifaMinima: "10",
  precoPorKm: "10",
  velocidadeViagemKmh: "30",
  velocidadeChegadaKmh: "45",
  fatorEstrada: "1.3",
};

/** Fare of a trip of `km` km under the values typed */
function fareFor(km: number, values: Record<Field, string>) {
  const min = Number(values.tarifaMinima) || 0;
  const perKm = Number(values.precoPorKm) || 0;
  return Math.max(min, Math.ceil(km * perKm)); // as fareFor() in transport-client/lib/fares.ts
}

export default function TarifaPage() {
  const [rule, setRule] = useState<Tarifa | null>(null);
  const [values, setValues] = useState<Record<Field, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = (r: Tarifa) => {
    setRule(r);
    setValues(Object.fromEntries(FIELDS.map((f) => [f.key, String(r[f.key])])) as Record<Field, string>);
  };

  useEffect(() => {
    fetch("/api/tarifa")
      .then((res) =>
        res.json().then((d) => {
          if (res.ok) return load(d);
          if (res.status === 404) {
            // No rule yet: the apps use the defaults, and saving creates the rule
            setValues(DEFAULTS);
            return setMessage({ ok: false, text: "Ainda não há tarifa guardada: as aplicações usam estes valores. Guarde para criar a regra." });
          }
          setMessage({ ok: false, text: d.error ?? "Erro ao ler a tarifa" });
        })
      )
      .catch(() => setMessage({ ok: false, text: "Erro ao ler a tarifa" }))
      .finally(() => setLoading(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/tarifa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(FIELDS.map((f) => [f.key, Number(values[f.key])]))),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao guardar a tarifa");
      load(data);
      setMessage({ ok: true, text: "Tarifa guardada. A aplicação dos passageiros e o USSD usam-na dentro de 1 minuto." });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Erro ao guardar a tarifa" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen layout="admin" />;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Tarifa</h1>
        <p className="mt-1 text-sm text-slate-500">
          A regra usada em todos os preços, tempos de viagem e posições dos autocarros sem GPS, na web, no USSD e neste painel.
        </p>
      </div>

      {message && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${message.ok ? "border-slate-300 bg-white text-slate-900" : "border-slate-400 bg-slate-100 text-slate-900 font-medium"}`}>
          {message.text}
        </div>
      )}

      {values && (
        <form onSubmit={save} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="text-sm font-semibold text-slate-900">{f.label}</span>
                <div className="mt-1 flex items-center rounded-xl border border-slate-300 focus-within:ring-2 focus-within:ring-slate-900">
                  <input
                    type="number"
                    inputMode="decimal"
                    step={f.step}
                    required
                    value={values[f.key]}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    className="w-full rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none"
                  />
                  <span className="shrink-0 pr-3 text-sm text-slate-500">{f.unit}</span>
                </div>
                <span className="mt-1 block text-xs text-slate-500">{f.help}</span>
              </label>
            ))}
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Com estes valores: 2 km custam <b className="text-slate-900">{fareFor(2, values)} MT</b>, 5 km{" "}
            <b className="text-slate-900">{fareFor(5, values)} MT</b> e 15 km <b className="text-slate-900">{fareFor(15, values)} MT</b>.
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {rule ? `Regra "${rule.nome}", alterada em ${new Date(rule.updatedAt).toLocaleString("pt-PT")}` : ""}
            </p>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "A guardar…" : "Guardar tarifa"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
