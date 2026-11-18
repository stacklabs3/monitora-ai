# Privacidade, acesso e retenção: fatos com fonte primária

Insumo do ticket "Definir privacidade, acesso e retenção". **Só fatos.** Não é parecer jurídico: o que exige validação de advogado ou encarregado vem marcado **[validar com especialista]**. O que não teve fonte primária lida ou não foi achado vem marcado **[confirmar]** ou **[não encontrado]**.

- **Data da consulta:** 18/11/2026.
- **Contexto:** plataforma auto-hospedada de investigação de logs, multiproduto, uso interno, Lightsail 2 GB/60 GB em sa-east-1, teto de US$ 15/mês (backups até US$ 3). Banco, protocolo e provedor de login **não** escolhidos; este documento não recomenda produto.
- **Como as fontes foram lidas:** texto integral de leis e PDFs oficiais baixados e lidos; páginas de documentação lidas por extração automática. Onde só vi resultado de busca (sem abrir a página dona), está dito.
- **Privacidade da pesquisa:** consultas só com termos genéricos; nenhum dado do projeto saiu daqui.

---

## A. LGPD (Lei 13.709/2018) e ANPD

Texto: [Planalto, LGPD compilada](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm).

### A1. Definições
- **Dado pessoal** (art. 5º, I): informação relacionada a pessoa natural identificada ou identificável.
- **Dado pessoal sensível** (art. 5º, II): rol que inclui origem racial ou étnica, convicção religiosa, opinião política, saúde ou vida sexual, dado genético ou biométrico vinculado a pessoa natural.
- **Dado anonimizado** (art. 5º, III): dado de titular que não pode ser identificado, considerados meios técnicos razoáveis e disponíveis na ocasião do tratamento. Art. 12: anonimizado **não** é dado pessoal, **salvo** se o processo puder ser revertido com esforços razoáveis.
- **Pseudonimização** (art. 13, §4º): o dado perde a associação direta ou indireta a um indivíduo, **senão pelo uso de informação adicional mantida separadamente pelo controlador, em ambiente controlado e seguro**. Ou seja, dado pseudonimizado continua sendo dado pessoal.
- **Crianças e adolescentes** (art. 14): tratamento no melhor interesse; para criança, consentimento específico e em destaque de ao menos um dos pais ou responsável.

### A2. Princípios (art. 6º)
- **Finalidade** (I): propósitos legítimos, específicos, explícitos e informados, sem uso posterior incompatível.
- **Necessidade** (III): mínimo necessário, dados pertinentes, proporcionais e não excessivos.
- **Segurança** (VII): medidas técnicas e administrativas contra acesso não autorizado e situações acidentais ou ilícitas.

### A3. Bases legais relevantes a segurança e logs
- Art. 7º, II: obrigação legal ou regulatória. Art. 7º, VI: exercício regular de direitos em processo. **Art. 7º, IX: legítimo interesse** do controlador ou de terceiro, salvo prevalência de direitos e liberdades do titular.
- Art. 11, II, "g" (dado **sensível**, sem consentimento): garantia da prevenção à fraude e à segurança do titular, **nos processos de identificação e autenticação de cadastro em sistemas eletrônicos**.
- **Guia da ANPD sobre legítimo interesse** ([Guia Orientativo, PDF oficial](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/copy_of_guia_legitimo_interesse.pdf/@@display-file/file), fev/2024, lido): traz teste de balanceamento em três fases (finalidade, necessidade, balanceamento e salvaguardas); diz que o teste também vale para o art. 11, II, "g"; e diz que o legítimo interesse pode ser base para dado **não sensível** com a finalidade de prevenir fraudes e garantir a segurança dos dados dos titulares (p. 36). Por análise de secundárias (não lido no PDF): a ANPD afirma que legítimo interesse não serve para dado sensível. **[confirmar no PDF]**
- Art. 37: controlador e operador mantêm **registro das operações de tratamento**, especialmente quando baseadas em legítimo interesse.

### A4. Término do tratamento e eliminação (arts. 15 e 16)
- Art. 15: o tratamento termina quando a finalidade é alcançada ou os dados deixam de ser necessários; fim do período de tratamento; comunicação do titular (inclusive revogação do consentimento); ou determinação da ANPD.
- Art. 16: os dados são **eliminados** após o término, autorizada a conservação para: (I) obrigação legal ou regulatória; (II) estudo por órgão de pesquisa, anonimizando quando possível; (III) transferência a terceiro, respeitada a lei; (IV) uso exclusivo do controlador, vedado acesso por terceiro e **anonimizados**.
- Art. 47: a segurança da informação continua exigida **mesmo após** o término do tratamento.

### A5. Direitos do titular e prazo (arts. 18 e 19)
- Art. 18: confirmação de tratamento, acesso, correção, anonimização/bloqueio/eliminação de dados desnecessários, excessivos ou ilícitos, portabilidade, eliminação dos dados tratados com consentimento (salvo art. 16), informação sobre compartilhamento, revogação do consentimento. Atendimento sem custo, "nos prazos e termos previstos em regulamento" (§5º).
- Art. 19: confirmação/acesso em formato simplificado, **imediatamente**; por declaração clara e completa, **em até 15 dias** do requerimento.
- Pequeno porte: prazo **em dobro** para esse atendimento, e a declaração simplificada em até 15 dias (Res. CD/ANPD 2/2022, arts. 14 e 15; ver A8).

