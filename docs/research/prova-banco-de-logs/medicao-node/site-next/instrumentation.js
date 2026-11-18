// Captura só no servidor Node, como pede o ADR 0001.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { iniciarCaptura } = await import('./captura-node.mjs');
    iniciarCaptura();
  }
}
