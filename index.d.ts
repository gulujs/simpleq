export class SimpleQ<T = any, R = void> {
  concurrency: number;

  readonly running: number;
  readonly length: number;
  readonly paused: boolean;
  readonly idle: boolean;

  constructor(worker: (task: T) => R | Promise<R>, concurrency?: number);

  push(task: T): Promise<R>;
  unshift(task: T): Promise<R>;
  pause(): void;
  resume(): void;
  kill(): void;

  saturated(handler: () => any): void;
  saturated(): Promise<void>;
  empty(handler: () => any): void;
  empty(): Promise<void>;
  drain(handler: () => any): void;
  drain(): Promise<void>;

  error(handler: (err: Error, task: T) => any): void;
}
