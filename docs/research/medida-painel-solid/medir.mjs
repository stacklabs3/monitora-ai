// Mede o desenho da página de 100 eventos e a abertura de um evento longo no Chrome, com a CPU mais
// lenta pelo DevTools (Emulation.setCPUThrottlingRate), e prova a falha (RP1) com dois controles:
// a carga fixa mostra que a lentidão foi aplicada, e o cenário de controle (5.000 eventos numa tela
// só e stack trace de 20.000 linhas) precisa reprovar no mesmo medidor.
import { createServer } from "node:http";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { extname, join } from "node:path";
import puppeteer from "puppeteer-core";

const PASTA_DO_BUILD = "dist";
const CAMINHO_DO_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const LIMITE_MS = 100;
const LENTIDAO_DA_CONDICAO = 4;
const LENTIDOES_MEDIDAS = [1, 4, 8, 16];
const REPETICOES_DO_FLUXO_REAL = 30;
const REPETICOES_DO_CONTROLE = 5;
const TIPO_POR_EXTENSAO = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function iniciarServidorEstatico() {
  const servidor = createServer((requisicao, resposta) => {
    const caminhoPedido = new URL(requisicao.url, "http://localhost").pathname;
    const caminhoDoArquivo = join(PASTA_DO_BUILD, caminhoPedido);
    const arquivoExiste = extname(caminhoPedido) !== "" && existsSync(caminhoDoArquivo);
    const caminhoServido = arquivoExiste ? caminhoDoArquivo : join(PASTA_DO_BUILD, "index.html");
    const corpoComprimido = gzipSync(readFileSync(caminhoServido));
    resposta.writeHead(200, {
      "content-type": TIPO_POR_EXTENSAO[extname(caminhoServido)] ?? "application/octet-stream",
      "content-encoding": "gzip",
      "cache-control": "no-store",
    });
    resposta.end(corpoComprimido);
  });
  return new Promise((resolver) => servidor.listen(0, "127.0.0.1", () => resolver(servidor)));
}

function resumir(duracoesMs) {
  const ordenadas = [...duracoesMs].sort((menor, maior) => menor - maior);
  const posicaoDoP95 = Math.min(ordenadas.length - 1, Math.ceil(ordenadas.length * 0.95) - 1);
  const arredondar = (duracaoMs) => Math.round(duracaoMs * 10) / 10;
  return {
    amostras: ordenadas.length,
    minimo: arredondar(ordenadas[0]),
    mediana: arredondar(ordenadas[Math.floor(ordenadas.length / 2)]),
    p95: arredondar(ordenadas[posicaoDoP95]),
    maximo: arredondar(ordenadas.at(-1)),
  };
}

async function esperarMedida(pagina, nomeDaMedida) {
  await pagina.waitForFunction(
    (nomeEsperado) => window.medidasDoPainel.some((medida) => medida.nome === nomeEsperado),
    { timeout: 120_000 },
    nomeDaMedida,
  );
  return pagina.evaluate(
    (nomeEsperado) => window.medidasDoPainel.find((medida) => medida.nome === nomeEsperado),
    nomeDaMedida,
  );
}

async function rodarFluxo(navegador, enderecoDoServidor, lentidao, cenarioDeControle) {
  const pagina = await navegador.newPage();
  await pagina.setViewport({ width: 1366, height: 768 });
  const sessaoDoDevTools = await pagina.createCDPSession();
  await sessaoDoDevTools.send("Network.enable");
  let bytesDeJsTransferidos = 0;
  const pedidosDeJs = new Set();
  sessaoDoDevTools.on("Network.responseReceived", (aviso) => {
    if (aviso.response.mimeType.includes("javascript")) pedidosDeJs.add(aviso.requestId);
  });
  sessaoDoDevTools.on("Network.loadingFinished", (aviso) => {
    if (pedidosDeJs.has(aviso.requestId)) bytesDeJsTransferidos += aviso.encodedDataLength;
  });

  await pagina.goto(`${enderecoDoServidor}/busca${cenarioDeControle ? "?controle=1" : ""}`, { waitUntil: "networkidle0" });
  await sessaoDoDevTools.send("Emulation.setCPUThrottlingRate", { rate: lentidao });
  const cargaFixa = await pagina.evaluate(() => window.rodarCargaFixa());

  await pagina.type("input[name=texto]", "R-1042");
  await pagina.click("button[type=submit]");
  const medidaDaPagina = await esperarMedida(pagina, "pagina");
  const eventosDesenhados = await pagina.$$eval("li.evento", (linhas) => linhas.length);

  await pagina.click("li.evento[data-identificador=evento-longo]");
  const medidaDoEvento = await esperarMedida(pagina, "evento");
  const linhasDoStackDesenhadas = await pagina.$$eval(".linha-do-stack", (linhas) => linhas.length);
  const alturaDoStack = await pagina.$eval(".stack-trace", (bloco) => bloco.scrollHeight);
  const enderecoFinal = pagina.url();

  await pagina.close();
  return {
    cargaFixaMs: cargaFixa.duracaoMs,
    medidaDaPagina,
    medidaDoEvento,
    eventosDesenhados,
    linhasDoStackDesenhadas,
    alturaDoStack,
    enderecoFinal,
    bytesDeJsTransferidos,
  };
}

