'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ClipboardPaste, HardHat, House, type LucideIcon } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { graphql } from '@/lib/api';
import { safeNextPath } from '@/lib/redirect';
import { saveSession, useSession, type Session } from '@/lib/session';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Enter your username'),
  password: z.string().min(1, 'Enter your password'),
});
type LoginValues = z.infer<typeof loginSchema>;

const LOGIN = `
  mutation Login($input: LoginInput!) {
    login(input: $input) { accessToken user { id username role } }
  }`;

type DemoAccount = {
  username: string;
  password: string;
  role: 'Contractor' | 'Homeowner';
  icon: LucideIcon;
};

const DEMO_PASSWORD = 'password123';

const DEMO_ACCOUNTS: DemoAccount[] = [
  { username: 'carlos', password: DEMO_PASSWORD, role: 'Contractor', icon: HardHat },
  { username: 'diana', password: DEMO_PASSWORD, role: 'Contractor', icon: HardHat },
  { username: 'hannah', password: DEMO_PASSWORD, role: 'Homeowner', icon: House },
  { username: 'henry', password: DEMO_PASSWORD, role: 'Homeowner', icon: House },
  { username: 'hugo', password: DEMO_PASSWORD, role: 'Homeowner', icon: House },
];

export function LoginForm() {
  const router = useRouter();
  const nextPath = safeNextPath(useSearchParams().get('next'));
  const session = useSession();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const login = useMutation({
    mutationFn: (values: LoginValues) => graphql<{ login: Session }>(LOGIN, { input: values }),
    onSuccess: ({ login: newSession }) => saveSession(newSession),
    onError: (error) => form.setError('root', { message: error.message }),
  });

  // Already logged in (or just logged in): go to the app.
  useEffect(() => {
    if (session) router.replace(nextPath);
  }, [session, nextPath, router]);

  const fillDemoAccount = (account: DemoAccount) => {
    form.clearErrors();
    form.setValue('username', account.username, { shouldValidate: true });
    form.setValue('password', account.password, { shouldValidate: true });
  };

  const { errors } = form.formState;

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <Card className="w-full py-12 px-8">
        <CardHeader>
          <CardTitle className="text-xl text-center font-bold">Home Renovation</CardTitle>
          <CardDescription className="text-center mb-8">Sign in to see your jobs</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit((values) => login.mutate(values))} noValidate>
            <FieldGroup>
              <Field data-invalid={!!errors.username}>
                <FieldLabel htmlFor="username">Username</FieldLabel>
                <Input
                  id="username"
                  autoComplete="username"
                  autoFocus
                  aria-invalid={!!errors.username}
                  className="h-12"
                  {...form.register('username')}
                />
                <FieldError errors={[errors.username]} />
              </Field>
              <Field data-invalid={!!errors.password}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  className="h-12"
                  {...form.register('password')}
                />
                <FieldError errors={[errors.password]} />
              </Field>
              <FieldError errors={[errors.root]} />
              <Button type="submit" className="w-full h-12" disabled={login.isPending}>
                {login.isPending ? 'Signing in…' : 'Sign in'}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Card className="w-full py-6 px-4 gap-3">
        <CardHeader className="px-2">
          <CardTitle className="text-sm font-semibold">Demo accounts</CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          <ul className="flex flex-col divide-y">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.username} className="flex items-center gap-2 py-2">
                <span className="text-sm font-medium">{account.username}</span>
                <span className="text-xs text-muted-foreground">{account.role}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="ml-auto size-7"
                  onClick={() => fillDemoAccount(account)}
                  aria-label={`Fill login form with ${account.username}`}
                  title={`Fill login form with ${account.username}`}
                >
                  <ClipboardPaste className="size-3.5" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
