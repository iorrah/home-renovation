import { ParseUUIDPipe } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { SendMessageInput } from './dto/send-message.input.js';
import { Message } from './message.entity.js';
import { MessageModel } from './message.model.js';
import { MAX_MESSAGE_PAGE, MessagesService } from './messages.service.js';

const uuid = new ParseUUIDPipe();
const optionalUuid = new ParseUUIDPipe({ optional: true });

@Resolver(() => MessageModel)
export class MessagesResolver {
  constructor(private readonly messagesService: MessagesService) {}

  @Query(() => [MessageModel], {
    description: `Oldest first. Pass "after" to get only newer messages. Max ${MAX_MESSAGE_PAGE} per page.`,
  })
  messages(
    @CurrentUser() user: AuthUser,
    @Args('jobId', { type: () => ID }, uuid) jobId: string,
    @Args('after', { type: () => ID, nullable: true }, optionalUuid) after?: string,
    @Args('limit', { type: () => Int, defaultValue: 50 }) limit = 50,
  ): Promise<Message[]> {
    return this.messagesService.list(user, jobId, { after, limit });
  }

  @Mutation(() => MessageModel)
  sendMessage(
    @CurrentUser() user: AuthUser,
    @Args('input') input: SendMessageInput,
  ): Promise<Message> {
    return this.messagesService.send(user, input.jobId, input.body);
  }

  @Subscription(() => MessageModel, {
    description:
      'New messages on a job, as they are sent. Connect over WebSocket (graphql-transport-ws) ' +
      'with { authorization: "Bearer <token>" } in connectionParams.',
    // The published event already has the Message shape, so it is returned as it is.
    resolve: (message: MessageModel) => message,
  })
  messageAdded(
    @CurrentUser() user: AuthUser,
    @Args('jobId', { type: () => ID }, uuid) jobId: string,
  ): Promise<AsyncIterableIterator<MessageModel>> {
    return this.messagesService.subscribe(user, jobId);
  }
}
