// These tests were adopted from `functional-red-black-tree` which are pretty exhaustive.
import * as _ from "lodash"
import test, { ExecutionContext } from "ava"
import { AvlTree, AvlNode, AvlTreeIterator, printTree } from "../src/avl-tree"
import { compare } from "../src/utils"
import { InMemoryKeyValueStore, AvlNodeStore } from "../src/storage"
const iota = require("iota-array") as (n: number) => Array<number>

function makeTree<K, V>() {
  const store = new AvlNodeStore<any, any>(new InMemoryKeyValueStore())
  return new AvlTree<K, V>({
    compare: compare,
    root: undefined,
    store: store,
  })
}

//Ensures the red black axioms are satisfied by tree
function checkTree<K, V>(tree: AvlTree<K, V>, t: ExecutionContext<unknown>) {
  const root = tree.root
  if (!root) {
    return
  }

  function checkNode(node: AvlNode<K, V> | undefined): number {
    if (!node) {
      return 0 // return the size.
    }
    const left = tree.store.get(node.leftId)
    const right = tree.store.get(node.rightId)

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
    const leftCount = checkNode(left)
    const rightCount = checkNode(right)

    t.is(left?.count || 0, leftCount, "left count")
    t.is(right?.count || 0, rightCount, "left count")
    t.is(node.count, leftCount + rightCount + 1, "total count")

    return leftCount + rightCount + 1
  }

  checkNode(tree.root)
}

/**
 * Checks that transactions are cleaning up properly.
 */
function checkStore<K, V>(
  tree: AvlTree<K, V>,
  ids: Array<string>,
  t: ExecutionContext<unknown>
) {
  const keys = Object.keys(tree.store.store.map)
  keys.sort()
  ids = Array.from(new Set(ids))
  ids.sort()
  t.is(keys.length, ids.length)
  t.deepEqual(keys, ids)
}

test("insert()", function(t) {
  var t1 = makeTree<number, boolean>()

  const ids: Array<string> = []

  var u = t1
  var arr: Array<number> = []
  for (var i = 20; i >= 0; --i) {
    var x = i
    var next = u.insert(x, true)
    checkTree(u, t)
    checkTree(next, t)
    t.is(u.root?.count || 0, arr.length)
    arr.push(x)
    u = next
    ids.push(...Array.from(u).map(({ id }) => id))
  }

  checkStore(u, ids, t)

  for (var i = -20; i < 0; ++i) {
    var x = i
    var next = u.insert(x, true)
    checkTree(u, t)
    checkTree(next, t)
    arr.sort(function(a, b) {
      return a - b
    })
    var ptr = 0
    for (const { key } of u) {
      t.is(key, arr[ptr++])
    }
    t.is(ptr, arr.length)
    arr.push(x)
    u = next
    ids.push(...Array.from(u).map(({ id }) => id))
  }

  checkStore(u, ids, t)

  var start = u.begin()!
  for (var i = -20, j = 0; j <= 40; ++i, ++j) {
    t.is(u.at(j).node?.key, i, "checking at()")
    t.is(start.node?.key, i, "checking iter")
    t.is(start.index(), j, "checking index")
    t.assert(start.valid, "checking valid")
    if (j < 40) {
      t.assert(start.hasNext, "hasNext()")
    } else {
      t.assert(!start.hasNext, "eof hasNext()")
    }
    start.next()
  }
  t.assert(!start.valid, "invalid eof iterator")
  t.assert(!start.hasNext, "hasNext() at eof fail")
  t.is(start.index(), 41, "eof index")
})

test("foreach", function(t) {
  var u = iota(31).reduce(function(u, k, v) {
    return u.insert(k, v)
  }, makeTree<number, number>())

  //Check basic foreach
  var visit_keys: Array<number> = []
  var visit_vals: Array<number> = []
  for (const { key: k, value: v } of u) {
    visit_keys.push(k)
    visit_vals.push(v)
  }
  t.deepEqual(visit_keys, iota(31))
  t.deepEqual(visit_vals, iota(31))
})

function compareIterators<K, V>(
  a: AvlTreeIterator<K, V>,
  b: AvlTreeIterator<K, V>,
  t: ExecutionContext<unknown>
) {
  t.is(a.tree, b.tree, "iter trees")
  t.is(a.valid, b.valid, "iter validity")
  if (!b.valid) {
    return
  }
  t.is(a.node?.id, b.node?.id, "iter node")
  t.is(a.node?.key, b.node?.key, "iter key")
  t.is(a.node?.value, b.node?.value, "iter value")
  t.is(a.index(), b.index(), "iter index")
}

