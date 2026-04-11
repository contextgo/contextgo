/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContextJobQueue } from '../ContextJobQueue';
import type { ContextJob, ContextJobArtifact } from '../contextDomain';
import type { ContextEventBus } from '../events/ContextEventBus';

type JobHandler = {
  run(job: ContextJob): Promise<ContextJobArtifact | undefined>;
};

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export class ContextJobRunner {
  private running = false;

  constructor(
    private readonly queue: Pick<ContextJobQueue, 'dequeue' | 'hasJobs'>,
    private readonly eventBus: Pick<ContextEventBus, 'emit'>,
    private readonly sessionCompactionHandler: JobHandler,
    private readonly projectPromotionHandler: JobHandler,
    private readonly spaceMemoryDistillationHandler?: JobHandler,
    private readonly connectorDigestHandler?: JobHandler,
    private readonly sessionPatternDetectionHandler?: JobHandler
  ) {}

  async kick(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      let job = this.queue.dequeue(candidate => this.supports(candidate));
      while (job) {
        await this.runJob(job);
        job = this.queue.dequeue(candidate => this.supports(candidate));
      }
    } finally {
      this.running = false;
      if (this.queue.hasJobs(candidate => this.supports(candidate))) {
        void this.kick();
      }
    }
  }

  private supports(job: ContextJob): boolean {
    return (
      job.type === 'session_compaction' ||
      job.type === 'project_promotion' ||
      job.type === 'space_memory_distillation' ||
      job.type === 'connector_digest' ||
      job.type === 'session_pattern_detection'
    );
  }

  private resolveHandler(job: ContextJob): JobHandler | undefined {
    if (job.type === 'session_compaction') {
      return this.sessionCompactionHandler;
    }
    if (job.type === 'project_promotion') {
      return this.projectPromotionHandler;
    }
    if (job.type === 'space_memory_distillation') {
      return this.spaceMemoryDistillationHandler;
    }
    if (job.type === 'connector_digest') {
      return this.connectorDigestHandler;
    }
    if (job.type === 'session_pattern_detection') {
      return this.sessionPatternDetectionHandler ?? this.connectorDigestHandler;
    }
    return undefined;
  }

  private async runJob(job: ContextJob): Promise<void> {
    const handler = this.resolveHandler(job);
    if (!handler) {
      return;
    }

    const startedAt = new Date().toISOString();
    const runningJob: ContextJob = {
      ...job,
      status: 'running',
      startedAt: job.startedAt ?? startedAt,
    };

    await this.eventBus.emit('context.job.started', {
      job: runningJob,
      startedAt: runningJob.startedAt,
    });

    try {
      const artifact = await handler.run(runningJob);
      const completedAt = new Date().toISOString();
      await this.eventBus.emit('context.job.completed', {
        job: {
          ...runningJob,
          status: 'completed',
          completedAt,
        },
        status: 'completed',
        completedAt,
        artifact,
      });
    } catch (error) {
      const message = formatError(error);
      const completedAt = new Date().toISOString();
      await this.eventBus.emit('context.job.completed', {
        job: {
          ...runningJob,
          status: 'failed',
          completedAt,
          error: message,
        },
        status: 'failed',
        completedAt,
        error: message,
      });
      throw error;
    }
  }
}
