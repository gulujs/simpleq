import { expect } from 'chai';
import { SimpleQ } from './index.js';

describe('SimpleQ', () => {
  it('basic', async () => {
    const callOrder = [];
    const delays = [50, 10, 100, 10];

    const q = new SimpleQ((task) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          callOrder.push(`process ${task}`);
          resolve();
        }, delays.shift());
      });
    }, 2);

    const task1 = q.push(1).then(() => {
      expect(q.length).to.equal(0);
      callOrder.push('done 1');
    });
    const task2 = q.push(2).then(() => {
      expect(q.length).to.equal(1);
      callOrder.push('done 2');
    });
    const task3 = q.push(3).then(() => {
      expect(q.length).to.equal(0);
      callOrder.push('done 3');
    });
    const task4 = q.push(4).then(() => {
      expect(q.length).to.equal(0);
      callOrder.push('done 4');
    });

    expect(q.length).to.equal(4);
    expect(q.running).to.equal(0);
    expect(q.concurrency).to.equal(2);

    await q.saturated();
    expect(q.length).to.equal(2);
    expect(q.running).to.equal(2);

    await q.drain();

    expect(q.length).to.equal(0);
    expect(q.running).to.equal(0);
    expect(callOrder).to.deep.equal([
      'process 2',
      'done 2',
      'process 1',
      'done 1',
      'process 4',
      'done 4',
      'process 3',
      'done 3'
    ]);

    await Promise.all([task1, task2, task3, task4]);
  });

  it('should throw RangeError when concurrency not greater than zero', () => {
    expect(() => {
      // eslint-disable-next-line no-new
      new SimpleQ(() => 1, 0);
    }).to.throw('concurrency must greater than zero');
  });

  it('unshift', async () => {
    const result = [];
    const worker = async (task) => {
      result.push(task);
    };
    const q = new SimpleQ(worker, 1);

    const task1 = q.unshift(1);
    const task2 = q.push(4);
    const task3 = q.unshift(3);
    const task4 = q.unshift(2);

    await Promise.all([task1, task2, task3, task4]);
    expect(result).to.deep.equal([2, 3, 1, 4]);
  });

  it('pause && resume', async () => {
    let worked = false;
    const worker = (_task) => {
      worked = true;
      return true;
    };
    const q = new SimpleQ(worker, 1);

    expect(q.paused).to.be.false;

    q.pause();

    q.push(4).then((data) => {
      expect(data).to.be.true;
    });

    expect(worked).to.be.false;
    expect(q.paused).to.be.true;

    q.resume();
    q.resume();

    expect(q.paused).to.be.false;

    await q.drain();
    expect(worked).to.be.true;
  });

  it('kill', async () => {
    const result = [];
    const worker = async (task) => {
      result.push(task);
    };
    const q = new SimpleQ(worker, 1);

    q.push(1);
    q.push(2);

    await q.saturated();
    expect(q.running).to.equal(1);
    expect(q.length).to.equal(1);

    q.kill();
    expect(q.running).to.equal(1);
    expect(q.length).to.equal(0);

    await q.drain();
    expect(q.running).to.equal(0);
    expect(q.length).to.equal(0);
    expect(result).to.deep.equal([1]);
  });

  it('saturated', async () => {
    const worker = (_task) => {
      return new Promise(resolve => setImmediate(resolve));
    };
    const q = new SimpleQ(worker);

    const saturatedCallback = new Promise((resolve, reject) => {
      q.saturated(() => {
        try {
          expect(q.running).to.equal(1);
          expect(q.length).to.equal(1);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
    const saturatedPromise = q.saturated();

    Promise.all([
      q.push(1),
      q.push(2)
    ]);

    await saturatedPromise;
    expect(q.running).to.equal(1);
    expect(q.length).to.equal(1);

    await saturatedCallback;
  });

  it('empty', async () => {
    const worker = (_task) => {
      return new Promise(resolve => setImmediate(resolve));
    };
    const q = new SimpleQ(worker);

    Promise.all([
      q.push(1),
      q.push(2)
    ]);

    await q.empty();
    expect(q.running).to.equal(1);
    expect(q.length).to.equal(0);
  });

  it('error', async () => {
    const worker = async (task) => {
      if (task % 2 === 1) {
        throw new Error(`error ${task}`);
      }
      return `success ${task}`;
    };
    const q = new SimpleQ(worker);

    const task1 = q.push(1);
    const task2 = q.push(2);
    const task3 = q.push(3);

    const errors = [];
    q.error((err, task) => {
      errors.push(`${task} - ${err.message}`);
    });

    await q.drain();
    expect(errors).to.deep.equal(['1 - error 1', '3 - error 3']);

    expect(await task1.catch(e => e)).to.include({ message: 'error 1' });
    expect(await task2).to.equal('success 2');
    expect(await task3.catch(e => e)).to.include({ message: 'error 3' });
  });
});
