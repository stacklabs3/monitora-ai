// Sem internet: o que não faz nada precisa declarar-se indisponível (aria-disabled); o aviso fixo não cobre conteúdo.
import { writeFileSync } from 'node:fs';
import { abrirNavegador, PASTA } from './lib.mjs';
const rodada = process.argv[2] || 'rodada';
const { avaliar, abrir, clicar, tecla, foto, fechar } = await abrirNavegador({ porta: 9368 });
const linhas = []; const dizer = (linha) => { linhas.push(linha); console.log(linha); };
await abrir('/?listarPrints=todas');
const prints = JSON.parse(await avaliar('document.querySelector("#lista-de-prints").textContent'));
const LOTE = ['buscar-eventos', 'avisos-da-busca', 'ler-um-evento', 'filtrar-por-um-valor', 'ler-o-erro-do-evento', 'achar-a-tentativa', 'ler-a-linha-do-tempo', 'codigo-em-duas-tentativas'];
const telas = new Map();
for (const print of prints) { const rotina = print.arquivo.split('/')[0]; if (!LOTE.includes(rotina)) continue; const rota = print.endereco.slice(print.endereco.indexOf('#')); if (!telas.has(rota)) telas.set(rota, `${rotina}/${print.arquivo.split('/')[1].split('--')[0]}`); }
const retrato = `(() => JSON.stringify([location.hash, document.querySelector('#root').innerText, [...document.querySelectorAll('#root input')].map((campo) => campo.value).join('|'), document.querySelectorAll('[role=dialog]').length,
  [...document.querySelectorAll('[aria-pressed],[aria-expanded],[aria-checked],[aria-current]')].map((el) => (el.getAttribute('aria-pressed') || '') + (el.getAttribute('aria-expanded') || '') + (el.getAttribute('aria-checked') || '') + (el.getAttribute('aria-current') || '')).join(''),
  [...document.querySelectorAll('main, .rolagem-propria')].map((el) => Math.round(el.scrollTop)).join(','), document.documentElement.dataset.theme,
  [...document.querySelectorAll('[style*="white-space"]')].length + ':' + [...document.querySelectorAll('.linha-de-evento')].slice(0, 3).map((el) => Math.round(el.getBoundingClientRect().height)).join(',')]))()`;
