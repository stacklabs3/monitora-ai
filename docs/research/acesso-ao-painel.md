# Acesso ao painel: login, sessão, segundo fator e chave de envio

Ticket: [Pesquisar login, sessão e segundo fator em Rust para o painel](https://github.com/stacklabs3/monitora-ai/issues/95).
Consulta: **2026-11-28**. Comparação, não escolha. Critério do humano: rápido de execução e baixo custo de
hospedagem.

**Pergunta.** Que opções o servidor em Rust (`axum` 0.8) tem para cumprir as regras de acesso já decididas em
[Definir privacidade, acesso e retenção](https://github.com/stacklabs3/monitora-ai/issues/8) (itens 1, 2, 13
e 14): entrada só por convite, segundo fator obrigatório, sessão de até 8 h que cai após 1 h parada, e chave
de envio guardada só embaralhada e conferida a cada lote, sem pesar no envio que confirma em 1 s?

Cenário fixo (ADRs [0003](../adr/0003-modulos-e-seams-do-servidor.md) e
[0009](../adr/0009-cadastro-em-sqlite-embutido.md)): um servidor em Rust, cadastro em SQLite pelo `rusqlite`
0.43 (`bundled`, WAL), painel em Solid servido pelo mesmo servidor, uma máquina Lightsail de 2 GB com o
OpenSearch dentro, poucos usuários (dezenas), uma pessoa mantendo. A página de preços do Lightsail lista o
plano Linux de 2 GB com 2 vCPUs [A1].

Como ler: cada afirmação leva a fonte entre colchetes (lista no fim). **[confirmar]** marca o que não foi
verificado em fonte primária; **sem medida** marca o que nenhuma fonte primária mede. Versões, datas,
licenças, MSRV e downloads vêm da API do crates.io; dono, estrelas e último push vêm da API do GitHub, ambas
lidas em 2026-11-28. "Downloads" é o campo `recent_downloads` (últimos 90 dias). Exemplos sintéticos: a Ana,
o Excurfly.

## 1. Os caminhos, lado a lado

| | Login próprio | Google (OIDC) ou GitHub (OAuth) | Serviço gerenciado | Provedor auto-hospedado |
|---|---|---|---|---|
| Custo mensal | US$ 0 (só crates); com link por e-mail, SES a US$ 0,10 por mil mensagens [E1] | sem preço na documentação lida [G1][H1]; **[confirmar]** que não há cobrança | Auth0 com segundo fator: a partir de US$ 35; Clerk: US$ 25; WorkOS AuthKit: grátis até 1 milhão de usuários; Cognito: grátis até 10 mil [P1][P2][P3][P4] | US$ 0 de licença; custa memória na máquina de 2 GB (seção 6) |
| Dependência externa em produção | nenhuma (com e-mail: AWS SES) | Google ou GitHub no ar para entrar | o serviço no ar para entrar | nenhuma, mas é um segundo serviço para operar |
| Quem garante o segundo fator | o servidor (TOTP ou passkey conferidos por ele) | o provedor **não deixa exigir**; no máximo informa (seção 5) | o serviço, configurado nele | o provedor auto-hospedado |
| Entrada só por convite | token de convite gerado pelo servidor | lista de e-mails permitidos no servidor | convite ou lista no serviço | cadastro no provedor |
| Sessão do painel | própria | própria (o provedor só diz quem é) | própria ou a do serviço | própria ou a do provedor |
| Credenciais a guardar | segredo TOTP ou chave pública da passkey; hash de senha, se houver | `client secret` do provedor | chaves de API do serviço | banco e segredos do provedor |
| Código a escrever | o maior | médio (fluxo OIDC, lista, sessão) | médio (integração, sessão) | médio (integração, sessão) mais a operação |

## 2. Login próprio: primeiro fator

### 2.1 Senha com Argon2

| Crate | Versão (data) | Licença | Quem mantém | Downloads | MSRV |
|---|---|---|---|---|---|
| `argon2` | 0.6.0 (2026-08-27), série 0.x | MIT OR Apache-2.0 | org `RustCrypto` (repo `password-hashes`, 925 estrelas, push 2026-11-09) | 34,5 mi | 1.85 [C1][R1] |
| `password-hash` | 0.6.1 (2026-04-08), série 0.x | MIT OR Apache-2.0 | org `RustCrypto` (repo `traits`) | 52,3 mi | 1.85 [C2] |

- **Parâmetros da OWASP:** Argon2id com no mínimo 19 MiB de memória, 2 iterações e paralelismo 1
  (`m=19456, t=2, p=1`); alternativas equivalentes: `m=47104 (46 MiB), t=1, p=1`, `m=12288, t=3`,
  `m=9216, t=4`, `m=7168, t=5`. "Como regra geral, calcular um hash deve levar menos de um segundo" [O1].
- **NIST SP 800-63B-4:** senha se guarda com sal (mínimo de 32 bits) e esquema de hash de senha, com custo
  "tão alto quanto prático sem prejudicar o desempenho do verificador" [N1].
- **Custo de cada verificação:** a memória é a do parâmetro (19 ou 46 MiB alocados durante o cálculo) [O1].
  Tempo medido **na máquina local, não no Lightsail** (seção 7): 10 a 12 ms com `m=19456, t=2` e 14 a 16 ms
  com `m=47104, t=1`. No Lightsail de 2 vCPUs compartilhados: **sem medida**.
- A senha é o único caso desta pesquisa em que o segredo é escolhido por gente; convite, sessão e chave de
  envio são aleatórios gerados pelo servidor (seção 7).

### 2.2 Link por e-mail (magic link)

- **Exige enviar e-mail**, o que acrescenta um serviço externo, uma conta AWS e credenciais no servidor.
- **Amazon SES:** US$ 0,10 por mil mensagens sem plano; anexos a US$ 0,12 por GB [E1]. Conta nova começa no
  *sandbox*: só envia para endereços e domínios verificados, no máximo 200 mensagens em 24 h e 1 por
  segundo. Sair do sandbox pede um formulário, com resposta inicial da AWS em até 96 h; a identidade usada
  como remetente continua precisando ser verificada [E2].
- **Crates:** `lettre` 0.11.24 (2026-11-17, MIT, org `lettre`, 2.282 estrelas, 10,0 mi de downloads, MSRV
  1.85) envia por SMTP [C3][R2]; `aws-sdk-sesv2` 1.150.0 (2026-11-25, Apache-2.0, `awslabs`, MSRV 1.94.1)
  chama a API do SES [C4]. Chamar a API do SES direto pelo `reqwest`, assinando a requisição à mão:
  **[confirmar]** esforço, não levantado.
- **OWASP sobre e-mail como fator:** código ou link por e-mail depende da segurança da caixa de e-mail, que
  "muitas vezes não tem MFA"; a página o lista "por completude" e registra a dúvida sobre contar como MFA
  [O4]. **NIST:** "E-mail NÃO DEVE ser usado para autenticação fora de banda" [N1].
- **Token do link (OWASP, tokens em URL):** gerado por gerador aleatório criptográfico, longo o bastante
  contra força bruta, de uso único, com vencimento, guardado de forma segura; a página que recebe o token
  leva `Referrer-Policy: no-referrer` [O5].

## 3. Login próprio: segundo fator

| | TOTP | Passkey (WebAuthn) |
|---|---|---|
| Norma | RFC 6238 [T1] | W3C WebAuthn nível 3 [W1] |
| Crate | `totp-rs` 6.0.0 (2026-08-06), MIT, conta pessoal `constantoine`, 284 estrelas, push 2026-10-30, 4,1 mi de downloads, MSRV 1.88 [C5][R3]. Alternativa: `totp-lite` 2.0.1 (2023-10-30), MIT, conta pessoal `fosskers`, 33 estrelas, 0,65 mi de downloads [C6][R4] | `webauthn-rs` 0.6.2 (2026-10-31), série 0.x, MPL-2.0, org `kanidm`, 726 estrelas, push 2026-11-26, 3,9 mi de downloads, MSRV 1.89 [C7][R5]. Alternativa: `passkey` 0.6.0 (2026-10-01), MIT OR Apache-2.0, `1Password` [C8] |
| Criptografia | HMAC-SHA-1 por padrão da norma; SHA-256 e SHA-512 permitidos [T1] | desde a 0.6.0 usa RustCrypto "em vez de OpenSSL" [R5]; `webauthn-rs-core` 0.6.2 depende de `crypto-glue`, "fachada sobre o ecossistema RustCrypto" [C9] |
| Exigências de ambiente | relógio do servidor certo; nada de domínio | HTTPS e checagem de origem pelo navegador [R5]; `rp_id` é um domínio efetivo da origem e "NÃO pode ser mudado sem quebrar todas as credenciais dos usuários" [W2] |
| Lado do navegador | um campo de 6 dígitos | chamadas a `navigator.credentials`; a norma lista `parseCreationOptionsFromJSON()` e `parseRequestOptionsFromJSON()` para montar as opções a partir de JSON [W1]. Suporte desses dois métodos em cada navegador: **[confirmar]** |
| Resistência a phishing | "OTP não é resistente a phishing" [N1]; a OWASP diz o mesmo, com o código de vida curta [O4] | resistente: a credencial é presa à origem [O4][R5] |
| Auditoria | não levantada **[confirmar]** | "passou por auditoria de segurança da equipe de segurança de produto da SUSE" [R5] |

**TOTP, o que a norma e o crate dizem.**

- Passo de 30 s recomendado; aceitar "no máximo um passo" de atraso; "o verificador NÃO DEVE aceitar a
  segunda tentativa" do mesmo código depois de validá-lo (guardar o último passo usado); o segredo é
  aleatório e fica protegido no servidor [T1].
- O segredo TOTP precisa ser lido em claro pelo servidor para conferir o código: não dá para guardá-lo só
  em hash, ao contrário da senha e da chave de envio. A norma recomenda guardá-lo cifrado [T1]. Combina com
  o item 11 da resolução de privacidade (dados cifrados na máquina, chave fora do disco).
- `totp-rs`: features `otpauth` (monta a URL `otpauth://`), `qr` (gera o QR code, pelo crate
  `qrcodegen-image`), `gen_secret`, `serde`, `zeroize`, `steam` [C5]. A documentação avisa que alguns
  aplicativos aceitam SHA-256 e SHA-512 mas "caem em silêncio para SHA-1" [T2]. Comparação em tempo
  constante: o crate depende de `constant_time_eq`, mas a página não afirma **[confirmar]** [T2].
- QR code no servidor também sai do crate `qrcode` 0.15.0 (2026-11-19, MIT OR Apache-2.0, conta pessoal
  `kennytm`, 9,2 mi de downloads) [C10]; gerar o QR no navegador, sem crate: **[confirmar]**, não levantado.
- **Códigos de recuperação:** nenhum dos crates de TOTP os traz [T2]. A OWASP lista "códigos de recuperação
  de uso único entregues na configuração do MFA" como uma das saídas para quem perde o fator, ao lado de
  exigir mais de um fator cadastrado ou de outra pessoa de confiança atestar; trocar de fator pede
  reautenticação [O4]. O NIST manda guardar segredos de consulta em hash: com 112 bits ou mais, hash
  aprovado; abaixo disso, sal e esquema de hash de senha [N1].

**Passkey, o que muda.**

- O `webauthn-rs` exige verificação do usuário (PIN ou biometria) por padrão e confere a resposta [R5]. A
  OWASP: um toque só de presença "não é um segundo fator"; o servidor deve validar a marca de verificação
  do usuário [O4].
- O README avisa que passkeys sincronizadas (iCloud, Google Password Manager) "podem ser copiadas, e
  algumas nem implementam a verificação do usuário direito, então só devem ser usadas com um segundo fator
  seguro" [R5].
- O estado do registro e do login (o desafio) fica no servidor entre os dois passos; serializá-lo pede a
  feature `danger-allow-state-serialisation`, e guardá-lo em cookie no cliente "permite ataques de
  repetição" [W3].
- O domínio do painel vira parte da credencial: trocar o domínio depois obriga todos a recadastrar [W2].
- NIST: no nível AAL2, o verificador "DEVE oferecer ao menos uma opção resistente a phishing" [N1]. É norma
  do governo dos EUA, sem aplicação direta aqui; fica como referência.

## 4. Sessão

### 4.1 Requisitos decididos contra as referências

| Regra do projeto | OWASP Session Management [O2] | NIST SP 800-63B-4, AAL2 [N1] |
|---|---|---|
| até 8 h no total | "entre 4 e 8 horas" para quem usa o dia inteiro no escritório | até 24 h |
| cai após 1 h parada | 15 a 30 min para baixo risco; 2 a 5 min para alto valor | até 1 h |

Demais pontos da OWASP [O2]:

- **Identificador:** ao menos 64 bits de entropia; gerado por gerador aleatório criptográfico "de ao menos
  128 bits"; sem dado pessoal dentro, só um identificador.
- **Cookie:** `Secure`, `HttpOnly` ("obrigatório" contra roubo por XSS), `SameSite=Strict` (preferido) ou
  `Lax`, prefixo `__Host-` (exige `Secure`, sem `Domain`, `Path=/`).
- **Renovar o identificador** depois de qualquer mudança de privilégio, inclusive o login.
- **Vencimentos conferidos no servidor.**
- **Guarda:** guardar o token em claro "pode ser aceitável num armazenamento bem controlado", mas a
  recomendação, se a leitura indevida do armazenamento preocupa, é guardar um verificador: SHA-256 do
  valor, comparado em tempo constante.
- **Nunca** em `localStorage` ou `sessionStorage`. `Cache-Control: no-store` nas respostas com dado de
  sessão; `Clear-Site-Data` na saída.

### 4.2 As três formas

| | `tower-sessions` | `axum-login` | Feita à mão |
|---|---|---|---|
| Versão (data) | 0.15.0 (2026-02-01), série 0.x [C11] | 0.19.0 (2026-11-21), série 0.x [C12] | não há crate |
| Licença | MIT | MIT | nenhuma a mais |
| Quem mantém | conta pessoal `maxcountryman`, 426 estrelas, push 2026-10-26 [R6] | a mesma conta, 1.028 estrelas, push 2026-11-22 [R7] | o projeto |
| Downloads | 1,6 mi | 0,76 mi | |
| O que entrega | middleware de sessão chave-valor com extrator para `axum`; armazenamento por trait `SessionStore` [R6] | identificação, autenticação e permissões em cima do `tower-sessions`; o projeto implementa `AuthUser` e `AuthnBackend` [R7] | o que o módulo de acesso escrever |
| Identificador | `i128` (128 bits) gerado pelo `rand` [S1] | o do `tower-sessions` | à escolha (a OWASP pede 64 bits de entropia no mínimo) [O2] |
| Vencimento | um só por sessão: `OnSessionEnd`, `OnInactivity` **ou** `AtDateTime`; a enum não combina teto absoluto com inatividade. Em `OnInactivity`, "ler a sessão não conta como atividade" [S2] | o do `tower-sessions` | duas colunas (criada em, último uso) e duas comparações |
| Renovar o id no login | `cycle_id` existe no código [S3] | **[confirmar]** se chama sozinho | escrito no módulo |
| Segundo fator | não trata | o README não lista segundo fator [R7] | escrito no módulo |
| Limpeza das vencidas | trait `ExpiredDeletion`; tarefa periódica nos stores sem expiração própria [S1] | idem | um `DELETE` periódico |

**Existe store do `tower-sessions` para `rusqlite`?** Sim: `tower-sessions-rusqlite-store` 0.15.0
(2026-10-04), MIT, conta pessoal `patte`, 6 estrelas, 1.766 downloads em 90 dias, 14.669 no total; 40 dos
commits são do dono; o README se descreve como "fork não oficial" do `tower-sessions-stores` [C13][R8].

- Usa o `tokio-rusqlite`, não o `rusqlite` direto [R8]. O ADR 0009 descartou o `tokio-rusqlite` e escreveu
  a thread com canal no próprio módulo.
- A 0.15.0 depende de `rusqlite ^0.40.2` e `tokio-rusqlite ^0.8.0` [C13]; o `tokio-rusqlite` 0.8.0 pede
  `rusqlite ^0.40.1` [C14]. O projeto usa `rusqlite` 0.43 (ADR 0009), que pede `libsqlite3-sys ^0.40.0`,
  enquanto o `rusqlite` 0.40.2 pede `libsqlite3-sys ^0.38` [C15]. Se as duas versões convivem no mesmo
  binário: **[confirmar]** (crates que ligam a mesma biblioteca nativa costumam não poder repetir; não
  testado).
- A tabela dele guarda o identificador da sessão em texto, como chave primária; o código lido não faz hash
  [R8].
- O store oficial em SQL é o `tower-sessions-sqlx-store` 0.16.0 (2026-11-11, MIT, mesma conta
  `maxcountryman`, 0,24 mi de downloads), sobre `sqlx` [C16]; o ADR 0009 descartou o `sqlx`.
- A outra saída é implementar o trait `SessionStore` sobre a conexão do cadastro: o README diz que as
  aplicações "podem e devem implementar stores para suas necessidades" [R6].

**Cookie assinado ou JWT, sem estado, contra sessão no servidor.** A OWASP diz que o identificador "deve
ser só um identificador" no cliente e que o significado da sessão fica no servidor; a página não dá
orientação própria para sessão em JWT [O2]. Com sessão no servidor, apagar a linha encerra a sessão na
requisição seguinte. Com token sem estado, o token vale até vencer; cortar antes pede uma lista de
revogados consultada a cada requisição, o que devolve o estado ao servidor: **[confirmar]** em fonte
primária (raciocínio, não citação). A resolução de privacidade pede permissão "conferida em toda
requisição" (item 13). O `tower-sessions` tem as features `signed` e `private` para o cookie, descritas
como defesa extra, porque o cookie só leva o identificador [S1].

**CSRF para SPA no mesmo domínio.** OWASP [O3]:

- `SameSite` "não substitui uma defesa de CSRF na maioria das implantações": é camada extra.
- Cabeçalho próprio na requisição: "especialmente adequado a endpoints AJAX ou de API", sem token, mas
  depende do preflight do CORS, então as origens permitidas precisam ser estreitas.
- Fetch Metadata (`Sec-Fetch-Site`): "leve e confiável", com a conferência de `Origin` como reserva
  obrigatória.
- `Origin` ausente ou `null` "não é evidência de mesma origem".
- Token sincronizado (com estado) e cookie duplo assinado (sem estado) são os padrões com token; o cookie
  duplo sem assinatura é desaconselhado.

## 5. Convite

- A regra é do projeto (item 14). A OWASP não tem página só de convite; o que há é a regra de token em URL:
  aleatório criptográfico, longo, de uso único, com vencimento, guardado de forma segura, e
  `Referrer-Policy: no-referrer` na página que o recebe [O5].
- **Sem e-mail:** o servidor mostra o link uma vez ao Administrador, que o copia e entrega por fora (a
  Stripe mostra a chave uma vez e não a recupera depois [K2]). O canal de entrega fica fora do sistema e
  fora da auditoria. Ex.: o Administrador do Excurfly gera o convite da Ana, copia o link e manda pelo
  canal da equipe; a Ana abre, cadastra o segundo fator e entra.
- **Com provedor externo:** o convite vira uma lista de e-mails permitidos no cadastro; quem entra pelo
  Google ou GitHub com e-mail fora da lista é recusado. O Google manda conferir `email_verified` e, para
  restringir por domínio, a claim `hd` no servidor (o parâmetro `hd` na URL é só atalho de tela) [G1].

## 6. Provedor externo

### 6.1 Google (OIDC) e GitHub (OAuth)

| Crate | Versão (data) | Licença | Quem mantém | Downloads | MSRV |
|---|---|---|---|---|---|
| `openidconnect` | 4.1.0 (2026-10-31) | MIT | conta pessoal `ramosbugs`, 651 estrelas, push 2026-10-31 | 6,5 mi | 1.88 [C17][R9] |
| `oauth2` | 5.0.0 (2025-01-21) | MIT OR Apache-2.0 | a mesma conta, 1.212 estrelas, push 2026-02-22 | 20,8 mi | 1.65 [C18][R10] |

| | Google | GitHub |
|---|---|---|
| Protocolo | OpenID Connect, com ID token [G1] | OAuth 2.0: a resposta traz `access_token`, `scope` e `token_type`; a página do fluxo web não cita OpenID Connect nem `id_token` [H1]. Quem é a pessoa sai de `GET /user` |
| O que exige | projeto no Google Cloud Console, tela de consentimento, `client ID` e `client secret`, URI de retorno que "precisa bater exatamente" e em HTTPS [G1] | OAuth app registrado, `client secret`, URL de retorno cadastrada; PKCE aceito só com `S256` [H1]; escopos `read:user` e `user:email` [H2] |
| Público | tipo *External* em *Testing*: até 100 usuários de teste, e a autorização vence em 7 dias; *Internal* exige organização do Google Cloud [G2] | qualquer conta do GitHub |
| Preço | a documentação lida não cita preço [G1]; **[confirmar]** | idem [H1]; **[confirmar]** |
| **Garante segundo fator?** | **Não.** "O Google não aceita pedidos de reautenticação"; quem define a política de verificação em duas etapas é o dono da conta ou o administrador do Workspace [G3]. A obrigatoriedade é configurada no Admin console do Workspace, por super administrador [G4]; a página não cobre conta Gmail comum | **Não.** O 2FA obrigatório vale para contas selecionadas como contribuidoras (quem publica app, action, release ou pacote, dono de organização); quem não recebeu o aviso "não é obrigado" [H3] |
| Dá para saber se usou? | a claim `amr` (valores `mfa`, `pwd`, `hwk`, `swk`, `sms`, `tel`) é pedida pelo parâmetro `claims`, só com o app publicado e verificado e a opção ligada no console; mesmo assim "pode não vir". `acr` não aparece na documentação [G1][G3] | `GET /user` devolve `two_factor_authentication` (booleano) na resposta privada, com escopo `read:user` ou `user` [H4]. Diz se a conta tem 2FA ligado, não se foi usado naquele login |

- **Sessão própria continua necessária:** o provedor entrega a identidade uma vez, no retorno do login. O
  teto de 8 h, a queda após 1 h parada e a permissão conferida a cada requisição são do servidor (seção 4).
- **Cumprir "segundo fator obrigatório" com provedor externo** dá em três formas, pelos fatos acima: recusar
  quem chega sem `amr: mfa` (Google) ou sem `two_factor_authentication: true` (GitHub); exigir um segundo
  fator próprio depois do login externo (seção 3); ou aceitar a política do provedor como está.

### 6.2 Serviços gerenciados

| Serviço | Plano grátis | Segundo fator | Menor plano com segundo fator |
|---|---|---|---|
| Auth0 | até 25.000 usuários ativos por mês | não incluso no grátis | B2C Essentials, US$ 35/mês [P1] |
| Clerk | até 50.000 usuários retidos por mês, por app | não incluso no grátis; convites inclusos | Pro, US$ 25/mês (US$ 20 no anual) [P2] |
| WorkOS AuthKit | primeiro 1 milhão de usuários ativos | incluso (senha, social, passkeys, MFA, link mágico) | grátis; SSO corporativo a US$ 125 por conexão [P3] |
| AWS Cognito | 10.000 usuários ativos por mês (Lite e Essentials) | aplicativo autenticador e SMS inclusos nos três níveis; passkeys só em Essentials e Plus; SMS e e-mail cobrados à parte | grátis até o limite [P4] |

Com dezenas de usuários, os quatro cabem no plano grátis em volume; o segundo fator é o que separa. Limite
de pedidos, região dos dados e contrato de tratamento de dados (LGPD): **[confirmar]**, não levantados.

### 6.3 Provedores auto-hospedados

| | Versão (data) | Licença | Linguagem | Memória | Banco |
|---|---|---|---|---|---|
| Keycloak | 26.8.2 (2026-11-05) | Apache-2.0 | Java (JVM) | "1.250 MB de RAM" de base por pod, com 70% do limite em heap e cerca de 300 MB fora dele [X1] | **[confirmar]** |
| Authelia | 4.39.28 (2026-09-17) | Apache-2.0 | Go | "normalmente abaixo de 30 megabytes"; contêiner menor que 20 MB; provedor OpenID Connect certificado; TOTP, WebAuthn e push [X2] | **[confirmar]** |
| ZITADEL | 4.20.6 (2026-11-25) | AGPL-3.0 | Go | "cerca de 512 MB"; recomenda 4 núcleos para o hash de senhas | PostgreSQL [X3] |
| Ory Kratos | 26.2.0 (2026-03-20) | Apache-2.0 | Go | sem número na página lida | PostgreSQL, MySQL ou CockroachDB; "não use SQLite em produção" [X4] |

Versões e licenças: API do GitHub [X5]. Contra o teto do ADR 0002 (banco e servidor juntos em até 1,5 GB na
máquina de 2 GB): o Keycloak sozinho pede 1.250 MB; ZITADEL e Kratos pedem um PostgreSQL, que o ADR 0009
descartou por reservar 128 MB só de `shared_buffers`.

## 7. Chave de envio conferida a cada lote

**O que as referências dizem sobre hash rápido para segredo aleatório.**

- **NIST SP 800-63B-4:** segredos de consulta se guardam em hash; com ao menos 112 bits de entropia, basta
  uma função de hash aprovada; com menos, exige sal e esquema de hash de senha [N1]. O custo alto do
  Argon2 existe para compensar a baixa entropia de segredo escolhido por gente.
- **OWASP Session Management:** para token aleatório do servidor, o verificador recomendado é SHA-256 do
  valor (com 128 bits ou mais, "prefira 160"), comparado em tempo constante [O2].
- **OWASP Password Storage:** trata de senhas; não fala de chave de API nem de token de alta entropia [O1].
- **GitHub:** tokens com prefixo de tipo (`ghp_`, `gho_`, `ghs_`...) e um CRC32 nos 6 últimos caracteres em
  Base62, para a varredura de segredos descartar falsos positivos sem consultar o banco; cerca de 178 bits
  de entropia em 30 caracteres Base62 [K1]. Como o GitHub guarda os tokens: as páginas lidas não dizem
  **[confirmar]** [K1][K3].
- **Stripe:** prefixos `sk_live_`, `rk_live_`, `pk_live_`; a chave criada em produção aparece uma vez e
  "não podemos recuperar"; na rotação, a antiga e a nova valem juntas por até 7 dias [K2]. Como a Stripe
  guarda: a página não diz **[confirmar]**.
- **HMAC-SHA-256 com segredo do servidor** em vez de SHA-256 puro: equivale ao *pepper* que a OWASP
  descreve para senhas (segredo fora do banco, em cofre; se vazar, precisa trocar) [O1]. Para token de alta
  entropia, nenhuma fonte lida exige isso: **[confirmar]**.

**Crates.**

| Crate | Versão (data) | Licença | Quem mantém | Downloads | MSRV |
|---|---|---|---|---|---|
| `sha2` | 0.11.2 (2026-11-25), série 0.x | MIT OR Apache-2.0 | org `RustCrypto` | 427 mi | 1.88 [C19] |
| `hmac` | 0.13.0 (2026-03-29), série 0.x | MIT OR Apache-2.0 | org `RustCrypto` | 259 mi | 1.85 [C20] |
| `blake3` | 1.8.8 (2026-11-26) | CC0-1.0 OR Apache-2.0 | org `BLAKE3-team` | 68,6 mi | não declarado [C21] |
| `subtle` | 2.6.1 (2024-06-24) | BSD-3-Clause | org `dalek-cryptography`; último push 2024-08-03 | 262 mi | não declarado [C22][R11] |
| `constant_time_eq` | 0.6.2 (2026-11-25), série 0.x | CC0-1.0 OR MIT-0 OR Apache-2.0 | repositório no Codeberg (`cesarb`) | 108 mi | 1.66 [C23] |
| `rand` | 0.10.4 (2026-11-15), série 0.x | MIT OR Apache-2.0 | org `rust-random` | 697 mi | 1.85 [C24] |
| `getrandom` | 0.4.3 (2026-06-17), série 0.x | MIT OR Apache-2.0 | org `rust-random` | 894 mi | 1.85 [C25] |
| `base64` | 0.23.1 (2026-08-04), série 0.x | MIT OR Apache-2.0 | conta pessoal `marshallpierce` | 590 mi | 1.71 [C26] |

**Custo por conferência, medido na máquina local.** Não é o Lightsail: Apple M5, 10 núcleos, 24 GB,
macOS, `rustc` 1.99.1, `--release`, uma thread, duas rodadas. Script descartável fora do repositório, com
`sha2` 0.10.9, `hmac` 0.12.1, `blake3` 1.8.8, `subtle` 2.6.1 e `argon2` 0.5.3 (versões anteriores às da
tabela acima; a ordem de grandeza é o que interessa). Entrada: uma chave sintética de 56 bytes.

| Operação | Tempo por conferência | Memória por conferência |
|---|---|---|
| SHA-256 mais comparação em tempo constante | 235 a 267 ns | desprezível |
| HMAC-SHA-256 | 566 a 586 ns | desprezível |
| BLAKE3 | 52 a 57 ns | desprezível |
| Argon2id `m=19456, t=2, p=1` | 10,3 a 12,3 ms | 19 MiB |
| Argon2id `m=47104, t=1, p=1` | 14,3 a 15,8 ms | 46 MiB |

A diferença é de quatro a cinco ordens de grandeza. A medida tem controle: o mesmo laço roda as duas
famílias, e o Argon2 sai milhares de vezes mais lento, como o parâmetro prevê. No Lightsail de 2 vCPUs
compartilhados, os números absolutos: **sem medida** (benchmark primário publicado: não encontrado,
**[confirmar]**). Conta, não medida: 10 aplicações mandando um lote a cada 2 s dão 5 conferências por
segundo; com Argon2 de 19 MiB a 12 ms seriam 60 ms de CPU por segundo, e cada conferência simultânea
alocaria 19 MiB.

**Como achar a chave.**

| Forma | Como funciona | O que implica |
|---|---|---|
| Hash como índice único | guarda `SHA-256(chave)` numa coluna com índice único; a conferência é um `SELECT` pelo hash | uma busca indexada; não precisa de prefixo; a igualdade é feita pelo índice do SQLite, não por comparação em tempo constante |
| Prefixo identificador mais verificador | a chave tem uma parte pública (identifica a linha) e uma parte secreta; busca pela parte pública e compara o hash da secreta em tempo constante | é o desenho que a OWASP descreve para sessão: "nunca aceite o identificador sozinho como prova" [O2]; o prefixo aparece em telas e logs sem expor o segredo |

- Um prefixo fixo de produto e um checksum, como os do GitHub, servem à varredura de segredos em
  repositórios [K1]; não mudam a conferência.
- **Cache em memória:** nenhuma fonte primária lida trata do caso **[confirmar]**. Fatos do cenário: a
  regra é "cancelamento imediato" (item 2); o servidor é um processo só, e quem cancela a chave é ele
  mesmo, então a entrada do cache pode ser apagada na mesma operação que grava o cancelamento. Com até duas
  chaves ativas por aplicação e dezenas de aplicações, o cache inteiro tem dezenas de entradas. Latência da
  leitura no SQLite em WAL, sem cache, no disco do Lightsail: **sem medida**.
- **Duas chaves ativas:** as duas formas aceitam, com uma linha por chave.

## 8. O que a pesquisa deixa para a decisão

1. **Próprio ou externo.** O login próprio não depende de ninguém no ar e garante o segundo fator sozinho;
   o externo tira a senha do servidor, mas nem Google nem GitHub deixam exigir segundo fator (seção 6.1).
2. **Como cumprir "segundo fator obrigatório" se o login for externo:** recusar sem `amr`/`two_factor`,
   somar um fator próprio, ou aceitar a política do provedor. A terceira não cumpre a regra à risca.
3. **Primeiro fator do login próprio:** senha com Argon2id (19 a 46 MiB e dezenas de ms por login, poucas
   vezes ao dia) ou link por e-mail (conta AWS, SES, sandbox, credenciais; e-mail não conta como fator fora
   de banda para o NIST).
4. **Segundo fator:** TOTP (simples, sem domínio, não resiste a phishing, segredo legível no servidor) ou
   passkey (resiste a phishing, prende o domínio para sempre, crate 0.x sob MPL-2.0, mais código no
   navegador). Ou os dois.
5. **Perda do fator:** códigos de recuperação, segundo fator reserva, ou o Administrador refazer o convite.
6. **Sessão:** `tower-sessions` (não combina teto de 8 h com inatividade de 1 h numa enum; o store de
   `rusqlite` é de conta pessoal, pouco usado, sobre `tokio-rusqlite` e `rusqlite` 0.40) ou sessão escrita
   no módulo de acesso sobre a conexão do cadastro.
7. **Identificador de sessão guardado em claro ou em hash** no SQLite (a OWASP aceita os dois, com
   ressalva).
8. **Defesa de CSRF:** qual combinação de `SameSite`, cabeçalho próprio, `Sec-Fetch-Site` e `Origin`.
9. **Entrega do convite sem e-mail:** o link copiado pelo Administrador sai por um canal que a auditoria
   não vê; prazo de validade do convite.
10. **Hash da chave de envio:** SHA-256 puro ou HMAC-SHA-256 com segredo do servidor (onde mora esse
    segredo, e o que acontece se ele trocar).
11. **Formato da chave:** com prefixo e checksum ao estilo do GitHub, ou só aleatória; busca pelo hash ou
    por prefixo mais verificador.
12. **Cache da chave em memória:** usar ou ler o SQLite a cada lote; falta medir a leitura no Lightsail.
13. **Medidas que faltam no Lightsail:** Argon2id com os parâmetros da OWASP nos 2 vCPUs compartilhados e a
    leitura da chave no SQLite. Pela RP1, cada medida precisa de controle que reprove.

## Fontes

Todas lidas em 2026-11-28.

**Normas e guias**

- [O1] OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- [O2] OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- [O3] OWASP CSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- [O4] OWASP Multifactor Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html
- [O5] OWASP Forgot Password Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- [N1] NIST SP 800-63B-4: https://pages.nist.gov/800-63-4/sp800-63b.html (lidos os primeiros 100 mil caracteres; a seção de sessão ficou fora)
- [T1] RFC 6238 (TOTP): https://www.rfc-editor.org/rfc/rfc6238
- [W1] W3C Web Authentication nível 3: https://www.w3.org/TR/webauthn-3/ (lido o começo e o sumário)

**Crates (API do crates.io, `https://crates.io/api/v1/crates/<nome>`)**

- [C1] https://crates.io/api/v1/crates/argon2 · [C2] https://crates.io/api/v1/crates/password-hash
- [C3] https://crates.io/api/v1/crates/lettre · [C4] https://crates.io/api/v1/crates/aws-sdk-sesv2
- [C5] https://crates.io/api/v1/crates/totp-rs · [C6] https://crates.io/api/v1/crates/totp-lite
- [C7] https://crates.io/api/v1/crates/webauthn-rs · [C8] https://crates.io/api/v1/crates/passkey
- [C9] https://crates.io/api/v1/crates/webauthn-rs-core/0.6.2/dependencies e https://crates.io/api/v1/crates/crypto-glue
- [C10] https://crates.io/api/v1/crates/qrcode
- [C11] https://crates.io/api/v1/crates/tower-sessions · [C12] https://crates.io/api/v1/crates/axum-login
- [C13] https://crates.io/api/v1/crates/tower-sessions-rusqlite-store e `/0.15.0/dependencies`
- [C14] https://crates.io/api/v1/crates/tokio-rusqlite/0.8.0/dependencies
- [C15] https://crates.io/api/v1/crates/rusqlite/0.43.0/dependencies e https://crates.io/api/v1/crates/rusqlite/0.40.2/dependencies
- [C16] https://crates.io/api/v1/crates/tower-sessions-sqlx-store
- [C17] https://crates.io/api/v1/crates/openidconnect · [C18] https://crates.io/api/v1/crates/oauth2
- [C19] https://crates.io/api/v1/crates/sha2 · [C20] https://crates.io/api/v1/crates/hmac
- [C21] https://crates.io/api/v1/crates/blake3 · [C22] https://crates.io/api/v1/crates/subtle
- [C23] https://crates.io/api/v1/crates/constant_time_eq · [C24] https://crates.io/api/v1/crates/rand
- [C25] https://crates.io/api/v1/crates/getrandom · [C26] https://crates.io/api/v1/crates/base64

**Repositórios e documentação dos crates**

- [R1] https://github.com/RustCrypto/password-hashes · [R2] https://github.com/lettre/lettre
- [R3] https://github.com/constantoine/totp-rs · [R4] https://github.com/fosskers/totp-lite
- [R5] https://github.com/kanidm/webauthn-rs (README)
- [R6] https://github.com/maxcountryman/tower-sessions (README) · [R7] https://github.com/maxcountryman/axum-login (README)
- [R8] https://github.com/patte/tower-sessions-rusqlite-store (README e `rusqlite-store/src/lib.rs`)
- [R9] https://github.com/ramosbugs/openidconnect-rs · [R10] https://github.com/ramosbugs/oauth2-rs
- [R11] https://github.com/dalek-cryptography/subtle
- [S1] https://docs.rs/tower-sessions/latest/tower_sessions/
- [S2] https://docs.rs/tower-sessions/latest/tower_sessions/session/enum.Expiry.html
- [S3] https://github.com/maxcountryman/tower-sessions/blob/main/tower-sessions-core/src/session.rs
- [T2] https://docs.rs/totp-rs/latest/totp_rs/
- [W2] https://docs.rs/webauthn-rs/latest/webauthn_rs/struct.WebauthnBuilder.html
- [W3] https://docs.rs/webauthn-rs/latest/webauthn_rs/

**Provedores**

- [G1] Google, OpenID Connect: https://developers.google.com/identity/openid-connect/openid-connect
- [G2] Google, público e status de publicação do app OAuth: https://support.google.com/cloud/answer/15549945
- [G3] Google, claims `amr` e `auth_time`: https://developers.google.com/identity/siwg/security-bundle
- [G4] Google Workspace, verificação em duas etapas: https://knowledge.workspace.google.com/admin/security/deploy-2-step-verification
- [H1] GitHub, autorização de OAuth apps: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- [H2] GitHub, escopos: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
- [H3] GitHub, 2FA obrigatório: https://docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication-2fa/about-mandatory-two-factor-authentication
- [H4] GitHub, `GET /user`: https://docs.github.com/en/rest/users/users#get-the-authenticated-user
- [P1] https://auth0.com/pricing · [P2] https://clerk.com/pricing · [P3] https://workos.com/pricing · [P4] https://aws.amazon.com/cognito/pricing/
- [X1] Keycloak, memória e CPU: https://www.keycloak.org/high-availability/multi-cluster/concepts-memory-and-cpu-sizing
- [X2] Authelia: https://www.authelia.com/
- [X3] ZITADEL, produção: https://zitadel.com/docs/self-hosting/manage/production
- [X4] Ory Kratos, produção: https://www.ory.com/docs/kratos/guides/production
- [X5] API do GitHub (`repos/<dono>/<repo>` e `/releases/latest`) de `keycloak/keycloak`, `authelia/authelia`, `zitadel/zitadel` e `ory/kratos`

**E-mail, chaves e máquina**

- [E1] Amazon SES, preços: https://aws.amazon.com/ses/pricing/
- [E2] Amazon SES, sandbox e acesso de produção: https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html
- [K1] GitHub, formato dos tokens: https://github.blog/engineering/platform-security/behind-githubs-new-authentication-token-formats/
- [K2] Stripe, chaves de API: https://docs.stripe.com/keys
- [K3] GitHub, autenticação e prefixos de token: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github
- [A1] Lightsail, preços: https://aws.amazon.com/lightsail/pricing/
