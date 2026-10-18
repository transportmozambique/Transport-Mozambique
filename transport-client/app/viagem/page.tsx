import { Suspense } from "react";
import dynamic from "next/dynamic";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "A sua viagem · Transportes Moçambique" };

// The map needs the browser
const JourneyFollow = dynamic(() => import("../components/JourneyFollow"));

export default function ViagemPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-600">A carregar a viagem…</p>}>
      <JourneyFollow />
    </Suspense>
  );
}
