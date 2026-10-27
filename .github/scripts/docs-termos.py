"""Liga a primeira vez que cada termo técnico aparece em cada página da documentação à sua explicação
em docs/conceitos.md (ou, para as palavras do projecto, em docs/glossario.md). Passar o rato por cima
da ligação mostra a frase curta da explicação.

Porquê: a documentação deve poder ser lida por quem nunca programou. Escrever estas ligações à mão
em 25 páginas esquecia sempre alguma, e desactualizava-se a cada parágrafo novo; assim, uma página
nova ou um parágrafo novo ganham as ligações ao correr o script, e o CI avisa quando falta corrê-lo.

    python .github/scripts/docs-termos.py           # escreve
    python .github/scripts/docs-termos.py --check   # só verifica (CI): sai com 1 se alguma página mudaria

Como funciona:
- A frase curta de cada conceito é a linha "**Em uma frase:**" a seguir ao seu <a id="…"> em
  conceitos.md; os padrões de texto que a ele levam estão em TERMOS, abaixo.
- As ligações que o script escreve têm um título entre aspas, [texto](conceitos.md#x "frase"),
  e são as únicas que ele apaga e volta a escrever. As ligações escritas à mão (sem título) ficam,
  e um termo já ligado à mão numa página não volta a ser ligado.
- Não se mexe em blocos de código, títulos, navegação, HTML, endereços nem no texto de ligações.
  Dentro de `código`, só se liga o bloco inteiro quando ele é um comando (`npm install`) ou um
  nome de tabela (`MISSION`).
"""
import glob
import os
import re
import sys

RAIZ = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DOCS = os.path.join(RAIZ, "docs")

