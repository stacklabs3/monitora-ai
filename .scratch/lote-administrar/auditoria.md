# Auditoria do lote 2 (Administrar) do protótipo

Protótipo: `prototipos/monitora-ai/`, servido em `http://localhost:8771`, scripts em `?v=22`. Lote: commits
98af76e (aplicações e chaves de envio), 503bef8 (catálogo de campos) e 37378b1 (saúde do envio) sobre
018dd94. Rotinas: `cadastrar-aplicacao`, `guardar-a-chave`, `revogar-chave`, `declarar-um-campo`,
`ler-o-catalogo-como-investigador`, `conferir-a-saude-do-envio`, `execucao-que-sumiu`,
`eventos-em-volta-da-perda` (aba Painel, computador, claro e escuro).

**Veredito: não pronto para aprovar.** 5 FAIL em 63 itens. O mais grave (F1) faz botão apagado agir ao
clique em todas as telas do painel, novas e antigas. Contraste, toques, teclado das telas, i18n, console,
PII e a coerência do cenário passaram. Nada foi editado em `prototipos/`: esta rodada só mede e relata.

Roteiro: `.claude/skills/prototipo-html/references/checklist-qualidade.md` e
`.claude/skills/auditar-prototipo/SKILL.md`. Toda medida de falha tem controle negativo que reprova e
controle positivo que passa (RP1). Scripts e saídas brutas em
`.scratch/lote-administrar/auditoria-saidas/` (`<script>-rodada1.txt`).

## Contagem

| Rodada | Itens | PASS | FAIL | AVISO | Não se aplica |
|---|---|---|---|---|---|
| 1 (lote como entrou, `?v=22`) | 63 | 50 | 5 | 5 | 3 |
| 2 (só os 5 corrigidos, mais regressão; 7db1aa4, `?v=23`) | 5 reauditados + 1 que regrediu | 4 | 2 (F2 ainda reprova; F6 é novo) | n/a | n/a |
| 3 (só F2 e F6, mais regressão; `?v=24`) | 2 reauditados | 2 | 0 | n/a | n/a |
| **Final** | 63 | **55** | **0** | 5 | 3 |

Os 5 avisos da tabela são A1 a A5 da seção *Avisos*; A6 a A8 são observações fora da tabela, e a rodada 2
somou A9 a A11. Conta depois da rodada 2: 50 + 4 (itens 14, 38, 43 e 54 passaram) − 1 (item 18 regrediu) =
53 PASS, com FAIL nos itens 37 (F2) e 18 (F6). Conta do Final: 53 + 2 (itens 37 e 18 passaram na rodada 3)
= 55 PASS, 0 FAIL.

**Veredito final (rodada 3): zero FAIL; pronto para ir à aprovação do responsável.** Os avisos A1 a A11
seguem como estão e vão nos pontos para aprovação. Detalhe na seção *Rodada 3*. Os dois parágrafos de
veredito abaixo e acima são o registro das rodadas 1 e 2.

**Veredito depois da rodada 2: ainda não pronto para aprovar.** F1, F3, F4 e F5 passaram. F2 passa no modo
de print e reprova no modo interativo (o título da janela de declarar fica debaixo do cabeçalho do showcase).
A correção de F1 abriu uma regressão (F6): sem internet, a linha de evento deixou de se declarar
indisponível. Detalhe na seção *Rodada 2*.

## Rodada 1: tabela por item

