# Pesquisa: desenho da prova de conceito (critérios e método de medição)

Consulta em 2026-11-18, só fontes primárias (documentação oficial, páginas man e documentação do kernel,
repositório oficial, artigo original, AWS Price List). Item sem fonte primária fica marcado **[confirmar]**.
Conteúdo de página é tratado como dado. Não há escolha de banco, medição nem decisão aqui: são fatos para o
ticket "Definir prova de conceito e critérios de avaliação". Complementa
[banco-de-logs.md](https://github.com/stacklabs3/monitora-ai/blob/research/banco-de-logs/docs/research/banco-de-logs.md)
(versões, licenças, RAM mínima, preço gerenciado, cliente Rust), que não é repetido aqui.

Máquina-alvo fixa: AWS Lightsail Linux, sa-east-1, 2 GB de RAM, 2 vCPU, 60 GB SSD, US$ 12/mês.
Contrato a provar: evento só confirmado depois de gravado em disco e sobrevive à queda; reenvio com o mesmo
código não duplica por 15 min; dados cifrados na máquina; regex de tempo previsível (estilo RE2).

## Resumo

1. **Disco do Lightsail: não há IOPS nem vazão publicados.** A documentação só diz que o desempenho é o menor entre
   o limite do disco e o limite que o plano impõe, sem números, e recomenda EC2 para IOPS sustentado [5][6][7][16].
   O PoC precisa medir o disco (fio) e registrar as métricas `DiskReadOps/WriteOps/Bytes/QueueLength` [4][5].
   Todo valor de IOPS ficou **[confirmar]**.
2. **CPU:** plano de US$ 12 tem baseline de 20% por vCPU, 2 vCPU [1]. Acúmulo de 4,17% por hora, teto de 24 h de
   acúmulo, sem expirar na máquina ligada, persistência de 7 dias entre paradas em instância criada depois de
   29/06/2023 [2]. Métricas: `BurstCapacityPercentage` (Percent) e `BurstCapacityTime` (Seconds), período mínimo
   de 300 s para elas [4]. Conta derivada (nossa): 12 min de CPU cheia ganhos por hora, 288 min de estoque cheio,
   queima líquida de 48 min/h a 100% de CPU, ou seja cerca de 6 h até esvaziar **[confirmar na máquina]**.
3. **Parada forçada:** `aws lightsail stop-instance --instance-name <n> --force`; a AWS diz que a máquina "não
   tem chance de descarregar cache de sistema de arquivos" e pede fsck depois [8][9]. Atenção: a CLI diz para usar
   `--force` só se travada em `stopping`; o guia diz que a CLI aceita em qualquer estado menos `shutting-down` e
   `terminated` [8][9]. Se a AWS recusa ou atrasa o `--force` numa máquina saudável: **[confirmar]**.
4. **Snapshot é incremental** (disco: só blocos alterados; cobrança só da parte alterada) [10][7]; US$ 0,05/GB-mês
   em sa-east-1 [13]. Snapshot de disco em uso só captura o que já foi gravado, sem cache de aplicação nem do SO
   [11]. Bucket de object storage em sa-east-1: US$ 3/mês por 100 GB (excedente US$ 0,023/GB-mês) [13]; S3 Standard
   em sa-east-1: US$ 0,0405/GB-mês nos primeiros 50 TB [14].
5. **Simular queda:** `echo b > /proc/sysrq-trigger` reinicia "sem sincronizar nem desmontar" [17]; `dm-flakey`
   descarta ou falha escritas em janelas [18]; `dm-log-writes` registra cada escrita e reproduz até uma marca,
   simulando o pior caso de cache volátil [19]; LazyFS descarta dados não sincronizados no nível do sistema de
   arquivos (FUSE) [20]. Numa VM sem hipervisor, só se prova o lado do SO convidado; a perda do cache de
   escrita do disco virtual fora da VM não é reproduzível e a honra do `FLUSH` pelo disco do Lightsail é
   **[confirmar]** [21][22][23].
6. **Benchmark justo:** ClickBench roda cada consulta 3 vezes, a 1ª fria e as outras quentes, com cache de páginas
   limpo antes da 1ª [24]. Checklist de Raasveldt et al.: várias execuções, desvio padrão, mediana com intervalo
   de confiança, verificar resultados, equivalência de funcionalidade e de ajuste [25]. Carga em taxa aberta evita
   coordinated omission: wrk2 `-R`, autocannon `-R`, k6 `constant-arrival-rate` [29][31][33].
7. **Durabilidade por candidato:** ClickHouse `fsync_after_insert` (padrão `false`) [35] e `async_insert=1` com
   `wait_for_async_insert=1` (padrão, confirma só após flush em disco) [36]; OpenSearch
   `index.translog.durability` = `request` (padrão) faz fsync antes de confirmar [40]; PostgreSQL
   `synchronous_commit` = `on` (padrão) com `fsync = on` [44]. **Armadilha:** `fsync_after_insert` desligado é o padrão do
   ClickHouse [35].
8. **Dedupe de reenvio por 15 min:** nenhum candidato tem janela por tempo para nó único. ClickHouse MergeTree
   não replicado deduplica por **contagem de blocos** (`non_replicated_deduplication_window`, padrão 0 = desligado)
   [35][37]; OpenSearch `_create/{id}` recusa o ID existente enquanto o documento existir no índice [42];
   PostgreSQL `INSERT ... ON CONFLICT DO NOTHING` exige índice único, que em tabela particionada precisa conter a
   chave de partição [46][47].
9. **Regex:** ClickHouse `match()` usa RE2 [39]; OpenSearch usa regex do Lucene (autômato, limite
   `max_determinized_states` 10.000, exige `search.allow_expensive_queries`) [41]; PostgreSQL usa a biblioteca de Henry
   Spencer, com retrovisores e lookaround, e o manual manda impor `statement_timeout` contra padrões hostis [45].
10. **Cifragem:** `cryptsetup benchmark` mede só memória e "não prevê a velocidade real" do disco [49]; medir com fio
    no volume LUKS real. AES-NI no Lightsail: sem fonte oficial **[confirmar]**; checar com `grep -m1 -o aes /proc/cpuinfo`.
11. **Node:** `monitorEventLoopDelay` devolve histograma em nanossegundos, `resolution` padrão 10 ms [53]. Node 20
    chegou ao fim de vida em 30/04/2026 (hoje é 18/11/2026), o que importa para a escolha da versão [55].
12. **Dados sintéticos:** compressão de log real vem da repetição de padrões [60]; gerar com poucos modelos de
    mensagem e variáveis de cardinalidade e entropia controladas, e medir a razão de compressão do sintético contra
    um log real público (Loghub, só uso acadêmico) [58][59]. Detalhes de entropia por campo: **[confirmar]**.

## 1. Lightsail: disco, CPU, parada, snapshot e preços

### 1.1 Disco do plano de 60 GB

- **IOPS e vazão (base, pico, créditos): não publicados.** O guia de métricas do disco de sistema diz que o
  desempenho é limitado pelo menor entre "o limite do próprio disco de sistema" e "o limite que o plano de
  instância impõe à vazão de armazenamento", e que operações e bytes são limites separados, sem dar valores [5].
  A FAQ de disco também não publica IOPS, vazão ou latência e recomenda EC2 com gp2 ou Provisioned IOPS para
  quem precisa de IOPS sustentado ou vazão alta [6][7][16]. O FAQ só fala em burst de CPU; **não descreve modelo
  de crédito de burst para disco** [7]. Tudo isso fica **[confirmar]** e a prova deve medir.
- Dado que a AWS documenta para o PoC: o disco de sistema do plano é o dispositivo raiz, é apagado com a
  instância e a AWS recomenda usá-lo só para dados temporários; dados que exigem durabilidade vão em disco anexado
  com snapshots [6]. Disco anexado: SSD, replicado dentro da zona, disponibilidade projetada de 99,99%,
  criptografado em repouso por padrão com chaves gerenciadas pela Lightsail [6]. Preço do disco anexado em
  sa-east-1: US$ 0,10/GB-mês [13].
- Métricas que a AWS oferece para observar o disco de sistema (granularidade de 5 min, período mínimo 60 s):
  `DiskReadOps`, `DiskWriteOps`, `DiskReadBytes`, `DiskWriteBytes`, `DiskTotalReadTime`, `DiskTotalWriteTime`,
  `DiskQueueLength`; não incluem discos anexados [4][5]. O guia diz que, no limite, o gráfico "para de subir" e
  fila e tempo total sobem juntos [5]. Como a granularidade é de 5 min, medições de latência fina têm de vir de
  dentro da máquina (fio, `iostat`), não das métricas da AWS.
- IOPS medidos por terceiros (sites de benchmark de VPS) existem, mas não são fonte primária e ficaram de fora.

### 1.2 CPU: baseline e créditos

- Baseline por vCPU: US$ 12 (2 vCPU, 2 GB, 60 GB) = 20%; US$ 7 = 10%; US$ 24 = 20%; US$ 44 = 30% [1]. A
  AWS publica o valor por vCPU, e o gráfico do console faz a média entre os vCPUs [1].
- Acúmulo: 4,17% de capacidade de burst por hora; teto igual ao que se ganha em 24 h; para de acumular em 100%;
  instâncias criadas a partir de 29/06/2023 mantêm o saldo por sete dias entre parar e iniciar; saldo de máquina
  ligada não expira [2]. Há ainda "burst de lançamento" que não conta no teto e pode mostrar mais de 100%
  nas primeiras 24 h [2]. **Consequência para a PoC:** rodar a medição logo após criar a instância infla o
  resultado; esperar ou medir o saldo antes de cada rodada.
- Contabilidade: o consumo é medido em milissegundos; quando a CPU fica abaixo do baseline o saldo sobe; acima, o saldo desce
  [1][3]. Exemplo oficial (plano de 10%): 6 min acumulados por hora; a 100% de CPU durante 60 min há consumo de 60
  e ganho de 6, saldo líquido de -54 min [3]. Extrapolação nossa para 20%: ganho de 12 min/h, ver Resumo.
- O que acontece com saldo zero: o guia diz que quem fica na zona de burst "acabará gastando toda a capacidade de
  CPU até voltar à zona sustentável" [3]; a documentação consultada não diz o
  valor exato do teto de CPU depois do esgotamento (presumivelmente o baseline). **[confirmar]**
- Métricas (API `GetInstanceMetricData`, período de 300 s para as de burst, estatísticas úteis Maximum e Average) [4]:
  - `BurstCapacityPercentage`: unidade Percent; pára de acumular em 100%.
  - `BurstCapacityTime`: unidade Seconds; consumido à taxa cheia só a 100% de CPU.
  - `CPUUtilization`: Percent; "ferramentas do SO podem mostrar percentual menor que o da Lightsail se a instância
    não tem um núcleo inteiro" [4]. Cuidado ao cruzar `top` com o gráfico.
  - `StatusCheckFailed`, `_Instance`, `_System`: 1 min de granularidade [4].
- Preço do plano de 2 GB com IPv4 público em sa-east-1: US$ 0,01612/h × 730 h ≈ US$ 11,77/mês (conta nossa sobre [13]);
  a página de preços lista US$ 12/mês [15].

### 1.3 Forçar parada

- CLI: `aws lightsail stop-instance --instance-name <nome> --force` [8][9]. A referência da CLI define `--force`
  como o modo para instância "presa no estado `stopping`" e avisa para usá-lo só nesse caso [8]. O guia diz que o
  console só mostra "Force stop" no estado `stopping`, e que a CLI permite o força em qualquer estado exceto
  `shutting-down` e `terminated`; pode levar alguns minutos, e se após 10 min não parou, repetir [9].
- Efeito: "ao forçar a parada, a máquina não tem oportunidade de descarregar caches e metadados do sistema de
  arquivos; depois, faça verificação e reparo do sistema de arquivos" [9]. Ou seja, é o mais próximo de "puxar o
  cabo" que a plataforma documenta, mas o estado exato do cache de escrita do disco virtual **[confirmar]**.
- Um IP público novo é atribuído ao reiniciar, salvo IP estático [8].

### 1.4 Snapshot e backup

- **Incremental:** "se você faz snapshots periódicos de um disco, eles são incrementais; só os blocos alterados
  depois do último snapshot são salvos", e basta manter o mais recente para restaurar o disco inteiro [10]. A FAQ de
  cobrança otimiza custo nos sucessivos: 30 GB custa US$ 1,50 no primeiro mês; um segundo snapshot com 2 GB alterados
  custa cerca de US$ 0,10/mês [7].
- **Preço:** US$ 0,05 por GB-mês de dados de snapshot em sa-east-1 [13][15]. Para 60 GB cheios, ≈ US$ 3,00
  no primeiro snapshot, mais as mudanças (conta nossa). A cobrança vale para manuais, automáticos e copiados [12].
- **Automáticos:** diários, guardam os últimos sete e os apagam junto com a instância (os manuais ficam) [12]. Instância
  nova a partir de snapshot só do mesmo tamanho de plano ou maior [12].
- **Consistência:** snapshot de disco em uso captura só o que já foi gravado "no momento do comando" e "pode excluir
  dados em cache do SO ou de aplicação"; para completo e consistente, pausar o sistema de arquivos ou desmontar [11].
  O mesmo texto vale para o snapshot do volume de sistema [11]. Snapshot de instância ligada com banco aberto equivale
  então a um estado de queda; restaurar exige recuperação do banco, não é backup lógico.
- **Object storage (bucket) em sa-east-1:** US$ 1 (5 GB), US$ 3 (100 GB), US$ 5 (250 GB) por mês; excedente de
  armazenamento US$ 0,023/GB-mês; sa-east-1 recebe metade da transferência incluída dos pacotes de instância [13][15].
  Transferência do bucket de São Paulo: US$ 0,15/GB de excedente segundo a página [15] (**[confirmar]** na Price List).
- **S3 como alternativa (Price List, publicação 2026-11-18):** Standard em sa-east-1 US$ 0,0405/GB-mês (primeiros 50
  TB); PUT/COPY/POST/LIST US$ 0,007 por 1.000; GET e outros US$ 0,0056 por 10.000; saída para a internet não
  aparece no recorte consultado, **[confirmar]** [14]. Comparação nossa: 100 GB no S3 ≈ US$ 4,05/mês, acima do
  bucket Lightsail de 100 GB (US$ 3) e acima do teto de US$ 3 do contrato.

## 2. Simular queda de máquina no Linux

| Ferramenta | O que faz (fonte) | O que prova sobre fsync | Limite |
|---|---|---|---|
| `sysrq b` | "reinicia imediatamente sem sincronizar nem desmontar discos" [17] | Que o banco sobrevive a perda do cache do SO convidado | Não prova que o disco virtual honrou o `FLUSH` (cache fora da VM sobrevive) |
| `dm-flakey` | alterna intervalos `up` e `down`; `drop_writes` ignora escritas em silêncio, `error_writes` falha, `corrupt_bio_byte` corrompe [18] | Que o banco detecta e se recupera de escrita perdida ou falha | Perda determinística, não imita a reordenação de um cache real |
| `dm-log-writes` | registra cada escrita, com marcas (`dmsetup message ... mark`); mantém escritas completas fora do disco até um `REQ_PREFLUSH` e registra `REQ_FUA` na hora; `replay-log` reproduz até uma marca e roda fsck [19] | O mais forte: simula "o pior caso do que está no disco" e permite conferir cada ponto de `fsync` | Precisa de dois dispositivos de bloco; só vale se o banco emitir flush/FUA |
| LazyFS | FUSE com cache próprio que só grava o que a aplicação sincroniza; `clear-cache` descarta dados não sincronizados; `torn-seq`/`torn-op` fazem escritas parciais; `lazyfs::crash` com filtro por regex de caminho [20] | Que cada confirmação de fsync/rename/diretório é de fato necessária e suficiente | FUSE no meio altera desempenho; roda sobre ext4 com FUSE 3 [20]; licença não resolvida pela página **[confirmar]** (a API do GitHub devolve NOASSERTION) |

Fatos que sustentam a leitura:

- `fsync` "inclui descarregar o cache do disco, se houver", mas **não garante a entrada do diretório**; para isso, fsync
  no descritor do diretório [21]. Vale para o dado e para `rename` dos bancos.
- `REQ_PREFLUSH` garante que o cache volátil do dispositivo foi descarregado antes do I/O; `REQ_FUA` só sinaliza a conclusão depois de gravado em mídia não volátil;
  dispositivos sem cache volátil ignoram o flush [22].
- O manual do PostgreSQL avisa que muitos SSDs "não honram o flush por padrão" e que a responsabilidade é do
  administrador; testar com `pg_test_fsync` e `diskchecker.pl` [23]. Esse é o teste que vale numa VM: se o
  `pg_test_fsync` mostra milhares de fsync/s num disco de rede, o flush provavelmente está sendo absorvido por cache.
- **O que dá para fazer numa VM sem acesso ao hipervisor:**
  1. `sysrq b` (precisa de `/proc/sys/kernel/sysrq` permitindo; escrever em `/proc/sysrq-trigger` exige root e não
     depende da máscara [17]) e o `--force` da API [9], para provar a recuperação do banco depois de reinício sem
     desmontar.
  2. `dm-flakey` e `dm-log-writes` precisam de um dispositivo de bloco para o dado. Num único disco raiz sem partição livre, as opções
     são um disco anexado (US$ 0,10/GB-mês [13]) ou um dispositivo `loop` sobre arquivo. Se `loop` sobre arquivo
     repassa flush/FUA com fidelidade: **[confirmar]**.
  3. LazyFS não precisa de dispositivo de bloco, só de FUSE [20].
  4. O que **não** dá: provar que o hardware de verdade preservou o dado depois de um corte de energia da máquina
     física, já que a plataforma não expõe isso. A prova será "o banco cumpre o contrato sob a semântica de flush
     que o SO vê", não "o disco da AWS é durável". A durabilidade do disco anexado é uma afirmação da AWS (réplica na
     zona, 99,99%) [6].

