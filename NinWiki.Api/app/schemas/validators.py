"""
Validadores Pydantic compartilhados entre schemas diferentes (content.py,
masteries.py, e qualquer schema futuro que tenha campo de texto rico
editado pelo Tiptap). Extraido pra' arquivo proprio pra' nao duplicar a
mesma logica de seguranca em cada schema - um lugar so' pra manter.
"""
import json


def validate_rich_content(value: str | None) -> str | None:
    """
    Valida o que o editor Tiptap (components/admin/rich-text-editor.tsx
    no front) manda pra' um campo de texto rico, ANTES de aceitar salvar -
    nunca confiar cegamente no que o navegador enviou, mesmo sendo o
    nosso proprio editor (alguem pode bater direto na API sem passar
    pela UI).

    Regras:
    - string vazia ou None: ok, campo opcional.
    - comeca com "{": precisa ser JSON valido com "type": "doc" (o
      formato que o Tiptap gera) - rejeita qualquer outra coisa.
    - nao comeca com "{": trata como texto simples (retrocompatibilidade
      com entries criadas antes deste editor existir) - mas rejeita
      se tiver uma tag <script, uma defesa a mais contra HTML cru
      sendo empurrado direto pela API, ignorando o editor.
    """
    if not value:
        return value
    stripped = value.strip()
    if stripped.startswith("{"):
        try:
            parsed = json.loads(stripped)
        except json.JSONDecodeError:
            raise ValueError("Conteúdo rico inválido: não é um JSON válido")
        if not isinstance(parsed, dict) or parsed.get("type") != "doc":
            raise ValueError("Conteúdo rico inválido: esperado um documento Tiptap (\"type\": \"doc\")")
        return value
    if "<script" in stripped.lower():
        raise ValueError("Conteúdo não pode conter tags <script>")
    return value
