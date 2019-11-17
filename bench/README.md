# Benchmark Analysis


We should expect treedb reads to be log2(n) slower than leveldb.

> Math.log2(10_000)
13.287712379549449

> Math.log2(100_000)
16.609640474436812

> Math.log2(100_000_000_000)
36.541209043760986


```ts
iterations: 10_000

leveldb: sets { min: '0.000 ms', max: '3.796 ms', avg: '0.024 ms' }
leveldb: gets { min: '0.000 ms', max: '3.106 ms', avg: '0.017 ms' }

sqlite: sets { min: '0.000 ms', max: '23.062 ms', avg: '0.559 ms' }
sqlite: gets { min: '0.000 ms', max: '2.967 ms', avg: '0.027 ms' }

treedb: sets { min: '0.000 ms', max: '37.323 ms', avg: '0.915 ms' }
treedb: gets { min: '0.000 ms', max: '16.629 ms', avg: '0.218 ms' }
```






























Observations:
- write: .025 * 13 = 0.325
	It looks like the overhead of Node.js and tree mangling is ~2.5x.
- read: .019 * 12 = 0.25
	Overhead of 1/3x

```ts
iterations: 100_000
```

To Do:
- try with a larger number of iterations.
- figure out why treedb crashes -- memory leak?

```sh
node --max_old_space_size=2048 -r ts-node/register

npm run build && node --inspect-brk build/bench/treedb.js

npm run build && node --trace-gc build/bench/treedb.js
```

https://stackoverflow.com/questions/33746184/what-is-meaning-of-node-js-trace-gc-output

Looks like it keeps up for a while...
