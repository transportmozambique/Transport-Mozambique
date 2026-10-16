import AfricasTalking from 'africastalking';

type SmsClient = ReturnType<typeof AfricasTalking>['SMS'];

// Created on first use: the SDK throws when the API key is empty, and doing that
// at import time took the whole USSD route down instead of only skipping SMS.
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

/** "+258 84 123 4567", "258841234567", "0841234567" or "841234567" -> "+258841234567" */
export function toInternationalPhone(to: string): string {
  const digits = to.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('258') && digits.length === 12) return `+${digits}`;
  return `+258${digits.replace(/^0/, '')}`;
}

/**
 * Enviar SMS de notificação. Nunca lança erro: o SMS é secundário ao fluxo
 * (USSD, notificações), por isso falhas são apenas registadas.
 */
export async function sendSMS(to: string, message: string) {
  const client = smsClient();
  const phoneNumber = toInternationalPhone(to);

  if (!client) {
    console.warn(`SMS não enviado para ${phoneNumber}: AFRICASTALKING_API_KEY não configurada`);
    return null;
  }

  try {
    const result = await client.send({
      to: [phoneNumber],
      message,
      ...(process.env.AFRICASTALKING_SHORTCODE ? { from: process.env.AFRICASTALKING_SHORTCODE } : {}),
    });
    console.log(`✅ SMS enviado para ${phoneNumber}:`, result);
    return result;
  } catch (error) {
    console.error(`❌ Erro ao enviar SMS para ${phoneNumber}:`, error);
    return null;
  }
}

/**
 * Enviar notificação de autocarro próximo
 */
export async function notifyBusArrival(
  phoneNumber: string,
  busMatricula: string,
  paragemNome: string,
  tempoEstimado: number
) {
  const message = `🚌 Autocarro ${busMatricula} está a ${tempoEstimado} minutos da ${paragemNome}!`;

  return sendSMS(phoneNumber, message);
}

/**
 * Enviar notificação de mission criada
 */
export async function notifyMissionCreated(
  phoneNumber: string,
  paragemNome: string
) {
  const message = `✅ Missão criada! Você será notificado quando um autocarro estiver chegando na ${paragemNome}.`;

  return sendSMS(phoneNumber, message);
}
