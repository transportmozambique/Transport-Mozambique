/**
 * Mostra os ecrãs USSD para cada `text` dado, como o telemóvel os veria, sem servidor nem Africa's
 * Talking: chama directamente o handler de /api/ussd. Porquê: para experimentar um menu, ou gravar
 * os ecrãs da documentação (docs/ussd.md), basta a base de dados local.
 *
 *   cd transport-client
 *   npx tsx scripts/ussd-ecras.ts "" "1" "1*museu" "1*museu*zimpeto"
 *
 * Usa DATABASE_URL do .env (ou do ambiente) e o telefone USSD_TELEFONE (por omissão +258840000009).
 * USSD_HORA="2026-10-19T08:30:00+02:00" fixa o relógio nesse momento (os horários dos autocarros
 * dependem da hora: sem isto, à noite todas as viagens começam "amanha").
 * Atenção: a opção 1 escreve na base de dados (um Utente para um telefone novo e um MISSION), e com
 * AFRICASTALKING_API_KEY definida os ecrãs finais enviam SMS. Usar contra uma cópia local.
 */
import './load-env';
import { NextRequest } from 'next/server';

// Relógio fixo (USSD_HORA): o tempo continua a andar, mas a partir desse momento
if (process.env.USSD_HORA) {
  const RealDate = Date;
  const offset = new RealDate(process.env.USSD_HORA).getTime() - RealDate.now();
  class FixedDate extends RealDate {
    constructor(...args: ConstructorParameters<typeof Date> | []) {
      if (args.length) super(...(args as ConstructorParameters<typeof Date>));
      else super(RealDate.now() + offset);
    }
    static now() {
      return RealDate.now() + offset;
    }
  }
  globalThis.Date = FixedDate as DateConstructor;
}

const phone = process.env.USSD_TELEFONE || '+258840000009';

async function screen(text: string): Promise<string> {
  // Importado depois de fixar o relógio
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
