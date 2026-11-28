# Pesquisa: ferramentas do passo de ir ao ar

Consulta em **2026-11-28**, só a fontes primárias (lista em [Fontes](#fontes)). Responde o ticket
[Pesquisar as ferramentas do passo de ir ao ar](https://github.com/stacklabs3/monitora-ai/issues/93),
filho do [Mapa: infra da plataforma](https://github.com/stacklabs3/monitora-ai/issues/52).

A stack e a máquina não se discutem aqui: um servidor Rust (`tokio` + `axum`) que entrega o painel
(ADR 0003 e 0006), OpenSearch 3.9.0 na mesma máquina com heap de 700 MB (ADR 0002), cadastro em
SQLite embutido (ADR 0009), numa máquina Lightsail de 2 GB em `sa-east-1` (2 vCPUs com base de 20%,
60 GB), com firewall de entrada só na 443 e cópias no bucket do Lightsail
([Definir o que construir em volta da infra](https://github.com/stacklabs3/monitora-ai/issues/90)).
O que o Lightsail entrega já está em
[infra-disponivel.md](https://github.com/stacklabs3/monitora-ai/blob/research/infra-disponivel/docs/research/infra-disponivel.md)
e os preços em
[custos-da-infra.md](https://github.com/stacklabs3/monitora-ai/blob/research/custos-da-infra/docs/research/custos-da-infra.md);
esta pesquisa não repete nenhum dos dois.

Esta pesquisa **levanta opções e fatos; não decide**. Onde os fatos favorecem uma opção, isso está
dito com a fonte. Nada foi medido, nenhum recurso foi criado na AWS e nenhum código foi escrito.
O que não tem fonte primária está marcado **[confirmar]**.

**Como cada fonte foi lida.** Dois modos, marcados na lista de fontes:

- **(direto)**: o texto bruto foi baixado e lido (fontes da documentação do OpenSearch no GitHub,
  o unit `opensearch.service` na tag 3.9.0, o código de `rustls-acme` e `tokio-rustls-acme`, as
  páginas `.md` do guia do Lightsail, a API do crates.io).
- **(leitor)**: a página foi aberta por um leitor automático que devolve trechos e resumo. As
  citações vêm dele; números dessas páginas valem como lidos, mas convém reabrir antes de virar regra.

## Resumo

- **HTTPS:** com só a 443 aberta, o desafio HTTP-01 não passa (só funciona na porta 80) [F1]. Sobram
  TLS-ALPN-01 (na própria 443) e DNS-01 (pede credencial de DNS na máquina) [F1]. O Certbot só faz
  HTTP-01 e DNS-01 [F9]. TLS-ALPN-01 existe embutido em Rust (`rustls-acme`, `tokio-rustls-acme`)
  [F5][F6], no Caddy [F10] e no módulo ACME do nginx [F12]. Os fatos favorecem o servidor Rust
  terminar o HTTPS: é o único caminho que não soma processo nem abre porta. Nenhuma fonte primária
  dá a memória de Caddy, nginx ou do TLS embutido: **[confirmar]** por medida.
- **Validade do Let's Encrypt:** 90 dias hoje no perfil padrão; **64 dias a partir de 10/02/2027 e
  45 dias a partir de 16/02/2028** [F3]. Renovação presa a "a cada 60 dias" deixa de servir [F3].
- **Cópia do OpenSearch:** o snapshot do próprio banco é incremental por segmento e **não cifra do
  lado do cliente** [F14][F15]. O bucket do Lightsail não tem regra de expiração na API [F21] e
  cifra em repouso com chave da Amazon, não nossa [F20]. Os dois caminhos que sobram são: (A) uma
  cópia inteira por dia, empacotada e cifrada antes de subir, como a prova já mediu (10,8 GB em
  20 min, SIMULADO); (B) espelhar o repositório cifrando arquivo a arquivo. Apagar as de mais de
  7 dias é rotina nossa em A, e é a API do banco (ou a política SM) em B.
- **Reinício:** o unit do pacote `.deb` do OpenSearch 3.9.0 **não tem `Restart=`** [F26]; o padrão do
  systemd é `no` [F28]. Sem um ajuste nosso, o banco sobe no boot (com `systemctl enable`) mas **não
  volta sozinho de uma queda**. O systemd já está na máquina; Docker soma dois serviços.

## 1. HTTPS na máquina com renovação automática

### O que o Let's Encrypt exige

| Desafio | Porta | O que diz a fonte | Com só a 443 aberta |
| --- | --- | --- | --- |
| HTTP-01 | **80, e só ela**: "The HTTP-01 challenge can only be done on port 80" | fácil de automatizar; não emite curinga | **não passa**, a não ser abrindo a 80 |
| TLS-ALPN-01 | 443 | funciona com a 80 fechada; "ACME client support is limited"; não emite curinga | passa |
| DNS-01 | nenhuma de entrada | pede API do DNS; guardar a credencial de DNS no servidor web é apontado como risco | passa, com credencial de DNS na máquina |

Fonte: [F1] (página atualizada em 12/02/2026, pelo leitor).

Limites que tocam um domínio só [F2] (página atualizada em 05/08/2026, pelo leitor):

- 50 certificados por domínio registrado a cada 7 dias; **5 certificados para o mesmo conjunto exato
  de nomes a cada 7 dias** (este não tem exceção a pedido).
- 5 falhas de validação por nome, por conta, por hora.
- 300 pedidos novos por conta a cada 3 horas; 10 contas novas por IP a cada 3 horas.
- Renovação coordenada por ARI fica fora de todos os limites.

Consequência direta: quem perde o certificado e a conta a cada reinício (sem guardar em disco) bate
no limite de 5 por semana. `rustls-acme` e `tokio-rustls-acme` dizem o mesmo: em produção é
obrigatório guardar conta e certificado em cache [F5][F6].

Validade [F3][F4]:

| Data | Perfil padrão (`classic`) | Reuso da validação do domínio |
| --- | --- | --- |
| hoje (28/11/2026) | 90 dias | 30 dias |
| 10/02/2027 | **64 dias** | 10 dias |
| 16/02/2028 | **45 dias** | 7 horas |

O perfil `tlsserver` (opcional) já emite 45 dias desde 13/05/2026 e o `shortlived` emite 160 horas
[F3][F4]. O Let's Encrypt recomenda renovar por ARI ou, sem ARI, em torno de dois terços da vida do
certificado, e diz que renovar a cada 60 dias fixos deixa de bastar [F3].

### Opções

| | A. O servidor Rust termina o HTTPS | B. Caddy na frente | C. nginx com módulo ACME | D. nginx + Certbot |
| --- | --- | --- | --- | --- |
| Peças | `rustls` 0.23.46 + `rustls-acme` 0.15.4 ou `tokio-rustls-acme` 0.11.0 [F7] | um binário Go a mais | nginx + módulo dinâmico `nginx-module-acme` [F12] | nginx + Certbot (Python) + agendador |
| Processos a mais | **nenhum** | 1 | 1 mestre + trabalhadores [F13] | os do nginx, mais o Certbot quando roda |
| Desafio com só a 443 | TLS-ALPN-01, o padrão das duas crates [F5][F6] | TLS-ALPN-01 vem ligado por padrão junto do HTTP-01; ao falhar um, tenta o outro [F10] | `challenge` aceita `http-01` e `tls-alpn-01` [F12]; o README do módulo diz "Only HTTP-01 challenge type is supported" [F12b]: **[confirmar]** | **não tem TLS-ALPN-01**: só HTTP-01 (porta 80) e DNS-01 [F9] |
| Renovação | automática, dentro do processo: renova quando faltar 1/3 da vida do certificado (lido no código) [F5b][F6b] | automática: "Caddy keeps all managed certificates renewed" [F10]; momento exato **[confirmar]** | implícita na página; mecanismo e momento **[confirmar]** [F12] | tarefa agendada que roda `certbot renew`; renova com menos de 1/3 da vida (Certbot 4.0.0 em diante) [F9] |
| Aguenta os 45 dias de 2028 | sim: a regra é fração da vida, não dias fixos [F5b][F6b] | **[confirmar]** | **[confirmar]** | sim: idem [F9] |
| Onde ficam conta e certificado | pasta nossa (`DirCache`) [F5][F6] | `/var/lib/caddy/.local/share/caddy` no serviço do pacote [F11] | `state_path` [F12] | `/etc/letsencrypt` **[confirmar]** |
| Memória | **[confirmar]** | **[confirmar]** | 2,5 MB por 10.000 conexões keep-alive paradas [F13]; base do processo **[confirmar]** | idem nginx; Certbot **[confirmar]** |
| "Um servidor só" (ADR 0003) | mantém: um programa, uma porta | vira dois programas; o servidor Rust passa a ouvir só em `127.0.0.1` | idem B | idem B, mais a tarefa do Certbot |

### O que cada caminho muda no "um servidor só"

- **A.** O ADR 0003 fica como está. O HTTPS entra na borda do servidor, antes das duas entradas
  HTTP, e o certificado vira um arquivo a mais para guardar e copiar. As duas crates se integram ao
  `axum`: ambas trazem a feature `axum` [F7]; a `tokio-rustls-acme` depende opcionalmente do
  `axum-server` [F6], que é "a hyper server implementation designed to be used with axum" com TLS
  por `rustls` [F8]. O exemplo de integração não foi lido: **[confirmar]**.
- **B, C, D.** Entra um segundo programa para subir, vigiar, atualizar e reiniciar, o que o ADR 0003
  recusou para os módulos pelo mesmo motivo (memória e operação). Em troca, o servidor Rust não
  conhece TLS.
- **Porta 443 sem ser root:** vale para qualquer caminho. Como o processo ganha a porta baixa
  (capacidade no unit do systemd ou outro meio) não foi lido: **[confirmar]**.

### Riscos de cada caminho, pelas fontes

- **A.** As duas crates avisam que o módulo `acme` é "incomplete" e "not covered by any stability
  promises" [F5][F6]. `rustls-acme` é de conta pessoal (`FlorianUekermann`); `tokio-rustls-acme` é
  da organização `n0-computer` e a 0.11.0 saiu em 26/11/2026, dois dias antes desta consulta [F7];
  a documentação dela no docs.rs **falhou ao compilar** (a última que compilou é a 0.7.1) [F6].
  Nenhuma das duas mostrou suporte a ARI nem a perfil ACME nas páginas lidas: **[confirmar]**.
  A alternativa de nível mais baixo é a `instant-acme` 0.8.5 (cliente ACME puro, com ARI e os três
  desafios), que **não** serve o desafio nem agenda a renovação: isso seria código nosso [F7b].
- **B.** A página de HTTPS automático lista "ports 80 and 443 are open externally" como requisito
  [F10]. O TLS-ALPN-01 sozinho funciona pela troca de desafio descrita na mesma página, e o emissor
  tem `disable_http_challenge` [F10b]; nenhuma página lida afirma "funciona só com a 443":
  **[confirmar]** por ensaio. Por padrão o Caddy usa duas autoridades (Let's Encrypt e ZeroSSL) [F10].
- **C.** O módulo ACME do nginx é separado do nginx (pacote `nginx-module-acme`, nginx 1.22.0 ou mais
  novo para compilar) e pede um `resolver` no bloco `http` [F12][F12b].
- **D.** Com o Certbot, ou a 80 abre para o mundo (contra o firewall decidido), ou entra DNS-01. Para
  a zona de DNS do Lightsail só existe plugin de terceiro (`dns-lightsail`); o oficial é o
  `certbot-dns-route53`, de outro serviço [F9]. DNS-01 põe credencial de DNS na máquina [F1]. O
  tutorial da AWS para Let's Encrypt na instância usa Certbot com renovação manual
  ([infra-disponivel.md](https://github.com/stacklabs3/monitora-ai/blob/research/infra-disponivel/docs/research/infra-disponivel.md), F18).
- **Ação `SetupInstanceHttps` do Lightsail:** existe na API, emite por Let's Encrypt e instala na
  instância [F22]. A página não diz em que imagens funciona nem se renova sozinha, e o guia que a
  explicaria veio sem corpo: **[confirmar]**. Não entra na tabela por isso.

### O que os fatos favorecem

O caminho **A**: é o único que cumpre os três fatos ao mesmo tempo, sem exceção: nenhuma porta além
da 443 [F1][F5], nenhum processo a mais na conta de 1,5 GB (ADR 0002) e renovação por fração da vida
do certificado, que já serve para 64 e 45 dias [F3][F5b][F6b]. O preço é depender de crates que se
declaram sem promessa de estabilidade no módulo ACME [F5][F6]. Entre B, C e D, o Caddy é o único com
TLS-ALPN-01 ligado por padrão [F10]; o Certbot fica de fora enquanto a 80 estiver fechada [F9].

A memória não desempata nada: não há número de fonte primária para nenhum dos quatro.

## 2. Cópia do OpenSearch 3.9.0

### O que o snapshot do banco é

- **Formato:** snapshot para um repositório registrado. Os tipos são sistema de arquivos (`fs`),
  S3, HDFS e Azure [F14]. O `fs` pede a pasta em `path.repo` no `opensearch.yml` [F14]. O S3 pede o
  plugin `repository-s3`, que é plugin do núcleo e **não vem instalado**
  (`opensearch-plugin install repository-s3`) [F14][F16].
- **A quente:** "While a snapshot is in progress, you can still index documents" [F14]. O que entra
  depois do início em geral não vai na cópia.
- **Incremental:** "they only store data that has changed since the last successful snapshot" [F14].
  No repositório, cada segmento vira um arquivo de nome único (`__<uuid>`), e um arquivo `index-N`
  na raiz lista os snapshots; o `index-N` nunca é sobrescrito, só ganha uma geração nova [F17].
- **Apagar:** só pela API. "be sure to use the OpenSearch API rather than navigating to the storage
  location and purging files [...] OpenSearch only removes data that no other snapshot is using"
  [F14]. Apagar arquivo antigo à mão no repositório quebra os snapshots novos que ainda o usam.
- **Volta:** restaura na mesma versão ou em uma versão maior à frente; não volta para versão mais
  antiga [F14]. A recomendação é um repositório por versão maior [F14].
- **Ritmo:** o padrão é 40 MB/s por nó (`max_snapshot_bytes_per_sec`), ajustável [F15]. Com a base
  de 20% de CPU, esse é o freio que existe. Memória e CPU gastas pelo snapshot: **[confirmar]**.
- **Cifra:** as configurações do repositório `fs` não têm cifra; as do `s3` só têm cifra do lado do
  servidor (`server_side_encryption_type`: `AES256` ou `aws:kms`) [F15]. O plugin `crypto-kms` existe
  no núcleo e depende do AWS KMS ("AWS KMS plugin to provide crypto keys") [F16]: é serviço pago
  novo, e se ele cifra repositório de snapshot comum não foi confirmado: **[confirmar]**.

### O que o bucket do Lightsail aceita

- **Fala a API do S3 para objetos:** o guia manda usar `aws s3api put-object`, `delete-object` e
  `delete-objects` no bucket, com envio único de até 5 GB e multipart acima disso [F18][F19]. O
  bucket é "built using the Amazon Simple Storage Service" [F18b].
- **Credencial:** máquina anexada ao bucket tem acesso completo sem chave guardada [F20b]. O tutorial
  do WordPress, com a máquina anexada, escolhe no plugin a opção "My server is on Amazon Web Services
  and I'd like to use IAM Roles" [F20c]. Disso se **infere** que a máquina anexada recebe credencial
  temporária pelo serviço de metadados, como um papel de IAM; a AWS não descreve o mecanismo:
  **[confirmar]**.
- **Cifra em repouso:** "Lightsail performs server-side encryption with Amazon managed keys" e HTTPS
  obrigatório no trânsito [F20]. A chave é da Amazon. Não cumpre sozinha "chave fora do disco e dos
  backups" ([Definir privacidade, acesso e retenção](https://github.com/stacklabs3/monitora-ai/issues/8)),
  porque quem tem acesso ao bucket lê o conteúdo.
- **Regra de expiração:** **não existe na API do Lightsail.** As ações de bucket são criar, apagar,
  atualizar, trocar plano, chaves de acesso, métricas e acesso de recurso [F21]; `UpdateBucket` só
  aceita log de acesso, regras de acesso público, CORS, contas de leitura e versionamento [F21b].
  Fecha o item 7 dos pendentes da pesquisa de infra no que toca a API do Lightsail. Se a chamada do
  S3 `PutBucketLifecycleConfiguration` é aceita num bucket do Lightsail não está escrito:
  **[confirmar]** (só com ensaio).
- **`repository-s3` apontado para o bucket do Lightsail:** nenhuma página da AWS nem do OpenSearch
  cita essa combinação. O plugin aceita `endpoint`, `region` e credencial por chave no keystore ou
  por perfil da instância [F14][F15], e pede as permissões `s3:ListBucketMultipartUploads` e
  `s3:ListBucketVersions`, entre outras [F14]. Se o bucket do Lightsail as aceita: **[confirmar]**.

### Opções

| | A. Repositório `fs` + pacote cifrado por dia | B. Repositório `fs` + espelho cifrado arquivo a arquivo | C. `repository-s3` direto no bucket |
| --- | --- | --- | --- |
| Como sai | snapshot no disco; `tar` do repositório em fluxo, cifra, envio de um objeto por dia | snapshot no disco; `rclone sync` por um remoto `crypt` | o banco grava no bucket |
| Já exercitado no projeto | **sim**: a prova mediu `tar` + `openssl enc -aes-256-ctr`, 10.817.177.616 bytes em 1.206 s (SIMULADO) [P1] | não | não |
| Cifra do lado do cliente | sim, a que se escolher (ver abaixo) | sim: XSalsa20-Poly1305, blocos de 64 KiB, um objeto por arquivo, 32 bytes de cabeçalho e 16 por bloco [F23] | **não**: só a cifra do bucket, com chave da Amazon [F15][F20] |
| Quem guarda a chave de abrir | com chave pública (`age -r`), **só quem restaura**; a máquina cifra sem poder abrir [F24] | a máquina: a senha do `crypt` é simétrica e fica na configuração, "lightly obscured" [F23] | a Amazon |
| Tamanho no bucket | 7 cópias inteiras: 75,7 GB, a conta da [pesquisa de custos](https://github.com/stacklabs3/monitora-ai/blob/research/custos-da-infra/docs/research/custos-da-infra.md) | um repositório só, incremental: perto de uma cópia mais o que mudou em 7 dias **[confirmar]** | idem B |
| Envio diário | a cópia inteira, todo dia | só os arquivos novos (segmentos têm nome único [F17]) | só os segmentos novos |
| Apagar as de mais de 7 dias | apagar objetos pela data no nome, por rotina nossa (`aws s3api delete-object`) [F19]; cada objeto é independente | `DELETE _snapshot/<repo>/<snapshot>` ou política SM no banco [F14][F25]; depois o espelho propaga a remoção | idem B, sem espelho |
| Volta | baixar um objeto, abrir, desempacotar em `path.repo`, registrar o repositório e restaurar [F14][P1] | baixar e abrir o repositório inteiro, registrar e restaurar | registrar o repositório no banco novo (somente leitura) e restaurar [F14] |
| Disco da máquina | o repositório `fs` ocupa disco local (ordem de 10,8 GB, SIMULADO [P1]) | idem A | **nenhum** |
| Peças novas | `tar`, a ferramenta de cifra, AWS CLI | `rclone` | plugin `repository-s3` na JVM |

### Como a cifra entra

| Ferramenta | Tipo | Fato | Fonte |
| --- | --- | --- | --- |
| `age` | chave pública ou senha | "tar cvz ~/data \| age -r <chave pública> > data.tar.gz.age"; abre com o arquivo de identidade. Pacote `age` no Debian 12+ e Ubuntu 22.04+. Versão citada: 1.3.2; chave pós-quântica a partir da 1.3.0. BSD-3-Clause | [F24] |
| `openssl enc` | senha (simétrica) | foi o que a prova usou (`-aes-256-ctr -pbkdf2`); a senha tem de estar na máquina na hora da cópia. Manual não lido: **[confirmar]** | [P1] |
| `gpg` | chave pública ou senha | página do manual devolveu HTTP 404: **[confirmar]** | — |
| `rclone crypt` | senha (simétrica) | cifra arquivo a arquivo e, por padrão, o nome dos arquivos; chave derivada por scrypt | [F23] |
| Cifra do bucket | do lado do servidor | sempre ligada, chave da Amazon | [F20] |

Só a cifra por chave pública deixa a máquina **sem** o segredo que abre a cópia. Das ferramentas
lidas, a única com essa propriedade confirmada é o `age` [F24].

### Incremental, 7 dias e cifra: como os três se cruzam

- **Um snapshot não é um arquivo.** O snapshot de hoje aponta para segmentos gravados em dias
  anteriores [F14][F17]. "Apagar as cópias de mais de 7 dias" só é "apagar objetos velhos" na opção
  A, em que cada dia é um pacote inteiro. Em B e C, apagar pela idade do **objeto** destrói cópias
  novas; quem apaga é o banco.
- **Um índice por dia ajuda o incremental.** Os índices de dias fechados quase não mudam (ADR 0002),
  então o snapshot diário grava pouco. A exclusão de pessoa (`_delete_by_query`) e as junções de
  segmentos reescrevem arquivos, e o quanto isso soma por dia não foi medido: **[confirmar]**.
- **Cifrar arquivo a arquivo preserva o incremental; empacotar não.** O `crypt` mantém um objeto por
  arquivo [F23], então só o novo sobe. O pacote `tar` cifrado muda inteiro a cada dia.
- **Em A, um snapshot novo a cada dia no mesmo repositório `fs` continua incremental no disco**, mas
  o pacote enviado é o repositório inteiro. Para o pacote ter só o dia, o repositório local guarda
  um snapshot por vez (apagando o anterior pela API antes de empacotar) ou guarda vários e o pacote
  leva todos. Qual dos dois é detalhe do roteiro, não desta pesquisa.
- **Política SM (Snapshot Management):** cria e apaga snapshots por cron, com `max_age` (ex.: `7d`),
  `max_count` e `min_count` (padrão 1) [F25]. Vem do plugin Index Management, que acompanha a
  distribuição completa (não a mínima) e depende do Job Scheduler [F16][F25b]. Roda dentro da JVM do
  banco, sem processo novo; repete até 3 vezes em caso de falha [F25b]. Ela só cuida do repositório:
  cifrar e enviar ao bucket continua fora dela.
- **Espelho propaga erro.** Em B, o bucket é uma imagem do repositório local. Um repositório local
  estragado é copiado por cima do bom. O bucket tem versionamento, desligado por padrão, e cada
  versão ocupa espaço do plano [F18b]. Em A, as 7 cópias são independentes.

### Envio e memória das ferramentas de envio

- `aws s3 cp - s3://bucket/chave` envia a partir da entrada padrão; acima de 50 GB pede
  `--expected-size` [F27]. Serve à opção A sem arquivo intermediário no disco.
- `aws s3 sync` copia arquivos novos e alterados (tamanho diferente ou data mais nova) e, com
  `--delete`, apaga no destino o que sumiu da origem [F27b]. Não cifra do lado do cliente.
- AWS CLI: 10 requisições simultâneas e partes de 8 MB por padrão; baixar `max_concurrent_requests`
  é o ajuste indicado para máquina pequena [F27c]. Memória total do processo: **[confirmar]**.
- `rclone`: o multipart gasta `--transfers` × `--s3-upload-concurrency` × `--s3-chunk-size` de
  memória extra; a listagem com `--fast-list` gasta cerca de 1 KiB por objeto [F23b]. O `rclone`
  aceita papel de IAM de instância EC2; a página não cita Lightsail [F23b].
- `repository-s3`: o `buffer_size` padrão é o menor entre 100 MB e 5% do heap [F15]; com heap de
  700 MB, 35 MB (conta nossa), dentro da JVM.

### O que os fatos favorecem

A opção **A com cifra por chave pública**: é a única já exercitada na prova [P1], a única em que a
chave de abrir fica fora da máquina [F24], a que casa com a conta de 75,7 GB em que o teto de
US$ 15 foi fechado, e a única em que "apagar as de mais de 7 dias" é apagar objetos independentes
[F19]. O custo dela é enviar a cópia inteira todo dia (10,8 GB em 20 min na prova, SIMULADO) e manter
o repositório no disco local.

A opção **C** fica com dois impedimentos pelas fontes: não cifra do lado do cliente sem KMS [F15][F16]
e a compatibilidade do plugin com o bucket do Lightsail não está escrita em lugar nenhum.

A opção **B** gasta menos bucket e menos envio, mas deixa a senha na máquina [F23] e troca 7 cópias
independentes por um espelho.

## 3. Subida e reinício automático

### O que o systemd oferece

| Peça | O que faz | Fonte |
| --- | --- | --- |
| `WantedBy=multi-user.target` + `systemctl enable` | cria o vínculo que faz o serviço subir no boot | [F29] |
| `Restart=` | padrão `no`. `on-failure` reinicia em saída com erro, sinal, tempo esgotado, watchdog e morte por falta de memória; `always` também em saída limpa. "Setting this to on-failure is the recommended choice for long-running services" | [F28] |
| `RestartSec=` | espera antes de reiniciar; padrão 100 ms | [F28] |
| `RestartSteps=` + `RestartMaxDelaySec=` | espera que cresce a cada tentativa | [F28] |
| `StartLimitIntervalSec=` / `StartLimitBurst=` | padrão 10 s e 5: mais de 5 partidas em 10 s e o serviço **não é mais reiniciado** sozinho | [F29][F30] |
| `After=` / `Before=` | só a ordem; "independent of and orthogonal to the requirement dependencies" | [F29] |
| `Wants=` | puxa o outro serviço junto; se ele falhar, este sobe mesmo assim | [F29] |
| `Requires=` / `BindsTo=` | dependência forte: se o outro falhar ou parar, este não sobe ou para junto | [F29] |
| `OnFailure=` | ativa outra unidade quando esta entra em `failed` | [F29] |
| Timer com `OnCalendar=` e `Persistent=` | agenda por relógio e recupera a execução perdida com a máquina desligada | [F31] |

Dois cruzamentos que saem direto dessas páginas:

- Com `RestartSec` de 100 ms, um serviço que cai logo ao subir faz 5 partidas em menos de 10 s e
  para de ser reiniciado [F28][F29][F30]. Reinício automático que valha pede `RestartSec` maior ou
  outro limite de partidas.
- Entre o servidor e o banco, `Wants=` + `After=` no unit do servidor sobem o banco antes sem prender
  o servidor a ele. `Requires=` ou `BindsTo=` derrubariam o servidor junto com o banco, o contrário
  do que o projeto decidiu ("o servidor já tem de aguentar o banco fora",
  [Definir o que construir em volta da infra](https://github.com/stacklabs3/monitora-ai/issues/90)).
  `After=` só espera o banco **começar**; o unit do banco é `Type=notify` [F26], então o systemd
  espera o aviso de pronto dele.

### O unit do OpenSearch em cada forma de instalar

| | Pacote `.deb` / `.rpm` | Tarball | Docker |
| --- | --- | --- | --- |
| Unit do systemd | vem no pacote [F26] | não vem; a documentação dá um exemplo e avisa que ele "is only suitable for testing in a non-production environment" e manda usar o pacote [F32] | não se aplica |
| Sobe no boot | depois de `sudo systemctl enable opensearch` (o pacote não liga sozinho) [F33] | depois de criar o unit e ligar [F32] | com `restart: always` ou `unless-stopped`, desde que o serviço do Docker suba no boot; em Debian e Ubuntu ele sobe por padrão [F34][F35] |
| Volta de uma queda | **não**: o unit não tem `Restart=` [F26]. Pede um ajuste nosso (`systemctl edit`) | idem: o exemplo também não tem `Restart=` [F32] | sim, pela política de reinício; ela só vale depois de o contêiner ficar 10 s de pé [F34] |
| `vm.max_map_count` | o pacote ajusta para 262144 [F36] | manual [F36] | manual, no hospedeiro [F36b] |
| Limite de arquivos | `LimitNOFILE=65535` no unit [F26] | no exemplo [F32] | pelo compose |
| Trava de memória (`bootstrap.memory_lock`) | o unit **não** libera; pede `LimitMEMLOCK=infinity` por `systemctl edit` [F36] | idem | `ulimits.memlock: -1` no compose de exemplo [F36][F36b] |
| Tempo para subir | `TimeoutStartSec=75` [F26] | 75 no exemplo [F32] | sem limite do systemd |
| Processos a mais na máquina | nenhum (o systemd já é o processo 1) | nenhum | `dockerd` e `containerd` [F35] |
| Memória a mais | nenhuma além do banco | idem | **[confirmar]** (sem número de fonte primária) |
| Já exercitado no projeto | **sim**: a VM da prova instalou o `.deb` 3.9.0 com `LimitMEMLOCK=infinity`, `LimitNOFILE=65536` e `TimeoutStartSec=600` [P2] | não | sim, na rodada em contêiner [P1] |

O unit do pacote na tag 3.9.0, lido direto [F26]: `Type=notify`, `User=opensearch`,
`LimitNOFILE=65535`, `TimeoutStartSec=75`, `TimeoutStopSec=0`, `KillMode=process`, `SendSIGKILL=no`,
`SuccessExitStatus=143`, `WantedBy=multi-user.target`. **Sem `Restart=`, sem `After=`.** É igual ao
da `main`.

Três fatos do unit que pesam no roteiro:

- **Sem `Restart=`, o banco não volta de uma queda.** A volta em 6,3 s da prova (ADR 0002) mede o
  banco subindo, não quem o manda subir.
- **`TimeoutStartSec=75`:** a prova trocou por 600 [P2]. Se o banco demorar mais de 75 s para avisar
  que subiu (30 dias de índices, CPU a 20%), o systemd o mata. Quanto ele demora na máquina real:
  **[confirmar]** em [Validar o banco na AWS](https://github.com/stacklabs3/monitora-ai/issues/60).
- **`SuccessExitStatus=143`:** parada por `SIGTERM` conta como saída limpa. Com `Restart=on-failure`
  um `systemctl stop` não dispara reinício; uma morte por falta de memória dispara [F28].

O servidor Rust não tem unit pronto: é arquivo nosso. A prova já escreveu um para o servidor de
teste (`servidor-prova.service`) [P2].

### O que os fatos favorecem

**Pacote `.deb` + systemd**, com um ajuste por `systemctl edit` (`Restart=on-failure`, `RestartSec`
maior que o padrão, `LimitMEMLOCK=infinity` e `TimeoutStartSec` maior), e um unit nosso para o
servidor com `After=` e `Wants=` no banco. É o caminho que a documentação do OpenSearch indica para
rodar como serviço [F32], o que a prova já rodou [P2] e o único que não soma processo. Docker resolve
o reinício com uma linha, mas põe dois serviços na conta de memória, sem número para dizer quanto.

## O que ficou por confirmar

**HTTPS**

1. Memória do TLS embutido (`rustls` por conexão), do Caddy parado e sob carga, da base do nginx e
   do Certbot. Nenhuma fonte primária dá número; só medida na máquina.
2. CPU de handshake na máquina de 20%: a página de desempenho do `rustls` dá 2.357 handshakes
   completos por segundo por núcleo em x86_64 (relatório de 07/03/2026) [F8b], em máquina que não é a nossa.
3. Suporte a ARI e a perfil ACME em `rustls-acme` e `tokio-rustls-acme`.
4. Exemplo de integração das duas crates com `axum` 0.8, e qual das duas compila com as versões do projeto.
5. Caddy emitindo só com a 443 aberta (TLS-ALPN-01 sozinho), e em que momento ele renova.
6. Módulo ACME do nginx: se o TLS-ALPN-01 funciona (a página da diretiva e o README divergem) e
   como ele agenda a renovação.
7. Como o servidor Rust ganha a porta 443 sem rodar como root.
8. `SetupInstanceHttps` do Lightsail: em que imagens funciona, que desafio usa e se renova sozinha.
9. Onde o Certbot guarda conta e certificado e o período do timer que o pacote instala.

**Cópia do OpenSearch**

10. `repository-s3` gravando num bucket do Lightsail (endpoint, credencial da máquina anexada,
    permissões de multipart e de versões).
11. Mecanismo pelo qual a máquina anexada ao bucket recebe credencial (inferido como papel de IAM
    pelo serviço de metadados, a partir do tutorial do WordPress).
12. `PutBucketLifecycleConfiguration` do S3 num bucket do Lightsail. A API do Lightsail não tem
    regra de expiração; a do S3 no mesmo bucket não foi testada.
13. Se o plugin `crypto-kms` cifra repositório de snapshot comum, e o preço do KMS em `sa-east-1`.
14. Memória e CPU do snapshot, do `tar`, do `age` e do envio na máquina real, e o tempo da cópia
    com a base de 20% (a prova mediu 20 min com 0,4 CPU, SIMULADO).
15. Quanto o snapshot diário cresce com `_delete_by_query` e junção de segmentos.
16. Manuais do `openssl enc` e do `gpg` (a página do GnuPG devolveu 404).
17. A documentação "latest" do OpenSearch era a 3.10.1 no dia da consulta; as páginas da 3.9 não
    foram abertas à parte. O unit do pacote e a lista de plugins foram lidos na tag 3.9.0.
18. `rclone`: filtros por idade em `rclone delete` e credencial em máquina Lightsail.

**Subida e reinício**

19. Memória do `dockerd` e do `containerd`.
20. Tempo de subida do OpenSearch na máquina real, frente ao `TimeoutStartSec=75` do pacote.
21. Se o pacote `.deb` 3.9.0 liga o serviço sozinho na instalação (a documentação manda ligar à mão).
22. Sistema da imagem do Lightsail a usar e a versão do systemd nela (`RestartSteps=` e
    `RestartMaxDelaySec=` são de versões recentes; a página lida é a do systemd 262).

## Páginas que não abriram ou vieram incompletas

- `https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-enabling-https-on-instances.html`
  veio sem corpo (igual à pesquisa de infra).
- `https://www.gnupg.org/gph/en/manual/x110.html` devolveu HTTP 404.
- `https://github.com/FlorianUekermann/rustls-acme` abriu sem o README; o README e o código foram
  lidos pelo endereço bruto.
- `https://docs.rs/tokio-rustls-acme/latest/` mostra a 0.11.0 com falha de compilação da
  documentação; o texto lido é o da página, que aponta a 0.7.1 como última compilada.
- As páginas do `docs.opensearch.org` passam de 180 mil caracteres com o menu; o conteúdo foi lido
  na fonte delas, no repositório oficial `opensearch-project/documentation-website`.
- `https://rclone.org/s3/` foi lida só até 100 mil caracteres de 373 mil.

Nada dessas páginas foi preenchido de memória: o que dependia delas está em **[confirmar]**.

## Fontes

Todas consultadas em 2026-11-28. **(direto)** = texto bruto lido; **(leitor)** = lida por leitor automático.

**Let's Encrypt**

- [F1] Tipos de desafio (leitor): https://letsencrypt.org/docs/challenge-types/
- [F2] Limites de emissão (leitor): https://letsencrypt.org/docs/rate-limits/
- [F3] De 90 para 45 dias, publicado em 02/12/2025 (leitor): https://letsencrypt.org/2025/12/02/from-90-to-45
- [F4] Perfis ACME (leitor): https://letsencrypt.org/docs/profiles/

**Crates Rust**

- [F5] `rustls-acme` 0.15.4, documentação (leitor): https://docs.rs/rustls-acme/latest/rustls_acme/
- [F5b] `rustls-acme`, `src/state.rs`, linha 238: espera até `fim - (fim - início) / 3` (direto): https://raw.githubusercontent.com/FlorianUekermann/rustls-acme/main/src/state.rs
- [F6] `tokio-rustls-acme` 0.11.0, documentação (leitor): https://docs.rs/tokio-rustls-acme/latest/tokio_rustls_acme/
- [F6b] `tokio-rustls-acme`, `src/state.rs`, linha 348: `renew_at = not_after - (not_after - not_before) / 3` (direto): https://raw.githubusercontent.com/n0-computer/tokio-rustls-acme/main/src/state.rs
- [F7] API do crates.io: versão, data, licença, repositório e features de `rustls-acme`, `tokio-rustls-acme`, `instant-acme`, `axum-server`, `rustls`, `tokio-rustls` e `rcgen` (direto): https://crates.io/api/v1/crates/rustls-acme (e o mesmo endereço com o nome de cada crate)
- [F7b] `instant-acme` 0.8.5 e o enum `ChallengeType` (leitor): https://docs.rs/instant-acme/latest/instant_acme/ e https://docs.rs/instant-acme/latest/instant_acme/enum.ChallengeType.html
- [F8] `axum-server` 0.9.2 (leitor): https://docs.rs/axum-server/latest/axum_server/
- [F8b] Desempenho do `rustls` (leitor): https://rustls.dev/perf/

**Certbot, Caddy e nginx**

- [F9] Certbot, guia de uso: plugins, desafios, renovação e plugins de DNS (leitor, até 100 mil de 104 mil caracteres): https://eff-certbot.readthedocs.io/en/stable/using.html
- [F10] Caddy, HTTPS automático (leitor): https://caddyserver.com/docs/automatic-https
- [F10b] Caddy, diretiva `tls` e opções globais (leitor): https://caddyserver.com/docs/caddyfile/directives/tls e https://caddyserver.com/docs/caddyfile/options
- [F11] Caddy como serviço (leitor): https://caddyserver.com/docs/running
- [F12] nginx, `ngx_http_acme_module` (leitor): https://nginx.org/en/docs/http/ngx_http_acme_module.html
- [F12b] Repositório `nginx/nginx-acme`, README (leitor): https://github.com/nginx/nginx-acme
- [F13] nginx, arquitetura e memória por conexão parada (leitor): https://nginx.org/en/

**OpenSearch**

- [F14] Tirar e restaurar snapshots (direto, fonte da página): https://raw.githubusercontent.com/opensearch-project/documentation-website/main/_tuning-your-cluster/availability-and-recovery/snapshots/snapshot-restore.md — página: https://docs.opensearch.org/latest/tuning-your-cluster/availability-and-recovery/snapshots/snapshot-restore/
- [F15] API de criar repositório: configurações de `fs` e `s3` (direto): https://raw.githubusercontent.com/opensearch-project/documentation-website/main/_api-reference/snapshots/create-repository.md — página: https://docs.opensearch.org/latest/api-reference/snapshots/create-repository/
- [F16] Plugins do núcleo na tag 3.9.0, entre eles `repository-s3` e `crypto-kms` (direto): https://github.com/opensearch-project/OpenSearch/tree/3.9.0/plugins — e plugins que acompanham a distribuição (direto): https://raw.githubusercontent.com/opensearch-project/documentation-website/main/_install-and-configure/plugins.md
- [F17] Formato do repositório de snapshot, `package-info.java` na tag 3.9.0 (direto): https://raw.githubusercontent.com/opensearch-project/OpenSearch/3.9.0/server/src/main/java/org/opensearch/repositories/blobstore/package-info.java
- [F25] API de Snapshot Management: campos da política (direto): https://raw.githubusercontent.com/opensearch-project/documentation-website/main/_tuning-your-cluster/availability-and-recovery/snapshots/sm-api.md
- [F25b] Snapshot Management: plugin, agendador, falhas (direto): https://raw.githubusercontent.com/opensearch-project/documentation-website/main/_tuning-your-cluster/availability-and-recovery/snapshots/snapshot-management.md
- [F26] `opensearch.service` do pacote, tag 3.9.0 (direto): https://raw.githubusercontent.com/opensearch-project/opensearch-build/3.9.0/scripts/pkg/service_templates/opensearch/usr/lib/systemd/system/opensearch.service
- [F32] Instalação por tarball, com o unit de exemplo (direto): https://raw.githubusercontent.com/opensearch-project/documentation-website/main/_install-and-configure/install-opensearch/tar.md
- [F33] Instalação por pacote Debian (direto): https://raw.githubusercontent.com/opensearch-project/documentation-website/main/_install-and-configure/install-opensearch/debian.md
- [F36] Instalação: configurações importantes (`vm.max_map_count`, trava de memória, heap) (direto): https://raw.githubusercontent.com/opensearch-project/documentation-website/main/_install-and-configure/install-opensearch/index.md
- [F36b] Instalação por Docker (direto): https://raw.githubusercontent.com/opensearch-project/documentation-website/main/_install-and-configure/install-opensearch/docker.md

**AWS Lightsail e AWS CLI**

- [F18] Enviar arquivos para o bucket (direto): https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-uploading-files-to-a-bucket.html
- [F18b] Buckets do Lightsail (direto): https://docs.aws.amazon.com/lightsail/latest/userguide/buckets-in-amazon-lightsail.html
- [F19] Apagar objetos do bucket (direto): https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-deleting-bucket-objects.html
- [F20] Boas práticas de segurança do bucket, seção "Encryption of data" (direto): https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bucket-security-best-practices.html
- [F20b] Acesso de recurso (anexar máquina ao bucket) (direto): https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-configuring-bucket-resource-access.html
- [F20c] Tutorial do WordPress com bucket (direto): https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-connecting-buckets-to-wordpress.html
- [F21] Lista de ações da API do Lightsail (direto): https://docs.aws.amazon.com/lightsail/2016-11-28/api-reference/API_Operations.html
- [F21b] `UpdateBucket` (direto): https://docs.aws.amazon.com/lightsail/2016-11-28/api-reference/API_UpdateBucket.html
- [F22] `SetupInstanceHttps` (direto): https://docs.aws.amazon.com/lightsail/2016-11-28/api-reference/API_SetupInstanceHttps.html
- [F27] AWS CLI, `s3 cp` (direto): https://docs.aws.amazon.com/cli/latest/reference/s3/cp.html
- [F27b] AWS CLI, `s3 sync` (direto): https://docs.aws.amazon.com/cli/latest/reference/s3/sync.html
- [F27c] AWS CLI, configuração do S3 (direto): https://docs.aws.amazon.com/cli/latest/topic/s3-config.html

**Cifra e envio**

- [F23] `rclone crypt` (leitor): https://rclone.org/crypt/
- [F23b] `rclone` S3 (leitor, parcial): https://rclone.org/s3/
- [F24] `age`, README (leitor): https://github.com/FiloSottile/age

**systemd e Docker**

- [F28] `systemd.service`, systemd 262 (leitor): https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html
- [F29] `systemd.unit` (leitor, até 100 mil de 108 mil caracteres): https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html
- [F30] `systemd-system.conf`: padrões de limite de partidas e de tempo (leitor): https://www.freedesktop.org/software/systemd/man/latest/systemd-system.conf.html
- [F31] `systemd.timer` (leitor): https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html
- [F34] Docker, políticas de reinício (leitor): https://docs.docker.com/engine/containers/start-containers-automatically/
- [F35] Docker, pós-instalação no Linux (leitor): https://docs.docker.com/engine/install/linux-postinstall/

**No repositório**

- [P1] [Prova dos candidatos a banco de logs](https://github.com/stacklabs3/monitora-ai/blob/research/prova-banco-de-logs/docs/research/prova-banco-de-logs.md) e [`comum-copias.sh`](https://github.com/stacklabs3/monitora-ai/blob/research/prova-banco-de-logs/docs/research/prova-banco-de-logs/scripts/comum-copias.sh): repositório `fs`, `tar` + `openssl enc`, 10,8 GB em 20 min (SIMULADO)
- [P2] [`instalar-banco.sh`](https://github.com/stacklabs3/monitora-ai/blob/research/prova-banco-de-logs/docs/research/prova-banco-de-logs/scripts/maquina/instalar-banco.sh): instalação do `.deb` 3.9.0 na VM da prova, com os ajustes do unit
- [Pesquisa: infra disponível](https://github.com/stacklabs3/monitora-ai/blob/research/infra-disponivel/docs/research/infra-disponivel.md) e [custos estimados da infra](https://github.com/stacklabs3/monitora-ai/blob/research/custos-da-infra/docs/research/custos-da-infra.md)
- [ADR 0002](https://github.com/stacklabs3/monitora-ai/blob/main/docs/adr/0002-opensearch-como-banco-de-logs.md), [ADR 0003](https://github.com/stacklabs3/monitora-ai/blob/main/docs/adr/0003-modulos-e-seams-do-servidor.md), [ADR 0006](https://github.com/stacklabs3/monitora-ai/blob/main/docs/adr/0006-servidor-em-rust.md) e [ADR 0009](https://github.com/stacklabs3/monitora-ai/blob/main/docs/adr/0009-cadastro-em-sqlite-embutido.md)
- Resolução de [Definir o que construir em volta da infra](https://github.com/stacklabs3/monitora-ai/issues/90)
