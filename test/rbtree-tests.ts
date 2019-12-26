// These tests were adopted from `functional-red-black-tree` which are pretty exhaustive.
import * as _ from "lodash"
import test, { ExecutionContext } from "ava"
import { AvlTree } from "../src/avl-test-helpers"
import { AvlNode } from "../src/avl-storage"
import { AvlTreeIterator } from "../src/avl-iterator"
import { compare } from "../src/utils"
import { InMemoryKeyValueStorage } from "../storage/memory"
import { AvlNodeWritableStore } from "../src/avl-storage"

const iota = require("iota-array") as (n: number) => Array<number>

function makeTree<K, V>() {
  const store = new AvlNodeWritableStore<any, any>(
    new InMemoryKeyValueStorage()
  )
  return new AvlTree<K, V>({
    compare: compare,
    root: undefined,
    store: store,
  })
}

//Ensures the red black axioms are satisfied by tree
async function checkTree<K, V>(
  tree: AvlTree<K, V>,
  t: ExecutionContext<unknown>
) {
  const root = tree.root
  if (!root) {
    return
  }

  async function checkNode(node: AvlNode<K, V> | undefined): Promise<number> {
    if (!node) {
      return 0 // return the size.
    }
    const left = await tree.store.get(node.leftId)
    const right = await tree.store.get(node.rightId)

    if (node.leftId && !left) {
      t.fail("left not found")
    }

    if (node.rightId && !right) {
      t.fail("right not found")
    }

    if (left) {
      t.assert(
        tree.compare(left.key, node.key) <= 0,
        "left tree order invariant"
      )
    }
    if (right) {
      t.assert(
        tree.compare(right.key, node.key) >= 0,
        "right tree order invariant"
      )
    }
    const leftCount = await checkNode(left)
    const rightCount = await checkNode(right)

    t.is(left?.count || 0, leftCount, "left count")
    t.is(right?.count || 0, rightCount, "left count")
    t.is(node.count, leftCount + rightCount + 1, "total count")

    return leftCount + rightCount + 1
  }

  await checkNode(tree.root)
}

/**
 * Checks that transactions are cleaning up properly.
 */
function checkStore<K, V>(
  tree: AvlTree<K, V>,
  ids: Array<string>,
  t: ExecutionContext<unknown>
) {
  const keys = Object.keys((tree as any).store.store.map)
  keys.sort()
  ids = Array.from(new Set(ids))
  ids.sort()
  t.is(keys.length, ids.length)
  t.deepEqual(keys, ids)
}

test("insert()", async function(t) {
  var t1 = makeTree<number, boolean>()

  const ids: Array<string> = []

  var u = t1
  var arr: Array<number> = []
  for (var i = 20; i >= 0; --i) {
    var x = i
    var next = await u.insert(x, true)
    await checkTree(u, t)
    await checkTree(next, t)
    t.is(u.root?.count || 0, arr.length)
    arr.push(x)
    u = next
    ids.push(...(await u.nodes()).map(({ id }) => id))
  }

  checkStore(u, ids, t)

  for (var i = -20; i < 0; ++i) {
    var x = i
    var next = await u.insert(x, true)
    await checkTree(u, t)
    await checkTree(next, t)
    arr.sort(function(a, b) {
      return a - b
    })
    var ptr = 0
    for (const { key } of await u.nodes()) {
      t.is(key, arr[ptr++])
    }
    t.is(ptr, arr.length)
    arr.push(x)
    u = next
    ids.push(...(await u.nodes()).map(({ id }) => id))
  }

  checkStore(u, ids, t)

  var start = (await u.begin())!
  for (var i = -20, j = 0; j <= 40; ++i, ++j) {
    t.is((await u.at(j)).node?.key, i, "checking at()")
    t.is(start.node?.key, i, "checking iter")
    t.is(await start.index(), j, "checking index")
    t.assert(start.valid, "checking valid")
    if (j < 40) {
      t.assert(start.hasNext, "hasNext()")
    } else {
      t.assert(!start.hasNext, "eof hasNext()")
    }
    await start.next()
  }
  t.assert(!start.valid, "invalid eof iterator")
  t.assert(!start.hasNext, "hasNext() at eof fail")
  t.is(await start.index(), 41, "eof index")
})