# (âncora em conceitos.md, padrões no texto, padrões dentro de `código`)
# Os padrões são expressões regulares; (?i:…) ignora maiúsculas.
TERMOS = [
    ("internet", [r"(?i:internet)"], []),
    ("servidor", [r"(?i:servidor(?:es)?)"], []),
    ("navegador", [r"(?i:navegador(?:es)?)"], []),
    ("aplicacao-web", [r"(?i:aplicaç(?:ão|ões) web)"], []),
    ("url", [r"URLs?"], []),
    ("localhost", [r"localhost"], [r"localhost(?::\d+)?"]),
    ("http", [r"HTTPS?", r"(?i:pedidos? HTTP)"], []),
    ("get-e-post", [r"POST", r"GET"], [r"POST", r"GET"]),
    ("parametros", [r"(?i:parâmetros?)", r"(?i:cabeçalhos?)(?= `)", r"(?i:corpo do pedido)"], []),
    ("codigos-de-resposta", [r"(?i:códigos? de resposta)", r"(?<!\d )(?:401|403|404)(?! ?\d)(?! k?m\b)"], []),
    ("api", [r"APIs?", r"(?i:endpoints?)"], []),
    ("json", [r"JSON"], []),
    ("sessao", [r"(?i:sess(?:ão|ões))", r"(?i:tokens?)", r"(?i:cookies?)"], []),
    ("cors", [r"CORS"], []),
    ("codigo-fonte", [r"(?i:código-fonte)"], []),
    ("typescript", [r"TypeScript", r"JavaScript"], []),
    ("nodejs", [r"Node(?:\.js)?"], [r"node(?: .*)?"]),
    ("npm", [r"npm", r"npx", r"(?i:dependências)", r"(?i:pacotes)"], [r"npm(?: .*)?", r"npx(?: .*)?"]),
    ("nextjs", [r"Next\.js", r"React"], []),
    ("prisma", [r"Prisma(?: Studio)?"], []),
    ("script", [r"(?i:scripts?)"], []),
    ("terminal", [r"(?i:terminal|terminais)", r"(?i:linha de comandos)", r"Git Bash", r"PowerShell"], []),
    ("curl", [r"curl"], [r"curl(?:\.exe)?(?: .*)?"]),
    ("variavel-de-ambiente", [r"(?i:variáve(?:l|is) de ambiente)"], [r"(?:[\w-]+/)?\.env"]),
    ("segredo", [r"(?i:segredos?)", r"(?i:chaves? da API)"], []),
    ("hash", [r"(?i:hash(?:es)?)", r"bcrypt", r"SHA-256"], []),
    ("registos", [r"(?i:registos)", r"(?i:logs)"], []),
    ("testes", [r"(?i:testes automáticos)", r"Jest", r"Playwright"], []),
    ("serverless", [r"(?i:serverless)"], []),
    ("base-de-dados", [r"(?i:bases? de dados)"], []),
    ("chave", [r"(?i:chaves? estrangeiras?)"], []),
    ("sql", [r"SQL"], []),
    ("postgresql", [r"PostgreSQL", r"psql"], [r"psql(?: .*)?"]),
    ("migracao", [r"(?i:migraç(?:ão|ões))", r"(?i:esquemas?)(?! OpenMapTiles)"], []),
    ("semente", [r"(?i:dados de demonstração)", r"(?i:sementes?)"], []),
    ("copia-de-seguranca", [r"(?i:cópias? de segurança)", r"(?i:backups?)"], []),
    ("docker", [r"Docker(?: Desktop)?"], [r"docker(?: .*)?"]),
    ("git", [r"[Gg]it"], [r"git(?: .*)?"]),
    ("repositorio", [r"(?i:repositórios?)"], []),
    ("commit", [r"(?i:commits?)"], []),
    ("ramo", [r"(?i:ramos?)", r"(?i:branch(?:es)?)"], []),
    ("github", [r"GitHub"], []),
    ("clonar", [r"(?i:clonar)"], []),
    ("pull-request", [r"(?i:pull requests?)", r"(?i:merge)"], []),
    ("ci", [r"CI", r"GitHub Actions"], []),
    ("agendamento", [r"(?i:agendamentos?)", r"(?i:cron(?: jobs?)?)"], []),
    ("markdown", [r"Markdown", r"Mermaid"], []),
    ("publicacao", [r"(?i:publicaç(?:ão|ões))", r"(?i:deploy|redeploy)"], []),
    ("vercel", [r"Vercel", r"Production", r"Preview"], []),
    ("neon", [r"Neon"], []),
    ("ussd", [r"USSD", r"(?i:sess(?:ão|ões) USSD)"], []),
    ("sms", [r"SMS"], []),
    ("gateway", [r"(?i:gateways?)"], []),
    ("africas-talking", [r"Africa's Talking", r"(?i:sandbox)", r"(?i:simulador)"], []),
    ("callback", [r"(?i:callback)", r"(?i:webhooks?)"], []),
    ("gsm-7", [r"GSM-7"], []),
    ("coordenadas", [r"(?i:coordenadas)", r"(?i:latitude)", r"(?i:longitude)"], []),
    ("gps", [r"GPS"], []),
    ("rastreador", [r"(?i:rastreador(?:es)?(?: GPS)?)", r"(?i:códigos? do dispositivo)"], []),
    ("osmand", [r"OsmAnd"], []),
    ("traccar", [r"Traccar(?: Client)?"], []),
    ("openstreetmap", [r"OpenStreetMap", r"OSM", r"Overpass"], []),
    ("mosaicos", [r"(?i:mosaicos?)", r"OpenFreeMap", r"MapLibre"], []),
    ("router", [r"(?<!App )(?i:routers?)", r"OSRM"], []),  # não o "App Router" do Next.js
    ("geocodificacao", [r"(?i:geocodificaç(?:ão|ões)|geocodificador)", r"Nominatim"], []),
]