test("iterators", function(t) {
  var u = iota(20).reduce(function(u, k, v) {
    return u.insert(k, v)
  }, makeTree<number, number>())

  //Try walking forward
  var iter = u.begin()
  var c = iter.clone()
  t.assert(iter.hasNext, "must have next at beginneing")
  t.assert(!iter.hasPrev, "must not have predecessor")
  for (var i = 0; i < 20; ++i) {
    var v = u.at(i)
    compareIterators(iter, v, t)
    t.is(iter.index(), i)
    iter.next()
  }
  t.assert(!iter.valid, "must be eof iterator")

  //Check if the clone worked
  compareIterators(c, u.begin(), t)

  //Try walking backward
  var iter = u.end()
  t.assert(!iter.hasNext, "must not have next")
  t.assert(iter.hasPrev, "must have predecessor")
  for (var i = 19; i >= 0; --i) {
    var v = u.at(i)
    compareIterators(iter, v, t)
    t.is(iter.index(), i)
    iter.prev()
  }
  t.assert(!iter.valid, "must be eof iterator")
})

test("remove()", function(t) {
  var sz = [1, 2, 10, 20, 23, 31, 32, 33]
  for (var n = 0; n < sz.length; ++n) {
    var c = sz[n]
    var u = iota(c).reduce(function(u, k, v) {
      return u.insert(k, v)
    }, makeTree<number, number>())
    for (var i = 0; i < c; ++i) {
      checkTree(u.remove(i), t)
    }
  }
})

test("keys and values", function(t) {
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
    u = u.insert(original_keys[i], original_values[i])
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
    Array.from(u).map(u => u.key),
    keys
  )
  t.deepEqual(
    Array.from(u).map(u => u.value),
    values
  )
})

test("searching", function(t) {
  var arr = [0, 1, 1, 1, 1, 2, 3, 4, 5, 6, 6]
  var u = arr.reduce(function(u, k, v) {
    return u.insert(k, v)
  }, makeTree<number, number>())

  for (var i = 0; i < arr.length; ++i) {
    if (arr[i] !== arr[i - 1] && arr[i] !== arr[i + 1]) {
      t.is(u.get(arr[i]), i, "get " + arr[i])
    }
  }
  t.is(u.get(-1), undefined, "get missing")

  t.is(u.ge(3).index(), 3, "ge simple")
  t.is(u.ge(0.9).index(), 1, "ge run start")
  t.is(u.ge(1).index(), 1, "ge run mid")
  t.is(u.ge(1.1).index(), 2, "ge run end")
  t.is(u.ge(0).index(), 0, "ge first")
  t.is(u.ge(6).index(), 6, "ge last")
  t.is(u.ge(100).valid, false, "ge big")
  t.is(u.ge(-1).index(), 0, "ge small")

  t.is(u.gt(3).index(), 4, "gt simple")
  t.is(u.gt(0.9).index(), 1, "gt run start")
  t.is(u.gt(1).index(), 2, "gt run mid")
  t.is(u.gt(1.1).index(), 2, "gt run end")
  t.is(u.gt(0).index(), 1, "gt first")
  t.is(u.gt(6).valid, false, "gt last")
  t.is(u.gt(100).valid, false, "gt big")
  t.is(u.gt(-1).index(), 0, "ge small")

  t.is(u.le(3).index(), 3, "le simple")
  t.is(u.le(0.9).index(), 0, "le run start")
  t.is(u.le(1).index(), 1, "le run mid")
  t.is(u.le(1.1).index(), 1, "le run end")
  t.is(u.le(0).index(), 0, "le first")
  t.is(u.le(6).index(), 6, "le last")
  t.is(u.le(100).index(), 6, "le big")
  t.is(u.le(-1).valid, false, "le small")

  t.is(u.lt(3).index(), 2, "lt simple")
  t.is(u.lt(0.9).index(), 0, "lt run start")
  t.is(u.lt(1).index(), 0, "lt run mid")
  t.is(u.lt(1.1).index(), 1, "lt run end")
  t.is(u.lt(0).valid, false, "lt first")
  t.is(u.lt(6).index(), 5, "lt last")
  t.is(u.lt(100).index(), 6, "lt big")
  t.is(u.lt(-1).valid, false, "lt small")

  t.is(u.find(-1).valid, false, "find missing small")
  t.is(u.find(10000).valid, false, "find missing big")
  t.is(u.find(3).index(), 3, "find simple")
  t.assert(u.find(1).index() > 0, "find repeat")
  t.assert(u.find(1).index() < 5, "find repeat")

  for (var i = 0; i <= 6; ++i) {
    t.is(u.find(i).node?.key, i, "find " + i)
  }

  for (var i = 0; i <= 6; ++i) {
    t.is(u.at(i).node?.key, i, "at " + i)
  }
  t.is(u.at(-1).valid, false, "at missing small")
  t.is(u.at(1000).valid, false, "at missing big")
})

