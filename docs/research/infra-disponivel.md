# Pesquisa: infra disponível para a stack

Consulta em **2026-11-28**, só a páginas oficiais da AWS (lista em [Fontes](#fontes)). Responde o
ticket [Pesquisar a infra disponível para a stack](https://github.com/stacklabs3/monitora-ai/issues/88),
filho do [Mapa: infra da plataforma](https://github.com/stacklabs3/monitora-ai/issues/52).

A stack não se discute aqui: um servidor Rust que entrega o painel (ADR 0003), OpenSearch 3.9.0 na
mesma máquina (ADR 0002), cadastro em SQLite embutido (ADR 0009) e alerta de saída pelo Telegram
(ADR 0005), numa máquina Lightsail de 2 GB em `sa-east-1`. Esta pesquisa levanta **o que existe e
com que limites**; não dimensiona, não mede e não recomenda. Nenhuma conta ou recurso foi criado.

Valores em dólares, sem impostos. O que não tem fonte primária está marcado **[confirmar]**.

## Resumo

- O Lightsail existe em `sa-east-1` e a região vem habilitada por padrão [F8].
- O plano de 2 GB tem 2 vCPUs com **base de 20% por vCPU**, 60 GB de SSD e, em São Paulo,
  **metade** da transferência anunciada (1,5 TB em vez de 3 TB) [F1][F2][F4].
- O Lightsail entrega pronto: IP fixo IPv4, zona de DNS, firewall de entrada, snapshot manual e
  automático, disco extra, bucket de objetos e alarme por e-mail sobre métricas da máquina.
- Fica por nossa conta: o **certificado HTTPS na máquina** (o certificado do Lightsail só serve em
  balanceador, CDN e contêiner), o firewall de saída, a consistência da cópia do OpenSearch e do
  SQLite, e as métricas de **memória e disco**, que o Lightsail não publica.
- O Lightsail não tem: troca de plano no lugar, redução de plano, alarme por SMS (desligado em todas
  as regiões), alarme por webhook, regra de firewall que negue, IPv6 fixo e Systems Manager nativo.

## 1. A máquina

### Planos (Linux, com IPv4 público)

| | 2 GB | 4 GB (plano seguinte) | Fonte |
| --- | --- | --- | --- |
| Preço | US$ 12/mês | US$ 24/mês | [F1] |
| vCPUs | 2 | 2 | [F1][F2] |
| Base de CPU (por vCPU) | 20% | 20% | [F2] |
| Disco SSD incluído | 60 GB | 80 GB | [F1] |
| Transferência anunciada | 3 TB | 4 TB | [F1] |
| Transferência em São Paulo (metade) | 1,5 TB | 2 TB | [F1][F4], conta nossa |
| Versão só IPv6 | US$ 10/mês | US$ 20/mês | [F1] |

- A página de preços mostra uma tabela única e cita só a transferência como diferença regional
  [F1]. O preço exibido no console para `sa-east-1` na hora de criar: **[confirmar]**.
- A cobrança é por hora até o teto mensal, e **a máquina parada continua cobrando** até ser
  apagada [F5].
- O plano seguinte ao de 4 GB é o de 8 GB: US$ 44/mês, 2 vCPUs, base de 30%, 160 GB [F1][F2].

### Saldo de CPU

- A máquina ganha **4,17% de saldo por hora**; o teto é o que se ganha em 24 horas (100%). Saldo
  acumulado numa máquina ligada não expira [F3].
- A base é por vCPU, e o gráfico do console mostra a média das vCPUs. Acima da base a máquina gasta
  saldo; abaixo, acumula [F2].
- Máquinas criadas a partir de 29/06/2023 guardam o saldo por sete dias entre parar e ligar [F3].
- No lançamento há um saldo extra, que não conta para o teto, e algumas máquinas começam em "modo de
  lançamento", com menos limites por um tempo [F3]. Duração desse modo: **[confirmar]**.
- O que acontece com o desempenho quando o saldo zera não está escrito nas páginas lidas; a pesquisa
  anterior citou a página de rajadas [F21], não relida hoje: **[confirmar]**.
- O plano de 4 GB tem a **mesma base de 20%** do de 2 GB: subir de plano dobra a memória, não a CPU
  sustentada [F2].

### Trocar de plano

- Não há troca no lugar: tira-se um snapshot e cria-se uma **máquina nova** maior a partir dele [F12].
- Não dá para criar a partir de um snapshot uma máquina **menor** que a original [F9][F12].
- O IP público padrão muda ao parar e ligar; o IP fixo é o que se move para a máquina nova [F12][F13].

### Transferência

- Entrada e saída contam para a franquia. Passou da franquia, só se cobra a **saída** para a
  internet (ou para a AWS por IP público): **US$ 0,15/GB em `sa-east-1`**, o valor mais alto da
  lista depois de Sydney [F4].
- Entrada nunca é cobrada. Tráfego por IP privado na mesma região conta para a franquia, mas não
  gera cobrança depois dela [F4].
- A franquia é somada entre máquinas do mesmo plano na região, e apagar e recriar a máquina não a
  zera no mês [F4].

## 2. Disco extra, cópia e restauração

### Disco extra

| Item | Valor | Fonte |
| --- | --- | --- |
| Preço | US$ 0,10 por GB alocado/mês | [F1][F5] |
| Tamanho por disco | de 8 GB a 16.000 GB | [F7] |
| Discos por máquina | 15 | [F7] |
| Total anexado por região | 20.000 GB | [F7] |
| Onde | mesma região e zona da máquina | [F6] |

O disco novo chega cru: formatar, montar e pôr no `/etc/fstab` é por nossa conta [F6]. Aumentar um
disco segue o mesmo caminho da máquina, snapshot e disco novo maior [F12]. Criptografia do disco e
tipo de volume: **[confirmar]** (não estavam nas páginas lidas).

### Snapshots

| | Manual | Automático |
| --- | --- | --- |
| Quando | a qualquer hora | 1 por dia, em hora cheia UTC; padrão de `sa-east-1` é 08:00 UTC (05:00 de Brasília); sai até 45 min depois da hora marcada [F11] |
| Retenção | até alguém apagar [F9] | os **7 mais recentes**; o oitavo apaga o mais antigo [F9][F10] |
| Ao apagar a máquina | fica na conta [F9] | **é apagado junto** [F9][F10] |
| Preço | US$ 0,05/GB-mês [F1][F5] | o mesmo [F5][F10] |

- O snapshot da máquina inclui os discos extras anexados [F14].
- Snapshots sucessivos do mesmo recurso cobram só o que mudou [F5].
- Para um automático não ser trocado nem apagado com a máquina, copia-se como manual [F10].
- Snapshot automático de **disco** só se liga pela API ou CLI, não pelo console; não existe para
  Windows nem para banco gerenciado [F10].
- Não dá para tirar snapshot manual enquanto um automático está sendo criado [F11].
- Snapshot de máquina e de disco pode ser copiado para outra região ou dentro da mesma, na mesma
  conta [F9][F15], e exportado para o EC2 [F9].
- Limite de quantidade de snapshots por conta: não aparece na tabela de cotas [F7]: **[confirmar]**.

### Restauração

- Restaurar é **criar um recurso novo** a partir do snapshot (máquina ou disco), do mesmo plano ou
  maior; ele nasce como réplica do original no momento da cópia [F9]. Não há restauração "por cima"
  da máquina existente nas páginas lidas.
- Para ler arquivos de uma máquina que não responde: snapshot do disco de sistema, disco novo a
  partir dele, anexado a outra máquina [F9].
- O snapshot é uma cópia pontual do disco [F14]. As páginas do Lightsail lidas não dizem nada sobre
  consistência de banco em uso; a pesquisa anterior achou a orientação da AWS de quiescer o banco
  antes da cópia (`research/painel-aws`, `docs/pesquisas/painel-e-aws.md`). Consistência da cópia do
  OpenSearch e do SQLite com a máquina ligada: **[confirmar]**, com ensaio de restauração.
- Tempo de criação e de restauração de um snapshot: a AWS não publica; só se mede. **[confirmar]**

## 3. Endereço, DNS, HTTPS e firewall

| Peça | O Lightsail entrega | Fica por nossa conta |
| --- | --- | --- |
| Endereço fixo | IP fixo IPv4, sem custo enquanto anexado; 5 por região (cota ajustável) [F5][F7][F13] | criar e anexar antes do primeiro reinício: sem ele o IP muda ao parar e ligar [F13]. Solto por mais de 1 hora custa US$ 0,005/hora [F5] |
| IPv6 | endereço IPv6 na máquina | **não existe IPv6 fixo**; o registro AAAA pode precisar de ajuste se a máquina for recriada [F16]. IP fixo não se anexa a máquina só IPv6 [F5] |
| DNS | zona de DNS grátis: até 6 zonas, registros A, AAAA, CNAME, MX, NS, SRV e TXT, 3 milhões de consultas por mês (depois US$ 0,40 por milhão) [F5][F16] | registrar o domínio; o TTL é fixo em 60 s e não se configura [F16]. A zona é recurso global, criado em `us-east-1` [F8] |
| HTTPS | certificado grátis do Lightsail (emitido pelo ACM), **só** para balanceador, CDN e serviço de contêiner [F5][F17] | na máquina sozinha, o certificado é nosso: a AWS documenta Let's Encrypt com Certbot, validade de 90 dias, e no tutorial a renovação é manual [F18]. O balanceador que aceitaria o certificado do Lightsail custa US$ 18/mês [F1] |
| Firewall | firewall de entrada por máquina, um para IPv4 e outro para IPv6, com protocolo, porta e origem (IP ou CIDR) [F19] | ver os limites abaixo |

Limites do firewall [F19]:

- Só controla a **entrada** pelo IP público; toda a saída é liberada (é por ela que o alerta chega
  ao Telegram). Filtrar saída é com firewall dentro da máquina.
- As regras só **permitem**; não existe regra de negar. Com duas regras para a mesma porta, vale a
  mais aberta.
- Até 60 origens por firewall pela API ou CLI (30 por vez no console), contadas em separado para
  IPv4 e IPv6.
- Uma máquina Linux nova nasce com **SSH (22) e HTTP (80) abertos para qualquer IP**; a 443 não vem
  aberta no sistema base.
- Tráfego pelo IP privado (outros recursos Lightsail da conta na região, ou VPC pareada) não passa
  pelo firewall.

## 4. Onde guardar as cópias fora da máquina

| | Bucket do Lightsail | S3 |
| --- | --- | --- |
| O que é | armazenamento de objetos feito sobre o S3, com poucas funções de propósito [F20] | o serviço completo |
| Preço | US$ 1/mês (5 GB, 25 GB de transferência), US$ 3 (100 GB, 250 GB), US$ 5 (250 GB, 500 GB) [F1] | por uso; preço do S3 Standard em `sa-east-1`: **[confirmar]** (a página de preços do S3 não mostrou a tabela na leitura automática [F23]) |
| Excedente em São Paulo | US$ 0,023/GB de armazenamento e US$ 0,15/GB de transferência [F1] | **[confirmar]** |
| Região | qualquer região do Lightsail, inclusive `sa-east-1` [F20] | idem **[confirmar]** |
| Acesso a partir da máquina | anexar a máquina ao bucket na **mesma região**, sem chave para guardar; ou chave de acesso [F22] | sem pareamento de VPC [F24]; a credencial que a máquina usaria: **[confirmar]** |

Limites do bucket do Lightsail:

- 20 buckets por conta e **2 chaves de acesso por bucket** [F7][F22].
- O acesso é tudo ou nada: máquina anexada e chave têm leitura e escrita completas no bucket.
  Outra conta AWS só ganha leitura, até 10 contas [F22]. Não há permissão mais fina nas páginas lidas.
- Privado por padrão [F20][F22].
- Tem versionamento, desligado por padrão; cada versão ocupa espaço do plano e fica até alguém
  apagar [F20].
- O plano do bucket só muda uma vez por ciclo de cobrança [F20].
- Subir dados para o bucket e baixar dele para um recurso Lightsail na mesma região **não consome
  franquia de transferência** [F4].
- Regra de expiração (lifecycle), trava contra apagar (object lock) e replicação entre regiões não
  aparecem nas páginas do bucket, que se descreve como de "conjunto mínimo de funções" [F20]. A
  ausência não está afirmada pela AWS: **[confirmar]**. Sem expiração, apagar cópia antiga é tarefa nossa.
- Tamanho máximo de objeto: **[confirmar]**.

Há um terceiro lugar: copiar o snapshot para **outra região** do próprio Lightsail [F15]. Ele
protege contra a perda da região, mas continua na mesma conta.

## 5. O que o Lightsail não tem e a stack pode pedir

### Monitoramento e alarme da máquina

O que existe [F25][F26][F27]:

- Métricas da máquina: uso de CPU, saldo de CPU (minutos e percentual), rede de entrada e de saída,
  falha de verificação de status (da instância e do sistema) e acessos ao serviço de metadados sem token.
- Retenção: 1 minuto por 15 dias, 5 minutos por 63 dias, 1 hora por 455 dias.
- Alarme sobre uma métrica: 2 alarmes por métrica, avaliado a cada 5 minutos, janela de até 24
  horas, com escolha de como tratar dado faltante.
- Aviso por faixa no console e por e-mail: **um endereço de e-mail por região**, que precisa ser
  confirmado antes de receber.

O que falta:

| Falta | Detalhe | Fonte |
| --- | --- | --- |
| Métrica de memória | não está na lista de métricas da máquina | [F25] |
| Métrica de disco (espaço e fila) | não está na lista; só o banco gerenciado tem espaço livre | [F25] |
| Alarme por SMS | "temporariamente desligado" em todas as regiões; `sa-east-1` também não estava na lista antiga | [F27] |
| Alarme para webhook ou Telegram | os canais são faixa no console, e-mail e SMS | [F26][F27] |
| Mais de um destinatário | um e-mail por região; a saída sugerida é uma lista de distribuição | [F27] |
| Reação em menos de 5 minutos | o alarme avalia pontos de 5 minutos | [F26] |
| Ação automática (reiniciar, recuperar) | o alarme só notifica nas páginas lidas | [F26], **[confirmar]** |

Memória e disco são justamente o que aperta com OpenSearch em 2 GB e 60 GB. Vigiar os dois fica
dentro da máquina, por nossa conta. O agente do CloudWatch numa máquina Lightsail: **[confirmar]**.

### Acesso sem senha

- O acesso é por **par de chaves SSH**: chave padrão por região (a privada pode ser baixada de novo
  na página da conta), chave criada no Lightsail (a privada só se baixa na criação) ou chave pública
  enviada por nós [F28].
- Há um cliente SSH no navegador, dentro do console, que usa um par de chaves próprio e segue
  funcionando mesmo se a chave configurada for perdida; até 5 sessões simultâneas [F7][F28].
- A porta 22 nasce aberta para qualquer IP; restringir a origem é regra de firewall nossa [F19].
- **Systems Manager (Session Manager) não é nativo no Lightsail.** O artigo da AWS sobre o assunto
  apareceu na busca, mas a página recusou a leitura automática (HTTP 403) [F29]; pelo resumo da
  busca, o caminho é registrar a máquina por ativação híbrida. **[confirmar]** lendo o artigo.
- Papel de IAM anexado à máquina (para chamar a AWS sem chave guardada): nenhuma página lida
  descreve isso para instâncias; o que existe é anexar a máquina a um bucket [F22]. **[confirmar]**

### Outras ausências

- **Um servidor só:** o ticket fixa uma máquina. Balanceador (US$ 18/mês) e segunda zona existem,
  mas são outro desenho [F1][F8].
- **Rede privada com o resto da AWS:** só por pareamento com a VPC **padrão** da região, ligado por
  região; S3, CloudFront e DynamoDB dispensam o pareamento [F24].
- **Cotas baixas e fixas:** 6 zonas de DNS, 20 buckets, 2 chaves por bucket, 15 discos por máquina,
  não ajustáveis; ajustáveis só as de instâncias e de IPs fixos [F7].
- **Saída:** o snapshot pode ser exportado para o EC2 se o Lightsail ficar pequeno [F9].

## O que ficou por confirmar

1. Preço exibido no console para o plano de 2 GB em `sa-east-1`.
2. O que acontece com o desempenho quando o saldo de CPU zera, e a duração do modo de lançamento.
3. Criptografia e tipo dos discos extras.
4. Limite de quantidade de snapshots por conta.
5. Consistência do snapshot com OpenSearch e SQLite em uso, e tempos de cópia e de restauração (só com ensaio).
6. Preço do S3 Standard em `sa-east-1` e a credencial que a máquina usaria para gravar no S3.
7. Ausência de lifecycle, object lock e replicação no bucket do Lightsail; tamanho máximo de objeto.
8. Systems Manager por ativação híbrida e papel de IAM em máquina Lightsail.
9. Agente do CloudWatch em máquina Lightsail e ação automática de alarme.

## Páginas que não abriram

- `https://aws.amazon.com/lightsail/faqs/` devolveu HTTP 404.
- `https://repost.aws/knowledge-center/add-lightsail-to-systems-manager` devolveu HTTP 403.
- `https://aws.amazon.com/s3/pricing/` abriu sem a tabela de preços (conteúdo dinâmico).
- `https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-enabling-https-on-instances.html`
  veio sem corpo; o HTTPS na máquina foi lido em [F18].

Nada dessas páginas foi preenchido de memória: o que dependia delas está em **[confirmar]**.

## Fontes

Todas consultadas em 2026-11-28.

- [F1] Preços do Lightsail: https://aws.amazon.com/lightsail/pricing/
- [F2] Base de CPU por plano: https://docs.aws.amazon.com/lightsail/latest/userguide/baseline-cpu-performance.html
- [F3] Acúmulo de saldo de CPU: https://docs.aws.amazon.com/lightsail/latest/userguide/cpu-burst-capacity-accrual.html
- [F4] Transferência de dados: https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-data-transfer-allowance.html
- [F5] Cobrança e conta: https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-frequently-asked-questions-faq-billing-and-account-management.html
- [F6] Criar e anexar disco (Linux): https://docs.aws.amazon.com/lightsail/latest/userguide/create-and-attach-additional-block-storage-disks-linux-unix.html
- [F7] Endpoints e cotas do Lightsail: https://docs.aws.amazon.com/general/latest/gr/lightsail.html
- [F8] Regiões e zonas: https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-regions-and-availability-zones-in-amazon-lightsail.html
- [F9] Snapshots: https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-instance-snapshots-in-amazon-lightsail.html
- [F10] Snapshots automáticos: https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-configuring-automatic-snapshots.html
- [F11] Hora do snapshot automático: https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-changing-automatic-snapshot-time.html
- [F12] Aumentar a partir de snapshot: https://docs.aws.amazon.com/lightsail/latest/userguide/how-to-create-larger-instance-from-snapshot-using-console.html
- [F13] IP fixo: https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-static-ip-addresses-in-amazon-lightsail.html
- [F14] Snapshot de instância Linux: https://docs.aws.amazon.com/lightsail/latest/userguide/lightsail-how-to-create-a-snapshot-of-your-instance.html
- [F15] Copiar snapshots entre regiões: https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-copying-snapshots-from-one-region-to-another.html
- [F16] DNS no Lightsail: https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-dns-in-amazon-lightsail.html
- [F17] Certificados SSL/TLS: https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-tls-ssl-certificates-in-lightsail-https.html
- [F18] HTTPS na instância com Let's Encrypt e Certbot (Nginx): https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-using-lets-encrypt-certificates-with-nginx.html
- [F19] Firewall da instância: https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-firewall-and-port-mappings-in-amazon-lightsail.html
- [F20] Buckets do Lightsail: https://docs.aws.amazon.com/lightsail/latest/userguide/buckets-in-amazon-lightsail.html
- [F21] Identificar rajadas (citada pela pesquisa anterior, não relida hoje): https://docs.aws.amazon.com/lightsail/latest/userguide/identifying-instance-burst.html
- [F22] Permissões do bucket: https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-understanding-bucket-permissions.html
- [F23] Preços do S3 (tabela não carregou): https://aws.amazon.com/s3/pricing/
- [F24] Pareamento de VPC: https://docs.aws.amazon.com/lightsail/latest/userguide/lightsail-how-to-set-up-vpc-peering-with-aws-resources.html
- [F25] Métricas dos recursos: https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-resource-health-metrics.html
- [F26] Alarmes de métrica: https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-alarms.html
- [F27] Contatos de notificação: https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-adding-editing-notification-contacts.html
- [F28] Chaves SSH e conexão: https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-ssh-in-amazon-lightsail.html
- [F29] Lightsail no Systems Manager (HTTP 403, não lida): https://repost.aws/knowledge-center/add-lightsail-to-systems-manager

Ponto de partida, no repositório: `docs/pesquisa-inicial/custos.md` e
`docs/pesquisas/painel-e-aws.md` na branch `research/painel-aws` (consultas de 15/11/2026).
