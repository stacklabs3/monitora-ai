# Opções de lint, formatador e typecheck: Rust, TypeScript e Java

Pesquisa do ticket [Pesquisar opções de lint, formatador e typecheck](https://github.com/stacklabs3/monitora-ai/issues/47),
feita em 2026-11-15. Alimenta os tickets de grilling 48, 49 e 50 do mapa de Regras de código.
**Não recomenda escolha final**: lista as opções, o que cada uma garante sozinha e o custo.

Critério do humano: **rápido de execução e baixo custo (CI incluso)**.

Escopo do Monitora AI: servidor em Rust; painel web em TypeScript (framework em aberto: Angular,
React, Svelte ou Solid); biblioteca leve para Node.js em TypeScript; biblioteca leve para Java.

Versões conferidas nos registros oficiais (npm, crates.io, Maven Central, canal estável do Rust) em
2026-11-15. Licença e atividade conferidas na API do GitHub. Afirmações de velocidade são **do
próprio fabricante**, marcadas como tal; nada foi medido neste repositório.

## Custo do CI: o que vale para todas

- O repositório `stacklabs3/monitora-ai` é **público**. Runner padrão do GitHub em repositório
  público é gratuito e não consome a cota incluída ([GitHub Actions billing][gh-billing]).
- Se ficar privado: o plano Free inclui US$ 12/mês e o Team US$ 18/mês de computação; Linux
  2-core custa US$ 0,006/min, Windows US$ 0,010/min e macOS US$ 0,062/min (≈10x o Linux)
  ([GitHub Actions billing][gh-billing]). Rodar lint em Linux é o mais barato.
- Todas as ferramentas abaixo são gratuitas e de código aberto; nenhuma tem plano pago.

## Rust (servidor)

### Opções

| Ferramenta | Versão | Licença | Quem mantém | Papel |
|---|---|---|---|---|
| rustc lints + Clippy | do toolchain, estável **1.100.0** (2026-11-09) | MIT OR Apache-2.0 | Projeto Rust (`rust-lang/rust-clippy`) | Lint |
| rustfmt | do toolchain 1.100.0 | MIT OR Apache-2.0 | Projeto Rust (`rust-lang/rustfmt`) | Formatador |
| `cargo check` / rustc | toolchain | MIT OR Apache-2.0 | Projeto Rust | Typecheck (o compilador é o typecheck) |
| `cargo-deny` | 0.20.2 | Apache-2.0 (API do GitHub) | Embark Studios | Dependências: vulnerabilidade, licença, origem, duplicata |
| `cargo-machete` | 0.9.2 | MIT | Benjamin Bouvier (`bnjbvr`) | Dependência sem uso |

Fontes: [canal estável][rust-channel], [Clippy][clippy], [crates.io cargo-deny][crate-deny],
[crates.io cargo-machete][crate-machete].

**Não há alternativa real ao Clippy e ao rustfmt.** Ambos vêm com o toolchain (`rustup component
add clippy rustfmt`); a escolha em Rust é **quais lints ligar**, não qual ferramenta.

### O que o Clippy oferece

- Mais de 800 lints em grupos: `correctness` (deny por padrão), `suspicious`, `style`, `complexity`,
  `perf` (warn por padrão), e `pedantic`, `restriction`, `nursery`, `cargo` (allow por padrão)
  ([Clippy][clippy]).
- O próprio Clippy avisa: "The `restriction` category should, *emphatically*, not be enabled as a
  whole" ([Clippy][clippy]). Regra a regra, como já faz a tabela de `rust.md`.

### Velocidade e custo no CI

- `cargo fmt --check` só lê o fonte, não compila: é o passo mais barato.
- `cargo clippy` faz a análise do compilador (equivale a um `cargo check` com lints), então custa
  o mesmo que checar o crate; o cache do diretório `target` entre execuções é o que mais reduz o
  tempo. Typecheck e lint saem **do mesmo passo**: não há typecheck separado para pagar.
- `cargo-deny` e `cargo-machete` não compilam o projeto; leem `Cargo.lock`/`Cargo.toml` e o fonte.

### O que garante sozinho (princípios e RS)

Base: tabela *Por princípio* de [rust.md](../agents/principios-de-codigo/rust.md), conferida contra
a [lista de lints do Clippy][clippy].

| Ferramenta | Princípios | Práticas RS |
|---|---|---|
| rustc + Clippy (lints ligados um a um) | E1 (`min_ident_chars`, `nonstandard_style`, `wrong_self_convention`), E2 (`too_many_lines`, `too_many_arguments`, `excessive_nesting`, `manual_let_else`), E3 parcial (`fn_params_excessive_bools`, `disallowed_types`), E4 (`let_underscore_must_use`, `unused_must_use`, `map_err_ignore`, `result_unit_err`, `allow_attributes_without_reason`), E5 (`unused_mut`), E6 (`todo`, `dbg_macro`), P1/I (`unreachable_pub`), P3/D parcial (`disallowed_methods`, `print_stdout`, `exit`), P7 (`dead_code`), L parcial (`unimplemented`) | RS1 (`unsafe_code`, `undocumented_unsafe_blocks`), RS2 (`unwrap_used`, `expect_used`, `panic`, `indexing_slicing`), RS5 (`cast_*`), RS6 (`missing_debug_implementations`) |
| rustfmt | P8 (um formatador) | — |
| `cargo-deny` | P8 (uma versão por dependência, crates proibidos), P3/D forte (`bans` com `wrappers`) | RS3 |
| `cargo-machete` | P7 (dependência sem uso) | — |
| `cargo build --locked` | — | RS4 |

Fora do alcance de qualquer uma: E7 (duplicação, precisa de `jscpd`), E8 (Clippy não tem lint de
número mágico), P4, P5, P6, P9, S, O.

## TypeScript (painel e biblioteca Node.js)

### Opções

| Ferramenta | Versão | Licença | Quem mantém | Papel |
|---|---|---|---|---|
| `typescript` (tsc) | **7.0.2** (nativo em Go); 6.0 via `@typescript/typescript6` | Apache-2.0 | Microsoft | Typecheck |
| `eslint` + `typescript-eslint` | 10.15.0 + 8.72.2 | MIT | OpenJS Foundation / equipe typescript-eslint | Lint, com regras que usam tipos |
| Biome (`@biomejs/biome`) | 2.6.8 | MIT OR Apache-2.0 | Equipe Biome (comunidade) | Lint **e** formatador, binário Rust |
| Oxlint (`oxlint`) + `oxlint-tsgolint` | 1.93.0 + 7.0.2007 | MIT | Oxc (VoidZero) | Lint, binário Rust; tipos via tsgo |
| Oxfmt (`oxfmt`) | 0.78.0 | MIT | Oxc (VoidZero) | Formatador, saída de referência do Prettier |
| Prettier | 3.10.1 | MIT | Equipe Prettier | Formatador |
| dprint | 0.64.3 | MIT | David Sherret | Formatador por plugins (alternativa menor) |

Plugins por framework do painel (versões no npm em 2026-11-15):
`@angular-eslint/eslint-plugin` 22.7.0, `eslint-plugin-react-hooks` 7.1.1,
`eslint-plugin-svelte` 3.24.1, `eslint-plugin-solid` 0.19.0. Typecheck de template:
`@angular/compiler-cli` 22.2.6 (Angular), `svelte-check` 4.7.8 (Svelte); React e Solid (JSX) se
checam com o `tsc` direto.

### Fato que pesa na escolha: TypeScript 7 sem API

- O TS 7.0 é o port nativo em Go, com ganho "between 8x and 12x on full builds"
  ([anúncio do TS 7.0][ts7]). Para o critério "rápido", é o maior ganho disponível no typecheck.
- **O TS 7.0 não tem API em JavaScript** ("it does not ship with an API"; nova API prevista para a
  7.1). Ferramentas que usam o compilador continuam no TS 6.0 pelo pacote `@typescript/typescript6`
  ([anúncio do TS 7.0][ts7]).
- Conferido no npm em 2026-11-15:
  - `@typescript-eslint/eslint-plugin` 8.72.2 pede `typescript >=4.8.4 <6.1.0`;
  - `@angular/compiler-cli` 22.2.6 pede `typescript >=6.0 <6.1`;
  - `svelte-check` 4.7.8 pede `typescript ^5.0.0 || ^6.0.0`.
- Consequência: **Angular e Svelte ficam no TS 6.0 para o typecheck de template**; o anúncio
  sugere TS 7 para o `tsc` de CLI e TS 6.0 para o editor no Angular, e TS 6.0 para Vue, Svelte e
  Astro ([anúncio do TS 7.0][ts7]). React e Solid (JSX puro) podem usar o `tsc` 7.
- Com typescript-eslint, o caminho é o alias de npm: `tsc` do 7 e `typescript` resolvendo para o 6.0
  ([anúncio do TS 7.0][ts7]). O typecheck então roda **duas vezes** (tsc 7 e o TS 6 dentro do
  ESLint).
- O Oxlint com tipos **exige** TS 7 ("tsgo aka TypeScript 7") e cobre 59 das 61 regras com tipo do
  typescript-eslint ([type-aware do Oxlint][oxlint-typeaware]).

### Velocidade e custo no CI

| Ferramenta | O que a fonte diz | Fonte |
|---|---|---|
| tsc 7 | 8x a 12x mais rápido que o 6 em build completo (fabricante) | [ts7] |
| ESLint + typescript-eslint com tipos | "lint times should be roughly the same as your build times": o lint com tipos custa um typecheck inteiro do TS 6 | [tseslint-perf] |
| Oxlint | "50 to 100 times faster than ESLint" (fabricante); 872 regras; com tipos, sem número publicado, e "very large codebases may use a lot of memory" | [oxlint], [oxlint-typeaware] |
| Biome lint | ≈800 ms em ~2k arquivos sem o *Scanner*; ≈2 s com ele (o *Scanner* liga só com regras de projeto, como `noFloatingPromises`) | [biome-linter] |
| Oxfmt | "approximately 30x faster than Prettier and 2x faster than Biome" (fabricante) | [oxfmt] |
| Prettier | Referência de saída; o typescript-eslint desaconselha `eslint-plugin-prettier` (parseia cada arquivo duas vezes) e recomenda `prettier --check` à parte | [tseslint-perf] |

### Suporte a framework (o painel ainda está em escolha)

| | Angular | React | Svelte | Solid |
|---|---|---|---|---|
| ESLint + plugins | `@angular-eslint` (templates inclusos) | `react-hooks`, `react`, `jsx-a11y` | `eslint-plugin-svelte` | `eslint-plugin-solid` |
| Oxlint | Não citado na documentação | Plugins `react`, `jsx-a11y` nativos | Só o bloco `<script>` do `.svelte` | Sem plugin próprio citado |
| Biome | Templates Angular **não listados** | Suportado (JSX, regras de hooks e `a11y`) | **Experimental**, só Svelte 5 | Domínio `solid` citado |
| Typecheck de template | `@angular/compiler-cli` (TS 6.0) | `tsc` (TS 7 ok) | `svelte-check` (TS ≤6) | `tsc` (TS 7 ok) |

Fontes: [linguagens do Biome][biome-lang], [linter do Biome][biome-linter], [Oxlint][oxlint],
[ts7], registro npm.

O Biome declara suporte ao **TypeScript 5.9** na sintaxe ([linguagens do Biome][biome-lang]). O
Oxlint aceita *JS plugins* compatíveis com o ecossistema ESLint, ainda **alpha** ([Oxlint][oxlint]).

### Cobertura de regra por princípio (o que cada um garante sozinho)

Base: tabela *Por princípio* de [typescript.md](../agents/principios-de-codigo/typescript.md),
conferida contra as listas de regras do [Oxlint][oxlint-rules] e do [Biome][biome-rules].
"Nursery" no Biome é regra experimental, sujeita a mudança.

| Princípio / prática | ESLint + typescript-eslint | Oxlint (+ tsgolint) | Biome |
|---|---|---|---|
| E1 nome de uma letra | `id-length` | `id-length` | **Sem equivalente** encontrado |
| E1 caixa por identificador | `@typescript-eslint/naming-convention` | **Ausente** | `useNamingConvention` |
| E2 tamanho e aninhamento | `max-depth`, `max-params`, `complexity`, `no-else-return`, `no-nested-ternary` | os mesmos | `noExcessiveNestedBlocks` (nursery), `useMaxParams`, `noExcessiveLinesPerFunction`, `noExcessiveCognitiveComplexity` (cognitiva, não ciclomática), `noNestedTernary` |
| E3 sem `any`, sem `!` | `no-explicit-any`, `no-non-null-assertion`, `no-unsafe-*` | `no-explicit-any`, `no-non-null-assertion`, `no-unsafe-*` com tipos | `noExplicitAny`, `noNonNullAssertion` |
| E4 promessa tratada | `no-floating-promises`, `no-misused-promises`, `only-throw-error` | com tipos: `no-floating-promises`, `only-throw-error` | `noFloatingPromises`, `noMisusedPromises` (ambas nursery) |
| E4 supressão com motivo | `ban-ts-comment` + `@eslint-community/eslint-comments/require-description` | `ban-ts-comment`; plugin `eslint-comments` **ausente** | `noTsIgnore`; a sintaxe `biome-ignore <regra>: <explicação>` traz o motivo |
| E5 imutável | `prefer-const`, `no-param-reassign`, `prefer-readonly` | `prefer-const`, `no-param-reassign`, `prefer-readonly` (com tipos) | `useConst`, `noParameterAssign`, `useReadonlyClassProperties` |
| E8 número mágico | `@typescript-eslint/no-magic-numbers` | `no-magic-numbers` | `noMagicNumbers` |
| P4 sem ciclo | (precisa de `dependency-cruiser` ou `import/no-cycle`) | `import/no-cycle` | `noImportCycles` |
| O switch exaustivo | `switch-exhaustiveness-check` | `switch-exhaustiveness-check` (com tipos) | `useExhaustiveSwitchCases` (nursery) |
| TS3 React | `react-hooks/rules-of-hooks`, `exhaustive-deps` | `react/exhaustive-deps`, `react/hooks` | `useHookAtTopLevel`, `useExhaustiveDependencies` |
| TS4 acessibilidade | `eslint-plugin-jsx-a11y` | plugin `jsx-a11y` nativo | grupo `a11y` |
| TS5 igualdade | `eqeqeq`, `no-implicit-coercion` | `eqeqeq`, `no-implicit-coercion` | `noDoubleEquals` |

O que fica **só com o tsc** (tsconfig), seja qual for o lint: E3 (`strict`,
`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), E6 (`noUnusedLocals`,
`noUnusedParameters`), L (`noImplicitOverride`), TS1 (`erasableSyntaxOnly`), TS2
(`isolatedModules`, `verbatimModuleSyntax`). O formatador (Prettier, Biome, Oxfmt ou dprint)
garante só P8.

Fora do alcance das três: E7 (duplicação), P1, P3/D (precisa de `no-restricted-imports` ou
ast-grep), P5, P6, P7 (dependência sem uso fica com o `knip` 6.45.1, ISC), P9, S.

## Java (biblioteca leve)

### Opções

| Ferramenta | Versão | Licença | Quem mantém | Lê | Papel |
|---|---|---|---|---|---|
| `javac` | do JDK | GPLv2 + Classpath Exception | OpenJDK | fonte | Typecheck |
| Error Prone | 2.52.0 | Apache-2.0 | Google | fonte, **dentro do javac** | Bugs na compilação |
| NullAway (+ JSpecify) | 0.14.3 (+ 1.0.1) | MIT (Apache-2.0) | Uber (JSpecify: grupo JSpecify) | dentro do javac | Nulidade |
| PMD (inclui CPD) | 7.29.0 | BSD-style (+ Apache-2.0) | Comunidade PMD | fonte | Desenho, erro, código morto, nomes |
| Checkstyle | 14.4.0 | LGPL-2.1 | Comunidade Checkstyle | fonte | Nome, tamanho, número mágico, imports |
| SpotBugs (+ Find Security Bugs) | 4.10.5 (+ 1.14.0) | LGPL-2.1 | Comunidade SpotBugs | **bytecode** | Bugs e segurança |
| Spotless (Maven / Gradle) | 3.11.0 / 8.11.0 | Apache-2.0 | DiffPlug | fonte | Orquestra o formatador |
| google-java-format | **2.0.0** | Apache-2.0 | Google | fonte | Formatador (100 colunas) |
| palantir-java-format | 2.103.0 | Apache-2.0 | Palantir | fonte | Formatador, fork do google (120 colunas) |
| ArchUnit | 1.5.1 | Apache-2.0 | TNG Technology Consulting | bytecode, como teste | Arquitetura |

Fontes: Maven Central (versões), API do GitHub (licenças), [instalação do Error Prone][ep-install],
[SpotBugs][spotbugs], [palantir-java-format][palantir], [google-java-format releases][gjf],
[LICENSE do PMD][pmd-license].

### Pontos que pesam

- **Error Prone exige JDK 21 ou mais para rodar** (compila código mais antigo com `--release`) e
  pede as flags `--add-exports`/`--add-opens` do `jdk.compiler` (JEP 396); no JDK 21, também
  `-XDaddTypeAnnotationsToSymbol=true`. Roda como plugin do javac (`-Xplugin:ErrorProne`): não há
  passo extra, o custo entra na compilação ([instalação do Error Prone][ep-install]). O plugin de
  Gradle é contribuição externa (`tbroyer/gradle-errorprone-plugin`).
- **SpotBugs lê bytecode**, então exige compilar antes, roda em Java 11+ e pede ao menos 512 MB
  ([SpotBugs][spotbugs]). A tabela de `java.md` registra cerca de 14 s; é o mais caro do conjunto.
- **google-java-format 2.0.0** trocou o motor de layout e liga uma limpeza por padrão; o projeto
  recomenda reformatar o código num commit só ao atualizar ([releases][gjf]). Para uma biblioteca
  que nasce agora, não há código a reformatar.
- **palantir-java-format** é fork do google-java-format, 120 colunas, mais amigável a lambdas;
  tem imagem nativa com arranque ">10x faster" que uma JVM nova, mas o `spotlessApply` usa a versão
  Java no Java 21+ por vazão ([palantir-java-format][palantir]).
- **PMD cobre parte do E1 sem o Checkstyle**: `ShortVariable` (mínimo padrão 3), `ShortMethodName`,
  `ShortClassName`; mas **isenta parâmetro de lambda, variável de `for` e de `catch`**, que o E1
  proíbe ([regras codestyle do PMD][pmd-codestyle]). O E1 inteiro (incluindo lambda, `catch` e
  genérico) só fecha com o Checkstyle configurado como em `java.md`.
- **Checkstyle e SpotBugs são LGPL-2.1.** São ferramentas de build, não entram no artefato
  publicado da biblioteca; registrado para quem avaliar licença.

### O que garante sozinho (princípios e JV)

Base: tabela *Por princípio* de [java.md](../agents/principios-de-codigo/java.md).

| Ferramenta | Princípios | Práticas JV |
|---|---|---|
| `javac` | O (exaustividade do `switch` sobre `sealed`) | — |
| Error Prone + NullAway | E3 (nulidade no tipo), E4 (`CatchAndPrintStackTrace`, `ReturnValueIgnored`, `NullOptional`), E5 (`MutablePublicArray`), E6 (`UnusedVariable`, `UnusedMethod`), O (`MissingCasesInEnumSwitch`), L (`MissingOverride`) | JV2 (`EqualsHashCode`), JV3 (`FutureReturnValueIgnored`), JV6 (`ReferenceEquality`) |
| PMD | E1 parcial (`ShortVariable` etc.), E2 (`CognitiveComplexity`), E4 (`EmptyCatchBlock`, `AvoidCatchingGenericException`, `PreserveStackTrace`), E5 (`ImmutableField`, `AvoidReassigningParameters`), E6 (`UnusedPrivateField`), E7 (CPD) | JV1 (`CloseResource`), JV2, JV3 (categoria `multithreading`), JV5, JV6 |
| Checkstyle | E1 completo, E2 (`ParameterNumber`, `NestedIfDepth`, `MethodLength`), E8 (`MagicNumber`), P8 (`AvoidStarImport`) | — |
| SpotBugs + FSB | — | JV1 (`OBL_UNSATISFIED_OBLIGATION`), JV4 |
| Spotless + google/palantir | P8 (um formatador) | — |
| ArchUnit | P1/I, P3/D, P4, P8 (`GeneralCodingRules`) | — |

Fora do alcance: P5, P6, P7 (parcial via código morto), P9, S.

## Resumo para os grillings

- **Rust:** não há troca de ferramenta; Clippy + rustfmt do toolchain.
  A decisão é quais lints ligar (a lista de `rust.md` está atual) e se entram `cargo-deny` e
  `cargo-machete`. Custo: um `cargo clippy` com cache faz lint e typecheck no mesmo passo.
- **TypeScript:** três caminhos com custo diferente.
  1. ESLint + typescript-eslint + Prettier: cobertura mais completa (E1 caixa, supressão com
     motivo, plugins de todos os frameworks), mas preso ao TS 6.0 no lint e o mais lento
     (lint com tipos ≈ um typecheck).
  2. Oxlint (+ tsgolint) + Oxfmt: o mais rápido declarado, roda sobre o TS 7; falta
     `naming-convention` e `eslint-comments`, Angular não é citado e Svelte é só `<script>`.
  3. Biome (lint + formatador num binário): rápido; sem `id-length` (E1 obrigatório fica com
     ast-grep ou outra ferramenta), regras de promessa e exaustividade em nursery, Svelte
     experimental e Angular fora.
  Em qualquer caminho, `tsc` (7 para React/Solid; 6.0 para Angular e Svelte) fica como typecheck.
  **A escolha do framework do painel muda a resposta**: Angular e Svelte puxam para TS 6.0 e ESLint.
- **Java:** o conjunto mínimo de `java.md` (Error Prone + NullAway, PMD, Spotless, ArchUnit)
  continua válido nas versões atuais; Checkstyle é o que fecha o E1 inteiro; SpotBugs é o mais
  caro e só se paga com JV4. A escolha do formatador é google-java-format 2.0 (100 colunas) ou
  palantir (120 colunas, lambdas).

## Diferenças em relação às tabelas *Ferramentas* do método

| Item | Tabela do método | Hoje (2026-11-15) |
|---|---|---|
| Rust toolchain | 1.97 | 1.100.0 |
| `typescript` | 6.0.x | 7.0.2 (6.0 via `@typescript/typescript6`) |
| `eslint` / `typescript-eslint` | 10.13.0 / 8.72.0 | 10.15.0 / 8.72.2 (ainda `typescript <6.1.0`) |
| `knip` | 6.42.1 | 6.45.1 |
| oxlint-tsgolint, regras com tipo | 60 de 62 | 59 de 61 (página do Oxlint) |
| Error Prone | 2.51.0 | 2.52.0 |
| PMD | 7.28.0 | 7.29.0 |
| Checkstyle | 14.3.0 | 14.4.0 |
| Spotless | 3.10.4 / 8.10.4 | 3.11.0 / 8.11.0 |
| JSpecify | 1.0.0 | 1.0.1 |
| google-java-format | (não fixado) | 2.0.0, com mudança de layout |

## Fontes

[gh-billing]: https://docs.github.com/en/billing/concepts/product-billing/github-actions
[rust-channel]: https://static.rust-lang.org/dist/channel-rust-stable.toml
[clippy]: https://doc.rust-lang.org/stable/clippy/
[crate-deny]: https://crates.io/crates/cargo-deny
[crate-machete]: https://crates.io/crates/cargo-machete
[ts7]: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
[tseslint-perf]: https://typescript-eslint.io/troubleshooting/typed-linting/performance/
[oxlint]: https://oxc.rs/docs/guide/usage/linter.html
[oxlint-typeaware]: https://oxc.rs/docs/guide/usage/linter/type-aware.html
[oxlint-rules]: https://oxc.rs/docs/guide/usage/linter/rules.html
[oxfmt]: https://oxc.rs/docs/guide/usage/formatter.html
[biome-linter]: https://biomejs.dev/linter/
[biome-rules]: https://biomejs.dev/linter/javascript/rules/
[biome-lang]: https://biomejs.dev/internals/language-support/
[ep-install]: https://errorprone.info/docs/installation
[spotbugs]: https://spotbugs.readthedocs.io/en/latest/introduction.html
[palantir]: https://github.com/palantir/palantir-java-format
[gjf]: https://github.com/google/google-java-format/releases
[pmd-codestyle]: https://docs.pmd-code.org/latest/pmd_rules_java_codestyle.html
[pmd-license]: https://github.com/pmd/pmd/blob/main/LICENSE

- GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- Canal estável do Rust: https://static.rust-lang.org/dist/channel-rust-stable.toml
- Clippy: https://doc.rust-lang.org/stable/clippy/
- crates.io: https://crates.io/crates/cargo-deny, https://crates.io/crates/cargo-machete
- Anúncio do TypeScript 7.0: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- typescript-eslint, desempenho do lint com tipos: https://typescript-eslint.io/troubleshooting/typed-linting/performance/
- Oxlint: https://oxc.rs/docs/guide/usage/linter.html, https://oxc.rs/docs/guide/usage/linter/type-aware.html, https://oxc.rs/docs/guide/usage/linter/rules.html
- Oxfmt: https://oxc.rs/docs/guide/usage/formatter.html
- Biome: https://biomejs.dev/linter/, https://biomejs.dev/linter/javascript/rules/, https://biomejs.dev/internals/language-support/, https://biomejs.dev/analyzer/suppressions/
- Registro npm (versões, licenças e `peerDependencies`): https://registry.npmjs.org/ (`typescript`, `eslint`, `typescript-eslint`, `@typescript-eslint/eslint-plugin`, `@biomejs/biome`, `oxlint`, `oxlint-tsgolint`, `oxfmt`, `prettier`, `dprint`, `knip`, `@angular/compiler-cli`, `@angular-eslint/eslint-plugin`, `svelte-check`, `eslint-plugin-svelte`, `eslint-plugin-solid`, `eslint-plugin-react-hooks`)
- Maven Central (versões): https://repo1.maven.org/maven2/ (`checkstyle`, `pmd-core`, `error_prone_core`, `nullaway`, `spotbugs`, `spotless-maven-plugin`, `spotless-plugin-gradle`, `google-java-format`, `palantir-java-format`, `archunit`, `findsecbugs-plugin`, `jspecify`)
- Error Prone, instalação: https://errorprone.info/docs/installation
- SpotBugs: https://spotbugs.readthedocs.io/en/latest/introduction.html
- palantir-java-format: https://github.com/palantir/palantir-java-format
- google-java-format releases: https://github.com/google/google-java-format/releases
- PMD, regras codestyle: https://docs.pmd-code.org/latest/pmd_rules_java_codestyle.html
- PMD, licença: https://github.com/pmd/pmd/blob/main/LICENSE
- API do GitHub (licença e atividade dos repositórios): https://api.github.com/repos/{dono}/{repo}
