// eslint-disable-next-line no-empty-function
const noop = () => {};

let nextTick;
if (typeof queueMicrotask === 'function') nextTick = queueMicrotask;
else if (typeof setImmediate === 'function') nextTick = setImmediate;
else if (typeof process === 'object' && process && typeof process.nextTick === 'function') nextTick = process.nextTick;
else nextTick = cb => setTimeout(cb, 0);

export class SimpleQ {
  get concurrency() {
    return this._concurrency;
  }

  set concurrency(value) {
    if (!(value > 0)) {
      throw new RangeError('concurrency must greater than zero');
    }
    this._concurrency = value;
  }

  get running() {
    return this._running;
  }

  get length() {
    return this._tasks.length;
  }

  get paused() {
    return this._paused;
  }

  get idle() {
    return this._running === 0 && this._tasks.length === 0;
  }

  constructor(worker, concurrency = 1) {
    this.worker = worker;
    this.concurrency = concurrency;

    this._tasks = [];
    this._running = 0;
    this._paused = false;
    this._saturated = noop;
    this._empty = noop;
    this._drain = noop;

    this._processingScheduled = false;
  }

  push(task) {
    return new Promise((resolve, reject) => {
      this._tasks.push({ task, resolve, reject });
      if (!this._processingScheduled) {
        this._processingScheduled = true;
        nextTick(() => {
          this._processingScheduled = false;
          this._startWork();
        });
      }
    });
  }

  unshift(task) {
    return new Promise((resolve, reject) => {
      this._tasks.unshift({ task, resolve, reject });
      if (!this._processingScheduled) {
        this._processingScheduled = true;
        nextTick(() => {
          this._processingScheduled = false;
          this._startWork();
        });
      }
    });
  }

  pause() {
    this._paused = true;
  }

  resume() {
    if (!this._paused) {
      return;
    }
    this._paused = false;
    this._startWork();
  }

  kill() {
    this._tasks = [];
    this._drain = noop;
  }

  saturated(handler) {
    return this._setHandler('saturated', handler);
  }

  empty(handler) {
    return this._setHandler('empty', handler);
  }

  drain(handler) {
    return this._setHandler('drain', handler);
  }

  error(handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('error handler must be a function');
    }
    this._error = handler;
  }

  _startWork() {
    while (!this._paused && this._running < this._concurrency && this._tasks.length > 0) {
      this._runTask();
    }
  }

  async _runTask() {
    const { task, resolve, reject } = this._tasks.shift();
    this._running++;

    if (this._tasks.length === 0) {
      this._empty();
    }
    if (this._running === this._concurrency) {
      this._saturated();
    }

    try {
      resolve(await this.worker.call(null, task));
    } catch (e) {
      if (this._error) {
        this._error(e, task);
      }
      reject(e);
    }

    this._running--;

    if (this.idle) {
      this._drain();
      return;
    }

    this._startWork();
  }

  _setHandler(name, handler) {
    const privateName = `_${name}`;
    if (typeof handler === 'undefined') {
      return new Promise((resolve) => {
        const previousHandler = this[privateName];
        this[privateName] = () => {
          previousHandler();
          resolve();
        };
      });
    }

    if (typeof handler !== 'function') {
      throw new TypeError(`${name} handler must be a function`);
    }
    this[privateName] = handler;
  }
}
