'use client';

// Botao do header que alterna entre tema claro/escuro.

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  // "mounted" evita o problema classico de SSR com temas: no servidor,
  // o Next.js nao sabe qual e' o tema salvo no navegador do usuario,
  // entao renderizar o icone certo (sol/lua) direto no servidor
  // causaria um "hydration mismatch" (HTML do servidor diferente do
  // HTML que o React monta no cliente). A solucao e' renderizar um
  // placeholder vazio ate' o componente montar no cliente, e so' entao
  // mostrar o icone correto.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Esta atualização distingue deliberadamente o primeiro render do
    // servidor do cliente para impedir divergência de hidratação do tema.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    // placeholder do mesmo tamanho do botao real, para nao "pular"
    // o layout quando o icone aparecer um instante depois.
    return <div className="h-9 w-9" />;
  }

  const isDark = theme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Toggle theme"
      className="h-9 w-9"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
