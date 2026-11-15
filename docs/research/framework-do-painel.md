# Pesquisa: framework do painel de investigação

Ticket: [Pesquisar frameworks do painel](https://github.com/stacklabs3/monitora-ai/issues/23). Consulta a fontes primárias em 15/11/2026. Parte de [painel-e-aws.md](https://github.com/stacklabs3/monitora-ai/blob/research/painel-aws/docs/pesquisas/painel-e-aws.md).

Compara Angular, React, Svelte e Solid pelo critério do humano: **rápido de execução e baixo custo de hospedagem**. Solid entra porque aparece junto dos três no mesmo benchmark público e lidera o grupo nele. Esta pesquisa compara e não escolhe.

## Resumo

- Os quatro têm licença MIT e geram um SPA de arquivos estáticos. Por isso o custo de hospedagem (bucket + CDN) não diferencia os candidatos. O que muda é o peso do JS transferido por visita.
- No js-framework-benchmark (Chrome 156, implementações keyed), Svelte e Solid ficam perto do JS puro. Angular e React ficam atrás, mas em operações diferentes: o React é bem mais lento na troca de linhas (`swap`), e o Angular na criação de 1.000 linhas e na primeira pintura.
- Lista longa: o Angular CDK virtualiza nativamente só itens de **altura fixa**. Para altura variável, a estratégia oficial ainda é experimental. O TanStack Virtual (MIT) mede itens de altura variável e tem adaptadores para os quatro.
- Maturidade e governança: Angular (equipe do Google, lançamento anual, 24 meses de suporte) e React (React Foundation, Linux Foundation) têm o respaldo institucional mais forte. Svelte e Solid são mantidos por voluntários e financiados pelo Open Collective.

## Tabela comparativa

| | Angular | React | Svelte | Solid |
|---|---|---|---|---|
| Versão atual (npm) | `@angular/core` 22.2.6, de 12/11/2026 [1] | `react` 19.3.1, de 14/10/2026 [1] | `svelte` 5.57.3, de 26/10/2026 [1] | `solid-js` 1.9.19, de 10/11/2026 [1] |
| Licença | MIT [1] | MIT [1] | MIT [1][9] | MIT [1] |
| Quem mantém | Equipe Angular; o site informa "Super-powered by Google" [2] | React Foundation, na Linux Foundation; governança técnica independente do conselho [3] | Voluntários, com Open Collective [9] | Comunidade, com Open Collective e patrocinadores [10] |
| Política de versões | Uma versão maior a cada 12 meses, com 12 meses de suporte ativo e 12 de LTS [2] | Sem política de LTS publicada nas páginas consultadas [confirmar] | Sem política de LTS publicada nas páginas consultadas [confirmar] | Sem política de LTS publicada nas páginas consultadas [confirmar] |
| Virtualização nativa | CDK `cdk-virtual-scroll-viewport`; estratégia de tamanho fixo; autosize em `cdk-experimental` "not ready for production" [4] | Nenhuma no núcleo; TanStack Virtual [5] | Nenhuma no núcleo; TanStack Virtual [5] | Nenhuma no núcleo; TanStack Virtual [5] |
| Saída estática | Sim: `dist/<app>/browser/` em servidor estático ou CDN, com fallback para `index.html` [6] | Sim: SPA com Vite, Parcel ou Rsbuild [7]; `dist` em qualquer host estático [8] | Sim: SvelteKit `adapter-static` ou Vite [8][11] | Sim: Vite gera `dist` estático [8] |

## Desempenho de execução (benchmark de terceiros)

Fonte: js-framework-benchmark de Stefan Krause, relatório oficial **Chrome 156.0.8078.48**, modo keyed [12]. Metodologia [13]: tabela com linhas aleatórias, tempo **incluindo renderização**, medido pela timeline do Chrome via WebDriver; as operações de criação e limpeza rodam sem aquecimento e as demais com 5 aquecimentos. A própria página avisa que o benchmark cobre cargas específicas e "does not establish a universally fastest framework" [14].

Os valores abaixo são as **medianas que calculei** a partir das amostras publicadas no relatório (tempo em ms, memória em MB, tamanho em KB). As versões medidas não são as atuais: Angular 22.2.2, React 19.2.0, Svelte 5.42.1, Solid 1.9.3.

| Operação | JS puro | Solid | Svelte | Angular (`cf`) | Angular (signals, sem zone) | React (hooks) |
|---|---|---|---|---|---|---|
| Criar 1.000 linhas | 19,8 | 21,4 | 21,8 | 33,8 | 32,9 | 24,7 |
| Criar 10.000 linhas | 207,2 | 225,9 | 228,8 | 297,7 | 289,4 | 344,6 |
| Atualizar 1 a cada 10 linhas | 9,5 | 10,4 | 10,8 | 11,2 | 11,3 | 14,4 |
| Selecionar linha | 2,5 | 3,2 | 5,0 | 5,9 | 6,4 | 5,5 |
| Trocar 2 linhas (`swap`) | 11,0 | 12,5 | 12,9 | 13,6 | 14,3 | 86,9 |
| Limpar 1.000 linhas | 7,8 | 10,4 | 10,4 | 17,4 | 14,7 | 16,9 |
| Memória após criar 1.000 linhas | 1,9 | 2,7 | 2,9 | 4,5 | 3,6 | 4,4 |
| JS comprimido (brotli) | 2,5 | 4,5 | 9,7 | 44,7 | 33,8 | 51,4 |
| Primeira pintura (ms) | 40,7 | 53,5 | 65,5 | 166,2 | 128,0 | 228,1 |

Leitura dos números:

- O tamanho em KB é o do app mínimo do benchmark, não o do painel. Mostra o custo-base do runtime de cada framework e serve para comparar o peso transferido por visita.
- O Angular sem zone.js e com signals reduz o JS comprimido de 44,7 KB para 33,8 KB e a primeira pintura de 166 ms para 128 ms, na mesma versão.
- Com virtualização, o painel renderiza dezenas de linhas por vez, não 10.000. A diferença que pesa no uso diário fica nas operações pequenas e frequentes (atualizar, selecionar, trocar, anexar), além da primeira pintura. Isso é inferência minha: só a medição proposta em [painel-e-aws.md](https://github.com/stacklabs3/monitora-ai/blob/research/painel-aws/docs/pesquisas/painel-e-aws.md) resolve, com dataset sintético e o fluxo real.

## Lista longa virtualizada

- **Angular CDK:** renderiza "only the items that fit on-screen" [4]. O `*cdkVirtualFor` aceita `Array`, `Observable` ou `DataSource` e recicla views [4]. A estratégia pronta é `FixedSizeVirtualScrollStrategy`. A de tamanho variável fica em `@angular/cdk-experimental` e "is not ready for production use yet" [4]. Uma estratégia própria pode estender `VirtualScrollStrategy` [4]. Linhas de log com altura variável (stack trace expandido, por exemplo) são exatamente o caso que a estratégia fixa não cobre.
- **TanStack Virtual (MIT, 3.x):** headless, "does not ship with or render any markup", com adaptadores para React, Vue, Svelte, Solid, Lit e Angular [5]. Mede itens reais com `measureElement` e usa `estimateSize` como estimativa inicial [15]. O adaptador Angular `@tanstack/angular-virtual` 6.1.12 exige `@angular/core >= 20` [1].

## Custo de hospedagem

- Os quatro geram um SPA servível como arquivos estáticos. No Angular basta copiar `dist/<app>/browser/` para o servidor ou CDN e configurar o fallback de rotas para `index.html` [6]. Para os demais, o `vite build` gera `dist`, publicável em qualquer host estático [8]. O SvelteKit tem `adapter-static` com página de fallback para rotas não pré-renderizadas [11].
- Nenhum deles exige servidor Node se não usar SSR. No Angular, o SSR (`outputMode: "server"`) é que exige processo Node [6].
- A diferença de custo entre os frameworks fica no volume transferido por visita (runtime + código do painel), multiplicado pelo número de acessos. O preço da CDN ou do bucket na AWS não foi levantado aqui [confirmar].

## Perguntas em aberto

- Tamanho real do bundle do painel (com roteamento, gráficos e tabela) em cada framework [confirmar com protótipo].
- Desempenho com atualização contínua (eventos chegando com a lista aberta) e altura variável: medir conforme a proposta de [painel-e-aws.md](https://github.com/stacklabs3/monitora-ai/blob/research/painel-aws/docs/pesquisas/painel-e-aws.md).
- Política de suporte de React, Svelte e Solid [confirmar].

## Fontes

Todas consultadas em 15/11/2026.

1. npm registry, metadados `latest` de `@angular/core`, `@angular/cdk`, `react`, `react-dom`, `svelte`, `solid-js`, `@tanstack/*-virtual`: https://registry.npmjs.org/@angular/core · https://registry.npmjs.org/react · https://registry.npmjs.org/svelte · https://registry.npmjs.org/solid-js · https://registry.npmjs.org/@tanstack/angular-virtual
2. Angular, versionamento e lançamentos: https://angular.dev/reference/releases
3. React, "The React Foundation: A New Home for React Hosted by the Linux Foundation" (24/02/2026): https://react.dev/blog/2026/02/24/the-react-foundation
4. Angular CDK scrolling (fonte da documentação): https://github.com/angular/components/blob/main/src/cdk/scrolling/scrolling.md
5. TanStack Virtual, introdução: https://tanstack.com/virtual/latest/docs/introduction
6. Angular, deployment: https://angular.dev/tools/cli/deployment
7. React, "Build a React app from scratch": https://react.dev/learn/build-a-react-app-from-scratch
8. Vite, "Deploying a Static Site": https://vite.dev/guide/static-deploy
9. Svelte, README do repositório oficial: https://github.com/sveltejs/svelte
10. Solid, README do repositório oficial: https://github.com/solidjs/solid
11. SvelteKit, `adapter-static`: https://svelte.dev/docs/kit/adapter-static
12. js-framework-benchmark, relatório oficial Chrome 156 (fonte de terceiros): https://krausest.github.io/js-framework-benchmark/2026/chrome156.html
13. js-framework-benchmark, README e metodologia: https://github.com/krausest/js-framework-benchmark
14. js-framework-benchmark, `llms.txt` (orientação de citação e limites): https://krausest.github.io/js-framework-benchmark/llms.txt
15. TanStack Virtual, API do Virtualizer: https://tanstack.com/virtual/latest/docs/api/virtualizer
