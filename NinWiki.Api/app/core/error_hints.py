"""
Explicacoes EM PORTUGUES para os problemas do registro de erros: "o que isso significa e o que fazer".

Quem le' o painel (/admin/errors) e o canal de erros do Discord muitas vezes ve' so' o nome tecnico em ingles
(ex.: "Rate limit exceeded", "IntegrityError"). `explain_pt` devolve uma frase curta dizendo a causa mais provavel e o
proximo passo. Sao DICAS (o sistema nao tem como saber a causa real): por isso o texto fala em "provavelmente".
Nao le' nem grava nada: recebe os campos do problema e devolve texto (facil de testar).
"""

# (trecho do titulo em minusculas, explicacao) - vale a primeira regra que casar
_BY_TITLE: list[tuple[str, str]] = [
    ("chunkloaderror", "O navegador abriu uma página ANTIGA do site (aberta antes de um deploy) e tentou baixar um arquivo de código que já foi "
     "trocado pela versão nova. Não é bug: acontece logo depois de cada deploy/reinício do Web. O site já recarrega sozinho uma vez; se o aviso "
     "continuar muito tempo depois do deploy, confira se os arquivos .next foram enviados por completo para o app Web."),
    ("rate limit exceeded", "Alguém (um IP) mandou pedidos demais num minuto e a API respondeu 429 para segurar. Se foi você enviando muitas "
     "imagens, copiando conteúdo ou usando o painel rapido demais, é normal e nada foi perdido: o que foi barrado pode ser reenviado. Se o IP é desconhecido "
     "e as ocorrencias não param, pode ser robô/flood: bloqueie o IP na Cloudflare. O limite pode ser ajustado nas variáveis da API "
     "(WRITE_REQUESTS_PER_MINUTE, PUBLIC_REQUESTS_PER_MINUTE...)."),
    ("integrityerror", "O banco recusou salvar porque quebraria uma regra (ex.: slug repetido, item ligado a algo que não existe). Provavelmente alguém tentou "
     "criar algo duplicado ou apagar algo que ainda é usado. Confira os dados da rota indicada."),
    ("connectionrefused", "A API não conseguiu falar com um serviço (banco ou outro). Provavelmente ele estava desligado, reiniciando ou com a "
     "DATABASE_URL errada. Veja se o banco está no ar e as variáveis de ambiente da API."),
    ("operationalerror", "Falha de conexão com o banco de dados. Provavelmente instabilidade/reinicio do banco ou certificado/URL de conexão inválidos. "
     "Veja o painel do banco e as variáveis DATABASE_URL e DATABASE_SSL_*."),
    ("timeout", "Algo demorou demais para responder (banco, DeepL ou outro serviço). Se foi pontual, ignore; se se repete, o serviço externo "
     "pode estar lento ou fora do ar."),
    ("validationerror", "Chegou um dado fora do formato esperado (campo faltando ou invalido). Costuma ser uma tela enviando dado errado ou alguem "
     "testando a API. Veja a rota indicada."),
    ("deepl", "A tradução automática (DeepL) falhou. Provavelmente a chave DEEPL_API_KEY está errada/vencida ou a cota gratuita do mes acabou. "
     "O conteúdo continua funcionando em inglês; confira a chave e o uso na conta da DeepL."),
    ("filenotfound", "A API procurou um arquivo que não existe (imagem apagada, pasta de uploads vazia ou certificado ausente). Confira o caminho no "
     "local indicado e se as imagens foram enviadas ao app."),
    ("permissionerror", "A API não tem permissão para ler/gravar um arquivo ou pasta. Veja as permissões da pasta indicada no app."),
    ("keyerror", "O código esperava um dado que não veio (variável de ambiente ou campo ausente). Veja o local indicado."),
]

_BY_SOURCE: dict[str, str] = {
    "web": "O site (navegador do visitante) mostrou um erro de tela. Provavelmente um bug de interface ou a API fora do ar naquele momento. "
           "Abra a página indicada e tente repetir; se ocorrer sempre, é bug a corrigir.",
    "deepl": "A tradução automática falhou; o conteúdo segue em inglês. Confira a DEEPL_API_KEY e a cota da DeepL.",
    "security": "Aviso de segurança: comportamento incomum (muitos pedidos, tentativa barrada). Se foi você, ignore; se não, observe o IP e considere "
                "bloqueá-lo na Cloudflare.",
}


def explain_pt(source: str, title: str, message: str = "", status: int | None = None, location: str | None = None) -> str:
    """Frase em portugues com a causa provavel e o que fazer. Sempre devolve algo (cai numa explicacao generica)."""
    haystack = f"{title} {message}".lower()
    for needle, text in _BY_TITLE:
        if needle in haystack:
            return text
    if status is not None:
        if status == 429:
            return _BY_TITLE[0][1]
        if status in (401, 403):
            return "Acesso negado: login vencido ou alguém sem permissão tentou usar o recurso. Se foi você, entre de novo."
        if status == 404:
            return "Algo foi pedido e não existe (link antigo, item apagado ou tentativa de varredura). Se acontece muito na mesma rota, vale conferir o link."
        if status >= 500:
            return ("A API falhou ao processar um pedido (erro interno). Provavelmente é bug ou falha de um serviço por trás (banco/DeepL). "
                    "Abra o problema no painel: o traceback mostra a linha exata" + (f" ({location})." if location else "."))
    return _BY_SOURCE.get(source, "Problema interno registrado pela API. Abra o problema no painel (/admin/errors) para ver o traceback e a rota afetada.")
