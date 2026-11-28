# Custos estimados da infra

Consulta em **28/11/2026**. Ticket: [Pesquisar os custos estimados da infra](https://github.com/stacklabs3/monitora-ai/issues/89), do [Mapa: infra da plataforma](https://github.com/stacklabs3/monitora-ai/issues/52). Valores em dólar, sem imposto e sem câmbio. Nenhuma conta ou recurso foi criado na AWS: **nada aqui é custo medido**; o custo medido sai de [Validar o banco na AWS](https://github.com/stacklabs3/monitora-ai/issues/60).

## Resposta

| Cenário | Total por mês | Cabe em US$ 15? |
| --- | --- | --- |
| **Começo** (1 milhão de eventos/dia, 30 dias, 2 GB) | **US$ 15,00 a 15,79**, conforme o destino das cópias | **Só no limite.** Com bucket Lightsail dá US$ 15,00 cravados, sem folga nenhuma. Com S3 passa US$ 0,07; com snapshot, US$ 0,79 |
| **Dobro** (2 milhões/dia), ficando na máquina de 2 GB | **US$ 16,18 a 19,57** | **Não cabe** |
| **Dobro**, subindo para o plano de 4 GB | **US$ 28,18 a 31,57** | **Não cabe.** A máquina sozinha custa US$ 24 |

- O que estoura o teto são as **cópias fora da máquina**: a máquina leva US$ 12 dos US$ 15, e sobram US$ 3.
- No começo, guardar **6 cópias no S3** (US$ 14,63) ou **5 snapshots** (US$ 14,71) em vez de 7 cabe com folga pequena. É conta nossa, não decisão tomada.
- Transferência, endereço fixo e DNS dão US$ 0 nos dois cenários. O domínio ficou **[confirmar]**.

## O que é preço de tabela

Todos conferidos em 28/11/2026. "Price List" é o arquivo público de preços da AWS para `sa-east-1`.

| Item | Preço | Fonte |
| --- | --- | --- |
| Lightsail Linux com IPv4, 2 GB, 2 vCPU, 60 GB SSD | US$ 12/mês (US$ 0,01612/h) | [página de preços](https://aws.amazon.com/lightsail/pricing/); [Price List do Lightsail](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonLightsail/current/sa-east-1/index.json), publicado em 13/11/2026 |
| Lightsail Linux com IPv4, 4 GB, 2 vCPU, 80 GB SSD | US$ 24/mês (US$ 0,03225/h) | idem |
| Mesmos planos só com IPv6 | US$ 10 e US$ 20/mês | idem |
| Disco extra | US$ 0,10 por GB alocado/mês (32 GB = US$ 3,20; 64 GB = US$ 6,40) | idem |
| Snapshot de máquina ou de disco | US$ 0,05 por GB-mês; o automático guarda os 7 mais recentes | idem; [FAQ de snapshots](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-snapshots.html) |
| Bucket Lightsail | US$ 1 (5 GB), US$ 3 (100 GB), US$ 5 (250 GB); excedente de US$ 0,023/GB-mês em São Paulo | página de preços; Price List do Lightsail |
| S3 Standard em `sa-east-1` | US$ 0,0405/GB-mês (primeiros 50 TB); US$ 0,007 por 1.000 PUT; entrada de dados US$ 0 | [Price List do S3](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/sa-east-1/index.json), publicado em 27/11/2026 |
| Transferência incluída | 3 TB (2 GB) e 4 TB (4 GB); **em São Paulo vale a metade**: 1,5 TB e 2 TB. Entrada e saída contam | página de preços; [FAQ de transferência](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-data-transfer-allowance.html) |
| Transferência além da incluída | US$ 0,15/GB, só na saída para a internet; entrada nunca é cobrada | FAQ de transferência; Price List do Lightsail |
| Endereço fixo (IP estático) | Incluído em todo plano; **US$ 0,005/h se ficar solto**, sem máquina (cerca de US$ 3,72 num mês de 744 h) | página de preços; Price List do Lightsail |
| DNS no Lightsail | Incluído em todo plano; até 6 zonas | página de preços; [DNS no Lightsail](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-dns-in-amazon-lightsail.html) |
| DNS no Route 53 (alternativa) | US$ 0,50 por zona/mês + US$ 0,40 por milhão de consultas | [preços do Route 53](https://aws.amazon.com/route53/pricing/); [Price List do Route 53](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonRoute53/current/index.json), publicado em 18/11/2026 |

O Price List dá o preço por hora: 744 h × US$ 0,01612 = US$ 11,99, e 744 h × US$ 0,03225 = US$ 23,99. As contas abaixo usam US$ 12 e US$ 24, os valores da página.

## O que é estimativa nossa

Os tamanhos vêm da [prova dos candidatos a banco de logs](https://github.com/stacklabs3/monitora-ai/blob/research/prova-banco-de-logs/docs/research/prova-banco-de-logs.md), de [Medir os candidatos a banco de logs com dados sintéticos](https://github.com/stacklabs3/monitora-ai/issues/21). **Ela é SIMULADA**: rodou no Docker, com dados sintéticos, sem AWS. O banco é o OpenSearch, escolhido em [Escolher o banco de logs](https://github.com/stacklabs3/monitora-ai/issues/22).

| Número | Valor | De onde vem |
| --- | --- | --- |
| Disco do banco | 0,48 GB/dia; 14,4 GB em 30 dias | Prova, rodada de 24 h (simulado) |
| Uma cópia cifrada de 30 dias | 10,82 GB | Prova (simulado) |
| Cópias guardadas | 7 cópias completas = 75,7 GB | Fórmula de [Definir prova de conceito e critérios de avaliação](https://github.com/stacklabs3/monitora-ai/issues/9); não é decisão |
| Entrada de eventos | cerca de 19 GB/mês | Prova: evento médio de 633 B |
| Envio das cópias | 10,82 GB × 30 dias = 325 GB/mês | Conta nossa: uma cópia completa por dia |
| Dobro | tudo acima × 2 | Conta nossa, em linha reta. Ninguém mediu 2 milhões/dia |

## Começo: 1 milhão de eventos/dia, 30 dias, 2 GB

| Item | Conta | US$/mês | Tipo |
| --- | --- | --- | --- |
| Máquina | Plano de 2 GB com IPv4 | 12,00 | tabela |
| Disco extra | 14,4 GB de dados nos 60 GB do plano: não precisa | 0,00 | estimativa |
| Cópias, opção snapshot | 75,7 GB × US$ 0,05 | 3,79 | preço de tabela × tamanho estimado |
| Cópias, opção bucket Lightsail | 75,7 GB cabem no pacote de 100 GB | 3,00 | idem |
| Cópias, opção S3 Standard | 75,7 GB × US$ 0,0405 | 3,07 | idem |
| Transferência | 19 GB + 325 GB = 344 GB, contra 1.500 GB incluídos | 0,00 | estimativa |
| Endereço fixo | Preso à máquina | 0,00 | tabela |
| DNS | Zona do Lightsail | 0,00 | tabela |
| Domínio | **[confirmar]** | fora da soma | |

| Destino das cópias | Total | Contra o teto de US$ 15 |
| --- | --- | --- |
| Bucket Lightsail | **US$ 15,00** | no limite, folga zero |
| S3 Standard | **US$ 15,07** | passa US$ 0,07 |
| Snapshot | **US$ 15,79** | passa US$ 0,79 |

Com menos cópias: 6 no S3 dão 64,9 GB e US$ 14,63; 5 snapshots dão 54,1 GB e US$ 14,71. No bucket, menos cópias não baixa o preço, porque o pacote de 5 GB (US$ 1) não comporta nem uma cópia.

## Dobro: 2 milhões de eventos/dia

O que muda: os dados vão a cerca de 28,8 GB em 30 dias, cada cópia a cerca de 21,6 GB e as 7 cópias a 151,5 GB.

| Item | Conta | Ficando em 2 GB | Subindo para 4 GB | Tipo |
| --- | --- | --- | --- | --- |
| Máquina | Plano com IPv4 | 12,00 | 24,00 | tabela |
| Disco extra | 28,8 GB cabem em 60 GB e em 80 GB: não precisa só pelo tamanho | 0,00 | 0,00 | estimativa |
| Cópias, opção snapshot | 151,5 GB × US$ 0,05 | 7,57 | 7,57 | tabela × estimativa |
| Cópias, opção bucket Lightsail | Pacote de 100 GB + 51,5 GB × US$ 0,023 (o pacote de 250 GB sai US$ 5,00) | 4,18 | 4,18 | idem |
| Cópias, opção S3 Standard | 151,5 GB × US$ 0,0405 | 6,13 | 6,13 | idem |
| Transferência | 38 GB + 649 GB = 687 GB, contra 1.500 GB (2 GB) ou 2.000 GB (4 GB) | 0,00 | 0,00 | estimativa |
| Endereço fixo e DNS | Como no começo | 0,00 | 0,00 | tabela |

| Destino das cópias | Ficando em 2 GB | Subindo para 4 GB |
| --- | --- | --- |
| Bucket Lightsail | **US$ 16,18** | **US$ 28,18** |
| S3 Standard | **US$ 18,13** | **US$ 30,13** |
| Snapshot | **US$ 19,57** | **US$ 31,57** |

**Nenhuma combinação do dobro cabe em US$ 15.** Ficando em 2 GB, o teto só fecha com 3 cópias no S3 (64,9 GB, US$ 2,63, total US$ 14,63); com 4 ainda passa (86,6 GB, US$ 3,51, total US$ 15,51). Se a máquina de 2 GB aguenta 2 milhões/dia ninguém sabe: a folga de carga ficou "não medido" na prova. Se for preciso disco extra, por folga ou retenção maior, cada 32 GB somam US$ 3,20.

## O que ficou [confirmar]

- **Domínio.** O preço de registro não saiu de fonte primária: a tabela de domínios do Route 53 é um PDF que não consegui ler aqui, e a página do Registro.br voltou vazia. Se a plataforma usar um subdomínio de um domínio que já existe, o custo é US$ 0. **[confirmar]**
- **Como o snapshot é cobrado.** As páginas consultadas dão US$ 0,05/GB-mês "pelo que fica guardado" e não dizem se os 7 snapshots automáticos são cobrados cheios ou só pela diferença entre eles, nem se a base é o disco usado ou o alocado. A conta acima usa 7 cópias cheias do tamanho da cópia cifrada; um snapshot de máquina copia o disco inteiro (sistema e banco), então o valor real pode ser outro. [Restrições do projeto](https://github.com/stacklabs3/monitora-ai/issues/19) reservou US$ 3 (60 GB). **[confirmar]** na fatura do #60.
- **Limite de consultas da zona DNS do Lightsail.** A página de preços diz "incluído", sem número. **[confirmar]**
- **Envio das cópias na franquia de rede.** A AWS diz que entrada e saída contam na franquia; contei os 325 GB/mês das cópias como saída da máquina. Mesmo assim sobra mais de 1 TB. A saída do painel e das buscas não foi medida. **[confirmar]** no #60.
- **Impostos e câmbio.** Fora de todas as contas. **[confirmar]**
- **A página "aws.amazon.com/lightsail/faqs/" voltou 404**; o que ela diria sobre IP fixo e DNS veio da página de preços e do Price List.

## Fontes

- https://aws.amazon.com/lightsail/pricing/ (28/11/2026)
- https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonLightsail/current/sa-east-1/index.json (publicado em 13/11/2026)
- https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/sa-east-1/index.json (publicado em 27/11/2026)
- https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonRoute53/current/index.json (publicado em 18/11/2026)
- https://aws.amazon.com/route53/pricing/ (28/11/2026)
- https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-data-transfer-allowance.html
- https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-snapshots.html
- https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-snapshots-in-amazon-lightsail.html
- https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-dns-in-amazon-lightsail.html
- [Prova dos candidatos a banco de logs](https://github.com/stacklabs3/monitora-ai/blob/research/prova-banco-de-logs/docs/research/prova-banco-de-logs.md) (números SIMULADOS)
- [Restrições do projeto](https://github.com/stacklabs3/monitora-ai/issues/19), [Definir prova de conceito e critérios de avaliação](https://github.com/stacklabs3/monitora-ai/issues/9) e [custos da pesquisa inicial](https://github.com/stacklabs3/monitora-ai/blob/main/docs/pesquisa-inicial/custos.md)
