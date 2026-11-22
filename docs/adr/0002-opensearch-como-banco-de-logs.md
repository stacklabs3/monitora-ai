---
status: accepted
---

# OpenSearch como banco de logs da primeira versão, atrás de uma guarda de eventos

A primeira versão guarda e busca os eventos no OpenSearch 3.9.0, e só uma peça do servidor, a guarda de eventos, fala com o banco. O motivo: na máquina simulada de 2 GB sem swap e 0,4 CPU, com 30 dias de histórico, só o OpenSearch passou em todas as fases obrigatórias da prova. O PostgreSQL 18.7 reprovou na busca das 24 h, e o ClickHouse 26.10.4.207 reprovou no histórico por falta de memória. A escolha foi feita pela tabela comparativa, como manda o item 10 de [Definir prova de conceito e critérios de avaliação](https://github.com/stacklabs3/monitora-ai/issues/9).

Decidido em [Escolher o banco de logs](https://github.com/stacklabs3/monitora-ai/issues/22), em 22/11/2026. Todos os números são **SIMULADOS** e vêm de [Medir os candidatos a banco de logs com dados sintéticos](https://github.com/stacklabs3/monitora-ai/issues/21). A AWS entra só quando o backend e o frontend estiverem prontos (decisão do responsável de 18/11/2026).

## Resultado que decidiu

| | OpenSearch 3.9.0 | PostgreSQL 18.7 | ClickHouse 26.10.4.207 |
|---|---|---|---|
| Resultado | passou nas fases obrigatórias | reprovou na rodada de 24 h | reprovou no histórico de 30 dias |
| Busca, p95 por tipo (meta 5 s) | maior 4,5 s (linha do tempo em 30 dias), os outros abaixo de 0,5 s | 43 a 58 s em todos os tipos | não medido: parou antes |
| Dias que cabem em 60 GB | ~125 (rodada de 24 h); ~61 (dia carregado isolado) | ~30 | ~290 |
| Passos extras de operação | nenhum; volta de uma queda em 6,3 s em média | nenhum até onde rodou | dois: limite de partes quebradas e restauração por tabela auxiliar |
| Custo mensal estimado | US$ 15,00 a 15,79 | US$ 20,67 a 32,47 | US$ 13,76 a 15,00 |

## A guarda de eventos

A guarda de eventos é a única parte do servidor que conhece o banco. Ela oferece as operações que a bancada da prova já isolava em `bancos/`: preparar, gravar um lote, listar os recentes, buscar com prazo, listar os presentes, apagar os dias vencidos e apagar uma pessoa. Cada banco ganha um adaptador atrás dela. Os três candidatos couberam nessa forma na prova, e por isso trocar de banco é trocar o adaptador, não o servidor. Os módulos em volta dela são decididos em [Definir módulos e seams principais](https://github.com/stacklabs3/monitora-ai/issues/32).

O adaptador do OpenSearch chama a API REST direto por HTTP (`reqwest`), como na bancada. A biblioteca `opensearch` está na 2.4.0 (crates.io, 24/03/2026), que cobre o banco 1.x e 2.x e não declara suporte ao 3.x.

## Condições que ficam para a máquina real

A escolha vale com quatro medidas pendentes, que rodam em [Validar o banco na AWS](https://github.com/stacklabs3/monitora-ai/issues/60) com a bancada corrigida. **Se qualquer uma reprovar lá, esta escolha reabre.**

1. **Memória:** banco e servidor juntos até 1,5 GB, sem contar o cache dos arquivos do índice. No contêiner, a média foi de 1,6 GB com o cache incluído; na VM, com carga curta, 1.342 MB.
2. **Restauração:** em até 4 h, sem pessoa excluída nem dia vencido visível. A cópia cifrada de 10,8 GB foi medida (20 min). A restauração não foi, porque a listagem de conferência estourou o limite de 2 h da bancada.
3. **Folga de carga:** os degraus, que dobram a carga até quebrar uma meta. O primeiro degrau herdou as exclusões da fase anterior.
4. **Apagar com carga:** a exclusão de pessoas cumprindo as metas com a carga rodando. Ficou inconclusivo: um erro 500 sem log que mostre a causa.

A busca mais perto do limite é a linha do tempo em 30 dias: 4,5 s nas 24 h e 6,1 s fria na bateria, sempre com resultado parcial.

## Opções recusadas

- **PostgreSQL:** grava no ritmo pedido, mas com 0,4 CPU e 30 dias no disco nenhuma busca coube em 5 s. Com o saldo de CPU da AWS ele pode mudar de resultado, mas isso não está medido, e o Docker não simula esse saldo.
- **ClickHouse com ajustes:** aumentar `max_suspicious_broken_parts` faz a tabela abrir sozinha depois de uma queda, e limitar a memória das junções, usar inserções assíncronas ou gravar lotes maiores poderia evitar a falta de memória. Os ajustes ficam registrados, mas não foram aceitos: o item 2 do #9 exige o guia oficial e o mesmo tempo de ajuste para todos, e aceitar mudaria a configuração comparada.
- **Esperar o #60 para escolher:** atrasaria o servidor até a AWS, que só entra com o produto pronto. A guarda de eventos limita o custo de errar.
- **Servidor falando direto com o OpenSearch:** troca de banco viraria reescrita do servidor.

## Consequências

- **JVM na máquina:** o heap fica fixo em 700 MB (`-Xms700m -Xmx700m`), como na prova; a memória restante é dividida com o servidor e o cache.
- **Um índice por dia:** apagar dias vencidos é apagar índices; apagar uma pessoa é `_delete_by_query`, a operação ainda sem medida válida.
- **Volta mais lenta de uma queda:** 6,3 s em média e 10 s no pior caso na VM, contra 1,3 s do PostgreSQL. As bibliotecas já reenviam enquanto o servidor não responde ([ADR 0001](0001-formato-proprio-de-envio-e-bibliotecas-leves.md)).
- **Licença:** Apache-2.0.

## Fontes

- [Prova dos candidatos a banco de logs](https://github.com/stacklabs3/monitora-ai/blob/research/prova-banco-de-logs/docs/research/prova-banco-de-logs.md): resultados, diagnósticos, tabela comparativa e custo
- [Pesquisa: candidatos a banco de logs](https://github.com/stacklabs3/monitora-ai/blob/research/banco-de-logs/docs/research/banco-de-logs.md): versões, licenças, RAM mínima e clientes Rust
- [Adaptadores da bancada](https://github.com/stacklabs3/monitora-ai/blob/research/prova-banco-de-logs/docs/research/prova-banco-de-logs/bancada/src/bancos/mod.rs)
- [ClickHouse: `max_suspicious_broken_parts`](https://clickhouse.com/docs/operations/settings/merge-tree-settings#max_suspicious_broken_parts)
- [crates.io: `opensearch`](https://crates.io/crates/opensearch)
