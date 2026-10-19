import { Suspense } from 'react';
import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      {/* LoginForm reads ?next= from the URL, which Next.js requires inside a Suspense boundary. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
