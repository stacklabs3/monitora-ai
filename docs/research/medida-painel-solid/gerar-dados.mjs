// Gera os dados sintéticos da medida: nada de log real, dado pessoal ou segredo.
// Mesma semente, mesmos dados: a medida se repete.
import { mkdirSync, writeFileSync } from "node:fs";

const EVENTOS_POR_PAGINA = 100;
const EVENTOS_DO_CONTROLE = 5000;
const LINHAS_DO_STACK_LONGO = 400;
const LINHAS_DO_STACK_DO_CONTROLE = 20000;
const ATRIBUTOS_DO_EVENTO_LONGO = 40;
export const IDENTIFICADOR_DO_EVENTO_LONGO = "evento-longo";

function criarSorteio(semente) {
  let estado = semente;
  return function sortear() {
    estado = (estado + 0x6d2b79f5) | 0;
    let misturado = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    misturado = (misturado + Math.imul(misturado ^ (misturado >>> 7), 61 | misturado)) ^ misturado;
    return ((misturado ^ (misturado >>> 14)) >>> 0) / 4294967296;
  };
}

const sortear = criarSorteio(1042);
const escolher = (opcoes) => opcoes[Math.floor(sortear() * opcoes.length)];

const NIVEIS = ["INFO", "INFO", "INFO", "WARN", "ERROR"];
const APLICACOES = ["reservas-api", "pagamentos-api", "notificacoes-worker", "catalogo-api"];
const ROTAS = [
  "POST /reservas",
  "GET /reservas/:codigo",
  "POST /pagamentos/:codigo/confirmar",
  "PUT /reservas/:codigo/passageiros",
  "POST /notificacoes/reserva-confirmada",
];
const MENSAGENS = [
  "Reserva R-1042 recebida para a viagem V-88 com 3 passageiros",
  "Pagamento da reserva R-1042 enviado ao provedor, aguardando confirmação",
  "Tentativa 2 de confirmar o pagamento da reserva R-1042 depois de tempo esgotado",
  "Falha ao confirmar a reserva R-1042: o provedor de pagamento respondeu 502",
  "Passageiros da reserva R-1042 atualizados pelo operador da conta-7",
  "Notificação de reserva confirmada enfileirada para a reserva R-1042",
];

function criarResumoDoEvento(posicao) {
  const instante = new Date(Date.UTC(2026, 10, 27, 12, 0, 0) - posicao * 1375);
  return {
    identificador: `evento-${String(posicao).padStart(5, "0")}`,
    instante: instante.toISOString(),
    nivel: escolher(NIVEIS),
    aplicacao: escolher(APLICACOES),
    rota: escolher(ROTAS),
    mensagem: escolher(MENSAGENS),
    reserva: "R-1042",
    conta: "conta-7",
    execucao: `exec-${Math.floor(sortear() * 9000 + 1000)}`,
  };
}

function criarPaginaDaBusca(quantidadeDeEventos) {
  const eventos = Array.from({ length: quantidadeDeEventos }, (_, posicao) => criarResumoDoEvento(posicao));
  eventos[3] = {
    ...eventos[3],
    identificador: IDENTIFICADOR_DO_EVENTO_LONGO,
    nivel: "ERROR",
    mensagem: MENSAGENS[3],
  };
  return { total: 5000, eventos };
}

const PACOTES_DE_TERCEIROS = [
  "org.springframework.web.servlet.DispatcherServlet",
  "org.springframework.transaction.interceptor.TransactionInterceptor",
  "org.apache.catalina.core.ApplicationFilterChain",
  "org.hibernate.engine.jdbc.internal.ResultSetReturnImpl",
  "reactor.core.publisher.MonoFlatMap$FlatMapMain",
  "io.netty.channel.AbstractChannelHandlerContext",
];
const CLASSES_DA_APLICACAO = [
  "br.com.exemplo.reservas.ConfirmacaoDeReservaService",
  "br.com.exemplo.reservas.ReservaController",
  "br.com.exemplo.pagamentos.ClienteDoProvedorDePagamento",
  "br.com.exemplo.reservas.RepositorioDeReservas",
];

function criarStackTrace(quantidadeDeLinhas) {
  const linhas = ["br.com.exemplo.pagamentos.PagamentoNaoConfirmadoException: o provedor respondeu 502 para a reserva R-1042"];
  while (linhas.length < quantidadeDeLinhas) {
    if (linhas.length % 97 === 0) {
      linhas.push("Caused by: java.net.http.HttpTimeoutException: request timed out after 5000 ms calling the payment provider");
      continue;
    }
    const classe = sortear() < 0.2 ? escolher(CLASSES_DA_APLICACAO) : escolher(PACOTES_DE_TERCEIROS);
    const nomeDoArquivo = classe.split(".").pop().split("$")[0];
    linhas.push(`\tat ${classe}.invoke(${nomeDoArquivo}.java:${Math.floor(sortear() * 900 + 10)})`);
  }
  return linhas.join("\n");
}

function criarEventoLongo(quantidadeDeLinhasDoStack) {
  const atributos = {};
  for (let numeroDoAtributo = 1; numeroDoAtributo <= ATRIBUTOS_DO_EVENTO_LONGO; numeroDoAtributo += 1) {
    atributos[`atributo.sintetico.${numeroDoAtributo}`] = `valor-${Math.floor(sortear() * 1e9).toString(36)}`;
  }
  return {
    ...criarResumoDoEvento(3),
    identificador: IDENTIFICADOR_DO_EVENTO_LONGO,
    nivel: "ERROR",
    mensagem: `${MENSAGENS[3]}. ${"Resposta do provedor repetida no corpo do erro para simular mensagem longa. ".repeat(25)}`,
    atributos,
    stackTrace: criarStackTrace(quantidadeDeLinhasDoStack),
  };
}

mkdirSync("public/dados", { recursive: true });
writeFileSync("public/dados/busca.json", JSON.stringify(criarPaginaDaBusca(EVENTOS_POR_PAGINA)));
writeFileSync("public/dados/busca-controle.json", JSON.stringify(criarPaginaDaBusca(EVENTOS_DO_CONTROLE)));
writeFileSync("public/dados/evento.json", JSON.stringify(criarEventoLongo(LINHAS_DO_STACK_LONGO)));
writeFileSync("public/dados/evento-controle.json", JSON.stringify(criarEventoLongo(LINHAS_DO_STACK_DO_CONTROLE)));
