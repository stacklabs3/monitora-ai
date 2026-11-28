#!/usr/bin/env python3
"""Torre de controle autônoma do Excurfly.

Leva ao fim as issues abertas que não são `ready-for-human`, abrindo execuções headless do
Claude Code (`claude -p`) no lugar de sessões do app. Segue o ciclo do lote: escolhe até N issues
`ready-for-agent`, roda par atrás de par só com elas e, quando a última fila do lote entra na `main`,
a fila de ajustes sozinha; tickets de wayfinder, triagem e spec em paralelo, um por execução. Confere o estado pela fonte (git e gh), nunca pelo aviso.

Como rodar, parar e ler: `.claude/torre/README.md`.
"""
from __future__ import annotations

import argparse
import copy
import datetime
import difflib
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

RAIZ = Path(__file__).resolve().parents[2]
PASTA_TORRE = RAIZ / ".scratch" / "torre"
ARQUIVO_ESTADO = PASTA_TORRE / "torre-estado.json"
ARQUIVO_STATUS = PASTA_TORRE / "torre-status.md"
ARQUIVO_MELHORIAS = PASTA_TORRE / "melhorias-em-teste.json"
ARQUIVO_PARAR = PASTA_TORRE / "PARAR"
ARQUIVO_PID = PASTA_TORRE / "torre.pid"
PASTA_EXECUCOES = PASTA_TORRE / "execucoes"
PASTA_RESULTADOS = PASTA_TORRE / "resultados"
PASTA_PARES = PASTA_TORRE / "pares"
PASTA_WORKTREES = RAIZ / ".claude" / "worktrees"
ARQUIVO_ACESSOS = RAIZ / ".claude" / "settings.local.json"
ARQUIVO_CONFIGURACAO = Path(__file__).with_name("configuracao.json")

TIPOS_DE_CODIGO = {"fila", "ajustes", "planejar-par"}
TIPOS_LATERAIS = {"spec", "triagem", "avaliar", "melhorias"}
RESULTADOS_DE_AVALIACAO = {"ticket-resolvido", "destino", "bloqueado", "fechado", "sem-acao"}

PADRAO_BLOQUEIO = re.compile(r"\[watchdog ([a-z0-9-]+)\] BLOQUEADO")
PADRAO_JA_RESOLVEU = re.compile(r"já resolveu|ja resolveu")
PADRAO_PERMISSAO = re.compile(
    r"(?i)(permission[^\n]{0,80}(denied|negad)|requires approval|não autorizad|sem autorização)"
)
PADRAO_SQUASH_PERDIDO = re.compile(
    r"(?i)n[aã]o (achei|encontrei|est[aá])[^\n]{0,60}\bna (main|dev|integra)"
)
# Limite de uso do Claude Code, lido só no `result` de erro e nas mensagens de erro da API do stream.
# Textos reais (transcrições das duas contas, 21/11): "You've hit your session limit · resets 7:40pm
# (America/Sao_Paulo)" e "You've hit your 5-hour limit · resets 6:20am (America/Sao_Paulo)", com
# `"error": "rate_limit"` na mensagem.
PADRAO_LIMITE = re.compile(r"(?i)(usage limit|hit your [\w -]{0,20}limit|limit reached|rate.limit)")
PADRAO_PEDE_SPEC = re.compile(r"#(\d+)[^#]*?/to-spec")
PADRAO_LIMITE_EPOCH = re.compile(r"\|(\d{10})\b")
PADRAO_LIMITE_HORA = re.compile(r"(?i)resets?\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)")

# Conta 1 = o `claude` padrão; conta 2 = outro CLAUDE_CONFIG_DIR (o alias `claude2` do zsh não
# existe no subprocess).
CONTAS_DO_CLAUDE: Dict[str, Optional[str]] = {"1": None, "2": "/Users/matheussouza/.claude-conta2"}
# Só a conta 1 (Matheus, 27/11; de 25/11 a 27/11 foi só a conta 2): toda execução nova e toda retomada,
# também a retomada por limite, nasce nela. Com ela no limite a Torre espera; a outra conta fica guardada
# acima e nenhuma escolha a usa.
CONTA_DA_TORRE = "1"
# O Chrome deste Mac, com a extensão, está ligado à conta 1: a execução que precisa dele não abre.
CONTA_DO_CHROME_LOCAL = "1"
# Decisão pela recomendação só vale passada pelas cinco lentes (Matheus, 27/11; antes, quatro, de 21/11):
# a Torre confere no stream que cada uma foi carregada pela ferramenta Skill.
LENTES_DE_DECISAO = ["human-architect-mindset", "domain-modeling", "ceo-advisor", "cto-advisor", "codebase-design"]
# A execução aberta antes de 27/11 não grava a lista que recebeu: vale a de quatro do kickoff dela.
LENTES_ATE_27_11 = ["human-architect-mindset", "domain-modeling", "ceo-advisor", "cto-advisor"]

processos_vivos: Dict[str, subprocess.Popen] = {}


# ---------------------------------------------------------------- tempo e arquivos


def agora() -> datetime.datetime:
    return datetime.datetime.now().astimezone()


def agora_iso() -> str:
    return agora().isoformat(timespec="seconds")


def ler_iso(texto: Optional[str]) -> Optional[datetime.datetime]:
    if not texto:
        return None
    return datetime.datetime.fromisoformat(texto.replace("Z", "+00:00"))


def minutos_desde(texto: Optional[str]) -> float:
    momento = ler_iso(texto)
    if momento is None:
        return float("inf")
    return (agora() - momento).total_seconds() / 60


