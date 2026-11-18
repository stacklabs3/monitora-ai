# Restrições para as regras de código com agentes de IA

Ticket: [Restrições para as regras](https://github.com/stacklabs3/monitora-ai/issues/41).
Consulta: **2026-11-18**. Evidência para limites verificáveis: esta nota não escolhe ferramenta nem
decide princípio.

Cenário: 1 pessoa mantém e agentes escrevem o código. A pessoa domina TypeScript/Node e Java; Rust é
novo para ela e é a linguagem do servidor (2 GB, US$ 15/mês, dono único). A biblioteca Node.js 20+ se
liga ao pino de aplicações em produção de outro produto. A biblioteca Java vem depois da primeira
versão.

Convenção: **Fato** é o que a fonte diz, em paráfrase. **Inferência** é leitura minha para este
cenário. **[confirmar]** marca o que ficou sem fonte primária lida ou sem teste. As fontes numeradas
`[F1]`, `[F2]`... estão no fim.

## Resumo

- A IA acelera menos do que se sente e desestabiliza a entrega: DORA liga a adoção a mais
  instabilidade em 2024 e em 2025, e a METR mediu 19% mais lentidão onde os desenvolvedores acreditavam
  em 20% de ganho. Os dados de fim de 2025 da METR apontam para ganho, mas a própria METR os considera
  pouco confiáveis.
- O tamanho da mudança é a alavanca mais bem sustentada para 1 revisor: Google trata 100 linhas como
  razoável e 1.000 como demais; SmartBear/Cisco aponta 200 a 400 linhas, menos de 500 por hora.
- **Não achei estudo que meça revisão feita por quem não domina a linguagem.** A evidência vizinha
  (familiaridade com o arquivo, aprendizado com IA) aponta para perda real; o tamanho do efeito em Rust
  é desconhecido.
- O compilador de Rust cobre memória e corrida de dados em código seguro. Pânico, deadlock, vazamento,
  overflow em release e erro de lógica ficam de fora, e são os alvos naturais de regra e teste.
- Dependência inventada é recorrente e repetível; em npm, conta tomada é ataque real e recente. npm 12
  e cargo-deny já oferecem bloqueios verificáveis.
- Biblioteca dentro de aplicação alheia tem princípio escrito (OpenTelemetry). No pino há um ponto a
  testar: o código-fonte sugere que a morte do worker de transporte pode derrubar o processo hospedeiro.
- Para adiar regras de Java a evidência é **fraca**: há argumento de autoridade, não medição.

## 1. Efeito de IA na entrega e na qualidade

### Fatos

| Fonte | Desenho | Resultado |
| --- | --- | --- |
| DORA 2024 [F1] | Pesquisa anual, associação estimada | A cada +25% de adoção: throughput −1,5%, estabilidade −7,2%; documentação +7,5%, qualidade de código +3,4%, velocidade de revisão +3,1%. |
| DORA 2025 [F2] | Quase 5.000 respostas, mais de 100 h qualitativas, 13/jun a 21/jul/2025 | 90% usam IA; mais de 80% creem ganhar produtividade; 30% confiam pouco ou nada no código. Throughput passa a subir; instabilidade continua subindo. |
| METR 2025 [F3] | Ensaio randomizado: 16 devs experientes, 246 tarefas, repositórios que já conheciam | Com IA, +19% de tempo (IC +2% a +39%). Previam −24%; depois acreditavam em −20%. |
| METR 2026 [F4] | 57 devs, 143 repositórios, 800+ tarefas | Retornantes −18% (IC −38% a +9%); novos −4% (IC −15% a +9%). |
| Shen e Tamkin 2026 [F5] | Randomizado, n=52, biblioteca Python nova (Trio) | Com IA, nota 17% menor em teste de compreensão (d=0,738; p=0,010), sem ganho de tempo significativo; o artigo aponta prejuízo em conceito, leitura de código e depuração. |
| Perry et al., CCS 2023 [F6] | 47 participantes, 5 tarefas de segurança, Python/JS/C | Com assistente, solução insegura mais frequente em 4 de 5 tarefas e mais confiança de ter escrito código seguro. |
| Pearce et al., IEEE S&P 2022 [F7] | 89 cenários, 1.689 programas, Copilot | Cerca de 40% vulneráveis. |
| Veracode 2025 [F8] | Fornecedor; 100+ modelos; Java, Python, C#, JS | 45% das amostras falham em teste de segurança: Java 72%, C# 45%, JS 43%, Python 38%. XSS falha em 86%. Segurança estável apesar de modelos maiores. |
| BaxBench [F9] | Pré-print; 392 tarefas de backend | Melhor modelo com 62% de correção; cerca de metade dos programas corretos é explorável; pior em frameworks menos populares. |

- A METR declara que o estudo de 2026 dá sinal pouco confiável: desenvolvedores recusaram trabalhar sem
  IA e 30% a 50% retiveram tarefas. Ela acha que o ganho atual é provavelmente maior e trata os números
  como prováveis limites inferiores [F4].
- DORA 2024 levanta a hipótese de que mudanças maiores explicam a queda [F1]. DORA 2025 repete a ideia
  (lotes maiores são mais difíceis de revisar) e relata, com alta certeza, que o benefício da IA em
  desempenho de produto depende de trabalhar em lotes pequenos, que também passam a reduzir atrito; o
  ganho de eficácia individual cai um pouco nesses times [F2].
- DORA mede instabilidade por duas taxas: falha de mudança e retrabalho [F2].

### O que muda quando o revisor não domina a linguagem

**Fato:** a busca não achou estudo que isole essa variável **[confirmar: busca não exaustiva]**. O mais
próximo:

- Em 1,5 milhão de comentários na Microsoft, quem já revisou o arquivo teve 65% a 71% de comentários
  úteis, contra 32% a 37% de quem revisava pela primeira vez. Novatos na empresa ficam no pior nível nos
  primeiros 3 meses e estabilizam após cerca de 1 ano [F13].
- Na Microsoft, entender o código e a mudança é o ponto central da revisão [F14].

**Inferência:**

- Os estudos vizinhos medem conhecer *o arquivo* ou *uma biblioteca*, não a linguagem. Servem de
  direção, não de número.
- O risco tem duas faces em Rust: revisar sem ver o defeito e sentir segurança (o viés visto em [F3] e
  [F6]). Quanto menos a pessoa consegue ler, mais a verificação precisa ser executável: teste,
  compilador, análise estática, injeção de falha.
- Em TypeScript e Java a revisão humana pode pesar mais; em Rust, ela confere mais o comportamento e o
  contrato do que o idioma.
- Java 72% e JS 43% [F8] vêm de tarefas de benchmark do fornecedor, não de um repositório real. Rust não
  está nos dados da Veracode lidos.

**Limites:** DORA é pesquisa com times e associação, não causa. METR estuda experts em repositórios
próprios, o oposto do caso Rust. Modelos dos estudos [F6] e [F7] são antigos. Li só o resumo público da
Veracode, não o relatório completo.

## 2. Quanto um humano revisa bem

### Fatos

| Fonte | Número |
| --- | --- |
| SmartBear/Cisco [F10] [F11] | 2.500 revisões, 3,2 milhões de linhas, 10 meses. Orientação: 200 a 400 linhas por vez, abaixo de 500 linhas/hora, sessão de até 60 min; 200 a 400 linhas em 60 a 90 min achariam 70% a 90% dos defeitos. |
| Google eng-practices [F12] | 100 linhas costumam ser razoáveis; 1.000 costumam ser demais; 200 linhas em 50 arquivos também seria demais. A decisão é do revisor; não há limite rígido. Refatoração gerada por ferramenta de total confiança pode ser exceção. |
| Google eng-practices, velocidade [F12b] | Responder em no máximo 1 dia útil. Mudança grande: pedir divisão. |
| Sadowski et al., Google [F15] | 9 milhões de mudanças: mediana de 24 linhas, cerca de 90% com menos de 10 arquivos, mais de 35% com 1 arquivo; geralmente 1 revisor; mais de 80% com no máximo 1 iteração; mediana de revisão abaixo de 4 h; o revisor mediano vê 4 mudanças por semana. |
| Bosu et al., Microsoft [F13] | Quanto mais arquivos na mudança, menor a proporção de comentários úteis. |
| Kemerer e Paulk, IEEE TSE 2009 [F16] | Revisão a 200 linhas/hora ou menos seria eficaz. **[confirmar: só vi o resumo em fonte secundária]** |

SmartBear vende ferramenta de revisão e o estudo não é revisado por pares. A própria página mistura
60 min e 60 a 90 min [F10]. Não li o livro com os dados.

### Inferência para 1 revisor

- Teto de uma sessão: 60 min a 500 linhas/h dá **500 linhas**; a 200 linhas/h, **200 linhas**. É conta
  sobre orientações, não medição.
- Esses números vêm de quem conhece a linguagem. Para Rust, o extremo inferior é o mais defensável, e
  mesmo ele não tem medição própria.
- Google tem mediana de 24 linhas por descrever o que acontece lá, não por ser meta.
- Agente muda a oferta, não a capacidade: o gargalo passa a ser quantas linhas por dia o único revisor
  absorve. Não há estudo de 1 revisor para vários agentes **[confirmar]**.

## 3. Rust: o que o compilador garante e o que não garante

### Fatos

| Tema | O que vale | Fonte |
| --- | --- | --- |
| Corrida de dados | Rust seguro garante ausência. | [F17] |
| Condição de corrida geral | Não é impedida. | [F17] |
| Deadlock | Considerado seguro. `Mutex::lock` duplicado na mesma thread não retorna: pode travar ou entrar em pânico. | [F18] [F19] [F21] |
| Vazamento | Memória e recursos podem vazar em código seguro (`Rc` em ciclo, `mem::forget`). | [F18] [F19] [F22] [F23] |
| Overflow | Em dev há pânico; em `--release` o padrão é `overflow-checks = false` e o valor dá a volta. A linguagem trata isso como erro do programa. | [F19] [F24] [F25] |
| Pânico | Por padrão desenrola a pilha; `panic = "abort"` encerra sem limpeza. Mutex fica envenenado se o dono entra em pânico. | [F21] [F25] [F26] |
| Erro de lógica | Pode gerar pânico, resultado errado, aborto ou não terminar, sem ser comportamento indefinido. | [F19] |
| `unsafe` | Libera cinco operações e não desliga o borrow checker. O livro pede blocos pequenos. Miri só vê o caminho executado. | [F20] |
| `unwrap`/`expect` | Aceitos em exemplo, protótipo e teste. Para falha esperada, como dado malformado, o padrão é `Result`. | [F27] |
| Bloqueio em async | Operação bloqueante trava a thread e os demais tasks dela. `spawn_blocking` usa outro pool, com limite padrão muito alto, fila ao lotar e sem aborto depois de iniciado. | [F28] [F29] |
| Lock e `.await` | `std::sync::Mutex` costuma ser preferível em async, mas mantê-lo através de `.await` pode gerar deadlock; o Mutex do Tokio serve a esse caso. | [F30] |
| Pânico em task Tokio | É capturado e volta como `JoinError` para quem aguarda; soltar o `JoinHandle` perde o resultado. | [F31] |

### Queda da Cloudflare, 18/nov/2025 (caso confirmado) [F32]

- A mudança de permissão em banco às 11:05 UTC fez uma consulta sem filtro por banco devolver colunas
  duplicadas; o arquivo de features dobrou e passou do limite de 200 (uso normal, cerca de 60).
- O proxy FL2, em Rust, entrou em pânico com `called Result::unwrap() on an Err value`, gerando 5xx. O
  proxy antigo não deu erro, mas produziu score de bot errado.
- Impacto principal resolvido às 14:30; tudo normal às 17:06. A Cloudflare a chamou de sua pior queda
  desde 2019.
- Ações: tratar arquivo interno como entrada de usuário, mais kill switches, impedir que core dumps
  esgotem recursos e revisar modos de falha dos módulos.

**Inferência:** o `unwrap` foi o último elo, não a causa única. Proibi-lo sozinho deixaria o arquivo
inválido passar: faltou também validar a entrada interna e definir o que fazer quando o limite estoura.
No caso do proxy antigo, não houve pânico e o resultado saiu errado em silêncio.

### Adoção de Rust

- Google, 2022, 1.000+ desenvolvedores, autodeclarado: um terço fica tão produtivo quanto em outras
  linguagens em até 2 meses; mais de 50% em até 4 meses; mais de 2/3 sentem confiança para contribuir em
  até 2 meses; mais da metade acha o código fácil de revisar; build lento é a maior queixa [F33].
- Android, 2025: mudanças em Rust com cerca de 25% menos tempo em revisão, 20% menos revisões e rollback
  cerca de 4× menor que C++ em mudanças médias e grandes. Cerca de 5 milhões de linhas. A densidade de
  0,2 vulnerabilidade por milhão de linhas vem de **um** caso (CVE-2025-48530) e a comparação com C/C++ usa base histórica [F34].
- Rust Survey 2024: 7.310 respostas completas; 53% se dizem produtivos; 20% só escrevem programas
  simples [F35]. A edição 2025 (7.156 respostas) não traz métrica de tempo até a produtividade [F36].

**Inferência:** os dados de Google e Android descrevem engenheiros de uma grande empresa, com colegas
experientes e revisão por pares. Não valem como prazo para uma pessoa só que dirige agentes.

## 4. Dependências inventadas e ataques à cadeia de suprimentos

### Fatos: alucinação de pacotes

- USENIX Security 2025 [F37]: 16 modelos, 576.000 amostras, 2,23 milhões de pacotes citados, 440.445
  (19,7%) inexistentes, 205.474 nomes únicos. Modelos comerciais 5,2%, abertos 21,7%; Python 15,8%,
  JavaScript 21,3%. Ao repetir o prompt 10 vezes, 43% voltam em todas e 39% em nenhuma; 58% voltam mais
  de uma vez, o que torna o nome registrável por um atacante.
- Krishna et al., pré-print [F38]: média de 24,74% em Rust, 23,14% em Python e 14,73% em JavaScript. O
  artigo sugere como causa a escassez de código Rust e nota o espaço grande de nomes livres em crates.io.

### Fatos: ataques

- **Shai-Hulud, set/2025:** worm em npm que roubava credenciais e se republicava; mais de 500 pacotes
  [F39] [F40].
- **axios, 31/mar/2026:** `1.14.1` e `0.30.4` publicados com conta do mantenedor tomada, com
  `plain-crypto-js@4.2.1`; cerca de 3 horas no ar, das 00:21 às 03:15 UTC. Quem tinha versão travada e
  não instalou na janela não foi afetado; faixas semver e `npx` eram o risco [F41] [F42].
- CISA recomenda, entre outros, `ignore-scripts=true`, `min-release-age=7`, MFA resistente a phishing e
  fixar versões [F42].
- **crates.io, set/2025:** `faster_log` (7.181 downloads) e `async_println` (1.243), typosquatting que
  rodava em execução e buscava chaves de criptomoedas nos logs [F43].

### Fatos: o que as ferramentas oferecem

| Ferramenta | Recurso | Limite |
| --- | --- | --- |
| cargo-deny [F44] [F45] [F46] | `licenses`, `bans`, `advisories`, `sources`. `bans.allow` não vazio nega o que está fora da lista; `allow-build-scripts` restringe `build.rs`; `unknown-registry`/`unknown-git` podem ser `deny`. | Padrão de fonte desconhecida é `warn`. A doc avisa que o exame em compilação não protege de código ativamente malicioso. `advisories` só conhece o que foi publicado. |
| Cargo [F47] [F48] [F49] | `--locked` falha se `Cargo.lock` faltar ou precisar mudar; `registry.global-min-publish-age` (padrão `0`). | `build.rs` é compilado e executado no build. A idade mínima vale a partir de 1.100 **[confirmar disponibilidade na versão estável em uso e efeito exato no resolvedor]**. |
| npm 12 (8/jul/2026) [F50] [F51] | Scripts de ciclo de vida de dependências bloqueados por padrão, salvo `allowScripts`; `allow-git` e `allow-remote` passam a `none`. | Vale para quem roda npm 12. |
| npm [F51] [F52] [F53] | `min-release-age` (desde 11.10.0; padrão nulo); `npm ci` falha se lockfile e manifesto divergem; `npm audit signatures` verifica assinatura e procedência. | Assinatura válida não prova pacote benigno (inferência: axios foi publicado com credencial legítima). |
| npm, publicação [F40] [F54] | Trusted publishing; tokens clássicos revogados; sessão de 2 h; token granular de escrita com até 90 dias. | Protege a publicação da nossa biblioteca, não o consumo. |

**Inferência:**

- Nome inventado e inexistente quebra a instalação; o perigo é o nome já registrado por alguém. Lista de
  permissão de dependências cobre os dois casos sem depender de o revisor reconhecer o nome.
- Espera mínima teria coberto a janela de 3 horas do axios, mas não os crates de 2025, que ficaram meses
  publicados.
- Nossas regras de npm protegem nosso repositório e CI. O `npm install` do cliente segue a política dele;
  cada dependência de produção da biblioteca vira superfície na aplicação alheia.

## 5. Biblioteca dentro da aplicação alheia

### Fatos: OpenTelemetry [F55]

- A especificação parte de que o usuário prefere perder telemetria a ter o comportamento da aplicação
  alterado.
- Implementações não podem lançar exceção não tratada em execução. Podem falhar rápido só na
  inicialização, nunca depois por configuração dinâmica recebida.
- Falha de exportação, como destino inalcançável, não vira exceção. Tarefas em segundo plano rodam sob
  tratador global e não devem morrer de vez por erro interno. Callbacks externos devem ser tratados como
  capazes de lançar.
- Erro suprimido deve ser registrado; autodiagnóstico é encorajado, inclusive tempo de exportação e
  tamanho de fila. O usuário pode trocar o tratador padrão.

### Fatos: pino e Node

- O pino recomenda transformar e transmitir logs em thread ou processo separado; transports v7+ rodam
  em Worker Thread e são assíncronos, salvo `sync: true` [F56].
- Perda documentada: sem `close()` correto, linhas se perdem; `process.exit()` antes de o transporte
  subir perde logs; em modo assíncrono, os últimos dados em buffer podem sumir numa falha de sistema
  [F56] [F57].
- `mixin` é chamado em cada log e precisa retornar de forma síncrona [F58].
- `thread-stream`: buffer compartilhado padrão de 4 MiB; pendências ficam na memória da thread principal;
  acima de `MAX_STRING_LENGTH` força drenagem síncrona; escrever depois da morte do worker emite `error`
  [F59].
- `pino.transport` não registra ouvinte de `error` no stream em `lib/transport.js`; o filtro de erro em
  `tools.js` fica em `buildSafeSonicBoom`, outro caminho [F60]. A chamada de escrita em `proto.js` ignora
  o retorno de `write` [F60].
- No Node, `error` sem ouvinte lança a exceção e encerra o processo [F61]. Uma exceção não capturada em
  worker encerra só o worker, com evento `error` na thread pai [F62].
- O relato [F63] mostra `Unhandled 'error' event` com `the worker has exited` em `ThreadStream`.

### Inferência

- **Hipótese a testar [confirmar]:** se um transporte nosso morrer e ninguém ouvir `error`, a próxima
  escrita pode derrubar a aplicação hospedeira. Li o código, não executei. O teste é matar o worker sob
  carga e observar o processo.
- Trabalho em `mixin`, hook ou serialização roda no caminho do log do cliente; é onde cabe medir atraso.
- Se o destino travar, a memória pendente na thread principal pode crescer muito antes de qualquer
  limite útil **[confirmar com teste]**. Fila própria limitada, com descarte contado, é a forma coerente
  com a especificação de OpenTelemetry.
- Perda de log é aceitável por esse princípio, desde que contada e visível.

## 6. Adiar regras de bibliotecas ainda não lançadas

### Fatos

- Fowler descreve YAGNI como não construir capacidade para necessidade presumida, com custos de construir,
  atrasar, carregar e reparar. Ele exclui do YAGNI o esforço de tornar o software fácil de mudar, e exige
  refatoração, testes automáticos e entrega contínua [F64].
- Nygard: ADR registra uma decisão com contexto, decisão, status e consequências; decisões chegam ao
  longo do tempo; status pode ser proposta, aceita, obsoleta ou substituída [F65]. Ele não trata de adiar
  regras.

### Força da evidência: fraca

Não achei estudo empírico sobre adiar regras por linguagem até existir código **[confirmar: busca não
exaustiva]**. YAGNI fala de funcionalidade; aplicá-lo a regras é analogia.

**Inferência:**

- A favor de adiar: regra de Java sem código Java não tem exemplo nem teste que a confronte, e carrega
  custo de manutenção.
- Contra adiar tudo: princípios independentes de linguagem já têm fonte (a especificação de
  OpenTelemetry é escrita para várias linguagens), e Java aparece com a pior taxa em [F8].
- Um meio-termo verificável é registrar o adiamento com **gatilho**, como "antes do primeiro merge de
  código Java", em ADR ou ticket.

## Limites verificáveis que a evidência sustenta

São candidatos para o grilling, com faixas. Nenhum valor aqui é decisão.

| # | Limite candidato | Como verificar | Faixa ou referência | Força |
| --- | --- | --- | --- | --- |
| L1 | Tamanho máximo de PR, excluindo lockfile e gerados | Contagem do diff no CI | 100 (Google) a 200–400 (SmartBear); 1.000 já é demais [F10] [F12] | Média |
| L2 | Máximo de arquivos por PR | Contagem do diff | 90% das mudanças do Google têm menos de 10 arquivos (descritivo) [F15]; a utilidade dos comentários cai com mais arquivos [F13] | Média |
| L3 | Tempo de revisão humana por PR | Linhas ÷ taxa estimada | Até 60 min; menos de 500 linhas/h [F10] | Média-baixa (fornecedor) |
| L4 | Taxa de falha de mudança e de retrabalho acompanhadas | Reverts, hotfixes e deploys não planejados | Métricas DORA; sem meta numérica aplicável a 1 pessoa [F2] | Média |
| L5 | Comportamento de Rust provado por execução | PR sem teste ligado ao risco falha | Ver regra de riscos do projeto; motivação em [F3] [F5] [F6] | Média, indireta |
| L6 | `unwrap`, `expect`, `panic!` e indexação fora de teste, só com justificativa | Lint e busca no CI | `Result` para falha esperada [F27]; caso [F32] | Alta para o risco |
| L7 | Entrada externa **e interna** validada, com teste acima do limite | Teste com arquivo/lote maior que o limite | Caso [F32] | Alta para o risco |
| L8 | Aritmética com dado externo com overflow definido | `overflow-checks` no perfil ou métodos `checked_*` | Padrão de release não verifica [F24] [F25] | Alta |
| L9 | `unsafe` proibido ou com justificativa e bloco pequeno | Lint e contagem | [F20] [F34] | Alta |
| L10 | Sem bloqueio em async; sem lock síncrono através de `.await`; `spawn_blocking` limitado | Lint e teste de carga | [F28] [F29] [F30] | Alta |
| L11 | Teto de memória do servidor sob carga contínua | Teste de duração com medição de RSS abaixo de 2 GB | Rust não impede vazamento [F18] [F23]; valor depende do projeto | Alta para o risco |
| L12 | Dependência nova só por lista de permissão | `bans.allow`, `allowScripts`, diff do manifesto | [F37] [F38] [F44] [F50] | Alta |
| L13 | Instalação travada no CI | `cargo --locked`, `npm ci` | [F48] [F53] | Alta |
| L14 | Idade mínima de versão | `min-release-age`, `min-publish-age` | CISA cita 7 dias; janela do axios foi de 3 h [F41] [F42] | Média |
| L15 | Scripts de instalação e `build.rs` só por permissão | `allowScripts`, `allow-build-scripts` | [F42] [F45] [F50] | Alta |
| L16 | Biblioteca não derruba o hospedeiro | Teste de falha: destino fora, worker morto, callback que lança | [F55] [F59] [F61] | Alta para Node; teste pendente |
| L17 | Biblioteca tem custo limitado no caminho do log | Benchmark com orçamento por chamada e fila limitada | Princípio em [F55]; valor sem fonte **[confirmar medindo]** | Média |
| L18 | Perda de log contada e exposta | Teste confere contador de descarte | [F55] [F56] [F57] | Média |
| L19 | Regra adiada tem gatilho escrito | Ticket ou ADR com condição | [F64] [F65] | Fraca |

## Fontes

Todas consultadas em 2026-11-18. PDFs lidos por extração local de texto.

- [F1] DORA 2024: https://services.google.com/fh/files/misc/2024_final_dora_report.pdf e https://cloud.google.com/blog/products/devops-sre/announcing-the-2024-dora-report
- [F2] DORA 2025: https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf
- [F3] METR 2025: https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/ e https://arxiv.org/abs/2507.09089
- [F4] METR 2026: https://metr.org/blog/2026-02-24-uplift-update/
- [F5] Shen e Tamkin: https://arxiv.org/abs/2601.20245
- [F6] Perry et al.: https://arxiv.org/abs/2211.03622
- [F7] Pearce et al.: https://arxiv.org/abs/2108.09293
- [F8] Veracode: https://www.veracode.com/blog/genai-code-security-report/
- [F9] BaxBench: https://arxiv.org/abs/2502.11844
- [F10] SmartBear, práticas: https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/
- [F11] SmartBear, caso Cisco: https://smartbear.com/resources/case-studies/cisco-systems-collaborator/
- [F12] Google, small CLs: https://google.github.io/eng-practices/review/developer/small-cls.html
- [F12b] Google, velocidade: https://google.github.io/eng-practices/review/reviewer/speed.html
- [F13] Bosu, Greiler e Bird, MSR 2015: https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/bosu2015useful.pdf
- [F14] Bacchelli e Bird, ICSE 2013: https://sback.it/publications/icse2013.pdf
- [F15] Sadowski et al., ICSE-SEIP 2018: https://sback.it/publications/icse2018seip.pdf
- [F16] Kemerer e Paulk: https://doi.org/10.1109/TSE.2009.27 **[confirmar]**
- [F17] Rustonomicon, corridas: https://doc.rust-lang.org/nomicon/races.html
- [F18] Rustonomicon, o que unsafe faz: https://doc.rust-lang.org/nomicon/what-unsafe-does.html
- [F19] Rust Reference: https://doc.rust-lang.org/reference/behavior-not-considered-unsafe.html
- [F20] Rust Book, unsafe: https://doc.rust-lang.org/book/ch20-01-unsafe-rust.html
- [F21] `std::sync::Mutex`: https://doc.rust-lang.org/std/sync/struct.Mutex.html
- [F22] `std::mem::forget`: https://doc.rust-lang.org/std/mem/fn.forget.html
- [F23] Rust Book, ciclos: https://doc.rust-lang.org/book/ch15-06-reference-cycles.html
- [F24] Rust Book, tipos: https://doc.rust-lang.org/book/ch03-02-data-types.html
- [F25] Cargo, perfis: https://doc.rust-lang.org/cargo/reference/profiles.html
- [F26] Rust Book, panic: https://doc.rust-lang.org/book/ch09-01-unrecoverable-errors-with-panic.html
- [F27] Rust Book, quando usar panic: https://doc.rust-lang.org/book/ch09-03-to-panic-or-not-to-panic.html
- [F28] Tokio, task: https://docs.rs/tokio/latest/tokio/task/index.html
- [F29] Tokio, `spawn_blocking`: https://docs.rs/tokio/latest/tokio/task/fn.spawn_blocking.html
- [F30] Tokio, Mutex: https://docs.rs/tokio/latest/tokio/sync/struct.Mutex.html
- [F31] Tokio, JoinHandle: https://docs.rs/tokio/latest/tokio/task/struct.JoinHandle.html
- [F32] Cloudflare: https://blog.cloudflare.com/18-november-2025-outage/
- [F33] Google, Rust 2022: https://opensource.googleblog.com/2023/06/rust-fact-vs-fiction-5-insights-from-googles-rust-journey-2022.html
- [F34] Google, Android: https://blog.google/security/rust-in-android-move-fast-fix-things/
- [F35] Rust Survey 2024: https://blog.rust-lang.org/2025/02/13/2024-State-Of-Rust-Survey-results/
- [F36] Rust Survey 2025: https://blog.rust-lang.org/2026/03/02/2025-State-Of-Rust-Survey-results/
- [F37] Spracklen et al., USENIX Security 2025: https://www.usenix.org/conference/usenixsecurity25/presentation/spracklen e https://arxiv.org/abs/2406.10279
- [F38] Krishna et al.: https://arxiv.org/abs/2501.19012
- [F39] CISA, npm: https://www.cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem
- [F40] GitHub, plano npm: https://github.blog/security/supply-chain-security/our-plan-for-a-more-secure-npm-supply-chain/
- [F41] axios, post-mortem: https://github.com/axios/axios/issues/10636
- [F42] CISA, axios: https://www.cisa.gov/news-events/alerts/2026/04/20/supply-chain-compromise-impacts-axios-node-package-manager
- [F43] Rust Blog, crates maliciosos: https://blog.rust-lang.org/2025/09/24/crates.io-malicious-crates-fasterlog-and-asyncprintln/
- [F44] cargo-deny, checks: https://embarkstudios.github.io/cargo-deny/checks/index.html e https://embarkstudios.github.io/cargo-deny/checks/sources/cfg.html
- [F45] cargo-deny, bans: https://embarkstudios.github.io/cargo-deny/checks/bans/cfg.html
- [F46] cargo-deny, advisories: https://embarkstudios.github.io/cargo-deny/checks/advisories/cfg.html
- [F47] Cargo, build scripts: https://doc.rust-lang.org/cargo/reference/build-scripts.html
- [F48] Cargo, `--locked`: https://doc.rust-lang.org/cargo/commands/cargo-build.html
- [F49] Cargo, configuração: https://doc.rust-lang.org/cargo/reference/config.html
- [F50] npm, changelog: https://docs.npmjs.com/cli/v12/using-npm/changelog/
- [F51] npm 12, configuração: https://docs.npmjs.com/cli/v12/using-npm/config
- [F52] npm audit: https://docs.npmjs.com/cli/v11/commands/npm-audit
- [F53] npm ci: https://docs.npmjs.com/cli/v11/commands/npm-ci
- [F54] GitHub, tokens npm: https://github.blog/changelog/2025-12-09-npm-classic-tokens-revoked-session-based-auth-and-cli-token-management-now-available/
- [F55] OpenTelemetry, erros: https://github.com/open-telemetry/opentelemetry-specification/blob/a7b22a8d9f26c5b05afbe4d761038444e73c6d61/specification/error-handling.md
- [F56] pino, transports: https://github.com/pinojs/pino/blob/8d6927c29777882516339d9ccd509869ca3f295e/docs/transports.md
- [F57] pino, assíncrono: https://github.com/pinojs/pino/blob/8d6927c29777882516339d9ccd509869ca3f295e/docs/asynchronous.md
- [F58] pino, API: https://github.com/pinojs/pino/blob/8d6927c29777882516339d9ccd509869ca3f295e/docs/api.md
- [F59] thread-stream: https://github.com/pinojs/thread-stream/blob/8f0f058b311441ce8cc9239cb4fb7574738635bd/index.js
- [F60] pino, código: https://github.com/pinojs/pino/blob/8d6927c29777882516339d9ccd509869ca3f295e/lib/transport.js , https://github.com/pinojs/pino/blob/8d6927c29777882516339d9ccd509869ca3f295e/lib/tools.js e https://github.com/pinojs/pino/blob/8d6927c29777882516339d9ccd509869ca3f295e/lib/proto.js
- [F61] Node.js, eventos: https://nodejs.org/api/events.html
- [F62] Node.js, worker threads: https://nodejs.org/api/worker_threads.html
- [F63] pino, issue 1774: https://github.com/pinojs/pino/issues/1774
- [F64] Fowler, YAGNI: https://martinfowler.com/bliki/Yagni.html
- [F65] Nygard, ADR: https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions
