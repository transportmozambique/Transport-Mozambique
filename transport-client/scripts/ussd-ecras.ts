/**
 * Mostra os ecrãs USSD para cada `text` dado, como o telemóvel os veria, sem servidor nem Africa's
 * Talking: chama directamente o handler de /api/ussd. Porquê: para experimentar um menu, ou gravar
 * os ecrãs da documentação (docs/ussd.md), basta a base de dados local.
 *
 *   cd transport-client
 *   npx tsx scripts/ussd-ecras.ts "" "1" "1*capuchinho" "1*capuchinho*combatentes"
 *
 * Usa DATABASE_URL do .env (ou do ambiente) e o telefone USSD_TELEFONE (por omissão +258840000009;
 * o telefone de um motorista para a opção 6). As viagens e as horas só contam com os autocarros
 * cujo motorista iniciou a viagem (opção 6, ou o portal do motorista).
 * Atenção: a tecla 1 no ecrã de uma viagem grava um Acompanhamento, 6*<PIN>*1*1 inicia ou encerra
 * uma viagem, e com AFRICASTALKING_API_KEY definida os ecrãs finais enviam SMS. Usar contra uma
 * cópia local.
 */
import './load-env';
import { NextRequest } from 'next/server';

const phone = process.env.USSD_TELEFONE || '+258840000009';

async function screen(text: string): Promise<string> {
  const { POST } = await import('../app/api/ussd/route');
  const body = new URLSearchParams({ sessionId: 'ecras', serviceCode: '*384*848080#', phoneNumber: phone, text });
  const url = `http://localhost/api/ussd${process.env.USSD_CALLBACK_KEY ? `?key=${encodeURIComponent(process.env.USSD_CALLBACK_KEY)}` : ''}`;
  const res = await POST(new NextRequest(url, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }));
  return res.text();
}

async function main() {
  // Os registos do handler (📱/📤) ficam de fora: só os ecrãs interessam aqui
  console.log = () => {};
  for (const text of process.argv.slice(2)) {
    process.stdout.write(`\ntext="${text}"\n${await screen(text)}\n`);
  }
  process.exit(0);
}

main().catch((e) => {
  process.stderr.write(String(e?.stack || e) + '\n');
  process.exit(1);
});
