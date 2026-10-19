'use client';

import { useQueryClient } from '@tanstack/react-query';
import { LogOutIcon } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { closeRealtimeClient } from '@/lib/realtime';
import { clearSession } from '@/lib/session';
import { ROLE_LABELS, type User } from '@/lib/types';

export function AppHeader({ user }: { user: User }) {
  const queryClient = useQueryClient();

  function logout() {
    // Drop cached data too, so the next user to log in on this tab never sees it.
    queryClient.clear();
    closeRealtimeClient();
    clearSession(); // the route guard then redirects to /login
  }

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/jobs" className="font-semibold whitespace-nowrap">
          Home Renovation
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm sm:inline">{user.username}</span>
          <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOutIcon />
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
