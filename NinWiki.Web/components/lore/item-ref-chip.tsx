'use client';

// Referencia a um item do wiki dentro das paginas de Proficiencia: miniatura + nome no idioma escolhido; vira link para a pagina do item quando ela
// existe e esta' publicada (o `slug` so' vem preenchido nesse caso). A imagem vem como caminho (/uploads/...): aqui entra o endereco da API.

import Link from 'next/link';
import { API_URL, type ItemRef } from '@/lib/api-client';
import { WikiImage } from '@/components/wiki/wiki-image';
import { useLanguage } from '@/components/providers/language-provider';
import { localizedName } from '@/lib/localized';

/** Endereco completo da imagem de um item (caminho vira API + caminho; endereco completo passa igual). */
export function itemImageUrl(src?: string | null): string | null {
  if (!src) return null;
  return src.startsWith('/') ? `${API_URL}${src}` : src;
}

/** Miniatura + nome do item (com link quando a pagina dele existe). `prefix` vai antes do nome (ex.: "3× "). */
export function ItemRefChip({ item, prefix }: { item: ItemRef; prefix?: string }) {
  const { locale } = useLanguage();
  const name = localizedName(locale, item.name, item.namePt);
  const body = (
    <>
      <WikiImage
        src={itemImageUrl(item.image)}
        alt=""
        fallback={<span className="text-[10px] font-bold text-muted-foreground">{name.charAt(0)}</span>}
        className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-secondary/60"
      />
      <span>{prefix}{name}</span>
    </>
  );
  return item.slug ? (
    <Link href={`/detail/${item.slug}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">{body}</Link>
  ) : (
    <span className="inline-flex items-center gap-1.5">{body}</span>
  );
}