## 3. Benchmark justo

### 3.1 Regras

- **ClickBench** [24]: 43 consultas, cada uma rodada 3 vezes. 1ª = fria ("fria de verdade": cache de páginas do SO e
  caches do banco limpos e banco reiniciado; "morna": só o cache de páginas), 2ª e 3ª = quentes. Cache de resultados
  desligado; cache de dados (buffer pool) permitido. Padrões preferidos; resultado ajustado fica separado
  ("-tuned"). Carga num arquivo só, sem OPTIMIZE/VACUUM antes das consultas. Só chave primária como índice. Tempo inclui
  ida e volta ao cliente, sem suprimir a saída. Relata tempo de carga e tamanho em disco (com índices e logs).
  Limites declarados pelo próprio projeto: uma tabela plana de ~100 milhões de linhas, consultas em sequência, com
  poucas repetições; concorrência só num QPS suplementar [24]. **Não cobre ingestão contínua, durabilidade nem
  busca por texto livre**: serve de modelo de protocolo, não de suíte.
- **Raasveldt, Holanda, Gubner e Mühleisen (DBTest 2018)** [25]: seções 3.1 irreprodutibilidade, 3.2 falha em
  otimizar o concorrente, 3.3 "maçãs com laranjas" (mesma funcionalidade; ex.: programa mínimo contra SGBD
  completo), 3.4 ajuste específico demais, 3.5 execução fria/morna/quente, 3.6 ignorar o tempo de pré-processamento
  (carga e índices), 3.7 código incorreto. Checklist do apêndice: publicar hardware, parâmetros e versão do SGBD,
  código, dados, esquema e consultas; flags de compilação; funcionalidade e carga equivalentes; ajuste comparável;
  separar fria de quente ("fria: descarregar caches do SO e da CPU", "quente: ignorar as primeiras execuções");
  mesmo pré-processamento; **verificar resultados** e casos de canto; "vários runs para reduzir interferência",
  "verificar desvio padrão", "métricas robustas, ex. mediana e intervalo de confiança". Os autores relatam a mediana
  com intervalo de confiança de 95% não paramétrico por quantis [25]. Para o `drop_caches` o próprio artigo usa
  `echo 3 > /proc/sys/vm/drop_caches` como root [25].
