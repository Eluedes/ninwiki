# NinWiki — instruções para o Claude Code (lido automaticamente ao abrir esta pasta)

@CONTEXTO_PARA_IA.md

## Quem é o dono do projeto e como conversar
- O dono fala **português do Brasil** e usa **Windows/PowerShell**: explique em português, passo a passo, sem jargão; diga **em qual pasta** rodar cada comando.
- Seja honesto: se algo não foi testado (ex.: tela não aberta no navegador, Discord/SquareCloud/Steam inacessíveis), diga.
- Site e painel são **inglês primeiro** com dicionário PT (`NinWiki.Web/lib/i18n.ts`, sempre os dois idiomas).
- **Comente todo código novo** (docstring/comentário em português, no mesmo estilo dos arquivos vizinhos).

## Estrutura e comandos (na pasta indicada)
- `NinWiki.Api` (FastAPI + Alembic + PostgreSQL), `NinWiki.Web` (Next.js), `NinWiki.Bot` (discord.py), `Cloudflare`, `Guima.Site`.
- Testes da API (banco **local** ligado e migrado): `py scripts/testar_permissoes.py` e `py scripts/testar_bot_integracao.py` (em `NinWiki.Api`). Saúde geral: `py scripts/verificar_projeto.py`. **README em dia:** `py scripts/verificar_readme.py` (`--corrigir` regera a tabela de permissões).
- Site (em `NinWiki.Web`): `npx tsc --noEmit` e `npx eslint app components lib`; `npx next build` para o build.
- Bot e testes só rodam com `NinWiki.Api` no `PYTHONPATH` (`$env:PYTHONPATH="."` no PowerShell).

## Regras que já custaram caro
1. **Nunca aponte testes nem o ambiente local para o banco da SquareCloud** (os scripts de teste recusam banco não-local; o ambiente local grava no que está no ar). Use banco local.
2. **README sempre atualizado na mesma entrega** de qualquer recurso/regra/comando/permissão/variável nova. Antes de terminar: rode `py scripts/verificar_readme.py` (e `--corrigir` se só a tabela de permissões divergir).
3. **Permissão nova** = enum em `app/core/permissions.py` + papéis padrão + rótulos PT/EN em `lib/i18n.ts` + tipo `PermissionName` em `lib/api-client.ts` + `lib/admin-routes.ts` (se for tela) + teste em `testar_permissoes.py`.
4. **Campo/tabela nova no banco** = model → schemas → **migração Alembic revisada** (uma só head; rótulos de enum em MAIÚSCULAS) → tipos do front → formulário → tela pública. Nunca editar migração já aplicada.
5. Trocar um enum/valor exige migração; avisar o dono que o **Deploy API** roda as migrações e que o **bot precisa ser reiniciado** quando muda.
6. Regra de rota pública nova: entrar em `ROTAS_PUBLICAS` de `testar_permissoes.py` (o teste "nenhuma rota escapa" falha se faltar) e ter limite de uso/origem como `app/api/reports.py`.
7. Branch de trabalho do dono: a que ele indicar (ex.: `claude/sweet-edison-d5di2d`); **não abrir PR sem ele pedir**.
8. Ao terminar: commit com mensagem clara em português; testes + `tsc` + `eslint` + `verificar_readme.py` passando.