test("foreach", async function(t) {
  var u = await iota(31).reduce(async function(u, k, v) {
    return (await u).insert(k, v)
  }, Promise.resolve(makeTree<number, number>()))

  //Check basic foreach
  var visit_keys: Array<number> = []
  var visit_vals: Array<number> = []
  for (const { key: k, value: v } of await u.nodes()) {
    visit_keys.push(k)
    visit_vals.push(v)
  }
  t.deepEqual(visit_keys, iota(31))
  t.deepEqual(visit_vals, iota(31))
})

async function compareIterators<K, V>(
  a: AvlTreeIterator<K, V>,
  b: AvlTreeIterator<K, V>,
  t: ExecutionContext<unknown>
) {
  t.is(a.root, b.root, "iter trees")
  t.is(a.valid, b.valid, "iter validity")
  if (!b.valid) {
    return
  }
  t.is(a.node?.id, b.node?.id, "iter node")
  t.is(a.node?.key, b.node?.key, "iter key")
  t.is(a.node?.value, b.node?.value, "iter value")
  t.is(await a.index(), await b.index(), "iter index")
}

test("iterators", async function(t) {
  var u = await iota(20).reduce(async function(u, k, v) {
    return (await u).insert(k, v)
  }, Promise.resolve(makeTree<number, number>()))

  //Try walking forward
  var iter = await u.begin()
  var c = iter.clone()
  t.assert(iter.hasNext, "must have next at beginneing")
  t.assert(!iter.hasPrev, "must not have predecessor")
  for (var i = 0; i < 20; ++i) {
    var v = await u.at(i)
    await compareIterators(iter, v, t)
    t.is(await iter.index(), i)
    await iter.next()
  }
  t.assert(!iter.valid, "must be eof iterator")

  //Check if the clone worked
  await compareIterators(c, await u.begin(), t)

  //Try walking backward
  var iter = await u.end()
  t.assert(!iter.hasNext, "must not have next")
  t.assert(iter.hasPrev, "must have predecessor")
  for (var i = 19; i >= 0; --i) {
    var v = await u.at(i)
    await compareIterators(iter, v, t)
    t.is(await iter.index(), i)
    await iter.prev()
  }
  t.assert(!iter.valid, "must be eof iterator")
})

test("remove()", async function(t) {
  var sz = [1, 2, 10, 20, 23, 31, 32, 33]
  for (var n = 0; n < sz.length; ++n) {
    var c = sz[n]
    var u = await iota(c).reduce(async function(u, k, v) {
      return (await u).insert(k, v)
    }, Promise.resolve(makeTree<number, number>()))
    for (var i = 0; i < c; ++i) {
      await checkTree(await u.remove(i), t)
    }
  }
})

test("keys and values", async function(t) {
  var original_keys = [
    "potato",
    "sock",
    "foot",
    "apple",
    "newspaper",
    "gameboy",
  ]
  var original_values: Array<any> = [42, 10, false, "!!!", {}, null]

  var u = makeTree<string, any>()
  for (var i = 0; i < original_keys.length; ++i) {
    u = await u.insert(original_keys[i], original_values[i])
  }

  var zipped = iota(6).map(function(i) {
    return [original_keys[i], original_values[i]]
  })

  zipped.sort(function(a, b) {
    if (a[0] < b[0]) {
      return -1
    }
    if (a[0] > b[0]) {
      return 1
    }
    return 0
  })

  var keys = zipped.map(function(v) {
    return v[0]
  })
  var values = zipped.map(function(v) {
    return v[1]
  })

  t.deepEqual(
    (await u.nodes()).map(u => u.key),
    keys
  )
  t.deepEqual(
    (await u.nodes()).map(u => u.value),
    values
  )
})