| # | Item do checklist | Resultado | Evidência |
|---|---|---|---|
| 1 | `index.html` e `components/` existem | PASS | 18 `.jsx` |
| 2 | Ordem de carregamento | PASS | `index.html:447-464`: i18n, data, icons, ui, device, router, visoes, painel, entrada, painel-casca, busca, evento, tentativa, aplicacoes, catalogo, saude, alerta, app |
| 3 | Cache-bust igual em todos | PASS | 18 scripts com `?v=22` |
| 4 | `app.jsx` por último | PASS | `index.html:464` |
| 5 | Sem `import`/`export` | PASS | grep vazio |
| 6 | Sem arquivo órfão | PASS | 18 arquivos, 18 scripts |
| 7 | `:root` e `[data-theme="dark"]` | PASS | o lote não mexeu nos tokens: o diff do `index.html` é só a lista de scripts |
| 8 | Escalas `--space`, `--radius`, `--shadow` | PASS | idem |
| 9 | Nenhum token só num tema | PASS | os que o lote usa (`--veu`, `--ok`, `--ok-soft`, `--on-accent`, `--border-control`, `--input-bg`) existem nos dois blocos (`index.html:23-45` e `:98-116`) |
| 10 | Zero hex/rgb no JSX | PASS | linhas do lote: 0, pela árvore sintática (`nomes-do-lote-rodada1.txt`); o controle plantado `#ff0000` foi pego. `device.jsx` segue com os 18 de antes (moldura do aparelho) |
| 11 | Zero px mágico repetido | AVISO | `marginTop: 2` em `aplicacoes.jsx:144`, `catalogo.jsx:293`, `saude.jsx:172`; `gap: '2px var(--space-2)'` em `saude.jsx:240`. Mesmo uso que o lote anterior deixou como aviso |
| 12 | Estado default | PASS | prints e folhas `folhas/r1-*.png` |
| 13 | hover, focus, active visíveis pelo painel | PASS | medidos nas 18 telas (`contraste-rodada1.txt`) |
| 14 | disabled e indisponível: sem resposta a clique | **FAIL** | F1 |
| 15 | loading sem salto de layout | AVISO | a faixa "Atualizando…" (35 px) entra acima da lista e empurra os blocos em 9 telas (`diversos-rodada1-carregando.txt`). Mesmo desenho da pendência P1 do lote anterior |
| 16 | empty com texto e primeiro passo | PASS | "Criar a primeira chave de envio", "Ver aplicações e chaves de envio", "Olhar os últimos 7 dias" (`folhas/r1-estados.png`) |
| 17 | error com ação de recuperação, sem perder o digitado | PASS | "Tentar de novo" na lista e nas quatro janelas; o nome escrito continua. No protótipo o botão não faz nada (`onClick={() => {}}`), como nos erros do lote anterior |
| 18 | offline: aviso, o que continua, o que espera, conexão de volta | PASS | aviso nas três telas; "A conexão voltou" em 6 de 6 rotas (`diversos-rodada1-casca.txt`); 192 controles acesos clicados sem internet, nenhum da tela nova fica sem efeito (`offline-rodada1.txt`). A parte "a ação que espera fica indisponível" é o F1 |
| 19 | Cada aba abre na superfície e no tema dela | PASS | `diversos-rodada1-casca.txt` |
| 20 | Painel flutuante: superfícies da aba, Esc, clique fora | PASS | idem |
| 21 | Sem conteúdo cortado nem rolagem horizontal | PASS | 108 cenas (18 telas × 6 estados), 0 corte, 0 sobreposição, 0 rolagem lateral (`diversos-rodada1-texto.txt`) |
| 22 | Uma moldura por vez; Showcase sem erro | PASS | 18 rotinas, 47 quadros, 0 erro, claro e escuro (`diversos-rodada1-showcase.txt`) |
| 23 | Toda rota do `SCREEN_MAP` numa rotina | AVISO | novas fora de rotina: `SAUDE_PERIODO_INVESTIGADOR` e `SAUDE_PERIODO_ADMINISTRADOR` (a saúde em 1 h, 7 dias e 30 dias não tem print). Abrem sem erro (`rotas-fora-de-rotina-rodada1.txt`). As 8 `*_ADMINISTRADOR` da pendência P3 continuam |
| 24 | Toques dentro da meta | PASS | 20 de 20 (tabela abaixo) |
| 25 | Sem `duvidas` nem `useOpcao` | PASS | grep: só o mecanismo em `app.jsx:120-123` |
| 26 | `letraMinima` | N-A | nenhuma aba declara |
| 27 | Contraste de texto AA nos dois temas | PASS | seção *Contraste* |
| 28 | Borda de campo e de caixa de marcar ≥ 3:1 | PASS | campo 3,92 (claro) e 4,27 a 4,65 (escuro); caixa de marcar vazia 3,92 e 4,43, marcada 5,47 e 9,22; campo com erro 6,57 e 6,52 (`cenas-rodada1.txt`) |
| 29 | Foco visível em todo interativo | PASS | 270 paradas de Tab por tema em 11 telas, 0 sem contorno; nas janelas, 90 paradas por tema; menor 4,82:1 (claro) e 8,26:1 (escuro) |
| 30 | Foco não escondido sob o aviso fixo | PASS | 6 telas sem internet × 3 alturas (900, 600, 440), Shift+Tab 30 vezes: 0 parada inteira debaixo do aviso (`aviso-fixo-rodada1.txt`) |
| 31 | Ordem de tabulação | PASS | sem `tabindex` positivo; sequência em `teclado-rodada1.txt` |
| 32 | O que o mouse faz, o teclado faz | PASS | Enter em "Abrir" leva o foco ao título da aplicação; espaço em "Fechar" devolve ao "Abrir"; caixa de marcar liga com espaço e desliga com Enter; "Ver no catálogo de campos" e o voltar (6 de 6) |
| 33 | `role` e `aria-label` onde a semântica não cobre | PASS | janelas com `role` `dialog`/`alertdialog`, `aria-modal`, `aria-labelledby`; tabelas com `aria-label` e `th scope`; 0 elemento com `onClick` fora do Tab |
| 34 | Alvo de 44 px no celular | N-A | o lote é só computador |
| 35 | Informação nunca só por cor | PASS | situação da execução, "revogada", "declarado agora", "aberta abaixo" e "pode ter perdido mais" vêm por escrito |
| 36 | Janelas: foco inicial, Tab preso, Esc, clique fora, foco de volta | PASS | 6 janelas × 2 temas (`janelas-rodada1.txt`): foco inicial no campo (cadastro, mais uma chave), em "Cancelar" (revogar), em "Copiar a chave" (chave gerada), em "Fechar" (atalhos); 0 fuga do Tab; Esc e clique fora fecham e o foco volta a quem abriu; a chave gerada não fecha com Esc nem clique fora; revogar com Enter logo ao abrir cancela. Declarar abre com o foco na janela inteira, sem contorno: o primeiro Tab leva ao primeiro controle |
| 37 | Janela em tela baixa e com lista longa | **FAIL** | F2 |
| 38 | Atalho de uma tecla com janela aberta | **FAIL** | F3 |
| 39 | Nenhuma string visível fora do `i18n.jsx` | PASS | linhas do lote: 0 texto no JSX (árvore sintática; os 3 textos plantados foram pegos) |
| 40 | Toda chave usada existe | PASS | 640 chaves, 509 literais, 76 dinâmicas, 0 inexistente, 0 sem uso; 0 chave aparecendo na tela em 108 cenas |
| 41 | Multi-locale | N-A | um idioma só |
| 42 | Interpolação resolve | PASS | 0 `{param}`, `undefined`, `NaN`, `null` em 108 cenas (`texto-cru-rodada1.txt`) |
| 43 | Sem termo _Avoid_ do glossário | **FAIL** | F5 |
| 44 | Sem sigla solta nem inglês da tela | PASS | o inglês que aparece é dado da aplicação (`attempt`, `retry`, `search results rendered`) |
| 45 | Console sem erro nem aviso do protótipo | PASS | só o aviso do Babel e o 404 de `/favicon.ico`, nas 20 rotinas e em todas as medidas |
| 46 | Sem 404 de `components/*.jsx` | PASS | idem |
| 47 | Troca de tema não quebra | PASS | prints escuros e as 36 cenas com interação |
| 48 | Troca de aba não vaza estado | PASS | `diversos-rodada1-casca.txt` |
| 49 | ErrorBoundary presente | PASS | `app.jsx`. Não derrubei uma tela para vê-lo agir |
| 50 | Mocks em `data.jsx` | PASS | aplicações, chaves, execuções e perdas em `data.jsx` |
| 51 | Zero PII real | PASS | `pessoa@exemplo.test`, "Pessoa Exemplo", "Segunda Pessoa", `123.456.789-00`; nada novo no lote (`segredos-rodada1.txt`) |
| 52 | Nada com cara de segredo | PASS | chave inteira `mk_prod_ex7a_EXEMPLO-nao-e-uma-chave-real`; começos `mk_prod_ex3f…`. O conferidor pegou os 7 plantados no scratchpad (`sk_live_`, `AKIA…`, sequência aleatória, e-mail, CPF, CNPJ, telefone) |
| 53 | Prints esperados existem | PASS | 338 de 338 contra `?listarPrints=todas` |
| 54 | Prints coerentes com a tela de hoje | **FAIL** | F4 |
| 55 | Prints abertos | PASS | 24 prints em 3 folhas (`folhas/r1-aplicacoes-temas.png`, `r1-catalogo-e-saude.png`, `r1-estados.png`): default claro e escuro das telas novas e vazio, erro, carregando, sem internet de uma tela por rotina |
| 56 | Nenhum nome de uma letra no diff | PASS | 0 nas linhas do lote (`nomes-do-lote-rodada1.txt`); os 3 plantados (`n`, `v`, `a`) foram pegos. Os `n, e, t, r` sem linha são código gerado pelo Babel |
| 57 | Validador | PASS | `VALIDADOR: APROVADO` |
| 58 | Outras colisões de nome global entre scripts | PASS | além do `_excluded` do F1, nenhuma: 19 auxiliares do Babel repetidos com o mesmo conteúdo, 0 `const` de topo repetido (`colisoes-rodada1.txt`) |
| 59 | Avisos aprovados do lote Investigar × saúde do envio × catálogo | PASS | "2 eventos da aplicação API às 14:31, motivo fila cheia", "pode ter perdido mais depois de 14:52" (execução `webhooks-c44a`, 14:52:10), "Dados até 14:58:41" e `amountCents` "rápido desde 14:00" batem nas quatro telas (`coerencia-rodada1.txt`) |
| 60 | A conta de eventos faltando fecha | PASS | API: 2.591.993 − 2.591.841 = 152 = 122 com motivo (120 às 13:00 + 2 às 14:31) + 30 de motivo desconhecido; Webhooks: 18.460 − 18.420 = 40, todos de motivo desconhecido; Site: 0. Na última hora: 2 no período e "mais 120" fora dele |
| 61 | O que a rotina faz aparece nas outras telas | AVISO | depois de declarar `installmentCount`, o catálogo do Investigador e o "Adicionar filtro" da busca seguem mostrando o campo como não declarado; depois de cadastrar a API de parceiros, a saúde do envio lista 3 aplicações. O que a rotina faz mora só no endereço daquela tela |
| 62 | A busca "em volta da perda" diz por que a pessoa está ali | AVISO | período 14:26–14:36 e filtro "Aplicação é API" certos, 444 eventos, mas a tela não menciona a perda das 14:31 |
| 63 | Regressão do lote Investigar | PASS | 12 rotinas antigas dentro da meta; 212 prints antigos refeitos: iguais ou só o ícone do carregando, fora os 6 do F4 |