- **Latência de cauda:** *Tell-Tale Tail Latencies* mostra que o gerador de carga pode impor latência que é registrada como do banco (GC do
  OLTPBench em Java), e que mediana e p95/p99 podem ficar iguais enquanto o máximo sobe ordens de grandeza [26]. O
  artigo usa laço fechado e não analisa coordinated omission [26]. Consequência para o PoC: medir também o gerador
  (o Node, no caso), e relatar máximo e p99,9, não só p95.
- **Equivalente para logs.** TSBS cobre séries de métricas (DevOps, IoT), não logs; inclui ClickHouse e TimescaleDB
  (o carregador "funciona com PostgreSQL comum" segundo a página), **não inclui OpenSearch**, e não mede escrita e leitura
  concorrentes [27]. Para OpenSearch existe o OpenSearch Benchmark com a carga `http_logs` (logs do Mundial de
  1998: `@timestamp`, `clientip`, `request`, `status`, `size`; ~31 GB; opção `unparsed` com a linha crua em
  `message`; parâmetros `bulk_size`, `search_clients`, `target_throughput`, `conflicts`), mas o corpus hospedado foi removido
  para revisão de licença e o dado original é de uso não comercial [28]. Conclusão: não há suíte pronta que compare os três
  com ingestão confirmada + busca; o PoC terá de reutilizar o protocolo (ClickBench/Raasveldt) com carga própria
  (item 7). Suíte de logs equivalente para ClickHouse e PostgreSQL: **[confirmar]**.

