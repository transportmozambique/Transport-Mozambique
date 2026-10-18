import { redirect } from "next/navigation";

/**
 * Ligações antigas de acompanhamento (os alertas da página da conta, ligações guardadas ou
 * partilhadas): os autocarros seguem-se agora em /viagem. Com as duas paragens é uma viagem de um
 * só autocarro; só com a paragem do passageiro, o autocarro sozinho com a sua próxima passagem lá.
 */
export default async function TrackRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const one = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : "");
  const paragem = one("paragem");
  const destino = one("destino");
  const out = new URLSearchParams({ b: paragem && destino ? `${id}~${paragem}~${destino}` : paragem ? `${id}~${paragem}` : id });
  if (paragem && destino) out.set("para", destino);
  redirect(`/viagem?${out}`);
}
