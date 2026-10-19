'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppHeader } from '@/components/app-header';
import { PageLoader } from '@/components/page-loader';
import { useSession } from '@/lib/session';

/**
 * Every page in this (app) group requires login. The token lives in localStorage, which only the
 * browser can read, so the check happens here on the client: logged-out visitors are sent to
 * /login, with ?next= so they come back to the page they asked for. The API enforces access on
 * every request anyway; this guard is about not showing an empty, broken page.
 */
export default function AuthenticatedLayout({ children }: LayoutProps<'/'>) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (session === null) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [session, pathname, router]);

  if (!session) return <PageLoader />;

  return (
    <>
      <AppHeader user={session.user} />
      <main className="mx-auto w-full max-w-6xl flex-1 p-4">{children}</main>
    </>
  );
}
