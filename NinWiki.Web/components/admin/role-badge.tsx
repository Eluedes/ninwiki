'use client';

// Selo colorido do cargo (S.Adm / Adm / Creator) - usado no header, na tela
// de Equipe e no log. Cores fixas por cargo pra' a pessoa reconhecer de relance.

import { Crown, Shield, PenLine } from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import { cn } from '@/lib/utils';
import type { StaffRole } from '@/lib/api-client';

const STYLE: Record<StaffRole, { className: string; icon: typeof Crown }> = {
  super_admin: { className: 'bg-amber-900/30 text-amber-400', icon: Crown },
  admin: { className: 'bg-red-900/30 text-red-400', icon: Shield },
  creator: { className: 'bg-emerald-900/30 text-emerald-400', icon: PenLine },
};

export function RoleBadge({ role, className }: { role: string; className?: string }) {
  const { dict } = useLanguage();
  const known = role in STYLE;
  const style = known ? STYLE[role as StaffRole] : { className: 'bg-secondary text-muted-foreground', icon: Shield };
  const label: Record<string, string> = {
    super_admin: dict.admin.auth.roleSuperAdmin,
    admin: dict.admin.auth.roleAdmin,
    creator: dict.admin.auth.roleCreator,
  };
  const Icon = style.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold', style.className, className)}>
      <Icon className="h-3 w-3" />
      {label[role] ?? role}
    </span>
  );
}
