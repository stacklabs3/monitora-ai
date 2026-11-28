// A medida termina depois que o navegador pintou o quadro: o requestAnimationFrame roda antes da
// pintura e a mensagem do MessageChannel é a primeira tarefa depois dela.
export function esperarPintura() {
  return new Promise((resolver) => {
    requestAnimationFrame(() => {
      const canal = new MessageChannel();
      canal.port1.onmessage = () => resolver(performance.now());
      canal.port2.postMessage(null);
    });
  });
}

const instanteDoCliquePorMedida = new Map();
window.medidasDoPainel = [];

export function marcarClique(nomeDaMedida, instanteDoClique) {
  instanteDoCliquePorMedida.set(nomeDaMedida, instanteDoClique);
}

export async function registrarMedida(nomeDaMedida, instanteDosDados) {
  const instanteDaPintura = await esperarPintura();
  window.medidasDoPainel.push({
    nome: nomeDaMedida,
    doCliqueMs: instanteDaPintura - instanteDoCliquePorMedida.get(nomeDaMedida),
    dosDadosMs: instanteDaPintura - instanteDosDados,
  });
}

// Carga de CPU com número fixo de voltas: prova que a lentidão pedida ao Chrome foi aplicada.
window.rodarCargaFixa = function rodarCargaFixa() {
  const inicio = performance.now();
  let acumulado = 0;
  for (let volta = 0; volta < 40_000_000; volta += 1) {
    acumulado = (acumulado + volta * 31) % 1_000_003;
  }
  return { duracaoMs: performance.now() - inicio, acumulado };
};
