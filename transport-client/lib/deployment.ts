/**
 * Se esta publicação é a de produção actual, a única que corre a verificação de chegadas.
 *
 * Porquê: na Vercel, cada publicação antiga continua a funcionar no seu próprio endereço
 * (transport-<id>-transportmozambique.vercel.app, aberto a quem tem sessão na Vercel), com a mesma
 * base de dados e a mesma chave do Africa's Talking. Uma página da plataforma aberta numa delas
 * dispara a verificação com o código antigo, que envia avisos errados aos passageiros e muda o
 * estado dos acompanhamentos. Em 2026-10-28, uma publicação anterior às médias de GPS enviou
 * "Saia agora: chegou ao seu destino" a um passageiro que ainda esperava o autocarro.
 *
 * Como: o domínio de produção (VERCEL_PROJECT_PRODUCTION_URL) aponta sempre para a publicação
 * actual; /api/versao, pedido por esse domínio, diz qual é. Uma publicação só verifica quando é essa.
 */

/** Quanto tempo uma resposta de /api/versao vale nesta instância */
const CACHE_MS = 60 * 1000;
/** Quanto tempo se espera pela resposta de /api/versao */
const TIMEOUT_MS = 5000;

let cached: { at: number; current: boolean } | null = null;

/** O identificador desta publicação na Vercel; null fora da Vercel (desenvolvimento local). */
export function deploymentId(): string | null {
  return process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_URL || null;
}

/**
 * true quando esta publicação é a de produção actual, ou fora da Vercel (desenvolvimento local,
 * com a sua própria base de dados); false nas publicações antigas e nas pré-visualizações. Sem
 * resposta do domínio de produção também é false: um minuto sem SMS é melhor do que SMS errados.
 */
export async function isCurrentDeployment(): Promise<boolean> {
  const env = process.env.VERCEL_ENV;
  if (!env) return true;
  if (env !== 'production') return false;
  const domain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const me = deploymentId();
  if (!domain || !me) return false;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.current;
  try {
    const res = await fetch(`https://${domain}/api/versao`, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return false;
    const body = (await res.json()) as { deploy?: string | null };
    cached = { at: Date.now(), current: body.deploy === me };
    return cached.current;
  } catch (error) {
    console.error('Erro ao confirmar a publicação de produção actual:', error);
    return false;
  }
}
