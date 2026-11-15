# Monitora AI

Projeto de uma plataforma independente e auto-hospedada para receber e investigar logs de múltiplos produtos. O Excurfly é o primeiro caso de referência; a plataforma não deve depender de suas regras de negócio.

Este repositório está na fase de definição: a aplicação central será escrita em Rust, com integrações leves para Node.js e Java e uma interface web de investigação. As escolhas de armazenamento, protocolo e framework da interface permanecem abertas e dependerão de avaliação.

## Pesquisa inicial

A [consolidação](docs/pesquisa-inicial/consolidacao.md) reúne as decisões já tomadas e aponta para os estudos de armazenamento, ingestão e custos. São referências iniciais, não resultados de benchmark ou arquitetura definitiva.

O [mapa de decisões](https://github.com/stacklabs3/monitora-ai/issues/1) organiza as perguntas, pesquisas e dependências para chegar à especificação e à arquitetura da primeira versão.
