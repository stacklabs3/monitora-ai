# Escrita de código: nomes, limites, comentários, duplicação e valores

Ticket: [Escrita de código](https://github.com/stacklabs3/monitora-ai/issues/42).
Consulta: **2026-11-18**. Evidência para os princípios E1, E2, E6, E7 e E8
([escrita](../agents/principios-de-codigo/escrita.md)): esta nota não decide nada.

Cenário: Monitora AI é uma plataforma de logs, com servidor em Rust, painel e biblioteca Node em
TypeScript, e biblioteca Java depois. Agentes escrevem todo o código; 1 pessoa mantém, fala português e
não lê Rust. O glossário usa "produto", "aplicação" e "alerta".

Convenção: **Fato** é o que a fonte diz, em paráfrase. **Teste local** é o que rodei aqui em
2026-11-18 (rustc 1.99.1, Clippy 0.1.99, Node 26.13.0, javac 25.0.3, ast-grep 0.51.0, macOS).
**Inferência** é leitura minha para este cenário. **[confirmar]** marca o que ficou sem fonte primária
lida ou sem teste. Em estudo, "resumo" quer dizer que li só o resumo publicado, não o artigo inteiro. As
fontes `[F1]`, `[F2]`... estão no fim.

## Resumo

- **Acento funciona, com limites diferentes.** Rust, TypeScript/JavaScript e Java aceitam `aplicação`.
  Em Rust falha em módulo carregado de arquivo sem `#[path]` e em `#[no_mangle]`; nome de crate fica
  limitado a ASCII para uso externo. Só Rust normaliza para NFC: em JavaScript e Java, a mesma palavra em
  NFC e NFD são identificadores diferentes.
- **Os guias do Google exigem ASCII** em TypeScript e Java. A RFC do Rust sugere inglês e ASCII para
  crates abertos e admite exceção. Nenhum desses textos trata de projeto privado em outra língua.
- **Nome ruim prejudica pessoas e modelos**, com evidência razoável. **Sobre a língua do identificador
  não achei estudo**, nem com pessoas nem com LLMs. O vizinho mais próximo é a língua do *prompt*: instruções
  em chinês derrubaram ao menos 13% do Pass@1 em um estudo.
- **`cognitive_complexity` não está mais em `nursery`:** foi para `restriction` no Rust 1.91, e a própria
  doc diz que o lint não mede o que o nome promete.
- **Os limites padrão divergem muito:** função de 50 (ESLint), 100 (Clippy) ou 150 linhas (Checkstyle);
  parâmetros 3 (ESLint) ou 7 (Clippy e Checkstyle). A evidência não sustenta um número universal.
- **Métrica de complexidade explica pouco a compreensão.** Reduzir aninhamento tem um experimento
  favorável (275 pessoas). O único número de tamanho de método achado (24 linhas) vem de Java.
- **Comentário desatualizado afeta LLMs em alguns estudos e não em outros.** Código comentado com defeito
  aumentou defeitos em Copilot e Cursor; comentário adversarial não mudou a detecção de vulnerabilidade.
- **Detector de código comentado:** existe para TypeScript e Java (Sonar S125). Para Rust não achei
  ferramenta pronta; um teste de ast-grep funcionou numa amostra pequena.
- **Duplicação e defeito: evidência dividida.** Mudança inconsistente em clone gera falha, mas clones em
  geral não aparecem como mais defeituosos. Em código de IA os dados também se contradizem.
- **Clippy não tem lint de número mágico.** Uma regra de ast-grep cobre o caso; testei só numa amostra.

## 1. Língua e caracteres dos identificadores

### Fatos

| Tema | Rust | TypeScript / ECMAScript | Java |
| --- | --- | --- | --- |
| Aceita `aplicação`? | Sim: `XID_Start`/`XID_Continue` da UAX #31 [F1] | Sim: `ID_Start`/`ID_Continue` [F9] | Sim: letras do Unicode inteiro, conforme `Character.isJavaIdentifierStart/Part` [F10] |
| Normalização | NFC: dois nomes são iguais se as formas NFC forem iguais [F1] | Nenhuma: equivalentes canônicos só são iguais com os mesmos code points [F9] | Nenhuma: caractere composto difere do decomposto [F10] |
| Restrições | Só ASCII em `extern crate`, nome de crate externo em caminho, módulo carregado de arquivo sem `#[path]`, itens `no_mangle` e itens de bloco externo [F1] | Palavras reservadas; nada específico sobre acento [F9] | Palavras reservadas; caracteres ignoráveis não contam na comparação [F10] |

**Rust, lints e Cargo**

- `non_ascii_idents` vem em `allow`, vale só no nível do crate e serve para quem quer manter ASCII [F2] [F3].
- `confusable_idents`, `mixed_script_confusables` e `uncommon_codepoints` vêm em `warn` [F3].
- Cargo: `cargo new` exige identificador válido; o crates.io aceita só ASCII, com até 64 caracteres [F4].
  O validador do Cargo aceita caracteres XID no nome do pacote [F5].
- A RFC 2457 mantém ASCII e inglês no código da organização Rust, sugere inglês e ASCII para crates
  abertos e abre exceção quando o domínio e o público justificam; nesse caso sugere considerar uma API só
  em ASCII [F2].

**Guias oficiais**

- Rust API Guidelines, seção de nomes: não trata de língua nem de ASCII em identificadores [F6].
- Google TypeScript: identificador usa só letras ASCII, dígitos, `_` em casos previstos e, raramente, `$`.
  Permite nome curto, até de uma letra, em escopo de até 10 linhas [F7].
- Google Java: identificador usa só letras e dígitos ASCII, e `_` em poucos casos; ao montar camelCase,
  a frase é convertida para ASCII ("Müller's" vira "Muellers") [F8].
- Os dois guias do Google não mandam escrever nomes em inglês; a exigência lida é de caracteres [F7] [F8].

### Teste local

| Caso | Resultado |
| --- | --- |
| Rust: `struct Aplicação`, `fn criar_aplicação`, `let aplicação` | Compila e roda, sem aviso |
| Rust: declarar em NFC e usar em NFD | Compila: é o mesmo identificador |
| Rust: `mod aplicação;` sem `#[path]` | Erro E0754, com sugestão de `#[path]` |
| Rust: `mod aplicação` com `#[path = "aplicacao_arquivo.rs"]` ou em linha | Funciona |
| Rust: `#[unsafe(no_mangle)] fn função_exportada` | Erro E0754 |
| Rust: `#![forbid(non_ascii_idents)]` | Bloqueia `aplicação` |
| Cargo: `cargo new --lib aplicação` e `cargo check` | Cria e compila, com aviso de que nome de crate não ASCII não é suportado |
| Node: `const aplicação`, `class Aplicação` | Funciona |
| Node: declarar em NFC e consultar em NFD | Nome em NFD fica `undefined`: são identificadores diferentes |
| Node: arquivo `.ts` com `type Aplicação`, removendo tipos | Funciona |
| javac: `public class Aplicação` em `Aplicação.java` | Compila e roda; gera `Aplicação.class` |
| javac: declarar em NFC e usar em NFD | Erro `cannot find symbol` |

### Inferência

- São três caminhos, cada um com custo próprio: português com acento acompanha o glossário, mas pede
  atenção a arquivo de módulo em Rust e a NFC/NFD em TS e Java; português sem acento (`aplicacao`) evita
  esses limites e deixa de bater letra a letra com o glossário; inglês evita os dois e exige tradução
  dos termos do domínio.
- O risco de NFC/NFD depende de quem gera o texto. Agente e teclado costumam produzir NFC, mas não medi
  isso **[confirmar]**.
- `Aplicação.java` e `Aplicação.class` dependem de como cada sistema de arquivos e o empacotamento tratam
  Unicode. Testei só no macOS; Linux, JAR e publicação em Maven ficaram sem teste **[confirmar]**.
- O compilador `tsc` não foi testado: o teste em Node só remove tipos. Editores, ESLint, ast-grep e jscpd
  com identificadores acentuados também não foram testados **[confirmar]**.
- O nome de pacote publicado (crates.io, npm, Maven) é uma decisão à parte do nome interno.

## 2. Evidência sobre nomes: pessoas e LLMs

### Fatos: compreensão humana

| Estudo | Desenho | Resultado |
| --- | --- | --- |
| Hofmeister et al., SANER 2017 [F11] | 72 desenvolvedores profissionais de C#, intra-sujeitos, procura de defeito | Palavras: 19% mais rápido que letras e abreviações; sem diferença significativa entre letras e abreviações |
| Schankin et al., ICPC 2018 [F12] | 88 desenvolvedores Java, web, defeito semântico | Nomes descritivos: cerca de 14% mais rápido; efeito some em erro de sintaxe |
| Avidan e Feitelson, ICPC 2017 [F13] | 9 profissionais, 6 métodos, nomes originais ou letras | Parâmetro pesa mais que variável local; em 3 métodos não houve diferença, atribuída a nomes ruins ou enganosos |
| Lawrie et al., ICPC 2006 [F14] | Mais de 100 programadores, 12 funções | Estudo sobre identificadores e compreensão; li só parte do resumo **[confirmar]** |
| Feitelson et al., TSE 2020 [F15] | 334 participantes, 47 casos | Mediana de 6,9% de chance de duas pessoas escolherem o mesmo nome |
| Johnson et al., ICSME 2019 [F19] | 275 participantes, 32 métodos Java | Quanto melhor o inglês do participante, mais a regra de aninhamento afetou as notas de legibilidade e confiança |

### Fatos: língua, perto do tema

- **Nenhum estudo achado testa identificador em português, ou em outra língua, contra inglês** na
  compreensão humana. A busca não foi exaustiva **[confirmar]**.
- Pawelka e Juergens, ICSME 2015: boa parte dos projetos industriais analisados mistura línguas em
  comentários e identificadores; nenhum dos projetos abertos analisados aparece assim no trecho lido.
  O estudo mede ocorrência, não efeito [F16].
- Guo, CHI 2018: pesquisa com 840 respostas, 86 países e 74 línguas maternas. Quem não fala inglês
  nativamente relata barreiras ao ler e escrever código e materiais [F17].
- Dasgupta e Hill, L@S 2017: mais de 15 mil usuários de Scratch em 5 países; novatos com linguagem e
  ambiente localizados aprenderam conceitos mais rápido. Trata de palavras-chave e interface, não de nomes [F18].

### Fatos: LLMs

| Estudo | Desenho | Resultado |
| --- | --- | --- |
| Wang et al., 2023 [F20] | CodeBERT com nomes sem sentido ou enganosos; caso com GPT | Nomes afetam muito as tarefas; nomes embaralhados pioram mais, em média, que texto aleatório |
| Le et al., 2025, pré-print [F21] | Ofuscação que preserva comportamento | Previsão de saída: ClassEval 85,7 para 76,1 e LiveCodeBench 85,4 para 71,2 em Pass@1. Resumo de classes: GPT-4o 87,3 para 58,7, DeepSeek V3 87,7 para 76,7 |
| Miceli Barone et al., ACL Findings 2023 [F22] | Troca de nomes de funções padrão em Python | Modelos falham, e alguns ficam mais confiantes no erro quanto maiores são |
| *Variable Naming Impact*, 2025, pré-print [F23] | 500 exemplos em Python, 7 estilos, 8 modelos pequenos | Similaridade semântica: descritivo 0,874, ofuscado 0,802; o mesmo modelo renomeia e julga |
| *The Code Barrier*, 2025, pré-print [F24] | 13 modelos, 250 problemas Java | Queda significativa conforme a ofuscação cresce |
| *Fault Localizability*, 2025, pré-print [F25] | Falhas injetadas e mudanças que preservam o sentido | Modelos perdem a falha em 81% dos casos após a mudança; o efeito é maior com código morto e menor com nome de variável enganoso |
| NameTrap, 2026, pré-print [F26] | Ataque que só renomeia identificadores; 6 agentes, 10 modelos | Nomes em código de terceiros conseguem induzir vulnerabilidades |

**Língua, com LLMs:**

- **Não achei estudo sobre identificadores em língua não inglesa em LLMs** **[confirmar: busca não exaustiva]**.
- Wang et al., TOSEM 2026: instruções em chinês reduzem o Pass@1 em ao menos 13% frente ao inglês. É
  língua do pedido, não do identificador [F27].
- HumanEval-XL: 23 línguas, português incluído, 12 linguagens e 22.080 prompts. Não li o resultado por
  língua **[confirmar]** [F28].

### Inferência

- Há sustentação razoável para E1 na parte de **qualidade** do nome. Isso vale para pessoas e modelos, com
  a ressalva de que quase todos os estudos usam nomes em inglês.
- Sobre **língua**, a evidência é inexistente. Extrapolar de [F27] seria especular: pedido e identificador são
  coisas diferentes, e o efeito pode ir para qualquer lado num domínio cujo glossário está em português.
- Um teste barato responderia melhor que a literatura: o mesmo módulo, com o mesmo modelo, em português
  com acento, sem acento e em inglês. Esse teste não foi feito.
- [F15] sugere que nomes variam muito sem um vocabulário comum, o que combina com usar o glossário. É
  hipótese: o estudo não testou glossário nem agentes.

**Limites:** amostras pequenas em parte dos estudos humanos; modelos antigos ou pequenos em parte dos
estudos de LLM; vários pré-prints. Ofuscação extrema não mede a diferença entre um nome bom e um nome médio.

## 3. Limites de função

### Fatos: ferramentas

| Ferramenta e regra | Grupo ou estado | Padrão | Configuração |
| --- | --- | --- | --- |
| Clippy `too_many_lines` [F29] [F32] | `pedantic` | 100 linhas; não conta comentário nem linha em branco | `too-many-lines-threshold` |
| Clippy `too_many_arguments` [F29] [F32] | `complexity` (ativo) | 7 | `too-many-arguments-threshold` |
| Clippy `excessive_nesting` [F31] [F32] | `complexity` | 0: só atua se houver limite no `clippy.toml` | `excessive-nesting-threshold` |
| Clippy `cognitive_complexity` [F30] [F32] [F33] | **`restriction`** desde o Rust 1.91 | 25 | `cognitive-complexity-threshold` |
| ESLint `max-depth` [F34] | Regra opcional | 4 | `max` |
| ESLint `max-params` [F34] | Regra opcional | 3 | `max`, `countThis` |
| ESLint `complexity` [F34] | Regra opcional | 20, ciclomática clássica | `max`, `variant: classic/modified` |
| ESLint `max-lines-per-function` [F34] | Regra opcional | 50, contando branco e comentário | `max`, `skipBlankLines`, `skipComments`, `IIFEs` |
| Checkstyle `MethodLength` [F35] | Check | 150, contando vazias e comentários | `max`, `countEmpty`, `tokens` |
| Checkstyle `ParameterNumber` [F35] | Check | 7 | `max`, `ignoreOverriddenMethods`, `ignoreAnnotatedBy`, `tokens` |
| Checkstyle `NestedIfDepth` [F35] | Check | 1 | `max` |

- As quatro regras do ESLint e `no-magic-numbers` não fazem parte do conjunto recomendado do ESLint
  ([configuração](https://github.com/eslint/eslint/blob/main/packages/js/src/configs/eslint-recommended.js)).
- A doc de `cognitive_complexity` afirma que o lint não mede a compreensão e que ficou em `restriction`
  para não enganar quem o usaria como medida; sugere `excessive_nesting` e `too_many_lines` [F30].
- O changelog registra a mudança de `nursery` para `restriction` no Rust 1.91 (PR #15415) [F33].
- O `google_checks.xml` do Checkstyle não inclui `MethodLength`, `ParameterNumber`, `NestedIfDepth` nem
  `MagicNumber` [F36].

### Teste local

Crate descartável com `clippy.toml` de limites baixos:

- Sem `clippy.toml`: dispara só `too_many_arguments` (8 de 7), entre os lints desta seção.
- Com `excessive-nesting-threshold`: `excessive_nesting` passa a disparar sem outra opção.
- `-W clippy::nursery` **não** ativa `cognitive_complexity`; `-W clippy::cognitive_complexity` ativa.
- `-W clippy::pedantic` ativa `too_many_lines`, `missing_errors_doc` e `missing_panics_doc`.

### Fatos: evidência empírica

| Estudo | Desenho | Resultado |
| --- | --- | --- |
| Chowdhury et al., MSR 2022 [F37] | Evolução de cerca de 785 mil métodos Java | Recomenda manter métodos abaixo de 24 linhas; decompor reduz esforço de manutenção |
| Landman et al., ICSME 2014 [F38] | 17,8 milhões de métodos, 13 mil projetos Java | Correlação linear entre complexidade ciclomática e linhas só moderada no método; cresce ao agregar |
| Scalabrino et al., TSE 2019 [F39] | 121 métricas, 444 avaliações, 63 desenvolvedores | Nenhuma métrica sozinha captura compreensibilidade |
| Muñoz Barón et al., ESEM 2020 [F40] | Meta-análise, cerca de 24 mil avaliações, 427 trechos | Complexidade cognitiva (de Sonar) correlaciona com tempo e nota subjetiva; resultado misto para acerto e medidas fisiológicas |
| Peitek et al., ICSE 2021 [F41] | fMRI, 19 participantes, mais de 41 métricas | Métricas explicam pouco; tamanho do texto guia a atenção e vocabulário pesa na memória de trabalho |
| Ajami et al., ICPC 2017 [F42] | 222 programadores profissionais | `for` é mais difícil que `if`; parte das negações dificulta |
| Johnson et al., ICSME 2019 [F19] | 275 participantes, 32 métodos Java | Reduzir aninhamento diminui tempo, aumenta confiança e sugere melhora ao achar defeito |
| Hatton, IEEE Software 1997 [F43] | Densidade de falhas por tamanho de componente | Componentes médios foram proporcionalmente mais confiáveis que pequenos e grandes |
| Palomba et al., EMSE 2017 [F44] | 395 versões, 30 projetos, 17.350 casos de 13 *smells* | *Smells* de código longo ou complexo são comuns; classes com *smell* mudam e falham mais |

**Código gerado por IA:**

- He et al., MSR 2026: 806 repositórios que adotaram Cursor contra 1.380 de controle, com diferença em
  diferenças. Linhas adicionadas +28,6% em média, concentradas nos primeiros meses; avisos estáticos +30,3%;
  complexidade +41,6%. Os autores ligam esses aumentos à queda posterior de velocidade [F45].
- Cotroneo et al., 2025, pré-print: mais de 500 mil amostras em Python e Java. Código de LLM sai mais simples
  e repetitivo, com mais construções sem uso e mais vulnerabilidades de alto risco [F46].
- Medição em repositórios reais (pré-print, 2026): diferenças entre código humano e de IA são pequenas em
  métricas de código, ao contrário do que estudos de laboratório sugerem [F47].
- [F25] mediu 60% das falhas localizadas no primeiro quarto do programa e 13% no último. **Não achei estudo
  que teste limites de função, aninhamento ou parâmetros como regra para agentes** **[confirmar]**.
- **Não achei evidência empírica específica sobre número de parâmetros** **[confirmar]**.

### Inferência

- Os limites padrão refletem escolhas das ferramentas. Nenhuma fonte lida os deriva de estudo.
- Os números não são comparáveis direto: Clippy ignora comentário e branco; ESLint e Checkstyle contam.
  `excessive_nesting` conta blocos como `mod` e `impl`, como mostra o exemplo da doc, enquanto `max-depth`
  mede blocos dentro da função.
- O limite do E2 (três parâmetros) coincide com o padrão de ESLint e fica abaixo de Clippy e Checkstyle.
- 24 linhas [F37] é um dado de Java sobre manutenção humana; aplicá-lo a Rust ou a código de agente seria
  extrapolação. [F43] aponta na direção contrária para componentes muito pequenos, mas é antigo e usa outra unidade.
- Para quem não lê Rust, a utilidade do limite pode estar em facilitar a revisão por agente e o teste, mais
  do que na leitura direta. Isso é hipótese, sem medição.

**Limites:** quase tudo é Java e correlação; [F44] mede classes e pode ter efeito de tamanho. Li só os
resumos de [F37] a [F44].

## 4. Comentários e documentação

### Fatos: exigir documentação

| Linguagem | Mecanismo | Comportamento |
| --- | --- | --- |
| Rust | `missing_docs` [F48] | `allow` por padrão; aponta item público sem doc |
| Rust | `clippy::missing_errors_doc`, `clippy::missing_panics_doc` [F49] [F32] | `pedantic`; olham `pub fn` que devolve `Result` ou pode entrar em pânico; `check-private-items` amplia para itens privados |
| Rust | `rustdoc::missing_crate_level_docs` [F50] | `allow`; aponta crate sem doc na raiz |
| Rust | Rust API Guidelines [F51] | Pedem doc de crate completa com exemplos (C-CRATE-DOC), exemplo nos itens (C-EXAMPLE) e seções de erro, pânico e segurança (C-FAILURE) |
| TypeScript | `jsdoc/require-jsdoc` [F52] | `publicOnly` restringe a exportados; só `FunctionDeclaration` vem ligado; `contexts` alcança nós de TypeScript |
| TypeScript | TSDoc e `eslint-plugin-tsdoc` [F53] [F54] | TSDoc é proposta de padrão; o plugin valida a sintaxe, sem exigir presença |
| TypeScript | TypeDoc [F55] | `validation.notDocumented` avisa falta de doc, conforme `requiredToBeDocumented` |
| TypeScript | typescript-eslint [F56b] | Nenhuma regra na pasta de docs com nome de exigência de documentação; a busca foi pelo nome do arquivo |
| TypeScript | Google TS [F7] | Documentar exportações de topo com JSDoc; não repetir nome e tipo |
| Java | Google Java 7.3 [F8] | Javadoc em toda classe, membro ou componente de record visível; exceções para o óbvio e para sobrescritas |
| Java | Checkstyle `MissingJavadocMethod`, `MissingJavadocType` [F60] [F36] | Existem; ambos estão no `google_checks.xml` |

### Fatos: detectar código comentado

| Ferramenta | Alcance | Situação |
| --- | --- | --- |
| `sonarjs/no-commented-code` (S125) [F56] | JS e TS, dentro do ESLint | `eslint-plugin-sonarjs` 4.2.2. O npm declara LGPL-3.0; o cabeçalho do código cita licença da Sonar **[confirmar licença]** |
| Sonar Java S125 [F57] | Java | Regra `CommentedOutCodeLineCheck` no sonar-java |
| `sonar-rust` [F58] | Rust | 86 arquivos JSON na pasta de regras próprias, **sem S125 e sem S109**. É o analisador comunitário; não verifiquei produto pago da Sonar **[confirmar]** |
| `eslint-plugin-no-commented-code` [F59] | JavaScript | Última versão 1.0.10, de julho de 2023. Suporte a TypeScript não confirmado **[confirmar]** |
| Clippy [F82] | Rust | Nenhum lint com "commented" entre os declarados |
| Checkstyle [F61b] | Java | Nenhum check dedicado nas pastas `misc` e `coding`; só `TodoComment`, `TrailingComment` e afins |
| PMD [F61] | Java | Categoria de documentação sem regra para código comentado |

**Teste local:** uma regra de ast-grep sobre `line_comment`, com expressão regular, achou
`// let valor_antigo = 86400;` e deixou passar um comentário em prosa e um `///`, numa amostra de 14
linhas. É heurística, sem medida de falso positivo em código real.

### Fatos: comentários desatualizados ou enganosos

| Estudo | Desenho | Resultado |
| --- | --- | --- |
| Wen et al., ICPC 2019 [F62] | 1,3 bilhão de mudanças de AST, 1.500 sistemas, 500 commits analisados à mão | Mapeia que mudanças de código levam a atualizar comentário e classifica inconsistências corrigidas |
| Fluri et al., WCRE 2007 [F63] | Evolução de código e comentários | Código novo quase não recebe comentário; 97% das mudanças de comentário vêm na mesma revisão do código |
| Tan et al., SOSP 2007 [F64] | iComment, 4 programas | 60 inconsistências: 33 defeitos novos e 27 comentários ruins |
| Rani et al., JSS 2022 [F65] | Revisão: 2.353 artigos, 47 analisados | Pesquisa concentrada em Java e em consistência entre comentário e código |
| Börstler e Paech, TSE 2016 [F66] | 104 estudantes | Comentários mudam a legibilidade percebida, sem diferença significativa na compreensão |
| Comment Traps, 2025, pré-print [F68] | 6.403 repositórios Python; Copilot e Cursor | 84,62% dos repositórios têm código comentado, 4,53% das linhas de comentário; 21,19% desse código tem defeito detectável. Código comentado defeituoso eleva a geração defeituosa em até 58,17%; pedir para ignorar reduz no máximo 21,84% |
| Comentários adversariais, 2026, pré-print [F69] | 100 amostras, 8 variantes, 8 modelos, 9.366 testes | Efeito pequeno e não significativo na detecção de vulnerabilidades |
| Código legado, 2025 [F70] | Múltipla escolha em linguagem legada | Resultado declarado como preliminar |
| *When Comments Mislead*, ASE 2026 [F67] | Comentários desatualizados em autocompletar | Não obtive o resumo **[confirmar]** |

### Inferência

- E6 tem apoio indireto: código comentado parece mais arriscado para agente do que para leitor humano, por
  entrar no contexto [F68]. O estudo é de Python e um pré-print.
- Os resultados de LLM não se somam num só sentido: [F68] mede geração e [F69] mede detecção.
- Documentação obrigatória em API pública tem suporte em guias, não em estudo que meça benefício. Com
  [F66], não há base para dizer que mais comentário melhora a compreensão.
- A biblioteca Node e a Java são usadas por terceiros, e o servidor não. Os guias acima falam sobretudo de
  API pública, então a mesma regra pode não servir às três partes.

## 5. Duplicação

### Fatos: jscpd

- A versão atual é a **5.4.3**, com motor em Rust, binário próprio e 224 formatos, entre eles `rust`, `java`,
  `typescript` e `tsx` [F71] [F73] [F74].

| Opção | Efeito | Padrão |
| --- | --- | --- |
| `--min-tokens`, `-k` | Mínimo de tokens no clone | 50 |
| `--min-lines`, `-l` | Mínimo de linhas no clone | 5 |
| `--threshold`, `-t` | Percentual máximo de duplicação antes de sair com 1 | Sem valor na CLI [F72] |
| `--ignore`, `-i` | Globs de arquivo, separados por vírgula | Vazio [F72] |
| `--ignore-pattern` | Regex no texto-fonte, para ignorar trechos | Vazio |
| `--mode` | `mild`, `weak` (também tira comentários) ou `strict` | `mild` |

- `--threshold` e `--ignore` não aparecem na tabela principal da doc; estão na definição da CLI [F72] e no
  exemplo de configuração [F71].
- Há também `--ignore-identifiers`, `--ignore-literals`, `--max-gap-lines`, `--similarity`, `--baseline`,
  `--fail-on-new-clones` e `--changed`. A detecção semântica (`--semantic`) é experimental [F71].
- O README diz que Super-Linter e MegaLinter rodam jscpd com `threshold: 0` por padrão [F71b].

### Fatos: duplicação e defeitos

| Estudo | Desenho | Resultado |
| --- | --- | --- |
| Juergens et al., ICSE 2009 [F75] | Sistemas comerciais e abertos | Mudanças inconsistentes em clones são muito frequentes e geraram número relevante de falhas |
| Rahman et al., MSR 2010 [F76] | Clones e histórico de defeitos | A maioria dos defeitos não se associa a clones; clones podem ter menos defeito; mais cópias não indicam mais erro |
| Sajnani et al., SCAM 2014 [F77] | 31 projetos Java, 1,7 milhão de linhas, FindBugs | Densidade de defeitos 3,7 vezes menor no código clonado; mede padrões do FindBugs, não falhas reais |

**Código gerado por IA:**

- GitClear 2025 (fornecedor): 211 milhões de linhas alteradas, 2020 a 2024. Linhas copiadas de 8,3% para
  12,3% entre 2021 e 2024; linhas movidas de 25% para menos de 10%. A página não mostra atribuição por linha
  nem afirma causa [F78].
- He et al.: o texto diz que o efeito do Cursor na densidade de duplicação é não significativo; a tabela traz
  +7,03% (±4,79%), e os autores citam possível alta modesta entre usuários intensos [F45].
- Medição em repositórios reais: código humano com **mais** duplicação (linhas duplicadas 27,57% contra
  14,29%), mas IA com um pouco mais de clones por arquivo (0,504 contra 0,448) [F47].
- Cotroneo et al. descrevem o código de LLM como mais repetitivo [F46].
- Ciniselli et al., MSR 2022: de cerca de 10% a 0,1% das previsões são clones exatos do treino, conforme o tamanho [F79].
- Não achei estudo específico sobre clones em PRs de agentes **[confirmar]**.

### Fatos: regra de três

- A atribuição corrente é a Don Roberts, em *Refactoring* (Fowler, 1999). **Não li o livro**; só vi a
  atribuição em fontes secundárias **[confirmar]** [F81].
- O padrão *Three Examples*, de Roberts e Johnson em *Evolving Frameworks* (1996), manda construir três
  aplicações antes de consolidar um framework. Li a descrição em um artigo que aplica o padrão, não o
  original, e o tema é framework, não duplicação **[confirmar]** [F80].
- **Não encontrei fonte primária acessível para a origem da regra.**

### Inferência

- A evidência não sustenta "toda duplicação causa defeito". O dano mais bem documentado é a mudança
  inconsistente entre cópias [F75], que combina com a parte do E7 sobre regra de negócio repetida.
- jscpd acha repetição de texto e tokens; a duplicação de conhecimento continua fora dele, exceto talvez pela
  busca semântica experimental, que não testei.
- Em código de IA, as fontes divergem porque medem coisas diferentes. Nenhuma permite afirmar uma direção.
- Esses números de corte (50 tokens, 5 linhas) são padrões da ferramenta, sem estudo que os justifique
  entre as fontes lidas. Não executei o jscpd neste repositório.

**Limites:** li só resumos de [F75] a [F77] e [F79]. Kapser e Godfrey (2008), Kim et al. (2005) e a revisão de
Hordijk et al. (2009) têm registro, mas não obtive o conteúdo **[confirmar]**.

## 6. Números mágicos e configuração

### Fatos

- **Clippy não tem lint de número mágico:** nenhum nome com "magic" na lista de lints declarados nem na
  configuração. Os lints de literal tratam de forma (agrupamento de dígitos, sufixos), não de significado [F82] [F32].
- `sonar-rust` também não traz S109 [F58].

| Regra | Opções | Padrão relevante |
| --- | --- | --- |
| `@typescript-eslint/no-magic-numbers` [F84] | As de ESLint, mais `ignoreEnums`, `ignoreNumericLiteralTypes`, `ignoreReadonlyClassProperties`, `ignoreTypeIndexes` | Todas `false` |
| ESLint `no-magic-numbers` [F83] | `ignore`, `ignoreArrayIndexes`, `ignoreDefaultValues`, `ignoreClassFieldInitialValues`, `enforceConst`, `detectObjects`; as quatro de TypeScript também já constam no núcleo | `ignore: []`: nenhum número é isento |
| Checkstyle `MagicNumber` [F85] | `ignoreNumbers`, `ignoreHashCodeMethod`, `ignoreAnnotation`, `ignoreFieldDeclaration`, `ignoreAnnotationElementDefaults`, `constantWaiverParentToken`, `tokens` | Ignora -1, 0, 1 e 2; constante é campo `final` |

- ast-grep suporta Rust, TypeScript, TSX e Java, com regras por `kind`, `regex` e relações como `inside` [F86].

**Twelve-Factor, seção Config [F87]:**

- Configuração é o que muda entre implantações: recursos de apoio, credenciais e valores por implantação.
- Ela fica separada do código e, na recomendação do texto, em variáveis de ambiente.
- Configuração interna da aplicação, que não muda entre implantações, fica fora dessa definição e pode
  permanecer no código.
- O texto desaconselha agrupar configuração em "ambientes" nomeados, porque isso escala mal.

### Teste local

Regra de ast-grep sobre `integer_literal` e `float_literal`, excluindo 0, 1, `const`, `static`, atributos,
variantes de enum e tamanhos de array. Em amostra de 14 linhas, apontou `86400` e `2.5` e ignorou o `500` de
`static`, o `3` de `const`, o `40` do enum e o `16` de `[u8; 16]`. Índice `[0]` passa por ser 0. Não medi falsos
positivos em código real.

### Inferência

- Em Rust, E8 pode ter verificação mecânica só por regra própria; o princípio hoje diz "só o revisor".
- A isenção de E8 (0, 1, -1) não coincide com os padrões: ESLint não isenta nada e Checkstyle isenta também o 2.
- O servidor Monitora AI tem configuração por implantação clara (banco, tokens de alerta). Valores como
  limites internos do produto se aproximam da "configuração interna" de [F87]. A divisão caso a caso é decisão.
- **Não busquei a fundo evidência sobre o efeito de números mágicos em defeitos**, e as consultas feitas não
  retornaram estudo direto **[confirmar]**.

## O que ficou sem fonte primária ou sem teste

- Efeito da língua do identificador em pessoas e em LLMs: nenhum estudo achado.
- `tsc`, ESLint, ast-grep e jscpd com identificadores acentuados; Java em Linux e em JAR.
- Limites de função, aninhamento ou parâmetros como regra para agentes; evidência específica sobre parâmetros.
- Origem primária da regra de três; texto de *Refactoring* e de *Evolving Frameworks*.
- Resultado por língua de HumanEval-XL; conteúdo de *When Comments Mislead*.
- Regras de Rust em produto pago da Sonar; licença efetiva do `eslint-plugin-sonarjs`.
- Regras de ast-grep medidas só em amostra; jscpd não executado.

## Fontes

Consultadas em 2026-11-18.

**Linguagens e guias**

- [F1] Rust Reference, identificadores: https://doc.rust-lang.org/reference/identifiers.html
- [F2] RFC 2457: https://rust-lang.github.io/rfcs/2457-non-ascii-idents.html
- [F3] rustc, lints de identificadores: https://github.com/rust-lang/rust/blob/master/compiler/rustc_lint/src/non_ascii_idents.rs
- [F4] Cargo, manifesto: https://doc.rust-lang.org/cargo/reference/manifest.html
- [F5] Cargo, validação de nomes: https://github.com/rust-lang/cargo/blob/master/crates/cargo-util-schemas/src/restricted_names.rs
- [F6] Rust API Guidelines, nomes: https://rust-lang.github.io/api-guidelines/naming.html
- [F7] Google TypeScript Style Guide: https://google.github.io/styleguide/tsguide.html
- [F8] Google Java Style Guide: https://google.github.io/styleguide/javaguide.html
- [F9] ECMAScript, gramática léxica: https://tc39.es/ecma262/multipage/ecmascript-language-lexical-grammar.html
- [F10] JLS SE 25, 3.8: https://docs.oracle.com/javase/specs/jls/se25/html/jls-3.html#jls-3.8

**Nomes: pessoas**

- [F11] Hofmeister et al.: https://doi.org/10.1109/saner.2017.7884623
- [F12] Schankin et al.: https://doi.org/10.1145/3196321.3196332
- [F13] Avidan e Feitelson: https://doi.org/10.1109/icpc.2017.27
- [F14] Lawrie et al.: https://doi.org/10.1109/icpc.2006.51
- [F15] Feitelson et al.: https://doi.org/10.1109/tse.2020.2976920
- [F16] Pawelka e Juergens: https://doi.org/10.1109/icsm.2015.7332491
- [F17] Guo: https://doi.org/10.1145/3173574.3173970
- [F18] Dasgupta e Hill: https://doi.org/10.1145/3051457.3051464
- [F19] Johnson et al.: https://doi.org/10.1109/icsme.2019.00085

**Nomes: LLMs**

- [F20] Wang et al.: https://arxiv.org/abs/2307.12488
- [F21] Le et al.: https://arxiv.org/abs/2510.03178
- [F22] Miceli Barone et al.: https://doi.org/10.18653/v1/2023.findings-acl.19
- [F23] *Variable Naming Impact*: https://doi.org/10.21203/rs.3.rs-7180885/v1
- [F24] *The Code Barrier*: https://arxiv.org/abs/2504.10557
- [F25] *Fault Localizability*: https://arxiv.org/abs/2504.04372
- [F26] NameTrap: https://arxiv.org/abs/2610.34253
- [F27] Viés multilíngue: https://doi.org/10.1145/3786793 e https://arxiv.org/abs/2404.19368
- [F28] HumanEval-XL: https://arxiv.org/abs/2402.16694 e https://github.com/FloatAI/humaneval-xl

**Limites**

- [F29] Clippy, funções: https://github.com/rust-lang/rust-clippy/blob/master/clippy_lints/src/functions/mod.rs e https://github.com/rust-lang/rust-clippy/blob/master/clippy_lints/src/functions/too_many_lines.rs
- [F30] Clippy, `cognitive_complexity`: https://github.com/rust-lang/rust-clippy/blob/master/clippy_lints/src/cognitive_complexity.rs
- [F31] Clippy, `excessive_nesting`: https://github.com/rust-lang/rust-clippy/blob/master/clippy_lints/src/excessive_nesting.rs
- [F32] Clippy, configuração: https://doc.rust-lang.org/clippy/lint_configuration.html
- [F33] Clippy, changelog e PR: https://github.com/rust-lang/rust-clippy/blob/master/CHANGELOG.md e https://github.com/rust-lang/rust-clippy/pull/15415
- [F34] ESLint: https://eslint.org/docs/latest/rules/max-depth , https://eslint.org/docs/latest/rules/max-params , https://eslint.org/docs/latest/rules/complexity e https://eslint.org/docs/latest/rules/max-lines-per-function
- [F35] Checkstyle: https://checkstyle.org/checks/sizes/methodlength.html , https://checkstyle.org/checks/sizes/parameternumber.html e https://checkstyle.org/checks/coding/nestedifdepth.html
- [F36] `google_checks.xml`: https://github.com/checkstyle/checkstyle/blob/master/src/main/resources/google_checks.xml
- [F37] Chowdhury et al.: https://doi.org/10.1145/3524842.3527975
- [F38] Landman et al.: https://doi.org/10.1109/icsme.2014.44
- [F39] Scalabrino et al.: https://doi.org/10.1109/tse.2019.2901468
- [F40] Muñoz Barón et al.: https://arxiv.org/abs/2007.12520
- [F41] Peitek et al.: https://doi.org/10.1109/icse43902.2021.00056
- [F42] Ajami et al.: https://doi.org/10.1109/icpc.2017.39
- [F43] Hatton: https://doi.org/10.1109/52.582978
- [F44] Palomba et al.: https://doi.org/10.1007/s10664-017-9535-z
- [F45] He et al.: https://arxiv.org/abs/2511.04427
- [F46] Cotroneo et al.: https://arxiv.org/abs/2508.21634
- [F47] Medição em repositórios reais: https://arxiv.org/abs/2603.27130

**Comentários**

- [F48] rustc, `missing_docs`: https://doc.rust-lang.org/rustc/lints/listing/allowed-by-default.html#missing-docs
- [F49] Clippy, lints de documentação: https://github.com/rust-lang/rust-clippy/blob/master/clippy_lints/src/doc/mod.rs
- [F50] rustdoc, lints: https://doc.rust-lang.org/rustdoc/lints.html
- [F51] Rust API Guidelines, documentação: https://rust-lang.github.io/api-guidelines/documentation.html
- [F52] `jsdoc/require-jsdoc`: https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-jsdoc.md
- [F53] TSDoc: https://tsdoc.org/
- [F54] `eslint-plugin-tsdoc`: https://tsdoc.org/pages/packages/eslint-plugin-tsdoc/
- [F55] TypeDoc, validação: https://typedoc.org/documents/Options.Validation.html
- [F56] SonarJS: https://github.com/SonarSource/SonarJS/blob/master/packages/analysis/src/jsts/rules/S125/rule.ts e https://www.npmjs.com/package/eslint-plugin-sonarjs
- [F56b] typescript-eslint, regras: https://github.com/typescript-eslint/typescript-eslint/tree/main/packages/eslint-plugin/docs/rules
- [F57] sonar-java, S125: https://github.com/SonarSource/sonar-java/blob/master/java-checks/src/main/java/org/sonar/java/checks/CommentedOutCodeLineCheck.java
- [F58] sonar-rust: https://github.com/SonarSource/sonar-rust e https://github.com/SonarSource/sonar-rust/tree/master/sonar-rust-plugin/src/main/resources/org/sonar/l10n/rust/rules/rust
- [F59] `eslint-plugin-no-commented-code`: https://www.npmjs.com/package/eslint-plugin-no-commented-code
- [F60] Checkstyle, Javadoc: https://checkstyle.org/checks/javadoc/missingjavadocmethod.html e https://checkstyle.org/checks/javadoc/missingjavadoctype.html
- [F61] PMD, documentação: https://github.com/pmd/pmd/blob/main/pmd-java/src/main/resources/category/java/documentation.xml
- [F61b] Checkstyle, checks: https://github.com/checkstyle/checkstyle/tree/master/src/site/xdoc/checks/misc e https://github.com/checkstyle/checkstyle/tree/master/src/site/xdoc/checks/coding
- [F62] Wen et al.: https://doi.org/10.1109/icpc.2019.00019
- [F63] Fluri et al.: https://doi.org/10.1109/wcre.2007.21
- [F64] Tan et al.: https://doi.org/10.1145/1294261.1294276
- [F65] Rani et al.: https://doi.org/10.1016/j.jss.2022.111515
- [F66] Börstler e Paech: https://doi.org/10.1109/tse.2016.2527791
- [F67] *When Comments Mislead*: https://doi.org/10.1145/3832783.3834359
- [F68] Comment Traps: https://arxiv.org/abs/2512.20334
- [F69] Comentários adversariais: https://arxiv.org/abs/2602.16741
- [F70] Comentários em código legado: https://arxiv.org/abs/2506.11007

**Duplicação**

- [F71] jscpd, doc do motor Rust: https://github.com/kucherenko/jscpd/blob/master/docs/rust.md
- [F71b] jscpd, README: https://github.com/kucherenko/jscpd/blob/master/README.md
- [F72] jscpd, CLI: https://github.com/kucherenko/jscpd/blob/master/rust/crates/cpd/src/cli.rs
- [F73] jscpd, formatos: https://github.com/kucherenko/jscpd/blob/master/FORMATS.md
- [F74] jscpd no npm: https://www.npmjs.com/package/jscpd
- [F75] Juergens et al.: https://doi.org/10.1109/icse.2009.5070547
- [F76] Rahman et al.: https://doi.org/10.1109/msr.2010.5463343
- [F77] Sajnani et al.: https://doi.org/10.1109/scam.2014.12
- [F78] GitClear: https://www.gitclear.com/ai_assistant_code_quality_2025_research
- [F79] Ciniselli et al.: https://doi.org/10.1145/3524842.3528440
- [F80] Aplicação do *Evolving Frameworks* ao JViews (secundária): https://nzjohng.github.io/publications/papers/EFPL.pdf
- [F81] Wikipedia, regra de três (secundária): https://en.wikipedia.org/wiki/Rule_of_three_(computer_programming)

**Números e configuração**

- [F82] Clippy, lints declarados: https://github.com/rust-lang/rust-clippy/blob/master/clippy_lints/src/declared_lints.rs
- [F83] ESLint, `no-magic-numbers`: https://eslint.org/docs/latest/rules/no-magic-numbers e https://github.com/eslint/eslint/blob/main/lib/rules/no-magic-numbers.js
- [F84] typescript-eslint, `no-magic-numbers`: https://typescript-eslint.io/rules/no-magic-numbers
- [F85] Checkstyle, `MagicNumber`: https://checkstyle.org/checks/coding/magicnumber.html
- [F86] ast-grep: https://ast-grep.github.io/reference/languages.html e https://ast-grep.github.io/guide/rule-config/atomic-rule.html
- [F87] The Twelve-Factor App, Config: https://12factor.net/config