async function medirCenario(navegador, enderecoDoServidor, lentidao, cenarioDeControle) {
  const repeticoes = cenarioDeControle ? REPETICOES_DO_CONTROLE : REPETICOES_DO_FLUXO_REAL;
  const fluxos = [];
  for (let numeroDaRepeticao = 0; numeroDaRepeticao < repeticoes; numeroDaRepeticao += 1) {
    fluxos.push(await rodarFluxo(navegador, enderecoDoServidor, lentidao, cenarioDeControle));
  }
  return {
    lentidao,
    cenario: cenarioDeControle ? "controle" : "real",
    eventosDesenhados: fluxos[0].eventosDesenhados,
    linhasDoStackDesenhadas: fluxos[0].linhasDoStackDesenhadas,
    alturaDoStackPx: fluxos[0].alturaDoStack,
    enderecoFinal: fluxos[0].enderecoFinal.replace(enderecoDoServidor, ""),
    bytesDeJsTransferidos: fluxos[0].bytesDeJsTransferidos,
    cargaFixaMs: resumir(fluxos.map((fluxo) => fluxo.cargaFixaMs)),
    paginaDosDadosMs: resumir(fluxos.map((fluxo) => fluxo.medidaDaPagina.dosDadosMs)),
    paginaDoCliqueMs: resumir(fluxos.map((fluxo) => fluxo.medidaDaPagina.doCliqueMs)),
    eventoDosDadosMs: resumir(fluxos.map((fluxo) => fluxo.medidaDoEvento.dosDadosMs)),
    eventoDoCliqueMs: resumir(fluxos.map((fluxo) => fluxo.medidaDoEvento.doCliqueMs)),
  };
}

const servidor = await iniciarServidorEstatico();
const enderecoDoServidor = `http://127.0.0.1:${servidor.address().port}`;
const navegador = await puppeteer.launch({ executablePath: CAMINHO_DO_CHROME, headless: true });
const versaoDoChrome = await navegador.version();

const cenarios = [];
for (const lentidao of LENTIDOES_MEDIDAS) {
  cenarios.push(await medirCenario(navegador, enderecoDoServidor, lentidao, false));
}
cenarios.push(await medirCenario(navegador, enderecoDoServidor, LENTIDAO_DA_CONDICAO, true));
await navegador.close();
servidor.close();

const cenarioPor = (lentidao, nomeDoCenario) =>
  cenarios.find((cenario) => cenario.lentidao === lentidao && cenario.cenario === nomeDoCenario);
const realSemLentidao = cenarioPor(1, "real");
const realNaCondicao = cenarioPor(LENTIDAO_DA_CONDICAO, "real");
const controleNaCondicao = cenarioPor(LENTIDAO_DA_CONDICAO, "controle");
const fatorDeLentidaoMedido = realNaCondicao.cargaFixaMs.mediana / realSemLentidao.cargaFixaMs.mediana;

const conferencias = {
  lentidaoAplicada: fatorDeLentidaoMedido >= LENTIDAO_DA_CONDICAO * 0.75,
  fluxoRealDesenhouOEsperado: realNaCondicao.eventosDesenhados === 100 && realNaCondicao.linhasDoStackDesenhadas === 400,
  controleDesenhouOEsperado: controleNaCondicao.eventosDesenhados === 5000 && controleNaCondicao.linhasDoStackDesenhadas === 20000,
  controleReprovouNaPagina: controleNaCondicao.paginaDosDadosMs.minimo > LIMITE_MS,
  controleReprovouNoEvento: controleNaCondicao.eventoDosDadosMs.minimo > LIMITE_MS,
  paginaDentroDoLimite: realNaCondicao.paginaDosDadosMs.maximo <= LIMITE_MS,
  eventoDentroDoLimite: realNaCondicao.eventoDosDadosMs.maximo <= LIMITE_MS,
};
const medidaValida =
  conferencias.lentidaoAplicada &&
  conferencias.fluxoRealDesenhouOEsperado &&
  conferencias.controleDesenhouOEsperado &&
  conferencias.controleReprovouNaPagina &&
  conferencias.controleReprovouNoEvento;
const veredito = !medidaValida
  ? "INVÁLIDA"
  : conferencias.paginaDentroDoLimite && conferencias.eventoDentroDoLimite
    ? "APROVADA"
    : "REPROVADA";

const resultado = { versaoDoChrome, limiteMs: LIMITE_MS, fatorDeLentidaoMedido, conferencias, veredito, cenarios };
writeFileSync("resultados.json", `${JSON.stringify(resultado, null, 2)}\n`);

console.log(`Chrome: ${versaoDoChrome} · lentidão medida a 4x: ${fatorDeLentidaoMedido.toFixed(2)}x`);
console.table(
  cenarios.map((cenario) => ({
    cenario: `${cenario.cenario} ${cenario.lentidao}x`,
    eventos: cenario.eventosDesenhados,
    "página mediana": cenario.paginaDosDadosMs.mediana,
    "página máx": cenario.paginaDosDadosMs.maximo,
    "página clique máx": cenario.paginaDoCliqueMs.maximo,
    "evento mediana": cenario.eventoDosDadosMs.mediana,
    "evento máx": cenario.eventoDosDadosMs.maximo,
    "evento clique máx": cenario.eventoDoCliqueMs.maximo,
    "JS bytes": cenario.bytesDeJsTransferidos,
  })),
);
console.log(conferencias);
console.log(`Veredito: ${veredito}`);
process.exit(veredito === "APROVADA" ? 0 : 1);