## Os 5 FAIL

### F1. Botão apagado age ao clique (grave)

- **Onde:** `components/ui.jsx:18` (`Press`, `...rest`) e `components/painel-casca.jsx:115`
  (`BotaoDeIcone`, `...resto`). O Babel cria um `_excluded` global por script; o de `painel-casca.jsx`
  carrega depois e sobrescreve o de `ui.jsx`. Com a lista errada, `rest` de `Press` passa a levar `onClick`,
  e o `{...rest}` de `ui.jsx:34` sobrescreve o `onClick` guardado de `ui.jsx:28`.
- **Evidência** (`apagados-rodada1.txt`, `apagados-resumo-rodada1.txt`, `colisoes-rodada1.txt`):
  na página, `window._excluded = ["rotulo","icone","aoClicar","disabled","className"]`; `Press` espera
  `["children","onClick","style","className","disabled"]`. 1.009 cliques reais em botões com
  `aria-disabled="true"`: 382 agiram (outros 78 caíram no véu de uma janela e foram descartados).
  Com `window._excluded` reposto, o mesmo clique não age mais.
- **Telas novas:** 18 botões distintos em 84 cliques.
  - "Gerar chave" do Site no limite de 2 chaves, estado normal: endereço `…/aplicacoes` → `…/aplicacoes/site/chaves/nova`.
  - Sem internet: "Cadastrar aplicação", "Gerar chave" e "Revogar" abrem a janela (`…/aplicacoes/nova`, `…/chaves/ex3f/revogar`).
  - Carregando: "Gerando a chave…" vai para `…/chaves/ex7a/gerada`; "Revogando…" revoga (`…/ex2b/revogada`); "Já guardei a chave" fecha a janela.
  - Estado disabled: "Cancelar", "Copiar a chave", e os seletores de ambiente e de papel trocam o endereço.
  - Não agiram, porque a função confere de novo: "Declarar" sem internet, "Abrir" e "Ver eventos em volta" sem internet, o período da saúde.
- **Telas antigas:** 46 botões distintos em 298 cliques. Sem internet agem "Próxima", "Adicionar filtro",
  "Período", "Remover o filtro", "Abrir a tentativa", "Ver estes eventos na busca", "Filtrar: …"; na
  entrada, "Entrar" apagado vai para `#/segundo-fator/painel`.
- **Origem:** a colisão entrou em 07f6069 (lote Investigar, issue 69), antes deste lote. A auditoria
  anterior clicou só nos controles acesos e não pegou. Pelo teclado o botão apagado não age
  (`tabIndex=-1` e o `onKeyDown` confere `disabled`).
- **Conserto sugerido:** tirar a desestruturação com resto de `BotaoDeIcone` (`painel-casca.jsx:115`),
  nomeando as propriedades que ele repassa, para sobrar um só `_excluded`; em `Press`, pôr `{...rest}`
  antes de `onClick`, `onKeyDown` e `aria-disabled` (`ui.jsx:28-34`), para a guarda vencer sempre. Somar a
  conferência nas funções que hoje não conferem: `abrirCadastro`, `abrirPedidoDeChave`, `abrirRevogar`
  (`aplicacoes.jsx:448-453`), `guardarAChave` (`:475`), `cadastrar`, `pedirMaisUmaChave` e `revogar` no
  carregando (`:465-479`).

### F2. Janela de diálogo sem altura máxima nem rolagem, centrada na página inteira

- **Onde:** `components/ui.jsx:473-487` (`JanelaDeDialogo`): véu `position: absolute; inset: 0` na casca,
  que cresce com a página; janela sem `maxHeight` nem `overflow`.
- **Evidência** (`lista-longa-rodada1.txt`, `janelas-rodada1.txt`, `sonda-altura-rodada1.txt`):
  - 1280×720, chave gerada sem internet: janela de y 259 a 762 numa janela de navegador de 720 px;
    "Já guardei a chave" fora da vista (92% à vista). Só rolando a página atrás do véu.
  - Lista longa (12 aplicações, 9 acrescentadas na memória da página): "Revogar" da última abre a janela
    de y −283 a 69, 20% à vista; "Cadastrar aplicação" no topo faz a página pular 526 px.
  - Declarar com tipo texto e papel que liga eventos mede 787 px (904 px com erro, 820 px sem internet):
    passa de 720 px, e com erro passa da moldura de 900 px (y 16 a 920).
  - Em 1440×900 com os dados do cenário, as cinco janelas cabem inteiras (controle positivo).
- **Conserto sugerido:** prender o véu à área visível (`position: fixed`, ou à moldura), dar à janela
  `maxHeight: calc(100% - 2 × var(--space-4))` com `overflowY: auto` no miolo e o rodapé dos botões fixo.

### F3. "?" abre os atalhos por cima de outra janela, e um Esc fecha as duas

- **Onde:** `components/painel-casca.jsx:234` (o atalho não confere se há janela aberta) e
  `components/ui.jsx:457` (cada `JanelaDeDialogo` escuta Esc na `window`).
- **Evidência** (`atalhos-na-janela-rodada1.txt`): com revogar, chave gerada ou declarar abertas e o foco
  fora de campo de texto, "?" leva de 1 para 2 janelas com `aria-modal`. Em revogar, um Esc fecha as duas e
  volta para `…/aplicacoes`. Dentro de campo de texto "?" e "/" só digitam (PASS).
- **Conserto sugerido:** o atalho "?" não abre com `[aria-modal="true"]` na tela; o Esc fecha só a janela
  de cima.

### F4. Seis prints antigos não batem com a tela de hoje

- **Onde:** `prints/achar-a-tentativa/03-tentativa_investigador--desktop--light--empty.png`,
  `prints/ler-um-evento/03-…--empty.png`, `prints/ler-a-linha-do-tempo/01-…--empty.png` e `03-…--empty.png`,
  `prints/codigo-em-duas-tentativas/01-…--empty.png` e `02-…--empty.png`.
- **Evidência** (`prints-comparados-rodada1.txt`, `folhas/r1-print-vazio-da-tentativa-repositorio-em-cima-refeito-embaixo.png`):
  338 refeitos numa pasta temporária: 286 iguais, 4 de ruído de desenho, 42 de carregando (ícone que gira),
  6 diferentes (52 mil pixels cada). O print diz "Perdas no período: 2 perdas … às 14:31"; a tela diz
  "120 perdas … às 13:00; 2 perdas … às 14:31". A perda das 13:00 entrou em `data.jsx` neste lote e
  mudou o vazio da tentativa (período de 30 dias), aprovado no lote anterior.
