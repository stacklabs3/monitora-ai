---
status: accepted
---

# Solid no painel, com Vite e sem SolidStart

O painel de investigação é feito em Solid, com Vite e um roteador, e sai como arquivos estáticos que só falam com a entrada do painel ([ADR 0003](0003-modulos-e-seams-do-servidor.md)). O motivo é o critério do responsável para toda escolha, rápido de execução e baixo custo de hospedagem. No benchmark, o Solid foi o mais rápido e o mais leve dos quatro candidatos em todas as linhas medidas. A hospedagem não diferencia os candidatos, porque os quatro geram só arquivos estáticos e têm licença MIT.

Decidido em [Escolher o framework do painel](https://github.com/stacklabs3/monitora-ai/issues/24), em 27/11/2026, com os números de [Pesquisar frameworks do painel](https://github.com/stacklabs3/monitora-ai/issues/23).

## Resultado que decidiu

Medianas do js-framework-benchmark (Chrome 156, modo keyed), tiradas da pesquisa. O benchmark mede uma tabela genérica, não o painel.

| | Solid | Svelte | Angular (signals) | React |
|---|---|---|---|---|
| Primeira pintura | 53,5 ms | 65,5 ms | 128,0 ms | 228,1 ms |
| JS comprimido | 4,5 KB | 9,7 KB | 33,8 KB | 51,4 KB |
| Criar 1.000 linhas | 21,4 ms | 21,8 ms | 32,9 ms | 24,7 ms |
| Trocar 2 linhas | 12,5 ms | 12,9 ms | 14,3 ms | 86,9 ms |
| Memória após 1.000 linhas | 2,7 MB | 2,9 MB | 3,6 MB | 4,4 MB |

## Como entra

- **Solid com Vite e um roteador:** o Vite gera os arquivos estáticos direto. O SolidStart fica de fora porque traz rotas e montagem de tela no servidor, e o ADR 0003 recusou um servidor que monta as telas.
- **Páginas de 100 sem biblioteca de lista longa:** a busca mostra 100 eventos por página, até 5.000 ([Definir semântica de busca e campos configuráveis](https://github.com/stacklabs3/monitora-ai/issues/6), item 33). Criar 1.000 linhas leva 21 ms, então 100 linhas ficam bem abaixo disso. O TanStack Virtual (MIT, com adaptador para Solid) só entra se a medida mostrar lentidão.

## Condição medida

A escolha valia com uma medida pendente, e ela passou em [Medir o painel em Solid no fluxo real](https://github.com/stacklabs3/monitora-ai/issues/66), em 28/11/2026.

A investigadora da `conta-7` busca a reserva `R-1042`. Duas coisas precisavam levar até 100 ms cada no Chrome, com a CPU 4x mais lenta: o desenho da página de 100 eventos e a abertura de um evento com stack trace longo, as duas medidas à parte do tempo da busca no servidor. O limite de 100 ms é o ponto em que a resposta parece imediata (Nielsen).

| Pior de 30 repetições | Página de 100 eventos | Evento com stack de 400 linhas |
|---|---|---|
| CPU 4x mais lenta (a condição) | 42,7 ms | 35,6 ms |
| CPU 8x mais lenta | 75,4 ms | 77,7 ms |
| Controle negativo a 4x (5.000 eventos, stack de 20.000 linhas) | 622,9 ms | 615,7 ms |

O JS de uma visita pesa 13,5 KB com gzip, com o Solid e o roteador dentro. O TanStack Virtual fica de fora.

- **A medida rodou num Apple M5, não num notebook comum.** A folga cobre a diferença: os dois tempos só passam de 100 ms com a CPU 16x mais lenta.
- **A aprovação vale para a linha 1.x do Solid** (`solid-js` 1.9.20). O 2.0 saiu em 17/11/2026, e o `vite-plugin-solid` estável (2.11.17) só aceita o 1.x. **Adotar o 2.x pede rodar a medida de novo.**
- **A tela medida não é a do protótipo aprovado.** O risco RK38 de [docs/riscos.md](../riscos.md) leva o limite de 100 ms para os testes do painel.

## Opções recusadas

- **Svelte:** chega perto do Solid, mas com o dobro do JS e 12 ms a mais na primeira pintura. Os dois são mantidos por voluntários.
- **React:** é o mais usado e tem a React Foundation, na Linux Foundation, por trás. Em troca, é o mais pesado, tem a primeira pintura mais lenta e é 7x mais lento na troca de linhas.
- **Angular:** tem o respaldo do Google e 24 meses de suporte por versão. Foi a opção proposta na pesquisa inicial, sem estar decidida. Em troca, baixa de 7 a 10x o JS do Solid, tem a primeira pintura 2,4x mais lenta, e o CDK dele só virtualiza itens de altura fixa.
- **Escolher só depois de medir os quatro:** a medida do fluxo real vira condição da escolha, no mesmo molde do [ADR 0002](0002-opensearch-como-banco-de-logs.md).

## Consequências

- **Governança mais fraca:** o Solid é mantido pela comunidade, com Open Collective e patrocinadores, e não tem política de suporte publicada. Uma versão maior pode pedir migração sem prazo de suporte para a anterior.
- **Protótipo em outro framework:** o protótipo do desenho inicial usa React com Babel. O `/portar-prototipo` traduz o JSX para Solid, e os dois usam JSX.

## Fontes

- [Pesquisa: framework do painel](https://github.com/stacklabs3/monitora-ai/blob/research/framework-do-painel/docs/research/framework-do-painel.md): versões, licenças, governança, saída estática, virtualização e as medianas do benchmark
- [js-framework-benchmark, relatório Chrome 156](https://krausest.github.io/js-framework-benchmark/2026/chrome156.html) e a [metodologia](https://github.com/krausest/js-framework-benchmark)
- [Medida: o painel em Solid no fluxo real](https://github.com/stacklabs3/monitora-ai/blob/research/medida-painel-solid/docs/research/medida-painel-solid.md): os tempos, o controle negativo, os limites da medida e o achado do Solid 2.0
- [Vite, deploy de site estático](https://vite.dev/guide/static-deploy)
- [TanStack Virtual](https://tanstack.com/virtual/latest/docs/introduction)
- [Nielsen, limites de tempo de resposta](https://www.nngroup.com/articles/response-times-3-important-limits/)
- [ADR 0003](0003-modulos-e-seams-do-servidor.md), [Restrições do projeto](https://github.com/stacklabs3/monitora-ai/issues/19) e a [consolidação da pesquisa inicial](../pesquisa-inicial/consolidacao.md)
- Respostas do responsável nas rodadas 1 e 2 do grilling (27/11/2026)
