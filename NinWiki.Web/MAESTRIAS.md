> **⚠️ OBSOLETO (30/10/2026) — Nin Codex (antes NinWiki).** Este documento vem da época em que o conteúdo ficava em arquivos (`lib/masteries-data.ts`, `lib/data.ts`,
> `lib/village-data.ts`). **Hoje todo o conteúdo mora no banco e é editado pelo painel (`/admin`)**; nenhuma página do site lê esses arquivos
> (só o script de seed `scripts/export-seed-data.ts`, que gera um banco de teste vazio). Não edite os arquivos de `lib/*-data.ts` para mudar o
> site. Os caminhos (`pathId`) de hoje são cadastrados no painel, em **Masteries** e **Jutsus**; os valores desta tabela continuam sendo os ids dos caminhos. Documentação atual:
> `README.md` e `ROADMAP.md` na raiz.

# Caminhos de Mastery

Cinco masteries possuem caminhos confirmados na wiki:

- **Vento:** Elemental desarmado e Arma: Fan-Leque.
- **Água:** Elemental desarmado e Arma: Pipe-Cachimbo.
- **Taijutsu:** Agilidade: padrão e Força: Punho Gentil GF. O segundo requer a ativação de Punho Gentil GF.
- **Médica:** Intelecto: dano mágico e Chakra: dano e suporte. A cura de suporte escala com Chakra.
- **Arma:** Intelecto: arremessos à distância e Força: arma corpo a corpo.

## Como classificar um jutsu

Em `lib/masteries-data.ts`, todo jutsu pertencente a uma mastery com caminhos deve ter `pathId`:

```ts
{
  id: 'exemplo',
  masteryId: 'weapon',
  // demais campos...
  pathId: 'weapon-intellect-thrown',
}
```

Use apenas um dos valores de `MasteryPathId`. Os helpers `jutsusByMasteryPath` e `masteryPathById` mantêm a página da mastery e a ficha do jutsu sincronizadas.

Jutsus sem `pathId` não são exibidos dentro dos caminhos. Quando o painel administrativo for implementado, esse campo deverá ser obrigatório sempre que a mastery selecionada possuir caminhos.

### Valores dos caminhos

| Mastery | Caminho 1 | Caminho 2 |
|---|---|---|
| Vento | `wind-elemental-unarmed` | `wind-fan-leque` |
| Água | `water-elemental-unarmed` | `water-pipe-cachimbo` |
| Taijutsu | `taijutsu-agility` | `taijutsu-strength-gf` |
| Médica | `medical-intellect-magical` | `medical-chakra-support` |
| Arma | `weapon-intellect-thrown` | `weapon-strength-melee` |

Por exemplo, um jutsu de Vento que use Fan-Leque recebe:

```ts
pathId: 'wind-fan-leque',
```

Depois de salvar, ele aparece apenas no card **Arma: Fan-Leque**. Para trocar o caminho, substitua o valor de `pathId` por outro valor válido da mesma mastery.

## Como cadastrar o GIF de um jutsu

Coloque o arquivo em `public/images/jutsus/` e adicione o caminho no mesmo registro:

```ts
{
  id: 'fuuton-renkuudan',
  masteryId: 'wind',
  pathId: 'wind-elemental-unarmed',
  gif: '/images/jutsus/fuuton-renkuudan.gif',
  // demais campos...
}
```

O GIF aparece no card do jutsu e na página de detalhe. Se `gif` ficar ausente, a interface mostra apenas os dados textuais normalmente.