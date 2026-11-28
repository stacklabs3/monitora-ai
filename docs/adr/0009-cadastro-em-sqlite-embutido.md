---
status: accepted
---

# O cadastro fica em SQLite, embutido no servidor

Pessoas, chaves de envio, catálogo de campos, auditoria, saúde do envio e estado dos alertas ficam num arquivo SQLite, aberto pelo próprio servidor, sem um segundo serviço na máquina. O motivo: na máquina de 2 GB, o OpenSearch e o servidor já dividem um teto de 1,5 GB ([ADR 0002](0002-opensearch-como-banco-de-logs.md), condição 1), e uma pessoa só opera tudo ([Restrições do projeto](https://github.com/stacklabs3/monitora-ai/issues/19)). O SQLite roda dentro do processo, com 2 MB de cache por padrão, e o PostgreSQL reserva 128 MB só de `shared_buffers` e pede um serviço a mais para subir, atualizar e copiar.

Decidido em [Escolher onde fica o cadastro](https://github.com/stacklabs3/monitora-ai/issues/65), em 28/11/2026, pela recomendação, por delegação do responsável pelo produto. Fecha o item "Cadastro" das seams do [ADR 0003](0003-modulos-e-seams-do-servidor.md). Os fatos vêm da [pesquisa do armazenamento do cadastro](https://github.com/stacklabs3/monitora-ai/blob/research/cadastro/docs/research/cadastro.md); **nada foi medido no projeto**.

## Como entra

- **Um arquivo só:** SQLite 3.54.1, em modo WAL (leitores não esperam o escritor; um escritor por vez) com `synchronous=FULL`, que mantém a gravação confirmada mesmo numa queda de energia. O arquivo fica no disco da máquina, fora da pasta do OpenSearch.
- **Biblioteca Rust:** `rusqlite` 0.43, com `bundled` (compila o SQLite junto; a máquina não precisa ter SQLite instalado) e `backup`. As mudanças de esquema andam com o `rusqlite_migration` 2.9, aplicadas pelo servidor ao subir.
- **Chamadas fora das threads do `tokio`:** o `rusqlite` é bloqueante. A conexão de escrita mora numa thread própria e recebe os pedidos por canal, o mesmo desenho do `tokio-rusqlite` e do `sqlx-sqlite`, escrito no módulo e sem crate a mais.
- **Só o módulo de cadastro conhece SQL:** os outros módulos o chamam pela interface, na língua do domínio. Não há `trait` nem segundo adaptador: há um armazenamento só ([Desenho de módulos e SOLID](https://github.com/stacklabs3/monitora-ai/issues/44), P2).
- **Auditoria sem edição no próprio banco:** um gatilho recusa todo `UPDATE` na tabela da auditoria e todo `DELETE` de linha com menos de 6 meses. A limpeza do que passou de 6 meses é o único apagar que passa.
- **Cópia:** a rotina de backup pede ao servidor uma cópia a quente (Online Backup API) e guarda o arquivo junto das cópias do banco de logs. Restaurar é pôr o arquivo no lugar com o servidor parado.
- **Testes:** o cadastro roda de verdade, num arquivo temporário, sem contêiner. Responde o item em aberto de [Definir a estratégia de testes por fase](https://github.com/stacklabs3/monitora-ai/issues/39).

## O que muda no exemplo

A auditoria da busca da Ana fica 6 meses, sem edição, e a chave de envio da API do Excurfly fica só em hash:

| | SQLite embutido (escolhido) | PostgreSQL ao lado | Chave-valor em Rust (`redb`, `fjall`) |
|---|---|---|---|
| Memória reservada por padrão | 2 MB de cache por arquivo | 128 MB de `shared_buffers`, mais um processo por conexão | `fjall` recomenda 20 a 25% da memória; `redb` não levantado |
| Serviços na máquina | os mesmos dois (OpenSearch e servidor) | três | os mesmos dois |
| "Buscas da Ana em outubro" | uma consulta SQL | uma consulta SQL | índice por pessoa, período e produto escrito à mão |
| Auditoria sem edição | gatilho no banco | gatilho ou permissão no banco | só no código |
| Cópia e volta | um arquivo | `pg_dump` e restauração | não levantado |
| Atualizar versão | recompilar o servidor | versão maior pede `pg_dump` ou `pg_upgrade` | recompilar o servidor |

O uso real de memória (RSS) de nenhuma das três foi medido; a tabela compara o que a documentação reserva.

## Opções recusadas

- **PostgreSQL como segundo serviço:** SQL igual e maduro, mas soma memória e operação num teto que o OpenSearch já quase ocupa (1.342 MB na VM, 1,6 GB no contêiner com o cache, simulado). Ele serve quando há rede entre a aplicação e o dado ou muitos escritores ao mesmo tempo; aqui há um servidor só, na mesma máquina.
- **`redb` ou `fjall`:** embutidos e sem C, mas sem SQL. Listar a auditoria por período, pessoa ou produto, apagar o que passou de 6 meses e mudar o esquema viram código nosso.
- **`sled`:** o próprio README diz "beta" e manda usar SQLite quando a confiabilidade é a restrição.
- **`libsql` e `turso`:** o `libsql` manda projeto novo olhar o Turso, e o Turso ainda não chegou à 1.0 e pede backups independentes.
- **`sqlx` com SQLite:** pede Rust 1.94 (o `rusqlite` pede 1.89), não mostrou a cópia a quente entre as features, e o que ele traz a mais (async, pool, vários bancos) não é usado com um arquivo e um escritor.
- **`tokio-rusqlite`, `deadpool-sqlite`, `r2d2_sqlite`:** contas pessoais ou presos a versões antigas do `rusqlite`; o que fazem é uma thread com um canal.
- **OpenSearch e arquivo solto no disco:** já recusados no ADR 0003.

## Consequências

- **Compilador C no build:** `bundled` compila o `sqlite3.c`. Tempo de compilação sem medida.
- **O arquivo vale o que vale o disco:** o gatilho protege a auditoria do código do servidor, não de quem abre o arquivo na máquina. O acesso à máquina é do mapa de Infra.
- **Gravação pequena e constante:** a situação da execução chega a cada 30 s por execução (50 execuções dão 1,7 gravação por segundo, conta e não medida), cada uma com `fsync`. Se a medida reprovar, a saúde do envio grava em lote antes de se mexer na durabilidade do resto.
- **Um escritor por vez:** basta para um servidor só. Um segundo programa gravando no cadastro reabre esta escolha.
- **Trocar depois custa um módulo:** só o cadastro conhece SQL, e o SQL escrito é quase todo aceito pelo PostgreSQL. Os dados saem por `.dump`.

## Condições que ficam para a máquina real

Entram na conta de [Validar o banco na AWS](https://github.com/stacklabs3/monitora-ai/issues/60). **Se uma reprovar, esta escolha reabre.**

1. **Memória:** servidor com o cadastro aberto e OpenSearch juntos até 1,5 GB.
2. **Gravação:** a situação da execução gravada com `synchronous=FULL` no disco do Lightsail sem atrasar a confirmação dos eventos (meta de 1 s).
3. **Cópia e volta:** o arquivo do cadastro copiado a quente e restaurado dentro das 4 h da restauração inteira.

## Fontes

- [Pesquisa: armazenamento do cadastro](https://github.com/stacklabs3/monitora-ai/blob/research/cadastro/docs/research/cadastro.md): versões, licenças, memória documentada, cópia a quente, gatilhos, bibliotecas Rust e o que ficou sem medida
- [SQLite: usos apropriados](https://www.sqlite.org/whentouse.html), [WAL](https://www.sqlite.org/wal.html), [`synchronous` e `cache_size`](https://www.sqlite.org/pragma.html), [Online Backup API](https://www.sqlite.org/backup.html), [gatilhos e `RAISE`](https://www.sqlite.org/lang_createtrigger.html) e [suporte até 2050](https://www.sqlite.org/lts.html)
- [PostgreSQL: consumo de recursos](https://www.postgresql.org/docs/current/runtime-config-resource.html) (`shared_buffers` de 128 MB) e [atualização de versão](https://www.postgresql.org/docs/current/upgrading.html)
- [`rusqlite`](https://github.com/rusqlite/rusqlite), [`rusqlite_migration`](https://github.com/cljoly/rusqlite_migration), [`sqlx`](https://github.com/transact-rs/sqlx), [`sled`](https://github.com/spacejam/sled), [`redb`](https://github.com/cberner/redb) e [`turso`](https://github.com/tursodatabase/turso): README e crates.io, lidos em 28/11/2026
- [ADR 0002](0002-opensearch-como-banco-de-logs.md) (teto de 1,5 GB e memória simulada), [ADR 0003](0003-modulos-e-seams-do-servidor.md) (cadastro à parte dos eventos) e [ADR 0008](0008-avaliacao-dos-alertas-no-modulo-de-alertas.md) (estado do alerta no cadastro)
- [Definir privacidade, acesso e retenção](https://github.com/stacklabs3/monitora-ai/issues/8), itens 2, 15 e 16; [Desenho de módulos e SOLID](https://github.com/stacklabs3/monitora-ai/issues/44), P2; [Definir a estratégia de testes por fase](https://github.com/stacklabs3/monitora-ai/issues/39)
- Delegação do responsável pelo produto de 20/11/2026: decidir pela recomendação
