import { redirect } from "next/navigation";

/**
 * Old tracking links (the account page's alerts, saved or shared links): buses are followed on
 * /viagem now. With both stops it is a one-bus journey; with the passenger's stop only, the
 * bus on its own with its next pass there.
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