test("searching", async function(t) {
  var arr = [0, 1, 1, 1, 1, 2, 3, 4, 5, 6, 6]
  var u = await arr.reduce(async function(u, k, v) {
    return (await u).insert(k, v)
  }, Promise.resolve(makeTree<number, number>()))

  for (var i = 0; i < arr.length; ++i) {
    if (arr[i] !== arr[i - 1] && arr[i] !== arr[i + 1]) {
      t.is(await u.get(arr[i]), i, "get " + arr[i])
    }
  }
  t.is(await u.get(-1), undefined, "get missing")

  t.is(await (await u.ge(3)).index(), 3, "ge simple")
  t.is(await (await u.ge(0.9)).index(), 1, "ge run start")
  t.is(await (await u.ge(1)).index(), 1, "ge run mid")
  t.is(await (await u.ge(1.1)).index(), 2, "ge run end")
  t.is(await (await u.ge(0)).index(), 0, "ge first")
  t.is(await (await u.ge(6)).index(), 6, "ge last")
  t.is((await u.ge(100)).valid, false, "ge big")
  t.is(await (await u.ge(-1)).index(), 0, "ge small")

  t.is(await (await u.gt(3)).index(), 4, "gt simple")
  t.is(await (await u.gt(0.9)).index(), 1, "gt run start")
  t.is(await (await u.gt(1)).index(), 2, "gt run mid")
  t.is(await (await u.gt(1.1)).index(), 2, "gt run end")
  t.is(await (await u.gt(0)).index(), 1, "gt first")
  t.is((await u.gt(6)).valid, false, "gt last")
  t.is((await u.gt(100)).valid, false, "gt big")
  t.is(await (await u.gt(-1)).index(), 0, "ge small")

  t.is(await (await u.le(3)).index(), 3, "le simple")
  t.is(await (await u.le(0.9)).index(), 0, "le run start")
  t.is(await (await u.le(1)).index(), 1, "le run mid")
  t.is(await (await u.le(1.1)).index(), 1, "le run end")
  t.is(await (await u.le(0)).index(), 0, "le first")
  t.is(await (await u.le(6)).index(), 6, "le last")
  t.is(await (await u.le(100)).index(), 6, "le big")
  t.is((await u.le(-1)).valid, false, "le small")

  t.is(await (await u.lt(3)).index(), 2, "lt simple")
  t.is(await (await u.lt(0.9)).index(), 0, "lt run start")
  t.is(await (await u.lt(1)).index(), 0, "lt run mid")
  t.is(await (await u.lt(1.1)).index(), 1, "lt run end")
  t.is((await u.lt(0)).valid, false, "lt first")
  t.is(await (await u.lt(6)).index(), 5, "lt last")
  t.is(await (await u.lt(100)).index(), 6, "lt big")
  t.is((await u.lt(-1)).valid, false, "lt small")

  t.is((await u.find(-1)).valid, false, "find missing small")
  t.is((await u.find(10000)).valid, false, "find missing big")
  t.is(await (await u.find(3)).index(), 3, "find simple")
  t.assert((await (await u.find(1)).index()) > 0, "find repeat")
  t.assert((await (await u.find(1)).index()) < 5, "find repeat")

  for (var i = 0; i <= 6; ++i) {
    t.is((await u.find(i)).node?.key, i, "find " + i)
  }

  for (var i = 0; i <= 6; ++i) {
    t.is((await u.at(i)).node?.key, i, "at " + i)
  }
  t.is((await u.at(-1)).valid, false, "at missing small")
  t.is((await u.at(1000)).valid, false, "at missing big")
})

