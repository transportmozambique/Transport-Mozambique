import AfricasTalking from 'africastalking';

// Inicializar Africa's Talking
const africastalking = AfricasTalking({
  apiKey: process.env.AFRICASTALKING_API_KEY || '',
  username: process.env.AFRICASTALKING_USERNAME || 'sandbox',
});

const sms = africastalking.SMS;

/**
 * Enviar SMS de notificação
 */
export async function sendSMS(to: string, message: string) {
  try {
    // Garantir que o número tem o formato correto (+258...)
    const phoneNumber = to.startsWith('+') ? to : `+258${to.replace(/^0/, '')}`;

    const result = await sms.send({
      to: [phoneNumber],
      message,
      from: process.env.AFRICASTALKING_SHORTCODE,
    });

    console.log(`✅ SMS enviado para ${phoneNumber}:`, result);
    return result;
  } catch (error) {
    console.error(`❌ Erro ao enviar SMS para ${to}:`, error);
    throw error;
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
