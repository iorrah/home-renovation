'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { MessageSquareIcon, SendIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '@/lib/format';
import {
  PAGE_SIZE,
  useLiveMessages,
  useMessages,
  useSendMessage,
  type Message,
} from '@/lib/messages';
import { useCurrentUser } from '@/lib/session';
import { ROLE_LABELS } from '@/lib/types';
import { cn } from '@/lib/utils';

const messageSchema = z.object({
  body: z.string().trim().min(1).max(5000, 'Keep messages under 5,000 characters'),
});
type MessageValues = z.infer<typeof messageSchema>;

export function ChatCard({ jobId }: { jobId: string }) {
  const user = useCurrentUser();
  const messages = useMessages(jobId);
  const sendMessage = useSendMessage(jobId);
  const live = useLiveMessages(jobId);
  const bottomRef = useRef<HTMLDivElement>(null);

  const form = useForm<MessageValues>({
    resolver: zodResolver(messageSchema),
    defaultValues: { body: '' },
  });

  // Keep the newest message in view as messages arrive.
  const count = messages.data?.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [count]);

  const send = form.handleSubmit(({ body }) =>
    sendMessage.mutate(body, {
      onSuccess: () => form.reset(),
      onError: (error) => toast.error(error.message),
    }),
  );

  return (
    <Card className="lg:sticky lg:top-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquareIcon className="size-5" /> Messages
        </CardTitle>
        <CardAction>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={cn(
                'size-2 rounded-full',
                live ? 'bg-emerald-500' : 'bg-muted-foreground/40',
              )}
            />
            {live ? 'Live' : 'Connecting…'}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-[28rem] space-y-3 overflow-y-auto rounded-lg border bg-muted/30 p-3">
          {messages.isPending && <Skeleton className="h-16" />}
          {messages.isError && <p className="text-sm text-destructive">{messages.error.message}</p>}
          {count === PAGE_SIZE && (
            <p className="text-center text-xs text-muted-foreground">
              Showing the latest {PAGE_SIZE} messages.
            </p>
          )}
          {count === 0 && messages.isSuccess && (
            <p className="text-center text-sm text-muted-foreground">No messages yet. Say hello.</p>
          )}
          {messages.data?.map((message) => (
            <ChatMessage key={message.id} message={message} mine={message.author.id === user.id} />
          ))}
          <div ref={bottomRef} />
        </div>

        <form noValidate onSubmit={send} className="flex items-end gap-2">
          <Textarea
            rows={2}
            placeholder="Write a message… (Enter to send, Shift+Enter for a new line)"
            aria-label="Message"
            className="min-h-0 resize-none"
            {...form.register('body')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <Button type="submit" size="icon" aria-label="Send" disabled={sendMessage.isPending}>
            <SendIcon />
          </Button>
        </form>
        {/* An empty box just does not send, like any chat app; only "too long" needs explaining. */}
        {form.formState.errors.body?.type === 'too_big' && (
          <p className="text-sm text-destructive">{form.formState.errors.body.message}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ChatMessage({ message, mine }: { message: Message; mine: boolean }) {
  return (
    <div className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
          mine ? 'bg-primary text-primary-foreground' : 'border bg-background',
        )}
      >
        {message.body}
      </div>
      <span className="mt-1 text-xs text-muted-foreground">
        {mine ? 'You' : `${message.author.username} (${ROLE_LABELS[message.author.role]})`} ·{' '}
        {formatDateTime(message.createdAt)}
      </span>
    </div>
  );
}
