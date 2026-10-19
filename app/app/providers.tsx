'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '@/lib/api';

export function Providers({ children }: { children: React.ReactNode }) {
  // One client per browser tab, created once (useState keeps it across re-renders).
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Retrying cannot fix an API answer such as NOT_FOUND; only retry network failures.
            retry: (failures, error) =>
              failures < 2 && (!(error instanceof ApiError) || error.code === 'NETWORK_ERROR'),
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
