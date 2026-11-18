import { after } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(pedido) {
  const compraId = new URL(pedido.url).searchParams.get('compraId');
  console.warn('compra demorando', { compraId });
  console.error('pagamento recusado', { compraId });
  after(() => globalThis.monitoraSintetica?.descarregar());
  return Response.json({ ok: true, compraId });
}
