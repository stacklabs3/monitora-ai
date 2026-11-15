# Custos AWS para uma plataforma própria de logs

Pesquisa em 15/11/2026. Valores em dólares, sem impostos, câmbio ou promessas de desempenho; preços e disponibilidade devem ser conferidos na região selecionada antes da contratação.

## Custos identificáveis

| Componente | Referência de preço | Observação |
| --- | --- | --- |
| Lightsail Linux IPv4 público, 2 GB RAM | US$ 12/mês; 60 GB SSD no plano | Referência da [página da AWS](https://aws.amazon.com/lightsail/pricing/); capacidade de executar o sistema proposto não foi testada. |
| Lightsail Linux IPv4 público, 4 GB RAM | US$ 24/mês; 80 GB SSD no plano | Idem. Há opção somente IPv6 de US$ 10 e US$ 20, respectivamente; depende de conectividade compatível. |
| Disco de bloco Lightsail adicional | US$ 0,10 por GB alocado/mês | 64 GB adicionais = US$ 6,40/mês; disco incluído na máquina não é cobrado de novo. [AWS](https://aws.amazon.com/lightsail/pricing/). |
| Snapshots Lightsail | US$ 0,05 por GB-mês armazenado | O custo depende do volume efetivamente cobrado, retenção e mudanças; snapshots automáticos guardam os últimos sete. Não confundir snapshot com recuperação já testada. [AWS](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-snapshots.html). |
| S3 Standard | Exemplo AWS: US$ 0,023 por GB-mês | Apenas referência de exemplo; verificar região, classe, requisições, transferência e armazenamento mínimo antes de estimar. O S3 não substitui sozinho um motor de busca. [Exemplo AWS](https://aws.amazon.com/blogs/database/automate-postgresql-audit-log-extraction-and-analysis-with-amazon-s3/), [preços S3](https://aws.amazon.com/s3/pricing/). |

Máquinas Lightsail pequenas têm CPU com desempenho básico limitado e capacidade de rajada, importante para buscas e compressão: a documentação informa baseline de 20% para planos de 2 GB e 4 GB. Fazer teste de carga sustentada, e não tratar 2 vCPUs como capacidade plena contínua. [AWS: baseline de CPU](https://docs.aws.amazon.com/en_en/lightsail/latest/userguide/baseline-cpu-performance.html).

## Rede

A franquia das instâncias conta entrada e saída; ultrapassada a franquia, a AWS cobra somente determinados tráfegos de saída. Para São Paulo, a documentação informa franquia de instância pela metade da de várias outras regiões e excedente elegível de US$ 0,15/GB. Tráfego privado entre Lightsail e recursos AWS na mesma região pode ser gratuito mesmo após a franquia. Isso não garante isenção no outro lado de cada conexão; verificar serviço de origem, regiões e caminho. [AWS: transferência no Lightsail](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-data-transfer-allowance.html).

## Modelo de dimensionamento

Os componentes da conta mensal são: servidor + disco adicional + snapshots/backup + armazenamento de objetos e requisições (se usado) + rede excedente + serviços de alerta/identidade, quando contratados. Uma máquina única implica indisponibilidade da plataforma enquanto ela estiver fora; replicação ou servidor independente aumentam o custo.

Para estimar disco, primeiro medir ingestão diária **bruta** por produto e multiplicar pela retenção. Depois multiplicar por uma razão **medida** que inclua dados comprimidos e índices, e somar sistema, fila/WAL, espaço temporário de indexação/compactação e folga. Não assumir 30% ou outra taxa como resultado garantido: índices, tipo de busca, cardinalidade e repetição mudam o resultado. Volume de buscas, concorrência e picos podem tornar CPU/RAM o limitante antes do disco.

Exemplo puramente aritmético: 1 GB/dia × 30 dias = 30 GB brutos. Se um experimento mostrar dados e índices ocupando 40% do bruto, serão 12 GB, antes de WAL, sistema, temporários, folga e backups. Não é medição do Excurfly.

Exemplo de orçamento mínimo, **não dimensionamento**: instância IPv4 de US$ 24/mês com disco incluído, sem disco extra, e 20 GB-mês de snapshots cobrados a US$ 0,05 = US$ 25/mês. Exclui impostos, rede excedente, serviços extras e possíveis custos de backup adicionais. O total real de snapshots não pode ser inferido apenas do tamanho nominal do disco. A escolha de 4 GB é hipótese, não capacidade validada.

Antes de dar orçamento: verificar região e IPv4/IPv6, medir amostra representativa de ingestão, testar compressão e índices para nome/telefone/IDs, simular p95/picos e concorrência, medir WAL e temporários, dimensionar retenção e restauração, e calcular no [AWS Pricing Calculator](https://calculator.aws/).