### 3.2 Coordinated omission e carga em taxa aberta

- **wrk2:** mede a latência "a partir do momento em que a transmissão deveria ter ocorrido"; `-R` fixa a vazão total
  (padrão 1000 req/s); histogramas HdrHistogram sem perda; calibração de 10 s; "execuções de menos de 10 a 20 s podem
  não trazer informação útil" [29]. Último push no repositório: 2024-03-03 (API do GitHub) [29].
- **HdrHistogram:** precisão em dígitos significativos (3 dígitos ≈ 0,1%); `recordValueWithExpectedInterval()`
  corrige a omissão sintetizando valores; portas para JavaScript, Rust, Go e outras [30]. Qual porta Node usar:
  **[confirmar]**.
- **k6:** `constant-arrival-rate` é executor de modelo aberto: "iterações começam independentemente da resposta do
  sistema", pré-aloca VUs (`preAllocatedVUs`); VU insuficiente reduz a taxa efetiva. A documentação de modelos abertos
  e fechados chama o fenômeno de "coordinated omission" [31][32]. A página do executor não menciona `dropped_iterations`
  nem coordinated omission [31].
- **autocannon:** `-R/--overallRate` e `-r/--connectionRate`; com taxa fixada, "a latência é corrigida para
  compensar coordinated omission"; `-C` desliga a correção e o README desaconselha; `-l` lista todos os percentis [33].
  É a opção natural para quem tem o servidor em Node.
- **Repetições e frio/quente.** ClickBench: 3 execuções, 1ª fria [24]; Raasveldt: "várias execuções", desvio
  padrão, mediana com IC [25]; não há número mínimo fixado pelo artigo (**[confirmar]** se existe norma). O PoC
  deve fixar um número (ex.: 5 rodadas independentes, ver proposta no ticket) e justificar.
- **`drop_caches`** (documentação do kernel): `echo 1` libera o cache de páginas, `2` dentries e inodes, `3` ambos; é
  não destrutivo e **não libera objetos sujos**; rodar `sync` antes; "uso fora de teste ou depuração não é
  recomendado" [34]. Só cobre o cache do SO; os caches próprios do banco (buffer pool do PostgreSQL, caches de marcas
  do ClickHouse, cache de filesystem do OpenSearch) exigem reinício, como no "frio de verdade" do ClickBench [24].

## 4. Configuração oficial por candidato

### 4.1 ClickHouse

- **Durabilidade antes de confirmar.** `fsync_after_insert` (padrão **false**): "faz fsync de cada parte inserida,
  de modo que o dado seja durável quando o `INSERT` é confirmado; diminui o desempenho"; `fsync_part_directory`
  (padrão false) faz fsync do diretório da parte; `group_fsync_before_insert_finish` (`auto`: ligado para não
  replicadas) agrupa os fsyncs das partes antes de terminar o `INSERT` [35]. Merge: `min_rows_to_fsync_after_merge`
  padrão 0 = desligado [35]. Código-fonte do mestre, pode estar mais novo que a versão fixada no PoC
  (**[confirmar]** a versão exata).
