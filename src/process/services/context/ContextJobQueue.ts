/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContextJob } from './contextDomain';

export class ContextJobQueue {
  private readonly jobs: ContextJob[] = [];

  enqueue(job: ContextJob): void {
    this.jobs.push(job);
  }

  dequeue(predicate?: (job: ContextJob) => boolean): ContextJob | undefined {
    if (this.jobs.length === 0) {
      return undefined;
    }

    const index = predicate ? this.jobs.findIndex(predicate) : 0;
    if (index < 0) {
      return undefined;
    }

    const [job] = this.jobs.splice(index, 1);
    return job;
  }

  hasJobs(predicate?: (job: ContextJob) => boolean): boolean {
    return predicate ? this.jobs.some(predicate) : this.jobs.length > 0;
  }

  list(): readonly ContextJob[] {
    return [...this.jobs];
  }

  clear(): void {
    this.jobs.length = 0;
  }
}