- **Conserto sugerido:** refazer os prints das quatro rotinas; a mudança de conteúdo numa tela já aprovada
  pede o aceite do humano.

### F5. Termo a evitar do glossário: "histórico"

- **Onde:** `components/i18n.jsx:535` (`catalogoComoFunciona`) e `:599` (`catalogoDeclaradoCorpo`): "fica no
  histórico e na auditoria, com quem fez e quando".
- **Evidência:** `GLOSSARY.md:131-133`, **Auditoria**, _Avoid_: "Log de acesso, histórico". Aparece no
  catálogo dos dois papéis e no aviso de campo declarado (`texto-cru-rodada1.txt`). O conferidor pegou os 9
  termos plantados e nenhum no texto limpo.
- **Conserto sugerido:** "fica na auditoria, com quem fez e quando", como `aplicacoesComoFunciona`
  (`i18n.jsx:445`) já diz. Se "histórico" for outra coisa (o histórico do campo), ele entra no glossário
  antes.

## Rodada 2

Reauditoria dos 5 FAIL sobre o commit 7db1aa4 (`?v=23`, diff sobre 37378b1), mais a regressão que a
correção podia causar em `Press` e em `JanelaDeDialogo`. Nada foi editado em `prototipos/`. Saídas em
`auditoria-saidas/<script>-rodada2.txt`. Resultado: **4 dos 5 passaram, F2 ainda reprova no modo interativo,
e há 1 FAIL novo (F6), causado pela correção de F1.**

| Achado | Item | Rodada 2 | Números |
|---|---|---|---|
| F1 botão apagado age | 14 | **PASS** | 779 cliques no claro (128 cenas, novas e antigas) e 410 no escuro (108 cenas das telas novas): 0 agiram. Rodada 1: 460 de 1.009 |
| F2 janela sem altura máxima | 37 | **FAIL** (parte) | modo de print: 45 de 45 medidas de tamanho e 16 de 16 da lista longa passam. Modo interativo: 8 de 60 cenas com o título encoberto |
| F3 "?" por cima de outra janela | 38 | **PASS** | 8 de 8 teclas sem abrir outra janela; ensaio de uma janela só passa; 0 falhas |
| F4 prints × tela | 54 | **PASS** | 338 refeitos: 0 diferentes (rodada 1: 6) |
| F5 "histórico" | 43 | **PASS** | 0 ocorrência em `components/*.jsx` e em 108 cenas lidas |
| F6 linha de evento sem internet (novo) | 18 | **FAIL** | 0 de 9 linhas (busca) e 0 de 14 (tentativa) com `aria-disabled`; antes da correção, 9 de 9 e 14 de 14 |

### F1. PASS

- `colisoes-rodada2.txt`: na página, `window._excluded = ["children","onClick","style","className","disabled"]`,
  a lista de `Press`; só `ui.jsx` declara `_excluded` (e `_excluded2`, de `Button`). 17 auxiliares do Babel
  repetidos com o mesmo conteúdo, 0 com valor diferente. O controle (dois arquivos plantados com `...sobra`)
  foi acusado.
- `apagados-rodada2.txt` (tema claro, `todas`): 779 cliques reais em 128 cenas, agiram 0. As rotas que uma
  rotina antiga e uma nova dividem entram uma vez só, por isso 779 e não 508 + 410.
- `apagados-rodada2-novas-dark.txt` (tema escuro, telas novas, 6 estados): 410 cliques em 108 cenas, agiram
  0. A amostra por cena é a mesma da saída `apagados-correcao-novas.txt` (diferença de linhas: 0).
- Controles, válidos nos dois temas. Somei ao script o negativo que faltava: um `aria-disabled="true"` com
  manipulador de clique, plantado no `#root`, é achado pela mesma marcação e **acusado** (endereço
  `…/aplicacoes` → `…/saude`). O botão aceso "Cadastrar aplicação" é acusado como "agiu". O apagado sem
  manipulador não é acusado.
- Leitura do código: `Press` espalha `rest` antes de `tabIndex`, `onClick`, `onKeyDown` e `aria-disabled`
  (`ui.jsx:24-35`); `BotaoDeIcone` não usa mais resto (`painel-casca.jsx:118`); `abrirCadastro`,
  `abrirPedidoDeChave`, `abrirRevogar`, `cadastrar`, `pedirMaisUmaChave`, `guardarAChave` e `revogar`
  conferem de novo (`aplicacoes.jsx:462-505`).
- Efeito colateral dessa ordem nova: ver F6.

### F2. FAIL no modo interativo (passa no modo de print)

- **O que passou** (`lista-longa-rodada2.txt`, `janelas-rodada2-tamanho.txt`): modo de print, 5 janelas × 3
  estados × 1440×900, 1280×720 e 1280×600: 45 de 45; a mais alta (declarar com erro) fica de y 16 a 704 em
  720 px, com o miolo rolando e os botões à vista. Lista longa de 12 aplicações: "Revogar" da última abre de
  y 274 a 626, 100% à vista (rodada 1: 20%); a página não pula. Controles: janela plantada a 2.400 px
  reprovada, janela de navegador de 300 px acusada, revogar em 1440×900 passa.
- **O que reprova** (`veu-interativo-rodada2.txt`, `sonda-cabecalho-rodada2.txt`,
  `fotos/rodada2-declarar-sob-o-cabecalho-1280x720.png`): fora do modo de print, o véu `position: fixed`
  cobre a janela inteira do navegador com `z-index: 20`, e o cabeçalho do showcase (`.showcase-header`,
  y 0 a 64, `z-index: 50`, `index.html:216-224`) fica **por cima** dele. A janela centra na janela do
  navegador, não na moldura, e o topo dela entra debaixo do cabeçalho.
  - 1280×720, declarar: como abre, janela de y 26 a 695 e título de y 51 a 73; no centro do título está o
    cabeçalho. Com tipo texto, y 16 a 704 e título de y 41 a 63, todo encoberto. Vale para default, erro e
    sem internet, claro e escuro (6 cenas).
  - 1440×900, declarar com tipo texto, papel que liga eventos e erro: janela de y 16 a 884, título de y 41 a
    63, encoberto, claro e escuro (2 cenas).
  - As outras quatro janelas (cadastro, mais uma chave, chave gerada, revogar) ficam inteiras nos dois
    tamanhos: 52 de 60 cenas sem problema. Os botões de ação nunca ficam encobertos.
  - Painel flutuante (`z-index: 100`): fechado (y 836 a 876, x 1181 a 1416 em 1440×900; y 656 a 696,
    x 1021 a 1256 em 1280×720) fica clicável por cima do véu e não cruza janela nenhuma. Aberto (y 198 a 876,
    x 1136 a 1416; y 144 a 696, x 976 a 1256) também não cruza. Isso é aviso, não falha (A10).
  - Controles: faixa fixa plantada de 400 px por cima → título acusado como encoberto; janela de navegador
    de 200 px → título acusado fora da vista; revogar em 1440×900 → passa.
