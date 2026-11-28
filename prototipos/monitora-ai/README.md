# Protótipo único do Monitora AI

Protótipo HTML+JSX do desenho inicial (React 18 + Babel no navegador, sem build). Nasceu em
[Criar o protótipo único](https://github.com/stacklabs3/monitora-ai/issues/16) e segue as decisões do
[mapa de Protótipo](https://github.com/stacklabs3/monitora-ai/issues/11). Contrato da família
`*-prototipo`: `.claude/skills/prototipo-html/references/convencoes.md`.

## Rodar

```bash
python3 -m http.server 8765 --directory prototipos/monitora-ai
```

Abra http://localhost:8765. Precisa de HTTP: `file://` não carrega os `.jsx`.

## Abas

| Aba | Superfícies | Tema de abertura | Rotinas |
|---|---|---|---|
| Painel | computador | claro | Entrar no painel · Ver o painel como Administrador · Buscar eventos · Ler os avisos da busca |
| Painel no celular | iOS, Android | escuro | Entrar pelo link do alerta |
| Alerta no Telegram | iOS, Android | escuro | Receber o alerta e abrir o painel |

As rotinas dos lotes Investigar, Administrar e Alertas entram pelo `/integrar-ao-prototipo`, uma por
ticket, em `components/visoes.jsx`.

## Endereço

`?visao=<painel|celular|telegram>&superficie=<desktop|ios|android>&tema=<light|dark>&estado=<estado>&print=1`
abre uma combinação exata, e o hash diz a tela (ex.: `#/painel/excurfly/producao/administrador`).

## Prints

`prints/<rotina>/`, tirados com:

```bash
sh .claude/skills/prototipo-html/scripts/rodar http://localhost:8765 <rotina> prototipos/monitora-ai/prints
```
