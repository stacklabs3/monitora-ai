// Coerência do cenário entre as telas: os avisos aprovados do lote Investigar contra a saúde do envio, o catálogo
// de campos e as aplicações; a conta de eventos faltando; o campo declarado e a aplicação cadastrada nas outras telas.
// Uso: node coerencia.mjs <rodada>
import { writeFileSync } from 'node:fs';
import { abrirNavegador, PASTA } from './lib.mjs';
const rodada = process.argv[2] || 'rodada';
const { avaliar, abrir, clicar, fechar } = await abrirNavegador({ porta: 9478 });
const linhas = []; const dizer = (linha) => { linhas.push(linha); console.log(linha); };
let falhas = 0; let avisos = 0;
const ADMINISTRADOR = '#/painel/excurfly/producao/administrador'; const INVESTIGADOR = '#/painel/excurfly/producao/investigador';
const HOMOLOGACAO = '#/painel/excurfly/homologacao/administrador';
const textoDaTela = async (rota, estado = 'default') => {
  await abrir(`/?visao=painel&superficie=desktop&tema=light&estado=${estado}&print=1&idioma=pt-BR${rota}`);
  return (await avaliar('document.querySelector("#root").innerText')).replace(/\s+/g, ' ');
};
const conferir = (passou, descricao, evidencia) => { if (!passou) falhas++; dizer(`${passou ? 'PASS' : 'FAIL'} ${descricao}${evidencia ? ' · ' + evidencia : ''}`); return passou; };
const observar = (coerente, descricao, evidencia) => { if (!coerente) avisos++; dizer(`${coerente ? 'PASS' : 'AVISO'} ${descricao}${evidencia ? ' · ' + evidencia : ''}`); };
const trecho = (texto, expressao, antes = 40, depois = 120) => { const posicao = texto.search(expressao); return posicao < 0 ? '(não aparece)' : '«' + texto.slice(Math.max(0, posicao - antes), posicao + depois) + '»'; };
const numeroDe = (texto) => Number(String(texto).replace(/\./g, ''));

// ---------- Controle (RP1): a conferência tem de reprovar um texto que contradiz o cenário ----------
const textoContraditorio = 'Houve perda de eventos neste período: 3 eventos da aplicação API às 14:32, motivo “fila cheia”.';
const controleReprovou = !/2 eventos da aplicação API às 14:31, motivo “fila cheia”/.test(textoContraditorio);
const contaErrada = { numerouAte: 100, recebidos: 90, faltando: 12 };
const controleDaContaReprovou = contaErrada.numerouAte - contaErrada.recebidos !== contaErrada.faltando;
dizer(`CONTROLE NEGATIVO (aviso plantado com 3 eventos às 14:32; conta plantada 100 − 90 = 12): ${controleReprovou && controleDaContaReprovou ? 'REPROVADOS como deviam' : 'NÃO REPROVOU'}`);
dizer(`CONTROLE POSITIVO (aviso aprovado, lido da tentativa R-1042): conferido logo abaixo\n`);
if (!(controleReprovou && controleDaContaReprovou)) { fechar(); process.exit(2); }

// ---------- Os avisos aprovados do lote Investigar ----------
const tentativa = await textoDaTela(`${INVESTIGADOR}/tentativas/reservationId/R-1042`);
conferir(/2 eventos da aplicação API às 14:31, motivo “fila cheia”/.test(tentativa), 'tentativa R-1042 mantém o aviso aprovado "2 eventos da aplicação API às 14:31, motivo fila cheia"', trecho(tentativa, /Houve perda/));
conferir(/pode ter perdido mais depois de 14:52/.test(tentativa), 'tentativa R-1042 mantém "pode ter perdido mais depois de 14:52"');
const busca = await textoDaTela(`${INVESTIGADOR}/eventos/p=1h;f=reservationId:e:R-1042`);
conferir(/Dados até 14:58:41/.test(busca), 'busca mantém "Dados até 14:58:41"');
await clicar(`[...document.querySelectorAll('[role="button"]')].find((elemento) => elemento.textContent.trim().startsWith('Adicionar filtro'))`, 'adicionar filtro');
const filtro = (await avaliar('document.querySelector("#root").innerText')).replace(/\s+/g, ' ');
conferir(/amountCents[^a-zA-Z]{0,40}.{0,80}rápido desde 14:00/.test(filtro), 'filtro da busca mantém amountCents "rápido desde 14:00"', trecho(filtro, /amountCents/, 0, 110));