- **Conserto sugerido:** ancorar o véu na moldura da tela, e não na janela do navegador (um contêiner da
  casca que não rola, com `position: relative`, e o véu `absolute; inset: 0` dentro dele), ou manter o `fixed`
  e subir o `z-index` do véu acima de 50 e abaixo de 100, para ele cobrir também o cabeçalho do showcase. A
  primeira opção mantém as abas do showcase clicáveis com a chave gerada aberta, que só fecha pelo botão.

### F3. PASS

- O script `atalhos-na-janela.mjs` tinha dois casos que pressupunham duas janelas empilhadas; a correção
  não deixa mais isso acontecer pelo teclado, e eles acusavam falha por construção. Reescrevi os dois.
- `atalhos-na-janela-rodada2.txt` (11 PASS, 0 falha): com cadastro, revogar, chave gerada e declarar abertas, "?" e "/" (8
  casos): 1 → 1 janela, foco e endereço iguais; no campo do cadastro as teclas só digitam.
- Ensaio novo: "Revogar" aberto por clique real na lista; "?" e "/" → continua 1 `aria-modal`; Tab três
  vezes fica entre "Cancelar" e "Revogar a chave"; um Esc → 0 janela, endereço `/aplicacoes`, foco de volta
  no botão que abriu. Chave gerada: "?", "/" e Esc deixam 1 janela, a mesma.
- Controle negativo: os atalhos abertos à força por cima (clique sintético no botão da casca) fazem o mesmo
  ensaio **reprovar com 2 janelas**. Controle positivo: sem janela, "?" abre os atalhos.
- De quebra, a guarda de `ui.jsx:463-465`: empilhadas à força, um Esc fecha só a de cima (sobra "Revogar").

### F4. PASS

- `prints-comparados-rodada2.txt`: 338 refeitos fora do repositório contra 338 do repositório: 270 iguais,
  19 de ruído, 49 de carregando, **0 diferentes**. Controle: um print com um retângulo plantado sai como
  DIFERENTE (3.751 pixels) e a cópia fiel sai igual.
- Os 49 de carregando: nos 20 que diferem em mais de 3 mil pixels, só de 0 a 1.342 pixels passam de 8
  níveis de diferença (o ícone que gira); o resto é diferença fraca, do esqueleto que pulsa.
- O texto do vazio da tentativa (`sonda-vazio-rodada2.txt`): "Período olhado 28/10/2026 15:00 – 27/11/2026
  15:00" e "120 perdas … às 13:00; 2 perdas … às 14:31". As duas perdas são de 27/11 (`data.jsx:50-51`),
  dentro do período. Coerente. Observação: A11.
- Dos 19 de ruído, 12 são outra coisa: ver A9.

### F5. PASS

- `grep -i histórico` em `components/*.jsx` e no `index.html`: 0. `estatico-rodada2.txt`: 56 marcações de
  termo a conferir contra 58 na rodada 1 (saíram as duas de "histórico"); 640 chaves, 0 inexistente.
- `texto-cru-rodada2.txt`: 108 cenas, 0 termo a evitar; os 4 achados são inglês de dado da aplicação
  (`search`, `retry`, `attempt`). Controle: 9 de 9 plantados pegos, texto limpo com 0.

### F6 (novo). Sem internet, a linha de evento não se declara mais indisponível

- **Onde:** `components/ui.jsx:26` e `:35`. `Press` agora espalha `rest` **antes** de
  `aria-disabled={disabled || undefined}`. `LinhaDeEvento` passa `'aria-disabled': true` e o `title` com o
  motivo pelo resto (`busca.jsx:800-802` e `:810`, `tentativa.jsx:348`), sem `disabled`; o `undefined` de
  `Press` apaga o atributo.
- **Evidência** (`linha-sem-internet-rodada2.txt`, a versão de 37378b1 servida ao lado da de hoje):
  busca sem internet, antes 9 de 9 linhas com `aria-disabled`, hoje 0 de 9; tentativa, antes 14 de 14, hoje
  0 de 14. O `title` com o motivo continua (9 e 14) e o clique continua sem abrir. Com internet, 0 nas duas
  versões (controle positivo). Em `offline-rodada2.txt`, os elementos com `aria-disabled` nas 18 telas caem
  de 477 para 168, e a linha "14:58:10.004 INFO API refund requested…" aparece como controle habilitado sem
  efeito.
- **Consequência visível:** a regra `.linha-de-evento[aria-disabled="true"]:hover` (`index.html:180-181`)
  não casa mais, e a linha volta a realçar ao passar o mouse como quem abre. O lote Investigar aprovou o
  contrário (`busca.jsx:798-799`: "se declara indisponível, diz o motivo e não reage como quem abre").
- **Por que os prints não pegaram:** o atributo e o realce não aparecem em print parado.
- **Conserto sugerido:** em `Press`, `aria-disabled={disabled || rest['aria-disabled'] || undefined}`; ou
  dar a `Press` uma propriedade com nome (`indisponivel`) e tirar o `aria-disabled` do resto da linha. É o
  único uso: 86 etiquetas de `Press`, `Button` e `BotaoDeIcone` lidas, nenhuma outra passa `tabIndex`,
  `onKeyDown`, `onPointer*` ou `aria-disabled`.

### Regressão

| O que | Resultado |
|---|---|
| Toques (`toques-rodada2.txt`) | 20 de 20 na meta, os mesmos números da rodada 1; controles: 3/1 reprovado, rotina não concluída acusada |
| Tab nas telas (`teclado-rodada2.txt`) | 270 paradas por tema, 0 sem contorno, 0 encoberta; menor 4,73:1 (claro) e 6,61:1 (escuro) |
| Teclado das janelas (`janelas-rodada2-teclado.txt`) | 100 PASS, 0 falha; 90 paradas por tema, menor 4,82:1 e 8,26:1 |
| Aviso fixo (`aviso-fixo-rodada2.txt`) | 0 falha em 900, 600 e 440 px; controle: 4, 8 e 9 paradas encobertas |
| Sem internet (`offline-rodada2.txt`) | 193 controles clicados; 18 sem efeito (rodada 1: 17). O a mais é a linha de evento do F6; os outros são os itens de menu de A6 |
| Showcase (`diversos-rodada2-showcase.txt`) | 18 rotinas, 47 quadros, 0 erro, claro e escuro; celular e Telegram também |
| Console | só o aviso do Babel e o 404 de `/favicon.ico`; nenhum 404 de `components/*.jsx` |
| Cache-bust | 18 scripts, todos `?v=23` |
| Nomes no diff (`nomes-do-lote-rodada2.txt`) | 0 achado em linha do lote; os 3 nomes de uma letra plantados foram pegos |
| Validador | `VALIDADOR: APROVADO` |

### Contraste (rodada 2)

Mesmo método, valores resolvidos, os dois temas.

| Tema | Rodada 1: pares, menor razão, reprovados | Rodada 2 |
|---|---|---|
| Claro (telas × estados) | 25.923 · 4,98:1 · 0 | 25.923 · **4,98:1** · 0 |
| Escuro (telas × estados) | 25.923 · 5,23:1 · 0 | 25.923 · **5,23:1** · 0 |
| Claro (cenas com interação) | 4.146 · 5,49:1 · 0 | 4.146 · 5,49:1 · 0 |
| Escuro (cenas com interação) | 4.146 · 5,23:1 · 0 | 4.146 · 5,23:1 · 0 |

