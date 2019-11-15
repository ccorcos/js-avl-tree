import test from "ava"
import { AvlTree } from "../src/avl-tree3"
import { InMemoryKeyValueStore, AvlNodeStore } from "../src/storage"

const store = new AvlNodeStore<any, any>(new InMemoryKeyValueStore())

test("should function correctly given a non-reverse customCompare", function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: (a, b) => {
      return b - a
    },
  })
  tree = tree.insert(2, 1)
  tree = tree.insert(1, 1)
  tree = tree.insert(3, 1)
  t.is(tree.root!.count, 3)
  t.is(tree.findMinimum()?.node.key, 3)
  t.is(tree.findMaximum()?.node.key, 1)
  tree = tree.remove(3)
  t.is(tree.root?.count, 2)
  t.is(tree.root?.key, 2)
  t.is(tree.root?.leftId, undefined)
  t.is(tree.walk().right?.node?.key, 1)
})

test("should work when the key is a complex object", function(t) {
  let tree = new AvlTree<{ innerKey: number }, number>({
    store: store,
    root: undefined,
    compare: (a, b) => {
      return a.innerKey - b.innerKey
    },
  })
  tree = tree.insert({ innerKey: 1 }, 1)
  t.true(!!tree.get({ innerKey: 1 }))
  t.false(!!tree.get({ innerKey: 2 }))
})