// ---------- Saúde do envio contra os avisos ----------
const saudeDaApi = await textoDaTela(`${INVESTIGADOR}/saude/24h/api`);
conferir(/14:31:07 api-7f3c 2 fila cheia/.test(saudeDaApi), 'saúde (API, 24 h) lista a perda das 14:31: 2 eventos, fila cheia, execução api-7f3c', trecho(saudeDaApi, /14:31:07/, 0, 60));
conferir(/Dados até.{0,40}14:58:41/.test(saudeDaApi), 'saúde mostra o mesmo "Dados até 14:58:41"', trecho(saudeDaApi, /Dados até/, 0, 60));
const saudeDosWebhooks = await textoDaTela(`${ADMINISTRADOR}/saude/24h/webhooks`);
conferir(/pode ter perdido mais depois de 14:52/.test(saudeDosWebhooks) && /webhooks-c44a/.test(saudeDosWebhooks) && /14:52:10/.test(saudeDosWebhooks), 'saúde (Webhooks) diz a mesma execução webhooks-c44a, o mesmo 14:52 e a mesma frase', trecho(saudeDosWebhooks, /Ela parou/, 0, 140));
conferir(!/pode ter perdido mais depois de 14:52[^.]{0,30}\d+ eventos/.test(saudeDosWebhooks) && /não tem número/.test(saudeDosWebhooks), 'a perda depois de 14:52 é sinalizada sem número');
const saudeNaUltimaHora = await textoDaTela(`${INVESTIGADOR}/saude/1h/api`);
conferir(/ 2 · fila cheia/.test(saudeNaUltimaHora) && /mais 120 perdas/.test(saudeNaUltimaHora), 'saúde (API, última hora): 2 perdas no período e "mais 120" fora dele, como o aviso da busca de 1 h', trecho(saudeNaUltimaHora, /Fora deste período/, 0, 70));

// ---------- A conta de eventos faltando fecha, lida da tela ----------
const lerContas = `(() => {
  const tabela = [...document.querySelectorAll('table')].find((candidata) => (candidata.getAttribute('aria-label') || '').startsWith('Execuções'));
  if (!tabela) return [];
  return [...tabela.querySelectorAll('tbody tr')].map((linhaDaTabela) => [...linhaDaTabela.children].map((celula) => celula.innerText.replace(/\\s+/g, ' ').trim()));
})()`;
for (const [nomeDaAplicacao, rota, faltandoEsperado, comMotivoEsperado, desconhecidoEsperado] of [['API', `${INVESTIGADOR}/saude/24h/api`, 152, 122, 30], ['Webhooks', `${ADMINISTRADOR}/saude/24h/webhooks`, 40, 0, 40], ['Site', `${INVESTIGADOR}/saude/24h/site`, 0, 0, 0]]) {
  const texto = await textoDaTela(rota);
  const execucoes = await avaliar(lerContas);
  let faltandoSomado = 0; let cadaLinhaFecha = true; const contasLidas = [];
  for (const celulas of execucoes) {
    const numerouAte = numeroDe(celulas[4]); const recebidos = numeroDe(celulas[5]); const faltandoNaLinha = celulas[6] === 'nada faltando' ? 0 : numeroDe(celulas[6]);
    if (numerouAte - recebidos !== faltandoNaLinha) cadaLinhaFecha = false;
    faltandoSomado += faltandoNaLinha; contasLidas.push(`${celulas[0]}: ${celulas[4]} − ${celulas[5]} = ${faltandoNaLinha}`);
  }
  conferir(cadaLinhaFecha && faltandoSomado === faltandoEsperado, `${nomeDaAplicacao}: "numerou até" − "servidor recebeu" = "faltando" em cada execução, e a soma dá ${faltandoEsperado}`, contasLidas.join(' ; '));
  if (faltandoEsperado > 0) {
    const perdasInformadas = [...texto.matchAll(/\d{2}:\d{2}:\d{2} [a-z]+-[0-9a-f]{4} ([\d.]+) [a-zà-ú ]+ Ver eventos em volta/g)].reduce((somaDasPerdas, achado) => somaDasPerdas + numeroDe(achado[1]), 0);
    conferir(perdasInformadas === comMotivoEsperado && comMotivoEsperado + desconhecidoEsperado === faltandoEsperado && new RegExp(`${desconhecidoEsperado}: nenhuma perda informada explica`).test(texto), `${nomeDaAplicacao}: perdas informadas (${perdasInformadas}) + motivo desconhecido (${desconhecidoEsperado}) = faltando (${faltandoEsperado})`, trecho(texto, /Faltando na numeração/, 0, 150));
  }
}

// ---------- A rotina "eventos em volta da perda" ----------
const emVolta = await textoDaTela(`${INVESTIGADOR}/eventos/p=i.202611271426.202611271436;f=aplicacao:e:API`);
conferir(/27\/11\/2026 14:26/.test(emVolta) && /14:36/.test(emVolta) && /aplicação é API|aplicacao é API|aplicação = API/i.test(emVolta), 'busca "em volta da perda": período 14:26–14:36 e filtro da aplicação API', trecho(emVolta, /14:26/, 30, 90));
observar(/perda|perdid/i.test(emVolta), 'busca "em volta da perda" diz que houve perda às 14:31 naquele período (quem chega da saúde vê por que está ali)', trecho(emVolta, /perd/i));

