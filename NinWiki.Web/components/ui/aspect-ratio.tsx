// components/ui/aspect-ratio.tsx
// Wrapper fino do Radix UI AspectRatio: mantem uma proporcao fixa (ex: 16:9)
// para o conteudo dentro dele, util para imagens/videos responsivos.

'use client';

import * as AspectRatioPrimitive from '@radix-ui/react-aspect-ratio';

const AspectRatio = AspectRatioPrimitive.Root;

export { AspectRatio };