test("slab-sequence", async function(t) {
  var tree = makeTree<number, number>()

  tree = await tree.insert(0, 0)
  await checkTree(tree, t)
  t.deepEqual(
    (await tree.nodes()).map(n => n.value),
    [0]
  )

  tree = await tree.insert(1, 1)
  await checkTree(tree, t)
  t.deepEqual(
    (await tree.nodes()).map(n => n.value),
    [0, 1]
  )

  tree = await tree.insert(0.5, 2)
  await checkTree(tree, t)
  t.deepEqual(
    (await tree.nodes()).map(n => n.value),
    [0, 2, 1]
  )

  tree = await tree.insert(0.25, 3)
  await checkTree(tree, t)
  t.deepEqual(
    (await tree.nodes()).map(n => n.value),
    [0, 3, 2, 1]
  )

  tree = await tree.remove(0)
  await checkTree(tree, t)
  t.deepEqual(
    (await tree.nodes()).map(n => n.value),
    [3, 2, 1]
  )

  tree = await tree.insert(0.375, 4)
  await checkTree(tree, t)
  t.deepEqual(
    (await tree.nodes()).map(n => n.value),
    [3, 4, 2, 1]
  )

  tree = await tree.remove(1)
  await checkTree(tree, t)
  t.deepEqual(
    (await tree.nodes()).map(n => n.value),
    [3, 4, 2]
  )

  tree = await tree.remove(0.5)
  await checkTree(tree, t)
  t.deepEqual(
    (await tree.nodes()).map(n => n.value),
    [3, 4]
  )

  tree = await tree.remove(0.375)
  await checkTree(tree, t)
  t.deepEqual(
    (await tree.nodes()).map(n => n.value),
    [3]
  )

  tree = await tree.remove(0.25)
  await checkTree(tree, t)
  t.deepEqual(
    (await tree.nodes()).map(n => n.value),
    []
  )
})

test("slab-sequence-2", async function(t) {
  var u = makeTree<number, number>()

  const ids: Array<string> = []
  u = await u.insert(12, 22)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(11, 3)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(10, 28)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(13, 16)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(9, 9)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(14, 10)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(8, 15)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(15, 29)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(16, 4)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(7, 21)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(17, 23)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(6, 2)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(5, 27)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(18, 17)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(4, 8)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(31, 11)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(30, 30)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(29, 5)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(28, 24)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(27, 18)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(26, 12)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(25, 31)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(24, 6)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(23, 25)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(19, 7)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(20, 13)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(1, 20)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(0, 14)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(22, 0)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(2, 1)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(3, 26)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.insert(21, 19)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(18)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(17)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(16)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(15)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(14)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(13)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(12)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(6)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(7)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(8)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(11)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(4)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(9)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(10)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(5)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(31)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(0)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(30)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(29)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(1)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(28)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(2)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(3)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(27)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(19)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(26)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(20)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(25)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(24)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(21)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(23)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  u = await u.remove(22)
  await checkTree(u, t)
  ids.push(...(await u.nodes()).map(({ id }) => id))
  checkStore(u, ids, t)
})

// This test will be different every time, but its a nice way to gain confidence.
// However, if it fails, good luck figuring out why!
test("randomness", async function(t) {
  for (let i = 0; i < 10; i++) {
    var u = makeTree<number, number>()
    const ids: Array<string> = []
    const numbers = _.shuffle(_.range(100))
    for (const n of numbers) {
      const next = await u.insert(n, n)
      await checkTree(u, t)
      await checkTree(next, t) // Test immutability
      u = next
      ids.push(...(await u.nodes()).map(({ id }) => id))
    }
    checkStore(u, ids, t)
    for (const n of _.sampleSize(numbers, 50)) {
      const next = await u.remove(n)
      await checkTree(u, t)
      await checkTree(next, t) // Test immutability
      u = next
      ids.push(...(await u.nodes()).map(({ id }) => id))
    }
    checkStore(u, ids, t)
  }
})

test("batch-randomness", async function(t) {
  for (let i = 0; i < 100; i++) {
    let u = makeTree<number, number>()
    const ids: Array<string> = []
    const numbers = _.shuffle(_.range(100))
    let batch = u.batch()
    for (const n of numbers) {
      batch = batch.insert(n, n)
    }
    let next = await batch.commit()
    await checkTree(u, t)
    await checkTree(next, t)
    u = next
    ids.push(...(await u.nodes()).map(({ id }) => id))
    checkStore(u, ids, t)

    batch = u.batch()
    for (const n of _.sampleSize(numbers, 50)) {
      batch = batch.remove(n)
    }
    next = await batch.commit()
    await checkTree(u, t)
    await checkTree(next, t)
    u = next
    ids.push(...(await u.nodes()).map(({ id }) => id))
    checkStore(u, ids, t)
  }
})