- **Async insert.** `wait_for_async_insert=1` é o padrão; "só confirma depois que o dado é descarregado em disco" e o
  texto recomenda `async_insert=1,wait_for_async_insert=1`; com 0 "não há garantia de persistência" e não há fila de
  mensagens mortas [36]. Disparo do descarregamento: `async_insert_max_data_size` 100 MiB, `async_insert_busy_timeout_ms`
  200 ms (adaptativo desde a 24.2, mín. 50 ms), `async_insert_max_query_number` 450 [36]. O texto não diz que o flush assíncrono
  inclua fsync: combinar com `fsync_after_insert` e conferir, **[confirmar]**.
- **Dedupe de reenvio.** `*MergeTree` atribui a cada bloco um `block_id` = hash dos dados; bloco já no log é descartado e a
  repetição responde sucesso; `insert_deduplication_token` tem prioridade sobre o hash [37]. MergeTree não replicado
  tem `non_replicated_deduplication_window` padrão **0** (nada deduplica), conta os últimos N blocos, grava os hashes
  num arquivo local [35][37]. **A janela é em contagem de blocos, não em tempo:** 15 min equivalem ao número de
  blocos inseridos nesse período; se entrarem mais blocos que a janela durante as repetições, duplicatas passam [37]. Desde
  a 26.2, `deduplicate_insert` controla síncrono e assíncrono com um log só; `async_insert_deduplicate` é legado [37].
  A janela por segundos (`replicated_deduplication_window_seconds`, 1 h) é para tabelas replicadas, com hashes no Keeper
  [35]. Persistência do log de hashes após reinício: **[confirmar]**.
- **Baixa memória.** Ver [D1] de banco-de-logs.md (mark cache até 500 MB, 1 thread por consulta, `max_block_size`
  8192, desligar `metric_log`, `text_log`, `trace_log`, `asynchronous_metric_log`). Os nomes e padrões de
  `max_server_memory_usage_to_ram_ratio` e `mark_cache_size` não foram obtidos nesta rodada: **[confirmar]**.
- **Remoção por idade.** `TTL ts + INTERVAL 30 DAY [DELETE]` aplicado em fusões de fundo, não na inserção; linhas
  expiradas podem aparecer em `SELECT` entre fusões; `merge_with_ttl_timeout` controla a frequência de fusões fora de
  agenda [38]. `ttl_only_drop_parts` (padrão false): quando true, descarta a parte inteira só se todas as linhas expiraram [35].
  Particionar por dia e `DROP PARTITION` não é descrito nesta página [38]: **[confirmar]** em outra.
- **Regex.** `match()` usa RE2 [39]; `.` casa quebra de linha (desligar com `(?-s)`); não ancorado; UTF-8; sem bytes NUL;
  para substring, `like` ou `position` são "muito mais rápidos". `multiMatchAny` aceita vários padrões e `multiFuzzyMatch*`
  usa Hyperscan "experimental" [39]. A página não discute ReDoS [39].

### 4.2 OpenSearch

- **Durabilidade.** `index.translog.durability`: `request` (padrão) faz fsync e commit do translog no primário e em toda
  réplica alocada **antes** de confirmar index/delete/update/bulk; `async` confirma antes e faz fsync a cada
  `index.translog.sync_interval` (padrão 5 s, mínimo 100 ms), e "descarta escritas confirmadas" desde o último commit se
  o nó cair [40]. `index.refresh_interval` padrão 1 s afeta a visibilidade na busca, não a durabilidade [40]. Nó único
  sem réplica: a durabilidade depende só do disco local.
- **Dedupe.** `PUT {index}/_create/{id}` só cria se o ID não existe, senão a operação falha (409 de conflito de
  versão em outros caminhos) [42]. Sem janela de 15 min: o ID vale enquanto o documento existir naquele índice; com
  índices por tempo (ISM/rollover) o mesmo ID pode reaparecer em outro índice. Bulk com `create` por item: **[confirmar]**.
- **Baixa memória.** Ver [D2], [D3] de banco-de-logs.md (heap padrão 1 GB; recomendação de metade da RAM;
  `vm.max_map_count` ≥ 262144). Viabilidade em 2 GB: sem fonte oficial **[confirmar]**.
- **Remoção por idade.** ISM: política com estados e transições; `min_index_age` (ex.: `"30d"`) leva o índice a um estado
  `delete`; o relógio só é consultado quando o job roda, a cada 5 min por padrão
  (`plugins.index_state_management.job_interval`) [43]. Granularidade é por índice, não por documento.
- **Regex.** Sintaxe do Lucene, "difere de implementações padronizadas"; `max_determinized_states` padrão 10.000 "para evitar
  consumo alto de recursos"; consulta `regexp` é cara e exige `search.allow_expensive_queries=true`, senão não
  executa; evitar curingas sem prefixo/sufixo como `.*` [41]. É autômato, não retrocesso, mas **não é RE2**: a
  compatibilidade de sintaxe com RE2 precisa ser testada **[confirmar]**.

### 4.3 PostgreSQL

- **Durabilidade.** `fsync = on` garante recuperação consistente após queda de SO ou hardware; `synchronous_commit`
  padrão `on`; com nó único e sem `synchronous_standby_names`, `on`, `remote_write`, `remote_apply` e `local` valem o mesmo
  flush local; `off` pode perder até 3 × `wal_writer_delay` (padrão 200 ms) de transações já confirmadas, sem
  corrupção [44]. `wal_sync_method` padrão `fdatasync` no Linux; `full_page_writes` padrão `on` (desligar
  "pode levar a corrupção silenciosa") [44]. Com `synchronous_commit=on`, o commit só retorna depois do flush do WAL; para lote,
  um commit por lote (custo de fsync amortizado) é decisão de desenho, não configuração.
- **Dedupe.** `INSERT ... ON CONFLICT DO NOTHING` descarta a linha que viole índice único ou restrição; sem
  `conflict_target` vale para todos os índices únicos usáveis [46]. Em tabela particionada, a restrição única "deve
  incluir todas as colunas da chave de partição", pois cada índice só garante unicidade na própria partição [47]. Logo,
  dedupe por código de evento global exige a data na chave; 15 min não é janela do banco: ela vem do
  conteúdo da chave (código + dia) e da retenção. Limpeza de chaves antigas: **[confirmar]** desenho.
- **Baixa memória.** Ver [D4] de banco-de-logs.md (`shared_buffers` 128 MB padrão, 25% da RAM em servidor dedicado
  com ≥ 1 GB). Parâmetros extras (`work_mem`, `max_connections`, `maintenance_work_mem`) não obtidos: **[confirmar]**.