Controles de texto, iguais aos da rodada 1 e nos dois temas: negativos reprovados com 2,42:1, 1,92:1 (2,05:1
no escuro), 2,11:1 e 1,87:1; positivo com 21:1. Controles de borda: `#ddd` reprovado com 1,36:1, caixa de
marcar `#e5e5e5` reprovada com 1,26:1, `#000` aprovado com 21:1. Menor borda de campo: 3,92:1. Texto de
controle apagado abaixo do mínimo (isento): 25 pares, como antes.

### Avisos novos

- **A9. Prints das janelas de cadastro e de revogar não foram refeitos.** 12 prints fora os de carregando (`cadastrar-aplicacao/03-*`,
  `cadastrar-aplicacao/04-*--error`, `guardar-a-chave/01-*--error`, `revogar-chave/02-*`) são de 98af76e,
  de antes da mudança da janela. Diferem da tela de hoje em 20 mil a 71 mil pixels, todos por até 2 níveis
  em 255 (o serrilhado do texto debaixo do véu): não se vê
  (`folhas/r2-revogar-refeito-diferenca-repositorio.png`). O comparador os conta como ruído.
- **A10. Painel flutuante e cabeçalho do showcase por cima do véu.** Com a janela aberta, as abas do
  showcase e o painel flutuante continuam clicáveis. Com o painel aberto, um Esc fecha o painel **e** a
  janela de revogar ou de declarar.
- **A11. "às 13:00" sem data num período de 30 dias.** O vazio da tentativa lista as perdas só pela hora; o
  período olhado vai de 28/10 a 27/11.

### Não conferido na rodada 2

- Botões apagados das telas antigas no tema escuro (só as novas, 410 cliques).
- O véu no modo interativo em larguras abaixo de 1280 px e com zoom do navegador.
- Se o Esc que fecha painel e janela juntos (A10) já acontecia antes da correção.
- `coerencia.mjs`, `diversos.mjs` nas partes `carregando`, `texto` e `casca`, e `segredos.py`: a correção não
  mexeu em dados nem em layout fora da janela.
- Dos prints, abri 6 depois da correção (`folhas/r2-prints-do-repositorio.png`: chave gerada no claro e no
  escuro, revogar, declarar no claro e no escuro, o vazio da tentativa); os demais comparei por arquivo.
- As issues 71, 72 e 73 não foram lidas.

## Rodada 3

Só F2 e F6, que a rodada 2 deixou reprovados, mais a regressão do que o conserto tocou. `?v=24` nos 18
scripts. **Limite desta rodada:** quem consertou e quem mediu foi a mesma sessão (a que conduz o lote), com
os scripts que o auditor da rodada 2 deixou, sem mudá-los; não houve um terceiro agente independente. Saídas
em `auditoria-saidas/*-rodada3.txt`.

O conserto (em `components/ui.jsx`, mais o bump do `index.html`):

- **F6:** `Press` passou a receber `aria-disabled` por nome e a mantê-lo
  (`aria-disabled={disabled || declaradoIndisponivel || undefined}`). A guarda do clique continua só de
  `disabled`.
- **F2:** o véu da `JanelaDeDialogo` subiu de `zIndex: 20` para `55`: acima do cabeçalho do showcase (50),
  abaixo do aviso passageiro (60) e do painel flutuante (100).

### F6. PASS

`linha-sem-internet.mjs rodada3`, com a versão 37378b1 servida ao lado (8772) como referência:

- Busca sem internet: 9 de 9 linhas de evento com `aria-disabled` e com o motivo no `title` (rodada 2: 0 de
  9); o clique na primeira linha não abre. Com internet: 0 de 9, e o clique abre.
- Tentativa sem internet: 14 de 14 (rodada 2: 0 de 14); com internet, 0 de 14.
- Controle negativo (a versão de antes mostra o atributo): visto. Controle positivo (com internet, zero nas
  duas versões): passou. Medida válida, 0 falhas.

### F2. PASS

- `veu-interativo.mjs rodada3`: 60 cenas (1440×900 e 1280×720, dois temas, cinco janelas, estados), **0
  falhas** (rodada 2: 8). Em 1280×720, declarar na forma mais alta com erro vai de y 16 a 704, com o
  cabeçalho do showcase debaixo do véu; título e ações alcançáveis.
- `janelas.mjs rodada3 tamanho`: 0 falhas; o controle negativo (janela de navegador de 300 px) foi acusado.
- `janelas.mjs rodada3 teclado`: 0 falhas; foco nas janelas com menor 4,82:1 (claro) e 8,26:1 (escuro).
- `atalhos-na-janela.mjs rodada3`: 0 falhas; o controle negativo (atalhos à força por cima) reprovou e o
  positivo passou.

### Regressão do conserto

- **F1 de novo, porque o conserto mexeu em `Press`:** `apagados.mjs rodada3 todas`, tema claro, **904 cliques
  reais em botões apagados, 0 agiram**. Controles válidos: o botão aceso foi acusado, o apagado plantado com
  manipulador foi acusado, o apagado inerte não. `colisoes.mjs rodada3`: 0 nomes com valor diferente entre
  scripts; `window._excluded` é o de `Press`, agora com `aria-disabled` na lista.
- **Toques:** `toques.mjs rodada3`, 20 de 20 rotinas na meta, 0 falhas; console só com o aviso do Babel e o
  404 do `favicon.ico`.
- **Prints:** os 338 refeitos fora do repositório em `?v=24`: 271 iguais, 20 de ruído, 47 de carregando, **0
  diferentes**. Nenhum print precisou ser trocado.
- **Contraste, de novo:** `contraste.mjs rodada3 9461`: 25.923 pares por tema, menor 4,98:1 (claro) e 5,23:1
  (escuro), 0 reprovados. Controles negativos reprovados (2,42:1; 1,92:1 no claro e 2,05:1 no escuro;
  2,11:1; 1,87:1) e positivo com 21:1.
- **Sem internet:** `offline.mjs rodada3` rodou com os controles válidos; as linhas FAIL que ele lista são
  as mesmas da rodada 1 (o item "Configurar alertas" do menu, aviso A6, e os controles da casca por baixo
  da janela da chave gerada).

### Não conferido na rodada 3

- Botões apagados no tema escuro (a rodada 2 mediu as telas novas no escuro; esta, só o claro).
- `cenas.mjs` (contraste das cenas com interação), `teclado.mjs`, `aviso-fixo.mjs`, `coerencia.mjs` e
  `diversos.mjs` não foram rodados de novo: o conserto mudou um atributo e um `z-index`.
- O aviso A10 mudou de forma e não foi remedido: com o véu em 55, o cabeçalho do showcase (abas) fica
  debaixo dele; o painel flutuante (100) continua por cima e clicável.
- Prints abertos nesta rodada: 3 (saúde com a API aberta, declarar no escuro, revogar no claro).

## Contraste

