# Armazenamento do cadastro

Ticket: [Escolher onde fica o cadastro](https://github.com/stacklabs3/monitora-ai/issues/65).
Consulta: **2026-11-28**. Comparação, não escolha. Critério do humano: rápido de execução e baixo custo de
hospedagem. Cenário fixo (ADRs [0002](../adr/0002-opensearch-como-banco-de-logs.md),
[0003](../adr/0003-modulos-e-seams-do-servidor.md) e
[0008](../adr/0008-avaliacao-dos-alertas-no-modulo-de-alertas.md)): um servidor em Rust numa máquina de 2 GB,
OpenSearch com heap fixo de 700 MB na mesma máquina, banco e servidor juntos até 1,5 GB, backup diário com 7
cópias e restauração em até 4 h.

Como ler: cada afirmação leva a fonte entre colchetes (lista no fim). **[confirmar]** marca o que não foi
verificado em fonte primária; **sem medida** marca o que nenhuma fonte primária mede. Nada aqui foi medido
no projeto. Versões, datas, licenças, MSRV e downloads vêm da API do crates.io; dono, estrelas e último push
vêm da API do GitHub, ambas lidas em 2026-11-28.

## 1. Os três caminhos

| | SQLite embutido | PostgreSQL (segundo processo) | Chave-valor embutido em Rust |
|---|---|---|---|
| Versão atual | 3.54.1 (2026-10-16); correções 3.53.6, 3.50.8 e 3.44.7 em 2026-11-13 [S1][S2] | 19.0 (2026-11-19, suporte até 11/2031); 18.7 (suporte até 11/2030); 14 saiu de suporte em 12/11/2026 [P1] | `redb` 5.0.0 (2026-11-18); `fjall` 3.1.13 (2026-10-25); `sled` 0.34.7 (2021-09-12) [K1][K2][K3] |
| Licença | domínio público [S3] | PostgreSQL License, "similar à BSD ou MIT" [P2] | `redb`, `fjall`, `sled`: MIT OR Apache-2.0 [K1][K2][K3] |
| Quem mantém | equipe do SQLite, líder Richard Hipp; financiada pelo SQLite Consortium [S4][S5] | PostgreSQL Global Development Group [P1] | `redb`: conta pessoal `cberner`; `fjall`: org `fjall-rs`; `sled`: conta pessoal `spacejam` [K4][K5][K6] |
| Compromisso de suporte | "a intenção é dar suporte até 2050"; API em C e formato do arquivo compatíveis para trás [S6] | 5 anos por versão maior; versão menor ao menos a cada 3 meses [P1] | `redb`: "stable and maintained", formato de arquivo estável [K4]; `fjall`: nada escrito no README sobre formato [confirmar]; `sled`: "beta", formato em disco vai mudar antes do 1.0 [K6] |
| Onde roda | dentro do processo do servidor; biblioteca "em geral menor que 1 MB" [S7] | servidor à parte; um processo novo por conexão [P3] | dentro do processo do servidor |
| Memória documentada | cache de páginas padrão de 2.048.000 bytes por arquivo aberto (`cache_size = -2000`), ajustável [S8] | `shared_buffers` padrão 128 MB; `work_mem` 4 MB por operação; `maintenance_work_mem` 64 MB; `max_connections` 100 [P4][P5] | `fjall`: cache de blocos mais um memtable por keyspace; recomenda 20 a 25% da memória [K5]. `redb`: não levantado [confirmar] |
| Consulta | SQL | SQL | sem SQL: só chave, faixa de chaves e o que o código montar |
| Backup a quente | Online Backup API, `VACUUM INTO` ou `sqlite3_rsync` [S9][S10][S11] | `pg_dump`, cópia consistente sem bloquear o uso [P6] | não levantado [confirmar] |
| Operação extra | nenhum processo a mais; migração de esquema pelo próprio servidor | subir, monitorar e atualizar um segundo serviço; vacuum; upgrade de versão maior [P7][P8] | nenhum processo a mais; índices e migrações escritos à mão |

## 2. SQLite embutido

**Concorrência (modo WAL).** Leitores não bloqueiam o escritor e o escritor não bloqueia leitores; há um
escritor por vez. Todos os processos precisam estar na mesma máquina: WAL não funciona em sistema de arquivos
de rede [S12]. A página de usos diz: leitores simultâneos sem limite, um escritor por instante, e "os
escritores fazem fila [...] nenhum bloqueio dura mais que algumas dezenas de milissegundos" [S13].

**Durabilidade em queda (`synchronous`).** [S8]

| Ajuste em WAL | Queda só do servidor | Queda de energia ou do sistema |
|---|---|---|
| `FULL` | transação confirmada fica | fica: "ACID em modo WAL"; sincroniza o WAL a cada commit [S8][S12] |
| `NORMAL` | fica: "duráveis em quedas da aplicação com qualquer ajuste" | o arquivo não corrompe, mas a última transação confirmada "pode ser desfeita" |
| `OFF` | fica | o banco pode corromper |

`EXTRA` é igual a `FULL` em WAL. Com `NORMAL`, só o checkpoint chama `fsync` [S12].

**Gravação pequena e constante (1 a cada 30 s por execução).** O que a documentação diz: o checkpoint
automático roda quando o WAL chega a 1.000 páginas (página padrão de 4.096 bytes), na mesma thread do commit
que passou do limite, então a maioria dos commits é rápida e um ou outro demora mais. Um leitor que nunca
fecha a transação impede o checkpoint de terminar e o WAL "cresce sem limite" [S12][S14]. Conta, não medida:
50 execuções dão 1,7 gravação por segundo. Latência de commit nesse ritmo no disco do Lightsail: **sem
medida**.

**Memória.** Padrão de 2.048.000 bytes de cache por arquivo de banco aberto; `sqlite3_soft_heap_limit64`
põe um teto que o SQLite tenta respeitar [S8][S15]. "O SQLite em geral roda mais rápido quanto mais memória
recebe; o desempenho costuma ser bom mesmo com pouca" [S7]. RSS de um processo real: **sem medida**.

**Limites.** Arquivo de até 281 TB (17,5 TB com página de 4.096 bytes no limite padrão de páginas); linha de
até 1 GB [S14].

**Usos apropriados (página oficial).** Serve bem a "sites de tráfego baixo a médio": abaixo de 100 mil
acessos por dia "deve funcionar bem", número conservador. Lista "banco no lado do servidor" como uso
relatado: o cliente fala com a aplicação, e a aplicação fala com o SQLite na mesma máquina. Recomenda
cliente/servidor quando o dado fica separado da aplicação por uma rede, quando há muitos escritores
simultâneos ou quando o volume passa de um arquivo [S13].

**Backup a quente e restauração.**

- Três caminhos seguros com o banco em uso: Online Backup API, `VACUUM INTO arquivo` e `sqlite3_rsync` (desde
  a 3.47.0) [S11].
- Online Backup API: copia em passos, bloqueia a origem só enquanto lê, e o destino sai como cópia idêntica
  da origem no instante em que a cópia começou [S9].
- `VACUUM INTO`: gera um arquivo novo, mínimo e consistente; gasta mais CPU que a API; o arquivo de destino
  não pode existir; com `synchronous` em `NORMAL` ou `FULL`, sincroniza o destino ao terminar [S10].
- Copiar o arquivo com `cp` só é seguro sem transação em curso; se a última escrita falhou, o `-wal` vai
  junto [S11].
- Restaurar: o backup é um arquivo SQLite comum, que se põe no lugar do original. A documentação avisa para
  não trocar o arquivo com transação ativa e para não parear um banco com o `-wal` de outro [S11]. Passo a
  passo oficial de restauração: não achei página própria **[confirmar]**. Tempo de restauração: **sem
  medida**.

**Auditoria sem edição.** Um trigger `BEFORE UPDATE` ou `BEFORE DELETE` que chama `RAISE(ABORT, 'mensagem')`
encerra o comando com `SQLITE_CONSTRAINT` e a mensagem dada. O trigger aceita cláusula `WHEN`, o que permite
barrar o `DELETE` só de linhas mais novas que 6 meses [S16]. Limites do mecanismo: quem abre o arquivo pode
dar `DROP TRIGGER`, e a documentação pede preferir `AFTER` a `BEFORE` quando o trigger altera a linha (não é
o caso de um trigger que só recusa) [S16]. A proteção vale contra o código do servidor, não contra quem tem o
arquivo.

## 3. PostgreSQL como segundo processo

- **Versão:** 19.0 saiu em 2026-11-19, nove dias antes desta consulta; a 18.7 tem suporte até 14/11/2030
  [P1]. A [pesquisa do banco de logs](https://github.com/stacklabs3/monitora-ai/blob/research/banco-de-logs/docs/research/banco-de-logs.md)
  registrava a 18.7 como atual.
- **Memória pelos padrões:** `shared_buffers` 128 MB (mínimo aceito de 128 kB; "abaixo de 1 GB de RAM, uma
  fração menor é apropriada"); `work_mem` 4 MB por operação de ordenação ou hash, por consulta;
  `maintenance_work_mem` 64 MB, multiplicado pelos workers do autovacuum quando ele roda;
  `max_connections` 100 [P4][P5].
- **Processos:** modelo de "um processo por usuário": o supervisor cria um processo novo a cada conexão
  [P3]. O pool do servidor define quantos processos ficam vivos.
- **Operação extra:** vacuum periódico (o autovacuum cobre "muitas instalações"; gera E/S) [P7]; versão
  menor não pede dump, só reinício com os binários novos; versão maior muda o formato interno e pede
  `pg_dump`/restauração ou `pg_upgrade` [P1][P8]; backup com `pg_dump`, que tira uma cópia consistente sem
  bloquear leituras e escritas, restaurada com `psql` ou `pg_restore` [P6].
- **Biblioteca Rust:** `sqlx` 0.9.1 ou `tokio-postgres` 0.7.18, já levantados na
  [pesquisa de bibliotecas Rust](https://github.com/stacklabs3/monitora-ai/blob/research/bibliotecas-rust/docs/research/bibliotecas-rust.md)
  (a versão do `sqlx` subiu de 0.9.0 para 0.9.1 em 2026-11-18 [B2]).
- **Contra o teto de 1,5 GB:** RSS de um PostgreSQL ocioso com os padrões: **sem medida** (ver seção 6).

## 4. Chave-valor embutido em Rust

| Crate | Versão (data) | Licença | Mantém | MSRV | Downloads 90d | Estado declarado |
|---|---|---|---|---|---|---|
| `redb` | 5.0.0 (2026-11-18) | MIT OR Apache-2.0 | conta pessoal `cberner`; 5,0 mil estrelas | 1.90 | 7,4 M | "Stable and maintained"; formato de arquivo estável; ACID; MVCC com leitores e um escritor sem bloqueio; savepoints; árvores B+ copy-on-write [K1][K4] |
| `fjall` | 3.1.13 (2026-10-25) | MIT OR Apache-2.0 | org `fjall-rs`; 2,5 mil estrelas | 1.90.0 | 0,9 M | LSM "parecido com RocksDB"; keyspaces; transações serializáveis opcionais; 3.x [K2][K5] |
| `sled` | 0.34.7 (2021-09-12); 1.0.0-alpha.124 (2024-10-11) | MIT OR Apache-2.0 | conta pessoal `spacejam`; último push 2026-04-04 | – | 3,6 M | README: "se confiabilidade é a restrição principal, use SQLite. sled é beta"; formato em disco vai mudar com migração manual antes do 1.0; reescrita em andamento [K3][K6] |

O que se perde sem SQL, pelo que as três APIs oferecem (mapa ordenado de chave para valor) [K4][K5][K6]:

- **Listar a auditoria por período, pessoa ou produto:** cada filtro vira uma tabela de índice própria
  (chave composta) que o código mantém a cada inserção, ou uma varredura de tudo.
- **Apagar o que passou de 6 meses:** varredura por faixa de chave ordenada por data, escrita à mão.
- **Auditoria sem edição:** não há trigger nem restrição no banco; a regra fica só no código.
- **Esquema e migração:** o formato do valor (serialização) e a mudança dele são do código.
- Backup a quente em `redb` e `fjall`: não levantado **[confirmar]**.

## 5. Bibliotecas Rust para SQLite

| Crate | Versão (data) | Licença | Mantém | MSRV | Downloads 90d | Async? | SQLite compilado junto? |
|---|---|---|---|---|---|---|---|
| `rusqlite` | 0.43.0 (2026-11-15) | MIT | org `rusqlite`; 4,5 mil estrelas | 1.89.0 | 69,9 M | bloqueante | feature `bundled`: compila o SQLite 3.54.1 com o crate `cc` e liga estático [B1][B3] |
| `libsqlite3-sys` | 0.40.0 (2026-11-11) | MIT | org `rusqlite` (mesmo repo) | 1.88.0 | 124,1 M | – | é quem traz o `sqlite3.c`; base do `rusqlite` e do `sqlx-sqlite` [B1][B2] |
| `sqlx` (feature `sqlite`) | 0.9.1 (2026-11-18) | MIT OR Apache-2.0 | org `transact-rs` (o crates.io ainda aponta `launchbadge/sqlx`, que redireciona); 17,8 mil estrelas | 1.94.0 | 63,3 M | async; uma thread dedicada por conexão SQLite | `sqlite` liga o `bundled` do `libsqlite3-sys`; `sqlite-unbundled` usa o do sistema [B2][B4][B5] |
| `tokio-rusqlite` | 0.10.0 (2026-11-20) | MIT | conta pessoal `programatik29`; 134 estrelas | – | 1,1 M | async; uma thread por conexão, chamadas por canal (`conn.call(...)`) | repassa `bundled` e `backup` do `rusqlite` ^0.43 [B6] |
| `deadpool-sqlite` | 0.14.0 (2026-08-26) | MIT OR Apache-2.0 | org `deadpool-rs`; 1,3 mil estrelas (repo do deadpool inteiro) | 1.95 | 0,19 M | pool async; `interact(...)` roda em `spawn_blocking` | repassa `bundled`; preso ao `rusqlite` ^0.40 [B7] |
| `r2d2_sqlite` | 0.37.2 (2026-11-22) | MIT | conta pessoal `ivanceras`; 136 estrelas | – | 2,3 M | pool bloqueante (`r2d2`) | repassa `bundled`; `rusqlite` ^0.42 [B8] |
| `async-sqlite` | 0.7.0 (2026-11-01) | MIT | conta pessoal `ryanfowler`; 23 estrelas | 1.95.0 | 0,09 M | async sobre `rusqlite` ^0.41 | `bundled` ligado por padrão [B9] |
| `libsql` | 0.10.0 (2026-10-13) | MIT | Turso (org `tursodatabase`) | – | 0,85 M | async | fork do SQLite; o README diz que recursos novos vão para o Turso e que, para projeto novo, "provavelmente você quer o Turso" [B10] |
| `turso` | 0.8.4 (2026-11-20); 0.9.0-pre.6 em pré-lançamento | MIT | Turso (org `tursodatabase`); 25,4 mil estrelas | – | 1,0 M | async | não usa o SQLite: reescrita em Rust compatível; "ainda não chegamos ao 1.0 [...] mantenha backups independentes" [B11] |

Migrações de esquema:

| Crate | Versão (data) | Licença | Mantém | MSRV | Downloads 90d | Como guarda o estado |
|---|---|---|---|---|---|---|
| `rusqlite_migration` | 2.9.0 (2026-11-23) | Apache-2.0 | conta pessoal `cljoly`; 119 estrelas | 1.89 | 1,4 M | no `user_version` do arquivo, sem tabela; migrações como strings SQL no código; depende de `rusqlite` ^0.43 [B12] |
| `refinery` | 0.10.0 (2026-10-02) | MIT | org `rust-db`; 1,7 mil estrelas | 1.92 | 4,0 M | tabela `refinery_schema_history`; `embed_migrations!`; aceita `rusqlite` de 0.23 a **0.40** [B13] |
| `sqlx::migrate!` | junto do `sqlx` 0.9.1 | MIT OR Apache-2.0 | org `transact-rs` | 1.94.0 | – | feature `migrate`; migrações embutidas em tempo de compilação [B4] |

Fatos que pesam na escolha:

- **Versões presas:** em 2026-11-28 só `tokio-rusqlite` e `rusqlite_migration` acompanham o `rusqlite` 0.43.
  `deadpool-sqlite` (^0.40), `async-sqlite` (^0.41), `r2d2_sqlite` (^0.42) e `refinery` (até 0.40) pedem
  versões anteriores [B6][B7][B8][B9][B12][B13]. O SQLite embutido passou a 3.54.1 no `rusqlite` 0.42.0;
  a versão embutida no 0.40: **[confirmar]** [B3].
- **Bloqueante com tokio:** o `rusqlite` é bloqueante. Os três jeitos vistos no código-fonte: thread dedicada
  por conexão com canal (`tokio-rusqlite`, `sqlx-sqlite`) ou `spawn_blocking` (`deadpool-sqlite`, via
  `deadpool-sync`) [B5][B6][B7]. Chamar `rusqlite` direto com `tokio::task::spawn_blocking`, sem crate
  intermediário: comportamento do tokio não relido nesta consulta **[confirmar]**.
- **Backup:** a feature `backup` do `rusqlite` expõe a Online Backup API [B1]. No `sqlx`, não vi API de
  backup nas features do `sqlx-sqlite` 0.9.1; `VACUUM INTO` é SQL e roda por qualquer um dos dois
  **[confirmar no sqlx]** [B2].
- **Sem dependência do sistema:** com `bundled`, o build precisa de um compilador C (crate `cc`), não de um
  SQLite instalado [B1]. O `sqlx` com a feature `sqlite` faz o mesmo [B4].
- **Tempo de compilação:** `libsqlite3-sys` 0.40.0 tem 2,76 MB compactado (o `sqlite3.c` inteiro) [B2].
  Tempo de build de `rusqlite` contra `sqlx`: **sem medida**.
- **MSRV:** `rusqlite` 1.89; `sqlx` 1.94; `deadpool-sqlite` e `async-sqlite` 1.95 [B1][B2][B7][B9].
- **Maturidade de API:** todos os crates de SQLite da tabela são 0.x; `rusqlite_migration` é 2.x. O
  `rusqlite` teve três versões entre 2026-10-28 e 2026-11-15 (0.41.1, 0.42.0 e 0.43.0), a 0.43.0 com três
  correções de uso de memória já liberada [B3].
- **Segurança de memória:** o `sqlx` é `#![forbid(unsafe_code)]`, exceto com a feature `sqlite`, que chama a
  API em C [B4].

## 6. Medida de memória: SQLite embutido contra PostgreSQL ocioso

**Sem medida.** Não achei fonte primária que meça, na mesma máquina, o RSS de um processo Rust com SQLite
embutido e o de um PostgreSQL ocioso com a configuração padrão. A busca foi curta (uma consulta), não
exaustiva.

O que existe de mais próximo, e não responde à pergunta:

- **AWS Database Blog** (não é o projeto PostgreSQL; mede RDS PostgreSQL 11.6 em `db.m5.large`, 8 GB): 100
  conexões ociosas gastaram cerca de 150 MB, 1,5 MB por conexão; depois de consultas e tabelas temporárias,
  de 10 a 14,5 MB por conexão. Mede o custo por conexão, não o piso do servidor, e na versão 11.6 [M1].
- **Configuração documentada, não medida:** os padrões do PostgreSQL reservam 128 MB de `shared_buffers`
  [P4]; o padrão do SQLite é 2.048.000 bytes de cache por arquivo aberto [S8]. São tetos de configuração, não o
  RSS observado.

## Lacunas

1. RSS real das duas opções na máquina do projeto: **sem medida**. O ADR 0003 já manda medir o segundo
   armazenamento em [Validar o banco na AWS](https://github.com/stacklabs3/monitora-ai/issues/60).
2. Latência de commit do SQLite com `synchronous=FULL` no disco do Lightsail, no ritmo de 1 gravação a cada
   30 s por execução: **sem medida**.
3. Tempo de backup e de restauração de cada opção: **sem medida** (o arquivo do cadastro é pequeno pelo
   volume descrito, mas o tamanho não foi estimado).
4. Tempo de compilação com `bundled` e diferença entre `rusqlite` e `sqlx`: **sem medida**.
5. Backup a quente e uso de memória de `redb` e `fjall`: **não verificado**.
6. Se `rusqlite` e `sqlx` podem conviver na mesma árvore de dependências (os dois ligam o
   `libsqlite3-sys`; o `sqlx-sqlite` 0.9.1 aceita `>=0.30.1, <0.41.0`): **não verificado** [B2].
7. Passo a passo oficial de restauração do SQLite e de troca do arquivo com o servidor parado: **não
   verificado**; só os avisos de [S11].
8. Criptografia do arquivo em repouso (SQLCipher aparece como feature do `rusqlite` [B1]): fora da pergunta,
   não levantado.

## Fontes

Consultadas em 2026-11-28.

SQLite:

- [S1] https://www.sqlite.org/index.html (versão 3.54.1, 2026-10-16)
- [S2] https://www.sqlite.org/chronology.html
- [S3] https://www.sqlite.org/copyright.html
- [S4] https://www.sqlite.org/crew.html
- [S5] https://www.sqlite.org/consortium.html
- [S6] https://www.sqlite.org/lts.html
- [S7] https://www.sqlite.org/footprint.html · https://www.sqlite.org/about.html
- [S8] https://www.sqlite.org/pragma.html (`synchronous`, `cache_size`, `busy_timeout`)
- [S9] https://www.sqlite.org/backup.html
- [S10] https://www.sqlite.org/lang_vacuum.html
- [S11] https://www.sqlite.org/howtocorrupt.html (seções 1.2 a 1.4)
- [S12] https://www.sqlite.org/wal.html
- [S13] https://www.sqlite.org/whentouse.html
- [S14] https://www.sqlite.org/limits.html
- [S15] https://www.sqlite.org/malloc.html
- [S16] https://www.sqlite.org/lang_createtrigger.html

PostgreSQL (a documentação "current" é a da versão 19):

- [P1] https://www.postgresql.org/support/versioning/
- [P2] https://www.postgresql.org/about/licence/
- [P3] https://www.postgresql.org/docs/current/connect-estab.html ·
  https://www.postgresql.org/docs/current/tutorial-arch.html
- [P4] https://www.postgresql.org/docs/current/runtime-config-resource.html
- [P5] https://www.postgresql.org/docs/current/runtime-config-connection.html
- [P6] https://www.postgresql.org/docs/current/backup-dump.html
- [P7] https://www.postgresql.org/docs/current/routine-vacuuming.html
- [P8] https://www.postgresql.org/docs/current/upgrading.html

Chave-valor:

- [K1] https://crates.io/api/v1/crates/redb
- [K2] https://crates.io/api/v1/crates/fjall
- [K3] https://crates.io/api/v1/crates/sled
- [K4] https://github.com/cberner/redb (README)
- [K5] https://github.com/fjall-rs/fjall (README)
- [K6] https://github.com/spacejam/sled (README)

Bibliotecas Rust:

- [B1] https://crates.io/api/v1/crates/rusqlite · https://github.com/rusqlite/rusqlite (README)
- [B2] https://crates.io/api/v1/crates/libsqlite3-sys · https://crates.io/api/v1/crates/sqlx ·
  https://crates.io/api/v1/crates/sqlx-sqlite · https://crates.io/api/v1/crates/sqlx-sqlite/0.9.1/dependencies
- [B3] https://github.com/rusqlite/rusqlite/releases ·
  https://github.com/rusqlite/rusqlite/blob/v0.43.0/libsqlite3-sys/sqlite3/sqlite3.h (`SQLITE_VERSION "3.54.1"`)
- [B4] https://github.com/transact-rs/sqlx (README)
- [B5] https://github.com/transact-rs/sqlx/blob/main/sqlx-sqlite/src/connection/worker.rs
- [B6] https://crates.io/api/v1/crates/tokio-rusqlite ·
  https://github.com/programatik29/tokio-rusqlite/blob/master/src/lib.rs
- [B7] https://crates.io/api/v1/crates/deadpool-sqlite ·
  https://github.com/deadpool-rs/deadpool/blob/main/crates/deadpool-sqlite/README.md ·
  https://github.com/deadpool-rs/deadpool/blob/main/crates/deadpool-sync/src/lib.rs
- [B8] https://crates.io/api/v1/crates/r2d2_sqlite · https://github.com/ivanceras/r2d2-sqlite
- [B9] https://crates.io/api/v1/crates/async-sqlite · https://github.com/ryanfowler/async-sqlite
- [B10] https://crates.io/api/v1/crates/libsql · https://github.com/tursodatabase/libsql (README)
- [B11] https://crates.io/api/v1/crates/turso · https://github.com/tursodatabase/turso (README)
- [B12] https://crates.io/api/v1/crates/rusqlite_migration · https://github.com/cljoly/rusqlite_migration (README)
- [B13] https://crates.io/api/v1/crates/refinery ·
  https://crates.io/api/v1/crates/refinery-core/0.10.0/dependencies · https://github.com/rust-db/refinery (README)

Medidas de terceiros:

- [M1] https://aws.amazon.com/blogs/database/resources-consumed-by-idle-postgresql-connections/
