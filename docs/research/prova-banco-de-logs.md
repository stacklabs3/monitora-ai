# Prova dos candidatos a banco de logs

**Estado em 22/11/2026: prova completa encerrada na máquina simulada do Docker. Todos os números são SIMULADOS.**
PostgreSQL reprovou na rodada de 24 h (busca), ClickHouse reprovou no histórico de 30 dias (falta de memória) e OpenSearch passou em todas as fases obrigatórias. A AWS não foi usada; a validação fica em [Validar o banco na AWS](https://github.com/stacklabs3/monitora-ai/issues/60). A comparação final está em [Tabela comparativa](#tabela-comparativa-simulado) e o custo em [Custo mensal estimado](#custo-mensal-estimado). Ticket: [Medir os candidatos a banco de logs com dados sintéticos](https://github.com/stacklabs3/monitora-ai/issues/21).
Regras, metas e cenários: [Definir prova de conceito e critérios de avaliação](https://github.com/stacklabs3/monitora-ai/issues/9).

## O que existe

| Peça | Onde | O que faz |
|---|---|---|
| Servidor mínimo em Rust | [`servidor.rs`](prova-banco-de-logs/bancada/src/bin/servidor.rs) | Recebe JSON com gzip, agrupa por 200 ms, grava, só então confirma e barra reenvio por 16 min |
| Adaptadores | [`bancos/`](prova-banco-de-logs/bancada/src/bancos/) | A única parte que muda por banco |
| Gerador | [`gerador.rs`](prova-banco-de-logs/bancada/src/bin/gerador.rs), [`geracao.rs`](prova-banco-de-logs/bancada/src/geracao.rs) | Carga determinística em taxa aberta, histórico, picos, vínculos tardios, reenvio, buscas e medida de aparecer na busca |
| Conferidor | [`conferidor.rs`](prova-banco-de-logs/bancada/src/bin/conferidor.rs) | Compara as confirmações anotadas fora da máquina com o que está no banco |
| Relatório | [`relatorio.rs`](prova-banco-de-logs/bancada/src/bin/relatorio.rs) | p50, p95, p99 e máximo por medida |
| Métricas da máquina | [`coletar-metricas.sh`](prova-banco-de-logs/scripts/coletar-metricas.sh) | CPU, memória, swap, disco e E/S |
| Teste local | [`testar-local.sh`](prova-banco-de-logs/scripts/testar-local.sh), [`compose.yml`](prova-banco-de-logs/compose.yml) | Ponta a ponta em um banco, com queda do servidor e controle negativo |

Versões: ClickHouse 26.10.4.207, OpenSearch 3.9.0, PostgreSQL 18.7, Rust 1.99.1. Configurações em [`config/`](prova-banco-de-logs/config/).

## Teste local (só confere a bancada)

Cada banco recebeu 40 mil eventos de histórico e 150 s em ritmo real com pico de 120/s, reenvio e `kill -9` do servidor no meio, em contêiner de até 1,5 GB num Mac. **Estes tempos não representam a máquina de 2 GB.**

| | ClickHouse | OpenSearch | PostgreSQL |
|---|---|---|---|
| Confirmados / perdidos / duplicados | 45.038 / 0 / 0 | 45.038 / 0 / 0 | 45.038 / 0 / 0 |
| Reenvios barrados | 54 | 54 | 54 |
| Perda plantada detectada | sim | sim | sim |
| Duplicata plantada detectada | sim | sim | sim |

Ensaios em escala reduzida, com os três bancos aprovados:

| Ensaio | Script | O que confere |
|---|---|---|
| Banco fora | [`testar-falhas-local.sh`](prova-banco-de-logs/scripts/testar-falhas-local.sh) | 20 s fora no pico: nada confirmado na queda, 0 perdidos e 0 duplicados na volta |
| Disco na reserva | idem | Envio recebe 503 com `Retry-After` e a busca continua |
| Exclusões | idem | Pessoa e dia vencido somem da busca |
| Busca lenta | [`testar-limites-local.sh`](prova-banco-de-logs/scripts/testar-limites-local.sh) | Corte com resultado parcial, recusa acima de 2 simultâneas, busca garantida respondendo |
| Restauração | [`testar-restauracao-local.sh`](prova-banco-de-logs/scripts/testar-restauracao-local.sh) | Cópia cifrada medida; banco apagado, restaurado e limpo antes de abrir fica idêntico ao original, sem pessoa excluída nem dia vencido |
| Degraus de carga | [`degraus-de-carga.sh`](prova-banco-de-logs/scripts/degraus-de-carga.sh) | Dobra a carga até quebrar meta; uma meta impossível para no primeiro degrau |

O corte de busca lenta foi ensaiado com prazo de 5 ms. Com pouco dado, o corte pode vir do servidor e não do banco; o comportamento do banco com volume real só aparece na máquina-alvo.

## Biblioteca sintética (ensaio local)

[`medicao-node/`](prova-banco-de-logs/medicao-node/) tem API em Fastify 5.12.1 e pino 10.3.1, com e sem a biblioteca, a 200 pedidos/s e cerca de 5 linhas de log por pedido, com 20% das compras trazendo dado pessoal sintético. Rodado com [`medir-node-local.sh`](prova-banco-de-logs/scripts/medir-node-local.sh), 3 rodadas por cenário.

| | Node 20.20.2 | Node 22.23.5 | Node 24.22.3 |
|---|---|---|---|
| 200 compras simultâneas: ocorrência trocada / segredo enviado / `/health` enviado | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| Tempo dentro da biblioteca por pedido | 0,141 ms | 0,128 ms | 0,134 ms |
| Acréscimo no p99 | +1,2 ms | +0,2 ms | -0,5 ms |
| Acréscimo de memória | +10 MB | +14 MB | +17 MB |

Com o recebedor fora por 20 s a 20, 120 e 500 pedidos/s, a fila ficou em até 2.048 eventos, toda perda foi contada e todos os erros chegaram.

**A meta de até 5% de CPU ainda não tem resultado.** A CPU por processo oscilou demais neste Mac: em Node 24 a biblioteca pareceria reduzir 22%, o que é impossível. A medida vale só na máquina-alvo. Atenção para lá: esta API quase não faz trabalho (cerca de 0,67 ms de CPU por pedido), então 0,13 ms pesa perto de 20% sobre ela.

## Site Next sintético (ensaio local)

[`site-next/`](prova-banco-de-logs/medicao-node/site-next/) usa Next 16.3.8 e captura `console.warn` e `console.error`. [`medir-site-local.sh`](prova-banco-de-logs/scripts/medir-site-local.sh) simula 20 publicações trocando o processo, e isto **não representa a Vercel**, onde o encerramento é outro.

| | 20 publicações com SIGTERM | Controle: 3 publicações com SIGKILL |
|---|---|---|
| Avisos "pode ter perdido mais" | 1 | 3 |
| Eventos esperados / recebidos | 1.600 / 1.600 | 240 / 234 |

Esta medida só informa e não reprova banco (#9). Na Vercel o site precisa alcançar um recebedor público, o que entra no pedido de autorização.

## Leitura confirmada da meta de busca

O #9 diz "95% em até 5 s" e "reprova na hora: busca garantida acima de 5 s". O responsável decidiu em 18/11/2026 que **vale o p95 de cada tipo de busca**: um tipo reprova quando o p95 passa de 5 s, e o pior tempo fica registrado sem reprovar sozinho. O [`relatorio.rs`](prova-banco-de-logs/bancada/src/bin/relatorio.rs) aplica essa regra.

## Prova simulada (números SIMULADOS)

**Decisão do responsável em 18/11/2026: a AWS só entra quando o backend e o frontend estiverem prontos.** O #21 fecha com os números abaixo, todos **SIMULADOS**. Eles não substituem a máquina de 2 GB em `sa-east-1` pedida no #9. A validação fica em "Validar o banco na AWS".

**Regra aplicada (RP1, retrospectiva de 19/11/2026):** toda falha provocada comprova que aconteceu e tem um controle negativo que precisa reprovar. Sem os dois, o resultado é inválido.

### Como roda

| Peça | O que faz |
|---|---|
| [`compose.simulacao.yml`](prova-banco-de-logs/compose.simulacao.yml) | Banco e servidor no mesmo contêiner: 2 GB sem swap, 0,4 CPU (mínimo garantido de 2 vCPU a 20%). O histórico carrega com 2 CPUs, igual para todos |
| [`simular-prova.sh`](prova-banco-de-logs/scripts/simular-prova.sh) | Ordem do #9. Cada fase roda em processo próprio, com `set -e`, `pipefail` e limite de tempo, e retoma da última fase concluída |
| [`rodar-prova-completa.sh`](prova-banco-de-logs/scripts/rodar-prova-completa.sh) | Roda um banco por vez, fora da sessão, e guarda os resumos em [`resultados-simulacao/`](prova-banco-de-logs/resultados-simulacao/) |
| [`comum-controle.sh`](prova-banco-de-logs/scripts/comum-controle.sh) | Controle negativo do conferidor pela API: perda e duplicata plantadas precisam reprovar, e a duplicata é apagada depois |
| [`comum-tempo.sh`](prova-banco-de-logs/scripts/comum-tempo.sh) | Limite de tempo que encerra o grupo de processos inteiro |

Versões: ClickHouse 26.10.4.207, OpenSearch 3.9.0 e PostgreSQL 18.7, em Docker Desktop num Mac com 10 CPUs. Configurações em [`config/`](prova-banco-de-logs/config/), sem ajuste por banco além do que está registrado aqui.

| Cenário | Como prova que a falha aconteceu | Controle negativo |
|---|---|---|
| Conferência | Exige pelo menos um evento confirmado | Perda e duplicata plantadas reprovam; meta impossível reprova no relatório |
| Banco fora | Contêiner parado, servidor sem responder e lotes que precisaram de nova tentativa > 0 | Nada confirmado durante a queda |
| Reenvio | Duplicados barrados depois do reinício do servidor > 0, e o servidor visto fora do ar | Conferência com 0 duplicados |
| Disco cheio | 503 com `Retry-After` e busca trazendo linhas | Sem reserva, o mesmo envio passa (200) |
| Apagar com carga | Linhas das 100 pessoas e dos dias vencidos > 0 antes | Uma pessoa não excluída mantém as linhas |
| Restauração | Volume apagado de fato; pessoa e dias vencidos tinham linhas antes | Restaurado idêntico ao original, evento a evento |
| Queda da máquina (VM) | Boot novo em cada reinício e carga confirmando antes de cada um | Sem reinício, o identificador de boot não muda |

### Ensaio do roteiro em escala 1/120

Os três bancos rodaram todas as fases em 19/11/2026 (`ESCALA=120`), junto com a VM, só para conferir o roteiro. **Os tempos do ensaio não valem como medida.** As metas quebradas apareceram só nos degraus de carga e, no OpenSearch, em apagar com carga (p95 de 1,2 s para confirmar), e são limites de banco, não da bancada.

### Quedas na máquina virtual (Lima/vz, 2 vCPU e 2 GB, disco cifrado)

[`ensaiar-maquina-local.sh`](prova-banco-de-logs/scripts/ensaiar-maquina-local.sh) cria uma VM nova por banco e roda [`quedas-sysrq.sh`](prova-banco-de-logs/scripts/quedas-sysrq.sh): **20 quedas com `sysrq b` e 3 paradas forçadas (`limactl stop --force`)**, sempre com carga e com o registro de confirmações fora da VM. SIMULADO: é a VM do Mac, não a AWS.

| | ClickHouse | OpenSearch | PostgreSQL |
|---|---|---|---|
| Reinícios com boot novo | 23 de 23, **só com o limite de partes quebradas aumentado** | 23 de 23 | 23 de 23 |
| Confirmados / perdidos / duplicados | 42.838 / 0 / 0 | 42.838 / 0 / 0 | 42.838 / 0 / 0 |
| Volta do servidor (média / maior) | 0,7 s / 2 s | 6,3 s / 10 s | 1,3 s / 3 s |
| Pico de memória banco + servidor, carga curta | 708 MB | 1.342 MB | 84 MB |
| Controle negativo (perda e duplicata plantadas) | reprovou | reprovou | reprovou |

**ClickHouse com a configuração padrão não volta sozinho de uma queda.** Na primeira queda com `sysrq`, a tabela não abriu: `Suspiciously many (104 parts, 0.00 B in total) broken parts`, porque o limite padrão `max_suspicious_broken_parts` é 100 ([configurações MergeTree](https://clickhouse.com/docs/operations/settings/merge-tree-settings#max_suspicious_broken_parts)). O servidor ficou de pé e nenhum envio foi confirmado por 5 min. Com o limite em 100.000, a tabela abriu, as 104 partes vazias foram para `detached` e os 418 eventos confirmados antes da queda estavam lá, sem perda nem duplicata. Com esse ajuste, registrado em `MAXIMO_PARTES_QUEBRADAS`, os 23 reinícios passaram. A escolha entre aceitar esse ajuste ou contar como reprovação fica no [Escolher o banco de logs](https://github.com/stacklabs3/monitora-ai/issues/22).

## Diagnósticos de 19/11/2026

| Sintoma | Causa provada | Correção |
|---|---|---|
| Ensaio de quedas travou por mais de 4 h | O journal da VM mostra que a leitura do `boot_id` chegou nas quedas 1 e 2 e **nunca chegou** na 3, embora o servidor tenha voltado às 20:04:07. O `limactl shell` ficou preso no Mac, sem limite. A VM seguiu ligada: a pista de que o `sysrq` pararia a VM não se confirmou. Em 12 reinícios seguidos sem carga a trava não voltou, então o motivo dentro do `limactl`/ssh segue sem prova | Toda chamada à VM tem limite e nova tentativa, e cada corte vira aviso no registro. Nas 69 quedas e paradas seguintes, nenhum aviso |
| `apagar_com_carga` com 18 linhas de pessoas excluídas | **Defeito da bancada.** As 18 linhas (17 da carga e 1 da sonda) foram recebidas depois do início da exclusão: a carga cria vínculos tardios com horário de até 2 h atrás. Nenhuma linha antiga sobreviveu | A conferência olha só eventos com mais de 2 h e 5 min antes do corte; a meta e a exclusão são julgadas separadamente |
| "Passou" sem testar | As fases rodavam dentro de um `if`, que desliga o `set -e`, e o `\| tee` escondia o código de saída | Cada fase roda em processo próprio, com `set -e` e `pipefail` |
| Banco fora no OpenSearch sem nenhum lote repetido | O gerador saía 40 s depois da carga, sem esperar os lotes ainda tentando: o OpenSearch voltou depois disso e esses lotes não foram contados nem como confirmados nem como perdidos | O gerador espera todo lote em voo até confirmar ou ser contado como perdido |
| Restauração do ClickHouse com 340 linhas a mais | A parte restaurada guarda a versão de dados do original (17), e a primeira exclusão da tabela nova recebe o número 2: o ClickHouse 26.10 a marca como feita sem apagar nada. Reproduzido isolado | Restaurar numa tabela auxiliar e reanexar as partições numa tabela vazia, o que renumera as partes. É um passo a mais de operação no ClickHouse |
| OpenSearch morto por falta de memória na conferência do histórico (20/11) | **Defeito da bancada.** O adaptador do OpenSearch juntava a lista inteira de eventos presentes (30 milhões, ~1 GB) na memória do servidor de teste antes de mandar o primeiro bloco; os outros dois bancos mandavam em fluxo. A conferência repetida sobre o mesmo histórico, com o servidor corrigido, passou: 30.000.000 confirmados, 0 perdidos, 0 duplicados, pico de 1,47 GB, sem falta de memória | Listagem página a página. A reprovação foi anulada e o OpenSearch retomou da bateria; o servidor de teste mudou só no OpenSearch, porque os outros dois já tinham parado por outro motivo |
| Buscas frias com erro no OpenSearch | A bancada considerava o banco pronto antes de os índices abrirem | Esperar `wait_for_status=yellow` |

## Diagnósticos de 22/11/2026 (OpenSearch, fases não obrigatórias)

Por decisão do responsável em 22/11/2026, as três fases abaixo ficam **registradas sem repetir**: nenhuma é uma falha do banco provada pela RP1, e repetir faria parte da prova de novo.

| Fase | Sintoma | O que está provado | O que não está | Registro |
|---|---|---|---|---|
| Apagar com carga | Erro 500 numa chamada a `/v1/exclusoes`; 6.361 eventos sem confirmação depois de 5 min | Havia linhas para apagar (10.000 de pessoas, 100 vencidas, 100 da pessoa mantida). A carga perdeu ritmo durante a exclusão. O adaptador manda 100 `_delete_by_query` em sequência, cada um com `refresh=true`, por um cliente HTTP com limite de 120 s | O log do servidor de teste se perdeu quando a fase seguinte recriou o contêiner, então não dá para saber se o 500 veio do limite de 120 s ou do banco. Também não se sabe se apagar as 100 pessoas numa chamada só manteria a carga dentro da meta | **inconclusivo** |
| Degraus | O primeiro degrau, de 12/s, ficou fora das metas: confirmar p95 260 s, 2.128 lotes com "tente depois" | Começou 0 s depois da falha anterior. A CPU média ficou em 40,5% de 1 CPU, que é o teto de 0,4. Na rodada de 24 h, o mesmo ritmo usou 5,5% (controle). As exclusões aceitas pelo banco seguem rodando depois que o cliente desiste | A folga do OpenSearch sem exclusões rodando em segundo plano | **não medido** (degrau contaminado pela fase anterior) |
| Restauração | `curl: (28)` depois de 7.200 s com 954.553.096 bytes recebidos | A cópia cifrada foi medida: **10.817.177.616 bytes em 1.206 s**. Quem estourou o limite de 2 h foi a listagem de conferência do banco **original** (24.045.000 de cerca de 31 milhões de eventos), a 0,4 CPU, antes de apagar ou restaurar qualquer coisa. Com 2 CPUs, a conferência do histórico tinha passado | O tempo de restaurar, e se a cópia restaurada sai limpa | **não medido** (limite de tempo da bancada) |

## Resultados da prova completa

<!-- Preenchido ao fim de cada banco com resultados-simulacao/<banco>. -->
Um banco por vez, a partir de 19/11/2026 07:28: PostgreSQL, ClickHouse e OpenSearch. Resumos brutos em [`resultados-simulacao/`](prova-banco-de-logs/resultados-simulacao/). Tudo **SIMULADO**.

### PostgreSQL 18.7: REPROVADO na rodada de 24 h (busca)

[`config/postgresql.conf`](prova-banco-de-logs/config/postgresql.conf): `shared_buffers` 512 MB (25% de 2 GB, guia oficial), `work_mem` 16 MB, gravação segura ligada. Partição por dia, índice GIN em `termos` e em `palavras`, BRIN em `ts_ms`.

| Fase | Resultado | Meta do #9 |
|---|---|---|
| Etapa de 2 h | **passou**: confirmar p95 222 ms, aparecer p95 293 ms, 151.198 confirmados, 0 perdidos, 0 duplicados, 1.461 reenvios barrados | confirmar p95 até 1 s, aparecer p95 até 10 s, 0 perdidos e duplicados |
| Controle do conferidor e do relatório | **passou**: perda e duplicata plantadas reprovaram; meta impossível reprovou | precisam reprovar |
| Histórico de 30 dias (30 milhões de eventos, 2 CPUs) | **passou** em 2 h 46 min; disco depois do histórico: **58,5 GB** | sem meta de tempo; disco entra em "dias que cabem" |
| Bateria de buscas em 30 dias | **meta quebrada** (fase não obrigatória). Fria: `accountId` em 30 d p95 29 s, linha do tempo em 30 d 10,7 s, `status` em 1 d 9,4 s, palavras em 1 d 8,1 s, família em 1 d 6,1 s; `ocorrencia` em 30 d com erro. Dentro: correlação (até 0,9 s em 30 d), telefone (0,3 s), valor, origem e nível, e todas na janela de 1 h | cada tipo com p95 até 5 s |
| Rodada de 24 h | **REPROVOU**. Interrompida a pedido do responsável depois de 13,6 h, com a reprovação já certa. Busca: p95 entre 43 e 58 s em todos os tipos, 10.709 buscas com erro (estouraram 60 s). Aparecer na busca: p50 46 s, p95 115 s, 4.593 sondas não vistas em 120 s. Ingestão: confirmar p95 389 ms, 0 lotes com "tente depois", 0 sem confirmação | busca p95 até 5 s; aparecer p95 até 10 s e nenhum acima de 60 s |
| Banco fora, reenvio, disco cheio, apagar com carga, degraus, restauração, disco por valores | **não rodaram**: o banco parou na reprovação | — |

**Leitura:** com 0,4 CPU, o PostgreSQL grava no ritmo pedido, mas não responde as buscas a tempo depois que o histórico de 30 dias está no disco. Na bateria, as buscas lentas são as de termo frequente em janela longa. Nas 24 h, as buscas em horário fixo se acumulam atrás das 4 conexões de leitura do servidor de teste, e todo tipo de busca passa a esperar a fila, inclusive a de 1 h. A memória do contêiner encostou nos 2 GB, mas a maior parte era cache de disco: no histórico, ~1,0 GB eram memória de fato (545 MB de `shared_buffers` e ~456 MB dos processos, quase tudo do servidor de teste guardando os códigos de reenvio). A CPU média do contêiner foi de 36% de 1 CPU, contando o histórico com 2 CPUs.

**O que não se sabe:** se com mais CPU (a AWS dá saldo acima de 0,4) o PostgreSQL passaria. O Docker não simula saldo de CPU (ver [Validar o banco na AWS](https://github.com/stacklabs3/monitora-ai/issues/60)).

### ClickHouse 26.10.4.207: REPROVADO no histórico de 30 dias (falta de memória)

[`config/clickhouse-pouca-memoria.xml`](prova-banco-de-logs/config/clickhouse-pouca-memoria.xml) (guia oficial de pouca memória: `max_server_memory_usage` 1,2 GB, 2 tarefas de junção). Tabela com `fsync_after_insert = 1` e `fsync_part_directory = 1`, partição por dia. Diagnóstico completo em [`resultados-simulacao/clickhouse/diagnostico.txt`](prova-banco-de-logs/resultados-simulacao/clickhouse/diagnostico.txt).

| Fase | Resultado | Meta do #9 |
|---|---|---|
| Etapa de 2 h | **passou**: 151.198 confirmados, 0 perdidos, 0 duplicados | confirmar p95 até 1 s, aparecer p95 até 10 s, 0 perdidos e duplicados |
| Controle do conferidor e do relatório | **passou** | precisam reprovar |
| Histórico de 30 dias (30 milhões de eventos, 2 CPUs) | **REPROVOU**. Levou 12,3 h (o PostgreSQL levou 2,8 h) e ficou 6,2 GB em disco (o PostgreSQL ficou 58,5 GB). Na última hora, as junções de partes em segundo plano ocuparam todo o limite de memória: 45.943 junções e 2.121 inserções falharam com `MEMORY_LIMIT_EXCEEDED`, e 10.000 eventos ficaram sem confirmação depois de 5 min. A conferência, que só lê três colunas, foi parada pelo controle de memória do ClickHouse | "falta de memória" reprova na hora |
| Bateria, 24 h e cenários de falha | **não rodaram**: o banco parou na reprovação | — |

**Leitura:** o ClickHouse guarda o histórico em um décimo do disco do PostgreSQL, mas, com 1,2 GB de limite e 2 CPUs, não deu conta de juntar as partes pequenas que a carga cria. As gravações foram recusadas e a leitura caiu. Isso também explica a queda de ritmo da carga a partir de 25 milhões de eventos. Não houve ajuste fora do guia oficial. Ajustes possíveis, como limitar a memória das junções, usar inserções assíncronas ou gravar lotes maiores, mudam a configuração comparada e ficam para o [Escolher o banco de logs](https://github.com/stacklabs3/monitora-ai/issues/22), junto com o limite de partes quebradas da queda.

### OpenSearch 3.9.0: PASSOU em todas as fases obrigatórias

[`compose.yml`](prova-banco-de-logs/compose.yml): heap fixo de 700 MB (`-Xms700m -Xmx700m`), um índice por dia. A prova foi de 20/11/2026 16:53 a 22/11/2026 03:26.

| Fase | Resultado | Meta do #9 |
|---|---|---|
| Etapa de 2 h | **passou**: confirmar p95 223 ms, aparecer p95 5,3 s, 151.198 confirmados, 0 perdidos, 0 duplicados, 1.461 reenvios barrados | confirmar p95 até 1 s, aparecer p95 até 10 s, 0 perdidos e duplicados |
| Controle do conferidor e do relatório | **passou**: perda e duplicata plantadas reprovaram; meta impossível reprovou | precisam reprovar |
| Histórico de 30 dias (30 milhões de eventos, 2 CPUs) | **passou** em 2 h 27 min, com 0 eventos sem confirmação; conferência com 30.000.000 confirmados, 0 perdidos, 0 duplicados (a primeira reprovação foi anulada, ver [Diagnósticos de 19/11/2026](#diagnósticos-de-19112026)); disco depois do histórico: **11,2 GB** | sem meta de tempo; disco entra em "dias que cabem" |
| Bateria de buscas em 30 dias | **meta quebrada** (fase não obrigatória) só num tipo: linha do tempo em 30 d, fria, com p95 de 6,1 s e resultado parcial (5.000 linhas). Nas duas buscas quentes, o mesmo tipo levou 4,5 s e 3,2 s. Todo outro tipo, frio, ficou em até 1,2 s | cada tipo com p95 até 5 s |
| Rodada de 24 h | **passou**: 1.231.198 confirmados, 0 perdidos, 0 duplicados, 12.447 reenvios barrados. Confirmar p95 222 ms (máximo 2,1 s), 0 lotes com "tente depois", 0 sem confirmação. Aparecer na busca p95 5,2 s (máximo 9,5 s), 0 sondas não vistas. Busca: o maior p95 foi o da linha do tempo em 30 d, 4,5 s (máximo 7,8 s, sempre parcial); os demais tipos ficaram abaixo de 0,5 s. CPU média 5,5% de 1 CPU (2,75% por vCPU). Disco depois das 24 h: 11,7 GB | busca p95 até 5 s; aparecer p95 até 10 s e nenhum acima de 60 s; confirmar p95 até 1 s; CPU até 20% por vCPU |
| Banco fora (5 e 20 min no pico) | **passou**: 0 confirmados durante a queda, 0 perdidos e 0 duplicados na conferência. Lotes contados como perdidos pelo gerador: 2.410 e 9.739; lotes repetidos: 5.901 e 12.543; atraso zerado em 196 s e 116 s | nada confirmado na queda, sem duplicar, perda contada, atraso zerado em 10 min |
| Reenvio com reinício do servidor | **passou**: 141 reenvios barrados depois do reinício, 0 duplicados, 0 perdidos | 0 duplicados |
| Disco cheio | **passou**: envio recebeu 503 com `Retry-After` e a busca trouxe 100 linhas; sem reserva, o mesmo envio deu 200 (controle) | "tente depois" e busca continuando |
| Apagar com carga | **inconclusivo** (fase não obrigatória): erro 500 na exclusão e 6.361 eventos sem confirmação; ver [Diagnósticos de 22/11/2026](#diagnósticos-de-22112026-opensearch-fases-não-obrigatórias) | nada volta na busca, buscas em até 5 s |
| Degraus de carga | **não medido** (fase não obrigatória): o degrau base herdou as exclusões da fase anterior | dobrar até quebrar uma meta |
| Restauração | **cópia cifrada medida: 10,8 GB (10.817.177.616 bytes) em 20 min**; restauração **não medida**, porque a listagem de conferência estourou o limite de 2 h da bancada | em até 4 h, sem excluído ou vencido visível |
| Disco por valores (1 dia, 2 CPUs) | **passou**: 0,97 GB com os valores normais e 0,99 GB com o dobro de valores distintos | só informa |

**Leitura:** com 0,4 CPU, o OpenSearch gravou, confirmou e respondeu as buscas dentro das metas durante as 24 h, com 30 dias de histórico no disco, e passou nas quedas da VM e nos cenários de falha obrigatórios. A busca mais perto do limite é a linha do tempo em 30 dias: 4,5 s nas 24 h e 6,1 s fria na bateria. A memória do contêiner ficou em média em 1,6 GB e chegou a 1,83 GB nas 24 h. Essa medida inclui o cache dos arquivos do índice que o OpenSearch mapeia na memória, e a simulação não separou banco + servidor sem cache (na VM, com carga curta, deu 1.342 MB). **A meta de 1,5 GB de memória não foi conferida.**

**O que não se sabe:** se a restauração cabe em 4 h e sai limpa, quanta folga de carga existe e se a exclusão com carga cumpre a meta. Os três ficam para [Validar o banco na AWS](https://github.com/stacklabs3/monitora-ai/issues/60), com a bancada corrigida.

## O que o Docker não mediu

- **Disco real:** o volume do Docker no Mac não é o disco do Lightsail, nem em velocidade nem em gravação segura.
- **Saldo de CPU:** o limite de 0,4 CPU simula só o mínimo garantido; o acúmulo e o gasto de saldo da AWS não existem aqui.
- **Parada pela AWS:** a parada forçada foi da VM local (`limactl stop --force`), não a do Lightsail numa máquina saudável.
- **CPU da biblioteca:** a medida por processo oscilou demais no Mac (seção da biblioteca).
- **Vercel:** as 20 publicações foram simuladas trocando o processo, não publicadas na Vercel.
- **Memória sem cache:** o contêiner mede banco, servidor e cache de arquivos juntos; banco + servidor sem cache só foi medido na VM, com carga curta.

## Tabela comparativa (SIMULADO)

Na ordem do #9, sem vencedor: a escolha fica em [Escolher o banco de logs](https://github.com/stacklabs3/monitora-ai/issues/22). Máquina simulada: 2 GB sem swap, 0,4 CPU, disco de 60 GB do plano de US$ 12 ([pesquisa da prova de conceito](https://github.com/stacklabs3/monitora-ai/blob/research/prova-de-conceito/docs/research/prova-de-conceito.md)).

| | PostgreSQL 18.7 | ClickHouse 26.10.4.207 | OpenSearch 3.9.0 |
|---|---|---|---|
| Resultado | **reprovou** na rodada de 24 h (busca) | **reprovou** no histórico (falta de memória) | **passou** nas fases obrigatórias |
| Tempo de busca (p95 por tipo, meta 5 s) | 24 h: 43 a 58 s em todos os tipos. Bateria fria: até 29 s | **não medido**: parou antes da bateria | 24 h: maior p95 4,5 s (linha do tempo 30 d), os outros abaixo de 0,5 s. Bateria fria: 6,1 s na linha do tempo 30 d e até 1,2 s nos outros |
| Disco por dia | 1,95 GB (58,5 GB ÷ 30 dias de histórico) | 0,21 GB (6,2 GB ÷ 30, com muitas partes ainda sem junção) | 0,48 GB (aumento na rodada de 24 h); 0,37 GB pelo histórico; 0,97 GB num dia carregado isolado |
| Dias que cabem em 60 GB (teto, sem descontar sistema e reserva) | ~30 | ~290 | ~125 (pela rodada de 24 h); ~61 (pelo dia isolado) |
| Folga de carga (degraus) | **não medido**: parou antes | **não medido**: parou antes | **não medido**: degrau contaminado pela fase anterior |
| Simplicidade de operar (passos extras observados) | nenhum até onde rodou (não chegou à restauração) | **dois**: aumentar `max_suspicious_broken_parts` para a tabela abrir depois de uma queda, e restaurar numa tabela auxiliar para depois reanexar as partições | nenhum passo extra; volta do servidor depois de queda mais lenta (6,3 s em média, 10 s no pior caso, na VM) |

## Custo mensal estimado

`custo mensal ESTIMADO = US$ 12 da máquina + backup de 7 cópias + rede acima de 1,5 TB × US$ 0,15/GB` (fórmula do #9). Preços de `sa-east-1` da [pesquisa da prova de conceito](https://github.com/stacklabs3/monitora-ai/blob/research/prova-de-conceito/docs/research/prova-de-conceito.md): snapshot US$ 0,05/GB-mês; bucket Lightsail US$ 3 até 100 GB e US$ 5 até 250 GB, com excedente de US$ 0,023/GB-mês; S3 Standard US$ 0,0405/GB-mês.

**Rede:** a carga é de 1 milhão de eventos por dia. Pela mistura do #9, o evento médio tem cerca de 633 B (0,75 × 450 + 0,20 × 800 + 0,05 × 2.500 + 0,00001 × 1.048.576). Isso dá 0,63 GB por dia e cerca de 19 GB por mês, contra 1.500 GB incluídos. Excedente: 0 GB × US$ 0,15 = **US$ 0**.

| | Base do backup | 7 cópias | Snapshot | Bucket | S3 | Total (snapshot / bucket / S3) |
|---|---|---|---|---|---|---|
| PostgreSQL | **ESTIMADO pelo disco** depois do histórico (58,5 GB) | 409,4 GB | US$ 20,47 | US$ 8,67 (US$ 5 + 159,4 GB × US$ 0,023; não cabe no de US$ 3) | US$ 16,58 | US$ 32,47 / US$ 20,67 / US$ 28,58 |
| ClickHouse | **ESTIMADO pelo disco** depois do histórico (6,2 GB) | 43,4 GB | US$ 2,17 | US$ 3,00 | US$ 1,76 | US$ 14,17 / US$ 15,00 / US$ 13,76 |
| OpenSearch | **medido**: cópia cifrada de 10,82 GB | 75,7 GB | US$ 3,79 | US$ 3,00 | US$ 3,07 | US$ 15,79 / US$ 15,00 / US$ 15,07 |

Cópias completas, sem desconto por snapshot incremental. O custo é ESTIMADO sobre números SIMULADOS, e a AWS não cobrou nada.
