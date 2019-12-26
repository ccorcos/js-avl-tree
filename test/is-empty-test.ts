import test from "ava"
import { AvlTree } from "../src/avl-test-helpers"
import { compare } from "../src/utils"
import { InMemoryKeyValueStore } from "../storage/memory"

const store = new InMemoryKeyValueStore<any>()

test("should return whether the tree is empty", async function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: compare,
  })
  t.is(tree.root, undefined)
  tree = await tree.insert(1, 1)
  t.assert(tree.root)
  tree = await tree.remove(1)
  t.is(tree.root, undefined)
})