// ---------- Aplicações contra a saúde ----------
const aplicacoes = await textoDaTela(`${ADMINISTRADOR}/aplicacoes`);
for (const [apelido, horario] of [['servidor da API', '14:59'], ['servidor novo', '14:59'], ['servidor dos webhooks', '14:59']]) conferir(new RegExp(`${apelido}.{0,120}27/11/2026 ${horario}`).test(aplicacoes), `aplicações: último envio da chave "${apelido}" é de hoje às ${horario}, como o "último envio" da saúde`, trecho(aplicacoes, new RegExp(apelido), 0, 110));
const saudeDeHomologacao = await textoDaTela('#/painel/excurfly/homologacao/investigador/saude');
const aplicacoesDeHomologacao = await textoDaTela(`${HOMOLOGACAO}/aplicacoes`);
conferir(/Site.{0,40}nunca enviou/.test(saudeDeHomologacao) && /ainda não enviou/.test(aplicacoesDeHomologacao), 'homologação: o Site "nunca enviou" na saúde e a chave dele "ainda não enviou" nas aplicações', trecho(saudeDeHomologacao, /Site/, 0, 60));

// ---------- O que a rotina faz e as outras telas ----------
const catalogoDeclarado = await textoDaTela(`${ADMINISTRADOR}/catalogo/installmentCount/declarado/numero.exata-intervalo.nenhum`);
conferir(/installmentCount declarado: rápido desde 15:00/.test(catalogoDeclarado) && /amountCents.{0,80}rápido desde 14:00/.test(catalogoDeclarado), 'catálogo depois de declarar: installmentCount "rápido desde 15:00" e amountCents "rápido desde 14:00"');
const naoDeclaradosAntes = Number((await textoDaTela(`${ADMINISTRADOR}/catalogo`)).match(/Campos não declarados (\d+)/)?.[1] ?? NaN);
const naoDeclaradosDepois = Number(catalogoDeclarado.match(/Campos não declarados (\d+)/)?.[1] ?? NaN);
conferir(naoDeclaradosAntes - naoDeclaradosDepois === 1, `declarar tira um campo dos não declarados (${naoDeclaradosAntes} → ${naoDeclaradosDepois})`);
// Depois de declarar, na mesma página (sem recarregar), o Investigador e o filtro da busca enxergam o campo declarado?
await clicar(`[...document.querySelectorAll('[role="radio"]')].find((elemento) => elemento.textContent.trim() === 'Investigador')`, 'trocar para Investigador');
const catalogoDoInvestigador = (await avaliar('document.querySelector("#root").innerText')).replace(/\s+/g, ' ');
observar(/installmentCount.{0,60}rápido desde 15:00/.test(catalogoDoInvestigador), 'depois de declarar installmentCount, o catálogo do Investigador (mesma página, sem recarregar) o mostra declarado', `${await avaliar('location.hash')} · ${trecho(catalogoDoInvestigador, /installmentCount/, 0, 90)}`);
await avaliar(`(location.hash = '${INVESTIGADOR}/eventos/p=1h;f=reservationId:e:R-1042', true)`); await new Promise((resolver) => setTimeout(resolver, 700));
await clicar(`[...document.querySelectorAll('[role="button"]')].find((elemento) => elemento.textContent.trim().startsWith('Adicionar filtro'))`, 'adicionar filtro');
const filtroDepoisDeDeclarar = (await avaliar('document.querySelector("#root").innerText')).replace(/\s+/g, ' ');
observar(/installmentCount.{0,60}rápido desde 15:00/.test(filtroDepoisDeDeclarar), 'depois de declarar installmentCount, o "Adicionar filtro" da busca o oferece como campo declarado', trecho(filtroDepoisDeDeclarar, /installmentCount/, 0, 90));
// Depois de cadastrar a API de parceiros, a saúde do envio a lista (como "nunca enviou")?
await abrir(`/?visao=painel&superficie=desktop&tema=light&estado=default&print=1&idioma=pt-BR${ADMINISTRADOR}/aplicacoes/api-de-parceiros/chaves/ex7a`);
await clicar(`[...document.querySelectorAll('#root nav [role="button"], #root aside [role="button"], #root [role="button"]')].find((elemento) => elemento.textContent.trim() === 'Saúde do envio')`, 'menu saúde');
const saudeDepoisDoCadastro = (await avaliar('document.querySelector("#root").innerText')).replace(/\s+/g, ' ');
observar(/API de parceiros/.test(saudeDepoisDoCadastro), 'depois de cadastrar a API de parceiros, a saúde do envio (mesma página) a lista entre as aplicações', `${await avaliar('location.hash')} · aplicações na saúde: ${trecho(saudeDepoisDoCadastro, /Aplicações \d/, 0, 30)}`);

dizer(`\nfalhas: ${falhas} · avisos: ${avisos}`);
writeFileSync(`${PASTA}coerencia-${rodada}.txt`, linhas.join('\n') + '\n');
fechar();
