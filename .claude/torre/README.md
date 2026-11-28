# Torre autônoma (`torre.py`)

Leva ao fim do desenvolvimento as issues abertas do `stacklabs3/monitora-ai` que não são
`ready-for-human`, **sem clique do Matheus**. No lugar de sessões do app desktop, abre execuções
headless do Claude Code (`claude -p … --permission-mode bypassPermissions --output-format stream-json --verbose`),
cada uma numa worktree própria. Cada execução é uma sessão nova para os watchdogs: um ticket de
wayfinder por execução, uma fila por execução.

Por que existe: o app recusa abrir sessão em turno disparado pelo relógio ou por outra sessão (a
sessão vira um card que só o Matheus abre), e o watchdog barra o segundo ticket de wayfinder na
mesma sessão. Decisão e histórico: `.scratch/torre/handoff-torre-autonoma.md`.

## O ciclo que ele segue

O do método (`AGENTS.md`, *CI por lote*; `docs/agents/orquestracao.md`, *O ciclo do lote*):

1. **Fila de ajustes** sozinha: deixa a `main` verde no `scripts/ci-local.sh` e traz o que está fora
   da `main` (M2). A primeira (`ajustes-2011`, PR #2431) roda numa sessão do app: o script só acompanha.
   A issue que o Matheus manda rodar numa fila de ajustes (`issues_de_ajustes` da configuração) não
   vai para o planejador. Quando não há candidata para o par, ela abre a fila `ajustes-issues-<n>`, só
   dela, que confere item a item o que ainda vale e fecha a issue no merge.
2. **Abrir o lote** (Matheus, 24/11): só com os mapas iniciais de Protótipo, Arquitetura, Fases e Regras de
   código fechados (`AGENTS.md`, regra 1; o de Infra não trava). Com um deles aberto não há candidata de
   código, e o ensaio mostra quais travam (`mapas iniciais que travam o código`). Com a `main` verde, a Torre grava em `codigo.lote` do estado as
   `tamanho_do_lote` (10) candidatas mais antigas; as que o planejador deixou de fora no lote anterior
   vão por último. As issues de `prioridade_do_lote` da configuração passam à frente, na ordem dela
   (Matheus, 24/11: o que afeta o uso vai primeiro). Issue que fica `ready-for-agent` depois disso espera o lote seguinte. Quando as
   únicas candidatas são as que o lote anterior deixou de fora e ele não levou nada à `main`, o lote não
   abre até aparecer candidata nova.
3. **Planejar o par:** uma execução recebe só as issues do lote que faltam e grava
   `.scratch/torre/pares/par-<n>.json` com duas filas sem arquivo em comum e a faixa de riscos de cada
   uma. Issue de fora do lote que o plano traga sai das filas. O plano com as filas vazias e o `fora`
   preenchido acaba o lote. O plano inválido falha duas vezes e vai para *Para o Matheus*; o planejador
   volta sozinho quando aparece candidata que ele não viu, e então o lote acaba com as que ele não
   planejou de fora.
4. **O par:** duas execuções `/orquestrar-issues`, cada uma na sua `integracao/<nome>`, que fazem o
   merge na `main` com `scripts/agents/integrar-item.sh <pr> --sem-ci`. Com as duas `MERGED main`: se o
   lote ainda tem issue `ready-for-agent`, volta ao 3, sem fila de ajustes; se não, volta ao 1 com a
   `ajustes-lote-<k>`, que confere as integrações de todos os pares do lote. Lote sem nenhuma fila na
   `main` volta direto ao 2. O par que já rodava antes do lote existir (estado de uma Torre anterior)
   fecha com a `ajustes-par-<n>`, como antes.

Em paralelo, **uma lateral por vez**, nesta prioridade: o relatório das melhorias (fim do ciclo 1),
`/to-spec` e `/to-tickets` de mapa no destino, `/triage` das issues sem rótulo, e a avaliação de
mapas, specs e grillings avulsos (a mais antiga primeiro; cada execução resolve no máximo um ticket).
A issue que a triagem devolve pedindo o `/to-spec` (`pedem_spec` no resultado, ou `#<n> … /to-spec` no
`pedem_mapa`) ganha a frente de spec como o mapa no destino, desde que esteja aberta; com o rótulo
`spec`, a frente começa no `/to-tickets`.

**Grillings extras** (Matheus, 24/11): além da lateral, até `grillings_extras` (2) tickets
`wayfinder:grilling` sem o rótulo do Chrome local rodam ao mesmo tempo, na conta da Torre como tudo (a chave
`conta_dos_grillings_extras` da configuração não é mais lida). Eles não abrem enquanto a avaliação de um mapa roda, e a lateral não
avalia mapa enquanto um deles roda: as duas poderiam resolver o mesmo ticket da fronteira. O kickoff da
avaliação manda reler o mapa antes e depois de pôr o ponteiro, porque outra execução pode editá-lo junto.

Limites: no máximo 2 filas de código, 1 lateral (mais os grillings extras); a fila de ajustes nunca roda junto de outra fila
de código. Execução sem saída nova por 45 minutos é encerrada e reaberta uma vez como retomada (com
o contexto do que está no git); na segunda falha, vai para *Para o Matheus*. Execução que bate na
smart zone grava `"smart-zone"` e é continuada numa execução nova (até 6 vezes).

**Só a conta 1 do Claude Code** (Matheus, 27/11; de 25/11 a 27/11, só a conta 2; antes, de 21/11, um
rodízio entre as duas): conta 1 é o `claude` padrão, conta 2 é o mesmo `claude` com
`CLAUDE_CONFIG_DIR=/Users/matheussouza/.claude-conta2` (`CONTAS_DO_CLAUDE`). Toda execução nova e toda
retomada nasce na conta 1 (`CONTA_DA_TORRE`); a conta 2 fica guardada em `CONTAS_DO_CLAUDE` e nenhuma
escolha a usa. O contador (`contas.contador` no estado) diz
quantas execuções abriram; o log de cada abertura e o `torre-status.md` (*Contas do Claude Code*) mostram a
conta. Quando o `result` de erro ou uma mensagem de erro da API cita o limite de uso (`PADRAO_LIMITE`), a
conta fica marcada até o horário do aviso (ou `minutos_conta_no_limite`, 60 por padrão) e a execução
reabre como retomada na conta 1, na mesma tentativa, sem contar como falha. Com a conta 1 no limite, a
Torre espera (`aguardando_conta`) e põe uma linha em *Para o Matheus*; não cai na conta 2. O estado
guarda a conta em uso e os prazos em `contas`.

**Só modelos aprovados** (Matheus, 28/11): toda execução nasce com `--model claude-opus-5-5`
(`MODELO_DA_TORRE`), porque o `claude -p` sem `--model` herda o padrão da conta, que é Fable. O kickoff
manda cada subagente e cada `claude -p` aberto pela execução levar o modelo explícito: `claude-opus-5-5`, ou
`claude-sonnet-5-5` para trabalho mecânico. Fable nunca.

**Chrome local fora de uso** (Matheus, 25/11): a Torre não abre execução com `--chrome`, nem na conta 1,
a do Chrome deste Mac com a extensão. A execução cujo kickoff cita issue com o rótulo
`rotulo_chrome_local` da configuração (`chrome-local`) não abre (`segurar_chrome_local`): a Torre põe em
*Para o Matheus* "a #<n> precisa do Chrome local, e a Torre não abre execução com o Chrome" e não gasta
tentativa. A retomada nessa situação fica em `aguardando_conta` sem segurar as outras. Ponha o rótulo na
issue que precisa do Chrome local (e2e com o navegador, conferência visual, passada do agente no Chrome);
ela abre quando o rótulo sai.

**Decisão pelas cinco lentes** (Matheus, 21/11; a quinta, `/codebase-design`, em 27/11): toda decisão
que uma execução toma pela recomendação passa por `/human-architect-mindset`, `/domain-modeling`,
`/ceo-advisor`, `/cto-advisor` e `/codebase-design` (`LENTES_DE_DECISAO`), com a seção `## Lentes` no
comentário da issue. A execução lista em `decisoes` do resultado as issues em que decidiu; com a lista
cheia, a Torre confere no stream que as lentes que o kickoff dela pediu (`lentes` da execução no estado)
foram carregadas pela ferramenta Skill e, se faltar alguma, conta a execução como falha e a reabre. A
execução aberta antes de 27/11 não tem `lentes` e é conferida pelas quatro de antes.

## Estado pela fonte, nunca pelo aviso

- Fila ou ajustes na `main`: `gh pr list --head integracao/<nome>` dá `MERGED` com base `main` (o merge é squash).
- Spec publicado: a issue tem o rótulo `spec`. Par planejado: o JSON do par é válido e sem issue repetida.
- O resultado que cada execução grava em `.scratch/torre/resultados/<nome>.json` só vale quando a
  fonte confirma; sem confirmação, conta como falha.

## Como rodar

```bash
python3 .claude/torre/torre.py --ensaio
```
Imprime o retrato (issues, PRs das integrações, candidatas, fora de escopo, fora da `main`) e o que
abriria agora, sem abrir nada nem gravar estado. `--sem-fetch` pula o `git fetch`.

```bash
python3 .claude/torre/torre.py --uma-lateral
```
Abre só a próxima execução lateral e acompanha até ela terminar (prova pequena antes do ciclo).

```bash
nohup python3 -c "import os; os.setsid(); os.execvp('python3',['python3','.claude/torre/torre.py'])" >> .scratch/torre/torre.log 2>&1 < /dev/null &
```
O `setsid` tira a Torre do grupo de processos da sessão que a subiu: ela segue viva quando a sessão
fecha. Quem sobe e vigia é a skill `/torre` (`.claude/skills/torre/`), e `/torre parar` para.

O laço: a cada 2 minutos tira o retrato, acompanha as execuções, avança as frentes pela fonte e abre
o que couber. Só uma Torre por vez (`.scratch/torre/torre.pid`). Termina sozinho quando não há
execução rodando nem nada a abrir, com a lista das abertas que não são `ready-for-human` e o motivo.
A volta em que uma execução terminou nunca dá o fim: o retrato dela é de antes, e as issues que a
execução criou só aparecem na volta seguinte.

## Como parar

- **Parar a Torre, deixar as execuções terminarem:** `touch .scratch/torre/PARAR`. Na próxima volta
  ela sai; as execuções seguem e são reassumidas pelo pid quando a Torre subir de novo (apague o
  `PARAR` antes).
- **Parar tudo:** o acima e `kill -TERM -<pid>` de cada execução (o pid está em `torre-estado.json`,
  `execucoes.<nome>.pid`; cada execução tem o próprio grupo de processos).
- **Reinício seguro:** o estado está em `.scratch/torre/torre-estado.json`; ao subir, a Torre relê o
  estado, confere cada pid e tira o retrato do GitHub antes de abrir qualquer coisa.

## Onde ficam as coisas (`.scratch/torre/`, fora do git)

| Arquivo | O que é |
|---|---|
| `torre-estado.json` | fase do código, lote, par, specs, avaliações, execuções, bloqueios, pedidos ao Matheus |
| `torre-status.md` | o status curto, começando por *Para o Matheus* (a sessão "Torre de controle das sessões" o lê a cada 10 min) |
| `execucoes/<data>-<nome>-t<tentativa>c<continuação>.jsonl` | o stream-json de cada execução |
| `execucoes/…kickoff.md` | o prompt exato que a execução recebeu |
| `resultados/<nome>.json` | o que a execução diz ter feito |
| `pares/par-<n>.json` | as filas planejadas do par |
| `melhorias-em-teste.json` | a medida de M1–M8 por ciclo |
| `melhorias-ciclo-<n>.md` | a tabela ao fim do ciclo |

Configuração (exclusões, limites, a semente da primeira volta): `.claude/torre/configuracao.json`.

## O que ele nunca faz

- Não edita, move nem desliga `.claude/watchdogs/`, `.claude/githooks/`, `.claude/agents/`,
  `.claude/metodo.json`, `.claude/settings.json` nem `.claude/state/` (regra 21), e não muda o
  `.claude/settings.local.json` do checkout principal: só o **copia** para cada worktree (M3).
- Não usa `--no-verify` nem push forçado, e não faz merge ele mesmo: quem faz é a execução, pelo
  `scripts/agents/integrar-item.sh`.
- Não contorna watchdog: um bloqueio (`[watchdog …] BLOQUEADO`) vira registro com o comando que o
  causou (M8) e entra no status; nunca vira nova tentativa por outro caminho.
- Não abre `ready-for-human`, `depois-do-lancamento`, `needs-info`, `wayfinder:prototype`, nem as
  issues de `issues_fora` da configuração (#2293, #2294, #1530–#1534, #2369, #2307, #2420).
- Não decide dinheiro, credenciais nem contas externas (AWS, Meta): isso vai para *Para o Matheus*.

## Melhorias em teste (M1–M8)

Rodam só aqui e nos kickoffs que o script gera, por um ciclo (o par 2 mais a fila de ajustes dele).
Nada nas skills, nos docs ou no CI do repo muda antes disso.

| # | Onde está no script | Medida em `melhorias-em-teste.json` (passa com zero) |
|---|---|---|
| M1 | bloco "A fonte, não o aviso" nos kickoffs de fila; a Torre marca fila viva sem saída por 20 min | `M1_filas_paradas` |
| M2 | `varrer_fora_da_dev` a cada 30 min; o que achar vai no kickoff da próxima fila de ajustes | `M2_varreduras`, `M2_final` |
| M3 | `preparar_worktree` copia o `settings.local.json` | `M3_paradas_por_permissao` (e `M3_copias_de_acessos`) |
| M4 | bloco "Buscar antes de criar issue" em triagem, avaliação e spec; título quase igual a outra issue conta | `M4_duplicatas` |
| M5 | bloco "Conferência pelo squash" | `M5_squash_nao_achado` |
| M6 | bloco "Delegações do Matheus" em todo kickoff | `M6_acoes_barradas` |
| M7 | uma execução por ticket de wayfinder | `M7_bloqueios_ja_resolveu` |
| M8 | todo `[watchdog …] BLOQUEADO` do stream, com o comando | `M8_bloqueios_de_watchdog` (lista para o relatório) |

Ao fechar a `ajustes-par-2`, o script grava `melhorias-ciclo-1.md` com a tabela e abre a lateral
`melhorias-ciclo-1`: a PR `chore/melhorias-retro-2011` (M3, M5, M6, M7, M9 que passaram), as issues
de M1, M2 e M4 pelo `/triage` e o relatório de M8 ao Stack-Labs.