test("slab-sequence", function(t) {
  var tree = makeTree<number, number>()

  tree = tree.insert(0, 0)
  checkTree(tree, t)
  t.deepEqual(
    Array.from(tree).map(n => n.value),
    [0]
  )

  tree = tree.insert(1, 1)
  checkTree(tree, t)
  t.deepEqual(
    Array.from(tree).map(n => n.value),
    [0, 1]
  )

  tree = tree.insert(0.5, 2)
  checkTree(tree, t)
  t.deepEqual(
    Array.from(tree).map(n => n.value),
    [0, 2, 1]
  )

  tree = tree.insert(0.25, 3)
  checkTree(tree, t)
  t.deepEqual(
    Array.from(tree).map(n => n.value),
    [0, 3, 2, 1]
  )

  tree = tree.remove(0)
  checkTree(tree, t)
  t.deepEqual(
    Array.from(tree).map(n => n.value),
    [3, 2, 1]
  )

  tree = tree.insert(0.375, 4)
  checkTree(tree, t)
  t.deepEqual(
    Array.from(tree).map(n => n.value),
    [3, 4, 2, 1]
  )

  tree = tree.remove(1)
  checkTree(tree, t)
  t.deepEqual(
    Array.from(tree).map(n => n.value),
    [3, 4, 2]
  )

  tree = tree.remove(0.5)
  checkTree(tree, t)
  t.deepEqual(
    Array.from(tree).map(n => n.value),
    [3, 4]
  )

  tree = tree.remove(0.375)
  checkTree(tree, t)
  t.deepEqual(
    Array.from(tree).map(n => n.value),
    [3]
  )

  tree = tree.remove(0.25)
  checkTree(tree, t)
  t.deepEqual(
    Array.from(tree).map(n => n.value),
    []
  )
})

test("slab-sequence-2", function(t) {
  var u = makeTree<number, number>()

  const ids: Array<string> = []
  u = u.insert(12, 22)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(11, 3)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(10, 28)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(13, 16)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(9, 9)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(14, 10)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(8, 15)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(15, 29)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(16, 4)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(7, 21)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(17, 23)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(6, 2)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(5, 27)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(18, 17)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(4, 8)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(31, 11)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(30, 30)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(29, 5)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(28, 24)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(27, 18)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(26, 12)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(25, 31)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(24, 6)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(23, 25)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(19, 7)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(20, 13)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(1, 20)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(0, 14)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(22, 0)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(2, 1)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(3, 26)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.insert(21, 19)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(18)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(17)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(16)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(15)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(14)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(13)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(12)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(6)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(7)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(8)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(11)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(4)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(9)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(10)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(5)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(31)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(0)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(30)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(29)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(1)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(28)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(2)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(3)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(27)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(19)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(26)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(20)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(25)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(24)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(21)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(23)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  u = u.remove(22)
  checkTree(u, t)
  ids.push(...Array.from(u).map(({ id }) => id))
  checkStore(u, ids, t)
})

// This test will be different every time, but its a nice way to gain confidence.
// However, if it fails, good luck figuring out why!
test("randomness", function(t) {
  for (let i = 0; i < 10; i++) {
    var u = makeTree<number, number>()
    const ids: Array<string> = []
    const numbers = _.shuffle(_.range(100))
    for (const n of numbers) {
      u = u.insert(n, n)
      checkTree(u, t)
      ids.push(...Array.from(u).map(({ id }) => id))
    }
    checkStore(u, ids, t)
  }
})