- **Remoção por idade.** Não há TTL nativo. A documentação manda particionar e usar `DROP TABLE` ou
  `DETACH PARTITION` na partição, "muito mais rápido que operação em massa" e sem o custo de `VACUUM` do `DELETE`
  em massa; o `DROP` exige `ACCESS EXCLUSIVE` na tabela pai (o `DETACH ... CONCURRENTLY` existe) [47]. Agendador
  (cron, pg_cron) para criar e descartar partições: **[confirmar]** (extensão, não é núcleo).
- **Regex.** Operador `~` com a biblioteca de Henry Spencer; aceita retrovisores e lookahead/lookbehind (portanto não
  é RE2); o manual avisa: "podem ser criadas regex que levam tempo e memória arbitrários; desconfie de padrões de
  fontes hostis; imponha `statement_timeout`" e que o tamanho da regex não é limitado [45]. Para tempo
  previsível o contrato precisa de `statement_timeout` (ou a regex vir de um conjunto controlado). A página não
  diz se a implementação é por retrocesso, DFA ou híbrida [45].

### 4.4 Quadro para a prova

| Contrato | ClickHouse | OpenSearch | PostgreSQL |
|---|---|---|---|
| Confirmar só após disco | `fsync_after_insert=1` (padrão desligado) [35]; `wait_for_async_insert=1` [36] | `translog.durability=request` (padrão) [40] | `fsync=on`, `synchronous_commit=on` (padrão) [44] |
| Dedupe 15 min | janela em **blocos**, padrão 0 [35][37] | `_create` por ID, sem janela de tempo [42] | `ON CONFLICT`, chave com partição [46][47] |
| Retenção 30 dias | TTL em fusão [38] | ISM por índice, job 5 min [43] | `DROP`/`DETACH` de partição [47] |
| Regex | RE2 [39] | Lucene, limite de estados [41] | Spencer, usar `statement_timeout` [45] |

## 5. Cifragem em disco

- **O que a AWS faz:** discos anexados e snapshots do Lightsail são criptografados em repouso por padrão, com chaves
  gerenciadas pela Lightsail [6]. A exigência "cifrado na máquina" do contrato precisa decidir se isso basta ou se
  LUKS dentro da instância é requisito. A página consultada não diz nada sobre o disco de sistema do plano: **[confirmar]**.
- **LUKS/dm-crypt.** `cryptsetup benchmark` mede cifras e KDF, "usa só memória e é só informativo"; "você não pode
  prever diretamente a velocidade real de criptografia de armazenamento a partir dele" [49]. O padrão de formato é
  LUKS2 [48]. A FAQ lembra que o modo XTS usa duas chaves (os tamanhos listados são o dobro) e que o benchmark existe
  desde a versão 1.60 [50]. A FAQ também diz que dm-crypt/LUKS "não piora" as garantias transacionais, mas que flushes forçados
  bloqueiam pelo tempo de criptografia [50]. Que o dm-crypt repasse flush/FUA ao disco subjacente: a documentação do kernel
  do dm-crypt não menciona flush/FUA [51]; **[confirmar]**, e testar no próprio PoC com `dm-log-writes` por baixo do LUKS.
- **Custo medido por quem escreveu o patch (Cloudflare):** `cryptsetup benchmark` deu ≈ 1823 MiB/s (cifrar) e 1900 MiB/s
  (decifrar) com aes-xts de 256 bits, mas o disco em RAM só rendeu ≈ 294 MB/s com dm-crypt padrão; o dm-crypt enfileira escrita
  até 4 vezes e leitura até 3; contornar as filas mais que dobrou a vazão (≈ 640 MB/s) e cortou o `await` pela metade; as opções
  entraram no mainline no 5.9 [52]. O kernel documenta `no_read_workqueue`, `no_write_workqueue`, `same_cpu_crypt` e
  `submit_from_crypt_cpus` [51]. Mede-se, portanto: fio no volume LUKS real (IOPS, vazão, latência p99 de fsync) contra
  o mesmo volume sem LUKS, com e sem `no_*_workqueue`, e o consumo de CPU, que numa máquina com baseline de 20% é
  parte do orçamento [1].
- **AES-NI no Lightsail: sem fonte primária.** A AWS publica o baseline por plano e a "geração" de hardware
  (bundles `_1_x`/`_2_x` são geração anterior; o plano de nova geração mantém memória e preço, vCPUs iguais ou mais) [1][58b],
  mas não publica modelo de CPU nem flags [1][58b]. **[confirmar]**: `grep -m1 -o aes /proc/cpuinfo` e `lscpu` na
  máquina real, e listar `cryptsetup benchmark` de `aes-xts`. Uma instância criada antes de 29/06/2023 tem 1 vCPU no
  plano de US$ 12 [1][15]: confirmar que a máquina da PoC é de geração nova (2 vCPU).

## 6. Custo dentro de um processo Node

- **`monitorEventLoopDelay([{ resolution }])`** (desde v11.10.0): histograma `IntervalHistogram` com atraso do laço de
  eventos "reportado em nanossegundos"; `resolution` em ms, padrão 10; `enable()`/`disable()`; `min`, `max`, `mean`,
  `stddev`, `percentile(p)`, `percentiles` [53]. A mesma página documenta `performance.eventLoopUtilization()`,
  que "mede só o laço, não o uso de CPU" e vem em milissegundos, enquanto o histograma vem em nanossegundos [53]. O
  atraso é medido por temporizador, então é um indicador de bloqueio do laço, não de CPU total.
- **autocannon:** rodar em máquina separada do alvo (o consumo de CPU do gerador compete com o do servidor num plano de
  20% de baseline); `-c` conexões (padrão 10), `-p` pipelining (padrão 1), `-R` taxa total, correção de coordinated
  omission automática com `-R`, percentis completos com `-l` [33]. O README do autocannon fala em Node 22.15+ só para
  rodar os testes do projeto [33]; a versão mínima para usar: **[confirmar]**.
- **pino:** a documentação de benchmarks do projeto lista tempos médios (basic: Pino 114,8 ms contra Winston 270,2 ms e Bunyan 377,4 ms;
  PinoMinLength 71,0 ms), mas **não declara hardware, versões, número de iterações, destino da saída nem variância** [57].
  Conclusão: usável como indício de ordem de grandeza, não como número para a máquina-alvo; medir o custo do logger na própria máquina.
