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
- read: .017 * 13 = 0.221
	Node.js overhead is marginal.
- set: 0.024 * 13 = 0.312
	3x overhead on balancing.

```ts
iterations: 100_000

leveldb: sets { min: '0.000 ms', max: '67.996 ms', avg: '0.023 ms' }
leveldb: gets { min: '0.000 ms', max: '4.764 ms', avg: '0.018 ms' }

sqlite: sets { min: '0.000 ms', max: '54.005 ms', avg: '0.573 ms' }
sqlite: gets { min: '0.000 ms', max: '3.449 ms', avg: '0.028 ms' }

NOTE: using 1s rest every 10k iterations.
treedb: sets { min: '0.000 ms', max: '169.468 ms', avg: '1.411 ms' }
treedb: gets { min: '0.000 ms', max: '13.353 ms', avg: '0.312 ms' }
```

Observations:
- read: .018 * 16.5 = 0.297
	Node.js overhead is 10%.
- set:.023 * 16.5 = 0.380
	3-4x overhead on balancing.

Notes about GC issues.

```
node --max_old_space_size=2048 -r ts-node/register
npm run build && node --inspect-brk build/bench/treedb.js
npm run build && node --trace-gc build/bench/treedb.js
```
