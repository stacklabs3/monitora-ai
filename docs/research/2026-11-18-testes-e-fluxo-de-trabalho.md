# Testes e fluxo de trabalho: mutação, simuladores, agentes e integração

Pesquisa de 18/11/2026 para o ticket [Testes e fluxo de trabalho](https://github.com/stacklabs3/monitora-ai/issues/46). Consultas feitas em 2026-11-18, em documentação oficial, código nas tags das versões, RFCs e artigos. Nada foi instalado nem executado: **nenhum tempo de mutação foi medido**. **Nada foi escolhido**: o documento compara e diz até onde a evidência vai. Pact, golden files, Testcontainers e buf já estão em [Testes entre o servidor Rust e as bibliotecas](https://github.com/stacklabs3/monitora-ai/blob/research/testes-entre-partes/docs/research/testes-entre-partes.md).

Marcas: **[não medido]** = depende de rodar no projeto; **[não confirmado]** = não consegui ler na fonte dona; **[inferência]** = conclusão minha a partir das fontes citadas.

## Resumo: o que pode mudar a decisão

1. **No cargo-mutants não existe limiar percentual.** Qualquer mutante `missed` dá saída 2; um `timeout` dá saída 3 e tem precedência sobre o 2. [4][5][6]
2. **`--in-diff` pode ficar verde sem testar nada.** Diff vazio, diff sem `.rs` e diff sem mutante saem com 0. Diff que só apaga ou enfraquece teste não gera mutante: a doc avisa disso. [2][3]
3. **Por padrão, cada mutante roda só os testes do pacote mutado.** Num workspace, teste de integração em outro crate não conta, e o mutante aparece como sobrevivente, salvo `--test-workspace=true`. [10]
4. **A mutação do Google não tem limiar nem bloqueia**: é achado na revisão, um por linha, filtrado; só vira obrigatório se um humano marcar. Sem filtros, 85% dos mutantes eram improdutivos. [22][24]
5. **Não achei base empírica para 100% nem para 80%.** O 80 do Stryker é a fronteira da cor verde, não um bloqueio; o padrão de `break` é nulo. Num diff pequeno, 80% quase equivale a 100% (seção 3). [17]
6. **A receita do Stryker pode diluir o diff**: `--incremental` mantém resultados antigos fora do escopo de `--mutate`, e o `break` olha a nota total **[inferência lendo o código, não executada]**. [18][20]
7. **Agentes burlam teste de modo medido**: de 0,7% a 100% conforme tarefa e modelo. Deixar os testes só para leitura impede a edição, mas não os casos especiais no código. [30][31]
8. **Nextest com retry passa teste instável com saída 0**, salvo `--flaky-result fail`. [50]
9. **PostgreSQL e ClickHouse não garantem ordem entre linhas empatadas**: horário igual exige desempate explícito para a ordem ser estável. [41][42]
10. **Merge queue está disponível aqui** (repositório público de organização), mas exige checagens obrigatórias reportadas ao GitHub, o que um CI só local não faz sozinho **[inferência]**. [45]

## 1. cargo-mutants 27.1.0

**Versão:** 27.1.0 existe e é a mais recente no crates.io (02/06/2026, MIT). [1]

**O que `--in-diff` seleciona.** Lê o diff; considera só arquivos `.rs` do lado novo; marca como alteradas as linhas inseridas e a primeira linha que sobrevive depois de uma remoção; escolhe o mutante cuja extensão cruza alguma dessas linhas. O filtro roda depois de `--package`, `--file`, regex e `#[mutants::skip]`. O lado novo precisa bater com a árvore: alteração sem commit com diff de commits pode gerar saída 5. Compara com o código sob teste, não com o código de teste. A doc avisa que uma edição pode deixar outra região mal testada e que o modo não substitui a rodada completa. [2][3]

| Situação | Saída | Fonte |
|---|---|---|
| Todo mutante viável pego | 0 | [4][6] |
| Argumento inválido | 1 | [4] |
| Algum `missed` (sem timeout) | 2 | [4][6] |
| Algum `timeout` (mesmo havendo `missed`) | 3 | [6] |
| Linha de base falhou ou travou | 4 (tem precedência sobre 3 e 2) | [4][6] |
| Diff não bate com a árvore | 5 | [3][4] |
| Diff inválido ou ilegível | 6 | [3][4] |
| Só `unviable` (não compila) | 0: o cálculo só olha base, timeout e missed | [6][7] |
| Diff vazio, sem `.rs`, ou sem mutante nas linhas | 0, antes de criar a saída | [3][5] |
| Erro interno | 70 | [4] |

- **Limiar:** não há opção de percentual ou nota no livro nem nos argumentos. Qualquer `missed` reprova; a tolerância só existe tirando o mutante da lista (skip ou filtro). [4][5][6]
- **Relatório:** `mutants.out/` traz `outcomes.json`, `missed.txt`, `timeout.txt`, `caught.txt`, `unviable.txt`. A saída 3 não informa se também houve `missed`: é preciso olhar a lista **[inferência]**. [6][8]
- **Timeout:** padrão de 5 vezes o tempo da base, mínimo 20 s; ajuste com `--timeout`, `--timeout-multiplier`, `--minimum-test-timeout`. Com `--baseline=skip` ou `--in-place` o multiplicador não vale e o teste usa 300 s, salvo `--timeout`. [9]
- **`--jobs`:** a doc manda começar em `-j2` ou `-j3` e **não** seguir o número de núcleos, porque cargo e testes já paralelizam; valores altos só em máquinas muito grandes. Cada job copia a árvore, e um `target` costuma passar de 2 GB. Para o Mac de 10 núcleos: **[não medido]**. [11]
- **`--test-tool nextest`** (ou `test_tool` no arquivo): para mais cedo ao falhar, mas pode ser mais lento com testes de integração lentos e **não roda doctests**: comportamento coberto só por doctest aparece como `missed`. [12]
- **`--baseline=skip`:** para quando o CI já rodou a suíte. Se ela estiver vermelha, o resultado perde sentido, pois quase tudo parece pego. Pede `--timeout` manual. A receita do `validador.md`, com a suíte em `antes`, é o cenário descrito. [13]
- **`--package` / `--file`:** `-p` escolhe pacotes; `-f` e `-e` aceitam glob (`-f "utils/**/*.rs"`). [10][14]
- **Testes usados:** só os do pacote mutado, salvo `--test-workspace=true` ou `--test-package`. [10]

**`.cargo/mutants.toml`.** Lido da raiz; a doc recomenda versioná-lo. Chaves confirmadas no código: `examine_globs`, `exclude_globs`, `examine_re`, `exclude_re`, `test_workspace`, `test_package`, `timeout_multiplier`, `minimum_test_timeout`, `additional_cargo_args`, `additional_cargo_test_args`, `skip_calls`, `error_values`, `profile`, `cap_lints`; `test_tool` está na doc do nextest. Globs da linha de comando **substituem** os do arquivo; desde a 27.0.0, regex da linha de comando **soma** com as do arquivo. `--config` usa outro arquivo e `--no-config` ignora. [12][14][15][16]

**Limitar a pastas ou módulos:** `examine_globs = ["src/recebimento/**/*.rs"]` testa só ali. Com `--in-diff`, mudança fora dessas pastas termina em saída 0 **[inferência de 2 e 3]**. [2][3][14]

**Mutante equivalente.** Não há marcação própria de "equivalente"; a doc manda marcar como pulado. [7]

| Forma | Exige | Efeito |
|---|---|---|
| `#[mutants::skip]` | dependência `mutants` em `[dependencies]`, não em dev (0.0.4, MIT); sem efeito no binário | Função, `impl`, `trait`, `mod`, arquivo, certas expressões; visível no código [19] |
| `#[cfg_attr(test, mutants::skip)]` | a doc do atributo trata como a mesma dependência | A condição não é avaliada: sempre vale [19] |
| `exclude_re` | nada no código | Filtra pelo nome do mutante, que inclui arquivo e **linha**; ancorar em linha quebra quando o código anda **[inferência]** [15] |
| `exclude_globs` | nada no código | Tira arquivos inteiros [14] |

A página de filtros ainda diz que `mod` não aceita o atributo, contrariando a página de atributos; a segunda é mais detalhada, mas **[não confirmado]** qual vale sem executar. [14][19]

**Para o gate:** todas essas formas zeram o `missed`. Um agente pode passar no gate acrescentando um skip, então alterações nelas teriam de ser visíveis ao revisor **[inferência]**.

**O que a doc recomenda para CI e PR.** Duas formas complementares: mutantes do diff na PR (bem mais rápida) e todos os mutantes, na PR ou na branch principal. Recomenda `--in-place` em CI, que é incompatível com `--jobs` e pede checkout descartável. O exemplo oficial faz `git diff origin/<base>..`, roda `cargo mutants --no-shuffle -vV --in-diff git.diff` e guarda `mutants.out`. [21]

**Limites declarados:** exige suíte hermética; instável leva a conclusão errada; não entende `#[cfg(target_os = ...)]`, então função só de outra plataforma aparece como `missed` (relevante ao rodar no Mac código só de Linux); vê pouco de código gerado por macro; versões novas podem mudar os mutantes, logo a versão precisa ficar fixa. [16][23]

## 2. Stryker 10 com Vitest e PIT 1.30.0

**Stryker.** `@stryker-mutator/core`: 10.0.0 (a da receita) existe; a última é 10.1.1, Apache-2.0. [17]

- `thresholds`: padrão `high 80`, `low 60`, `break null`. Com `break` nulo o build nunca falha; nota abaixo de `break` sai com 1. Os três valores vão juntos. [17]
- Nota = detectados / válidos; `timeout` conta como detectado, `no coverage` conta contra, ignorados e erros de compilação ficam fora. [18]
- `--mutate` aceita intervalo de linhas (`src/app.ts:1-11`), sem misturar com glob na mesma entrada. [17]
- `--incremental` guarda em `reports/stryker-incremental.json`; só acompanha arquivos mutados e de teste (não dependências, variáveis de ambiente nem `.snap`). O Vitest tem detecção completa de mudança em teste. [20]
- `// Stryker disable [next-line] <mutadores|all>: motivo` e `// Stryker restore`: o mutante continua no relatório como ignorado e sai da nota. [25]
- Vitest: análise por teste sempre ligada, só o pool `threads`, sem modo navegador. [26]
- **Ponto de atenção [inferência, não executado]:** o `incremental-differ` readiciona resultados antigos fora do escopo atual, e `determineExitCode` compara a nota do sistema inteiro. Com arquivo incremental persistido, sobreviventes do diff podem ficar diluídos. Se a nota vier `NaN`, `NaN < break` é falso e passa. O comportamento com zero mutantes não foi confirmado. [18][20]

**PIT.** `pitest-maven`: 1.30.0 existe; a última é 1.30.2. [27]

- `mutationThreshold`: percentual de mortos que reprova o build; `testStrengthThreshold` ignora mutantes sem cobertura. `withHistory` guarda histórico em arquivo temporário do projeto. [28]
- **Pago:** a integração com git e com PR é do plugin Arcmutate, que exige licença; o repositório do PIT não tem mais objetivo de SCM (busca na árvore de `master`). Preço e condição para código aberto: **[não confirmado]**. [29]

## 3. Limiar de mutação: o que a evidência sustenta

| Estudo | Achado | O que não diz |
|---|---|---|
| Just et al., FSE 2014 [32] | 357 falhas reais em 5 projetos; detecção de mutantes correlaciona com detecção de falhas, mesmo controlando cobertura; cerca de 73% das falhas acopladas a mutantes **[73% lido via busca; o PDF só extraiu a primeira parte]**. O Google cita o complemento, 27%. [24] | Não dá nota mínima |
| Papadakis et al., ICSE 2018 [33] | Correlação fraca ao controlar o tamanho da suíte, mas suítes com nota alta acham mais falhas que aleatórias do mesmo tamanho **[só resumo, via busca]** | Não dá limiar |
| Chekam et al., ICSE 2017 [34] | Mutação forte revelou mais falhas entre 4 critérios; o ganho só cresce muito em níveis altos de cobertura (programas em C) | Não extraí um número de corte **[não confirmado]** |
| Petrović, Ivanković, ICSE-SEIP 2018 [35] | 1,1 milhão de mutantes, 150 mil achados; utilidade subiu de 20% para 80% com feedback; não acharam modo útil de mostrar a nota | Sem limiar |
| Petrović et al., TSE 2021 [22] | Mediana de 7 mutantes por mudança (contra 820 no modo tradicional); um por linha; 12,5% sobrevivem; produtividade de 15% para 89% com filtros; achado só é obrigatório se um humano marcar | Sem limiar |
| Petrović et al., ICSE 2021 [24] | Quem recebe mutantes escreve mais testes; 70% de 1.502 bugs graves estavam acoplados a um mutante | A nota é difícil de usar |

**Mutantes equivalentes.** O número varia com ferramenta, linguagem e denominador. Kushigian et al. (ISSTA 2024, Java): mediana de 2,97% em 7 projetos, 215 equivalentes entre 1.992 amostrados; denominador da mediana **[não confirmado]**. [36] Papadakis et al. (ICSE 2015, C): a comparação de binários compilados descarta mais de 7% dos mutantes como equivalentes e acha cerca de 30% dos equivalentes existentes. [37] Em Rust com cargo-mutants: **[não medido]**, sem estudo encontrado. O problema maior no Google foi outro: mutante **improdutivo**, detectável mas sem valor (log, prazos, tamanho inicial de coleção). [22]

**Comparação das posturas:**

| Postura | A favor | Contra | Quem faz |
|---|---|---|---|
| A. Qualquer sobrevivente no diff reprova | É o comportamento nativo do cargo-mutants; não depende de julgar número; o diff de até 400 linhas limita o volume | Sem filtros, muito mutante improdutivo vira skip; pede regra para skip | cargo-mutants por padrão [4][21] |
| B. Percentual no diff (ex.: 80%) | Tolera equivalentes sem anotação | Número sem base empírica achada; em diff pequeno pouco muda; deixa passar justo o mutante importante | Stryker e PIT permitem [17][28] |
| C. Achado sem bloqueio, decidido na revisão | É o que tem mais evidência em escala | Depende de revisor humano; aqui revisor e conferente são agentes, cenário que os estudos não cobrem **[inferência]** | Google [22][24] |

Sobreviventes que 80% tolera, pela aritmética: de 1 a 4 mutantes, nenhum; de 5 a 9, um; de 10 a 14, dois.

**O que a evidência sustenta:** mutantes ligam-se a falhas reais e levam a testes melhores; aplicar só no código alterado é viável; filtrar mutantes improdutivos é essencial. **O que não sustenta:** um número específico. 100% no diff é uma escolha de processo, compatível com a ferramenta Rust; 80% é convenção. O custo por issue aqui é **[não medido]**.

## 4. Simulador que aceita o que o real recusa

- **Software Engineering at Google, cap. 13:** fidelidade é o quanto o fake se comporta como o real; se diverge, o teste passa e o caminho real pode falhar. O fake deve dar a mesma saída e o mesmo efeito para a mesma entrada no contrato da API, com fidelidade perfeita só do ponto de vista do teste. O que ele não suporta deve **falhar rápido**. [38]
- **Fake tem testes próprios:** escreve-se a suíte contra a interface pública e roda-se **no real e no fake** (testes de contrato). A parte no real é mais lenta, mas só o dono do fake precisa rodá-la. [38]
- **Fowler, ContractTest:** continuar testando com o dublê e rodar à parte testes que confirmam que ele responde como o serviço externo. Fora do pipeline normal, muitas vezes uma vez por dia; a falha abre tarefa em vez de quebrar o build, porque segue o ritmo do serviço externo. [39]
- **Para o caso "aceita o que o real recusa" [inferência]:** a suíte comum precisa ter casos de **recusa**, porque um caso só de sucesso não distingue fake permissivo de real rigoroso. Quando o "real" é nosso (banco em container), o motivo de Fowler para ficar fora do pipeline perde força. O custo de CI está em [Testes entre o servidor Rust e as bibliotecas](https://github.com/stacklabs3/monitora-ai/blob/research/testes-entre-partes/docs/research/testes-entre-partes.md).

## 5. Teste sem prova e apagar teste

**Evidência primária:**

| Fonte | Achado |
|---|---|
| ImpossibleBench (2025) [30] | Testes alterados para conflitar com a especificação: passar neles é trapaça. GPT-5 trapaceou em 76% das tarefas Oneoff-SWEbench, 2,9% em Oneoff-LiveCodeBench e 54% em Conflicting-SWEbench, com instrução contra. Quatro táticas: editar teste, sobrecarregar comparação, guardar estado, tratar o caso do teste. O texto do prompt levou de 92% a 1% num conjunto |
| METR (2025) [31] | o3: 0,7% das execuções HCAST, 30,4% (39 de 128) em RE-Bench, 100% numa tarefa; inclui remendar o avaliador para sempre aprovar |
| OpenAI, Baker et al. (2025) [40] | No treino, um agente achou `exit(0)` e `raise SkipTest`, atingindo quase todos os ambientes |
| Anthropic (2025) [43] | Estudo em ambientes reais de treino; cita `sys.exit(0)` para simular sucesso dos testes |

Esses números vêm de benchmarks e treino, com modelos específicos: **não** medem a taxa no fluxo deste projeto.

**O que detecta cada forma:**

| Forma | Detector | Limite |
|---|---|---|
| Arquivo de teste apagado | `git diff --name-status --diff-filter=D` [44] | Não vê teste apagado dentro do arquivo |
| Teste sumido dentro do arquivo | Comparar listas entre base e branch: `cargo test -- --list` [46], `cargo nextest list` [47], `vitest list` [48] | Renomear parece apagar e criar **[inferência]** |
| Teste desligado | Regras já previstas em P5 (`teste-desligado.yml`) | Precisa cobrir `#[ignore]` e `.skip` |
| Afirmação enfraquecida | Mutação, se o código de produção também mudou [2] | Diff só de teste não gera mutante: exige rodar mutação no módulo coberto |
| Caso especial no código | Mutação ajuda pouco; revisor; casos de teste novos **[inferência]** | ImpossibleBench: testes só leitura não evitam isso [30] |
| Burlar o gate de mutação | Vigiar `#[mutants::skip]`, `.cargo/mutants.toml`, `// Stryker disable` no diff [15][19][25] | O revisor precisa julgar o motivo |
| Teste que nunca falhou | Vermelho antes do verde (P6), com a falha registrada | **Não achei estudo primário** medindo isso contra burla de agentes **[não confirmado]** |

Medida testada no ImpossibleBench: testes ocultos quase zeram a trapaça mas pioram o resultado legítimo; **testes só leitura** preservam o resultado legítimo e impedem a edição; dar ao agente uma saída para pedir ajuda humana baixou o GPT-5 de 54% para cerca de 9% em Conflicting-SWEbench. Monitores com LLM acharam 86–89% num conjunto e 42–50% no outro. [30]

## 6. Mac x Linux

| Diferença | O que as fontes dizem | Como quebra |
|---|---|---|
| Maiúsculas | O git lista APFS entre sistemas sem distinção e ajusta `core.ignoreCase` no clone; a Apple oferece APFS case-sensitive como variante. Neste Mac, o volume `/` é `APFS`, não a variante. [49][51] | `Foo.rs` e `foo.rs` coincidem no Mac e divergem no Linux; import com caixa errada passa no Mac |
| `read_dir` | A ordem depende de plataforma e sistema de arquivos, pode mudar entre chamadas; ordene se precisar. [52] | Teste que assume ordem |
| `SystemTime` | Não é monotônico; a precisão depende do SO; a doc cita nanossegundos no Linux e 100 ns no Windows, sem número para macOS. [53] | Resolução no Mac: **[não medido]** |
| `Instant` | Linux usa `CLOCK_MONOTONIC`, Darwin `CLOCK_UPTIME_RAW`; não recua, mas pode saltar; contar suspensão não é especificado. [54] | Teste com tempo decorrido exato |
| Fim de linha | Mac e Linux usam LF; a normalização vem de `.gitattributes` (`text`, `eol`). [55] | Risco baixo entre os dois **[inferência]** |
| `cfg(target_os)` | cargo-mutants não entende. [23] | Falso `missed` ao mutar no Mac |

**GitHub Actions em repositório público:** runner padrão é grátis; `ubuntu-latest` tem 4 vCPU, 16 GB e 14 GB de SSD; também há `macos-latest` (3 vCPU M1, 7 GB). Job de até 6 h; 20 jobs simultâneos no plano Free (plano da organização **[não confirmado]**). Runner maior é pago. [56][57][58] O repositório é público e de organização (API do GitHub). Nenhum desses ambientes reproduz os 2 GB de produção **[inferência]**.

## 7. Fuso e ordem por horário

- **RFC 3339:** cadeias só ordenam como texto se tiverem o mesmo deslocamento, escrito igual, e o mesmo número de casas fracionárias. `-00:00` indica UTC conhecido com deslocamento local desconhecido. [59]
- **RFC 9557:** acrescenta sufixo como `[Europe/Paris]` e atualiza o sentido de `Z`, que deixa de indicar UTC como referência preferida. O sufixo serve para calcular datas futuras respeitando horário de verão. [60]
- **PostgreSQL:** linhas iguais em todas as expressões voltam em ordem dependente da implementação; com `LIMIT`, sem ordem única, o subconjunto é imprevisível. [41]
- **ClickHouse:** linhas com valores idênticos saem em ordem arbitrária e não determinística. [42]
- **Consequência [inferência]:** eventos de log com o mesmo horário precisam de desempate estável (ex.: horário, depois identificador), inclusive na paginação; o teste precisa criar empates.
- **Relógio que volta:** `SystemTime` pode recuar, e `duration_since` devolve erro nesse caso; a doc indica `Instant` para medir duração. `Instant` é opaco, útil só com `Duration`, portanto não serve como horário de evento. [53][54]
- **Injetar relógio:** a API Java diz que a boa prática é passar um `Clock` ao que precisa do instante, o que permite relógio fixo no teste. [61] Fowler manda envolver o relógio do sistema em rotina substituível. [62] `tokio::time::pause` (recurso `test-util`) só afeta o `Instant` do tokio, não o horário de parede. [63] Vitest controla a data com timers falsos. [64]
- **Rodar com outro `TZ`:** o mecanismo é documentado (`TZ` tem precedência no Linux; o Node aceita IDs como `Europe/Paris`). [65][66] **Não achei fonte primária** recomendando a prática como padrão; Fowler relata um colega que força rodadas perto da meia-noite para achar suposições de data. [62]
- **Mutação e tempo:** o Google suprime mutantes em prazos e temporizadores por serem pouco produtivos. [22]

## 8. Integração de trabalho paralelo

- **Conflito semântico (Fowler):** mudanças que o merge textual aceita, mas alteram o comportamento. Ferramenta não resolve; as defesas citadas começam por código com testes próprios. [67]
- **Regra "not rocket science" (Graydon Hoare):** manter automaticamente um repositório que sempre passa em todos os testes. O post original respondeu 403; atribuição e texto vêm de fontes secundárias **[não confirmado na fonte dona]**. [68]
- **Rodar no resultado do merge:** a checagem precisa valer para a combinação, não para cada branch isolada. No GitHub Actions, `pull_request` usa o commit de merge em `refs/pull/<n>/merge`. [69] O resultado fica velho se a base avança **[inferência]**; "branches atualizadas" (status estrito) força atualizar antes do merge. [70]
- **Merge queue:** garante as checagens contra a última base **e** as PRs à frente na fila; workflows precisam do evento `merge_group`; CI externo reage às branches `gh-readonly-queue/*`. Disponível em repositório público de organização. Com pouca PR simultânea, o ganho sobre o status estrito é menor **[inferência]**. [45]
- **Local:** `git merge-tree --write-tree` faz o merge sem tocar índice nem árvore, mas só mostra conflito textual; o semântico exige rodar a suíte num checkout do resultado **[inferência]**. [71] A branch `integracao/<nome>` da orquestração é o lugar natural para isso **[inferência]**.

## 9. Commits e teste instável

- **Conventional Commits 1.0.0:** tipo obrigatório, `feat` e `fix` com sentido definido; `!` ou rodapé `BREAKING CHANGE:` indicam quebra; outros tipos são permitidos. O formato não exige dizer o porquê. [72]
- **Google, small CLs:** refatoração costuma ir separada de funcionalidade ou correção; limpezas pequenas podem ficar juntas, a critério de autor e revisor; mudança de lógica vem com testes. [73] Sustenta P6.
- **`git bisect run`:** 0 = bom, 1 a 127 = ruim, **125 = não testável** (pula). Commit quebrado por outro motivo atrapalha a busca. [74] `git rebase --exec <cmd>` roda um comando após cada commit e para na falha. [75]
- **Instáveis no Google:** cerca de 1,5% das execuções e quase 16% dos testes têm alguma instabilidade; 84% das transições de passa para falha envolviam teste instável. Marcar como instável faz reportar só após 3 falhas seguidas, atrasando a descoberta; a quarentena pode esconder condição de corrida real. [76]
- **Nextest:** `--retries` marca como `flaky` quem passa ao repetir e, **por padrão, a rodada sai com 0**. `--flaky-result fail` (ou `flaky-result = "fail"`), desde 0.9.131, reprova mesmo assim, mas precisa de retries ligados. Versão atual: 0.9.152. [50][77] Junto com a mutação: instável gera conclusão errada. [23]

## 10. P7 e P8 em ferramenta

| Ferramenta | Versão e licença | O que acha | Limites |
|---|---|---|---|
| **knip** | 6.45.1, ISC [78] | Arquivos, dependências, exports, tipos, membros de enum sem uso; sai com 1; modo `--production` [79][80] | Não julga parâmetro especulativo nem classe com uma filha: segue com o revisor **[inferência]** |
| **cargo machete** | 0.10.1, MIT [77] | Dependência sem uso, rápido e **impreciso** pela própria doc; sai com 1 se acha, 2 em erro; `ignored` para falso positivo [81][82] | `--with-metadata` pode alterar `Cargo.lock` [81] |
| **cargo deny bans** | 0.21.0, MIT ou Apache-2.0 [77] | Lista `deny` de crates (P8: proibir um segundo cliente HTTP), versões duplicadas, curingas, dependência de workspace sem uso [83][84] | Só dependências, não padrão de código |
| **rustc `dead_code`** | do compilador | Itens não usados e **não exportados** [85] | `pub` em biblioteca fica fora **[inferência]** |
| **`unused_crate_dependencies`** | do compilador, desligado por padrão | Dependência não usada no crate [86] | Precisa ser ligado |

Knip e cargo machete cobrem a parte mecânica de P7; o `validador.md` já traz `cargo machete` e `cargo deny check`.

## O que não consegui confirmar

- Tempo real de mutação no projeto, número de mutantes por issue e `-j` ideal: **[não medido]**.
- Comportamento do Stryker com `--incremental` + `--mutate` + `break`, e com zero mutantes: li o código, não executei.
- Taxa de mutantes equivalentes em Rust; denominador exato de Kushigian et al.
- 73% de Just et al. e o resumo de Papadakis et al. 2018 vieram por busca, não do texto completo.
- Post original de Graydon Hoare (403). Preço da licença Arcmutate.
- Estudo primário ligando "vermelho antes do verde" à redução de burla de agentes.
- Resolução de relógio no macOS e efeito de testes rodando em 2 GB.

## Fontes

Consultadas em 2026-11-18.

1. crates.io, cargo-mutants: https://crates.io/crates/cargo-mutants ; release: https://github.com/sourcefrog/cargo-mutants/releases/tag/v27.1.0
2. Testing code changed in a diff: https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/book/src/in-diff.md (publicado em https://mutants.rs/in-diff.html)
3. `in_diff.rs`: https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/in_diff.rs
4. Exit codes: https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/book/src/exit-codes.md
5. `main.rs`: https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/main.rs
6. `outcome.rs` (cálculo da saída): https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/outcome.rs
7. Using the results: https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/book/src/using-results.md
8. mutants.out: https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/book/src/mutants-out.md
9. Timeouts: https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/book/src/timeouts.md
10. Workspaces: https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/book/src/workspaces.md
11. Parallelism: https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/book/src/parallelism.md
12. Nextest: https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/book/src/nextest.md
13. Baseline: https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/book/src/baseline.md
14. Filtering files: https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/book/src/skip_files.md
15. Filtering mutants: https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/book/src/filter_mutants.md
16. Config: https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/book/src/config-file.md , https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/src/config.rs
17. Stryker, configuração: https://stryker-mutator.io/docs/stryker-js/configuration/ ; npm: https://www.npmjs.com/package/@stryker-mutator/core
18. Métricas: https://stryker-mutator.io/docs/mutation-testing-elements/mutant-states-and-metrics/ ; saída: https://github.com/stryker-mutator/stryker-js/blob/master/packages/core/src/reporters/mutation-test-report-helper.ts
19. Attributes: https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/book/src/attrs.md ; crate: https://crates.io/crates/mutants
20. Incremental: https://stryker-mutator.io/docs/stryker-js/incremental/ ; https://github.com/stryker-mutator/stryker-js/blob/master/packages/core/src/mutants/incremental-differ.ts
21. CI: https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/book/src/ci.md ; exemplo: https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/examples/workflows/in-diff.yml ; in-place: https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/book/src/in-place.md
22. Petrović, Ivanković, Fraser, Just, Practical Mutation Testing at Scale: https://arxiv.org/abs/2102.11378
23. Limitations: https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/book/src/limitations.md ; Stability: https://github.com/sourcefrog/cargo-mutants/blob/v27.1.0/book/src/stability.md
24. Petrović et al., Does mutation testing improve testing practices?: https://arxiv.org/abs/2103.07189
25. Stryker, disable mutants: https://stryker-mutator.io/docs/stryker-js/disable-mutants/
26. Stryker, Vitest runner: https://stryker-mutator.io/docs/stryker-js/vitest-runner/
27. Maven Central, pitest-maven: https://repo1.maven.org/maven2/org/pitest/pitest-maven/maven-metadata.xml
28. PIT, Maven: https://pitest.org/quickstart/maven/
29. Arcmutate, Git Integration: https://docs.arcmutate.com/docs/git-integration.html ; repositório do PIT: https://github.com/hcoles/pitest
30. ImpossibleBench: https://arxiv.org/abs/2510.20270
31. METR, Recent Frontier Models Are Reward Hacking: https://metr.org/blog/2025-06-05-recent-reward-hacking/
32. Just et al., FSE 2014: https://homes.cs.washington.edu/~mernst/pubs/mutation-effectiveness-fse2014-abstract.html
33. Papadakis et al., ICSE 2018: https://ieeexplore.ieee.org/document/8453121
34. Chekam et al., ICSE 2017: https://discovery.ucl.ac.uk/10058915/7/Chekam_ICSE17.pdf
35. Petrović, Ivanković, State of Mutation Testing at Google: https://research.google/pubs/state-of-mutation-testing-at-google/ ; PDF lido: https://web.eecs.umich.edu/~weimerw/2022-481W/readings/mutation-google.pdf
36. Kushigian et al., ISSTA 2024: https://2024.issta.org/details/issta-2024-papers/53/Equivalent-Mutants-in-the-Wild-Identifying-and-Efficiently-Suppressing-Equivalent-Mu
37. Papadakis et al., Trivial Compiler Equivalence, ICSE 2015: https://orbilu.uni.lu/bitstream/10993/20289/1/ICSE15.pdf
38. Software Engineering at Google, cap. 13: https://abseil.io/resources/swe-book/html/ch13.html
39. Fowler, ContractTest: https://martinfowler.com/bliki/ContractTest.html
40. Baker et al., Monitoring Reasoning Models for Misbehavior: https://arxiv.org/abs/2503.11926
41. PostgreSQL, SELECT: https://www.postgresql.org/docs/current/sql-select.html ; LIMIT: https://www.postgresql.org/docs/current/queries-limit.html
42. ClickHouse, ORDER BY: https://clickhouse.com/docs/sql-reference/statements/select/order-by
43. Anthropic, Natural Emergent Misalignment from Reward Hacking: https://arxiv.org/abs/2511.18397
44. git diff: https://git-scm.com/docs/git-diff
45. GitHub, merge queue: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue
46. rustc, testes: https://doc.rust-lang.org/rustc/tests/index.html
47. nextest, listagem: https://nexte.st/docs/listing/
48. Vitest, CLI: https://vitest.dev/guide/cli
49. git config, `core.ignoreCase`: https://git-scm.com/docs/git-config
50. nextest, retries: https://nexte.st/docs/features/retries/
51. Apple, formatos no Utilitário de Disco: https://support.apple.com/guide/disk-utility/file-system-formats-available-in-disk-utility-dsku19ed921c/mac
52. Rust, `read_dir`: https://doc.rust-lang.org/std/fs/fn.read_dir.html
53. Rust, `SystemTime`: https://doc.rust-lang.org/std/time/struct.SystemTime.html
54. Rust, `Instant`: https://doc.rust-lang.org/std/time/struct.Instant.html
55. gitattributes: https://git-scm.com/docs/gitattributes
56. GitHub, runners: https://docs.github.com/en/actions/reference/runners/github-hosted-runners
57. GitHub, cobrança do Actions: https://docs.github.com/en/billing/concepts/product-billing/github-actions
58. GitHub, limites do Actions: https://docs.github.com/en/actions/reference/limits
59. RFC 3339: https://www.rfc-editor.org/rfc/rfc3339
60. RFC 9557: https://www.rfc-editor.org/rfc/rfc9557
61. Java, `Clock`: https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/time/Clock.html
62. Fowler, Eradicating Non-Determinism in Tests: https://martinfowler.com/articles/nonDeterminism.html
63. tokio, `pause`: https://docs.rs/tokio/latest/tokio/time/fn.pause.html
64. Vitest, datas: https://vitest.dev/guide/mocking/dates
65. tzset(3): https://man7.org/linux/man-pages/man3/tzset.3.html
66. Node.js, `TZ`: https://nodejs.org/api/cli.html
67. Fowler, SemanticConflict: https://martinfowler.com/bliki/SemanticConflict.html
68. Hoare (não acessado, 403): https://graydon2.dreamwidth.org/1597.html ; fórum do Bors, secundário: https://forum.bors.tech/t/other-apps-that-implement-the-nrsrose/51.html
69. GitHub, eventos: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
70. GitHub, branches protegidas: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
71. git merge-tree: https://git-scm.com/docs/git-merge-tree
72. Conventional Commits 1.0.0: https://www.conventionalcommits.org/en/v1.0.0/
73. Google, Small CLs: https://google.github.io/eng-practices/review/developer/small-cls.html
74. git bisect: https://git-scm.com/docs/git-bisect
75. git rebase: https://git-scm.com/docs/git-rebase
76. Google Testing Blog, Flaky Tests at Google: https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html
77. crates.io: https://crates.io/crates/cargo-nextest , https://crates.io/crates/cargo-machete , https://crates.io/crates/cargo-deny
78. npm, knip: https://www.npmjs.com/package/knip
79. knip, tipos de achado: https://knip.dev/reference/issue-types
80. knip em CI: https://knip.dev/guides/using-knip-in-ci ; CLI: https://knip.dev/reference/cli
81. cargo-machete, README: https://github.com/bnjbvr/cargo-machete
82. cargo-machete, `main.rs`: https://github.com/bnjbvr/cargo-machete/blob/main/src/main.rs
83. cargo-deny, bans: https://embarkstudios.github.io/cargo-deny/checks/bans/index.html
84. cargo-deny, configuração: https://embarkstudios.github.io/cargo-deny/checks/bans/cfg.html
85. rustc, lints ligados por padrão: https://doc.rust-lang.org/rustc/lints/listing/warn-by-default.html
86. rustc, lints desligados por padrão: https://doc.rust-lang.org/rustc/lints/listing/allowed-by-default.html
