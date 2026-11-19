# Prova dos candidatos a banco de logs

**Estado em 18/11/2026: bancada testada só em ambiente local. Nenhuma medida daqui vale para a escolha do banco.**
A prova na AWS ainda não começou. Ticket: [Medir os candidatos a banco de logs com dados sintéticos](https://github.com/stacklabs3/monitora-ai/issues/21).
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
| Buscas frias com erro no OpenSearch | A bancada considerava o banco pronto antes de os índices abrirem | Esperar `wait_for_status=yellow` |

## Resultados da prova completa

<!-- Preenchido ao fim de cada banco com resultados-simulacao/<banco>. -->
Em andamento desde 19/11/2026 07:28, um banco por vez: PostgreSQL, ClickHouse e OpenSearch.

## O que o Docker não mediu

- **Disco real:** o volume do Docker no Mac não é o disco do Lightsail, nem em velocidade nem em gravação segura.
- **Saldo de CPU:** o limite de 0,4 CPU simula só o mínimo garantido; o acúmulo e o gasto de saldo da AWS não existem aqui.
- **Parada pela AWS:** a parada forçada foi da VM local (`limactl stop --force`), não a do Lightsail numa máquina saudável.
- **CPU da biblioteca:** a medida por processo oscilou demais no Mac (seção da biblioteca).
- **Vercel:** as 20 publicações foram simuladas trocando o processo, não publicadas na Vercel.
