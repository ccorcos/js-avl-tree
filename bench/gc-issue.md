NOTE: this was going to be a github issue ticket...

Garbage collector goes unstable with a repetitive task

```
❯❯❯ uname -a
Darwin chet 19.0.0 Darwin Kernel Version 19.0.0: Wed Sep 25 21:13:50 PDT 2019; root:xnu-6153.11.26~4/RELEASE_X86_64 x86_64
❯❯❯ node --version
v10.16.0
❯❯❯ m info
ProductName:	Mac OS X
ProductVersion:	10.15
BuildVersion:	19A582a
```

You can repro this issue with the following commands:

```sh
git clone git@github.com:ccorcos/js-avl-tree.git
cd js-avl-tree
git checkout 4a951e13e31fc09fb75ef306b0e3383ac800ad4c
npm install
npm run build
node --trace-gc build/bench/treedb.js
```

This will run a benchmarking script that logs garbage collector information. The output can be seen here:

https://gist.githubusercontent.com/ccorcos/680c8a7f021df64ee7fbbce463e7c3c0/raw/e556b189e5d2cf207fb99d37d669bdfd1819d3f9/node.log

After a while the program crashes with an heap allocation failure:

```
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
 ```

I've had several encounters with GC issues that end up being some weird memory leak, but this time, I'm running a set number of iterations on the same function so I would expect the memory to either grow linearly or not at all.

However, this program works just fine for a while without having any memory issues and then all of a sudden, it appears the garbage collector decides to get lazy and the memory starts to explode.

I grabbed processed the logs above to show a graph of how Mark-sweeps are effective at first, but eventually start climbing drastically.

```
console.log(fs.readFileSync("./gc.txt", "utf8").split("\n").filter(line => line.includes("Mark-sweep")).map(line => require("lodash").compact(line.split(" "))).map(line => [line[1], line[4], line[4]].join("\t")).join("\n"))
```

https://docs.google.com/spreadsheets/d/1TmZqrOcvkXs1ERBKcVGIWhwd_-8l_xiS8hKxc0IO0MY/edit?usp=sharing

![image](https://user-images.githubusercontent.com/1794527/69212650-bdd10680-0b16-11ea-91e5-6d642483a630.png)

Here's the program that's running:
https://github.com/ccorcos/js-avl-tree/blob/4a951e13e31fc09fb75ef306b0e3383ac800ad4c/bench/benchmark.ts#L68-L97



```ts
export async function benchmark(label: string, db: BenchDb) {
  const sets = new Timer(label + ": sets")
  const keys: Array<string> = []
  for (var i = 0; i < iterations; i++) {
    const key = random()
    keys.push(key)
    sets.begin()
    await db.set(key, random())
    sets.end()
    if (i % (iterations / 10) === 0) {
      console.log(i)
      // This rest is necessary for Node.js GC to not die benching treedb.
      // await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  sets.stop()

  const gets = new Timer(label + ": gets")
  for (var i = 0; i < iterations; i++) {
    gets.begin()
    await db.get(keys[i])
    gets.end()
    if (i % (iterations / 10) === 0) {
      console.log(i)
      // This rest is necessary for Node.js GC to not die benching treedb.
      // await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  gets.stop()
}
```

Wait a sec 153984ms is when sets were done and we start doing gets...
