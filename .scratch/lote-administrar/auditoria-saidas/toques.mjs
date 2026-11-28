// Toques das 20 rotinas (12 antigas e 8 do lote Administrar), com cliques reais, e o console do caminho inteiro.
import { writeFileSync } from 'node:fs';
import { abrirNavegador, porTexto, PASTA } from './lib.mjs';
const rodada = process.argv[2] || 'rodada';
const { avaliar, abrir, clicar, digitar, tecla, registros, fechar } = await abrirNavegador({ porta: 9462 });
const linhas = []; const dizer = (linha) => { linhas.push(linha); console.log(linha); };
const iniciarRotina = async (visao, rotulo) => {
  await abrir(`/?visao=${visao}&idioma=pt-BR`);
  await clicar('document.querySelector(".painel-toggle")', 'painel');
  await clicar(porTexto('.painel-opcoes button', rotulo), `rotina ${rotulo}`);
  await clicar('document.querySelector(".painel-toggle")', 'fechar painel');
};
const botao = (texto) => porTexto('[role="button"]', texto);
const naJanela = (texto) => porTexto('[aria-modal="true"] [role="button"]', texto);
const ROTINAS = [
  ['painel', 'entrar-no-painel', 'Entrar no painel', async () => { await clicar(botao('Entrar'), 'entrar'); await clicar(botao('Confirmar'), 'confirmar'); }],
  ['painel', 'ver-como-administrador', 'Ver o painel como Administrador', async () => { await clicar(porTexto('[role="radio"]', 'Administrador'), 'administrador'); }],
  ['painel', 'buscar-eventos', 'Buscar eventos', async () => { await clicar(botao('Adicionar filtro'), 'adicionar filtro'); await clicar(porTexto('[role="option"]', 'reservationId'), 'reservationId'); await digitar('R-1042'); await clicar(botao('Aplicar filtro'), 'aplicar'); }],
  ['painel', 'avisos-da-busca', 'Ler os avisos da busca', async () => { await clicar('document.querySelector("[aria-label^=\\"Remover o filtro\\"]")', 'remover ficha'); await clicar('document.querySelector(".campo-sem-moldura")', 'caixa de texto'); await digitar('limite'); await tecla('Enter'); await clicar(botao('Reduzir para a última hora'), 'reduzir'); }],
  ['painel', 'ler-um-evento', 'Abrir e ler um evento', async () => { await clicar(porTexto('.linha-de-evento', '14:55:16.010'), 'linha do cartão sem limite'); await clicar(botao('Abrir a tentativa'), 'abrir a tentativa'); }],
  ['painel', 'ler-o-erro-do-evento', 'Ler os atributos e o erro de um evento', async () => { await clicar(porTexto('nav[aria-label="Seções do evento"] [role="button"]', 'Atributos'), 'atributos'); await clicar(porTexto('nav[aria-label="Seções do evento"] [role="button"]', 'Erro'), 'erro'); }],
  ['painel', 'filtrar-por-um-valor', 'Filtrar por um valor do evento', async () => { await clicar('document.querySelector("[aria-label=\\"Filtrar: method é cartao\\"]")', 'method é cartao'); }],
  ['painel', 'achar-a-tentativa', 'Achar a tentativa e ler a linha do tempo', async () => { await digitar('conta-7'); await clicar(botao('Achar tentativas'), 'achar'); await clicar(porTexto('.linha-de-evento', 'R-1042'), 'R-1042'); }],
  ['painel', 'ler-a-linha-do-tempo', 'Ler um evento da linha do tempo e o que fica à parte', async () => { await clicar(porTexto('ol[aria-label^="Linha do tempo"] .linha-de-evento', '14:55:15.902'), 'linha do webhook'); await clicar(porTexto('nav[aria-label="Partes da linha do tempo"] [role="button"]', 'Mesmo horário, sem vínculo'), 'sem vínculo'); }],
  ['painel', 'codigo-em-duas-tentativas', 'Ler o código ligado a duas tentativas', async () => { await clicar(botao('Abrir a tentativa R-1047'), 'abrir R-1047'); }],
  ['painel', 'cadastrar-aplicacao', 'Cadastrar uma aplicação e gerar a chave de envio', async () => { await clicar(botao('Aplicações e chaves de envio'), 'menu aplicações'); await clicar(botao('Cadastrar aplicação'), 'cadastrar aplicação'); await digitar('API de parceiros'); await clicar(naJanela('Cadastrar e gerar a chave'), 'cadastrar e gerar'); }],
  ['painel', 'guardar-a-chave', 'Copiar a chave de envio, mostrada uma vez só', async () => { await clicar(naJanela('Copiar a chave'), 'copiar'); await clicar(naJanela('Já guardei a chave'), 'já guardei'); }],
  ['painel', 'revogar-chave', 'Revogar uma chave de envio', async () => { await clicar('document.querySelector("[aria-label=\\"Revogar a chave servidor antigo de Site\\"]")', 'revogar servidor antigo'); await clicar(naJanela('Revogar a chave'), 'confirmar revogar'); }],
  ['painel', 'declarar-um-campo', 'Declarar um campo não declarado do catálogo de campos', async () => { await clicar('document.querySelector("[aria-label=\\"Declarar o campo installmentCount\\"]")', 'declarar installmentCount'); await clicar(naJanela('Declarar o campo'), 'confirmar declarar'); }],
  ['painel', 'ler-o-catalogo-como-investigador', 'Ler o catálogo de campos como Investigador', async () => { await clicar(botao('Ver no catálogo de campos'), 'ver no catálogo'); }],
  ['painel', 'conferir-a-saude-do-envio', 'Conferir a saúde do envio de uma aplicação', async () => { await clicar(botao('Saúde do envio'), 'menu saúde'); await clicar('document.querySelector("[data-abrir-aplicacao=\\"api\\"]")', 'abrir API'); }],
  ['painel', 'execucao-que-sumiu', 'Ler a execução que sumiu sem se despedir', async () => { await clicar('document.querySelector("[data-abrir-aplicacao=\\"webhooks\\"]")', 'abrir Webhooks'); }],
  ['painel', 'eventos-em-volta-da-perda', 'Ver os eventos em volta de uma perda', async () => { await clicar('document.querySelector("[aria-label^=\\"Ver os eventos de API em volta de 14:31\\"]")', 'ver eventos em volta das 14:31'); }],
  ['celular', 'entrar-pelo-celular', 'Entrar pelo link do alerta', async () => { await clicar(botao('Entrar'), 'entrar'); await clicar(botao('Confirmar'), 'confirmar'); }],
  ['telegram', 'receber-o-alerta', 'Receber o alerta e abrir o painel', async () => { await clicar('document.querySelector("[role=\\"link\\"]")', 'ver no painel'); await clicar(botao('Entrar'), 'entrar'); await clicar(botao('Confirmar'), 'confirmar'); }],
];
let falhas = 0;
for (const [visao, id, rotulo, caminho] of ROTINAS) {
  try {
    await iniciarRotina(visao, rotulo);
    const antes = JSON.parse(await avaliar('JSON.stringify(window.contagemDeToques)'));
    await caminho();
    const contagem = JSON.parse(await avaliar('JSON.stringify(window.contagemDeToques)'));
    const passou = contagem && contagem.rotina === id && contagem.concluida && contagem.toques <= contagem.meta && antes.toques === 0;
    if (!passou) falhas++;
    dizer(`${passou ? 'PASS' : 'FAIL'} ${id}: ${contagem.toques}/${contagem.meta} toques · concluída ${contagem.concluida} · ${await avaliar('location.hash')}`);
  } catch (erro) { falhas++; dizer(`FAIL ${id}: ${erro.message}`); }
}
// Controle negativo (RP1): um toque a mais numa rotina de meta 1 precisa aparecer acima da meta e sem concluir.
await iniciarRotina('painel', 'Ver o painel como Administrador');
await clicar(porTexto('[role="button"]', 'Adicionar filtro'), 'toque a mais');
await clicar('document.body', 'fora');
await tecla('Escape');
const semConcluir = JSON.parse(await avaliar('JSON.stringify(window.contagemDeToques)'));
dizer(`CONTROLE NEGATIVO (toque que não leva à última tela): ${semConcluir.toques}/${semConcluir.meta} · concluída ${semConcluir.concluida} => ${!semConcluir.concluida && semConcluir.toques >= 1 ? 'o medidor acusa rotina não concluída' : 'CONTROLE NÃO REPROVOU'}`);
await clicar(porTexto('[role="radio"]', 'Administrador'), 'administrador');
const acima = JSON.parse(await avaliar('JSON.stringify(window.contagemDeToques)'));
dizer(`CONTROLE NEGATIVO (um toque além da meta): ${acima.toques}/${acima.meta} · concluída ${acima.concluida} => ${acima.toques > acima.meta ? 'REPROVADO como devia (acima da meta)' : 'CONTROLE NÃO REPROVOU'}`);
dizer(`\nCONSOLE E REDE (${new Set(registros).size} mensagens distintas no caminho das 20 rotinas):`);
for (const registro of new Set(registros)) dizer('  ' + registro);
dizer(`\nfalhas: ${falhas}`);
writeFileSync(`${PASTA}toques-${rodada}.txt`, linhas.join('\n') + '\n');
fechar();