- **zlib/gzip (Node 20):** todas as APIs assíncronas usam o pool de threads interno (`UV_THREADPOOL_SIZE`, tamanho padrão 4 da libuv:
  **[confirmar]** na documentação da libuv), e criar muitos objetos zlib "pode causar fragmentação significativa de
  memória"; recomenda-se cachear o resultado [54]. O nível domina a velocidade: nível maior = melhor compressão e mais
  lento [54]. Memória do deflate = `(1 << (windowBits + 2)) + (1 << (memLevel + 9))` bytes, 256 KB com os padrões
  (windowBits 15, memLevel 8); `windowBits: 14, memLevel: 7` cai para 128 KB, com pior compressão; inflate = `1 << windowBits`,
  32 KB, mais um buffer de saída de 16 KB (`chunkSize`) [54]. Em 2 GB, o produto "conexões × 256 KB" entra na conta de memória.
- **Node 20:** V8 11.3, `node:test` estável, modelo de permissões experimental, melhorias de desempenho em `URL` (Ada 2.0),
  `fetch` e `EventTarget`, sem números publicados [56]. **Node 20 saiu de suporte em 2026-04-30**; v22 (manutenção LTS desde
  2025-10-21, fim 2027-04-30) e v24 (LTS desde 2025-10-28, fim 2028-04-30) são as linhas suportadas hoje [55].
  A PoC deve fixar a versão do Node e registrar que Node 20 está sem correção de segurança. O documento anterior
  fala em cliente Rust; se o serviço for Node, a decisão de linguagem muda a fonte do cliente [banco-de-logs].

## 7. Dados sintéticos realistas para logs

- **O problema:** a taxa de compressão de log real vem da repetição: o CLP atribui o ganho a "uma quantidade significativa de repetição
  em logs de texto" [60]. Dado sintético com campo aleatório (UUID novo por linha, texto aleatório) infla a entropia e mede o pior caso de
  compressão; dado sintético com poucos valores faz o oposto e mede o melhor caso. O resumo do CLP não dá taxas nem fala em zstd
  [60]; os números do artigo completo: **[confirmar]**.
- **Referência real de formato e repetição.** Loghub: 19 conjuntos de logs reais (HDFS 11,2 milhões de linhas, 1,47 GiB; Spark 33,2 milhões, 2,75 GiB;
  Thunderbird 211 milhões, 29,6 GiB; OpenSSH 655 mil, 70 MiB; Apache 56 mil, 4,9 MiB), "sempre que possível não
  sanitizados" (por isso podem ter dados pessoais) e livres "para pesquisa ou trabalho acadêmico" [58][59]. A licença não está no texto da
  página; uso comercial: **[confirmar]**. Serve para **calibrar**: medir a razão de compressão (zstd/lz4, tamanho em disco no banco) do log real
  e comparar com a do sintético, ajustando até ficar na mesma ordem.
- **Receita com fonte:** (a) escolher poucos modelos de mensagem com variáveis, como as linhas do Loghub, e sortear modelo e variáveis;
  (b) variáveis com cardinalidade declarada por campo (alta: código do evento, IDs; baixa: nível, produto, status), documentada na
  prova; (c) distribuição de popularidade em Zipf para campos como produto e rota, não uniforme: o YCSB usa Zipfian com o
  algoritmo de Gray et al. e espalha os itens populares pelo espaço de chaves em vez de agrupá-los no início [61];
  (d) timestamps em ritmo realista (rajadas), e não equidistantes; (e) comprimento de mensagem variável; (f) uma fração de linhas
  de erro com *stack trace* repetido. Fonte primária para entropia por campo ou tamanho médio de linha de log de produto:
  **[confirmar]**.
- **Reenvio e dedupe:** gerar o código do evento por determinismo (semente fixa) para poder reproduzir reenvios idênticos; o ClickHouse
  deduplica por hash do bloco inteiro, então "mesmo código" em lote diferente não deduplica sem `insert_deduplication_token` [37].
- **Dados pessoais:** não usar dado real de produção nem do usuário; gerar telefones e nomes sintéticos de formato válido.
  Loghub não é sanitizado [58].
- **Repetibilidade:** versionar semente, gerador e esquema; publicar hardware, versões e parâmetros, como pede o checklist [25].
- Gerador de logs completo oficial (como o `rally-tracks` para OpenSearch): `http_logs` com expansão do corpus
  (`expand-data-corpus.py`, 100 GB ou mais) existe, mas depende de dado com licença não comercial [28].

## O que ficou [confirmar]

1. IOPS e vazão (base, pico, modelo de crédito) do disco de sistema e do disco anexado do Lightsail; teto de CPU após esgotar o saldo; CPU/AES-NI.
2. Se `--force` na CLI funciona numa máquina saudável e se ele equivale a corte de energia; honra de `FLUSH` pelo disco virtual.
3. `loop` sobre arquivo repassa flush/FUA; dm-crypt repassa flush/FUA; licença do LazyFS.
4. ClickHouse: versão e padrões de `fsync_after_insert` na versão fixada; fsync no flush do async insert; persistência do log
   de dedupe; `max_server_memory_usage_to_ram_ratio`, `mark_cache_size`; `DROP PARTITION` por dia.
5. OpenSearch: viabilidade em 2 GB; dedupe em `bulk` com `create`; compatibilidade de sintaxe da regex com RE2.
6. PostgreSQL: parâmetros extras de baixa memória; agendamento de partições; dedupe com particionamento.
7. Preço de saída de dados do S3 e do bucket Lightsail (a página dá US$ 0,15/GB no excedente de São Paulo; Price List não cruzada).
8. Número mínimo de repetições normativo; porta de HdrHistogram para Node; versão mínima do autocannon; `UV_THREADPOOL_SIZE` padrão.
9. Taxas de compressão do CLP; entropia por campo e tamanho médio de linha de log de produto; licença do Loghub para uso comercial.

## Fontes

Todas consultadas em 2026-11-18. Onde o texto resume uma página, o resumo é nosso.

