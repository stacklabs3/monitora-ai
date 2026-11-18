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

## Ainda não construído

- Automação na AWS: instalação, disco cifrado, conferência da máquina e cenários de falha além da queda do servidor.
- Medida da biblioteca sintética em Node 20, 22 e 24.
- Site Next sintético na Vercel.

## Próximos passos

1. Humano faz login na AWS e autoriza os recursos.
2. Confirmar os dois itens em aberto: disco cifrado repassa a ordem de gravar e parada forçada em máquina saudável.
3. Seguir a ordem do #9: conferência da máquina, 2 h, 30 dias, 24 h, falhas e degraus de carga.
