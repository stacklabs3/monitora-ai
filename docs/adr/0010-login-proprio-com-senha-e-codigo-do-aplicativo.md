---
status: accepted
---

# O painel tem login próprio, com senha e código do aplicativo

Quem entra no painel usa uma senha e um código de 6 dígitos de um aplicativo autenticador, conferidos pelo próprio servidor, e a sessão de acesso fica guardada no cadastro. Não há Google, GitHub nem serviço de login. O motivo: a regra é segundo fator **obrigatório** ([Definir privacidade, acesso e retenção](https://github.com/stacklabs3/monitora-ai/issues/8), item 14), e nem o Google nem o GitHub deixam o servidor exigir isso; os serviços que deixam custam de US$ 25 a 35 por mês ou pedem mais um programa numa máquina de 2 GB que já está no teto ([ADR 0002](0002-opensearch-como-banco-de-logs.md), condição 1).

Decidido em [Escolher como o painel autentica e como a chave de envio é conferida](https://github.com/stacklabs3/monitora-ai/issues/96), em 28/11/2026, pela recomendação, por delegação do responsável pelo produto. Detalha o módulo de acesso do [ADR 0003](0003-modulos-e-seams-do-servidor.md). Os fatos vêm da [pesquisa do acesso ao painel](https://github.com/stacklabs3/monitora-ai/blob/research/acesso-ao-painel/docs/research/acesso-ao-painel.md); **nada foi medido na máquina real**.

## Como entra

- **Convite:** o Administrador gera o convite e o painel mostra o link uma vez; ele copia e entrega por fora. O link vale 24 h (proposta) e uma vez só. O servidor guarda só o SHA-256 do código do link. Ao abrir, a pessoa cria a senha, lê o QR no aplicativo e confirma um código; só então a conta existe.
- **Primeiro Administrador e socorro:** um comando do servidor, rodado na máquina, gera um convite de Administrador. É assim que a instalação começa e é a saída quando o único Administrador perde o celular.
- **Senha:** Argon2id com 19 MiB, 2 iterações e 1 linha de execução (mínimo da OWASP), pelo `argon2` 0.6 do RustCrypto. A conferência roda fora das threads do `tokio`, uma por vez.
- **Segundo fator:** TOTP (RFC 6238) de 6 dígitos, passo de 30 s e SHA-1, que é o que os aplicativos aceitam sem cair calados para outro algoritmo; pelo `totp-rs` 6.0. O servidor aceita um passo de atraso e recusa o mesmo código duas vezes.
- **Segredo do TOTP:** o servidor precisa lê-lo, então não cabe hash. Fica cifrado no cadastro com `chacha20poly1305` 0.11 (RustCrypto), com uma chave do servidor guardada fora do disco de dados e dos backups, como a chave de códigos. Onde essa chave mora é do [Mapa: infra da plataforma](https://github.com/stacklabs3/monitora-ai/issues/52).
- **Quem perde o celular:** o Administrador refaz o convite da pessoa, o que apaga a senha, o segredo e as sessões dela. Não há códigos de recuperação na primeira versão.
- **Falhas seguidas:** 5 erros de senha ou de código travam a entrada daquela pessoa por 15 min (proposta; a RFC 4226 pede o limite, não fixa o número). Toda entrada e toda falha vão à auditoria.
- **Sessão de acesso:** escrita no módulo de acesso, numa tabela do cadastro, sem `tower-sessions` nem `axum-login`. O identificador tem 32 bytes aleatórios do sistema, é trocado a cada entrada e fica no cadastro só em SHA-256. Duas datas na linha, criada em e último uso, dão as duas regras: 8 h no total e 1 h parada, conferidas em toda requisição junto da permissão. O último uso só é regravado quando tem mais de 1 min, para não gravar no disco a cada clique. Sair, refazer o convite ou tirar a pessoa apaga a linha, e a sessão cai na requisição seguinte.
- **Cookie:** `__Host-`, com `Secure`, `HttpOnly`, `SameSite=Strict` e `Path=/`. O painel é uma página estática que abre sem cookie e só então chama o servidor, do mesmo endereço; por isso o link do alerta aberto no Telegram funciona com `Strict`.
- **Pedido forjado de outro site (CSRF):** toda requisição que muda algo precisa de `Sec-Fetch-Site: same-origin`; sem esse cabeçalho, vale o `Origin` igual ao endereço do painel; sem os dois, é recusada. `GET` nunca muda nada. Não há token de CSRF.
- **Chave de envio:** 32 bytes aleatórios do sistema, com o prefixo fixo `mai_` (proposta), mostrada uma vez. O cadastro guarda só o SHA-256, numa coluna de índice único, e a conferência de cada lote é uma leitura por esse índice. Sem Argon2, sem HMAC e sem cache: cancelar a chave apaga a linha, e o lote seguinte já é recusado.

## O que muda no exemplo

A Ana abre o link do alerta no celular às 3h, com a sessão vencida. O painel pede a senha e o código do aplicativo dela, e ela cai na busca do alerta. Com o Google, ela entraria com a conta Google, e o servidor não teria como saber se houve segundo fator.

A API do Excurfly manda um lote a cada poucos segundos: o servidor calcula um SHA-256 (centenas de nanossegundos na máquina local) e faz uma leitura no cadastro. Com Argon2, cada lote custaria de 10 a 16 ms e 19 MiB.

## Opções recusadas

- **Google ou GitHub:** o Google "não aceita pedidos de reautenticação" e só informa o segundo fator em app publicado e verificado, num campo que pode não vir; o GitHub diz se a conta tem segundo fator ligado, não se foi usado. Em qualquer dos dois, a sessão e os papéis continuariam no servidor, e ainda entraria uma conta externa com segredo para guardar.
- **Auth0, Clerk, WorkOS e Cognito:** o segundo fator custa US$ 35 e US$ 25 por mês nos dois primeiros (o orçamento todo é de US$ 15); os quatro põem a entrada do painel na mão de um serviço fora da máquina e pedem conta e contrato de dados que não foram levantados.
- **Keycloak, ZITADEL, Kratos e Authelia:** o Keycloak pede 1.250 MB; ZITADEL e Kratos pedem PostgreSQL, recusado no [ADR 0009](0009-cadastro-em-sqlite-embutido.md); o Authelia é leve, mas é um segundo programa para uma pessoa operar.
- **Link por e-mail:** pede conta na AWS, SES e credencial no servidor, e o NIST não aceita e-mail como fator.
- **Passkey:** resiste a phishing, mas prende o endereço do painel para sempre (trocar o endereço obriga todos a recadastrar), e o endereço ainda é do mapa de Infra. Reabre em ticket novo, ao lado do TOTP, quando o endereço estiver fixo.
- **`tower-sessions` e `axum-login`:** aceitam um vencimento só por sessão, e a regra tem dois. O store para `rusqlite` é um fork de conta pessoal, sobre `tokio-rusqlite` e `rusqlite` 0.40 (o projeto usa a 0.43), e guarda o identificador em claro.
- **Sessão em JWT, sem linha no servidor:** não cai na hora; a permissão é conferida em toda requisição (item 13), e tirar uma pessoa precisa valer no clique seguinte.
- **HMAC com segredo do servidor na chave de envio:** nenhuma fonte lida pede isso para segredo aleatório de 256 bits, e trocar o segredo invalidaria todas as chaves.

## Consequências

- **O servidor guarda senha:** o vazamento do cadastro expõe hashes Argon2id. É a troca aceita por não depender de ninguém para entrar.
- **TOTP não resiste a phishing:** uma página falsa pode pedir senha e código. O painel é interno e de poucas pessoas; a passkey é a resposta e fica para depois.
- **O convite anda por fora:** a auditoria registra quem gerou e quando foi usado, não por onde o link passou. Por isso o prazo curto e o uso único.
- **Quem tem a máquina tem o painel:** o comando de socorro vale o que vale o acesso à máquina, que é do mapa de Infra.
- **Código próprio de sessão:** são poucas dezenas de linhas, cobertas pelo risco RK19 de [docs/riscos.md](../riscos.md); a chave de envio pelos riscos RK16 e RK18, e os papéis pelo RK17.
- **Trocar depois:** um provedor externo entraria como outra forma de provar quem é, antes da mesma sessão. As senhas não migram: quem trocar recadastra.

## Condições que ficam para a máquina real

Entram na conta de [Validar o banco na AWS](https://github.com/stacklabs3/monitora-ai/issues/60). Cada medida tem um controle que precisa reprovar (RP1).

1. **Senha:** uma conferência de Argon2id com os parâmetros acima em até 1 s nos 2 núcleos compartilhados do Lightsail (o teto que a OWASP dá). Se reprovar, mudam os parâmetros dentro das equivalências da OWASP, não a escolha.
2. **Chave de envio:** a leitura por lote no cadastro sem atrasar a confirmação dos eventos (meta de 1 s). Se reprovar, entra um cache em memória, apagado na mesma operação que cancela a chave.

## Fontes

- [Pesquisa: acesso ao painel](https://github.com/stacklabs3/monitora-ai/blob/research/acesso-ao-painel/docs/research/acesso-ao-painel.md): versões, licenças, quem mantém, preços, o que Google e GitHub garantem, sessão, convite, chave de envio e a medida local
- OWASP: [Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [Multifactor Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html) e [Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) (token em URL)
- [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html) (hash simples para segredo de 112 bits ou mais; e-mail fora), [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238) (TOTP) e [RFC 4226, seção 7.3](https://www.rfc-editor.org/rfc/rfc4226#section-7.3) (limite de tentativas)
- [Google: OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [GitHub: fluxo de OAuth](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) e [segundo fator obrigatório no GitHub](https://docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication-2fa/about-mandatory-two-factor-authentication)
- [`argon2`](https://crates.io/crates/argon2), [`totp-rs`](https://crates.io/crates/totp-rs), [`chacha20poly1305`](https://crates.io/crates/chacha20poly1305) (0.11.0, de 28/06/2026, MIT ou Apache-2.0, RustCrypto), [`sha2`](https://crates.io/crates/sha2), [`getrandom`](https://crates.io/crates/getrandom), [`tower-sessions`](https://github.com/maxcountryman/tower-sessions) e [`webauthn-rs`](https://github.com/kanidm/webauthn-rs): crates.io e README, lidos em 28/11/2026
- [ADR 0002](0002-opensearch-como-banco-de-logs.md) (teto de 1,5 GB), [ADR 0003](0003-modulos-e-seams-do-servidor.md) (módulo de acesso) e [ADR 0009](0009-cadastro-em-sqlite-embutido.md) (cadastro em SQLite, uma thread de escrita)
- [Definir privacidade, acesso e retenção](https://github.com/stacklabs3/monitora-ai/issues/8), itens 1, 2, 11, 13, 14 e 15; [Restrições do projeto](https://github.com/stacklabs3/monitora-ai/issues/19)
- Delegação do responsável pelo produto de 20/11/2026: decidir pela recomendação
