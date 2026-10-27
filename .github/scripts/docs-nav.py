"""Escreve a navegação de cada página de docs/: no topo, onde se está (parte e página), a página
anterior e a seguinte, e a lista de todas as páginas (fechada); no fim, outra vez a anterior e a
seguinte. A ordem das páginas é a de PARTES, que é também a ordem de leitura do guia.

Porquê gerada: com 25 páginas, ligações escritas à mão desactualizam-se a cada página nova ou
mudança de ordem; assim muda-se só PARTES e corre-se o script.

    python .github/scripts/docs-nav.py           # escreve
    python .github/scripts/docs-nav.py --check   # só verifica (CI): sai com 1 se alguma página mudaria
"""
import os
import re
import sys

PARTES = [
    ("0. Começar do zero", [
        ("conceitos.md", "Conceitos básicos"),
        ("preparar-o-computador.md", "Preparar o computador"),
    ]),
    ("1. Conhecer o projecto", [
        ("visao-geral.md", "Visão geral"),
        ("glossario.md", "Glossário"),
        ("fontes-de-dados.md", "Fontes de dados"),
        ("estado-do-projecto.md", "Estado do projecto"),
    ]),
    ("2. Montar localmente", [
        ("primeiros-passos.md", "Primeiros passos"),
        ("base-de-dados.md", "Base de dados"),
        ("configuracao.md", "Configuração"),
    ]),
    ("3. Perceber como funciona", [
        ("fluxos-de-dados.md", "Fluxos de dados"),
        ("localizacao-gps.md", "Localização e GPS"),
        ("ussd.md", "Serviço USSD"),
        ("seguranca.md", "Segurança"),
        ("referencia-api.md", "Referência da API"),
        ("mapa-do-codigo.md", "Mapa do código"),
    ]),
    ("4. Usar as aplicações", [
        ("app-passageiros.md", "Aplicação dos passageiros"),
        ("portal-motorista.md", "Portal do motorista"),
        ("painel-admin.md", "Painel de administração"),
    ]),
    ("5. Pôr online", [
        ("publicacao.md", "Publicação"),
        ("guia-vercel.md", "Guia da Vercel"),
        ("guia-neon.md", "Guia da Neon"),
        ("africas-talking.md", "Africa's Talking"),
        ("guia-cron-job.md", "Guia do cron-job.org"),
    ]),
    ("6. Manter", [
        ("testes.md", "Testes"),
        ("resolucao-de-problemas.md", "Resolução de problemas"),
        ("limitacoes.md", "Limitações"),
    ]),
]

TOPO_A, TOPO_B = "<!-- navegação: gerada por .github/scripts/docs-nav.py, não editar à mão -->", "<!-- /navegação -->"
FIM_A, FIM_B = "<!-- navegação-fim: gerada por .github/scripts/docs-nav.py -->", "<!-- /navegação-fim -->"

ORDEM = [(f, t, parte) for parte, paginas in PARTES for f, t in paginas]


def lista(atual):
    linhas = []
    for parte, paginas in PARTES:
        itens = [f"**{t}**" if f == atual else f"[{t}]({f})" for f, t in paginas]
        linhas.append(f"- {parte}: " + " · ".join(itens))
    return "\n".join(linhas)


def blocos(i):
    f, t, parte = ORDEM[i]
    ant = ORDEM[i - 1] if i > 0 else None
    seg = ORDEM[i + 1] if i + 1 < len(ORDEM) else None
    passos = []
    if ant:
        passos.append(f"Anterior: [{ant[1]}]({ant[0]})")
    passos.append("[Índice](README.md)")
    if seg:
        passos.append(f"Seguinte: [{seg[1]}]({seg[0]})")
    topo = "\n".join([
        TOPO_A,
        f"[Documentação](README.md) › {parte} › **{t}** (página {i + 1} de {len(ORDEM)})",
        "",
        " · ".join(passos),
        "",
        "<details>",
        "<summary>Todas as páginas</summary>",
        "",
        lista(f),
        "",
        "</details>",
        TOPO_B,
    ])
    fim = "\n".join([FIM_A, "", "---", "", " · ".join(passos), FIM_B])
    return topo, fim


def com_navegacao(texto, topo, fim):
    texto = texto.replace("\r\n", "\n")
    if TOPO_A in texto:
        texto = re.sub(re.escape(TOPO_A) + r".*?" + re.escape(TOPO_B), lambda m: topo, texto, count=1, flags=re.S)
    else:
        linhas = texto.split("\n")
        h1 = next((k for k, l in enumerate(linhas) if l.startswith("# ")), -1)
        linhas.insert(h1 + 1, "\n" + topo)
        texto = "\n".join(linhas)
    if FIM_A in texto:
        texto = re.sub(r"\n*" + re.escape(FIM_A) + r".*?" + re.escape(FIM_B), lambda m: "\n\n" + fim, texto, count=1, flags=re.S)
    else:
        texto = texto.rstrip("\n") + "\n\n" + fim
    return texto.rstrip("\n") + "\n"


def main():
    raiz = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "docs")
    verificar = "--check" in sys.argv
    mudariam, faltam = [], []
    for i, (f, _, _) in enumerate(ORDEM):
        caminho = os.path.join(raiz, f)
        if not os.path.exists(caminho):
            faltam.append(f)
            continue
        with open(caminho, encoding="utf-8", newline="") as fh:
            antes = fh.read()
        depois = com_navegacao(antes, *blocos(i))
        if depois != antes.replace("\r\n", "\n"):
            mudariam.append(f)
            if not verificar:
                with open(caminho, "w", encoding="utf-8", newline="\n") as fh:
                    fh.write(depois)
    for f in faltam:
        print(f"FALTA   docs/{f}")
    for f in mudariam:
        print(f"{'DESACTUALIZADA' if verificar else 'ESCRITA'} docs/{f}")
    if verificar and (mudariam or faltam):
        print("Correr: python .github/scripts/docs-nav.py")
        sys.exit(1)
    print(f"{len(ORDEM)} páginas, {len(mudariam)} {'desactualizadas' if verificar else 'escritas'}, {len(faltam)} em falta")


if __name__ == "__main__":
    main()
