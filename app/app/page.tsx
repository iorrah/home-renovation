'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PageLoader } from '@/components/page-loader';
import { useSession } from '@/lib/session';

/** The entry point: straight to the jobs when logged in, otherwise to the login page. */
export default function Home() {
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session !== undefined) router.replace(session ? '/jobs' : '/login');
  }, [session, router]);

  return <PageLoader />;
}
