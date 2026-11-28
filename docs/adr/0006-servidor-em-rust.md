---
status: accepted
---

# Servidor do Monitora AI em Rust

O servidor do Monitora AI é escrito em Rust. A decisão é do responsável pelo produto, tomada na pesquisa inicial, antes do mapa de arquitetura, e não se reabre nos tickets do mapa. Ela anda junto do critério dele para toda escolha, rápido de execução e baixo custo de hospedagem: o servidor divide uma máquina de 2 GB com o banco de logs ([ADR 0002](0002-opensearch-como-banco-de-logs.md)). A troca aceita é que Rust é novo para quem mantém o projeto, que domina TypeScript/Node.js e Java.

Registrado em [Registrar ADRs de Rust e das bibliotecas leves](https://github.com/stacklabs3/monitora-ai/issues/34), em 27/11/2026. A [consolidação da pesquisa inicial](../pesquisa-inicial/consolidacao.md) chama o servidor de "aplicação de monitoramento"; no `GLOSSARY.md`, **Aplicação** é a parte de um produto que envia eventos, e por isso este ADR diz "servidor", como os ADRs 0002 e 0003.

## O que a decisão cobre

- **Só o servidor:** o programa único do [ADR 0003](0003-modulos-e-seams-do-servidor.md), com recebimento, consulta, alertas e os demais módulos.
- **O banco fica de fora:** o armazenamento não precisa ser feito do zero nem ser escrito em Rust. O banco de logs é o OpenSearch, que roda na JVM (ADR 0002).
- **As bibliotecas ficam de fora:** cada uma é escrita na linguagem da aplicação que a usa, Node.js e depois Java ([ADR 0001](0001-formato-proprio-de-envio-e-bibliotecas-leves.md) e [ADR 0007](0007-bibliotecas-leves-sem-servidor-local.md)).
- **O painel fica de fora:** é feito em Solid e sai como arquivos estáticos ([ADR 0004](0004-solid-no-painel.md)).

## Consequências

- **Ninguém lê o Rust sozinho:** quem mantém lê com ajuda e ainda não acha erro sozinho. Toda regra de Rust é cobrada por máquina, teste ou agente revisor, e usa-se o Rust mais simples que cumpra as metas ([Restrições para as regras](https://github.com/stacklabs3/monitora-ai/issues/41), LR9 e LR12).
- **Pilha mais usada:** a mesma restrição levou a `tokio` e `axum`, a pilha mais usada e documentada ([Escolher as bibliotecas Rust do servidor](https://github.com/stacklabs3/monitora-ai/issues/28)).
- **Duas linguagens a mais no repositório:** o servidor em Rust convive com a biblioteca em TypeScript e o painel em Solid, cada um na sua pasta e com a ferramenta da sua linguagem ([Decidir entre um repositório ou vários](https://github.com/stacklabs3/monitora-ai/issues/33)).

## Ainda sem prova

A memória do servidor em Rust não foi medida. Ela entra na conta de memória de [Validar o banco na AWS](https://github.com/stacklabs3/monitora-ai/issues/60), ao lado do 1,5 GB do banco. Se a soma não couber nos 2 GB, reabre a escolha das bibliotecas do servidor, e não a da linguagem.

## Fontes

- [Consolidação da pesquisa inicial](../pesquisa-inicial/consolidacao.md), seção "Decisões do responsável pelo produto"
- [Restrições do projeto](https://github.com/stacklabs3/monitora-ai/issues/19): máquina de 2 GB, linguagens dominadas e Rust novo para quem mantém
- [Restrições para as regras](https://github.com/stacklabs3/monitora-ai/issues/41): LR9 e LR12
- [Escolher as bibliotecas Rust do servidor](https://github.com/stacklabs3/monitora-ai/issues/28): memória sem medida e a condição de reabrir
- [ADR 0002](0002-opensearch-como-banco-de-logs.md) e [ADR 0003](0003-modulos-e-seams-do-servidor.md)