const alvos = `(() => {
  const vistos = new Set(); const saida = [];
  const clicaveis = [...document.querySelectorAll('#root [role="button"], #root [role="radio"], #root [role="option"], #root [role="link"], #root button, #root a, #root select')];
  clicaveis.forEach((el, indice) => {
    if (!el.checkVisibility()) return;
    if (el.getAttribute('aria-disabled') === 'true' || el.disabled) return;
    // Uma amostra por tipo: as linhas de uma mesma lista se comportam igual.
    const lista = el.closest('ol, ul, [role=listbox], nav, [role=radiogroup]');
    const tipo = el.classList.contains('linha-de-evento') ? 'linha:' + (lista ? lista.getAttribute('aria-label') : '') : (el.getAttribute('aria-label') || el.innerText || '').replace(/\\s+/g, ' ').slice(0, 40) + '|' + (lista ? lista.getAttribute('aria-label') || '' : '');
    if (vistos.has(tipo)) return; vistos.add(tipo);
    el.dataset.alvoDaAuditoria = String(indice);
    saida.push({ indice: String(indice), nome: (el.getAttribute('role') || el.tagName.toLowerCase()) + ' «' + (el.getAttribute('aria-label') || el.innerText || '').replace(/\\s+/g, ' ').slice(0, 44) + '»', escolhido: el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-current') === 'true' || el.getAttribute('aria-current') === 'page', seletor: el.tagName === 'SELECT' });
  });
  return saida;
})()`;
const DA_CASCA = ['button «Saúde do envio»', 'button «Alertas»']; // itens de menu de lotes futuros: já não navegavam na casca aprovada (137f0a2), em estado nenhum
let inertesDaCasca = 0; let inertes = 0; let conferidos = 0; const resumoDosInertes = new Map(); let indisponiveis = 0;
for (const [rota, nomeDaTela] of telas) {
  const endereco = `/?visao=painel&superficie=desktop&tema=light&estado=offline&print=1&idioma=pt-BR${rota}`;
  await abrir(endereco);
  const lista = await avaliar(alvos);
  indisponiveis += await avaliar('document.querySelectorAll("#root [aria-disabled=true]").length');
  const inertesDaTela = [];
  for (const alvo of lista) {
    if (alvo.escolhido || alvo.seletor) continue; // o já escolhido não muda nada por definição; o select abre a lista nativa
    await abrir(endereco); await avaliar(alvos);
    const antes = await avaliar(retrato);
    try { await clicar(`document.querySelector('[data-alvo-da-auditoria="${alvo.indice}"]')`, alvo.nome); } catch { continue; }
    await new Promise((resolver) => setTimeout(resolver, 250));
    const depois = await avaliar(retrato);
    conferidos++;
    if (antes === depois && DA_CASCA.includes(alvo.nome)) { inertesDaCasca++; continue; }
    if (antes === depois) { inertes++; inertesDaTela.push(alvo.nome); resumoDosInertes.set(alvo.nome, (resumoDosInertes.get(alvo.nome) || []).concat(nomeDaTela)); }
  }
  // O aviso fixo: depois de rolar, cobre outro elemento grudado (cabeçalho da lista)?
  await abrir(endereco);
  const cobertura = await avaliar(`(() => {
    const aviso = [...document.querySelectorAll('[role=status]')].find((el) => el.textContent.includes('Sem internet') || getComputedStyle(el.parentElement).position === 'sticky');
    if (!aviso) return { semAviso: true };
    const grudadoDoAviso = aviso.closest('[style*="sticky"]') || aviso;
    let area = grudadoDoAviso.parentElement; while (area && !/(auto|scroll)/.test(getComputedStyle(area).overflowY)) area = area.parentElement;
    if (!area) return { semRolagem: true };
    const podeRolar = area.scrollHeight - area.clientHeight;
    area.scrollTop = Math.min(podeRolar, 500);
    const caixaDoAviso = grudadoDoAviso.getBoundingClientRect();
    const outrosGrudados = [...area.querySelectorAll('*')].filter((el) => el !== grudadoDoAviso && !grudadoDoAviso.contains(el) && getComputedStyle(el).position === 'sticky');
    const cobertos = outrosGrudados.filter((el) => { const caixa = el.getBoundingClientRect(); return caixa.height > 0 && caixa.top < caixaDoAviso.bottom - 1 && caixa.bottom > caixaDoAviso.top + 1; }).map((el) => '«' + el.innerText.replace(/\\s+/g, ' ').slice(0, 40) + '» topo ' + Math.round(el.getBoundingClientRect().top) + ' sob o aviso até ' + Math.round(caixaDoAviso.bottom));
    return { rolou: Math.round(area.scrollTop), podeRolar: Math.round(podeRolar), avisoGrudou: Math.round(caixaDoAviso.top), alturaDoAviso: Math.round(caixaDoAviso.height), cobertos, outrosGrudados: outrosGrudados.length };
  })()`);
  // Rota com seção: o título da seção para onde a tela rolou fica visível, e não debaixo do aviso?
  const secao = /\/(atributos|erro|secao\/[a-z-]+)$/.test(rota) ? await avaliar(`(() => {
    const aviso = [...document.querySelectorAll('[role=status]')].find((el) => el.textContent.includes('Sem internet'));
    return aviso ? 'aviso em y ' + Math.round(aviso.getBoundingClientRect().top) + '–' + Math.round(aviso.getBoundingClientRect().bottom) : 'sem aviso'; })()`) : '';
  const cobriu = cobertura.cobertos && cobertura.cobertos.length;
  if (cobriu) await foto(`${rodada}-offline-aviso-cobre-${nomeDaTela.replace('/', '_')}`);
  dizer(`${inertesDaTela.length || cobriu ? 'FAIL' : 'PASS'} ${nomeDaTela}: ${lista.length} controles habilitados (amostra por tipo) · sem efeito e sem aria-disabled: ${inertesDaTela.length}${inertesDaTela.length ? ' → ' + inertesDaTela.join(' ; ') : ''} · aviso fixo: ${JSON.stringify(cobertura)} ${secao}`);
}
dizer(`\nRESUMO sem internet: ${conferidos} controles clicados · ${inertes} sem efeito e sem aria-disabled · elementos com aria-disabled nas telas: ${indisponiveis} · itens de menu da casca sem destino ainda (fora do lote, à parte): ${inertesDaCasca} cliques em ${DA_CASCA.join(' e ')}`);
for (const [nome, ondeAparece] of resumoDosInertes) dizer(`  INERTE ${nome} em ${ondeAparece.length} telas (ex.: ${ondeAparece[0]})`);
// Controle negativo (RP1): um botão que não faz nada, sem aria-disabled, precisa ser acusado; um que muda a tela precisa passar.
await abrir(`/?visao=painel&superficie=desktop&tema=light&estado=offline&print=1&idioma=pt-BR${[...telas.keys()][0]}`);
await avaliar(`(() => { const main = document.querySelector('#root main main') || document.querySelector('#root main'); const inerte = document.createElement('button'); inerte.id = 'controle-inerte'; inerte.textContent = 'CONTROLE inerte'; main.prepend(inerte); const vivo = document.createElement('button'); vivo.id = 'controle-vivo'; vivo.textContent = 'CONTROLE vivo'; vivo.onclick = () => { vivo.textContent = 'CONTROLE mudou'; }; main.prepend(vivo); return true; })()`);
let antes = await avaliar(retrato); await clicar('document.querySelector("#controle-inerte")', 'inerte'); let depois = await avaliar(retrato);
dizer(`CONTROLE NEGATIVO (botão sem efeito): ${antes === depois ? 'REPROVADO como devia (sem efeito)' : 'NÃO REPROVOU'}`);
antes = await avaliar(retrato); await clicar('document.querySelector("#controle-vivo")', 'vivo'); depois = await avaliar(retrato);
dizer(`CONTROLE POSITIVO (botão que muda a tela): ${antes !== depois ? 'passou (efeito detectado)' : 'NÃO PASSOU'}`);
writeFileSync(`${PASTA}offline-${rodada}.txt`, linhas.join('\n') + '\n');
fechar();
