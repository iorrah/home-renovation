// Entry point of the worker process. It has no HTTP server: it only takes tasks off the queue.
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker/worker.module.js';

const app = await NestFactory.createApplicationContext(WorkerModule);
// Lets BullMQ finish the current task and close cleanly on Ctrl+C or a container stop.
app.enableShutdownHooks();
