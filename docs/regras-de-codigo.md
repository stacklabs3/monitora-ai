# Regras de código

Régua do implementador e do revisor do Monitora AI, num documento só para o servidor (Rust), o
painel e a biblioteca Node.js (TypeScript) e a biblioteca Java. Nasce dos princípios de código da
casa ([docs/agents/principios-de-codigo.md](agents/principios-de-codigo.md)) e das decisões do
[Mapa: regras de código](https://github.com/stacklabs3/monitora-ai/issues/40); muda só por ticket.
O `docs/regras-de-codigo.json` diz como o validador confere cada regra, e o
[docs/riscos.md](riscos.md) lista os riscos que os testes cobrem.

## Como ler

- **Regra `R<n>`:** uma linha que se aponta num diff, com o princípio de onde nasce, o porquê e um
  exemplo do Monitora AI. Os exemplos são sintéticos: a Ana, a reserva `R-1042`, o telefone
  `(11) 90000-4321`.
- **Conferência:** como a máquina ou o revisor cobra a regra. O ID é o número da regra no Rust e no
  que vale para todas as linguagens, `100 + n` no TypeScript e `200 + n` no Java: a regra R5 se
  confere por R5, R105 e R205. A tabela [Conferências](#conferências) lista todas.
- **`revisor`:** o agente revisor dá o veredito da regra em todo parecer. Em Rust é só ele (ninguém
  lê Rust); em TypeScript e Java o humano também julga, nas partes da seção *Quem libera*.
- **Precedência:** este documento, depois as ADRs de `docs/adr/`, depois os princípios da casa.

## Pastas

Uma pasta por subprojeto na raiz, cada uma com o seu `CLAUDE.md` e a ferramenta da sua linguagem:

| Pasta | O que é | Manifesto |
|---|---|---|
| `servidor/` | servidor Rust, um crate só, com uma pasta por módulo do [ADR 0003](adr/0003-modulos-e-seams-do-servidor.md) em `servidor/src/` | `servidor/Cargo.toml` |
| `painel/` | painel em Solid ([ADR 0004](adr/0004-solid-no-painel.md)), com pastas pelas rotinas do protótipo aprovado | `painel/package.json` |
| `biblioteca-node/` | biblioteca Node.js ([ADR 0001](adr/0001-formato-proprio-de-envio-e-bibliotecas-leves.md)) | `biblioteca-node/package.json` |
| `biblioteca-java/` | biblioteca Java, depois da primeira versão | `biblioteca-java/pom.xml` |
| `contrato/` | arquivo do contrato `/v1` e os casos sintéticos, lidos pelo servidor e pelas bibliotecas | |

O ESLint, o Prettier e o `tsconfig.json` de base ficam na raiz e valem para o painel e para a
biblioteca Node; cada pasta soma o que é só dela.

## Quem libera

Limites de [Restrições para as regras](https://github.com/stacklabs3/monitora-ai/issues/41) que todo
diff respeita:

- Merge só com `CI: APROVADO` no CI local e `PARECER: APROVADO` do revisor e do conferente.
- Cada issue tem até 400 linhas e 10 arquivos no diff, sem contar gerados e lockfile; acima disso, só
  com o motivo escrito.
- PR de Rust não depende de leitura humana. Trecho obscuro apontado pelo revisor, pelo conferente ou
  pelo humano espera a explicação em português e a simplificação ou um teste que prove.
- O humano lê linha a linha o que muda na biblioteca Node, no login e permissão do painel e na
  definição dos campos do evento.
- Recurso difícil de Rust (`trait` próprio, genérico próprio, `dyn`, macro própria, `unsafe`) só com a
  segunda variação real ou com a medição na máquina de 2 GB citada no PR.
- Todo limite de entrada tem teste acima dele, ligado a um risco de `docs/riscos.md`.

## Garantido pelo lint e pelo formatador

Tudo em erro, com versão fixa; nada em aviso. Subir de versão é commit `chore` próprio.

- **rustfmt** do toolchain fixo em `servidor/rust-toolchain.toml` (edição 2024), estilo padrão de 100
  colunas, sem `rustfmt.toml`: o formato do Rust (P8).
- **rustc + Clippy** do mesmo toolchain, com `all` e `pedantic` em `deny` e os lints das regras
  listados um a um em `[lints]` do `servidor/Cargo.toml`, com os limites em `servidor/clippy.toml`:
  nomes (E1, menos parâmetro de tipo e lifetime), tamanho de função (E2), `mut` (E5), resto de
  depuração (E6), visibilidade (P1, I), código morto (P7, `dead_code`), `unsafe` (RS1), pânico (RS2) e
  conversão numérica (RS5). Ficam em `allow`: `must_use_candidate`, `module_name_repetitions`,
  `missing_errors_doc` e `missing_panics_doc`. Em teste, o `clippy.toml` libera `unwrap`, `expect`,
  `panic`, índice e `print`.
- **cargo-deny** e **cargo-machete**: dependências auditadas (RS3), a lista de crates proibidos (P8) e
  a dependência sem uso (P7). `--locked` em todo comando (RS4).
- **TypeScript 6.0** com `tsc --noEmit`, um compilador só, e **ESLint 10 + typescript-eslint**
  (`strictTypeChecked`): nomes e caixa (E1), tamanho de função (E2), `any` e afirmação de tipo (E3),
  promessa solta (E4), `const` e `readonly` (E5), `switch` exaustivo (O), TS1, TS2 e TS5. No painel,
  `eslint-plugin-solid` (TS3) e `eslint-plugin-jsx-a11y` (TS4); na biblioteca, `eslint-plugin-jsdoc`
  no que ela exporta (E6). Reabre quando o typescript-eslint aceitar o TypeScript 7.
- **Prettier**, rodado à parte: o formato do TypeScript (P8).
- **Maven**, em JDK 21 ou mais novo, compilando com `--release 11 -Xlint:all -Werror`: o Java mínimo
  da biblioteca continua 11, sem `record` nem `sealed`. **Error Prone + NullAway** garantem a nulidade
  (E3), os descartes (E4), o código morto (P7), o `enum` coberto (O), o `@Override` (L), JV2, JV6 e
  parte do JV3; **Checkstyle** garante os nomes (E1), o tamanho (E2), o número solto (E8) e o Javadoc
  do que é público (E6); **PMD** garante o imutável (E5), JV1, JV5 e o resto do JV3; **ArchUnit**
  garante a interface pública, os ciclos e os pacotes proibidos (P1, I, P4, P8, JV4);
  **Spotless + google-java-format**, o formato (P8). SpotBugs fica fora.

O que nenhuma ferramenta garante sozinha (tipo próprio na borda, caminho de falha, duplicação de
conhecimento, desenho dos módulos, risco coberto) está nas regras abaixo, com ast-grep, `jscpd`, teste
e revisor.

## Regras

### R1. Nome em português sem acento, com o termo exato do glossário
Nasce de: E1 (adaptado)
Por quê: O código fala a língua do `GLOSSARY.md`; sem acento, a mesma palavra não vira dois nomes entre Mac e Linux. Inglês só em termo técnico sem palavra comum (`buffer`, `worker`, `token`) e no que é da linguagem.
Exemplo: `Aplicacao`, `alertas_enviados`, `conectarMonitora({ produto, aplicacao })`. Termo evitado não se libera: troca-se a palavra.
Confere: R1 (todas)

### R2. Nenhum nome de uma letra; caixa da linguagem; booleano começa com `esta`, `tem`, `pode` ou `foi`
Nasce de: E1 (adaptado)
Por quê: Ninguém lê o Rust (LR9): o nome é o que sobra para o agente revisor entender o trecho. Só `_` para valor descartado; em Java nem `_`.
Exemplo: `const p = evento.nivel` reprova, `nivelDoEvento` passa; `let ativo: boolean` reprova, `estaAtivo` passa; `eventos.forEach(e -> fila.add(e))` reprova.
Confere: R2 (Rust), R102 (TypeScript), R202 (Java)

### R3. Parâmetro de tipo e lifetime têm nome
Nasce de: E1 (adaptado)
Por quê: O `min_ident_chars` não aponta lifetime de uma letra (teste local de 18/11/2026), e o lint do TypeScript não olha genérico.
Exemplo: `fn buscar<'consulta, Filtro>(...)`, nunca `fn buscar<'a, T>(...)`.
Confere: R3 (Rust), R103 (TypeScript)

### R4. Número leva a unidade, horário sem fuso no tipo leva `_utc` e nome de fora fica na borda
Nasce de: E1 (adaptado)
Por quê: Fuso e unidade trocados já deram erro em projetos anteriores (LR18); o nome é a defesa quando o tipo não diz.
Exemplo: `retencao_em_dias`, `recebido_em_utc`; `service.name` vira `aplicacao` na entrada do envio.
Confere: R4 (todas)

### R5. Função com até 3 níveis de aninhamento, 3 parâmetros e 60 linhas
Nasce de: E2 (adaptado)
Por quê: Função curta cabe na revisão de uma issue de 400 linhas (LR6). Exceção só com o motivo escrito ao lado. No Clippy os 3 níveis são `excessive-nesting-threshold = 4` (conta o corpo da função).
Exemplo: `julgar_evento(evento, limites, agora_utc)` passa; um quarto parâmetro vira um tipo (`ContextoDoRecebimento`).
Confere: R5 (Rust), R105 (TypeScript), R205 (Java)

### R6. Conceito do evento tem tipo próprio, que só se constrói válido e se converte uma vez, na borda
Nasce de: E3 (adaptado)
Por quê: A regra do campo muda num lugar só, e dali para dentro ninguém confere de novo. Converte-se nas duas entradas HTTP, no adaptador da guarda de eventos, em `conectarMonitora` e na função que chama a API do painel.
Exemplo: Não existe tipo `Telefone`: `(11) 90000-4321` só existe no passo de máscara da biblioteca, de onde saem um `ValorMascarado` (`(11) *****-4321`) e um `CodigoDeBusca`. Julgar um evento dá aceito, aceito com marca ou recusado com motivo.
Confere: R6 (todas)

### R7. Interface de módulo não leva tipo cru: `serde_json::Value`, `bool` solto, `any`, nulo sem tipo
Nasce de: E3 (adaptado)
Por quê: Tipo cru na interface deixa passar valor que nenhuma borda conferiu.
Exemplo: `fn gravar(evento: EventoAceito)` passa; `fn gravar(evento: serde_json::Value, esta_cortado: bool, tem_marca: bool)` reprova.
Confere: R7 (Rust), R107 (TypeScript), R207 (Java)

### R8. `as unknown as T` só na conversão da borda
Nasce de: E3 (adaptado)
Por quê: A afirmação dupla desliga o compilador e fabrica o tipo sem validar.
Exemplo: `resposta as unknown as RegrasDeMascara` só dentro da função que converte a resposta de `/v1/regras`.
Confere: R108 (TypeScript)

### R9. Campos do evento têm fonte única no arquivo do contrato `/v1`, conferida por teste de paridade
Nasce de: E3 (adaptado)
Por quê: Cada campo tem uma fonte só (LR16). Os tipos de Rust, TypeScript e Java são escritos à mão, sem gerador, e o mesmo arquivo e os mesmos casos sintéticos de `contrato/` julgam os três.
Exemplo: Campo opcional novo no lote de `POST /v1/eventos`: muda o arquivo do contrato, o tipo do `recebimento` e o da biblioteca Node na mesma PR, ou o teste de paridade reprova.
Confere: R9 (Rust), R109 (TypeScript), R209 (Java)

### R10. Chave de envio e chave de códigos têm tipo cuja impressão não mostra o valor
Nasce de: E3 (adaptado)
Por quê: Nenhum segredo vai para log, mensagem de erro ou argumento de comando (LR17).
Exemplo: `format!("{chave_de_envio:?}")` imprime `ChaveDeEnvio(***)`; o teste do risco procura o valor falso na saída.
Confere: R10 (todas)

### R11. Erro previsto volta como resultado com tipo próprio, que separa recusa de falha
Nasce de: E4 (adaptado)
Por quê: Quem chama decide com o erro: banco fora vira "tente depois", nunca "aceito" (LR14). `()`, `String`, `Box<dyn Error>` e `anyhow` não são tipo de erro em interface de módulo.
Exemplo: `Err(ErroDoRecebimento::Recusa(MotivoDaRecusa::SemCodigo))` e `Err(ErroDoRecebimento::Falha(causa))`; na biblioteca, `{ tipo: "enviado" } | { tipo: "recusado", motivo }`.
Confere: R11 (Rust), R111 (TypeScript), R211 (Java)

### R12. Nenhuma falha é descartada
Nasce de: E4 (adaptado)
Por quê: Falha de rede, disco ou banco descartada vira "sucesso" sem trabalho feito (LR14).
Exemplo: `let _ = guarda_de_eventos::gravar(lote);` reprova; promessa sem `await` nem tratamento reprova.
Confere: R12 (Rust), R112 (TypeScript), R212 (Java)

### R13. Nenhum ramo de erro vazio ou que só registra
Nasce de: E4 (adaptado)
Por quê: Registrar e seguir é engolir o erro com um passo a mais.
Exemplo: `catch (erro) { console.error(erro) }` no envio do lote reprova: o certo é contar a perda de evento com motivo.
Confere: R13 (Rust), R113 (TypeScript), R213 (Java)

### R14. Verificador só se cala com o porquê ao lado
Nasce de: E4 (adaptado)
Por quê: Supressão sem motivo esconde o erro que a regra pegaria. `#[expect]` avisa quando deixa de ser preciso; `@ts-ignore`, `@ts-nocheck`, `// NOPMD` e `// CHECKSTYLE:OFF` nunca entram.
Exemplo: `#[expect(clippy::disallowed_methods, reason = "o main.rs le o ambiente na partida")]`.
Confere: R14 (Rust), R114 (TypeScript), R214 (Java)

### R15. A biblioteca nunca lança erro nem devolve promessa rejeitada para a aplicação
Nasce de: E4 (adaptado)
Por quê: Falha da biblioteca não afeta a aplicação (LR19): toda falha interna morre dentro dela e vira perda de evento contada. A rede de proteção de cada função exportada é o único `catch` genérico aceito.
Exemplo: `conectarMonitora` com configuração inválida não lança: a biblioteca fica desligada, escreve no stderr no máximo 1 linha por minuto e conta a perda com motivo.
Confere: R15 (todas)

### R16. O código cumpre os lints e o typecheck declarados
Nasce de: E4 (adaptado)
Por quê: O `lint-cobre` prova que a regra está declarada; só o próprio lint prova que o código a cumpre. Tudo em erro, nada em aviso: aviso que ninguém lê não é cobrança.
Exemplo: Um `.unwrap()` no recebimento do lote do Excurfly reprova o CI local em vez de virar aviso.
Confere: R16 (Rust), R116 (TypeScript), R216 (Java)

### R17. Imutável por padrão
Nasce de: E5 (adaptado)
Por quê: O que não muda não precisa ser acompanhado por quem revisa. Variável local que muda dentro da própria função é livre; estado compartilhado fica num módulo só, atrás da interface dele; no painel, só o setter do signal ou da store muda estado, e props nunca.
Exemplo: `let mut lote` ao montar o lote passa; reatribuir o parâmetro `evento` reprova; `export let` reprova.
Confere: R17 (Rust), R117 (TypeScript), R217 (Java)

### R18. O nome diz se a função consulta ou comanda, e consulta não grava
Nasce de: E5 (adaptado)
Por quê: Função com nome de consulta (`buscar`, `listar`, `calcular`, `esta`, `tem`, `pode`) não grava, não envia e não muda o que recebeu.
Exemplo: Na guarda de eventos, `listar` e `buscar` são consultas; `preparar`, `gravar` e `apagar` são comandos.
Confere: R18 (todas)

### R19. `TODO` e `FIXME` só com o número da issue
Nasce de: E6 (adaptado)
Por quê: Pendência sem dono não é paga.
Exemplo: `// TODO(#123): medir o corte do evento de 1 MB`.
Confere: R19 (todas)

### R20. Código comentado reprova
Nasce de: E6 (adaptado)
Por quê: Código comentado é a versão antiga que ninguém testou; o git guarda o histórico.
Exemplo: `// let prazo = 30;` acima da linha nova reprova.
Confere: R20 (Rust), R120 (TypeScript), R220 (Java)

### R21. Comentário explica o porquê e bate com o código novo
Nasce de: E6 (adaptado)
Por quê: Comentário que mente já enganou em projetos anteriores (LR18): o revisor compara os comentários perto do diff com o código que mudou.
Exemplo: O comentário diz "reenvia por 5 minutos" e o diff muda a constante para 10: reprova até o comentário mudar junto.
Confere: R21 (todas)

### R22. Sem resto de depuração; documentação obrigatória só no que a biblioteca exporta
Nasce de: E6 (adaptado)
Por quê: O servidor é binário e não pede doc; a biblioteca é lida por quem a instala.
Exemplo: `dbg!(evento)` e `todo!()` reprovam; `conectarMonitora` sem comentário de documentação reprova.
Confere: R22 (Rust), R122 (TypeScript), R222 (Java)

### R23. Bloco igual de 8 linhas ou mais reprova; regra de negócio se junta na segunda ocorrência
Nasce de: E7 (adotado)
Por quê: Conhecimento em dois lugares muda num e esquece o outro. Código só parecido espera a terceira ocorrência; gerado não conta. Duplicação de conhecimento sem texto igual é do revisor.
Exemplo: O limite de 128 letras do valor de correlação conferido no `recebimento` e de novo na `consulta` reprova: mora numa constante só.
Confere: R23 (todas)

### R24. Número solto em regra reprova, fora `0`, `1`, `-1` e os testes; a constante mora no módulo do assunto
Nasce de: E8 (adaptado)
Por quê: O número sem nome não diz o que limita. Não há arquivo geral de constantes.
Exemplo: `LIMITE_DE_ERROS_DO_ALERTA` no módulo `alertas`; `if eventos.len() > 1000` reprova.
Confere: R24 (Rust), R124 (TypeScript), R224 (Java)

### R26. Módulo é uma pasta do ADR 0003 com interface pequena; nada é público além dela
Nasce de: P1 (adotado)
Por quê: Quem chama aprende pouco e a mudança fica num lugar. Pastas do servidor: `recebimento`, `catalogo_de_campos`, `consulta`, `acesso`, `saude_do_envio`, `retencao`, `alertas`, `auditoria`, `guarda_de_eventos`, `cadastro`, `entrada_do_envio`, `entrada_do_painel`.
Exemplo: Trocar o OpenSearch muda só `guarda_de_eventos/opensearch.rs`. Privado por padrão, `pub(crate)` só no `mod.rs`; na biblioteca Java, só a interface é `public`.
Confere: R26 (Rust), R126 (TypeScript), R226 (Java)

### R27. Função que só repassa os mesmos parâmetros reprova
Nasce de: P1 (adotado)
Por quê: Teste da exclusão: se apagar o módulo não espalha complexidade, ele era só passagem.
Exemplo: `consulta::buscar` que apenas chama `guarda_de_eventos::buscar` com os mesmos argumentos reprova.
Confere: R27 (todas)

### R28. `trait`, interface ou classe abstrata só com a segunda variação real
Nasce de: P2 (adotado)
Por quê: Um adaptador é seam hipotética; dois é seam real (LR12). Hoje a guarda só tem o OpenSearch e o alerta só tem o Telegram: são módulos de funções concretas. Relógio e acaso entram como valor.
Exemplo: `trait Relogio` com um `impl` só reprova: a função recebe `agora_utc`. Em Java, `XService` com `XServiceImpl` reprova.
Confere: R28 (todas)

### R29. Dependência entra por parâmetro; ambiente, relógio e acaso só na montagem
Nasce de: P3 (adotado)
Por quê: A regra se testa sem rede nem relógio. A montagem fica só no `main.rs`; a biblioteca recebe tudo de `conectarMonitora` e não lê o ambiente.
Exemplo: `std::env::var("RETENCAO_EM_DIAS")` dentro de `retencao` reprova: o `main.rs` lê e passa o valor.
Confere: R29 (Rust), R129 (TypeScript), R229 (Java)

### R30. Fora do `main.rs` não há leitura de ambiente, relógio, `exit` nem saída padrão
Nasce de: P3 (adotado)
Por quê: É a mesma regra da R29 cobrada pelo compilador, com `#[expect]` só no `main.rs`.
Exemplo: `println!` no `recebimento` reprova; `Instant::now()` na avaliação do alerta reprova.
Confere: R30 (Rust), R230 (Java)

### R31. No painel, `fetch` só no módulo de chamadas
Nasce de: P3 (adotado)
Por quê: A tela recebe o tipo já convertido (R6) e não conhece a API.
Exemplo: `fetch("/painel/eventos")` dentro de `LinhaDoTempo.tsx` reprova.
Confere: R131 (TypeScript)

### R32. Pastas por conceito, nunca por camada, e as chamadas seguem o sentido do ADR 0003
Nasce de: P4 (adaptado)
Por quê: O que muda junto fica junto, e duas issues tocam arquivos diferentes. Um crate só no servidor; separar em crates volta por ticket se a medição de build pedir ou a regra de imports falhar. `controllers`, `services`, `models` e `utils` reprovam.
Exemplo: `guarda_de_eventos` não importa nenhum outro módulo; ninguém importa `entrada_do_envio` nem `entrada_do_painel`; quem registra auditoria importa `auditoria`, nunca o `cadastro`.
Confere: R32 (Rust), R132 (TypeScript), R232 (Java)

### R33. Todo teste cita o risco que cobre (`RK<n>` de `docs/riscos.md`) e tem nome de frase
Nasce de: P5 (adaptado)
Por quê: Regra 15 da constituição: sem risco, o teste não entra.
Exemplo: `rk2_recusa_evento_acima_do_limite`; `describe("RK2: ...")`.
Confere: R33 (todas)

### R34. Nenhum teste sem afirmação, com afirmação trivial, desligado ou focado
Nasce de: P5 (adaptado)
Por quê: Teste sem prova passa sem conferir nada (LR18).
Exemplo: `#[ignore]`, `it.only` e `assert!(true)` reprovam.
Confere: R34 (Rust), R134 (TypeScript), R234 (Java)

### R35. Teste apagado ou renomeado só com `Substitui-teste: <antigo> por <novo>` no commit
Nasce de: P5 (adaptado)
Por quê: Apagar teste de risco sem substituto já aconteceu (LR18). O revisor valida que o novo cobre o mesmo risco.
Exemplo: A lista de `cargo test -- --list` da base tem `rk3_reenvio_nao_duplica` e a da branch não: reprova sem a linha no commit.
Confere: R35 (Rust), R135 (TypeScript), R235 (Java)

### R36. Mutação sem sobrevivente no que mudou: recebimento, gravação, busca e alerta no servidor, e as bibliotecas
Nasce de: P5 (adaptado)
Por quê: Ninguém lê o Rust: a mutação prova que o teste percebe o defeito. Nenhum `missed` nem `timeout`; exceção só para o defeito que nenhum teste percebe, com o motivo escrito e validado pelo revisor. O tempo se mede na primeira fatia; se pesar, muda por ticket, não se desliga.
Exemplo: Trocar `>` por `>=` no limite de 1.000 eventos do lote precisa quebrar um teste.
Confere: R36 (Rust), R136 (TypeScript), R236 (Java)

### R37. O que é nosso roda de verdade; simulador só para o que não é nosso; teste instável não se repete
Nasce de: P5 (adaptado)
Por quê: Simulador que aceita o que o real recusa já enganou (LR18). Banco real em contêiner; o simulador do Telegram recusa o que a documentação recusa, e a mesma suíte roda no serviço real antes de cada versão. Falhou uma vez, reprova. A suíte roda em `UTC` e em `America/Sao_Paulo`, e também em Linux.
Exemplo: O teste de `guarda_de_eventos::gravar` sobe o OpenSearch em contêiner; não há guarda em memória.
Confere: R37 (todas)

### R38. Commit `refactor` não altera arquivo de teste
Nasce de: P6 (adaptado)
Por quê: Refatorar com o teste parado prova que o comportamento não mudou.
Exemplo: `refactor(recebimento): extrai julgar_evento` que toca `tests/recebimento.rs` reprova.
Confere: R38 (todas)

### R39. TDD nas divisas da spec e em todo bug, com a falha inicial do teste registrada na issue
Nasce de: P6 (adaptado)
Por quê: A falha inicial é a prova de que o teste testa (RP1). Registra-se o comando e a linha da falha.
Exemplo: Bug de evento duplicado no reenvio: primeiro o `rk3_...` vermelho, com a saída colada na issue; depois a correção.
Confere: R39 (todas)

### R40. Nada sem uso: dependência, export e código morto saem
Nasce de: P7 (adotado)
Por quê: Só entra o que a spec pede. Vários produtos já são requisito; a biblioteca Java ainda não justifica preparação.
Exemplo: `chrono` no `Cargo.toml` sem nenhum `use` reprova.
Confere: R40 (Rust), R140 (TypeScript), R240 (Java)

### R41. Dependência nova só com motivo no PR, aceite do humano, versão travada e 7 dias de publicada
Nasce de: P7 (adotado)
Por quê: Dependência é código que ninguém aqui revisou (LR20); a biblioteca Node não tem dependência obrigatória (ADR 0001).
Exemplo: O diff do `Cargo.toml` ganha `thiserror = "2"`: o PR diz por quê e o `Cargo.lock` trava a versão.
Confere: R41 (todas)

### R42. Um formato só por linguagem
Nasce de: P8 (adaptado)
Por quê: Formato não se discute em revisão. rustfmt padrão (100 colunas, sem `rustfmt.toml`), Prettier rodado à parte e google-java-format pelo Spotless.
Exemplo: Arquivo fora do formato reprova o CI local; ninguém formata à mão.
Confere: R42 (Rust), R142 (TypeScript), R242 (Java)

### R43. Uma escolha só por assunto: cliente HTTP, datas, validação, logs e erros
Nasce de: P8 (adaptado)
Por quê: A segunda biblioteca para o mesmo assunto dobra o que o agente precisa saber. A escolha muda por ticket, no projeto inteiro. Proibidos no servidor: `anyhow`, `actix-web`, `tonic`, `prost`, `opentelemetry`, `opentelemetry-proto`, `opensearch`, `simd-json`, `rust-embed`.
Exemplo: Um PR que acrescenta `anyhow` reprova no `cargo deny check bans`.
Confere: R43 (Rust), R143 (TypeScript), R243 (Java)

### R44. Commit em Conventional Commits, em português: `tipo(área opcional): frase`
Nasce de: P9 (adaptado)
Por quê: Um commit conta uma mudança; o corpo diz o porquê quando o título não basta.
Exemplo: `fix(recebimento): recusa evento sem numero na execucao`.
Confere: R44 (todas)

### R45. Cada commit passa na suíte sem contêiner; o último passa na suíte inteira
Nasce de: P9 (adaptado)
Por quê: Commit que não passa quebra a busca do commit culpado. Depois de cada merge na integração, a suíte inteira roda no resultado antes da próxima issue.
Exemplo: Commit `test:` com o teste vermelho e a correção só no commit seguinte reprova: os dois vão juntos.
Confere: R45 (todas)

### R46. Um diff não põe num módulo a regra de outro ator
Nasce de: S (adotado)
Por quê: Os atores são quatro: o responsável pelo produto (busca, alertas, campos), a lei de privacidade (máscara, retenção, exclusão, auditoria), quem opera a máquina (saúde do envio, limites, memória) e a aplicação que envia (contrato `/v1`).
Exemplo: Prazo de retenção dentro da `consulta` reprova: a consulta pede o corte à `retencao` ou recebe o prazo.
Confere: R46 (todas)

### R47. Conjunto fechado é `enum` ou união de literais, e o `match` cobre toda variante sem curinga
Nasce de: O (adaptado)
Por quê: Variante nova precisa parar a compilação em todo lugar que decide por ela. Em Java, com o mínimo em 11, é `enum` com `switch` sem `default`.
Exemplo: `match motivo_da_perda { ..., _ => () }` reprova; no painel, `switch (situacaoDaExecucao)` sem um dos casos reprova.
Confere: R47 (Rust), R147 (TypeScript), R247 (Java)

### R48. A variação que já existe se estende por dado; o mesmo `match` em dois módulos reprova
Nasce de: O (adaptado)
Por quê: Extensão por adaptador só nas seams reais (R28).
Exemplo: Declarar um campo pesquisável novo no catálogo de campos não exige editar `recebimento`, `consulta` nem `guarda_de_eventos`.
Confere: R48 (todas)

### R49. Todo `trait` com mais de um adaptador tem suíte de contrato que roda igual em todos
Nasce de: L (adotado)
Por quê: O adaptador cumpre a interface inteira; nenhum usa `unimplemented!()` nem `todo!()` (R22). O `trait` mora em `porta_<modulo>.rs` na pasta do módulo dono, que é onde o validador o acha. Hoje não há nenhum; a regra vale no dia em que o primeiro nascer.
Exemplo: `servidor/src/guarda_de_eventos/porta_guarda_de_eventos.rs` pede `servidor/tests/contrato_porta_guarda_de_eventos.rs`.
Confere: R49 (Rust), R149 (TypeScript), R249 (Java)

### R50. Uma interface por módulo, pequena e desenhada por quem chama
Nasce de: I (adaptado)
Por quê: Cada chamador importa só o que usa; a interface só se divide se algum adaptador precisar escrever método vazio.
Exemplo: A consulta usa `buscar`, a retenção usa as de apagar, o catálogo usa `preparar`; `acesso` responde só "quem é e o que pode".
Confere: R50 (todas)

### R51. O domínio não importa infraestrutura
Nasce de: D (adaptado)
Por quê: A regra define a interface; o detalhe a implementa. Domínio são as pastas da R26, menos as duas entradas, os arquivos de adaptador e o `main.rs`. Proibidos no domínio do servidor: `axum`, `tower`, `tower_http`, `hyper`, `http`, `reqwest`, `tokio::net`, `tokio::fs`, `tokio::process` e o crate do cadastro.
Exemplo: `alertas` decide que o limite de erros estourou e devolve o alerta; quem fala com o Telegram por `reqwest` é o arquivo de adaptador.
Confere: R51 (Rust), R151 (TypeScript), R251 (Java)

### R52. Tipo do cliente do banco ou do framework HTTP não aparece na interface de um módulo
Nasce de: D (adaptado)
Por quê: A interface fala "evento", "campo", "prazo", nunca "índice" ou "documento".
Exemplo: `pub(crate) fn buscar(...) -> opensearch::SearchParts` reprova.
Confere: R52 (Rust)

### R53. Sem `unsafe` no servidor
Nasce de: RS1 (adotado)
Por quê: O compilador não cobre o que o `unsafe` promete, e ninguém lê o Rust. `unsafe_code = "forbid"`; volta por ticket, com a medição do LR12.
Exemplo: Um bloco `unsafe` para ler o lote mais rápido não compila.
Confere: R53 (Rust)

### R54. Sem pânico por atalho fora de teste
Nasce de: RS2 (adotado)
Por quê: Pânico no servidor derruba o recebimento de todos os produtos. O `main` devolve `Result`.
Exemplo: O lote do Excurfly chega com 3 eventos e o código lê `eventos[3]`: reprova, vira `eventos.get(3)` com a recusa tratada.
Confere: R54 (Rust)

### R55. Árvore de dependências auditada: vulnerabilidade, licença, origem e duplicata
Nasce de: RS3 (adotado)
Por quê: Vulnerabilidade e crate retirado reprovam; só o crates.io; duas versões do mesmo crate só em `skip` com motivo; GPL, AGPL e LGPL nunca entram.
Exemplo: Um aviso de segurança novo no `hyper` reprova o CI local até a versão subir.
Confere: R55 (Rust)

### R56. `Cargo.lock` no git e `--locked` em todo comando
Nasce de: RS4 (adotado)
Por quê: O build da máquina de 2 GB é o mesmo do CI.
Exemplo: `cargo build` que mudaria o `Cargo.lock` reprova com `--locked`.
Confere: R56 (Rust)

### R57. Conversão numérica que pode perder valor usa `try_from`, nunca `as`
Nasce de: RS5 (adotado)
Por quê: O `as` corta o número em silêncio e deixaria um lote grande passar pelo limite (LR13).
Exemplo: O tamanho do lote (limite de 5 MB) se converte com `u32::try_from(tamanho_em_bytes)`.
Confere: R57 (Rust)

### R58. Só sintaxe apagável: sem `enum`, `namespace` com código nem *parameter properties*
Nasce de: TS1 (adotado)
Por quê: O arquivo roda igual depois de apagar os tipos; conjunto fechado é união de literais (R47).
Exemplo: `type NivelDoEvento = "erro" | "aviso" | "info"`, nunca `enum NivelDoEvento`.
Confere: R158 (TypeScript)

### R59. Cada arquivo se transpila sozinho
Nasce de: TS2 (adotado)
Por quê: O Vite do painel transpila arquivo por arquivo; o fonte da biblioteca é ESM.
Exemplo: `import type { EventoAceito }` para o que é só tipo.
Confere: R159 (TypeScript)

### R60. Contratos do Solid no painel: props não se desestruturam e o componente retorna uma vez
Nasce de: TS3 (adaptado)
Por quê: O painel é Solid (ADR 0004): as regras de React saem e entra o preset do `eslint-plugin-solid`.
Exemplo: `function LinhaDoEvento({ evento })` reprova, porque quebra a atualização da tela; o certo é `props.evento`.
Confere: R160 (TypeScript)

### R61. Acessibilidade conferida no JSX do painel
Nasce de: TS4 (adotado)
Por quê: O investigador usa o painel com teclado e leitor de tela. Prova pendente: se o `eslint-plugin-jsx-a11y` não rodar no ESLint 10 com o Solid, a regra fica com o revisor e a auditoria do protótipo até um ticket escolher outra ferramenta.
Exemplo: Uma `<img>` sem `alt` precisa reprovar (controle negativo da primeira fatia).
Confere: R161 (TypeScript)

### R62. Igualdade e coerção explícitas
Nasce de: TS5 (adotado)
Por quê: `==` e coerção implícita escondem a comparação de tipos diferentes.
Exemplo: `if (quantidadeDeEventos == "0")` reprova.
Confere: R162 (TypeScript)

### R63. Recurso se fecha em todo caminho (`try-with-resources`)
Nasce de: JV1 (adotado)
Por quê: Sem isso, cada reenvio deixa uma conexão presa dentro da aplicação de quem instalou a biblioteca.
Exemplo: O corpo da resposta do `POST /v1/eventos` se fecha também quando o servidor responde 503.
Confere: R263 (Java)

### R64. `equals` e `hashCode` andam juntos
Nasce de: JV2 (adotado)
Por quê: Sem `record` (Java 11), o `equals` dos valores é escrito à mão.
Exemplo: `CodigoDeBusca` com `equals` e sem `hashCode` reprova.
Confere: R264 (Java)

### R65. Concorrência sem resultado ignorado nem interrupção engolida
Nasce de: JV3 (adotado)
Por quê: A fila entre as threads da aplicação e a thread de envio é onde a biblioteca pode travar ou derrubar a aplicação (LR19). `DoNotUseThreads` fica fora: a biblioteca precisa de uma thread.
Exemplo: `catch (InterruptedException erro) {}` na thread de envio reprova.
Confere: R265 (Java)

### R66. A biblioteca não usa SQL nem lê objeto serializado
Nasce de: JV4 (adaptado)
Por quê: Sem SpotBugs: a biblioteca fala JSON por HTTPS. A proibição é de pacote, conferida pelo ArchUnit (`java.sql..`, `javax.sql..`, `java.io.ObjectInputStream`). Volta a ser SpotBugs por ticket se a biblioteca ganhar banco.
Exemplo: Ler as regras do `GET /v1/regras` com `ObjectInputStream` reprova no teste de arquitetura.
Confere: R266 (Java)

### R67. Construtor não chama método que pode ser sobrescrito
Nasce de: JV5 (adotado)
Por quê: A subclasse veria o objeto pela metade. Custa uma linha: as classes de valor já são `final`.
Exemplo: Construtor de `FilaDeEnvio` que chama `iniciar()` não final reprova.
Confere: R267 (Java)

### R68. Objeto se compara com `equals`
Nasce de: JV6 (adotado)
Por quê: `==` entre dois códigos de busca iguais dá falso só às vezes, e o caso de paridade com a biblioteca Node falharia sem padrão.
Exemplo: `codigoRecebido == codigoEsperado` reprova.
Confere: R268 (Java)

## Cobertura dos princípios

| Princípio | Decisão | Onde ou por quê |
|---|---|---|
| E1 | adaptado | R1, R2, R102, R202, R3, R103, R4 |
| E2 | adaptado | R5, R105, R205 |
| E3 | adaptado | R6, R7, R107, R207, R108, R9, R109, R209, R10 |
| E4 | adaptado | R11, R111, R211, R12, R112, R212, R13, R113, R213, R14, R114, R214, R15, R16, R116, R216 |
| E5 | adaptado | R17, R117, R217, R18 |
| E6 | adaptado | R19, R20, R120, R220, R21, R22, R122, R222 |
| E7 | adotado | R23 |
| E8 | adaptado | R24, R124, R224 |
| P1 | adotado | R26, R126, R226, R27 |
| P2 | adotado | R28 |
| P3 | adotado | R29, R129, R229, R30, R230, R131 |
| P4 | adaptado | R32, R132, R232 |
| P5 | adaptado | R33, R34, R134, R234, R35, R135, R235, R36, R136, R236, R37 |
| P6 | adaptado | R38, R39 |
| P7 | adotado | R40, R140, R240, R41 |
| P8 | adaptado | R42, R142, R242, R43, R143, R243 |
| P9 | adaptado | R44, R45 |
| S | adotado | R46 |
| O | adaptado | R47, R147, R247, R48 |
| L | adotado | R49, R149, R249 |
| I | adaptado | R50 |
| D | adaptado | R51, R151, R251, R52 |

## Práticas da linguagem

| Prática | Decisão | Onde ou por quê |
|---|---|---|
| RS1 | adotado | R53 |
| RS2 | adotado | R54 |
| RS3 | adotado | R55 |
| RS4 | adotado | R56 |
| RS5 | adotado | R57 |
| RS6 | afastado | `missing_debug_implementations` só olha tipo que sai do crate; num binário de um crate só, com tudo `pub(crate)`, nunca dispara, e regra que nunca reprova não entra. Volta por ticket se nascer um crate de biblioteca. |
| TS1 | adotado | R158 |
| TS2 | adotado | R159 |
| TS3 | adaptado | R160 |
| TS4 | adotado | R161 |
| TS5 | adotado | R162 |
| JV1 | adotado | R263 |
| JV2 | adotado | R264 |
| JV3 | adotado | R265 |
| JV4 | adaptado | R266 |
| JV5 | adotado | R267 |
| JV6 | adotado | R268 |

## Conferências

Cada linha é uma entrada de `docs/regras-de-codigo.json`. **Ligada** roda hoje. **Em espera** é a
conferência que precisa de uma pasta que ainda não existe: hoje a entrada é um `comando` que passa
enquanto o manifesto do subprojeto não existe (`Cargo.toml`, `package.json` ou `pom.xml`, na raiz ou
numa pasta da raiz) e reprova assim que ele aparece. A conferência de verdade já está escrita no campo
`depois` da entrada; a coluna *Conferência* a resume, e os nomes dos lints e a linha de comando
completa estão no `.json`.

### Conferências em espera

- **Antes de criar o manifesto de um subprojeto, ligue as conferências dele:** em cada entrada em
  espera daquela linguagem, ponha o conteúdo de `depois` no lugar de `verificacao`. Pronto quando
  `sh .claude/watchdogs/rodar validar` termina em `VALIDADOR: APROVADO` com o manifesto criado.
- **Cada conferência ligada se prova com um caso que precisa reprovar e um que precisa passar**
  (RP1), citados no PR. Sem os dois, ela não conta.
- **Arquivos de apoio entram antes do manifesto**, em issues próprias se não couberem numa:
  `clippy.toml`, `deny.toml`, `rust-toolchain.toml`, as regras de `docs/regras-de-codigo/ast-grep/`
  (copiadas de `.claude/watchdogs/modelos/ast-grep/`, com os marcadores trocados) e os comandos de
  `docs/regras-de-codigo/comandos/`. Nenhum deles dispara a espera.
- **Marcado como "a escrever":** a regra ast-grep ou o comando ainda não existe no modelo do método;
  nasce na mesma fatia, com os dois casos. Até lá o revisor cobra a regra.
- **O que a fatia pode ajustar sem ticket:** a linha de comando (flag, versão, caminho) quando a prova
  mostrar que a escrita aqui não roda, com a mudança citada no PR. O que a regra exige só muda por
  ticket.
- **`MONITORA_BASE`** é a branch de onde a issue saiu (a integração, na orquestração); sem ela, os
  comandos comparam com `origin/main`.

| ID | Linguagem | Hoje | Conferência |
|---|---|---|---|
| R1 | todas | ligada | `termo-evitado` |
| R2 | Rust | em espera | `lint-cobre`: 3 em `Cargo.toml`, `clippy.toml` |
| R3 | Rust | em espera | `ast-grep`: `parametro-de-tipo-sem-nome.yml`, `lifetime-sem-nome.yml` (a escrever) |
| R4 | todas | ligada | `revisor` |
| R5 | Rust | em espera | `lint-cobre`: 4 em `Cargo.toml`, `clippy.toml` |
| R6 | todas | ligada | `revisor` |
| R7 | Rust | em espera | `lint-cobre`: 3 em `Cargo.toml`, `clippy.toml` |
| R9 | Rust | em espera | `comando`: `cargo test` |
| R10 | todas | ligada | `revisor` |
| R11 | Rust | em espera | `ast-grep`: `erro-sem-tipo.yml` |
| R12 | Rust | em espera | `lint-cobre`: 5 em `Cargo.toml`, `clippy.toml` |
| R13 | Rust | em espera | `ast-grep`: `catch-vazio.yml` |
| R14 | Rust | em espera | `lint-cobre`: 2 em `Cargo.toml`, `clippy.toml` |
| R15 | todas | ligada | `revisor` |
| R16 | Rust | em espera | `comando`: `cargo clippy` |
| R17 | Rust | em espera | `lint-cobre`: 1 em `Cargo.toml`, `clippy.toml` |
| R18 | todas | ligada | `revisor` |
| R19 | todas | ligada | `todo-sem-issue` |
| R20 | Rust | em espera | `ast-grep`: `codigo-comentado.yml` (a escrever) |
| R21 | todas | ligada | `revisor` |
| R22 | Rust | em espera | `lint-cobre`: 3 em `Cargo.toml`, `clippy.toml` |
| R23 | todas | ligada | `comando`: `npx jscpd@5.4.2` |
| R24 | Rust | em espera | `ast-grep`: `numero-solto.yml` (a escrever) |
| R26 | Rust | em espera | `lint-cobre`: 1 em `Cargo.toml`, `clippy.toml` |
| R27 | todas | ligada | `revisor` |
| R28 | todas | ligada | `revisor` |
| R29 | Rust | em espera | `ast-grep`: `ambiente-so-na-montagem.yml`, `relogio-e-acaso-entram.yml` |
| R30 | Rust | em espera | `lint-cobre`: 4 em `Cargo.toml`, `clippy.toml` |
| R32 | Rust | em espera | `ast-grep`: `sentido-das-chamadas.yml` (a escrever) |
| R33 | todas | ligada | `teste-cobre-risco` |
| R34 | Rust | em espera | `ast-grep`: `teste-sem-afirmacao.yml`, `afirmacao-trivial.yml`, `teste-desligado.yml` |
| R35 | Rust | em espera | `comando`: `sh docs/regras-de-codigo/comandos/testes-apagados.sh` (a escrever) |
| R36 | Rust | em espera | `comando`: `git diff` |
| R37 | todas | ligada | `revisor` |
| R38 | todas | em espera | `comando`: `sh docs/regras-de-codigo/comandos/refactor-sem-teste.sh` (a escrever) |
| R39 | todas | ligada | `revisor` |
| R40 | Rust | em espera | `comando`: `cargo machete` |
| R41 | todas | ligada | `revisor` |
| R42 | Rust | em espera | `comando`: `cargo fmt` |
| R43 | Rust | em espera | `comando`: `cargo deny` |
| R44 | todas | ligada | `mensagem-de-commit` |
| R45 | todas | em espera | `comando`: `sh docs/regras-de-codigo/comandos/suite-por-commit.sh` (a escrever) |
| R46 | todas | ligada | `revisor` |
| R47 | Rust | em espera | `lint-cobre`: 2 em `Cargo.toml`, `clippy.toml` |
| R48 | todas | ligada | `revisor` |
| R49 | Rust | ligada | `teste-de-contrato-por-port` |
| R50 | todas | ligada | `revisor` |
| R51 | Rust | em espera | `ast-grep`: `dominio-sem-infra.yml` |
| R52 | Rust | em espera | `ast-grep`: `tipo-de-infra-na-interface.yml` (a escrever) |
| R53 | Rust | em espera | `lint-cobre`: 1 em `Cargo.toml`, `clippy.toml` |
| R54 | Rust | em espera | `lint-cobre`: 7 em `Cargo.toml`, `clippy.toml` |
| R55 | Rust | em espera | `comando`: `cargo deny` |
| R56 | Rust | em espera | `comando`: `cargo metadata` |
| R57 | Rust | em espera | `lint-cobre`: 4 em `Cargo.toml`, `clippy.toml` |
| R102 | TypeScript | em espera | `lint-cobre`: 2 em `eslint.config.js` |
| R103 | TypeScript | em espera | `ast-grep`: `parametro-de-tipo-sem-nome.yml` |
| R105 | TypeScript | em espera | `lint-cobre`: 3 em `eslint.config.js` |
| R107 | TypeScript | em espera | `lint-cobre`: 11 em `eslint.config.js`, `tsconfig.json` |
| R108 | TypeScript | em espera | `ast-grep`: `afirmacao-dupla.yml` |
| R109 | TypeScript | em espera | `comando`: `npm test` |
| R111 | TypeScript | em espera | `lint-cobre`: 1 em `eslint.config.js` |
| R112 | TypeScript | em espera | `lint-cobre`: 2 em `eslint.config.js` |
| R113 | TypeScript | em espera | `ast-grep`: `catch-vazio.yml`, `promessa-engolida.yml` |
| R114 | TypeScript | em espera | `lint-cobre`: 2 em `eslint.config.js` |
| R116 | TypeScript | em espera | `comando`: `npx eslint` |
| R117 | TypeScript | em espera | `lint-cobre`: 3 em `eslint.config.js` |
| R120 | TypeScript | em espera | `ast-grep`: `codigo-comentado.yml` (a escrever) |
| R122 | TypeScript | em espera | `lint-cobre`: 1 em `eslint.config.js` |
| R124 | TypeScript | em espera | `lint-cobre`: 1 em `eslint.config.js` |
| R126 | TypeScript | em espera | `comando`: `npx knip` |
| R129 | TypeScript | em espera | `ast-grep`: `efeito-global-no-dominio.yml`, `ambiente-so-na-montagem.yml` |
| R131 | TypeScript | em espera | `ast-grep`: `fetch-so-no-modulo-de-chamadas.yml` (a escrever) |
| R132 | TypeScript | em espera | `comando`: `depcruise` |
| R134 | TypeScript | em espera | `ast-grep`: `teste-sem-afirmacao.yml`, `afirmacao-trivial.yml`, `teste-desligado.yml` |
| R135 | TypeScript | em espera | `comando`: `sh docs/regras-de-codigo/comandos/testes-apagados.sh` (a escrever) |
| R136 | TypeScript | em espera | `comando`: `npx stryker` |
| R140 | TypeScript | em espera | `comando`: `npx knip` |
| R142 | TypeScript | em espera | `comando`: `npx prettier` |
| R143 | TypeScript | em espera | `ast-grep`: `biblioteca-excluida.yml` (a escrever) |
| R147 | TypeScript | em espera | `lint-cobre`: 1 em `eslint.config.js` |
| R149 | TypeScript | em espera | `lint-cobre`: 1 em `tsconfig.json` |
| R151 | TypeScript | em espera | `ast-grep`: `dominio-sem-infra.yml` |
| R158 | TypeScript | em espera | `lint-cobre`: 1 em `tsconfig.json` |
| R159 | TypeScript | em espera | `lint-cobre`: 2 em `tsconfig.json` |
| R160 | TypeScript | em espera | `lint-cobre`: 6 em `eslint.config.js` |
| R161 | TypeScript | em espera | `lint-cobre`: 5 em `eslint.config.js` |
| R162 | TypeScript | em espera | `lint-cobre`: 2 em `eslint.config.js` |
| R202 | Java | em espera | `lint-cobre`: 12 em `checkstyle.xml` |
| R205 | Java | em espera | `lint-cobre`: 6 em `checkstyle.xml`, `pmd.xml` |
| R207 | Java | em espera | `lint-cobre`: 1 em `pom.xml` |
| R209 | Java | em espera | `comando`: `mvn -B` |
| R211 | Java | ligada | `revisor` |
| R212 | Java | em espera | `lint-cobre`: 8 em `pom.xml`, `pmd.xml` |
| R213 | Java | em espera | `ast-grep`: `catch-vazio.yml`, `optional-get-direto.yml` |
| R214 | Java | ligada | `revisor` |
| R216 | Java | em espera | `comando`: `mvn -B` |
| R217 | Java | em espera | `lint-cobre`: 4 em `pmd.xml`, `pom.xml` |
| R220 | Java | em espera | `ast-grep`: `codigo-comentado.yml` (a escrever) |
| R222 | Java | em espera | `lint-cobre`: 2 em `checkstyle.xml` |
| R224 | Java | em espera | `lint-cobre`: 1 em `checkstyle.xml` |
| R226 | Java | em espera | `comando`: `mvn test (ArchUnit)` |
| R229 | Java | em espera | `ast-grep`: `injecao-por-campo.yml` |
| R230 | Java | em espera | `lint-cobre`: 3 em `pom.xml` |
| R232 | Java | em espera | `comando`: `mvn test (ArchUnit)` |
| R234 | Java | em espera | `ast-grep`: `teste-sem-afirmacao.yml`, `afirmacao-trivial.yml`, `teste-desligado.yml` |
| R235 | Java | em espera | `comando`: `sh docs/regras-de-codigo/comandos/testes-apagados.sh` (a escrever) |
| R236 | Java | em espera | `comando`: `mvn -B` (a escrever) |
| R240 | Java | em espera | `lint-cobre`: 2 em `pom.xml` |
| R242 | Java | em espera | `comando`: `mvn -B` |
| R243 | Java | em espera | `comando`: `mvn test (ArchUnit)` |
| R247 | Java | em espera | `lint-cobre`: 1 em `pom.xml` |
| R249 | Java | em espera | `lint-cobre`: 1 em `pom.xml` |
| R251 | Java | em espera | `ast-grep`: `dominio-sem-infra.yml` |
| R263 | Java | em espera | `lint-cobre`: 2 em `pmd.xml` |
| R264 | Java | em espera | `lint-cobre`: 2 em `pom.xml`, `pmd.xml` |
| R265 | Java | em espera | `lint-cobre`: 3 em `pom.xml`, `pmd.xml` |
| R266 | Java | em espera | `comando`: `mvn test (ArchUnit)` |
| R267 | Java | em espera | `lint-cobre`: 1 em `pmd.xml` |
| R268 | Java | em espera | `lint-cobre`: 2 em `pom.xml`, `pmd.xml` |

## Java

As regras e conferências de Java valem para a biblioteca Java e são **revistas antes do primeiro merge
de código Java**: o ticket de revisão confere as versões das ferramentas, o Java mínimo (11, sem
`record` nem `sealed`), em quais JDKs a suíte roda e cada conferência `2xx` em espera. Enquanto
`biblioteca-java/pom.xml` não existir, nenhuma delas roda.

## Como mudar

Regra nova ou mudada passa por ticket no [Mapa: regras de código](https://github.com/stacklabs3/monitora-ai/issues/40)
ou num mapa novo. Contradição entre uma regra e uma ADR, ou entre uma regra e o que o código precisa,
se aponta por escrito na issue; ninguém a resolve calado no diff. ID de regra não se reusa.
