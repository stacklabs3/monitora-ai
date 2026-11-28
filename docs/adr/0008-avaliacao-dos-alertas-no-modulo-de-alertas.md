---
status: accepted
---

# A avaliação dos alertas roda no módulo de alertas, de minuto em minuto

A condição de um alerta é avaliada só pelo módulo de alertas, num relógio próprio, a cada 60 s. Ele lê os reinícios na saúde do envio e conta os erros pela guarda de eventos, e o recebimento não sabe que alertas existem. O motivo: o que dispara o alerta é o mesmo dado que a pessoa vê ao tocar no link, a contagem sobrevive a uma queda do servidor sem guardar nada na memória, e o caminho que confirma os eventos às aplicações fica sem trabalho novo.

Decidido em [Definir onde roda a avaliação dos alertas](https://github.com/stacklabs3/monitora-ai/issues/64), em 28/11/2026, pela recomendação, por delegação do responsável pelo produto. Fecha o item em aberto do [ADR 0003](0003-modulos-e-seams-do-servidor.md).

## Como entra

- **Um relógio no módulo de alertas:** a cada rodada, ele percorre os alertas ativos e avalia a condição de cada um. Os 60 s são proposta: é o intervalo padrão de avaliação do Prometheus e o do exemplo do OpenSearch Alerting, sem fonte que fixe o valor para este projeto.
- **Reinícios seguidos:** o módulo pergunta à saúde do envio quantas execuções da aplicação começaram na janela. Cada execução avisa o início pela situação da execução ([ADR 0001](0001-formato-proprio-de-envio-e-bibliotecas-leves.md)), então a contagem não depende de a execução anterior ter se despedido e não toca o banco de logs.
- **Muitos erros:** o módulo pede à guarda de eventos uma contagem, por aplicação, ambiente, nível e janela, com prazo. A guarda ganha essa operação, `contar`; no adaptador do OpenSearch ela é a API `_count` com filtro. Os alertas chamam a guarda direto, como a saúde do envio e a retenção já fazem: a consulta existe para a busca de uma pessoa, com permissão, limites e agrupamento por tentativa.
- **Estado do alerta no cadastro:** se o alerta está disparado e quando avisou por último ficam no cadastro, não na memória. Depois de uma queda do servidor, a rodada seguinte recomeça de onde parou, sem avisar de novo.
- **Sentido das chamadas:** alertas → saúde do envio e alertas → guarda de eventos. Nenhum módulo chama os alertas, e a guarda continua sem chamar ninguém.

## Tempo e custo no exemplo

A API do Excurfly reinicia 3 vezes a partir das 3h, com um alerta de "3 reinícios em 10 min":

| | Avaliação no módulo de alertas (escolhida) | Avaliação no recebimento |
|---|---|---|
| Aviso de reinício | até 60 s depois do terceiro início | o recebimento não vê a situação da execução (ADR 0003) |
| Aviso de "40 erros em 5 min" | até cerca de 70 s depois do 40º erro: até 60 s da rodada mais o tempo de o evento aparecer na busca (p95 de 5,2 s, máximo de 9,5 s, simulado) | poucos segundos |
| Memória no servidor | nenhuma por evento; a lista de alertas ativos | contadores por aplicação, nível e minuto: também pouca |
| Depois de uma queda do servidor | conta de novo pelo que está gravado | os contadores zeram; uma janela de 5 min recomeça vazia |
| Trabalho no banco | uma contagem por alerta de erros a cada rodada | nenhum |

A memória não separa as opções: as duas gastam pouco. O que separa é a queda do servidor, o caminho da confirmação e o número do alerta bater com o do painel.

## Opções recusadas

- **No recebimento, a cada lote aceito:** avisa em segundos, mas guarda a contagem na memória (zera numa queda), põe trabalho no caminho que tem meta de 1 s para confirmar, e pode contar diferente do que a busca mostra. Para janelas de 5 a 10 min, ganhar um minuto não paga isso.
- **Só pela saúde do envio, inclusive os erros:** a saúde do envio passaria a contar eventos por nível, que não é situação, perda nem lacuna, e os erros teriam duas contagens, a dela e a do banco.
- **OpenSearch Alerting (o plugin do banco):** já avalia por agenda, mas põe a regra dentro do banco, que só a guarda conhece ([ADR 0002](0002-opensearch-como-banco-de-logs.md)), não vê os reinícios e não tem o Telegram entre os canais.
- **Alertas passando pela consulta:** a consulta confere a permissão de uma pessoa e agrupa por tentativa; o relógio não é uma pessoa.
- **Contar os reinícios no banco de logs:** a situação da execução anda à parte dos eventos e mora no cadastro.

## Consequências

- **Aviso em até cerca de um minuto, não em segundos:** aceito porque as condições combinadas são contagens em janelas de minutos.
- **Uma operação a mais na guarda:** cada adaptador de banco passa a oferecer `contar`.
- **Carga nova no banco, ainda sem medida:** uma contagem por alerta de erros por minuto. Na prova simulada, as buscas na janela de 1 h ficaram com p95 abaixo de 0,5 s, mas a contagem não foi medida; ela entra na conta de [Validar o banco na AWS](https://github.com/stacklabs3/monitora-ai/issues/60).
- **Banco fora:** o alerta de erros não é avaliado enquanto o banco não responde; o de reinícios continua, porque lê o cadastro.
- **Servidor fora:** ninguém avalia nem avisa. Vale o "uma queda para tudo" do ADR 0003.
- **Trocar depois custa pouco:** a condição mora num módulo só. Se um dia o minuto for muito, o recebimento passa a avisar os alertas sem mexer na guarda nem no canal.

## Ainda em aberto

- Janela, repetição, silenciar e o que fazer quando a rodada falha: comportamento do alerta, que segue para o `/prototype` ([Definir rotinas do desenho inicial](https://github.com/stacklabs3/monitora-ai/issues/15)).
- Como se reconhece uma aplicação que caiu e não voltou, e se duas execuções da mesma aplicação ao mesmo tempo contam como reinício: seguem na névoa do [Mapa: arquitetura da plataforma](https://github.com/stacklabs3/monitora-ai/issues/18).

## Fontes

- [ADR 0003](0003-modulos-e-seams-do-servidor.md): módulos, sentido das chamadas e a recusa de o recebimento cuidar da situação; [ADR 0001](0001-formato-proprio-de-envio-e-bibliotecas-leves.md): a situação da execução vai ao iniciar, ao encerrar e a cada 30 s; [ADR 0002](0002-opensearch-como-banco-de-logs.md) e [ADR 0005](0005-telegram-como-canal-de-alerta.md)
- [Prova dos candidatos a banco de logs](https://github.com/stacklabs3/monitora-ai/blob/research/prova-banco-de-logs/docs/research/prova-banco-de-logs.md): OpenSearch nas 24 h, "aparecer na busca" e p95 das buscas (números simulados)
- [Pesquisa: referências de investigação e alertas](https://github.com/stacklabs3/monitora-ai/blob/research/referencias-investigacao-alertas/docs/research/referencias-investigacao-alertas.md), seções 7 e 8: consulta, contagem por janela e limite em Datadog, Grafana, Elastic e Dynatrace
- [Prometheus: configuração](https://prometheus.io/docs/prometheus/latest/configuration/configuration/): `evaluation_interval`, padrão de 1 min
- [Grafana: avaliação das regras de alerta](https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rule-evaluation/): intervalo de avaliação por grupo
- [OpenSearch: Count API](https://docs.opensearch.org/latest/api-reference/search-apis/count/), [Alerting](https://docs.opensearch.org/latest/observing-your-data/alerting/index/) e [Notifications](https://docs.opensearch.org/latest/observing-your-data/notifications/index/): contagem com filtro, monitor por agenda e lista de canais
- [Definir garantias e falhas da ingestão](https://github.com/stacklabs3/monitora-ai/issues/7), itens 13 a 15, e [Definir prova de conceito e critérios de avaliação](https://github.com/stacklabs3/monitora-ai/issues/9): meta de 1 s para confirmar
- Delegação do responsável pelo produto de 20/11/2026: decidir pela recomendação
