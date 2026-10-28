import { NextResponse } from 'next/server';
import { deploymentId } from '@/lib/deployment';

/**
 * GET /api/versao: a publicação que responde. Pedido pelo domínio de produção, diz qual é a
 * publicação de produção actual, a única que corre a verificação de chegadas (lib/deployment.ts).
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ deploy: deploymentId() }, { headers: { 'Cache-Control': 'no-store' } });
}
