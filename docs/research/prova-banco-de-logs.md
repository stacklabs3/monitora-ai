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

## Leitura confirmada da meta de busca

O #9 diz "95% em até 5 s" e "reprova na hora: busca garantida acima de 5 s". O responsável decidiu em 18/11/2026 que **vale o p95 de cada tipo de busca**: um tipo reprova quando o p95 passa de 5 s, e o pior tempo fica registrado sem reprovar sozinho. O [`relatorio.rs`](prova-banco-de-logs/bancada/src/bin/relatorio.rs) aplica essa regra.

## Ainda não construído

- Medida das 7 cópias na máquina-alvo (o ensaio local mede uma).
- Medida de CPU da biblioteca na máquina-alvo.
- Site Next sintético.
- Automação da máquina: instalação, disco cifrado, conferência de disco e CPU, quedas com `sysrq`.

## Próximos passos

1. Terminar e ensaiar localmente tudo o que falta acima. **Nenhum recurso na AWS antes disso**, por decisão do responsável em 18/11/2026.
2. Pedir autorização com o custo atualizado.
3. Confirmar os dois itens em aberto: disco cifrado repassa a ordem de gravar e parada forçada em máquina saudável.
4. Seguir a ordem do #9: conferência da máquina, 2 h, 30 dias, 24 h, falhas e degraus de carga.
