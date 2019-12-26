import test from "ava"
import { AvlTree } from "../src/avl-test-helpers"
import { InMemoryKeyValueStore } from "../storage/memory"
import { AvlNodeWritableStore } from "../src/avl-storage"

const store = new AvlNodeWritableStore<any, any>(new InMemoryKeyValueStore())

test("should function correctly given a non-reverse customCompare", async function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: (a, b) => {
      return b - a
    },
  })
  tree = await tree.insert(2, 1)
  tree = await tree.insert(1, 1)
  tree = await tree.insert(3, 1)
  t.is(tree.root!.count, 3)
  t.is((await tree.begin()).node?.key, 3)
  t.is((await tree.end()).node?.key, 1)
  tree = await tree.remove(3)
  t.is(tree.root?.count, 2)
  t.is(tree.root?.key, 2)
  t.is(tree.root?.leftId, undefined)
  t.is((await tree.walk().right.node)?.key, 1)
})

test("should work when the key is a complex object", async function(t) {
  let tree = new AvlTree<{ innerKey: number }, number>({
    store: store,
    root: undefined,
    compare: (a, b) => {
      return a.innerKey - b.innerKey
    },
  })
  tree = await tree.insert({ innerKey: 1 }, 1)
  t.true(Boolean(await tree.get({ innerKey: 1 })))
  t.false(Boolean(await tree.get({ innerKey: 2 })))
})