def ler_json(caminho: Path, padrao: Any) -> Any:
    try:
        return json.loads(caminho.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return padrao
    except json.JSONDecodeError as erro:
        registrar(f"JSON inválido em {caminho}: {erro}")
        return padrao


def gravar_json(caminho: Path, conteudo: Any) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    temporario = caminho.with_suffix(caminho.suffix + ".tmp")
    temporario.write_text(json.dumps(conteudo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporario.replace(caminho)


def registrar(mensagem: str) -> None:
    print(f"[torre {agora().strftime('%d/%m %H:%M:%S')}] {mensagem}", flush=True)


# ---------------------------------------------------------------- a fonte: git e gh


class FalhaDaFonte(RuntimeError):
    pass


def rodar(comando: List[str], cwd: Path = RAIZ, tolerante: bool = False) -> str:
    processo = subprocess.run(comando, cwd=str(cwd), capture_output=True, text=True)
    if processo.returncode != 0 and not tolerante:
        raise FalhaDaFonte(f"{' '.join(comando)} saiu com {processo.returncode}: {processo.stderr.strip()[:400]}")
    return processo.stdout


def gh_json(argumentos: List[str]) -> Any:
    saida = rodar(["gh"] + argumentos)
    return json.loads(saida) if saida.strip() else None


def pr_da_branch(repo: str, branch: str) -> Optional[Dict[str, Any]]:
    """A PR mais recente da branch. O merge é squash: o estado vem do gh, não do git (M5)."""
    prs = gh_json(["pr", "list", "--repo", repo, "--state", "all", "--head", branch,
                   "--json", "number,state,mergedAt,baseRefName,createdAt", "--limit", "5"]) or []
    if not prs:
        return None
    return sorted(prs, key=lambda pr: pr["number"])[-1]


def tirar_retrato(configuracao: Dict[str, Any], estado: Dict[str, Any], buscar: bool = True) -> Dict[str, Any]:
    repo = configuracao["repo"]
    if buscar:
        rodar(["git", "fetch", "origin", "--prune", "--quiet"], tolerante=True)
    issues = gh_json(["issue", "list", "--repo", repo, "--state", "open", "--limit", "1000",
                      "--json", "number,title,labels,createdAt"]) or []
    issues_abertas = {
        str(issue["number"]): {
            "numero": issue["number"],
            "titulo": issue["title"],
            "rotulos": sorted(rotulo["name"] for rotulo in issue["labels"]),
            "criada_em": issue["createdAt"],
        }
        for issue in issues
    }
    branches = {}
    for linha in rodar(["git", "ls-remote", "--heads", "origin"]).splitlines():
        sha, referencia = linha.split("\t")
        branches[referencia.replace("refs/heads/", "")] = sha
    prs_das_integracoes = {}
    for nome_integracao in integracoes_acompanhadas(estado):
        prs_das_integracoes[nome_integracao] = pr_da_branch(repo, nome_integracao)
    return {
        "momento": agora_iso(),
        "issues_abertas": issues_abertas,
        "branches": branches,
        "prs_das_integracoes": prs_das_integracoes,
    }


def integracoes_acompanhadas(estado: Dict[str, Any]) -> List[str]:
    codigo = estado["codigo"]
    nomes = []
    if codigo.get("ajustes"):
        nomes.append(f"integracao/{codigo['ajustes']['nome']}")
    for fila in (codigo.get("par") or {}).get("filas", []):
        nomes.append(f"integracao/{fila['nome']}")
    return nomes


def integracao_mesclada(retrato: Dict[str, Any], nome_fila: str, desde: Optional[str] = None) -> bool:
    """PR da integração MERGED na dev, aberta depois de a frente começar: nome de branch se repete entre ciclos."""
    pr = retrato["prs_das_integracoes"].get(f"integracao/{nome_fila}")
    if not (pr and pr["state"] == "MERGED" and pr.get("baseRefName") == "main"):
        return False
    inicio = ler_iso(desde)
    criada = ler_iso(pr.get("createdAt"))
    return inicio is None or (criada is not None and criada >= inicio)


# ---------------------------------------------------------------- o que está fora de escopo


def motivo_de_fora(issue: Dict[str, Any], configuracao: Dict[str, Any]) -> Optional[str]:
    numero = str(issue["numero"])
    if numero in configuracao["issues_fora"]:
        return configuracao["issues_fora"][numero]
    for rotulo in issue["rotulos"]:
        if rotulo in configuracao["rotulos_fora"]:
            return f"rótulo {rotulo}"
    return None


def issues_de_ajustes_abertas(retrato: Dict[str, Any], configuracao: Dict[str, Any]) -> List[Dict[str, Any]]:
    """As issues que o Matheus mandou rodar numa fila de ajustes só delas (`issues_de_ajustes`), abertas no retrato."""
    numeros = configuracao.get("issues_de_ajustes") or {}
    abertas = [issue for numero, issue in retrato["issues_abertas"].items() if numero in numeros]
    return sorted(abertas, key=lambda issue: issue["numero"])


# AGENTS.md, regra 1: issue de implementação só se ativa com Protótipo, Arquitetura, Fases e Regras de código
# fechados (Infra não trava). Com um deles aberto, o watchdog do `ativar-issue` barra a fila.
ROTULOS_DOS_MAPAS_INICIAIS_QUE_TRAVAM = ["mapa-inicial:prototipo", "mapa-inicial:arquitetura", "mapa-inicial:fases",
                                         "mapa-inicial:regras-de-codigo"]


def mapas_iniciais_que_travam(retrato: Dict[str, Any]) -> List[int]:
    """Os mapas iniciais abertos que impedem ativar issue de implementação."""
    return sorted(int(issue["numero"]) for issue in retrato["issues_abertas"].values()
                  if any(rotulo in ROTULOS_DOS_MAPAS_INICIAIS_QUE_TRAVAM for rotulo in issue["rotulos"]))


def candidatas_de_codigo(retrato: Dict[str, Any], configuracao: Dict[str, Any], estado: Dict[str, Any]) -> List[Dict[str, Any]]:
    """As issues que podem entrar num lote; nenhuma enquanto um mapa inicial que trava estiver aberto."""
    if mapas_iniciais_que_travam(retrato):
        return []
    em_fila = set()
    for fila in (estado["codigo"].get("par") or {}).get("filas", []):
        em_fila.update(fila["issues"])
    de_ajustes = set(configuracao.get("issues_de_ajustes") or {})
    candidatas = []
    for issue in retrato["issues_abertas"].values():
        if "ready-for-agent" not in issue["rotulos"] or motivo_de_fora(issue, configuracao):
            continue
        if str(issue["numero"]) in de_ajustes:
            continue
        if any(rotulo.startswith("wayfinder:") or rotulo == "spec" for rotulo in issue["rotulos"]):
            continue
        if issue["numero"] in em_fila:
            continue
        candidatas.append(issue)
    return sorted(candidatas, key=lambda issue: issue["numero"])


def candidatas_do_lote(retrato: Dict[str, Any], configuracao: Dict[str, Any], estado: Dict[str, Any]) -> List[Dict[str, Any]]:
    """As candidatas de código que são do lote aberto. Sem lote, nenhuma: o planejador só planeja dentro de um lote."""
    lote = estado["codigo"].get("lote")
    if not lote:
        return []
    do_lote = set(lote["issues"])
    return [issue for issue in candidatas_de_codigo(retrato, configuracao, estado) if issue["numero"] in do_lote]


def abrir_lote(estado: Dict[str, Any], retrato: Dict[str, Any], configuracao: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Escolhe o lote: as `tamanho_do_lote` candidatas mais antigas, as que o planejador deixou de fora no lote anterior por último.

    Issue que aparece depois (triagem, issue aberta por uma fila) só entra no lote seguinte. Quando as únicas candidatas são
    as que o lote anterior deixou de fora e ele não levou nada à `main`, não abre: o planejador as deixaria de fora de novo."""
    codigo = estado["codigo"]
    ultimo = codigo.get("ultimo_lote") or {}
    deixadas = set(ultimo.get("fora") or [])
    candidatas = candidatas_de_codigo(retrato, configuracao, estado)
    novas = [issue["numero"] for issue in candidatas if issue["numero"] not in deixadas]
    if not novas and not ultimo.get("mesclou", True):
        return None
    ordem = novas + [issue["numero"] for issue in candidatas if issue["numero"] in deixadas]
    # A `prioridade_do_lote` da configuração (Matheus, 24/11: o que afeta o uso vai na frente) passa à frente, na ordem dela.
    prioridade = [int(numero_da_issue) for numero_da_issue in configuracao.get("prioridade_do_lote") or {}]
    ordem = [numero for numero in prioridade if numero in ordem] + [numero for numero in ordem if numero not in prioridade]
    escolhidas = ordem[:int(configuracao.get("tamanho_do_lote", 10))]
    if not escolhidas:
        return None
    numero = int(ultimo.get("numero", 0)) + 1
    codigo["lote"] = {"numero": numero, "issues": escolhidas, "aberto_em": agora_iso(), "pares": [], "filas": []}
    anotar(estado, f"lote {numero} aberto: {escolhidas}")
    return codigo["lote"]


def fechar_lote(estado: Dict[str, Any], fora: List[int]) -> None:
    """Fecha o lote: com fila na `main`, abre a fila de ajustes dele (o CI local roda uma vez por lote); sem nenhuma, volta a planejar."""
    codigo = estado["codigo"]
    lote = codigo["lote"]
    codigo["lote"] = None
    codigo["ultimo_lote"] = {"numero": lote["numero"], "fora": sorted(fora), "mesclou": bool(lote["filas"])}
    if lote["filas"]:
        codigo["ajustes"] = {"nome": f"ajustes-lote-{lote['numero']}-{agora().strftime('%d%m')}", "externa": False,
                             "aberta_em": agora_iso(), "filas_do_lote": list(lote["filas"])}
        codigo["fase"] = "ajustes"
        anotar(estado, f"lote {lote['numero']} na dev (pares {lote['pares']}); abre a fila de ajustes {codigo['ajustes']['nome']}")
    else:
        codigo["fase"] = "planejar-par"
        anotar(estado, f"lote {lote['numero']} fecha sem fila na dev; de fora: {sorted(fora)}")


def candidatas_de_triagem(retrato: Dict[str, Any], configuracao: Dict[str, Any]) -> List[Dict[str, Any]]:
    conhecidos = set(configuracao["rotulos_de_triagem"]) | set(configuracao["rotulos_do_metodo"])
    candidatas = []
    for issue in retrato["issues_abertas"].values():
        if motivo_de_fora(issue, configuracao):
            continue
        rotulos = set(issue["rotulos"])
        if "needs-triage" in rotulos or not (rotulos & conhecidos):
            candidatas.append(issue)
    return sorted(candidatas, key=lambda issue: issue["numero"])


def candidatas_de_avaliacao(retrato: Dict[str, Any], configuracao: Dict[str, Any], estado: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Mapas, specs e grillings avulsos: cada execução avalia um e resolve no máximo um ticket (M7)."""
    em_spec = {str(frente["mapa"]) for frente in estado["specs"]}  # mapa que já virou spec não volta à rotação
    horas_parado = configuracao["horas_para_reavaliar_parado"]
    candidatas = []
    for issue in retrato["issues_abertas"].values():
        rotulos = set(issue["rotulos"])
        if not rotulos & {"wayfinder:map", "spec", "wayfinder:grilling"}:
            continue
        if motivo_de_fora(issue, configuracao) or str(issue["numero"]) in em_spec:
            continue
        avaliacao = estado["avaliacoes"].get(str(issue["numero"]), {})
        if avaliacao.get("situacao") in {"parado", "sem-acao"} and minutos_desde(avaliacao.get("ultima")) < horas_parado * 60:
            continue
        candidatas.append(dict(issue, ultima=avaliacao.get("ultima") or ""))
    return sorted(candidatas, key=lambda issue: (issue["ultima"], issue["numero"]))


# ---------------------------------------------------------------- estado


def estado_inicial(configuracao: Dict[str, Any]) -> Dict[str, Any]:
    semente = configuracao["semente"]
    return {
        "versao": 1,
        "iniciado_em": agora_iso(),
        "ciclo": 1,
        "codigo": {
            "fase": "ajustes",
            "ajustes": dict(semente["ajustes_em_curso"]),
            "par": None,
            "proximo_par": dict(semente["proximo_par"]),
        },
        "specs": [dict(frente) for frente in semente["specs"]],
        "avaliacoes": {},
        "execucoes": {},
        "historico": [],
        "bloqueios": [],
        "para_o_matheus": [],
        "eventos": [],
        "fora_da_dev": {"quando": None, "itens": []},
        "melhorias_pendentes": False,
        "fim": None,
    }


def anotar(estado: Dict[str, Any], texto: str) -> None:
    registrar(texto)
    estado["eventos"].append({"quando": agora_iso(), "texto": texto})
    del estado["eventos"][:-200]


def pedir_ao_matheus(estado: Dict[str, Any], texto: str, origem: str) -> None:
    if any(pedido["texto"] == texto for pedido in estado["para_o_matheus"]):
        return
    estado["para_o_matheus"].append({"quando": agora_iso(), "texto": texto, "origem": origem, "feito": False})


# ---------------------------------------------------------------- as duas contas do Claude Code


def contas_do_estado(estado: Dict[str, Any]) -> Dict[str, Any]:
    contas = estado.setdefault("contas", {})
    contas.setdefault("em_uso", CONTA_DA_TORRE)
    contas.setdefault("limitada_ate", {})
    contas.setdefault("contador", 0)
    return contas


def avancar_contador(estado: Dict[str, Any]) -> Dict[str, int]:
    contas = contas_do_estado(estado)
    contas["contador"] += 1
    return {"contador": contas["contador"]}


def prazo_do_limite(texto: str) -> datetime.datetime:
    """Até quando a conta fica no limite: o epoch do aviso, a hora do "resets 3pm" ou o padrão da configuração."""
    achado_epoch = PADRAO_LIMITE_EPOCH.search(texto)
    if achado_epoch:
        return datetime.datetime.fromtimestamp(int(achado_epoch.group(1))).astimezone()
    achado_hora = PADRAO_LIMITE_HORA.search(texto)
    if achado_hora:
        hora = int(achado_hora.group(1)) % 12 + (12 if achado_hora.group(3).lower() == "pm" else 0)
        minuto = int(achado_hora.group(2)) if achado_hora.group(2) else 0
        momento = agora().replace(hour=hora, minute=minuto, second=0, microsecond=0)
        return momento if momento > agora() else momento + datetime.timedelta(days=1)
    return agora() + datetime.timedelta(minutes=CONFIGURACAO_ATUAL.get("minutos_conta_no_limite", 60))


def issue_do_chrome_local(acao: Dict[str, Any], retrato: Dict[str, Any], configuracao: Dict[str, Any]) -> Optional[str]:
    """A primeira issue que o kickoff cita com o rótulo do Chrome local, ou None."""
    rotulo_do_chrome = configuracao.get("rotulo_chrome_local")
    if not rotulo_do_chrome or "kickoff" not in acao:
        return None
    issues_citadas = sorted(set(re.findall(r"#(\d+)", acao["kickoff"](acao["nome"]))), key=int)
    return next((numero_da_issue for numero_da_issue in issues_citadas
                 if rotulo_do_chrome in retrato["issues_abertas"].get(numero_da_issue, {}).get("rotulos", [])), None)


def segurar_chrome_local(acao: Dict[str, Any], estado: Dict[str, Any], retrato: Dict[str, Any], configuracao: Dict[str, Any]) -> bool:
    """True quando a ação precisa do Chrome local e não abre (Matheus, 25/11/2026), sem gastar tentativa.

    A Torre não abre execução com `--chrome`: a issue com o rótulo espera, mesmo na conta do Chrome local."""
    numero_da_issue = issue_do_chrome_local(acao, retrato, configuracao)
    if numero_da_issue is None:
        return False
    pedir_ao_matheus(estado, f"a #{numero_da_issue} precisa do Chrome local, e a Torre não abre execução com o Chrome",
                     acao["nome"])
    return True


def conta_disponivel(estado: Dict[str, Any]) -> Optional[str]:
    """A `CONTA_DA_TORRE`, a única da Torre; None com ela no limite (a Torre espera, sem ir na outra). Não anda o contador."""
    contas = contas_do_estado(estado)
    limitada_ate = ler_iso(contas["limitada_ate"].get(CONTA_DA_TORRE))
    if limitada_ate is not None and limitada_ate > agora():
        pedir_ao_matheus(estado, f"A conta {CONTA_DA_TORRE} do Claude Code está no limite até {limitada_ate.strftime('%d/%m %H:%M')}: "
                                 f"a Torre espera, sem gastar tentativas, e não usa a outra conta.", "torre")
        return None
    contas["limitada_ate"].pop(CONTA_DA_TORRE, None)
    contas["em_uso"] = CONTA_DA_TORRE
    return CONTA_DA_TORRE


def marcar_limite(estado: Dict[str, Any], conta: str, texto: str) -> None:
    contas = contas_do_estado(estado)
    prazo = prazo_do_limite(texto)
    contas["limitada_ate"][conta] = prazo.isoformat(timespec="seconds")
    anotar(estado, f"a conta {conta} do Claude Code bateu no limite até {prazo.strftime('%d/%m %H:%M')}")


def ambiente_da_conta(conta: str) -> Dict[str, str]:
    ambiente = dict(os.environ)
    pasta_da_conta = CONTAS_DO_CLAUDE[conta]
    if pasta_da_conta:
        ambiente["CLAUDE_CONFIG_DIR"] = pasta_da_conta
    else:
        ambiente.pop("CLAUDE_CONFIG_DIR", None)
    return ambiente


def skill_do_uso(uso_de_ferramenta: Dict[str, Any]) -> Optional[str]:
    """O nome da skill que um `tool_use` da ferramenta Skill pediu, sem barra nem prefixo de plugin."""
    if uso_de_ferramenta.get("name") != "Skill" or not isinstance(uso_de_ferramenta.get("input"), dict):
        return None
    nome = str(uso_de_ferramenta["input"].get("skill") or "").lstrip("/")
    return nome.split(":")[-1] or None


def lentes_que_faltam(execucao: Dict[str, Any], resultado: Optional[Dict[str, Any]]) -> List[str]:
    """As lentes não carregadas por uma execução que diz ter decidido pela recomendação."""
    if not resultado or not resultado.get("decisoes"):
        return []
    carregadas = set(execucao.get("skills_carregadas") or [])
    lentes_pedidas = execucao.get("lentes") or LENTES_ATE_27_11
    return [lente for lente in lentes_pedidas if lente not in carregadas]


def texto_de_limite(evento: Dict[str, Any], partes: List[Dict[str, Any]]) -> Optional[str]:
    """O texto do limite quando o evento é um `result` de erro ou uma mensagem de erro da API que o cita."""
    if evento.get("type") == "result":
        texto = str(evento.get("result", ""))
        erro = evento.get("is_error") or (evento.get("subtype") or "success") != "success"
        return texto if erro and PADRAO_LIMITE.search(texto) else None
    if evento.get("type") == "assistant" and (evento.get("error") or evento.get("isApiErrorMessage")):
        texto = " ".join(parte.get("text", "") for parte in partes if parte.get("type") == "text") or str(evento.get("error"))
        return texto if evento.get("error") == "rate_limit" or PADRAO_LIMITE.search(texto) else None
    return None


def execucoes_rodando(estado: Dict[str, Any], tipos: set) -> List[Dict[str, Any]]:
    return [execucao for execucao in estado["execucoes"].values()
            if execucao["situacao"] == "rodando" and execucao["tipo"] in tipos]


# ---------------------------------------------------------------- melhorias em teste (M1–M8)


def melhorias_vazias(numero_ciclo: int) -> Dict[str, Any]:
    return {
        "ciclo": numero_ciclo,
        "inicio": agora_iso(),
        "fim": None,
        "M1_filas_paradas": [],
        "M2_varreduras": [],
        "M2_final": None,
        "M3_copias_de_acessos": 0,
        "M3_paradas_por_permissao": [],
        "M4_execucoes_com_busca": 0,
        "M4_duplicatas": [],
        "M5_squash_nao_achado": [],
        "M6_acoes_barradas": [],
        "M7_execucoes_de_wayfinder": 0,
        "M7_bloqueios_ja_resolveu": [],
        "M8_bloqueios_de_watchdog": [],
    }


def carregar_melhorias(estado: Dict[str, Any]) -> Dict[str, Any]:
    melhorias = ler_json(ARQUIVO_MELHORIAS, {"ciclos": {}})
    chave = str(estado["ciclo"])
    if chave not in melhorias["ciclos"]:
        melhorias["ciclos"][chave] = melhorias_vazias(estado["ciclo"])
    return melhorias


def ciclo_das_melhorias(melhorias: Dict[str, Any], estado: Dict[str, Any]) -> Dict[str, Any]:
    return melhorias["ciclos"][str(estado["ciclo"])]


def tabela_das_melhorias(ciclo: Dict[str, Any]) -> str:
    linhas = [
        ("M1", "Orquestrador confere a fonte", len(ciclo["M1_filas_paradas"]), "filas paradas por mais de um ciclo"),
        ("M2", "Nada fora da dev", ciclo["M2_final"] if ciclo["M2_final"] is not None else "—", "itens fora da dev ao fim do ciclo"),
        ("M3", "Worktree nasce com os acessos", len(ciclo["M3_paradas_por_permissao"]), f"paradas por permissão ({ciclo['M3_copias_de_acessos']} cópias)"),
        ("M4", "Buscar antes de criar issue", len(ciclo["M4_duplicatas"]), f"duplicatas suspeitas ({ciclo['M4_execucoes_com_busca']} execuções)"),
        ("M5", "Conferência pelo squash", len(ciclo["M5_squash_nao_achado"]), "\"não achei na dev\""),
        ("M6", "Delegações em todo kickoff", len(ciclo["M6_acoes_barradas"]), "ações barradas por autorização"),
        ("M7", "Um ticket por execução", len(ciclo["M7_bloqueios_ja_resolveu"]), f"bloqueios \"já resolveu\" ({ciclo['M7_execucoes_de_wayfinder']} execuções)"),
        ("M8", "Falsos positivos do guarda-bash", len(ciclo["M8_bloqueios_de_watchdog"]), "bloqueios registrados (lista para o relatório)"),
    ]
    texto = ["| # | Melhoria | Medida | O que conta | Passou? |", "|---|---|---|---|---|"]
    for codigo, nome, medida, explicacao in linhas:
        if codigo == "M8":
            veredito = "relatório"
        else:
            veredito = "sim" if medida == 0 else ("—" if medida == "—" else "não")
        texto.append(f"| {codigo} | {nome} | {medida} | {explicacao} | {veredito} |")
    return "\n".join(texto)


# ---------------------------------------------------------------- M2: o que está fora da dev


def e_ancestral(ancestral: str, descendente: str) -> bool:
    return subprocess.run(["git", "merge-base", "--is-ancestor", ancestral, descendente],
                          cwd=str(RAIZ), capture_output=True).returncode == 0


def igual_em_alguma(caminho: str, remota: str, integracoes: List[str]) -> bool:
    """O arquivo da branch já está, igual, numa integração aberta: está a caminho da dev."""
    return any(subprocess.run(["git", "diff", "--quiet", integracao, remota, "--", caminho],
                              cwd=str(RAIZ), capture_output=True).returncode == 0 for integracao in integracoes)


def varrer_fora_da_dev(configuracao: Dict[str, Any], retrato: Dict[str, Any], estado: Dict[str, Any]) -> List[Dict[str, Any]]:
    repo = configuracao["repo"]
    limite = time.time() - configuracao["dias_de_branch_para_varrer"] * 86400
    prs = gh_json(["pr", "list", "--repo", repo, "--state", "all", "--limit", "1500",
                   "--json", "headRefName,state"]) or []
    abertas = {pr["headRefName"] for pr in prs if pr["state"] == "OPEN"}
    mescladas = {pr["headRefName"] for pr in prs if pr["state"] == "MERGED"}
    integracoes_abertas = [branch for branch in retrato["branches"]
                           if branch.startswith("integracao/") and branch in abertas]
    integracoes_abertas += [nome for nome in integracoes_acompanhadas(estado) if nome in retrato["branches"]]
    datas = {}
    for linha in rodar(["git", "for-each-ref", "--format=%(refname:short) %(committerdate:unix)", "refs/remotes/origin/"]).splitlines():
        partes = linha.split(" ")
        if len(partes) == 2:
            datas[partes[0].replace("origin/", "", 1)] = int(partes[1])
    itens = []
    for branch in sorted(retrato["branches"]):
        if not branch.startswith(("research/", "chore/", "issue/")):
            continue
        if datas.get(branch, 0) < limite or branch in abertas or branch.startswith("chore/torre-autonoma"):
            continue
        if estado.get("fora_da_dev_tratadas", {}).get(branch) == retrato["branches"][branch]:
            continue
        remota = f"origin/{branch}"
        if any(e_ancestral(remota, f"origin/{integracao}") for integracao in set(integracoes_abertas)):
            continue
        if branch.startswith("issue/"):
            numero = re.match(r"issue/(\d+)", branch)
            if not numero or numero.group(1) not in retrato["issues_abertas"] or branch in mescladas:
                continue
            if any(numero_fila == int(numero.group(1)) for fila in (estado["codigo"].get("par") or {}).get("filas", []) for numero_fila in fila["issues"]):
                continue
        base = rodar(["git", "merge-base", "origin/main", remota], tolerante=True).strip()
        if not base:
            continue
        mudados = [caminho for caminho in rodar(["git", "diff", "--name-only", "--diff-filter=AM", base, remota], tolerante=True).splitlines() if caminho]
        if not mudados:
            continue
        ausentes = [caminho for caminho in mudados
                    if subprocess.run(["git", "cat-file", "-e", f"origin/main:{caminho}"], cwd=str(RAIZ), capture_output=True).returncode != 0]
        diferentes = []
        if branch not in mescladas:
            diferentes = [caminho for caminho in rodar(["git", "diff", "--name-only", "origin/main", remota, "--"] + mudados, tolerante=True).splitlines() if caminho and caminho not in ausentes]
        integracoes_vivas = [f"origin/{integracao}" for integracao in set(integracoes_abertas)]
        ausentes = [caminho for caminho in ausentes if not igual_em_alguma(caminho, remota, integracoes_vivas)]
        diferentes = [caminho for caminho in diferentes if not igual_em_alguma(caminho, remota, integracoes_vivas)]
        if ausentes or diferentes:
            itens.append({"branch": branch, "so_na_branch": ausentes, "diferentes_da_dev": diferentes,
                          "pesquisa_so_na_branch": [caminho for caminho in ausentes if caminho.startswith("docs/research/")]})
    return itens


# ---------------------------------------------------------------- kickoffs (M4, M5, M6 dentro)


def bloco_headless(nome_execucao: str) -> str:
    resultado = PASTA_RESULTADOS / f"{nome_execucao}.json"
    return f"""## Como esta execução roda
Você roda headless (`claude -p`), aberta pelo `.claude/torre/torre.py`, a Torre autônoma. Não há humano no chat nem turno seguinte:
- não termine a resposta enquanto houver trabalho; a execução acaba quando você responde pela última vez;
- rode subagentes **em primeiro plano** (sem `run_in_background`) e espere cada um; não use `/loop`, `ScheduleWakeup`, `CronCreate`, `start_session`, `SendMessage` à Torre nem Monitor de espera;
- pergunta ou folha de decisão: decida você, pela delegação abaixo, e registre na issue;
- se o `vigia-prompt` pedir `/nova-sessao` (smart zone), grave o estado da rodada no git e na issue, grave o resultado com `"resultado": "smart-zone"` e termine: a Torre abre a continuação;
- bloqueio de watchdog é informação, não obstáculo: leia o motivo, siga a rota que ele indica e **nunca** tente o mesmo efeito por outro caminho (AGENTS.md, regra 21). Anote o bloqueio no resultado.

**Antes de terminar**, grave `{resultado}` (caminho absoluto, fora da worktree) com:
`{{"resultado": "<valor pedido abaixo>", "resumo": "<3 linhas>", "issues_criadas": [<números>], "precisa_do_matheus": ["<o que só ele faz, com a issue>"], "bloqueios": ["<watchdog: comando>"], "decisoes": [<números das issues em que você decidiu algo pela recomendação>], "detalhe": {{}}}}`
Com `decisoes` não vazio, a Torre confere no seu stream que as cinco lentes (`{"`, `".join(LENTES_DE_DECISAO)}`) foram carregadas pela ferramenta Skill; sem elas, a execução conta como falha.
"""


def bloco_delegacoes() -> str:
    return """## Delegações do Matheus (20/11/2026; valem nesta execução, não se pergunta de novo)
- **Decidir pela recomendação, sempre pelas cinco lentes (obrigatório, Matheus em 21/11 e 27/11).** Antes da primeira decisão, carregue pela ferramenta Skill as cinco: `/human-architect-mindset`, `/domain-modeling`, `/ceo-advisor`, `/cto-advisor` e `/codebase-design`, e passe cada decisão por todas. No comentário da decisão na issue, a seção `## Lentes` traz uma linha por lente com o que ela pesou (sem a linha, a decisão não vale). Liste em `decisoes` do resultado cada issue em que decidiu. Na direção visual, somam-se `/ui-ux-pro-max`, `/bencium-impact-designer` e `/emil-design-eng`, dentro das decisões do mapa de protótipo (#11) e da ADR do painel (`docs/adr/0004-solid-no-painel.md`). Cada decisão vai à issue num comentário com `## Fontes` (regra 2), e você segue sem esperar humano.
- **Risco novo:** a coordenação aprova por delegação (exceção Q11); a linha em `docs/riscos.md` diz "aprovado pela coordenação, por delegação".
- **Merge na `main`:** você faz, pelo `scripts/agents/integrar-item.sh`, **sem prova no sandbox** e sem perguntar.
- **Subagentes:** cada issue de fila roda em subagente (implementador, revisor, conferente), sem sessão filha.
- **Nada se perde:** todo trabalho termina mergeado na `main` ou numa branch empurrada que a Torre leva à próxima fila de ajustes.
- **Ficam com o Matheus** (não faça; ponha em `precisa_do_matheus`): dinheiro, credenciais, contas externas (AWS, Meta) e o que é `ready-for-human`.
"""


def bloco_squash() -> str:
    return """## Conferência pelo squash (uma fonte só)
O merge na `main` é squash: a integração nunca vira ancestral da `main`, e `git branch --contains` mente.
- Issue já na integração: `git log --first-parent origin/main..origin/integracao/<nome>` (o merge da issue aparece ali).
- Integração na `main`: `gh pr view <n> --repo stacklabs3/monitora-ai --json state,baseRefName` dá `MERGED main`.
- Issue fechada: `gh issue view <n> --repo stacklabs3/monitora-ai --json state`.
- O GitHub fecha no máximo 10 issues por PR com `Closes`: confira e feche à mão as que sobrarem.
"""


def bloco_fonte_nao_aviso() -> str:
    return """## A fonte, não o aviso
O aviso de fim de subagente ou de sessão às vezes não chega. Depois de cada passo, confira pela fonte (branch, `git log`, `gh pr view`, `gh issue view`) e siga. Nunca fique parado esperando aviso com uma issue já aprovada.
"""


def bloco_buscar_antes(termos: str) -> str:
    hoje = agora().strftime("%Y-%m-%d")
    return f"""## Buscar antes de criar issue
Antes de **todo** `gh issue create`, rode `gh issue list --repo stacklabs3/monitora-ai --state all --search "<termo> created:>={hoje}"` com o termo principal do título ({termos}) e também sem a data. Se achar uma igual ou quase igual, **não crie**: relate no resultado e use a que existe.
"""


def bloco_trava() -> str:
    return """## Comandos pesados
Todo comando pesado (build, `next dev`, e2e, `pnpm install`, `preparar-worktree.sh`) passa pela `$HOME/.stacklabs/pesado.lock`, com o bloco da trava da skill `/orquestrar-issues` ou pelo `scripts/homologacao/agente/com-trava.sh <comando>`. O `scripts/ci-local.sh` roda na própria vaga, um por vez (`docs/agents/comandos-pesados.md`). A worktree nasce sem `node_modules`, sem o `backend/.env` e sem o gerado do passenger-app: antes do primeiro type-check ou teste, `sh .claude/skills/orquestrar-issues/preparar-worktree.sh <projetos>`; nunca ligue o `node_modules` do checkout principal por symlink.
"""


def bloco_leitura() -> str:
    return """## Leia primeiro
- `AGENTS.md` (regras duras e *Exceções*), `CLAUDE.md` da raiz e, antes de mexer num subprojeto, o `CLAUDE.md` dele pela ferramenta Read.
- `docs/agents/orquestracao.md` (o ciclo do lote), `docs/agents/comandos-pesados.md` e `docs/agents/watchdogs.md`.
- Antes de abrir código: `sh .claude/watchdogs/rodar contexto <nome>`, um nome por consulta (regra 23).
"""


def cabecalho(skills: List[str], titulo: str) -> str:
    lista = ", ".join(f"/{skill}" for skill in skills)
    return f"""Invoque as skills {lista} e execute a tarefa abaixo. O planejamento já foi feito e validado: não re-planejar, não reabrir decisões.

# {titulo}
Mensagem gerada em {agora().strftime('%Y-%m-%d %H:%M')} pela Torre autônoma, no repo `stacklabs3/monitora-ai`. A execução roda numa worktree própria, criada pela Torre em modo destacado a partir da `origin/main`; o checkout principal é `{RAIZ}` e você não escreve nele.
"""


def retomada(tentativa: int, continuacao: int, por_limite: bool = False) -> str:
    if tentativa <= 1 and continuacao == 0 and not por_limite:
        return ""
    return """
## Retomada
Esta é uma **retomada**: uma execução anterior desta mesma tarefa parou (sem saída por 45 min, terminou sem concluir, passou a rodada na smart zone ou a conta do Claude Code bateu no limite de uso). Antes de qualquer escrita, confira pela fonte o que já está feito: branches, `git log`, PRs, comentários e estado das issues, e o `.claude/orquestracao/*.json` da worktree se houver. Continue de onde parou; não refaça o que já está no git ou no GitHub. Decisão da execução anterior sem a seção `## Lentes` no comentário não vale: carregue as quatro lentes, refaça a decisão por elas e acrescente a seção.
"""


def kickoff_fila(fila: Dict[str, Any], par: Dict[str, Any], nome_execucao: str) -> str:
    outra = [outra_fila["nome"] for outra_fila in par["filas"] if outra_fila["nome"] != fila["nome"]]
    ordem = "\n".join(f"{posicao + 1}. #{numero}" for posicao, numero in enumerate(fila["issues"]))
    faixa = fila.get("faixa_rk") or "o próximo número livre de `docs/riscos.md` na `origin/main`"
    return cabecalho(["orquestrar-issues", "pr"], f"Par {par['numero']}: fila `{fila['nome']}` ({fila.get('lado', '')})") + f"""
## Pré-voo
- O lote desta fila partiu de uma `main` verde: a última PR `integracao/ajustes-*` está `MERGED main` com o relatório do `scripts/ci-local.sh` comentado. Os pares anteriores do mesmo lote entraram sem o CI local: falha que eles deixaram na `main` e que esta fila não causou fica para a fila de ajustes do fim do lote.
- As issues abaixo seguem abertas e `ready-for-agent`.
- `git ls-remote --heads origin integracao/{fila['nome']}`: vazio numa execução nova; numa retomada, é a sua.
Se uma premissa falhar, não escreva nada: grave o resultado `"premissa-falsa"` com o estado encontrado.

## Tarefa
Implementar, revisar e conferir pelo `/orquestrar-issues`, uma issue por vez, nesta ordem:
{ordem}

- Branch de integração: `integracao/{fila['nome']}`, criada por você a partir da `origin/main` atualizada.
- Faixa de riscos novos desta fila: {faixa}.
- A outra fila do par ({', '.join(outra) or 'nenhuma'}) roda ao mesmo tempo, na integração dela, sem arquivo em comum. Só os arquivos de mensagens (três idiomas e ARB) e o contrato gerado podem ser tocados pelas duas (Q34); a que entrar por último na `main` junta as chaves e gera o contrato de novo.
- Notas do planejamento: {fila.get('notas', '—')}

## Fim
1. PR `integracao/{fila['nome']}` → `main`, título em Conventional Commits, corpo pela `/pr`, `Closes` de cada issue.
2. Merge direto na `main` com `scripts/agents/integrar-item.sh <pr> --sem-ci` (AGENTS.md, *CI por lote*). Sem `scripts/ci-local.sh`: ele fica para a fila de ajustes do fim do lote.
3. Confira pela fonte: PR `MERGED main` e cada issue `CLOSED`.
4. Resultado: `"fila-mesclada"` com `"detalhe": {{"pr": <n>, "issues_fechadas": [...], "devolvidas": [...]}}`. Issue devolvida (dois ciclos de correção sem aprovar) volta para `needs-triage` com o motivo, e a fila segue.
""" + bloco_fonte_nao_aviso() + bloco_squash() + bloco_delegacoes() + bloco_trava() + bloco_leitura() + bloco_headless(nome_execucao)


def kickoff_ajustes(ajustes: Dict[str, Any], fora_da_dev: List[Dict[str, Any]], nome_execucao: str) -> str:
    filas = ajustes.get("filas_do_lote") or ajustes.get("filas_do_par") or []
    prs = ", ".join(f"`integracao/{nome}`" for nome in filas) or "nenhuma (fila de sobras)"
    if fora_da_dev:
        linhas_fora = "\n".join(
            f"   - `{item['branch']}`: só na branch {', '.join(item['so_na_branch'][:8]) or '—'}; diferente da dev {', '.join(item['diferentes_da_dev'][:8]) or '—'}"
            for item in fora_da_dev
        )
    else:
        linhas_fora = "   - nada, pela varredura da Torre; confira de novo."
    issues_da_fila = ajustes.get("issues") or []
    if issues_da_fila:
        lista_das_issues = "\n".join(f"   - #{numero_da_issue}" for numero_da_issue in issues_da_fila)
        bloco_das_issues = f"""
2b. **As issues desta fila** (o Matheus decidiu que rodam numa fila de ajustes, sozinhas):
{lista_das_issues}
   Leia o corpo de cada uma e confira item a item, pela `main` de hoje, o que ainda vale. Faça o que falta com um commit por item; o que não vale mais, anote na PR com o motivo. No merge (passo 6), feche cada uma com `--fechar <n>`, e liste-as em `"fechadas"` no resultado."""
        fechar = " " + " ".join(f"--fechar {numero_da_issue}" for numero_da_issue in issues_da_fila)
    else:
        bloco_das_issues, fechar = "", ""
    return cabecalho(["orquestrar-issues", "diagnose", "pr"], f"Fila de ajustes `{ajustes['nome']}`") + f"""
## Pré-voo
- As integrações do lote estão na `main` por squash: {prs}. Confira cada uma por `gh pr view` (`MERGED main`).
- `git ls-remote --heads origin 'integracao/{ajustes['nome']}'` vem vazio (numa retomada, é a sua).
- Nenhuma outra fila de código está aberta: a fila de ajustes roda sozinha.
Se uma premissa falhar, não escreva nada: grave `"premissa-falsa"` com o estado encontrado.

## Tarefa
Deixar a `main` verde no `scripts/ci-local.sh`, com o relatório comentado na PR da fila, depois de trazer para dentro dela o trabalho que ficou fora (`docs/agents/orquestracao.md`, *O ciclo do lote*, item 3; precedente: PR #2431 e o kickoff `.scratch/torre/kickoff-ajustes-2011.md` do checkout principal).

1. Branch `integracao/{ajustes['nome']}` a partir da `origin/main` atualizada.
2. **Trazer o que está fora da `main`** (varredura da Torre, M2):
{linhas_fora}
   Pesquisa (`docs/research/*.md`) entra sem mudar o texto, num commit `docs(research): …`. Para cada `chore/*` ou `issue/*`: o que já está na `main`, anote na PR e não traga; o que falta e ainda vale, traga com um commit por branch; o que não vale mais, anote o motivo na PR. Issue aberta com trabalho só em branch e sem fila: anote e devolva para `needs-triage`.{bloco_das_issues}
3. **Primeira rodada sem corrigir nada:** `scripts/ci-local.sh` com os logs guardados em `.scratch/{ajustes['nome']}/` da worktree. Liste cada erro com o job, o arquivo e a causa provável, inclusive os "não reproduzível".
4. **Correção por causa:** um commit por causa (`fix(<projeto>): …`); `/diagnose` para a falha que não se explica sozinha. Risco novo, a coordenação aprova por delegação.
5. **Última rodada** verde sobre o commit final. PR `integracao/{ajustes['nome']}` → `main`, título `fix: fila de ajustes {ajustes['nome']} — dev verde`, corpo pela `/pr`; relatório com `scripts/agents/integrar-item.sh <pr> --relatorio <arquivo>`.
6. **Merge** pelo `scripts/agents/integrar-item.sh <pr>{fechar}`, com o CI verde, sem perguntar sobre sandbox. Depois confira que o `Excurfly admin CI` e o `Shellcheck CI` da `main` saíram verdes no GitHub; se vermelhos, corrija numa rodada nova desta fila.
7. Resultado: `"fila-mesclada"` com `"detalhe": {{"pr": <n>, "trazidas": [...], "anotadas": [...]}}`.
""" + bloco_squash() + bloco_delegacoes() + bloco_trava() + bloco_leitura() + bloco_headless(nome_execucao)


def kickoff_planejar_par(numero_par: int, candidatas: List[Dict[str, Any]], semente: Optional[Dict[str, Any]], nome_execucao: str,
                         lote: Optional[Dict[str, Any]] = None) -> str:
    lista = "\n".join(f"- #{issue['numero']} — {issue['titulo']}" for issue in candidatas)
    if lote:
        sobre_o_lote = (f"Este par é do **lote {lote['numero']}** ({lote['issues']}; pares já na `main`: {lote['pares'] or 'nenhum'}). "
                        "As candidatas acima são as do lote que faltam: issue fora da lista fica para o lote seguinte, mesmo que já esteja "
                        "`ready-for-agent`. Entre os pares do lote não há fila de ajustes; o CI local roda uma vez, quando a última fila do lote "
                        "entra na `main` (AGENTS.md, *CI por lote*). Candidata que fica de fora deste par por bloqueio ou conflito volta no "
                        "próximo par do lote. Se nenhuma das candidatas cabe num par, grave o plano com `\"filas\": []` e todas em `fora`: "
                        "o lote acaba aqui.")
    else:
        sobre_o_lote = ""

    if semente and semente.get("numero") == numero_par and "servidor" in semente:
        sugestao = f"Ponto de partida já decidido pela Torre anterior: servidor {semente['servidor']}, fronts {semente['fronts']}, nessa ordem. Só estas issues entram neste par; as outras candidatas ficam para o par seguinte. Confirme que não há arquivo, contrato ou migração em comum entre os dois lados; se houver, mova a issue para o lado que já a toca ou para fora do par. Issue já fechada sai da lista."
    else:
        sugestao = "Divida as candidatas em duas filas pelas pastas que cada issue toca, sem arquivo em comum entre elas. Ordene cada lado do menor risco ao maior, com quem toca arquivo das outras por último."
    arquivo_par = PASTA_PARES / f"par-{numero_par}.json"
    return cabecalho(list(LENTES_DE_DECISAO), f"Planejar o par {numero_par}") + f"""
## Tarefa
Montar as duas filas do par {numero_par}, **sem implementar nada**. Candidatas (`ready-for-agent`, fora das exclusões):
{lista}

{sobre_o_lote}

{sugestao}

Para cada issue, leia o corpo e o contrato (se houver) e liste os arquivos que ela deve tocar (`sh .claude/watchdogs/rodar contexto #<n>` ajuda). Regra do par: as duas filas não têm arquivo, contrato ou migração em comum (AGENTS.md, *CI por lote*); mensagens e contrato gerado são a exceção Q34. Issue com bloqueio nativo aberto (`gh api repos/stacklabs3/monitora-ai/issues/<n>` → `issue_dependencies_summary.blocked_by`) só entra se o bloqueador estiver antes dela na mesma fila; senão fica de fora. Issue que pede decisão antes de código, ou que conflita com as duas filas, fica de fora com o motivo. Prefira fatias de um mesmo spec numa fila só, em ordem de dependência. Reserve uma faixa de dez riscos por fila, a partir do primeiro `RK<n>` livre em `git show origin/main:docs/riscos.md`.

Grave `{arquivo_par}` com:
`{{"numero": {numero_par}, "filas": [{{"nome": "fila-<letra>-servidor", "lado": "servidor", "issues": [<em ordem>], "faixa_rk": "RKa–RKb", "notas": "..."}}, {{"nome": "fila-<letra>-fronts", "lado": "fronts", "issues": [...], "faixa_rk": "...", "notas": "..."}}], "fora": [{{"issue": <n>, "motivo": "..."}}], "arquivos_em_comum": "nenhum | lista"}}`
Use nomes de fila novos (confira `git ls-remote --heads origin 'integracao/*'`). Um lado vazio pode sair da lista. Resultado: `"par-planejado"`.
""" + bloco_delegacoes() + bloco_leitura() + bloco_headless(nome_execucao)


def origem_da_frente(frente: Dict[str, Any]) -> str:
    """De onde a frente de spec nasceu: o mapa no destino ou a issue que a triagem devolveu pedindo o `/to-spec`."""
    return f"da issue #{frente['mapa']}" if frente.get("origem") == "issue" else f"do mapa #{frente['mapa']}"


def kickoff_spec(frente: Dict[str, Any], nome_execucao: str) -> str:
    branch_docs = f"chore/torre-{nome_execucao}"
    if frente["etapa"] == "to-spec":
        if frente.get("origem") == "issue":
            pedido = (f"A issue #{frente['mapa']} tem as decisões fechadas e a triagem pediu o `/to-spec` dela. Rode o `/to-spec`: "
                      "o spec pode ser a própria issue (troque `needs-info` por `spec`) ou uma issue nova com o rótulo `spec`.")
        else:
            pedido = f"O mapa #{frente['mapa']} chegou ao destino. Rode o `/to-spec` dele (Regra 0: mapa no destino vira spec)."
        corpo = f"""## Tarefa
{pedido}
- Nota da Torre: {frente.get('nota', '—')}
- Logo depois de publicar, troque `ready-for-agent` por `spec` na issue do spec (AGENTS.md, *A rota*).
- Verbete do `GLOSSARY.md` e emenda de ADR que o spec leva: escreva pelo `/domain-modeling` numa branch `{branch_docs}` a partir da `origin/main`, com commit `docs(...)` e `git push origin {branch_docs}`. Não abra PR: a Torre leva a branch à próxima fila de ajustes (M2).
- Não rode o `/to-tickets` aqui: a Torre abre outra execução para ele.
Resultado: `"spec-publicado"` com `"detalhe": {{"spec": <número da issue do spec>, "branch_docs": "{branch_docs} ou null"}}`."""
    else:
        corpo = f"""## Tarefa
Rode o `/to-tickets` do spec #{frente['spec']} ({origem_da_frente(frente)}): fatias verticais com bloqueios nativos, cada uma `ready-for-agent` só depois da definição de pronto (`docs/agents/caminho-ate-ready-for-agent.md`).
- Nota da Torre: {frente.get('nota', '—')}
- Fatia que depende de decisão em aberto (issue bloqueada por outra do Matheus) nasce com o bloqueio nativo e sem `ready-for-agent`.
Resultado: `"tickets-publicados"` com `"detalhe": {{"tickets": [<números>], "bloqueadas": [<números>]}}`."""
    skills = ["to-spec" if frente["etapa"] == "to-spec" else "to-tickets", *LENTES_DE_DECISAO]
    return cabecalho(skills, f"{frente['etapa']} {origem_da_frente(frente)}") + "\n" + corpo + "\n\n" + \
        bloco_buscar_antes("o nome da fatia ou do spec") + bloco_delegacoes() + bloco_leitura() + bloco_headless(nome_execucao)


def kickoff_triagem(issues: List[Dict[str, Any]], nome_execucao: str) -> str:
    lista = "\n".join(f"- #{issue['numero']} — {issue['titulo']}" for issue in issues)
    return cabecalho(["triage", *LENTES_DE_DECISAO], "Triagem das issues sem rótulo") + f"""
## Tarefa
Passe pelo `/triage` cada issue abaixo e deixe cada uma com um rótulo de triagem (`ready-for-agent`, `ready-for-human`, `needs-info`, `wontfix`) ou fechada como duplicata, com o motivo e as `## Fontes` num comentário:
{lista}

- `ready-for-agent` só depois da definição de pronto (`docs/agents/caminho-ate-ready-for-agent.md`).
- Ideia grande demais para uma fatia: não abra mapa aqui; anote no resultado em `"detalhe": {{"pedem_mapa": [...]}}`.
- Issue com as decisões fechadas que só pede o `/to-spec` → `/to-tickets` (o spec ainda não existe): não escreva o spec aqui; deixe-a com `needs-info` e ponha o número em `"detalhe": {{"pedem_spec": [<n>]}}`. A Torre abre o `/to-spec` dela numa execução própria.
- Duplicata de issue ou mapa existente: feche apontando a existente.
Resultado: `"triagem-feita"` com `"detalhe": {{"rotuladas": {{"<n>": "<rótulo>"}}, "pedem_spec": [<n>]}}`.
""" + bloco_buscar_antes("o assunto da issue") + bloco_delegacoes() + bloco_leitura() + bloco_headless(nome_execucao)


def kickoff_avaliar(issue: Dict[str, Any], nome_execucao: str) -> str:
    tipo = "mapa" if "wayfinder:map" in issue["rotulos"] else ("spec" if "spec" in issue["rotulos"] else "ticket de grilling")
    return cabecalho(["wayfinder", "grilling", *LENTES_DE_DECISAO],
                     f"Avaliar o {tipo} #{issue['numero']}") + f"""
## Tarefa
Avalie o {tipo} #{issue['numero']} — {issue['titulo']}. Uma execução resolve **no máximo um** ticket de decisão (AGENTS.md, regra 5; o watchdog barra o segundo).
- **Mapa:** leia *Decisions so far*, a névoa e os tickets abertos com os bloqueios (`issue_dependencies_summary`). Se houver ticket da fronteira sem bloqueio aberto e que não dependa do Matheus, reivindique (`gh issue edit <n> --add-assignee @me`, primeira escrita), resolva pela recomendação com as lentes da delegação, escreva o comentário com a resposta e as `## Fontes`, feche e ponha o ponteiro em *Decisions so far* (regra 7). Protótipo (`wayfinder:prototype`) não se resolve aqui. Mapa sem ticket aberto e com o destino claro: resultado `"destino"`. Mapa cujos tickets só andam com o Matheus (dinheiro, credenciais, AWS, Meta, advogado): `"bloqueado"`, com cada item em `precisa_do_matheus`. Mapa cujo trabalho já acabou: feche-o pelo método e dê `"fechado"`.
- **Spec:** confira se as fatias existem e se fecharam. Todas fechadas: feche o spec e dê `"fechado"`. Faltam fatias e o spec está fechado em decisão: dê `"destino"` (a Torre roda o `/to-tickets`). Fatias abertas andando nas filas: `"sem-acao"`.
- **Ticket de grilling avulso:** antes de tudo, confira `issue_dependencies_summary.blocked_by` (`gh api repos/stacklabs3/monitora-ai/issues/<n>`): com bloqueio aberto, não resolva e dê `"sem-acao"` (o mapa dele o pega na ordem). Sem bloqueio, resolva-o como ticket de decisão (mesmas três partes, ponteiro no mapa pai) ou, se depende do Matheus, `"bloqueado"`.
- **Ponteiro no mapa:** outra execução pode estar editando o mesmo mapa agora. Leia o corpo do mapa logo antes do `gh issue edit` e, depois, leia de novo e confira que o seu ponteiro está lá e que os ponteiros dos outros não sumiram; se algum sumiu, ponha-o de volta.
Resultado: um de `"ticket-resolvido"`, `"destino"`, `"bloqueado"`, `"fechado"`, `"sem-acao"`, com `"detalhe": {{"ticket": <n ou null>, "proximo": "<o que falta>"}}`.
""" + bloco_buscar_antes("o assunto do ticket") + bloco_squash() + bloco_delegacoes() + bloco_leitura() + bloco_headless(nome_execucao)


def kickoff_melhorias(tabela: str, ciclo: Dict[str, Any], nome_execucao: str) -> str:
    bloqueios = "\n".join(f"- `{bloqueio['watchdog']}` em `{bloqueio['execucao']}`: `{bloqueio['comando'][:200]}` → {bloqueio['motivo'][:200]}"
                          for bloqueio in ciclo["M8_bloqueios_de_watchdog"]) or "- nenhum"
    return cabecalho(["pr", "triage", "writing-for-agents"], f"Melhorias da retrospectiva de 20/11: fim do ciclo {ciclo['ciclo']}") + f"""
## Tarefa
O ciclo de teste terminou. A medida de cada melhoria (`.scratch/torre/melhorias-em-teste.json` do checkout principal):

{tabela}

Leia a tabela M1–M9 do `.scratch/torre/handoff-torre-autonoma.md` do checkout principal. Só entra o que **passou**:
1. PR `chore/melhorias-retro-2011` com M3, M5, M6, M7 e M9 (as que passaram), pela `/writing-for-agents` nos docs e pela `/pr` no corpo; `scripts/ci-local.sh` verde, relatório com `scripts/agents/integrar-item.sh <pr> --relatorio <arquivo>` e merge pelo `scripts/agents/integrar-item.sh <pr>`. Caminhos protegidos da regra 21 ficam de fora.
2. Issues de M1, M2 e M4 (as que passaram), pelo `/triage`.
3. Relatório de M8 ao Stack-Labs: issue em `stacklabs3/Stack-Labs` com os casos abaixo (o watchdog é protegido, regra 21):
{bloqueios}
Resultado: `"melhorias-abertas"` com `"detalhe": {{"pr": <n>, "issues": [...], "relatorio_stack_labs": "<url>"}}`.
""" + bloco_buscar_antes("o nome da melhoria") + bloco_delegacoes() + bloco_trava() + bloco_leitura() + bloco_headless(nome_execucao)


# ---------------------------------------------------------------- avançar o estado pela fonte


def liberar_planejador_parado(estado: Dict[str, Any], retrato: Dict[str, Any], configuracao: Dict[str, Any], numero: int,
                              plano: Optional[Dict[str, Any]]) -> None:
    """O planejador que caiu duas vezes (sem filas, por falta de backlog) volta quando chega candidata que ele não viu.

    Vistas são as candidatas registradas na abertura e as que o plano gravado já cita (filas e `fora`). Sem nenhuma das
    duas fontes, não há como saber o que é novo, e ele segue com o Matheus."""
    nome = f"planejar-par-{numero}"
    execucao = estado["execucoes"].get(nome)
    if not execucao or execucao["situacao"] != "precisa-do-matheus":
        return
    vistas = set(execucao.get("candidatas") or [])
    if plano:
        vistas |= {item["issue"] for item in plano.get("fora", []) if isinstance(item, dict) and isinstance(item.get("issue"), int)}
        vistas |= {issue for fila in plano.get("filas", []) if isinstance(fila, dict) for issue in fila.get("issues", [])}
    if not vistas:
        return
    novas = sorted(issue["numero"] for issue in candidatas_de_codigo(retrato, configuracao, estado) if issue["numero"] not in vistas)
    if not novas:
        return
    execucao["situacao"] = "concluida"
    execucao["liberada"] = {"quando": agora_iso(), "candidatas_novas": novas}
    for pedido in estado["para_o_matheus"]:
        if pedido.get("origem") == nome:
            pedido["feito"] = True
    anotar(estado, f"{nome} volta: candidatas novas {novas} desde que caiu")
    if estado["codigo"].get("lote"):
        # A candidata nova é de fora do lote: o lote acaba com o que o planejador não conseguiu planejar, e ela entra no seguinte.
        estado["codigo"]["proximo_par"] = {"numero": numero + 1}
        fechar_lote(estado, [issue["numero"] for issue in candidatas_do_lote(retrato, configuracao, estado)])


def avancar_estado(estado: Dict[str, Any], retrato: Dict[str, Any], configuracao: Dict[str, Any], melhorias: Dict[str, Any]) -> None:
    codigo = estado["codigo"]
    if codigo["fase"] == "ajustes" and codigo.get("ajustes"):
        nome = codigo["ajustes"]["nome"]
        if integracao_mesclada(retrato, nome, codigo["ajustes"].get("aberta_em")):
            anotar(estado, f"fila de ajustes {nome} está MERGED na dev (pela fonte)")
            for item in ([] if codigo["ajustes"].get("externa") else estado["fora_da_dev"]["itens"]):
                estado.setdefault("fora_da_dev_tratadas", {})[item["branch"]] = retrato["branches"].get(item["branch"])
            concluir_execucoes_do_alvo(estado, f"ajustes:{nome}")
            if nome.startswith(f"ajustes-par-{estado['ciclo'] + 1}"):
                fechar_ciclo(estado, melhorias)
            codigo["ajustes"] = None
            codigo["fase"] = "planejar-par"
    if codigo["fase"] == "planejar-par" and codigo.get("lote") and not candidatas_do_lote(retrato, configuracao, estado):
        fechar_lote(estado, [])
    if codigo["fase"] == "planejar-par":
        if not codigo.get("lote"):
            abrir_lote(estado, retrato, configuracao)
        lote = codigo.get("lote")
        numero = codigo["proximo_par"]["numero"]
        plano = recortar_ao_lote(ler_json(PASTA_PARES / f"par-{numero}.json", None), lote, estado)
        if plano_valido(plano) and (not lote or any(fila["issues"] for fila in plano["filas"])):
            codigo["par"] = {"numero": numero, "filas": [dict(fila, feita=False, aberta_em=agora_iso()) for fila in plano["filas"] if fila["issues"]]}
            codigo["fase"] = "par"
            concluir_execucoes_do_alvo(estado, f"planejar-par:{numero}")
            anotar(estado, f"par {numero} planejado: " + "; ".join(f"{fila['nome']} {fila['issues']}" for fila in codigo["par"]["filas"]))
        elif lote and plano_esgota_o_lote(plano):
            # O planejador deixou de fora tudo o que resta do lote: o lote acaba aqui.
            concluir_execucoes_do_alvo(estado, f"planejar-par:{numero}")
            codigo["proximo_par"] = {"numero": numero + 1}
            fechar_lote(estado, [item["issue"] for item in plano["fora"] if isinstance(item, dict) and isinstance(item.get("issue"), int)])
        else:
            liberar_planejador_parado(estado, retrato, configuracao, numero, plano)
    if codigo["fase"] == "par" and codigo.get("par"):
        for fila in codigo["par"]["filas"]:
            if not fila["feita"] and integracao_mesclada(retrato, fila["nome"], fila.get("aberta_em")):
                fila["feita"] = True
                concluir_execucoes_do_alvo(estado, f"fila:{fila['nome']}")
                anotar(estado, f"fila {fila['nome']} está MERGED na dev (pela fonte)")
        if all(fila["feita"] for fila in codigo["par"]["filas"]):
            numero = codigo["par"]["numero"]
            filas_do_par = [fila["nome"] for fila in codigo["par"]["filas"]]
            codigo["par"] = None
            codigo["proximo_par"] = {"numero": numero + 1}
            lote = codigo.get("lote")
            if lote:
                # Entre dois pares do mesmo lote não há fila de ajustes: o CI local roda no fim do lote.
                lote["pares"].append(numero)
                lote["filas"].extend(filas_do_par)
                codigo["fase"] = "planejar-par"
                restantes = [issue["numero"] for issue in candidatas_do_lote(retrato, configuracao, estado)]
                if restantes:
                    anotar(estado, f"par {numero} na dev; o lote {lote['numero']} segue com {restantes}, sem fila de ajustes")
                else:
                    fechar_lote(estado, [])
            else:
                # Par de antes do lote (estado de uma Torre anterior): a fila de ajustes do par, como era.
                codigo["ajustes"] = {"nome": f"ajustes-par-{numero}-{agora().strftime('%d%m')}", "externa": False, "aberta_em": agora_iso(),
                                     "filas_do_par": filas_do_par}
                codigo["fase"] = "ajustes"
                anotar(estado, f"par {numero} na dev; abre a fila de ajustes ajustes-par-{numero}")


def recortar_ao_lote(plano: Any, lote: Optional[Dict[str, Any]], estado: Dict[str, Any]) -> Any:
    """Tira das filas do plano a issue que não é do lote: ela fica para o lote seguinte."""
    if not lote or not plano_valido(plano):
        return plano
    do_lote = set(lote["issues"])
    recortado = dict(plano, filas=[dict(fila, issues=[numero for numero in fila["issues"] if numero in do_lote]) for fila in plano["filas"]])
    tiradas = sorted({numero for fila in plano["filas"] for numero in fila["issues"]} - do_lote)
    if tiradas and not lote.get("avisou_recorte"):
        lote["avisou_recorte"] = True
        anotar(estado, f"o plano do par {plano.get('numero')} trouxe {tiradas}, fora do lote {lote['numero']}: ficam para o lote seguinte")
    return recortado


def plano_esgota_o_lote(plano: Any) -> bool:
    """Plano sem issue nas filas e com o `fora` preenchido: o planejador deixou de fora tudo o que restava do lote."""
    if not isinstance(plano, dict) or not isinstance(plano.get("filas"), list) or not isinstance(plano.get("fora"), list):
        return False
    filas_vazias = all(isinstance(fila, dict) and not fila.get("issues") for fila in plano["filas"])
    return filas_vazias and bool(plano["fora"])


def plano_valido(plano: Any) -> bool:
    if not isinstance(plano, dict) or not isinstance(plano.get("filas"), list) or not plano["filas"]:
        return False
    vistas = set()
    for fila in plano["filas"]:
        if not isinstance(fila, dict) or not fila.get("nome") or not isinstance(fila.get("issues"), list):
            return False
        if vistas & set(fila["issues"]):
            return False
        vistas.update(fila["issues"])
    return True


def fechar_ciclo(estado: Dict[str, Any], melhorias: Dict[str, Any]) -> None:
    ciclo = ciclo_das_melhorias(melhorias, estado)
    ciclo["fim"] = agora_iso()
    if ciclo["M2_varreduras"]:
        ciclo["M2_final"] = ciclo["M2_varreduras"][-1]["itens"]
    tabela = tabela_das_melhorias(ciclo)
    (PASTA_TORRE / f"melhorias-ciclo-{ciclo['ciclo']}.md").write_text(f"# Melhorias em teste — ciclo {ciclo['ciclo']}\n\n{tabela}\n", encoding="utf-8")
    anotar(estado, f"fim do ciclo {ciclo['ciclo']} das melhorias; tabela em .scratch/torre/melhorias-ciclo-{ciclo['ciclo']}.md")
    if ciclo["ciclo"] == 1:
        estado["melhorias_pendentes"] = True
    estado["ciclo"] += 1
    melhorias["ciclos"][str(estado["ciclo"])] = melhorias_vazias(estado["ciclo"])


def concluir_execucoes_do_alvo(estado: Dict[str, Any], alvo: str) -> None:
    for execucao in estado["execucoes"].values():
        if execucao["alvo"] == alvo and execucao["situacao"] != "concluida":
            execucao["situacao"] = "concluida"
            execucao["fim"] = agora_iso()


# ---------------------------------------------------------------- planejar o que abrir


def planejar(estado: Dict[str, Any], retrato: Dict[str, Any], configuracao: Dict[str, Any], melhorias: Dict[str, Any]) -> List[Dict[str, Any]]:
    acoes: List[Dict[str, Any]] = []
    codigo = estado["codigo"]
    rodando_codigo = execucoes_rodando(estado, TIPOS_DE_CODIGO)
    rodando_lateral = execucoes_rodando(estado, TIPOS_LATERAIS)
    alvos_ocupados = {execucao["alvo"] for execucao in estado["execucoes"].values()
                      if execucao["situacao"] in {"rodando", "precisa-do-matheus", "aguardando-conta"}}

    if codigo["fase"] == "ajustes" and codigo.get("ajustes"):
        ajustes = codigo["ajustes"]
        alvo = f"ajustes:{ajustes['nome']}"
        if ajustes.get("externa"):
            acoes.append({"tipo": "acompanhar", "alvo": alvo, "motivo": ajustes.get("nota", "fila externa")})
        elif alvo not in alvos_ocupados and not rodando_codigo:
            acoes.append({"tipo": "ajustes", "alvo": alvo, "nome": f"ajustes-{ajustes['nome'].replace('ajustes-', '')}",
                          "motivo": "o par está na dev; a fila de ajustes roda sozinha",
                          "kickoff": lambda nome, ajustes=ajustes: kickoff_ajustes(ajustes, estado["fora_da_dev"]["itens"], nome)})
    elif codigo["fase"] == "planejar-par":
        numero = codigo["proximo_par"]["numero"]
        alvo = f"planejar-par:{numero}"
        candidatas = candidatas_do_lote(retrato, configuracao, estado)
        if not candidatas:
            pesquisa_fora = [item for item in estado["fora_da_dev"]["itens"] if item["so_na_branch"]]
            de_ajustes = issues_de_ajustes_abertas(retrato, configuracao)
            if de_ajustes and not rodando_codigo:
                numeros = [issue["numero"] for issue in de_ajustes]
                codigo["ajustes"] = {"nome": f"ajustes-issues-{numero}-{agora().strftime('%d%m')}", "externa": False, "aberta_em": agora_iso(),
                                     "filas_do_par": [], "issues": numeros}
                codigo["fase"] = "ajustes"
                acoes.append({"tipo": "nota", "motivo": f"sem candidata para o par; as issues de ajustes {numeros} viram a fila ajustes-issues-{numero}"})
            elif pesquisa_fora and not rodando_lateral and not rodando_codigo and alvo not in alvos_ocupados:
                codigo["ajustes"] = {"nome": f"ajustes-sobras-{numero}-{agora().strftime('%d%m')}", "externa": False, "aberta_em": agora_iso(), "filas_do_par": []}
                codigo["fase"] = "ajustes"
                acoes.append({"tipo": "nota", "motivo": f"sem ready-for-agent; {len(pesquisa_fora)} branches fora da dev viram a fila ajustes-sobras-{numero}"})
            elif candidatas_de_codigo(retrato, configuracao, estado):
                deixadas = (codigo.get("ultimo_lote") or {}).get("fora")
                acoes.append({"tipo": "nota", "motivo": f"as candidatas {deixadas} ficaram de fora do último lote; o próximo abre com candidata nova"})
            else:
                acoes.append({"tipo": "nota", "motivo": "sem issue ready-for-agent para o próximo par"})
        elif alvo not in alvos_ocupados and not rodando_codigo:
            semente = codigo.get("proximo_par")
            lote = codigo["lote"]
            acoes.append({"tipo": "planejar-par", "alvo": alvo, "nome": f"planejar-par-{numero}",
                          "motivo": f"lote {lote['numero']}: {len(candidatas)} de {len(lote['issues'])} issues ainda por planejar",
                          "candidatas": [issue["numero"] for issue in candidatas],
                          "kickoff": lambda nome, numero=numero, candidatas=candidatas, semente=semente, lote=lote: kickoff_planejar_par(numero, candidatas, semente, nome, lote)})
    elif codigo["fase"] == "par" and codigo.get("par"):
        vagas = configuracao["max_filas_codigo"] - len(rodando_codigo)
        for fila in codigo["par"]["filas"]:
            alvo = f"fila:{fila['nome']}"
            if fila["feita"] or alvo in alvos_ocupados or vagas <= 0:
                continue
            vagas -= 1
            acoes.append({"tipo": "fila", "alvo": alvo, "nome": fila["nome"],
                          "motivo": f"par {codigo['par']['numero']}, issues {fila['issues']}",
                          "kickoff": lambda nome, fila=fila: kickoff_fila(fila, codigo["par"], nome)})

    laterais_comuns = [execucao for execucao in rodando_lateral if not execucao.get("extra")]
    grillings_extras = [execucao for execucao in rodando_lateral if execucao.get("extra")]
    if len(laterais_comuns) < configuracao["max_laterais"]:
        lateral = proxima_lateral(estado, retrato, configuracao, melhorias, alvos_ocupados, pular_mapas=bool(grillings_extras))
        if lateral:
            acoes.append(lateral)
            alvos_ocupados = alvos_ocupados | {lateral["alvo"]}
    acoes.extend(grillings_extras_a_abrir(estado, retrato, configuracao, alvos_ocupados, len(grillings_extras),
                                          rodando_lateral + [acao for acao in acoes if acao["tipo"] in TIPOS_LATERAIS]))
    return acoes


def grillings_extras_a_abrir(estado: Dict[str, Any], retrato: Dict[str, Any], configuracao: Dict[str, Any], alvos_ocupados: set,
                             extras_rodando: int, laterais_em_curso: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Tickets de grilling a mais, em paralelo à lateral comum, sempre na conta da configuração (Matheus, 24/11/2026).

    Só `wayfinder:grilling` sem o rótulo do Chrome local. Não abre enquanto a avaliação de um mapa roda: ela pode
    resolver o mesmo ticket da fronteira, e a reivindicação pelo assignee não separa execuções da mesma pessoa."""
    vagas = configuracao.get("grillings_extras", 0) - extras_rodando
    if vagas <= 0 or any(lateral.get("avalia_mapa") for lateral in laterais_em_curso):
        return []
    rotulo_do_chrome = configuracao.get("rotulo_chrome_local")
    extras = []
    for issue in candidatas_de_avaliacao(retrato, configuracao, estado):
        if vagas <= 0:
            break
        alvo = f"avaliar:{issue['numero']}"
        if alvo in alvos_ocupados or "wayfinder:grilling" not in issue["rotulos"] or rotulo_do_chrome in issue["rotulos"]:
            continue
        vagas -= 1
        extras.append({"tipo": "avaliar", "alvo": alvo, "nome": f"avaliar-{issue['numero']}", "extra": True,
                       "motivo": f"grilling extra: {issue['titulo'][:70]} (última avaliação: {issue['ultima'] or 'nunca'})",
                       "kickoff": lambda nome, issue=issue: kickoff_avaliar(issue, nome)})
    return extras


def proxima_lateral(estado: Dict[str, Any], retrato: Dict[str, Any], configuracao: Dict[str, Any], melhorias: Dict[str, Any], alvos_ocupados: set,
                    pular_mapas: bool = False) -> Optional[Dict[str, Any]]:
    if estado["melhorias_pendentes"] and "melhorias:1" not in alvos_ocupados:
        ciclo = melhorias["ciclos"].get("1")
        if ciclo:
            tabela = tabela_das_melhorias(ciclo)
            return {"tipo": "melhorias", "alvo": "melhorias:1", "nome": "melhorias-ciclo-1", "motivo": "fim do ciclo 1",
                    "kickoff": lambda nome: kickoff_melhorias(tabela, ciclo, nome)}
    for frente in estado["specs"]:
        if frente["etapa"] == "feito":
            continue
        alvo = f"spec:{frente['mapa']}:{frente['etapa']}"
        if alvo in alvos_ocupados:
            continue
        return {"tipo": "spec", "alvo": alvo, "nome": f"{frente['etapa']}-{frente['mapa']}",
                "motivo": f"issue #{frente['mapa']} pede /to-spec" if frente.get("origem") == "issue" else f"mapa #{frente['mapa']} no destino",
                "kickoff": lambda nome, frente=frente: kickoff_spec(frente, nome)}
    triagem = candidatas_de_triagem(retrato, configuracao)
    if triagem and "triagem" not in alvos_ocupados:
        return {"tipo": "triagem", "alvo": "triagem", "nome": "triagem-" + "-".join(str(issue["numero"]) for issue in triagem[:4]),
                "motivo": f"{len(triagem)} sem rótulo: {[issue['numero'] for issue in triagem]}",
                "kickoff": lambda nome, triagem=triagem: kickoff_triagem(triagem, nome)}
    for issue in candidatas_de_avaliacao(retrato, configuracao, estado):
        alvo = f"avaliar:{issue['numero']}"
        avalia_mapa = "wayfinder:map" in issue["rotulos"]
        if alvo in alvos_ocupados or (pular_mapas and avalia_mapa):
            continue
        return {"tipo": "avaliar", "alvo": alvo, "nome": f"avaliar-{issue['numero']}", "avalia_mapa": avalia_mapa,
                "motivo": f"{issue['titulo'][:70]} (última avaliação: {issue['ultima'] or 'nunca'})",
                "kickoff": lambda nome, issue=issue: kickoff_avaliar(issue, nome)}
    return None


# ---------------------------------------------------------------- execuções headless


def preparar_worktree(nome_execucao: str, melhorias_ciclo: Dict[str, Any]) -> Path:
    caminho = PASTA_WORKTREES / f"torre-{nome_execucao}"
    if not caminho.exists():
        rodar(["git", "worktree", "add", "--detach", str(caminho), "origin/main"])
    if ARQUIVO_ACESSOS.exists():
        destino = caminho / ".claude" / "settings.local.json"
        destino.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ARQUIVO_ACESSOS, destino)
        melhorias_ciclo["M3_copias_de_acessos"] += 1
    return caminho


def bloco_chrome(acao: Dict[str, Any]) -> str:
    """O Chrome local: sem `--chrome` o `claude -p` não tem as ferramentas, e com dois Chromes ligados ele não escolhe
    sozinho (passada de 24/11/2026). O navegador vem da configuração (`chrome_device_id`)."""
    if not acao.get("chrome"):
        return ""
    navegador = acao["chrome"].get("device_id")
    escolha = (f"chame `mcp__claude-in-chrome__select_browser` com o deviceId `{navegador}` "
               f"({acao['chrome'].get('nome') or 'o Chrome deste Mac'}) antes de qualquer ação no navegador"
               if navegador else "escolha o Chrome deste Mac pelo `list_connected_browsers`")
    return f"\n\n## Chrome local\nEsta execução sobe com `--chrome`. Carregue as ferramentas `mcp__claude-in-chrome__*` numa só chamada ao ToolSearch e {escolha}.\n"


def lancar(acao: Dict[str, Any], estado: Dict[str, Any], melhorias_ciclo: Dict[str, Any], conta: str,
           tentativa: int = 1, continuacao: int = 0, por_limite: bool = False) -> Dict[str, Any]:
    nome = acao["nome"]
    carimbo = agora().strftime("%Y%m%d-%H%M")
    cwd = preparar_worktree(nome, melhorias_ciclo)
    resultado = PASTA_RESULTADOS / f"{nome}.json"
    if resultado.exists():
        resultado.rename(resultado.with_name(f"{nome}.{carimbo}.anterior.json"))
    kickoff = acao["kickoff"](nome) + retomada(tentativa, continuacao, por_limite) + bloco_chrome(acao)
    PASTA_EXECUCOES.mkdir(parents=True, exist_ok=True)
    base = PASTA_EXECUCOES / f"{carimbo}-{nome}-t{tentativa}c{continuacao}"
    base.with_suffix(".kickoff.md").write_text(kickoff, encoding="utf-8")
    log = base.with_suffix(".jsonl")
    with open(log, "w", encoding="utf-8") as saida:
        processo = subprocess.Popen(
            ["claude", "-p", kickoff, *(["--chrome"] if acao.get("chrome") else []),
             "--permission-mode", "bypassPermissions", "--output-format", "stream-json", "--verbose"],
            cwd=str(cwd), stdout=saida, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, start_new_session=True,
            env=ambiente_da_conta(conta),
        )
    processos_vivos[nome] = processo
    execucao = {
        "nome": nome, "tipo": acao["tipo"], "alvo": acao["alvo"], "cwd": str(cwd), "log": str(log),
        "kickoff": str(base.with_suffix(".kickoff.md")), "resultado_arquivo": str(resultado), "pid": processo.pid,
        "inicio": agora_iso(), "ultima_saida": agora_iso(), "fim": None, "tentativa": tentativa, "continuacao": continuacao,
        "situacao": "rodando", "lido_ate": 0, "ferramentas_pendentes": {}, "session_id": None, "resultado": None,
        "parada_aberta": False, "motivo": acao.get("motivo", ""), "conta": conta, "limite": None,
        "lentes": list(LENTES_DE_DECISAO),
        **avancar_contador(estado),
        **({"candidatas": acao["candidatas"]} if "candidatas" in acao else {}),
        **{chave: acao[chave] for chave in ("extra", "avalia_mapa") if acao.get(chave)},
    }
    if nome in estado["execucoes"]:
        estado["historico"].append(estado["execucoes"][nome])
        del estado["historico"][:-300]
    estado["execucoes"][nome] = execucao
    if acao["tipo"] in {"triagem", "avaliar", "spec"}:
        melhorias_ciclo["M4_execucoes_com_busca"] += 1
    if acao["tipo"] == "avaliar":
        melhorias_ciclo["M7_execucoes_de_wayfinder"] += 1
    anotar(estado, f"abriu {nome} ({acao['tipo']}, tentativa {tentativa}, continuação {continuacao}, conta {conta}, "
                   f"execução nº {execucao['contador']}"
                   + (", retomada por limite" if por_limite else "") + f") em {cwd}")
    return execucao


def processo_vivo(execucao: Dict[str, Any]) -> bool:
    processo = processos_vivos.get(execucao["nome"])
    if processo is not None and processo.pid == execucao["pid"]:
        return processo.poll() is None
    try:
        os.kill(execucao["pid"], 0)
    except (ProcessLookupError, PermissionError):
        return False
    comando = rodar(["ps", "-p", str(execucao["pid"]), "-o", "command="], tolerante=True)
    return "claude" in comando


def encerrar(execucao: Dict[str, Any]) -> None:
    try:
        os.killpg(execucao["pid"], signal.SIGTERM)
        time.sleep(10)
        os.killpg(execucao["pid"], signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        pass


def texto_do_resultado(conteudo: Any) -> str:
    if isinstance(conteudo, str):
        return conteudo
    if isinstance(conteudo, list):
        return "\n".join(parte.get("text", "") for parte in conteudo if isinstance(parte, dict))
    return ""


def ler_log(execucao: Dict[str, Any], estado: Dict[str, Any], melhorias_ciclo: Dict[str, Any]) -> None:
    """Lê o stream-json novo da execução: bloqueios de watchdog (M8, M7), permissões (M3, M6), squash (M5)."""
    caminho = Path(execucao["log"])
    if not caminho.exists():
        return
    tamanho = caminho.stat().st_size
    if tamanho > execucao["lido_ate"]:
        execucao["ultima_saida"] = datetime.datetime.fromtimestamp(caminho.stat().st_mtime).astimezone().isoformat(timespec="seconds")
    with open(caminho, "rb") as arquivo:
        arquivo.seek(execucao["lido_ate"])
        bruto = arquivo.read()
    ultimo_fim_de_linha = bruto.rfind(b"\n")
    if ultimo_fim_de_linha < 0:
        return
    execucao["lido_ate"] += ultimo_fim_de_linha + 1
    pendentes = execucao["ferramentas_pendentes"]
    for linha in bruto[: ultimo_fim_de_linha + 1].decode("utf-8", errors="replace").splitlines():
        try:
            evento = json.loads(linha)
        except json.JSONDecodeError:
            continue
        if evento.get("type") == "system" and evento.get("subtype") == "init":
            execucao["session_id"] = evento.get("session_id")
        if not isinstance(evento, dict):
            continue
        mensagem = evento.get("message") if isinstance(evento.get("message"), dict) else {}
        partes = [parte for parte in (mensagem.get("content") or []) if isinstance(parte, dict)] if isinstance(mensagem.get("content"), list) else []
        limite = texto_de_limite(evento, partes)
        if limite:
            execucao["limite"] = limite[:500]
        if evento.get("type") == "assistant":
            for parte in partes:
                if parte.get("type") == "tool_use":
                    pendentes[parte["id"]] = {"nome": parte.get("name"), "entrada": parte.get("input")}
                elif parte.get("type") == "text" and PADRAO_SQUASH_PERDIDO.search(parte.get("text", "")):
                    melhorias_ciclo["M5_squash_nao_achado"].append({"execucao": execucao["nome"], "quando": agora_iso(),
                                                                    "texto": PADRAO_SQUASH_PERDIDO.search(parte["text"]).group(0)})
        elif evento.get("type") == "user":
            for parte in partes:
                if parte.get("type") != "tool_result":
                    continue
                texto = texto_do_resultado(parte.get("content"))
                chamada = pendentes.pop(parte.get("tool_use_id"), {}) or {}
                entrada = chamada.get("entrada") or {}
                # A lente conta só quando a ferramenta Skill a carregou: "Unknown skill" volta com is_error.
                skill_carregada = skill_do_uso({"name": chamada.get("nome"), "input": entrada})
                if skill_carregada and not parte.get("is_error") and skill_carregada not in execucao.setdefault("skills_carregadas", []):
                    execucao["skills_carregadas"].append(skill_carregada)
                comando = entrada.get("command") if isinstance(entrada, dict) and entrada.get("command") else json.dumps(entrada, ensure_ascii=False)[:500]
                achado = PADRAO_BLOQUEIO.search(texto)
                if achado:
                    bloqueio = {"execucao": execucao["nome"], "quando": agora_iso(), "watchdog": achado.group(1),
                                "ferramenta": chamada.get("nome"), "comando": comando[:1000], "motivo": texto[:600]}
                    estado["bloqueios"].append(bloqueio)
                    del estado["bloqueios"][:-300]
                    melhorias_ciclo["M8_bloqueios_de_watchdog"].append(bloqueio)
                    if PADRAO_JA_RESOLVEU.search(texto):
                        melhorias_ciclo["M7_bloqueios_ja_resolveu"].append(bloqueio)
                elif parte.get("is_error") and PADRAO_PERMISSAO.search(texto):
                    negacao = {"execucao": execucao["nome"], "quando": agora_iso(), "ferramenta": chamada.get("nome"),
                               "comando": comando[:500], "texto": texto[:300]}
                    melhorias_ciclo["M3_paradas_por_permissao"].append(negacao)
                    melhorias_ciclo["M6_acoes_barradas"].append(negacao)
        elif evento.get("type") == "result":
            execucao["fim_do_stream"] = {"subtype": evento.get("subtype"), "is_error": evento.get("is_error"),
                                         "texto": str(evento.get("result", ""))[:1500]}
    if len(pendentes) > 60:
        for chave in list(pendentes)[:-60]:
            del pendentes[chave]


def conferir_duplicatas(execucao: Dict[str, Any], configuracao: Dict[str, Any], melhorias_ciclo: Dict[str, Any]) -> None:
    """M4: issue criada durante a execução com título quase igual a outra = duplicata suspeita."""
    inicio = ler_iso(execucao["inicio"])
    if inicio is None:
        return
    criadas = gh_json(["issue", "list", "--repo", configuracao["repo"], "--state", "all", "--limit", "200",
                       "--search", f"created:>={inicio.strftime('%Y-%m-%d')}", "--json", "number,title,createdAt"]) or []
    novas = [issue for issue in criadas if ler_iso(issue["createdAt"]) and ler_iso(issue["createdAt"]) >= inicio]
    if not novas:
        return
    todas = gh_json(["issue", "list", "--repo", configuracao["repo"], "--state", "all", "--limit", "1500", "--json", "number,title"]) or []
    for nova in novas:
        numeros_novos = {issue["number"] for issue in novas}
        for outra in todas:
            if outra["number"] in numeros_novos:
                continue
            semelhanca = difflib.SequenceMatcher(None, nova["title"].lower(), outra["title"].lower()).ratio()
            if semelhanca >= 0.85:
                melhorias_ciclo["M4_duplicatas"].append({"execucao": execucao["nome"], "nova": nova["number"],
                                                         "parecida": outra["number"], "semelhanca": round(semelhanca, 2)})
                break


def acompanhar_execucoes(estado: Dict[str, Any], retrato: Dict[str, Any], configuracao: Dict[str, Any], melhorias_ciclo: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Devolve as execuções a reabrir (retomada ou continuação)."""
    reabrir = []
    for execucao in list(estado["execucoes"].values()):
        if execucao["situacao"] != "rodando":
            continue
        ler_log(execucao, estado, melhorias_ciclo)
        ocioso = minutos_desde(execucao["ultima_saida"])
        if execucao["tipo"] == "fila" and processo_vivo(execucao):
            if ocioso >= configuracao["minutos_fila_parada"] and not execucao["parada_aberta"]:
                execucao["parada_aberta"] = True
                melhorias_ciclo["M1_filas_paradas"].append({"execucao": execucao["nome"], "quando": agora_iso(), "minutos": round(ocioso)})
            elif ocioso < configuracao["minutos_fila_parada"]:
                execucao["parada_aberta"] = False
        if processo_vivo(execucao) and execucao.get("limite"):
            anotar(estado, f"{execucao['nome']} parou no limite da conta {execucao.get('conta', '1')}: encerrada")
            encerrar(execucao)
        if processo_vivo(execucao):
            if ocioso >= configuracao["minutos_sem_saida"]:
                anotar(estado, f"{execucao['nome']} sem saída há {round(ocioso)} min: encerrada")
                encerrar(execucao)
                reabrir.append(falhar(execucao, estado, "sem saída por 45 min"))
            continue
        execucao["fim"] = agora_iso()
        resultado = ler_json(Path(execucao["resultado_arquivo"]), None)
        execucao["resultado"] = resultado
        if execucao.get("limite") and not resultado:
            # Limite de uso não é falha: a mesma tentativa reabre como retomada na outra conta.
            marcar_limite(estado, execucao.get("conta", "1"), execucao["limite"])
            execucao["situacao"] = "aguardando-conta"
            reabrir.append({"execucao": execucao, "tentativa": execucao["tentativa"],
                            "continuacao": execucao["continuacao"], "por_limite": True})
            continue
        if resultado:
            for pedido in resultado.get("precisa_do_matheus") or []:
                pedir_ao_matheus(estado, str(pedido), execucao["nome"])
        if execucao["tipo"] in {"triagem", "avaliar", "spec"}:
            try:
                conferir_duplicatas(execucao, configuracao, melhorias_ciclo)
            except FalhaDaFonte as erro:
                anotar(estado, f"M4 não conferiu {execucao['nome']}: {erro}")
        if resultado and resultado.get("resultado") == "smart-zone":
            if execucao["continuacao"] < configuracao["max_continuacoes"]:
                execucao["situacao"] = "continuada"
                reabrir.append({"execucao": execucao, "tentativa": execucao["tentativa"], "continuacao": execucao["continuacao"] + 1})
            else:
                reabrir.append(falhar(execucao, estado, "smart zone demais"))
            continue
        faltam = lentes_que_faltam(execucao, resultado)
        if faltam:
            anotar(estado, f"{execucao['nome']} decidiu {resultado.get('decisoes')} sem as lentes {faltam}")
            reabrir.append(falhar(execucao, estado, f"decidiu sem as lentes {', '.join(faltam)}"))
            continue
        if aplicar_resultado(execucao, resultado, estado, retrato):
            execucao["situacao"] = "concluida"
            anotar(estado, f"{execucao['nome']} concluída: {(resultado or {}).get('resultado')}")
        else:
            reabrir.append(falhar(execucao, estado, f"terminou sem concluir ({(resultado or {}).get('resultado', 'sem resultado')})"))
    return [item for item in reabrir if item]


def falhar(execucao: Dict[str, Any], estado: Dict[str, Any], motivo: str) -> Optional[Dict[str, Any]]:
    execucao["fim"] = agora_iso()
    execucao["falha"] = motivo
    if execucao["tentativa"] < 2:
        execucao["situacao"] = "falhou"
        return {"execucao": execucao, "tentativa": execucao["tentativa"] + 1, "continuacao": execucao["continuacao"]}
    execucao["situacao"] = "precisa-do-matheus"
    pedir_ao_matheus(estado, f"A execução {execucao['nome']} falhou duas vezes ({motivo}). Log: {execucao['log']}", execucao["nome"])
    anotar(estado, f"{execucao['nome']} falhou pela segunda vez: {motivo}")
    return None


def issues_que_pedem_spec(detalhe: Dict[str, Any]) -> List[int]:
    """As issues que a triagem devolveu pedindo o `/to-spec`: a lista `pedem_spec` e o `#<n> … /to-spec` escrito no `pedem_mapa`."""
    numeros = set()
    for valor_pedido in detalhe.get("pedem_spec") or []:
        texto_do_numero = str(valor_pedido).strip().lstrip("#")
        if texto_do_numero.isdigit():
            numeros.add(int(texto_do_numero))
    for texto_do_pedido in detalhe.get("pedem_mapa") or []:
        for achado in PADRAO_PEDE_SPEC.finditer(str(texto_do_pedido)):
            numeros.add(int(achado.group(1)))
    return sorted(numeros)


def abrir_frente_de_spec_da_issue(estado: Dict[str, Any], retrato: Dict[str, Any], numero: int, resumo: str) -> None:
    """A issue avulsa com as decisões fechadas entra nas frentes de spec, como o mapa no destino (só se está aberta no retrato)."""
    if any(str(frente["mapa"]) == str(numero) for frente in estado["specs"]):
        return
    issue = retrato["issues_abertas"].get(str(numero))
    if issue is None:
        anotar(estado, f"a triagem pediu o /to-spec da #{numero}, que não está aberta: nenhuma frente nova")
        return
    frente: Dict[str, Any] = {"mapa": numero, "etapa": "to-spec", "origem": "issue", "nota": resumo[:400]}
    if "spec" in issue["rotulos"]:
        frente.update(etapa="to-tickets", spec=numero)
    estado["specs"].append(frente)
    anotar(estado, f"a triagem pediu o /to-spec da #{numero}: frente {frente['etapa']}-{numero} aberta")


def aplicar_resultado(execucao: Dict[str, Any], resultado: Optional[Dict[str, Any]], estado: Dict[str, Any], retrato: Dict[str, Any]) -> bool:
    """Confere pela fonte o que a execução diz ter feito. Verdadeiro só quando a fonte confirma."""
    tipo = execucao["tipo"]
    valor = (resultado or {}).get("resultado")
    detalhe = (resultado or {}).get("detalhe") or {}
    if tipo in {"fila", "ajustes"}:
        nome_fila = execucao["alvo"].split(":", 1)[1]
        pr = pr_da_branch_seguro(f"integracao/{nome_fila}")
        return bool(pr and pr["state"] == "MERGED")
    if tipo == "planejar-par":
        numero = execucao["alvo"].split(":", 1)[1]
        plano = ler_json(PASTA_PARES / f"par-{numero}.json", None)
        return plano_valido(plano) or plano_esgota_o_lote(plano)
    if tipo == "spec":
        _, mapa, etapa = execucao["alvo"].split(":")
        frente = next((frente for frente in estado["specs"] if str(frente["mapa"]) == mapa and frente["etapa"] == etapa), None)
        if frente is None:
            return False
        if etapa == "to-spec" and valor == "spec-publicado" and detalhe.get("spec"):
            rotulos = issue_rotulos_seguro(int(detalhe["spec"]))
            if rotulos is not None and "spec" in rotulos:
                frente["spec"] = int(detalhe["spec"])
                frente["etapa"] = "to-tickets"
                return True
            return False
        if etapa == "to-tickets" and valor == "tickets-publicados" and detalhe.get("tickets"):
            frente["etapa"] = "feito"
            frente["tickets"] = detalhe["tickets"]
            return True
        return False
    if tipo == "triagem":
        if valor != "triagem-feita":
            return False
        for numero in issues_que_pedem_spec(detalhe):
            abrir_frente_de_spec_da_issue(estado, retrato, numero, (resultado or {}).get("resumo", ""))
        return True
    if tipo == "avaliar":
        if valor not in RESULTADOS_DE_AVALIACAO:
            return False
        numero = execucao["alvo"].split(":", 1)[1]
        situacao = {"ticket-resolvido": "rotacao", "destino": "destino", "bloqueado": "parado", "fechado": "fechado", "sem-acao": "sem-acao"}[valor]
        estado["avaliacoes"][numero] = {"ultima": agora_iso(), "situacao": situacao, "nota": (resultado or {}).get("resumo", "")[:400]}
        if valor == "destino" and not any(str(frente["mapa"]) == numero for frente in estado["specs"]):
            issue = retrato["issues_abertas"].get(numero, {"rotulos": []})
            if "spec" in issue["rotulos"]:
                estado["specs"].append({"mapa": int(numero), "spec": int(numero), "etapa": "to-tickets", "nota": "spec com fatias faltando"})
            else:
                estado["specs"].append({"mapa": int(numero), "etapa": "to-spec", "nota": (resultado or {}).get("resumo", "")[:400]})
        return True
    if tipo == "melhorias":
        if valor == "melhorias-abertas":
            estado["melhorias_pendentes"] = False
            return True
        return False
    return False


def pr_da_branch_seguro(branch: str) -> Optional[Dict[str, Any]]:
    try:
        return pr_da_branch(CONFIGURACAO_ATUAL["repo"], branch)
    except FalhaDaFonte:
        return None


def issue_rotulos_seguro(numero: int) -> Optional[List[str]]:
    try:
        dados = gh_json(["issue", "view", str(numero), "--repo", CONFIGURACAO_ATUAL["repo"], "--json", "labels"])
        return [rotulo["name"] for rotulo in dados["labels"]]
    except (FalhaDaFonte, TypeError, KeyError):
        return None


CONFIGURACAO_ATUAL: Dict[str, Any] = {}


# ---------------------------------------------------------------- status para o Matheus


def escrever_status(estado: Dict[str, Any], retrato: Dict[str, Any], configuracao: Dict[str, Any], acoes: List[Dict[str, Any]]) -> str:
    linhas = [f"# Torre autônoma — {agora().strftime('%d/%m %H:%M')}", ""]
    pendentes = [pedido for pedido in estado["para_o_matheus"] if not pedido["feito"]]
    linhas.append("## Para o Matheus")
    linhas += [f"- {pedido['texto']} ({pedido['origem']})" for pedido in pendentes] or ["- nada novo"]
    codigo = estado["codigo"]
    contas = contas_do_estado(estado)
    linhas += ["", "## Contas do Claude Code",
               f"- execuções abertas: {contas['contador']}; só a conta {CONTA_DA_TORRE} abre e retoma "
               f"(a outra conta está fora de uso; a Torre não abre execução com o Chrome local)",
               f"- última usada: conta {contas['em_uso']}"
               + "".join(f"; conta {conta} no limite até {prazo[11:16]}" for conta, prazo in sorted(contas["limitada_ate"].items()))]
    linhas += ["", "## Código", f"- fase: **{codigo['fase']}**"]
    if codigo.get("lote"):
        lote = codigo["lote"]
        linhas.append(f"- lote {lote['numero']}: {lote['issues']}; pares na dev {lote['pares'] or 'nenhum'} (o CI local roda no fim do lote)")
    if codigo.get("ajustes"):
        linhas.append(f"- fila de ajustes: `{codigo['ajustes']['nome']}`" + (" (externa, só acompanha)" if codigo["ajustes"].get("externa") else ""))
    for fila in (codigo.get("par") or {}).get("filas", []):
        linhas.append(f"- `{fila['nome']}` {fila['issues']}: {'na dev' if fila['feita'] else 'andando'}")
    linhas += ["", "## Execuções rodando"]
    rodando = execucoes_rodando(estado, TIPOS_DE_CODIGO | TIPOS_LATERAIS)
    linhas += [f"- `{execucao['nome']}` ({execucao['tipo']}), t{execucao['tentativa']}, sem saída há {round(minutos_desde(execucao['ultima_saida']))} min"
               for execucao in rodando] or ["- nenhuma"]
    linhas += ["", "## Próximo passo de cada frente"]
    linhas += [f"- **{acao['tipo']}** `{acao.get('nome', acao.get('alvo', ''))}`: {acao.get('motivo', '')}" for acao in acoes] or ["- nada a abrir agora"]
    linhas += ["", "## Laterais"]
    linhas += [f"- spec do mapa #{frente['mapa']}: {frente['etapa']}" for frente in estado["specs"]]
    linhas += [f"- #{numero}: {avaliacao['situacao']} ({avaliacao['ultima'][:16]})" for numero, avaliacao in sorted(estado["avaliacoes"].items())]
    linhas += ["", "## Bloqueios de watchdog (últimos 5)"]
    linhas += [f"- {bloqueio['quando'][:16]} `{bloqueio['watchdog']}` em `{bloqueio['execucao']}`: `{bloqueio['comando'][:120]}`" for bloqueio in estado["bloqueios"][-5:]] or ["- nenhum"]
    linhas += ["", f"## Fora da dev (M2, varredura {str(estado['fora_da_dev']['quando'])[:16]})"]
    linhas += [f"- `{item['branch']}`: {len(item['so_na_branch'])} só na branch, {len(item['diferentes_da_dev'])} diferentes" for item in estado["fora_da_dev"]["itens"]] or ["- nada"]
    if estado.get("fim"):
        linhas += ["", "## FIM", estado["fim"]]
    texto = "\n".join(linhas) + "\n"
    ARQUIVO_STATUS.write_text(texto, encoding="utf-8")
    return texto


def conferir_fim(estado: Dict[str, Any], retrato: Dict[str, Any], configuracao: Dict[str, Any], acoes: List[Dict[str, Any]],
                 inicio_da_volta: str = "") -> Optional[str]:
    if execucoes_rodando(estado, TIPOS_DE_CODIGO | TIPOS_LATERAIS):
        return None
    # A execução que terminou nesta volta pode ter criado issues que o retrato, tirado antes, ainda não vê.
    if inicio_da_volta and any((execucao.get("fim") or "") >= inicio_da_volta for execucao in estado["execucoes"].values()):
        return None
    if any(acao["tipo"] not in {"nota"} for acao in acoes):
        return None
    if estado["codigo"]["fase"] not in {"planejar-par"}:
        return None
    sobras = []
    for issue in sorted(retrato["issues_abertas"].values(), key=lambda issue: issue["numero"]):
        if "ready-for-human" in issue["rotulos"]:
            continue
        motivo = motivo_de_fora(issue, configuracao)
        avaliacao = estado["avaliacoes"].get(str(issue["numero"]))
        if avaliacao:
            motivo = (motivo + "; " if motivo else "") + f"avaliação: {avaliacao['situacao']}"
        sobras.append(f"#{issue['numero']} ({motivo or 'sem ação automática'}) — {issue['titulo'][:70]}")
    return "Nada mais a abrir. Abertas que não são ready-for-human:\n" + "\n".join(f"- {sobra}" for sobra in sobras)


# ---------------------------------------------------------------- o laço


def uma_volta(configuracao: Dict[str, Any], estado: Dict[str, Any], melhorias: Dict[str, Any], ensaio: bool, so_lateral: bool, buscar: bool = True) -> List[Dict[str, Any]]:
    inicio_da_volta = agora_iso()
    retrato = tirar_retrato(configuracao, estado, buscar=buscar)
    ciclo = ciclo_das_melhorias(melhorias, estado)
    if not ensaio:
        reabrir = acompanhar_execucoes(estado, retrato, configuracao, ciclo)
        reabrir_por_limite(estado, retrato, configuracao, ciclo)
        for item in reabrir:
            antiga = item["execucao"]
            acao = acao_de_reabertura(antiga, estado, retrato, configuracao)
            conta = None if acao and segurar_chrome_local(acao, estado, retrato, configuracao) else conta_disponivel(estado)
            if conta is None:
                antiga["situacao"] = "aguardando-conta"
                estado.setdefault("aguardando_conta", []).append(
                    {"nome": antiga["nome"], "tentativa": item["tentativa"], "continuacao": item["continuacao"],
                     "por_limite": bool(item.get("por_limite"))})
                continue
            if acao:
                lancar(acao, estado, ciclo, conta, tentativa=item["tentativa"], continuacao=item["continuacao"],
                       por_limite=bool(item.get("por_limite")))
    avancar_estado(estado, retrato, configuracao, melhorias)
    if minutos_desde(estado["fora_da_dev"]["quando"]) >= configuracao["minutos_entre_varreduras_fora_da_dev"]:
        try:
            itens = varrer_fora_da_dev(configuracao, retrato, estado)
            estado["fora_da_dev"] = {"quando": agora_iso(), "itens": itens}
            ciclo_das_melhorias(melhorias, estado)["M2_varreduras"].append(
                {"quando": agora_iso(), "itens": len(itens), "pesquisa_so_na_branch": sum(len(item["pesquisa_so_na_branch"]) for item in itens)})
        except FalhaDaFonte as erro:
            anotar(estado, f"varredura fora da dev falhou: {erro}")
    acoes = planejar(estado, retrato, configuracao, melhorias)
    if so_lateral:
        acoes = [acao for acao in acoes if acao["tipo"] in TIPOS_LATERAIS]
        if any(execucao["tipo"] in TIPOS_LATERAIS for execucao in estado["execucoes"].values()):
            acoes = []
    if not ensaio:
        for acao in acoes:
            if "kickoff" in acao:
                if segurar_chrome_local(acao, estado, retrato, configuracao):
                    continue
                conta = conta_disponivel(estado)
                if conta is None:
                    break
                lancar(acao, estado, ciclo_das_melhorias(melhorias, estado), conta)
        # O fim vale só para esta volta: o de uma subida anterior não pode derrubar a Torre que acabou de subir.
        estado["fim"] = conferir_fim(estado, retrato, configuracao, acoes, inicio_da_volta) if not so_lateral else None
        escrever_status(estado, retrato, configuracao, acoes)
    else:
        imprimir_ensaio(estado, retrato, configuracao, acoes)
    return acoes


def reabrir_por_limite(estado: Dict[str, Any], retrato: Dict[str, Any], configuracao: Dict[str, Any], ciclo: Dict[str, Any]) -> None:
    """Reabre as execuções que esperavam a conta 2 fora do limite, a mais antiga primeiro.

    A que precisa do Chrome local fica na fila sem segurar as seguintes; com a conta no limite, todas esperam."""
    fila_de_espera = estado.setdefault("aguardando_conta", [])
    seguem_esperando = []
    conta_no_limite = False
    for item in fila_de_espera:
        antiga = estado["execucoes"].get(item["nome"])
        if antiga is None or antiga["situacao"] != "aguardando-conta":
            continue
        if conta_no_limite:
            seguem_esperando.append(item)
            continue
        acao = acao_de_reabertura(antiga, estado, retrato, configuracao)
        if acao and segurar_chrome_local(acao, estado, retrato, configuracao):
            seguem_esperando.append(item)
            continue
        conta = conta_disponivel(estado)
        if conta is None:
            conta_no_limite = True
            seguem_esperando.append(item)
            continue
        if acao:
            lancar(acao, estado, ciclo, conta, tentativa=item["tentativa"], continuacao=item["continuacao"],
                   por_limite=item["por_limite"])
        else:
            antiga["situacao"] = "falhou"
    fila_de_espera[:] = seguem_esperando


def acao_de_reabertura(antiga: Dict[str, Any], estado: Dict[str, Any], retrato: Dict[str, Any], configuracao: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    tipo, alvo = antiga["tipo"], antiga["alvo"]
    base = {"tipo": tipo, "alvo": alvo, "nome": antiga["nome"], "motivo": f"reabertura: {antiga.get('falha', 'continuação')}",
            **{chave: antiga[chave] for chave in ("extra", "avalia_mapa") if antiga.get(chave)}}
    if tipo == "fila":
        fila = next((fila for fila in (estado["codigo"].get("par") or {}).get("filas", []) if f"fila:{fila['nome']}" == alvo), None)
        if fila:
            return dict(base, kickoff=lambda nome: kickoff_fila(fila, estado["codigo"]["par"], nome))
    elif tipo == "ajustes" and estado["codigo"].get("ajustes"):
        ajustes = estado["codigo"]["ajustes"]
        return dict(base, kickoff=lambda nome: kickoff_ajustes(ajustes, estado["fora_da_dev"]["itens"], nome))
    elif tipo == "planejar-par":
        numero = int(alvo.split(":")[1])
        candidatas = candidatas_do_lote(retrato, configuracao, estado)
        semente = estado["codigo"].get("proximo_par")
        lote = estado["codigo"].get("lote")
        if not candidatas:
            return None
        return dict(base, candidatas=[issue["numero"] for issue in candidatas],
                    kickoff=lambda nome: kickoff_planejar_par(numero, candidatas, semente, nome, lote))
    elif tipo == "spec":
        _, mapa, etapa = alvo.split(":")
        frente = next((frente for frente in estado["specs"] if str(frente["mapa"]) == mapa and frente["etapa"] == etapa), None)
        if frente:
            return dict(base, kickoff=lambda nome: kickoff_spec(frente, nome))
    elif tipo == "triagem":
        triagem = candidatas_de_triagem(retrato, configuracao)
        if triagem:
            return dict(base, kickoff=lambda nome: kickoff_triagem(triagem, nome))
    elif tipo == "avaliar":
        issue = retrato["issues_abertas"].get(alvo.split(":")[1])
        if issue:
            return dict(base, kickoff=lambda nome: kickoff_avaliar(dict(issue, ultima=""), nome))
    elif tipo == "melhorias":
        return None
    return None


def imprimir_ensaio(estado: Dict[str, Any], retrato: Dict[str, Any], configuracao: Dict[str, Any], acoes: List[Dict[str, Any]]) -> None:
    codigo = estado["codigo"]
    print("== ENSAIO A SECO: nada foi aberto ==")
    print(f"retrato: {len(retrato['issues_abertas'])} issues abertas, {len(retrato['branches'])} branches")
    print(f"código: fase {codigo['fase']}; lote {codigo.get('lote')}; ajustes {codigo.get('ajustes')}; par {codigo.get('par')}; próximo par {codigo.get('proximo_par')}")
    for nome, pr in retrato["prs_das_integracoes"].items():
        print(f"  PR de {nome}: {pr}")
    print("specs:", estado["specs"])
    print("mapas iniciais que travam o código:", mapas_iniciais_que_travam(retrato))
    print("candidatas de código:", [issue["numero"] for issue in candidatas_de_codigo(retrato, configuracao, estado)])
    print("candidatas do lote:", [issue["numero"] for issue in candidatas_do_lote(retrato, configuracao, estado)])
    print("candidatas de triagem:", [issue["numero"] for issue in candidatas_de_triagem(retrato, configuracao)])
    print("fila de avaliação:", [issue["numero"] for issue in candidatas_de_avaliacao(retrato, configuracao, estado)])
    fora = [f"#{issue['numero']} ({motivo_de_fora(issue, configuracao)})" for issue in retrato["issues_abertas"].values() if motivo_de_fora(issue, configuracao)]
    print("fora de escopo:", ", ".join(sorted(fora, key=lambda texto: int(texto[1:].split(" ")[0]))))
    print(f"fora da dev (M2): {len(estado['fora_da_dev']['itens'])} branches")
    for item in estado["fora_da_dev"]["itens"]:
        print(f"  {item['branch']}: só na branch {item['so_na_branch'][:4]}, diferentes {item['diferentes_da_dev'][:4]}")
    print("abriria agora:")
    for acao in acoes:
        print(f"  - {acao['tipo']} {acao.get('nome', acao.get('alvo', ''))}: {acao.get('motivo', '')}")


def segurar_pid() -> None:
    if ARQUIVO_PID.exists():
        try:
            pid_anterior = int(ARQUIVO_PID.read_text().strip())
            os.kill(pid_anterior, 0)
            if "torre.py" in rodar(["ps", "-p", str(pid_anterior), "-o", "command="], tolerante=True):
                sys.exit(f"Outra Torre já roda (pid {pid_anterior}). Pare-a antes: touch {ARQUIVO_PARAR}")
        except (ValueError, ProcessLookupError, PermissionError):
            pass
    ARQUIVO_PID.write_text(str(os.getpid()))


def principal() -> None:
    analisador = argparse.ArgumentParser(description="Torre de controle autônoma do Excurfly")
    analisador.add_argument("--ensaio", action="store_true", help="imprime o que abriria agora, sem abrir nada nem gravar estado")
    analisador.add_argument("--uma-lateral", action="store_true", help="abre só a próxima execução lateral e acompanha até ela terminar")
    analisador.add_argument("--sem-fetch", action="store_true", help="não roda git fetch (só no ensaio)")
    argumentos = analisador.parse_args()

    configuracao = ler_json(ARQUIVO_CONFIGURACAO, None)
    if configuracao is None:
        sys.exit(f"Sem configuração em {ARQUIVO_CONFIGURACAO}")
    CONFIGURACAO_ATUAL.update(configuracao)
    for pasta in (PASTA_TORRE, PASTA_EXECUCOES, PASTA_RESULTADOS, PASTA_PARES):
        pasta.mkdir(parents=True, exist_ok=True)
    estado = ler_json(ARQUIVO_ESTADO, None) or estado_inicial(configuracao)
    melhorias = carregar_melhorias(estado)

    if argumentos.ensaio:
        uma_volta(configuracao, copy.deepcopy(estado), copy.deepcopy(melhorias), ensaio=True, so_lateral=False, buscar=not argumentos.sem_fetch)
        return

    segurar_pid()
    registrar(f"Torre no ar (pid {os.getpid()}); estado em {ARQUIVO_ESTADO}")
    lateral_aberta: Optional[str] = None
    try:
        while True:
            if ARQUIVO_PARAR.exists():
                registrar("achou o arquivo PARAR: a Torre sai; as execuções em curso seguem e são retomadas na próxima subida")
                break
            try:
                acoes = uma_volta(configuracao, estado, melhorias, ensaio=False, so_lateral=argumentos.uma_lateral)
            except FalhaDaFonte as erro:
                anotar(estado, f"a fonte falhou nesta volta: {erro}")
                acoes = []
            except Exception as erro:  # a Torre não cai por um evento inesperado: registra e segue
                anotar(estado, f"erro inesperado nesta volta: {type(erro).__name__}: {erro}")
                acoes = []
            gravar_json(ARQUIVO_ESTADO, estado)
            gravar_json(ARQUIVO_MELHORIAS, melhorias)
            if argumentos.uma_lateral:
                if lateral_aberta is None:
                    abertas = [acao["nome"] for acao in acoes if acao["tipo"] in TIPOS_LATERAIS and "kickoff" in acao]
                    lateral_aberta = abertas[0] if abertas else None
                    if lateral_aberta is None:
                        registrar("nenhuma lateral a abrir")
                        break
                execucao = estado["execucoes"].get(lateral_aberta)
                if execucao and execucao["situacao"] not in {"rodando"}:
                    registrar(f"{lateral_aberta} terminou: {execucao['situacao']}")
                    if execucao["situacao"] in {"concluida", "precisa-do-matheus"}:
                        break
            if estado.get("fim"):
                registrar("FIM: " + estado["fim"].splitlines()[0])
                break
            time.sleep(configuracao["intervalo_segundos"])
    finally:
        gravar_json(ARQUIVO_ESTADO, estado)
        gravar_json(ARQUIVO_MELHORIAS, melhorias)
        if ARQUIVO_PID.exists() and ARQUIVO_PID.read_text().strip() == str(os.getpid()):
            ARQUIVO_PID.unlink()


if __name__ == "__main__":
    principal()
