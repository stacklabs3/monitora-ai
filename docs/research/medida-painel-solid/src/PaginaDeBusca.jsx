import { For, Show, createEffect, createSignal, on } from "solid-js";
import { useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { marcarClique, registrarMedida } from "./medida.js";
import { PainelDoEvento } from "./PainelDoEvento.jsx";

const formatadorDeHora = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  fractionalSecondDigits: 3,
  timeZone: "America/Sao_Paulo",
});

export function PaginaDeBusca() {
  const parametrosDaRota = useParams();
  const [parametrosDaBusca, definirParametrosDaBusca] = useSearchParams();
  const navegar = useNavigate();
  const [paginaDeEventos, definirPaginaDeEventos] = createSignal(null);
  let campoDeTexto;

  const sufixoDoControle = () => (parametrosDaBusca.controle === "1" ? "-controle" : "");

  createEffect(
    on(
      () => parametrosDaBusca.texto,
      async (textoBuscado) => {
        if (!textoBuscado) return;
        const resposta = await fetch(`/dados/busca${sufixoDoControle()}.json`);
        const corpoDaResposta = await resposta.text();
        const instanteDosDados = performance.now();
        definirPaginaDeEventos(JSON.parse(corpoDaResposta));
        registrarMedida("pagina", instanteDosDados);
      },
    ),
  );

  function buscar(eventoDoFormulario) {
    eventoDoFormulario.preventDefault();
    marcarClique("pagina", eventoDoFormulario.timeStamp);
    definirParametrosDaBusca({ texto: campoDeTexto.value });
  }

  function abrirEvento(eventoDoClique, identificadorDoEvento) {
    marcarClique("evento", eventoDoClique.timeStamp);
    navegar(`/busca/${identificadorDoEvento}${window.location.search}`);
  }

  return (
    <div class="investigacao">
      <header class="cabecalho">
        <strong>Monitora AI</strong>
        <span>conta-7 · produto de reservas</span>
      </header>
      <form class="busca" onSubmit={buscar}>
        <input ref={campoDeTexto} name="texto" placeholder="Código de busca, reserva ou texto" />
        <button type="submit">Buscar</button>
      </form>
      <Show when={paginaDeEventos()}>
        {(pagina) => (
          <>
            <p class="resumo">
              {pagina().eventos.length} de {pagina().total} eventos para <b>{parametrosDaBusca.texto}</b>
            </p>
            <ol class="eventos">
              <For each={pagina().eventos}>
                {(evento) => (
                  <li
                    class="evento"
                    classList={{ aberto: parametrosDaRota.identificadorDoEvento === evento.identificador }}
                    data-identificador={evento.identificador}
                    onClick={(eventoDoClique) => abrirEvento(eventoDoClique, evento.identificador)}
                  >
                    <time dateTime={evento.instante}>{formatadorDeHora.format(new Date(evento.instante))}</time>
                    <span class={`nivel nivel-${evento.nivel.toLowerCase()}`}>{evento.nivel}</span>
                    <span class="aplicacao">{evento.aplicacao}</span>
                    <span class="rota">{evento.rota}</span>
                    <span class="mensagem">{evento.mensagem}</span>
                    <span class="correlacao">
                      {evento.reserva} · {evento.conta} · {evento.execucao}
                    </span>
                  </li>
                )}
              </For>
            </ol>
          </>
        )}
      </Show>
      <Show when={parametrosDaRota.identificadorDoEvento}>
        <PainelDoEvento sufixoDoControle={sufixoDoControle()} />
      </Show>
    </div>
  );
}