Medido por `contraste.mjs` e `cenas.mjs` com `medidor.js`: cada nó de texto visível, exemplo e valor de
campo; cor resolvida por `getComputedStyle`, composta com as camadas com alfa e a opacidade herdada sobre o
fundo real; mínimo 4,5:1, ou 3:1 para texto grande. 18 telas distintas × 2 temas × 9 estados (324 cenas),
mais 36 cenas com interação por tema: cadastro aberto, recusado e escrito; mais uma chave; chave gerada e
copiada; avisos de feito (chave guardada, revogada, campo declarado); revogar com outra ativa e a única
ativa; aplicação sem chave ativa; homologação; declarar com tipo texto, papel principal e foco na caixa de
marcar; procura no catálogo; saúde com API, Webhooks e Site abertos, em 1 h, 24 h e 7 dias.

| Tema | Pares medidos | Menor razão | Reprovados |
|---|---|---|---|
| Claro (telas × estados) | 25.923 | **4,98:1** (5,59:1 só nas telas novas) | 0 |
| Escuro (telas × estados) | 25.923 | **5,23:1** (5,83:1 só nas telas novas) | 0 |
| Claro (cenas com interação) | 4.146 | 5,49:1 | 0 |
| Escuro (cenas com interação) | 4.146 | 5,23:1 | 0 |

As menores razões (4,98 e 5,23) são da lista de eventos do lote anterior, que abre duas rotinas novas.

| Rotina | Claro | Escuro |
|---|---|---|
| cadastrar-aplicacao | 4,98 | 5,23 |
| guardar-a-chave | 5,59 | 5,83 |
| revogar-chave | 5,59 | 5,83 |
| declarar-um-campo | 5,59 | 5,83 |
| ler-o-catalogo-como-investigador | 4,98 | 5,23 |
| conferir-a-saude-do-envio | 4,98 | 5,23 |
| execucao-que-sumiu | 5,59 | 5,83 |
| eventos-em-volta-da-perda | 4,98 | 5,23 |

Texto de controle apagado (isento pelo WCAG 1.4.3): 25 pares distintos abaixo do mínimo, de 2,04:1 a
3,95:1. Chave revogada esmaecida usa `--muted` e passa como texto comum. Bordas de campo e de caixa de
marcar: item 28. Indicador de foco (`--accent`): menor 4,82:1 no claro e 8,26:1 no escuro nas telas novas.

### Controles (saída literal de `contraste-rodada1.txt`)

```
== CONTROLES no tema light ==
  REPROVADO  2.42:1 (mínimo 4.5)  #99aaaa sobre #ffffff  «CONTROLE negativo fixo #9aa sobre #fff»
  REPROVADO  1.92:1 (mínimo 4.5)  #51626a sobre #0e3b43  «CONTROLE negativo token muted sobre primary»
  aprovado   4.51:1 (mínimo 4.5)  #b45309 sobre #fef3c7  «CONTROLE token warn sobre warn-soft»
  aprovado   5.71:1 (mínimo 4.5)  #51626a sobre #fef3c7  «CONTROLE token muted sobre warn-soft»
  aprovado   4.73:1 (mínimo 4.5)  #0f766e sobre #ddf3f0  «CONTROLE token accent sobre accent-soft»
  REPROVADO  2.11:1 (mínimo 4.5)  #b3b3b3 sobre #ffffff  «CONTROLE negativo preto com opacidade 0,3 sobre »
  REPROVADO  1.87:1 (mínimo 4.5)  #555555 sobre #808080  «CONTROLE negativo cinza sobre preto 50% sobre br»
  aprovado   21:1 (mínimo 4.5)  #000000 sobre #ffffff  «CONTROLE positivo preto sobre branco»
== CONTROLES no tema dark ==
  REPROVADO  2.42:1 (mínimo 4.5)  #99aaaa sobre #ffffff  «CONTROLE negativo fixo #9aa sobre #fff»
  REPROVADO  2.05:1 (mínimo 4.5)  #9aabb0 sobre #e3f1ef  «CONTROLE negativo token muted sobre primary»
  aprovado   8.31:1 (mínimo 4.5)  #fbbf24 sobre #3a2a06  «CONTROLE token warn sobre warn-soft»
  aprovado   5.83:1 (mínimo 4.5)  #9aabb0 sobre #3a2a06  «CONTROLE token muted sobre warn-soft»
  aprovado   6.61:1 (mínimo 4.5)  #5ccfc0 sobre #123a37  «CONTROLE token accent sobre accent-soft»
  REPROVADO  2.11:1 (mínimo 4.5)  #b3b3b3 sobre #ffffff  «CONTROLE negativo preto com opacidade 0,3 sobre »
  REPROVADO  1.87:1 (mínimo 4.5)  #555555 sobre #808080  «CONTROLE negativo cinza sobre preto 50% sobre br»
  aprovado   21:1 (mínimo 4.5)  #000000 sobre #ffffff  «CONTROLE positivo preto sobre branco»
MEDIDA VÁLIDA: os controles negativos reprovaram e o positivo passou.
```

Controles de borda (`cenas-rodada1.txt`, iguais nos dois temas): borda `#ddd` sobre `#fff` reprovou com
1,36:1; caixa de marcar `#e5e5e5` sobre `#fff` reprovou com 1,26:1; borda `#000` sobre `#fff` passou com
21:1.

Os outros conferidores e os seus controles:

| Conferidor | Controle negativo, que reprovou | Controle positivo, que passou |
|---|---|---|
| `apagados.mjs` | botão aceso "Cadastrar aplicação" acusado como "agiu" | elemento apagado sem manipulador: nada mudou |
| `colisoes.mjs` | dois arquivos plantados com `...sobra` acusados | 19 auxiliares do Babel iguais não acusados |
| `toques.mjs` | um toque além da meta: 3/1; rotina não concluída: acusada | 20 rotinas |
| `nomes.mjs` | 3 nomes de uma letra, 3 textos e 1 cor plantados | arquivo limpo: 0 achado |
| `texto-cru.mjs` | 9 achados no texto plantado (`{campo}`, `undefined`, token, api key, heartbeat, admin, histórico, chave de i18n, inglês) | texto limpo: 0 |
| `segredos.py` | 7 plantados no scratchpad | (os 7 achados do repositório são fictícios, lidos um a um) |
| `janelas.mjs` e `teclado.mjs` | sem contorno; contorno `#eee` a 1,16:1 e 1,09:1; foco encoberto por camada; janela de navegador de 300 px | contorno `#000` a 21:1 |
| `lista-longa.mjs` | janela plantada a 2.400 px do topo | revogar em 1440×900 |
| `aviso-fixo.mjs` | aviso plantado de 420 px: 4, 8 e 9 paradas encobertas | 6 telas |
| `atalhos-na-janela.mjs` | sem janela, "?" abre os atalhos (o ensaio enxerga o atalho agir) | "?" e "/" dentro do campo só digitam |
| `coerencia.mjs` | aviso plantado "3 eventos às 14:32" e conta 100 − 90 = 12 | aviso aprovado lido da tentativa |
| `diversos.mjs` (texto) | um corte e uma sobreposição plantados | 108 cenas |
| `offline.mjs` | botão sem efeito plantado | botão que muda a tela |

## Toques das 20 rotinas

Cliques reais pelo grupo Rotina do painel, lidos em `window.contagemDeToques` (`toques-rodada1.txt`):

