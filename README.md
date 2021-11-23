# @lunjs/simpleq

## Installation

```sh
npm install @lunjs/simpleq
```

## Usage

```js
import { SimpleQ } from '@lunjs/simpleq';

const worker = async (task) => {
  return task.foo * 1024;
};
const q = new SimpleQ(worker, 2);

async function run() {
  const result = await q.push({ foo: 1024 });
  console.log(result);
}

run();
```

## License

[MIT](#LICENSE)
