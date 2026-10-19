'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { STATUS_LABELS, type JobInput, type JobStatus } from '@/lib/jobs';
import {
  centsToDollarInput,
  dollarInputToCents,
  DOLLAR_INPUT_PATTERN,
  MAX_COST_CENTS,
} from '@/lib/money';

// The form works in dollars as typed; the schema's output is what the API takes (cents).
const jobFormSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Describe the job')
    .max(2000, 'Keep it under 2,000 characters'),
  address: z.string().trim().min(1, 'Enter the address').max(500, 'Keep it under 500 characters'),
  cost: z
    .string()
    .trim()
    .regex(DOLLAR_INPUT_PATTERN, 'Enter an amount like 1500 or 1,500.50')
    .transform(dollarInputToCents)
    .refine((cents) => cents <= MAX_COST_CENTS, 'That amount is too large'),
  status: z.enum(['PLANNING', 'IN_PROGRESS', 'COMPLETED', 'CANCELED']),
});
type JobFormInput = z.input<typeof jobFormSchema>;
type JobFormOutput = z.output<typeof jobFormSchema>;

type JobFormProps = {
  /** The job being edited; omit to create a new one. */
  initial?: JobInput & { status: JobStatus };
  /** Statuses to offer. Leave empty to hide the field (new jobs start in planning). */
  statusOptions?: JobStatus[];
  submitLabel: string;
  pending: boolean;
  onSubmit: (values: Required<JobInput>) => void;
  onCancel?: () => void;
};

export function JobForm({
  initial,
  statusOptions = [],
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: JobFormProps) {
  const form = useForm<JobFormInput, unknown, JobFormOutput>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      description: initial?.description ?? '',
      address: initial?.address ?? '',
      cost: initial ? centsToDollarInput(initial.costCents) : '',
      status: initial?.status ?? 'PLANNING',
    },
  });
  const { errors } = form.formState;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(({ cost, ...values }) =>
        onSubmit({ ...values, costCents: cost }),
      )}
    >
      <FieldGroup>
        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Textarea
            id="description"
            rows={3}
            aria-invalid={!!errors.description}
            {...form.register('description')}
          />
          <FieldError errors={[errors.description]} />
        </Field>
        <Field data-invalid={!!errors.address}>
          <FieldLabel htmlFor="address">Address</FieldLabel>
          <Input id="address" aria-invalid={!!errors.address} {...form.register('address')} />
          <FieldError errors={[errors.address]} />
        </Field>
        <Field data-invalid={!!errors.cost}>
          <FieldLabel htmlFor="cost">Cost (USD)</FieldLabel>
          <Input
            id="cost"
            inputMode="decimal"
            placeholder="1,500.00"
            aria-invalid={!!errors.cost}
            {...form.register('cost')}
          />
          <FieldError errors={[errors.cost]} />
        </Field>
        {statusOptions.length > 1 && (
          <Field>
            <FieldLabel htmlFor="status">Status</FieldLabel>
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldDescription>Only the moves the workflow allows are listed.</FieldDescription>
          </Field>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : submitLabel}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
          )}
        </div>
      </FieldGroup>
    </form>
  );
}
