import AfricasTalking from 'africastalking';

type SmsClient = ReturnType<typeof AfricasTalking>['SMS'];

// Criado no primeiro uso: o SDK dá erro quando a chave da API está vazia, e fazê-lo ao importar
// derrubava a rota USSD inteira em vez de só deixar de enviar SMS.
let sms: SmsClient | null = null;

function smsClient(): SmsClient | null {
  if (sms) return sms;
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  if (!apiKey) return null;
  sms = AfricasTalking({
    apiKey,
    username: process.env.AFRICASTALKING_USERNAME || 'sandbox',
  }).SMS;
  return sms;
}

/** "+258 84 123 4567", "258841234567", "0841234567" ou "841234567" -> "+258841234567" */
export function toInternationalPhone(to: string): string {
  const digits = to.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('258') && digits.length === 12) return `+${digits}`;
  return `+258${digits.replace(/^0/, '')}`;
}

/**
 * Só caracteres GSM-7. Nos ecrãs USSD, a maioria dos telemóveis e das redes não mostra letras
 * acentuadas (estragam o ecrã ou reduzem o seu tamanho para metade); num SMS, uma só letra
 * acentuada põe a mensagem inteira em Unicode (70 caracteres por parte em vez de 160).
 */
export function toGsm(text: string): string {
  return text
    .replace(/[º⁰]/g, 'o') // ordinais, como em "1º de Maio" (também escrito com um zero em expoente)
    .replace(/ª/g, 'a') // "2ª Rotunda"
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Enviar SMS de notificação. Nunca lança erro: o SMS é secundário ao fluxo
 * (USSD, notificações), por isso falhas são apenas registadas.
 */
export async function sendSMS(to: string, message: string) {
  const client = smsClient();
  const phoneNumber = toInternationalPhone(to);

  if (!client) {
    // Sem chave (localmente): o texto fica no registo, para se ver o que teria sido enviado
    console.warn(`SMS não enviado para ${phoneNumber} (AFRICASTALKING_API_KEY não configurada): ${message}`);
    return null;
  }

  try {
    const result = await client.send({
      to: [phoneNumber],
      message,
      ...(process.env.AFRICASTALKING_SHORTCODE ? { from: process.env.AFRICASTALKING_SHORTCODE } : {}),
    });
    console.log(`SMS enviado para ${phoneNumber}:`, result);
    return result;
  } catch (error) {
    console.error(`Erro ao enviar SMS para ${phoneNumber}:`, error);
    return null;
  }
}

/** O SMS de um alerta de paragem (web): um autocarro chega à paragem do passageiro. */
export async function notifyBusArrival(phoneNumber: string, busMatricula: string, codigo: string, paragemNome: string, minutos: number) {
  return sendSMS(phoneNumber, toGsm(`Autocarro ${busMatricula} (rota ${codigo}) chega a ${paragemNome} em ${minutos} min.`));
}
