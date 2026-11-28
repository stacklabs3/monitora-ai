---
status: accepted
---

# Um servidor só, com módulos em volta da guarda de eventos

O servidor do Monitora AI é um programa só, que também entrega os arquivos do painel, dividido em módulos que se chamam pela interface de cada um. Só a guarda de eventos conhece o banco de logs, e só duas entradas finas conhecem HTTP. O motivo: na máquina de 2 GB, o banco e o servidor juntos têm até 1,5 GB ([ADR 0002](0002-opensearch-como-banco-de-logs.md), condição 1), e uma pessoa só opera tudo ([Restrições do projeto](https://github.com/stacklabs3/monitora-ai/issues/19)). Dividir em vários programas gastaria memória e operação sem trazer nada que a primeira versão peça.

Decidido em [Definir módulos e seams principais](https://github.com/stacklabs3/monitora-ai/issues/32), em 27/11/2026.

## Módulos

| Módulo | Faz | Fonte da regra |
|---|---|---|
| Entrada do envio | Traduz `/v1/eventos`, `/v1/situacao` e `/v1/regras` para os módulos; só ela conhece esse HTTP | [ADR 0001](0001-formato-proprio-de-envio-e-bibliotecas-leves.md) |
| Entrada do painel | Traduz a API do painel para os módulos; o painel é estático e só fala com ela | [Pesquisar frameworks do painel](https://github.com/stacklabs3/monitora-ai/issues/23) |
| Recebimento | Julga cada evento do lote, confere de novo a máscara, ignora reenvio por 15 min e grava pela guarda | Ingestão, itens 1, 3, 5 e 9; Privacidade, item 4 |
| Catálogo de campos | Guarda os campos declarados, as máscaras e as listas do produto; avisa a guarda quando um campo é declarado | Busca, itens 24 a 29; Privacidade, item 26 |
| Consulta | Confere a permissão, aplica os limites da busca, agrupa por tentativa e chama a guarda | Busca, itens 4, 9 e 30 a 34; Privacidade, item 13 |
| Acesso | Login, sessões, papéis e chaves de envio; responde "quem é e o que pode" aos outros | Privacidade, itens 1, 2, 13 e 14 |
| Saúde do envio | Situação das execuções, perdas com motivo e lacunas na numeração; serve o painel e os alertas | Ingestão, itens 12 a 15 |
| Retenção | Limpeza diária dos dias vencidos e pedidos de exclusão de pessoa, reaplicados depois de uma restauração | Privacidade, itens 19 a 25 |
| Alertas | Decide quando avisar e envia o aviso | Privacidade, item 18 |
| Auditoria | Só registra e lista; sem edição | Privacidade, itens 15 e 16 |
| Guarda de eventos | A única peça que conhece o banco; um adaptador por banco | [ADR 0002](0002-opensearch-como-banco-de-logs.md) |
| Cadastro | Pessoas, chaves, catálogo, auditoria e saúde do envio, à parte dos eventos | Privacidade, item 16 |

"Busca", "Ingestão" e "Privacidade" são, nesta ordem, as resoluções de [Definir semântica de busca e campos configuráveis](https://github.com/stacklabs3/monitora-ai/issues/6), [Definir garantias e falhas da ingestão](https://github.com/stacklabs3/monitora-ai/issues/7) e [Definir privacidade, acesso e retenção](https://github.com/stacklabs3/monitora-ai/issues/8).

## Seams e sentido das chamadas

- **Guarda de eventos:** não chama nenhum módulo. O catálogo chama `preparar` com os campos novos; o recebimento grava e, ao subir, lista os recentes para recarregar os códigos dos últimos 15 min; a consulta busca com prazo; a saúde do envio lista os presentes; a retenção apaga os dias vencidos e as pessoas. Como os campos viram campos no OpenSearch fica em [Definir como os campos pesquisáveis viram campos no OpenSearch](https://github.com/stacklabs3/monitora-ai/issues/62).
- **Entradas HTTP:** as duas são finas e só traduzem. Os módulos se testam pela interface, sem rede, e o contrato `/v1` muda num lugar só.
- **Auditoria:** consulta, acesso, catálogo e retenção registram por ela, nunca direto no cadastro, para que a máscara do termo e o "sem edição" valham num lugar.
- **Canal de alerta:** sem seam enquanto houver um canal só. Ela nasce quando [Escolher os canais de alerta](https://github.com/stacklabs3/monitora-ai/issues/31) pedir um segundo, porque uma seam com um adaptador é hipotética.
- **Cadastro:** fica em SQLite, embutido no servidor, e só o módulo de cadastro conhece SQL ([ADR 0009](0009-cadastro-em-sqlite-embutido.md)). A guarda de eventos continua só dos eventos.

## Opções recusadas

- **Dois programas (recebimento e painel):** a consulta poderia cair sem parar o recebimento, mas os dois dividiriam a sobra de memória do banco e dobrariam a operação.
- **Um programa por módulo:** o mesmo custo, multiplicado.
- **Servidor que monta as telas:** prende o painel ao servidor; os frameworks pesquisados geram páginas estáticas.
- **Regras de campo lidas por cada módulo:** a consulta poderia prometer uma busca que o banco ainda não preparou.
- **Painel chamando a guarda direto:** espalharia permissão, auditoria e limites da busca pelas telas.
- **Recebimento cuidando da situação:** misturaria lotes e perdas, e os alertas de reinício teriam duas fontes.
- **Dados de cadastro no OpenSearch:** a auditoria fica 6 meses sem edição e os eventos vencem em 30 dias; a guarda deixaria de ser só dos eventos.
- **Dados de cadastro em arquivo no disco:** pessoas, chaves e auditoria mudam pelo painel, com histórico.
- **Guarda recusando o código repetido:** "listar os recentes" já é a operação da guarda para isso, e ela continua sem regra de ingestão.
- **Guarda consultando o catálogo:** criaria uma dependência da guarda para fora do banco.

## Consequências

- **Uma queda para tudo:** se o servidor cair, param o recebimento e o painel juntos. As bibliotecas reenviam por 5 min enquanto ele não responde ([ADR 0001](0001-formato-proprio-de-envio-e-bibliotecas-leves.md)).
- **Um segundo armazenamento na máquina:** o cadastro soma memória e disco à conta do ADR 0002, a medir em [Validar o banco na AWS](https://github.com/stacklabs3/monitora-ai/issues/60).
- **Separar depois é possível:** como os módulos só se chamam pela interface e o HTTP está nas entradas, tirar um módulo para outro programa troca uma chamada local por uma chamada de rede, sem reescrever o módulo.

## Ainda em aberto

- Onde roda a avaliação dos alertas: decidido no [ADR 0008](0008-avaliacao-dos-alertas-no-modulo-de-alertas.md). Roda no módulo de alertas, que lê a saúde do envio e conta pela guarda.
- Como os módulos se escrevem em Rust: em [Desenho de módulos e SOLID](https://github.com/stacklabs3/monitora-ai/issues/44). Se os módulos ganham um adaptador da guarda em memória para os testes: em [Definir a estratégia de testes por fase](https://github.com/stacklabs3/monitora-ai/issues/39).

## Fontes

- [Arquitetura candidata](../pesquisa-inicial/consolidacao.md): envio, recebimento, banco, catálogo de campos, consulta e painel
- [ADR 0001](0001-formato-proprio-de-envio-e-bibliotecas-leves.md) e [ADR 0002](0002-opensearch-como-banco-de-logs.md)
- [Adaptadores da bancada](https://github.com/stacklabs3/monitora-ai/blob/research/prova-banco-de-logs/docs/research/prova-banco-de-logs/bancada/src/bancos/mod.rs): as operações da guarda já exercitadas, entre elas a de listar os recentes contra reenvio
- Resoluções de [Definir semântica de busca e campos configuráveis](https://github.com/stacklabs3/monitora-ai/issues/6), [Definir garantias e falhas da ingestão](https://github.com/stacklabs3/monitora-ai/issues/7), [Definir privacidade, acesso e retenção](https://github.com/stacklabs3/monitora-ai/issues/8), [Restrições do projeto](https://github.com/stacklabs3/monitora-ai/issues/19) e [Pesquisar frameworks do painel](https://github.com/stacklabs3/monitora-ai/issues/23)
- Vocabulário de módulo, interface, seam e adaptador: skill `/codebase-design` (Ousterhout, *A Philosophy of Software Design*; Feathers, *Working Effectively with Legacy Code*)