### A6. Segurança e incidentes (arts. 46 e 48) e Res. CD/ANPD 15/2024
- Art. 46: medidas técnicas e administrativas de segurança, **desde a concepção** do produto até a execução (§2º).
- Art. 48: o controlador comunica ANPD e titular o incidente que possa acarretar risco ou dano relevante, em prazo definido pela ANPD, com o conteúdo mínimo do §1º.
- [Resolução CD/ANPD 15/2024, texto no DOU](https://www.in.gov.br/en/web/dou/-/resolucao-cd/anpd-n-15-de-24-de-abril-de-2024-556243024) (lida):
  - **Prazo de comunicação à ANPD: três dias úteis** a contar do conhecimento, pelo controlador, de que o incidente afetou dados pessoais (art. 6º, caput e §1º). Prazo de comunicação ao titular: também três dias úteis (art. 9º), com declaração de que os titulares foram avisados em até três dias úteis após o fim desse prazo (art. 9º, §4º).
  - **Risco ou dano relevante** (art. 5º): afeta significativamente interesses e direitos fundamentais **e**, cumulativamente, envolve ao menos um destes: dado sensível; dado de criança, adolescente ou idoso; dado financeiro; **dado de autenticação em sistemas**; dado sob sigilo legal, judicial ou profissional; dado em larga escala.
  - **Registro do incidente por no mínimo cinco anos**, inclusive o não comunicado (art. 10).
  - Prazos **em dobro** para agente de pequeno porte (art. 6º, §8º; art. 9º, §6º).
- Implicação direta para este produto: um log com credenciais, tokens ou senhas vazados é "dado de autenticação em sistemas", critério do art. 5º, IV.

### A7. Guia de segurança da ANPD para pequeno porte e backup
- A ANPD **não tem**, nas fontes que achei, orientação sobre **apagar dado individual de backup** **[não encontrado]**. O que existe:
- Documento lido: [Nota Técnica 19/2021 da ANPD, que propõe o Guia de Segurança para Agentes de Pequeno Porte](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/anonimizado___guia_orientat-_seg_da_inf_p_atpp.pdf/@@display-file/file). É a proposta (processo SEI) com controle de alterações; o guia publicado em out/2021 pode ter redação final diferente **[confirmar no guia publicado]**.
  - Item 52: backups regulares e **completos**, guardados em local seguro e **distinto** do armazenamento principal, **sem sincronização online em tempo real** (para resistir a ransomware).
  - Itens 39 a 45: controle de acesso = autenticação, autorização e **auditoria** (registro do que cada usuário fez); sem compartilhar contas ou senhas; preferir **autenticação de dois fatores** para sistemas com dados pessoais.
  - Item 47: coletar só o necessário. Item 48: para dados sensíveis, pseudonimização (ex.: cifrar).
  - Itens 55 e 56: ao descartar mídia, sobrescrever antes; sem sobrescrita, destruir; terceiro que descarta deve registrar a destruição em contrato.
  - Item 34: revisar a política simplificada de segurança a cada 1 ou 2 anos (sugestão).

### A8. Res. CD/ANPD 2/2022 (pequeno porte)
Texto: [Resolução 2/2022 (cópia do DOU)](https://www.gov.br/palmares/pt-br/midias/arquivos-menu-acesso-a-informacao/legislacao/resolucao-cd-anpd-n2-2022.pdf), lida.
- Art. 2º: agente de pequeno porte inclui microempresa, EPP, startup, pessoa jurídica privada inclusive sem fins lucrativos, pessoa natural. 
- **Art. 3º: não se beneficia** quem faz tratamento de alto risco (ressalvado o art. 8º), tem receita acima dos limites da LC 123/2006 (ou LC 182/2021 para startup) ou pertence a grupo econômico acima desses limites.
- Art. 4º: alto risco = ao menos um critério geral (larga escala **ou** afetação significativa de direitos) **e** um específico (tecnologia emergente, vigilância de zona pública, decisão só automatizada, **dado sensível ou de criança, adolescente e idoso**).
- Art. 14: prazo em dobro para atender o titular, comunicar incidente (exceto risco à integridade física/moral ou segurança nacional), e declaração do art. 19, II.
- Art. 6º: a flexibilização não isenta do cumprimento da lei. Art. 16: a ANPD pode exigir o que foi dispensado.
- **[validar com especialista]** se a empresa se enquadra como agente de pequeno porte e se um sistema que ingere logs de vários produtos cai em "larga escala" ou "dado sensível".

---

## B. Marco Civil da Internet (Lei 12.965/2014) e Decreto 8.771/2016

Textos: [Lei 12.965](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm) e [Decreto 8.771](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2016/decreto/d8771.htm), lidos.

- **Registro de acesso a aplicações** (art. 5º, VIII): conjunto de informações sobre **data e hora de uso** de uma aplicação a partir de determinado IP.
- **Art. 15, caput:** o **provedor de aplicações** "constituído na forma de pessoa jurídica e que exerça essa atividade de forma organizada, profissional e com fins econômicos" mantém os registros de acesso a aplicações **sob sigilo, em ambiente controlado e seguro, por seis meses**.
- Art. 15, §1º: ordem judicial pode obrigar, por tempo certo, provedores **não** sujeitos ao caput a guardar registros de fatos específicos em período determinado. §2º: autoridade pode pedir cautelarmente guarda por mais de seis meses. §3º: a entrega exige prévia autorização judicial.
- Art. 14: o provedor de **conexão** é proibido de guardar registros de acesso a aplicações. Art. 13: provedor de conexão guarda registros de conexão por um ano.
- Art. 16: o provedor de aplicações não guarda registros de acesso a **outras** aplicações sem consentimento nem dados pessoais excessivos em relação à finalidade.
- **Decreto 8.771, art. 13** (diretrizes de segurança na guarda): (I) controle estrito de acesso, com responsabilidades e privilégios definidos; (II) **autenticação de acesso aos registros**, ex.: autenticação dupla, para individualizar o responsável; (III) **inventário detalhado dos acessos** aos registros (momento, duração, identidade, arquivo acessado); (IV) gestão dos registros com técnicas de inviolabilidade, como **encriptação** ou equivalente. §2º: reter a **menor quantidade possível** de dados e excluir **tão logo atingida a finalidade ou encerrado o prazo legal**.
- O Decreto 8.771 foi alterado pelo Decreto 12.975/2026 (texto consolidado no Planalto): o art. 15-A estende o dever de guarda de IP à **porta lógica de origem** quando necessário para identificar o terminal. Não li o Decreto 12.975 em si **[confirmar no DOU]**.

### Conflito com "apagar logs em 30 dias" se o sistema de logs não for o registro oficial?
Leitura dos textos, **não parecer**:
1. O dever do art. 15 recai sobre quem é **provedor de aplicações** (PJ, atividade organizada, profissional e econômica) e se refere aos **registros de acesso dos usuários àquela aplicação** (IP + data/hora de uso). A norma não diz que o registro tem de morar numa ferramenta específica; exige guarda sob sigilo, em ambiente controlado e seguro.
2. Se a guarda oficial de cada produto fica em outro lugar (com os seis meses e as diretrizes do art. 13 do Decreto), apagar cópias de log de investigação em 30 dias **não contradiz o texto**, e o §2º do art. 13 do Decreto empurra para reter o mínimo.
3. Se o sistema de logs for a **única** cópia dos registros de acesso de algum produto que seja provedor de aplicações, 30 dias ficaria abaixo dos seis meses.
4. Se a própria plataforma interna é "provedor de aplicações" para fins do art. 15 (uso só pela equipe, sem fins econômicos diretos) é questão de enquadramento. **[validar com especialista]**.

---

## C. AWS Lightsail (documentação oficial)

Consulta em 18/11/2026. Preços são de página global; **não confirmei se sa-east-1 (São Paulo) tem preço próprio** **[confirmar na região]**.

### C1. Criptografia em repouso
- **Discos anexados (block storage) e seus snapshots:** "encrypted at rest by default", com chaves gerenciadas pelo Lightsail; há também criptografia do dado em trânsito entre instância e disco anexado ([FAQ de block storage](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-block-storage.html)).
- **Disco de sistema da instância e snapshot de instância:** a FAQ descreve o disco de sistema como dispositivo raiz, apagado junto com a instância, e recomenda usá-lo só para dado temporário. **Não encontrei afirmação de que seja criptografado em repouso** **[não encontrado]**. Tratar como não confirmado até a AWS responder; a escolha segura é guardar dado persistente em disco anexado.
- **Chave própria (KMS do cliente) para discos:** não encontrei **[não encontrado]**.
- **Buckets:** criptografia no servidor com chaves gerenciadas pela Amazon e HTTPS obrigatório em trânsito ([Segurança de buckets](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bucket-security-best-practices.html), via resultado de busca; página não aberta **[confirmar]**).

### C2. Snapshots ([Snapshots no Lightsail](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-instance-snapshots-in-amazon-lightsail.html), [Snapshots automáticos](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-configuring-automatic-snapshots.html))
- **Automáticos:** diários, **os 7 mais recentes** são mantidos e o mais antigo é substituído. Horário configurável em UTC. Não habilitável por console para discos (só API/CLI). Não suportado para Windows nem bancos gerenciados.
- Os automáticos de um recurso **são apagados quando o recurso é apagado**; para guardá-los, copiar como manual.
- **Manuais:** guardados **indefinidamente** até serem apagados; sobrevivem à exclusão do recurso.
- **Cobrança:** taxa de armazenamento de snapshot para manual, automático, copiado e de disco de sistema.
- **Incrementais:** a documentação lida **não afirma** que sejam incrementais **[não encontrado]**; não presumir cálculo de custo incremental.
- **Exclusão** ([Excluir snapshots](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-deleting-snapshots.html)): operação permanente que não pode ser desfeita. O que a AWS faz com a mídia depois **[não encontrado]**.
- **Cópia entre regiões:** snapshots de instância e de disco podem ser copiados para outra região ou na mesma; snapshots de **banco** não ([Copiar snapshots](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-copying-snapshots-from-one-region-to-another.html)). A cópia é um snapshot à parte, cobrado à parte; apagar o original não é descrito como afetando a cópia. Criptografia da cópia: não descrita **[não encontrado]**.
- **Recriar a partir de snapshot:** só no mesmo plano ou maior.

### C3. Preço ([página de preços do Lightsail](https://aws.amazon.com/lightsail/pricing/))
- **Snapshots:** US$ 0,05 por GB-mês.
- **Block storage:** US$ 0,10 por GB-mês, mínimo de 8 GB.
- **Instância Linux 2 GB RAM, 2 vCPU, 60 GB SSD, 3 TB de transferência:** US$ 12/mês com IPv4 público; US$ 10 só IPv6. Em São Paulo (e outras regiões listadas) a franquia de transferência é a metade. IP estático incluído nos planos.
- **Object storage (buckets):** US$ 1/mês (5 GB, 25 GB de saída), US$ 3 (100 GB, 250 GB), US$ 5 (250 GB, 500 GB). Entrada de dados ilimitada; a franquia conta só saída ([FAQ de buckets](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-buckets.html)). Até 20 buckets por conta.

### C4. Armazenamento de objetos
- Privado por padrão; acesso programático por chaves de acesso ou papéis.
- **Versionamento:** desligado por padrão; ligado, não volta a "desativado" (só suspenso); versões antigas ficam até serem apagadas e contam na cota ([Versionamento](https://docs.aws.amazon.com/en_us/lightsail/latest/userguide/amazon-lightsail-managing-bucket-object-versioning.html), via busca).
- **Regras de expiração/ciclo de vida:** **não encontrei** na documentação do Lightsail **[não encontrado]**; não assumir que existem. Apagar bucket apaga objetos, versões e chaves de acesso de forma permanente.

### C5. Firewall por IP ([Firewalls do Lightsail](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-firewall-and-port-mappings-in-amazon-lightsail.html))
- Dois firewalls por instância (IPv4 e IPv6), independentes. Regras **só de permissão** (não há "negar"). Tráfego de saída sempre liberado.
- Origem por IP único, faixa ou CIDR; até 30 origens por vez no console, 60 por API/CLI. Se há duas regras para a mesma porta, vale a mais permissiva.
- Só filtra tráfego pelo **IP público**; não afeta tráfego pelo IP privado (outros recursos da conta na mesma região ou VPC pareada).
- Regras padrão de SO base: SSH (22) e HTTP (80) para **todos os IPs**.
- Log do firewall: não encontrei **[não encontrado]**.

### C6. Certificados TLS ([FAQ de certificados](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-certificates.html), via busca)
- Certificados gerenciados pelo Lightsail funcionam **só com load balancers** (e renovam enquanto anexados); não servem para instância avulsa.
- Em instância: Let's Encrypt com Certbot (tutoriais oficiais); certificado de 90 dias, renovável a partir de 30 dias antes do vencimento. Páginas lidas só em resumo **[confirmar na página]**.

---

## D. Apagamento em cópias (backup)

- **NIST SP 800-88 Rev. 2** (set/2025; substitui a Rev. 1): [texto final](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-88r2.pdf), lido.
  - Cryptographic erase (CE) é técnica de "purge" baseada em sanitizar as chaves que cifram o dado ou impedir acesso a elas; fica só o texto cifrado (seção 3.2).
  - Depende de criptografia forte (referência à ISO/IEC 27040: algoritmo com força de ao menos 128 bits e entropia da fonte de aleatoriedade ao menos igual ao tamanho da chave) e de pré-condições.
  - Para armazenamento lógico/virtual, como nuvem, "CE pode ser a única técnica de purge viável", pois o dono não acessa a mídia física (seção 3.1).
  - Na Rev. 1, seção 2.6.1: **não usar** CE se a criptografia foi ligada depois de dado sensível já ter sido gravado sem sanitização, ou se não se sabe disso ([Rev. 1](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-88r1.pdf), lida; Rev. 1 está retirada).
- **EDPB, relatório da ação coordenada sobre direito ao apagamento** (adotado em 10/02/2026): [PDF](https://www.edpb.europa.eu/system/files/2026-02/edpb_cef-report_2025_right-to-erasure_en.pdf), lido, item 4.2.6.
  - Pode não ser aconselhável alterar ou apagar em backup; nesse caso a organização deve **rastrear os pedidos de apagamento e aplicá-los nos sistemas restaurados** "as much as possible".
  - Metade das autoridades levantou preocupação; práticas vistas: apagar quando o backup é sobrescrito, ciclo fixo (ex.: um mês), mover dados para sistema separado apagado depois, **trocar o dado a apagar por sequência aleatória**.
  - Recomendações: seguir padrões estabelecidos de apagamento; verificar e poder demonstrar o apagamento. O EDPB admite que pode dar mais orientação sobre "sem demora injustificada" em backups.
  - Anonimização como substituto de apagamento: pseudonimização básica ou mascaramento parcial **não** cumpre a exigência de apagamento (item 4.2.7).
  - É texto de **GDPR**, não de LGPD; serve de referência técnica, não de norma brasileira.
- **ICO (Reino Unido), "beyond use":** só vi resultado de busca, as páginas da ICO retornaram 403 ao acesso automático. O que a busca indica: o apagamento deve alcançar backups, mas o backup pode ficar até ser sobrescrito se o dado for posto **"beyond use"** (não usado para nenhuma finalidade, titular informado do que acontece) ([Right to erasure](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/), [Storage limitation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/)). **[confirmar a redação lendo as páginas]**.
- **CNIL sobre apagar em backup:** o guia de segurança de 2024 ([PDF](https://www.cnil.fr/sites/cnil/files/2024-03/cnil_guide_securite_personnelle_2024.pdf), lido) trata de backup na ficha 17 como **disponibilidade**: backups regulares e testados, ao menos uma cópia fora do site e uma offline, proteger e cifrar as cópias. **Não achei** nele regra sobre apagar dado individual de backup **[não encontrado]**.
- **Crypto-shredding como termo:** não achei fonte séria que use esse nome; a base técnica citável é o "cryptographic erase" do NIST. Aplicar a backup de log exigiria cifrar cada janela com chave própria e destruir a chave ao fim da retenção. Isso é consequência do texto do NIST, não recomendação dele para backups de aplicação **[validar com especialista]**.
- **ANPD:** nada específico sobre eliminação em backup (ver A7).

---

## E. Logs

- **OWASP Logging Cheat Sheet** ([página](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), lida):
  - Normalmente **não** registrar diretamente (remover, mascarar, sanitizar, hashear ou cifrar): código-fonte, identificadores de sessão (admite valor hasheado), tokens de acesso, dado pessoal sensível e PII, senhas, strings de conexão, chaves e segredos, dados de conta bancária e de cartão, dado com classificação acima da permitida ao sistema de logs, dado de quem não consentiu ou optou por sair.
  - Itens úteis que pedem tratamento: caminhos, nomes e endereços internos, dado pessoal não sensível (nome, telefone, e-mail): pseudonimizar quando a identidade não for necessária.
  - Proteção: detecção de adulteração, cópia para mídia somente leitura, leitura restrita e revisada, conta de escrita separada, TLS em trânsito.
  - **Todo acesso aos logs deve ser registrado e monitorado**; detectar parada do registro e acesso indevido; retenção não menor nem maior que a exigida.
  - Injeção de log (CR/LF): formato estruturado, sanitizar, limitar tamanho.
- **OWASP ASVS 5.0.0** (v5.0.0, [repositório oficial](https://github.com/OWASP/ASVS/tree/v5.0.0/5.0/en), lido): 16.2.5 (registrar conforme o nível de proteção do dado, ex.: credenciais e pagamento proibidos; token de sessão só hasheado ou mascarado), 16.4.1 (evitar injeção de log), 16.4.2 (logs protegidos contra acesso não autorizado e modificação), 16.4.3 (enviar a sistema separado), 14.2.1 (dado sensível não vai em URL ou query string), 14.2.7 (nível 3: dado sensível com classificação de retenção e exclusão automática).
- **NIST SP 800-92:** o original é de 2006. Há a **Rev. 1 em rascunho** (Cybersecurity Log Management Planning Guide, rascunho inicial de 11/10/2023), foco em planejamento, com status "em tratamento de comentários" ([página](https://csrc.nist.gov/pubs/sp/800/92/r1/ipd), via busca; texto não lido). **[confirmar se saiu versão final]**. Não extraí requisitos de 800-92.
- **CNIL, recomendação sobre journalisation** (Délibération 2021-122, [PDF](https://www.cnil.fr/sites/cnil/files/atoms/files/recommandation_-_journalisation.pdf), lida):
  - Conservar os dados de rastreabilidade **entre seis meses e um ano**, equilíbrio entre detectar atingimento do sistema e não manter volume excessivo (item 8). Duração maior é possível se justificada e documentada, "nos casos mais comuns" no máximo três anos (item 19).
  - Não duplicar nos logs os dados do tratamento; guardá-los **segregados** do sistema principal, com direitos de acesso específicos por estrita necessidade (itens 6 e 7).
  - Escopo: é sobre **rastreabilidade de acessos e operações** em um tratamento (quem fez o quê), não sobre log de depuração de aplicação. 
- **PCI DSS** ([SAQ D v4.0 do PCI SSC](https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-D-Service-Provider.pdf), lido; mesma redação nas versões 4.0.x citadas nas buscas, **[confirmar no 4.0.1]**):
  - 3.3.1: dado de autenticação sensível (SAD) **não é retido após a autorização, mesmo cifrado**. 3.3.1.2: o código de verificação do cartão (3 ou 4 dígitos) não é retido após a autorização.
  - 3.5.1: PAN ilegível onde for armazenado (hash forte do PAN inteiro, truncamento, tokenização, criptografia). A nota de aplicabilidade inclui **backups, logs de auditoria, de exceção e de solução de problemas**.
  - 3.5.1.1: hash usado para tornar o PAN ilegível deve ser **hash criptográfico com chave** (keyed), com gestão de chaves.
  - 10.5.1: reter histórico de logs de auditoria por **ao menos 12 meses**, com os últimos 3 meses imediatamente disponíveis (escopo: logs de auditoria do ambiente de dados de cartão; só vale se houver dado de cartão no escopo).
- **OpenTelemetry, dados sensíveis** ([página oficial](https://opentelemetry.io/docs/security/handling-sensitive-data/), lida): o OTel não sabe sozinho o que é sensível; a responsabilidade de conformidade é de quem implanta; minimizar a coleta; processors do Collector (`attributes`, `filter`, `redaction`, `transform`) para remover, hashear ou truncar; exemplo de truncar o último octeto do IP; **hash não garante anonimização** quando o espaço de entrada é pequeno e previsível. O guia de boas práticas ([config best practices](https://opentelemetry.io/docs/security/config-best-practices/)) manda configurar criptografia e autenticação no Collector, não expor em `0.0.0.0`, e usar o processor `redaction` (lista de atributos permitidos e `blocked_values` por regex, ex.: cartão).

---

## F. Pseudonimização: hash simples versus HMAC

- **EDPB, Guidelines 01/2025 on Pseudonymisation** ([PDF, versão para consulta pública, adotada em 16/01/2025](https://www.edpb.europa.eu/system/files/2025-01/edpb_guidelines_202501_pseudonymisation_en.pdf), lido). Não achei versão final pós-consulta **[confirmar]**. Pontos:
  - A transformação precisa envolver **informação secreta** do controlador; só quem a tem consegue calcular o pseudônimo a partir do identificador; o segredo precisa de **entropia suficiente** (itens 88, 90).
  - Exemplo de falha: se a transformação é só SHA-256 de um nome, basta aplicá-la a todos os nomes conhecidos e comparar (nota 23).
  - Blocos aceitáveis: funções unidirecionais com chave, **como HMAC**, ou cifras; "preferência geral" a unidirecionais (itens 89, 107).
  - Se usar hash como bloco, hash especializado em senha (ex.: argon2) dificulta força bruta (item 89, nota 26).
  - O controlador deve ter **plano de troca** de algoritmo fraco e procedimento para **substituir pseudônimos já gerados**, de preferência sem reconstituir o dado original, por exemplo aplicando uma segunda função com chave sobre os pseudônimos antigos (item 91).
  - Caso de uso descrito: logs de WAF para CSIRT com IP, tokens e credenciais transformados por função unidirecional com chave, ou removidos se sem entropia suficiente.
  - Texto de GDPR; a definição brasileira é o art. 13, §4º da LGPD (A1).
- **ENISA, Pseudonymisation techniques and best practices** (nov/2019, [PDF](https://www.enisa.europa.eu/sites/default/files/publications/Guidelines%20on%20shaping%20technology%20according%20to%20GDPR%20provisions.pdf), lido nos trechos de HMAC e IP):
  - Seção 5.1.4: MAC é um hash com chave secreta; sem a chave não se mapeia identificador a pseudônimo; HMAC é o desenho de MAC mais usado em protocolos da Internet; o MAC é considerado técnica robusta desde que a chave não seja comprometida. A mesma seção diz que hash simples é vulnerável a ataques de dicionário.
  - Capítulo 6 (IP): só há 2^32 IPv4, então busca exaustiva é viável; IP pseudonimizado só com hash criptográfico **falha**.
  - E-mail e telefone: também têm espaço de entrada previsível; ENISA cobre e-mail no estudo de caso **[detalhe do e-mail não lido linha a linha]**.
- **NIST:** [FIPS 198-1](https://csrc.nist.gov/pubs/fips/198-1/final) define o HMAC (MAC com hash e chave secreta compartilhada). A página não fala de pseudonimização. Não achei publicação do NIST que recomende HMAC especificamente para pseudonimizar e-mail, telefone ou CPF **[não encontrado]**.
- **Efeito da rotação de chave na busca:** consequência lógica do desenho (não há fonte que meça): com HMAC, o mesmo valor gera o mesmo pseudônimo **enquanto a chave for a mesma**, o que permite buscar "todos os eventos deste e-mail" por igualdade. Trocar a chave muda todos os pseudônimos novos; os antigos só casam com os novos se forem re-derivados (o EDPB cita a segunda função sobre pseudônimos antigos, item 91). Uma nota do EDPB cita escolher segredos independentes **por dia** para impedir ligação entre dias, ao custo de não correlacionar entre dias. 
- **Cobertura de CPF:** nenhuma fonte primária que li trata CPF; o argumento do espaço de entrada pequeno (ENISA para IPv4) é por analogia **[validar com especialista]**.

---

## G. Acesso

- **NIST SP 800-63B-4** (final, jul/2025, [texto](https://pages.nist.gov/800-63-4/sp800-63b.html), lido parcialmente):
  - AAL2: autenticação multifator (ou dois fatores distintos) com ao menos um autenticador resistente a replay; verificador deve oferecer opção **resistente a phishing**.
  - Sessão em AAL2: tempo total **deveria** ser de no máximo 24 h e a inatividade de no máximo 1 h (seção 2.2.3; formulação "SHOULD").
  - Autenticadores **sincronizáveis** (o que o mercado chama de passkeys sincronizadas): permitidos em AAL2, proibidos em AAL3; o documento não usa a palavra "passkeys".
  - Senha: mínimo de 15 caracteres se for fator único, 8 se só dentro de MFA; aceitar ao menos 64; **sem regras de composição**; **sem troca periódica**, só por indício de comprometimento.
- **OWASP Authentication Cheat Sheet** ([página](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), lida): MFA é a melhor defesa contra a maioria dos ataques a senha; WebAuthn é a base das passkeys; mensagens de erro genéricas; limitar tentativas por conta e não por IP; registrar falhas de autenticação e bloqueios.
- **OWASP Session Management** ([página](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), lida): ocioso 2 a 5 min (alto valor) ou 15 a 30 min (baixo risco); absoluto de 4 a 8 h para uso de expediente; imposto no servidor; cookie `Secure`, `HttpOnly`, `SameSite`, prefixo `__Host-`; regenerar o ID a cada mudança de privilégio; invalidar no servidor ao sair.
- **OWASP Authorization** ([página](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), lida): menor privilégio e revisão contra "privilege creep"; negar por padrão; validar permissão em **toda** requisição; ABAC/ReBAC preferidos a RBAC puro para aplicação; registrar falhas de autorização; testar a lógica.
- **ASVS 5.0.0:** 7.3.1 e 7.3.2 (timeouts ocioso e absoluto conforme análise de risco documentada), 13.3.1 (cofre de segredos), 13.3.2 (menor privilégio no acesso a segredos), 13.3.4 (nível 3: segredos com expiração e rotação), 16.3.1 e 16.3.2 (registrar toda autenticação e falhas de autorização).
- **Decreto 8.771, art. 13** (B): controle estrito, autenticação (ex.: dupla) e inventário de acessos aos **registros** — é a regra brasileira mais próxima de "trilha de auditoria de quem lê log".
- **Ferramentas (papéis e trilha):**
  - **Datadog Audit Trail** ([doc](https://docs.datadoghq.com/account_management/audit_trail/)): com a função ligada, retenção padrão de **90 dias** (opções 3, 7, 15, 30, 90); desligada, volta a 7 dias. Permissões separadas `Audit Trail Write` (ativar) e `Audit Trail Read` (ver). Opcionalmente arquiva em S3, GCS ou Azure a cada 15 min.
  - **Grafana:** papéis básicos Admin, Editor, Viewer e "No basic role"; por padrão qualquer usuário da organização consulta **qualquer** data source; restrição por data source e RBAC fino são recursos do Enterprise e do Cloud ([doc](https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/)). Audit logs são recurso Enterprise/Cloud; no Cloud, pedido por ticket e retenção normal de logs ([doc](https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/audit-grafana/), via busca **[confirmar]**).
  - **Sentry:** papéis de organização Billing, Member, Admin, Manager, Owner; papéis de time Contributor e Admin (planos Business/Enterprise) ([doc](https://docs.sentry.io/organization/membership/)). **Retenção do audit log do Sentry: [não encontrado]** nas páginas lidas.

---

## H. Credencial de envio de logs

| Aspecto | Datadog | Sentry | Grafana Cloud / Loki | OpenTelemetry |
|---|---|---|---|---|
| Credencial de envio | API key da organização (Agent); **client token** para navegador/mobile ([doc](https://docs.datadoghq.com/account_management/api-app-keys/)) | **DSN** com chave pública, uma por projeto ([doc](https://docs.sentry.io/concepts/key-terms/dsn-explainer/)) | **Token de access policy** com escopo `logs:write` e realm de stack ou org ([doc](https://grafana.com/docs/grafana-cloud/security-and-account-management/authentication-and-permissions/access-policies/)) | OTLP não define autenticação; o Collector usa **extensions de auth** nos receivers ([spec](https://opentelemetry.io/docs/specs/otlp/), [boas práticas](https://opentelemetry.io/docs/security/config-best-practices/)) |
| Amarra a produto/ambiente | API key identifica a **organização**; separar por ambiente é prática sugerida (várias chaves). Client token não se vincula a service ou env na doc de logs do browser ([doc](https://docs.datadoghq.com/logs/log_collection/javascript/)) | Cada projeto tem DSN própria, o evento cai no projeto da DSN | Realm `stack` limita à stack; label selectors da policy valem **só para leitura** | Nada na spec sobre tenant |
| Tenant pelo servidor ou pelo conteúdo | Pela credencial (organização) | Pela DSN (projeto) | Loki: tenant vem do header `X-Scope-OrgID`; **o Loki não autentica**, exige proxy autenticador à frente, que deve preencher o header ([multi-tenancy](https://grafana.com/docs/loki/latest/operations/multi-tenancy/), [autenticação](https://grafana.com/docs/loki/latest/operations/authentication/)); `auth_enabled: false` usa tenant único `fake` | Não define |
| Rotação sem parada | Várias API keys permitidas ("rotate keys"); revogada fica 7 dias restaurável; limite padrão de 50 | Rotação e revogação em Client Keys (DSN); doc lida não detalha o passo a passo | Vários tokens por policy; expiração opcional, com teto imposto pela organização e aviso por e-mail; procedimento de rotação não descrito | Segredos em cofre/variável de ambiente; sem procedimento de rotação na doc lida |
| Chave em navegador | API key **não**; client token sim, mas fica visível a qualquer usuário; remoção é irreversível; token continua ativo se o criador for desativado | **Sim**: só permite enviar eventos, sem leitura; risco é abuso por eventos falsos; bloquear IP é a defesa citada | Doc lida não trata de browser **[não encontrado]** | Doc lida não trata de browser |

- **Guardar só o hash da chave (lado servidor que recebe):** **não achei fonte primária** que trate disso para chaves de ingestão **[não encontrado]**. Fontes próximas: ASVS 13.3.1/13.3.2/13.3.4 (cofre, menor privilégio, expiração e rotação de segredos, [ASVS 5.0.0](https://github.com/OWASP/ASVS/tree/v5.0.0/5.0/en)); [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) (via busca, rotação automatizada em etapas e auditoria de uso, **[confirmar lendo a página]**).
- **Chave pública no navegador:** a única fonte primária que lida que a afirma como padrão aceitável é a do Sentry (DSN pública, apenas escrita) e a do Datadog (client token). Ambas deixam o abuso de envio como risco residual.

---

## I. Retenção de referência (só fatos; consulta em 18/11/2026)

| Produto | Padrão / planos | Fonte |
|---|---|---|
| Datadog | Logs indexados: retenção padrão de 15 dias para on-demand; faixas 3, 7, 15, 30 dias; Flex Logs de 1 a 15 meses. Preços por milhão de eventos mudam por faixa (há divergência entre páginas) **[confirmar na página de preços atual]**. Audit Trail: 90 dias padrão. | [Preços](https://www.datadoghq.com/pricing/), [Audit Trail](https://docs.datadoghq.com/account_management/audit_trail/) (via busca para os valores de log) |
| Sentry | Erros: 30 dias (Developer), 90 (Team, Business, Enterprise). Logs: 30 dias em todos. Replays e anexos: 30 (Developer) ou 90. Retenção é definida na ingestão. | [Retention periods](https://docs.sentry.io/security-legal-pii/security/data-retention-periods/) |
| Grafana Cloud (Loki) | Mínimo de **14 dias** no gratuito e **30 dias** nos pagos; acima de 30 dias é cobrado por GB a cada 30 dias adicionais; gratuito com 50 GB gravados. Retenção por stream possível via suporte (resultado de busca **[confirmar]**). | [Preços de logs](https://grafana.com/docs/grafana-cloud/platform/pricing-and-usage/logs/) |
| Better Stack | Gratuito: 3 GB de logs por mês, retenção de **3 dias**. Pagos: todos os bundles com **30 dias**. Sem bundle: ingestão e retenção por GB (valores por região na página). | [Preços](https://betterstack.com/pricing) |

**Fórmula de disco.** Não há fonte primária única, porque banco e formato ainda não foram escolhidos; é aritmética. 
`disco (GB) = (volume diário bruto em GB ÷ razão de compressão + sobrecarga de índice por dia) × dias de retenção × (1 + folga operacional)`; mais o espaço dos backups locais. Os fatores de compressão, de índice e de folga dependem do armazenamento escolhido e devem ser **medidos** com log real **[medir]**. Fatos úteis para dimensionar: disco do plano de 2 GB = 60 GB (inclui sistema); disco anexado custa US$ 0,10/GB-mês; snapshot US$ 0,05/GB-mês; 7 snapshots automáticos diários mantidos; snapshot automático de disco anexado só por API/CLI (seção C).

---

## O que não foi possível confirmar

1. Preço do Lightsail **em sa-east-1** (as páginas lidas são globais).
2. Se o **disco de sistema** da instância e os **snapshots de instância** são criptografados em repouso; chave do cliente para discos.
3. Se snapshots do Lightsail são incrementais; o que a AWS faz com a mídia após excluir snapshot ou disco.
4. Regras de expiração/ciclo de vida em buckets do Lightsail.
5. Retenção do audit log do **Sentry** e do audit log do **Grafana Cloud** (só indício de busca).
6. Orientação da **ANPD** sobre apagar dado de backup; o guia de segurança lido é a **proposta (Nota Técnica 19/2021)**, não o PDF final.
7. Páginas da **ICO** (403): "beyond use" só por resultado de busca.
8. Versão **final** do EDPB 01/2025 e do NIST SP 800-92 Rev. 1; leitura do **Decreto 12.975/2026** em si.
9. Fonte primária para "guardar só o hash da chave de ingestão" e para pseudonimização de **CPF** ou telefone especificamente.
10. PCI DSS: li a redação do v4.0 (SAQ D); conferir no v4.0.1.

## Exige validação especializada (advogado ou encarregado)

- Enquadramento como agente de pequeno porte e se há tratamento de alto risco (A8).
- Base legal para guardar logs com dado pessoal (legítimo interesse com teste de balanceamento, A3).
- Se a plataforma ou algum produto monitorado é "provedor de aplicações" do art. 15 do Marco Civil e onde mora a guarda oficial dos seis meses (B).
- Se pseudonimizado com HMAC, hash, truncamento ou mascaramento deixa de ser dado pessoal para algum fim; a LGPD trata pseudonimizado como pessoal (A1, F).
- Como cumprir pedido de eliminação (art. 18) com cópia em backup, e o que dizer ao titular (D).
- Prazo de comunicação de incidente e quem é o controlador quando o dado vem dos produtos (A6).