# As palavras do projecto, explicadas no glossário: (âncora em glossario.md, frase curta, texto, `código`)
GLOSSARIO = [
    ("a-rede-e-as-pessoas", "A tabela das rotas de autocarro (route)", [], [r"Via"]),
    ("a-rede-e-as-pessoas", "A tabela das paragens (stop)", [], [r"Paragem"]),
    ("a-rede-e-as-pessoas", "A ligação de uma paragem a uma rota", [], [r"ViaParagem"]),
    ("a-rede-e-as-pessoas", "A tabela dos veículos (vehicle)", [], [r"Transporte"]),
    ("a-rede-e-as-pessoas", "A tabela dos motoristas e dos seus PIN", [], [r"Motorista"]),
    ("a-rede-e-as-pessoas", "A tabela dos donos dos veículos", [], [r"Proprietario"]),
    ("a-rede-e-as-pessoas", "A tabela das contas de passageiros", [], [r"Utente"]),
    ("a-rede-e-as-pessoas", "Um alerta de chegada: um SMS quando um autocarro estiver perto de uma paragem", [], [r"MISSION"]),
    ("a-rede-e-as-pessoas", "Uma viagem acompanhada por SMS: os avisos de cada autocarro até ao destino", [], [r"Acompanhamento"]),
    ("a-rede-e-as-pessoas", "A regra de tarifa: preço mínimo, preço por km e velocidades", [], [r"Tarifa"]),
    ("a-rede-e-as-pessoas", "A tabela das contas do painel de administração", [], [r"Administrador"]),
    ("transportes-em-maputo", "Os minibuses que levam a maior parte dos passageiros de Maputo", [r"(?i:chapas?)"], []),
    ("transportes-em-maputo", "Autocarro, em Moçambique", [r"(?i:machimbombos?)"], []),
    ("transportes-em-maputo", "A Empresa Municipal de Transporte Público de Maputo", [r"EMTPM"], []),
    ("palavras-dos-ecrãs", "Mudança de autocarro a meio de uma viagem", [r"(?i:transbordos?)"], []),
]

TOPO = (r"<!-- navegação:", r"<!-- /navegação -->")
FIM = (r"<!-- navegação-fim", r"<!-- /navegação-fim -->")

# Partes de uma linha onde nunca se põe uma ligação
PROTEGIDO = re.compile(
    r"!?\[[^\]]*\]\([^)]*\)"   # ligações e imagens
    r"|<[^>]+>"                # HTML
    r"|https?://\S+"           # endereços
    r"|\*\*Em uma frase:\*\*"
)
CODIGO = re.compile(r"`[^`\n]+`")
LIGACAO_AUTO = re.compile(r'\[([^\]]+)\]\((?:[\w./-]*/)?(?:conceitos|glossario)\.md#[^ )]+ "[^"]*"\)')


def frases_dos_conceitos():
    """A frase curta de cada âncora de conceitos.md, sem formatação"""
    texto = open(os.path.join(DOCS, "conceitos.md"), encoding="utf-8").read()
    frases = {}
    for m in re.finditer(r'<a id="([^"]+)"></a>\s*\n\s*\*\*Em uma frase:\*\*\s*(.+)', texto):
        frase = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", m.group(2))
        frase = frase.replace("`", "").replace('"', "'").strip()
        frase = frase[:1].upper() + frase[1:]
        frases[m.group(1)] = frase
    return frases


def regras(frases):
    """Uma lista (padrão de texto, padrão de código, destino, frase); os padrões mais longos primeiro"""
    lista = []
    for ancora, texto, codigo in TERMOS:
        if ancora not in frases:
            sys.exit(f"conceitos.md não tem <a id=\"{ancora}\"> com uma linha **Em uma frase:**")
        lista.append((texto, codigo, ("conceitos.md", ancora), frases[ancora]))
    for ancora, frase, texto, codigo in GLOSSARIO:
        lista.append((texto, codigo, ("glossario.md", ancora), frase))
    return lista


def compilar(lista):
    texto, codigo = [], []
    for i, (pt, pc, destino, frase) in enumerate(lista):
        for p in pt:
            texto.append((p, i))
        for p in pc:
            codigo.append((re.compile(rf"^(?:{p})$"), i))
    # Os padrões mais longos primeiro: "sessão USSD" antes de "sessão", "Git Bash" antes de "Git"
    texto.sort(key=lambda t: -len(t[0]))
    grupos = "|".join(rf"(?P<t{k}>(?<![\w-])(?:{p})(?![\w-]))" for k, (p, _) in enumerate(texto))
    return re.compile(grupos), [i for _, i in texto], codigo


