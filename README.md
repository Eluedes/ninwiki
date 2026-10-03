# Ferramentas locais (fora do NinWiki)

> **Esta branch NÃO é para merge.** Ela não tem relação com o histórico do wiki (`main`) e nunca vai para produção.
> Guarda só utilitários que você roda **no seu computador**, que não fazem parte do site, da API, do bot nem do deploy.

## Como usar
```
git fetch origin ferramentas-locais
git switch ferramentas-locais      # ou: git worktree add ../ferramentas origin/ferramentas-locais
```

## Ferramentas
| Pasta | O que faz |
|---|---|
| `analise-de-arquivos/analisar_arquivo_cifrado.py` | Imprime a **estrutura** de arquivos desconhecidos (ex.: `.znin`, `.wmr`): tamanho, entropia, primeiros/últimos bytes, assinaturas conhecidas, palpite de XOR. Não decifra nada e não imprime o conteúdo. Só Python 3. |

## Regras desta branch
- Nunca faça PR/merge desta branch na `main`.
- Não coloque aqui arquivos do jogo, chaves, tokens nem `.env`.
- Cada ferramenta nova entra em sua própria pasta, com um resumo no topo do script.
