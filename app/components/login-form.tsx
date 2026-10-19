'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
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

  const { errors } = form.formState;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Home Renovation</CardTitle>
        <CardDescription>Sign in to see your renovation jobs.</CardDescription>
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
                {...form.register('password')}
              />
              <FieldError errors={[errors.password]} />
            </Field>
            <FieldError errors={[errors.root]} />
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </FieldGroup>
        </form>
        <p className="mt-6 text-xs text-muted-foreground">
          Demo accounts (password <code>password123</code>): contractors <code>carlos</code>,{' '}
          <code>diana</code>; homeowners <code>hannah</code>, <code>henry</code>, <code>hugo</code>.
        </p>
      </CardContent>
    </Card>
  );
}
