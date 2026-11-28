import { For, Show, createEffect, createSignal, on } from "solid-js";
import { useParams } from "@solidjs/router";
import { registrarMedida } from "./medida.js";

const PREFIXO_DA_APLICACAO = "\tat br.com.exemplo.";

export function PainelDoEvento(propriedades) {
  const parametrosDaRota = useParams();
  const [eventoAberto, definirEventoAberto] = createSignal(null);

  createEffect(
    on(
      () => parametrosDaRota.identificadorDoEvento,
      async (identificadorDoEvento) => {
        if (!identificadorDoEvento) return;
        const resposta = await fetch(`/dados/evento${propriedades.sufixoDoControle}.json`);
        const corpoDaResposta = await resposta.text();
        const instanteDosDados = performance.now();
        definirEventoAberto(JSON.parse(corpoDaResposta));
        registrarMedida("evento", instanteDosDados);
      },
    ),
  );

  return (
    <aside class="painel-do-evento">
      <Show when={eventoAberto()} fallback={<p>Carregando o evento…</p>}>
        {(evento) => (
          <>
            <h2>
              <span class={`nivel nivel-${evento().nivel.toLowerCase()}`}>{evento().nivel}</span> {evento().aplicacao}
            </h2>
            <p class="rota">{evento().rota}</p>
            <p class="mensagem-inteira">{evento().mensagem}</p>
            <dl class="atributos">
              <For each={Object.entries(evento().atributos)}>
                {([nomeDoAtributo, valorDoAtributo]) => (
                  <>
                    <dt>{nomeDoAtributo}</dt>
                    <dd>{valorDoAtributo}</dd>
                  </>
                )}
              </For>
            </dl>
            <pre class="stack-trace">
              <For each={evento().stackTrace.split("\n")}>
                {(linhaDoStack) => (
                  <span
                    class="linha-do-stack"
                    classList={{
                      "da-aplicacao": linhaDoStack.startsWith(PREFIXO_DA_APLICACAO),
                      causa: linhaDoStack.startsWith("Caused by"),
                    }}
                  >
                    {linhaDoStack}
                    {"\n"}
                  </span>
                )}
              </For>
            </pre>
          </>
        )}
      </Show>
    </aside>
  );
}
