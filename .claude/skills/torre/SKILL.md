---
name: torre
description: Sobe a Torre autônoma quando o ensaio mostra o que abrir, arma o /loop 10m da Torre de controle e para a Torre (/torre parar).
disable-model-invocation: true
---

# Torre de controle

A Torre (`.claude/torre/torre.py`) leva as issues ao fim abrindo execuções headless nas duas contas do
Claude Code. Esta skill é a Torre de controle: sobe a Torre, vigia de 10 em 10 minutos e para.

- **Sem argumento:** siga *Subir*.
- **`parar`:** siga *Parar*.

Rode tudo do checkout principal, a pasta que tem `.scratch/torre/`. Um `cd` numa worktree da Torre
vira o diretório da sessão; volte com `cd` para o checkout principal antes do comando seguinte.

## Subir

1. **Pré-voo, só leitura.**
   - Leia o handoff mais novo inteiro: `ls -t .scratch/torre/handoff-torre-*.md | head -1`. É a fonte
     do que mudou e do que é do Matheus.
   - Leia o `.claude/torre/README.md`: o ciclo, o estado e os comandos.
   - Confira `test -f .scratch/torre/torre.pid`, `ls .scratch/torre/PARAR` e `tail -5 .scratch/torre/torre.log`.
   - Confira em `mcp__ccd_session_mgmt__list_sessions` se outra sessão de Torre de controle está rodando.

   Pronto quando você sabe se a Torre está viva, se há `PARAR`, qual foi o último evento e se outra
   sessão já vigia. Se outra sessão vigia, ou se há `PARAR` que você não criou, relate e pergunte.
   Com a Torre viva e ninguém vigiando, pule para o passo 4.
2. **Ensaio.** Rode `python3 .claude/torre/torre.py --ensaio | sed -n '/^abriria agora/,$p'`. Cada
   ação sai numa linha própria (`  - <tipo> <nome>: <motivo>`) abaixo do cabeçalho; um `grep` pelo
   cabeçalho as esconde.
   - Com ação na lista, siga para o passo 3.
   - Com a lista vazia, deixe a Torre parada, porque ela sairia na primeira volta. Diga ao Matheus o
     que a segura (as candidatas do ensaio e o *Para o Matheus* do handoff) e pergunte se arma o loop
     assim mesmo.
3. **Subir.** Apague o `PARAR` se existir e rode o comando do laço do README (*Como rodar*). Espere
   numa espera em segundo plano a linha nova `Torre no ar (pid N)` no `torre.log` e o arquivo
   `torre.pid`. Pronto quando os dois existem e a primeira volta abriu a ação do ensaio.
4. **Armar o loop.** `CronCreate` com `*/10 * * * *`, `recurring: true` e o prompt
   `Torre de controle: siga .claude/skills/torre/VOLTA.md.` Rode a primeira volta agora, pelo `VOLTA.md`.

Pronto quando a Torre está viva com uma execução aberta (ou o motivo de não estar está dito), o loop
está armado e o id dele foi dado ao Matheus, e o primeiro status saiu.

## Parar

1. `touch .scratch/torre/PARAR` e espere o **arquivo** `torre.pid` sumir, com um laço em `test -f`
   numa espera em segundo plano. `kill -0 $(cat …)` vira `kill -0 0` com o arquivo apagado e dá
   certo para sempre. As execuções seguem e são retomadas na próxima subida; para matá-las também, veja
   *Como parar* no README.
2. Apague o job do loop com `CronDelete` (o `CronList` dá o id).
3. Escreva no handoff mais novo um *Onde parou*: a hora, a fase do código, as execuções, o que entrou na
   `main` e o que é do Matheus.

## Mexer na Torre

- **Torre parada antes de editar.** O estado (`torre-estado.json`), a configuração e o `torre.py` só se
  editam depois do passo 1 de *Parar*: a Torre regrava o estado da memória a cada volta. Guarde uma
  cópia do estado antes (`torre-estado.antes-<motivo>.json`).
- **Mudança no `torre.py`:**
  1. Edite o arquivo do checkout principal.
  2. Teste com eventos de exemplo: um script no scratchpad que carrega o arquivo por `importlib` e
     chama as funções com estado e retrato falsos, sem chamar o Claude. Veja-o falhar antes e passar
     depois.
  3. Rode `python3 -m py_compile .claude/torre/torre.py` e suba a Torre.
  4. Leve a mudança à `main`: worktree de `origin/main` numa `chore/torre-*`, o arquivo copiado, o corpo
     da PR pela `/pr`, `scripts/ci-local.sh <pr> <pasta>` (ele espera a vaga sozinho) e o merge por
     `scripts/agents/integrar-item.sh <pr> --relatorio <md>` com o ok do Matheus. Remova a worktree.
- **O checkout principal não recebe `git pull`.** A pasta `.claude/torre/` dele acompanha a `main` por
  cópia: confira com `git diff --quiet origin/main -- .claude/torre/`.
