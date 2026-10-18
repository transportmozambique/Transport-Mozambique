/** A bus's plate drawn like a number plate, so it is easy to match with the bus in the street. */
export default function Plate({ matricula }: { matricula: string }) {
  return (
    <span className="shrink-0 inline-flex flex-col items-center rounded-xl border-2 border-slate-900 bg-white px-2.5 py-0.5 leading-tight">
      <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Autocarro</span>
      <span className="font-mono text-sm font-bold text-slate-900">{matricula}</span>
    </span>
  );
}