- [1] https://docs.aws.amazon.com/lightsail/latest/userguide/baseline-cpu-performance.html (baseline por plano; geração anterior)
- [2] https://docs.aws.amazon.com/lightsail/latest/userguide/cpu-burst-capacity-accrual.html
- [3] https://docs.aws.amazon.com/lightsail/latest/userguide/monitoring-cpu-burst-capacity.html e https://docs.aws.amazon.com/lightsail/latest/userguide/identifying-instance-burst.html
- [4] https://docs.aws.amazon.com/lightsail/2016-11-28/api-reference/API_GetInstanceMetricData.html
- [5] https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-viewing-instance-disk-performance-metrics.html
- [6] https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-block-storage.html
- [7] https://aws.amazon.com/lightsail/faq/
- [8] https://docs.aws.amazon.com/cli/latest/reference/lightsail/stop-instance.html
- [9] https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-force-stop-instance.html
- [10] https://docs.aws.amazon.com/lightsail/latest/userguide/create-block-storage-disk-snapshot.html
- [11] https://docs.aws.amazon.com/lightsail/2016-11-28/api-reference/API_CreateDiskSnapshot.html
- [12] https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-snapshots-in-amazon-lightsail.html e https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-configuring-automatic-snapshots.html
- [13] AWS Price List, oferta AmazonLightsail, publicação 2026-11-13: https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonLightsail/current/index.json (filtro sa-east-1)
- [14] AWS Price List, oferta AmazonS3, sa-east-1, publicação 2026-11-18: https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/sa-east-1/index.json
- [15] https://aws.amazon.com/lightsail/pricing/
- [16] https://docs.aws.amazon.com/lightsail/latest/userguide/elastic-block-storage-and-ssd-disks-in-amazon-lightsail.html
- [17] https://docs.kernel.org/admin-guide/sysrq.html
- [18] https://docs.kernel.org/admin-guide/device-mapper/dm-flakey.html
- [19] https://docs.kernel.org/admin-guide/device-mapper/log-writes.html
- [20] https://github.com/dsrhaslab/lazyfs (artigo: Ramos et al., "When Amnesia Strikes", PVLDB 17(11), 2024)
- [21] https://man7.org/linux/man-pages/man2/fsync.2.html
- [22] https://docs.kernel.org/block/writeback_cache_control.html
- [23] https://www.postgresql.org/docs/current/wal-reliability.html
- [24] https://github.com/ClickHouse/ClickBench
- [25] Raasveldt, Holanda, Gubner, Mühleisen, "Fair Benchmarking Considered Difficult: Common Pitfalls In Database Performance Testing", DBTest 2018, DOI 10.1145/3209950.3209955: https://ir.cwi.nl/pub/27862/27862.pdf (texto lido por extração do PDF)
- [26] "Tell-Tale Tail Latencies: Pitfalls and Perils in Database Benchmarking", https://arxiv.org/abs/2107.11607
- [27] https://github.com/timescale/tsbs
- [28] https://github.com/opensearch-project/opensearch-benchmark-workloads/tree/main/http_logs
- [29] https://github.com/giltene/wrk2
- [30] https://github.com/HdrHistogram/HdrHistogram
- [31] https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/
- [32] https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/
- [33] https://github.com/mcollina/autocannon
- [34] https://docs.kernel.org/admin-guide/sysctl/vm.html
- [35] Código-fonte das configurações MergeTree: https://github.com/ClickHouse/ClickHouse/blob/master/src/Storages/MergeTree/MergeTreeSettings.cpp
- [36] https://clickhouse.com/docs/optimize/asynchronous-inserts
- [37] https://clickhouse.com/docs/guides/developer/deduplicating-inserts-on-retries
- [38] https://clickhouse.com/docs/engines/table-engines/mergetree-family/mergetree
- [39] https://clickhouse.com/docs/sql-reference/functions/string-search-functions
- [40] https://docs.opensearch.org/latest/install-and-configure/configuring-opensearch/index-settings/ (fonte do texto: https://github.com/opensearch-project/documentation-website/blob/main/_install-and-configure/configuring-opensearch/index-settings.md)
- [41] https://docs.opensearch.org/latest/query-dsl/term/regexp/ (fonte do texto: .../documentation-website/blob/main/_query-dsl/term/regexp.md)
- [42] https://docs.opensearch.org/latest/api-reference/document-apis/index-document/ (fonte do texto: .../_api-reference/document-apis/index-document.md)
- [43] https://docs.opensearch.org/latest/im-plugin/ism/policies/ e https://docs.opensearch.org/latest/im-plugin/ism/settings/
- [44] https://www.postgresql.org/docs/current/runtime-config-wal.html
- [45] https://www.postgresql.org/docs/current/functions-matching.html
- [46] https://www.postgresql.org/docs/current/sql-insert.html
- [47] https://www.postgresql.org/docs/current/ddl-partitioning.html
- [48] https://man7.org/linux/man-pages/man8/cryptsetup.8.html
- [49] https://man7.org/linux/man-pages/man8/cryptsetup-benchmark.8.html
- [50] FAQ do cryptsetup (wiki oficial no GitLab): https://gitlab.com/cryptsetup/cryptsetup/-/wikis/FrequentlyAskedQuestions
- [51] https://docs.kernel.org/admin-guide/device-mapper/dm-crypt.html
- [52] https://blog.cloudflare.com/speeding-up-linux-disk-encryption/ (artigo do autor do patch; primeira parte; atualização de 11/10/2020)
- [53] https://nodejs.org/docs/latest-v20.x/api/perf_hooks.html
- [54] https://nodejs.org/docs/latest-v20.x/api/zlib.html
- [55] https://raw.githubusercontent.com/nodejs/Release/main/schedule.json
- [56] https://nodejs.org/en/blog/announcements/v20-release-announce
- [57] https://github.com/pinojs/pino/blob/main/docs/benchmarks.md
- [58] https://github.com/logpai/loghub
- [58b] https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-update-instance-newer-generation.html
- [59] Zhu et al., "Loghub: A Large Collection of System Log Datasets for AI-driven Log Analytics", https://arxiv.org/abs/2008.06448
- [60] Rodrigues et al., "CLP: Efficient and Scalable Search on Compressed Text Logs", OSDI 2021: https://www.usenix.org/conference/osdi21/presentation/rodrigues (resumo)
- [61] Cooper et al., "Benchmarking Cloud Serving Systems with YCSB", SoCC 2010 (cópia: https://courses.cs.duke.edu/fall13/cps296.4/838-CloudPapers/ycsb.pdf); a leitura do trecho de Zipfian veio de excerto de busca, não do PDF completo: **[confirmar]** no PDF.
