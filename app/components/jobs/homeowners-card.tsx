'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlusIcon, XIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAddHomeowner, useRemoveHomeowner, type Job } from '@/lib/jobs';

const addHomeownerSchema = z.object({
  username: z.string().trim().min(1, 'Enter a homeowner’s username'),
});
type AddHomeownerValues = z.infer<typeof addHomeownerSchema>;

export function HomeownersCard({ job, canEdit }: { job: Job; canEdit: boolean }) {
  const addHomeowner = useAddHomeowner(job.id);
  const removeHomeowner = useRemoveHomeowner(job.id);
  const form = useForm<AddHomeownerValues>({
    resolver: zodResolver(addHomeownerSchema),
    defaultValues: { username: '' },
  });
  const { errors } = form.formState;

  function add({ username }: AddHomeownerValues) {
    addHomeowner.mutate(username, {
      onSuccess: () => {
        toast.success(`${username} added to the job`);
        form.reset();
      },
      // e.g. 'No homeowner with username "bob"': shown under the field it is about.
      onError: (error) => form.setError('username', { message: error.message }),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Homeowners</CardTitle>
        <CardDescription>
          {canEdit
            ? 'Homeowners can access the job, read its history and send messages.'
            : 'The homeowners on this job.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {job.homeowners.length === 0 ? (
          <p className="text-sm text-muted-foreground">No homeowners yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {job.homeowners.map((homeowner) => (
              <li
                key={homeowner.id}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                {homeowner.username}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${homeowner.username}`}
                    disabled={removeHomeowner.isPending}
                    onClick={() =>
                      removeHomeowner.mutate(homeowner.id, {
                        onSuccess: () => toast.success(`${homeowner.username} removed`),
                        onError: (error) => toast.error(error.message),
                      })
                    }
                  >
                    <XIcon />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <form noValidate onSubmit={form.handleSubmit(add)} className="flex items-start gap-2">
            <Field data-invalid={!!errors.username} className="flex-1">
              <Input
                placeholder="Homeowner username, e.g. henry"
                aria-label="Homeowner username"
                aria-invalid={!!errors.username}
                {...form.register('username')}
              />
              <FieldError errors={[errors.username]} />
            </Field>
            <Button type="submit" variant="outline" disabled={addHomeowner.isPending}>
              <UserPlusIcon /> Add
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