| Rotina | Toques/meta |
|---|---|
| cadastrar-aplicacao | 3/3 |
| guardar-a-chave | 2/2 |
| revogar-chave | 2/2 |
| declarar-um-campo | 2/3 |
| ler-o-catalogo-como-investigador | 1/1 |
| conferir-a-saude-do-envio | 2/2 |
| execucao-que-sumiu | 1/1 |
| eventos-em-volta-da-perda | 1/1 |
| entrar-no-painel | 2/3 |
| ver-como-administrador | 1/1 |
| buscar-eventos | 3/3 |
| avisos-da-busca | 3/3 |
| ler-um-evento | 2/3 |
| ler-o-erro-do-evento | 2/3 |
| filtrar-por-um-valor | 1/3 |
| achar-a-tentativa | 2/3 |
| ler-a-linha-do-tempo | 2/3 |
| codigo-em-duas-tentativas | 1/3 |
| entrar-pelo-celular | 2/3 |
| receber-o-alerta | 3/3 |

## Avisos (não são FAIL; pedem decisão do humano)

- **A1. px soltos** (item 11): `marginTop: 2` três vezes e `gap: '2px …'`.
- **A2. Faixa "Atualizando…"** (item 15): 35 px que entram acima da lista no carregando, em 9 telas.
- **A3. Rotas de período da saúde fora de rotina** (item 23): 1 h, 7 dias e 30 dias não têm print. O
  checklist pede FAIL para tela fora de rotina; segui o precedente da pendência P3, por ser a mesma tela
  com outro período.
- **A4. O que a rotina faz não chega às outras telas** (item 61): campo declarado e aplicação cadastrada.
- **A5. Busca "em volta da perda" não cita a perda** (item 62).
- **A6. Menu "Configurar alertas" e "Alertas"** não navegam nem se declaram indisponíveis: são de lote
  futuro, da casca (`offline-rodada1.txt`).
- **A7. "chave" abreviada:** 52 textos dizem "a chave" sem "de envio" ("Gerar chave", "Copiar a chave"). O
  glossário evita "Chave" como nome do campo de correlação (`GLOSSARY.md:39-41`); aqui é sempre a chave de
  envio, na tela que leva esse nome.
- **A8. "aplicativo"** em `i18n.jsx:445` e `:507` ("nunca em navegador ou aplicativo"): não é o termo a
  evitar "app" no sentido de Aplicação, mas fica perto dele. A entrada aprovada já usa a palavra
  (`i18n.jsx:64-65`).

Observações que não entraram na contagem: a página inteira rola quando o conteúdo passa da moldura (chave
guardada 997 px, saúde com Webhooks sem internet 992 px, numa moldura de 900 px); a abertura da busca
aprovada já faz o mesmo (3.779 px). A janela de atalhos na abertura da busca abre no meio da página e a
página pula 1.567 px para mostrá-la: é o mesmo defeito de âncora do F2, que já existia antes deste lote.

## Não conferido

- Leitura linha a linha de `catalogo.jsx`: li a janela de declarar e os manipuladores da tela
  (linhas 340-457 e 500-540); o resto foi coberto por script e pelo navegador. `aplicacoes.jsx` e `saude.jsx` li
  inteiros.
- A borda da caixa de marcar nos estados do painel flutuante: medi na cena de declarar com tipo texto
  (vazia, marcada e com foco), nos dois temas; a caixa apagada pelo limite de 5 campos por palavras não
  aparece no cenário (1 de 5).
- Janela em tela baixa: medi com a janela do navegador em 1280×720 no modo de print, em que a moldura é a
  própria janela. Não medi a moldura reduzida do showcase com o painel flutuante.
- Cliques em botão apagado: uma amostra por tipo de botão em cada cena (1.009 cliques), não todos os
  botões de cada lista. Só no tema claro.
- Que a colisão do `_excluded` já agia em 018dd94: vi no código daquele commit as duas desestruturações
  com resto; não servi aquela versão para clicar.
- As issues 71, 72 e 73: `gh issue view` não devolveu o corpo; não confrontei os critérios de aceite.
- Leitor de tela de verdade: só atributos e foco. ErrorBoundary agindo. Outro navegador além do Chrome.
  Zoom do navegador e texto ampliado. Largura abaixo de 1280 px.
- Contraste de ícones e de bordas que não são de campo nem de caixa de marcar (a caixa da chave gerada, as
  caixas das aplicações).
- Prints: abri 24 dos 126 novos em três folhas reduzidas; os demais comparei por arquivo com os refeitos.
- Hover de cada clicável um a um: medi o contraste nos estados forçados, não a presença do realce em cada
  elemento.
- Celular e Telegram: só toques, console e a comparação dos prints.

## Como rodar de novo

De `.scratch/lote-administrar/auditoria-saidas/`, com o protótipo em `http://localhost:8771` (endereço em
`lib.mjs`). Cada script abre um Chrome sem janela e grava `<script>-<rodada>.txt`.

| O que confere | Comando |
|---|---|
| F1: botões apagados | `node apagados.mjs rodada2 todas` (ou `novas`, `antigas`; a rodada inteira leva perto de 50 min) e `node colisoes.mjs rodada2` |
| F2: janela em tela baixa e lista longa | `node lista-longa.mjs rodada2` e `node janelas.mjs rodada2 tamanho` |
| F3: atalhos com janela aberta | `node atalhos-na-janela.mjs rodada2` |
| F4: prints | `sh .claude/skills/prototipo-html/scripts/rodar http://localhost:8771 todas <pasta-temporária>` (da raiz) e `python3 comparar-prints.py ../../../prototipos/monitora-ai/prints <pasta-temporária>` |
| F5: termos do glossário | `node texto-cru.mjs rodada2` e `node estatico.mjs ../../../prototipos/monitora-ai` |
| F1 no tema escuro (rodada 2) | `TEMA=dark PORTA=9490 node apagados.mjs rodada2 novas` |
| F2 no modo interativo: véu, cabeçalho do showcase e painel flutuante (rodada 2) | `node veu-interativo.mjs rodada2` e `node sonda-cabecalho.mjs 1280 720` |
| F6: linha de evento sem internet (rodada 2) | servir `git archive 37378b1 prototipos/monitora-ai` fora do repositório na porta 8772 e `node linha-sem-internet.mjs rodada2` |
| Contraste das telas | `node contraste.mjs rodada2 9461` |
| Contraste das cenas com interação | `node cenas.mjs rodada2` |
| Toques das 20 rotinas | `node toques.mjs rodada2` |
| Teclado das janelas | `node janelas.mjs rodada2 teclado` |
| Tab nas telas | `node teclado.mjs rodada2` |
| Aviso fixo sem internet | `node aviso-fixo.mjs rodada2` |
| Sem internet: controles sem efeito | `node offline.mjs rodada2` |
| Coerência do cenário | `node coerencia.mjs rodada2` |
| Showcase, carregando, texto cortado, casca | `node diversos.mjs rodada2 showcase` (e `carregando`, `texto`, `casca`) |
| Nomes, textos e cores no diff | `node nomes.mjs rodada2` e `python3 marcar-do-lote.py nomes-rodada2.txt` |
| PII e segredos | `python3 segredos.py ../../../prototipos/monitora-ai/components <arquivo-plantado>` (o plantado fica fora do repositório; o desta rodada tinha um e-mail, um CPF, um CNPJ, um telefone, `sk_live_…`, `AKIA…` e uma sequência aleatória de 32 letras) |
