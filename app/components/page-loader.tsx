import { Loader2Icon } from 'lucide-react';

/** Shown while we cannot yet tell whether the user is logged in (first render in the browser). */
export function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center" aria-busy="true">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
    </div>
  );
}
