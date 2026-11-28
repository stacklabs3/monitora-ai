---
status: accepted
---

# Bibliotecas leves, sem servidor, armazenamento nem busca na aplicação

As bibliotecas de Node.js e de Java só levam os eventos da aplicação até o servidor do Monitora AI. Elas não trazem servidor, armazenamento nem busca para dentro da aplicação. A decisão é do responsável pelo produto, tomada na pesquisa inicial, e não se reabre nos tickets do mapa. O motivo: a biblioteca roda no processo de cada aplicação de cada produto, e tudo o que ela carrega pesa nesse processo e se repete em cada linguagem.

Registrado em [Registrar ADRs de Rust e das bibliotecas leves](https://github.com/stacklabs3/monitora-ai/issues/34), em 27/11/2026. O formato de envio e o que cada biblioteca faz por dentro estão no [ADR 0001](0001-formato-proprio-de-envio-e-bibliotecas-leves.md); este ADR registra só o limite.

## Onde passa o limite

| Fica na biblioteca | Fica no servidor |
|---|---|
| Captura do log, escolha do que sai, remoção e máscara | Aceite do evento, só depois de gravado |
| Código de busca, numeração e fila em memória | Gravação e busca no banco de logs |
| Envio em lotes, reenvio e situação da execução | Catálogo de campos, retenção, alertas e auditoria |

- **Sem disco:** a fila é só em memória, de 2.048 eventos ou 16 MB (ADR 0001). O que não couber vira perda de evento com motivo, e não arquivo na máquina da aplicação.
- **Sem busca local:** quem investiga usa o painel. A biblioteca não responde consulta nenhuma.
- **Sem regra própria:** campos declarados, máscaras e parâmetros vêm do servidor por `GET /v1/regras`.

Exemplo: a API do Excurfly cai às 3h com 300 eventos na fila. Esses eventos se perdem, e o painel mostra a perda pela numeração da execução. A biblioteca não guarda nada em disco para reenviar quando a API voltar.

## Opções recusadas

- **Guardar em disco na aplicação:** sobreviveria à queda, mas poria arquivo, limpeza e dado mascarado na máquina de cada produto, e cada linguagem teria a sua implementação.
- **Agente ou coletor ao lado da aplicação:** tiraria o peso do processo, mas seria mais um programa para instalar e operar em cada produto.
- **Busca ou índice na biblioteca:** repetiria o banco de logs em cada linguagem.

## Consequências

- **Perda quando a aplicação cai:** o que está na fila some com o processo. A perda fica visível e contada, sem ser evitada ([Definir garantias e falhas da ingestão](https://github.com/stacklabs3/monitora-ai/issues/7)).
- **Servidor fora do ar por mais de 5 min:** as tentativas acabam e os eventos viram perda de evento (ADR 0001).
- **Comportamento igual entre linguagens:** como a biblioteca é pequena, um conjunto único de casos sintéticos confere Node.js e Java (ADR 0001).

## Fontes

- [Consolidação da pesquisa inicial](../pesquisa-inicial/consolidacao.md), seção "Decisões do responsável pelo produto"
- [ADR 0001](0001-formato-proprio-de-envio-e-bibliotecas-leves.md): contrato, fila, tentativas por 5 min e quem cumpre cada garantia
- [ADR 0003](0003-modulos-e-seams-do-servidor.md): os módulos do servidor que ficam com gravação, busca, catálogo, retenção, alertas e auditoria
- [Definir garantias e falhas da ingestão](https://github.com/stacklabs3/monitora-ai/issues/7)
