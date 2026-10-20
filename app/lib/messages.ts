'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { graphql } from './api';
import { getRealtimeClient, isRealtimeConnected } from './realtime';
import type { User } from './types';

export type Message = {
  id: string;
  jobId: string;
  body: string;
  createdAt: string;
  author: User;
};

const MESSAGE_FIELDS = 'id jobId body createdAt author { id username role }';
export const PAGE_SIZE = 50;

export const messageKeys = {
  forJob: (jobId: string) => ['jobs', jobId, 'messages'] as const,
};

/** The latest messages, oldest first. */
export function useMessages(jobId: string) {
  return useQuery({
    queryKey: messageKeys.forJob(jobId),
    queryFn: async () =>
      (
        await graphql<{ messages: Message[] }>(
          `query ($jobId: ID!, $limit: Int) { messages(jobId: $jobId, limit: $limit) { ${MESSAGE_FIELDS} } }`,
          { jobId, limit: PAGE_SIZE },
        )
      ).messages,
  });
}

/**
 * Adds messages to the cached list. A message can arrive twice (the response to sending it and
 * the live event, or the live event and a catch-up fetch), so duplicates are dropped by id.
 */
function addMessages(queryClient: QueryClient, jobId: string, incoming: Message[]) {
  queryClient.setQueryData<Message[]>(messageKeys.forJob(jobId), (current = []) => {
    const known = new Set(current.map((message) => message.id));
    const fresh = incoming.filter((message) => !known.has(message.id));
    return fresh.length ? [...current, ...fresh] : current;
  });
}

export function useSendMessage(jobId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) =>
      (
        await graphql<{ sendMessage: Message }>(
          `mutation ($input: SendMessageInput!) { sendMessage(input: $input) { ${MESSAGE_FIELDS} } }`,
          { input: { jobId, body } },
        )
      ).sendMessage,
    onSuccess: (message) => addMessages(queryClient, jobId, [message]),
  });
}

/**
 * Listens for new messages on the job over the WebSocket. Live events are not stored anywhere,
 * so each time the connection (re)opens, whatever was sent while it was down is fetched with
 * `after` (the newest message we have). Returns whether the live connection is up.
 */
export function useLiveMessages(jobId: string): boolean {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(isRealtimeConnected);

  useEffect(() => {
    const client = getRealtimeClient();

    async function catchUp() {
      const cached = queryClient.getQueryData<Message[]>(messageKeys.forJob(jobId));
      const after = cached?.at(-1)?.id;
      if (!after) return;
      const { messages } = await graphql<{ messages: Message[] }>(
        `query ($jobId: ID!, $after: ID) { messages(jobId: $jobId, after: $after, limit: 200) { ${MESSAGE_FIELDS} } }`,
        { jobId, after },
      );
      addMessages(queryClient, jobId, messages);
    }

    const stopConnected = client.on('connected', () => {
      setConnected(true);
      void catchUp();
    });
    const stopClosed = client.on('closed', () => setConnected(false));

    const unsubscribe = client.subscribe<{ messageAdded: Message }>(
      {
        query: `subscription ($jobId: ID!) { messageAdded(jobId: $jobId) { ${MESSAGE_FIELDS} } }`,
        variables: { jobId },
      },
      {
        next: ({ data }) => data && addMessages(queryClient, jobId, [data.messageAdded]),
        error: () => setConnected(false),
        complete: () => {},
      },
    );

    return () => {
      unsubscribe();
      stopConnected();
      stopClosed();
    };
  }, [jobId, queryClient]);

  return connected;
}
