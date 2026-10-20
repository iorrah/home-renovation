'use client';

import { useQueryClient } from '@tanstack/react-query';
import { LogOutIcon } from 'lucide-react';
import Link from 'next/link';
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
        <Link href="/jobs" className="font-semibold whitespace-nowrap flex items-center gap-2">
          Home Renovation{' '}
          <span className="bg-gray-100 p-1 text-[10px] font-semibold rounded-md">
            {ROLE_LABELS[user.role]}
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm sm:inline font-semibold capitalize">{user.username}</span>

          <Button variant="outline" size="sm" onClick={logout}>
            <LogOutIcon />
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
