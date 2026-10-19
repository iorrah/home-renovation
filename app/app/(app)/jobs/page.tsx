'use client';

import { useQuery } from '@tanstack/react-query';
import { graphql } from '@/lib/api';
import type { User } from '@/lib/types';

// Placeholder until the jobs list arrives in the next step. Asking for `me` also proves the
// stored token is still accepted by the API.
export default function JobsPage() {
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => graphql<{ me: User }>('{ me { id username role } }'),
  });

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Jobs</h1>
      <p className="text-muted-foreground">
        {me.data
          ? `Signed in as ${me.data.me.username}. Jobs arrive in the next step.`
          : 'Loading…'}
      </p>
    </div>
  );
}
