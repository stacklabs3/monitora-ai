# Uma volta da Torre de controle

O que o `/loop 10m` da skill `torre` faz a cada vez. Rode do checkout principal e filtre cada saída
com `tail`, `head` ou `cut`: o que passa de uns 20 mil caracteres o `vigia-saida` avisa.

1. **Ler.**
   - `torre.pid` e o tempo no ar (`ps -p <pid> -o etime=`), e se existe `PARAR`.
   - O fim do `torre.log`.
   - No `torre-estado.json`: a fase do código, as filas do par, as execuções rodando ou em
     `aguardando-conta`, as que terminaram desde a volta anterior (resultado e `falha`) e as contas.
   - O *Para o Matheus* do `torre-status.md` acumula itens de execuções antigas; cite só o que conferir.
2. **Conferir pela fonte** cada coisa que mudou:
   - a PR da integração (`gh pr list --state all --search "head:integracao/<nome>"`);
   - as issues que ela fecha (`closingIssuesReferences`) e o estado de cada uma;
   - os rótulos da issue triada ou criada;
   - a branch publicada (`git ls-remote origin 'refs/heads/<branch>'`).

   O resultado que a execução grava só vale confirmado.
3. **Agir.**
   - **A Torre caiu** (sem `torre.pid`): rode o ensaio e leia o `abriria agora` inteiro (passo 2 de
     *Subir* no `SKILL.md`). Com ação, suba a Torre. Sem ação, deixe-a parada e diga o que a segura.
   - **PR que fecha mais de 10 issues:** o GitHub fecha só as 10 primeiras pela palavra-chave. Feche à
     mão a que sobrou, com um comentário que aponta a PR.
   - **Par planejado sem semente** (o `proximo_par` do estado sem `servidor`): avise, com as filas e as
     issues de cada uma e o `fora` de `pares/par-<n>.json`, cada issue com o motivo.
   - **Execução reaberta ou muito tempo sem saída:** leia o fim do stream dela
     (`.scratch/torre/execucoes/<data>-<nome>-t<n>c<n>.jsonl`, os últimos `tool_use`) e diga o que ela
     fazia. Os 45 minutos e as reaberturas são da Torre; a segunda falha vai sozinha para *Para o Matheus*.
   - **Spec com todas as fatias fechadas e ainda aberto:** diga ao Matheus. A Torre não fecha o spec
     que está em `estado["specs"]`, porque essa lista o tira da avaliação.
   - **Pedido que a Torre não sabe atender sozinha** (uma execução pede um passo que nenhuma frente
     abre): diga ao Matheus o que falta e o contorno, por exemplo uma frente posta à mão no estado com a
     Torre parada, e espere o ok dele.
4. **Status de até 8 linhas,** nesta ordem: o que é do Matheus (o handoff e o que esta volta trouxe),
   a frente de código (par, filas, issues), as PRs, e a Torre com as contas. Cada linha conferida pela
   fonte.