def processar(caminho, lista, rx, quem, codigo):
    nome = os.path.basename(caminho)
    rel = os.path.relpath(DOCS, os.path.dirname(caminho)).replace(os.sep, "/")
    prefixo = "" if rel == "." else rel + "/"
    with open(caminho, encoding="utf-8", newline="") as fh:
        original = fh.read()
    crlf = "\r\n" in original
    texto = LIGACAO_AUTO.sub(r"\1", original.replace("\r\n", "\n"))

    ligados = set()
    # Os termos que a página já liga à mão (ligações sem título) não se ligam outra vez
    for m in re.finditer(r"(conceitos|glossario)\.md#([\w%-]+)\)", texto):
        if m.group(1) == "conceitos":
            ligados.update(i for i, r in enumerate(lista) if r[2] == ("conceitos.md", m.group(2)))

    def permitido(i):
        ficheiro = lista[i][2][0]
        return i not in ligados and ficheiro != nome

    def ligacao(i, mostrado):
        ficheiro, ancora = lista[i][2]
        ligados.add(i)
        return f'[{mostrado}]({prefixo}{ficheiro}#{ancora} "{lista[i][3]}")'

    def no_texto(segmento):
        def troca(m):
            i = quem[int(m.lastgroup[1:])]
            return ligacao(i, m.group(0)) if permitido(i) else m.group(0)
        return rx.sub(troca, segmento)

    def no_codigo(m):
        dentro = m.group(0)[1:-1]
        for padrao, i in codigo:
            if permitido(i) and padrao.match(dentro):
                return ligacao(i, m.group(0))
        return m.group(0)

    saida, em_codigo, em_nav = [], False, False
    for linha in texto.split("\n"):
        limpa = linha.strip()
        if limpa.startswith(TOPO[0]) or limpa.startswith(FIM[0]):
            em_nav = True
        if em_nav:
            saida.append(linha)
            if limpa.startswith(TOPO[1]) or limpa.startswith(FIM[1]):
                em_nav = False
            continue
        if limpa.startswith("```"):
            em_codigo = not em_codigo
            saida.append(linha)
            continue
        if em_codigo or limpa.startswith("#") or limpa.startswith("<") or limpa.startswith("**Nesta página:**"):
            saida.append(linha)
            continue
        partes, pos = [], 0
        for m in re.finditer(PROTEGIDO.pattern + r"|" + CODIGO.pattern, linha):
            partes.append(no_texto(linha[pos:m.start()]))
            partes.append(no_codigo(m) if m.group(0).startswith("`") else m.group(0))
            pos = m.end()
        partes.append(no_texto(linha[pos:]))
        saida.append("".join(partes))

    novo = "\n".join(saida)
    if crlf:
        novo = novo.replace("\n", "\r\n")
    return original, novo


def main():
    verificar = "--check" in sys.argv
    lista = regras(frases_dos_conceitos())
    rx, quem, codigo = compilar(lista)
    paginas = [os.path.join(RAIZ, "README.md")] + sorted(glob.glob(os.path.join(DOCS, "*.md")))
    paginas += sorted(glob.glob(os.path.join(RAIZ, "transport-*", "README.md")))
    mudariam = []
    for caminho in paginas:
        antes, depois = processar(caminho, lista, rx, quem, codigo)
        if depois != antes:
            mudariam.append(os.path.relpath(caminho, RAIZ))
            if not verificar:
                with open(caminho, "w", encoding="utf-8", newline="") as fh:
                    fh.write(depois)
    for p in mudariam:
        print(f"{'DESACTUALIZADA' if verificar else 'ESCRITA'} {p}")
    if verificar and mudariam:
        print("Correr: python .github/scripts/docs-termos.py")
        sys.exit(1)
    print(f"{len(paginas)} páginas, {len(mudariam)} {'por actualizar' if verificar else 'escritas'}")


if __name__ == "__main__":
    main()
