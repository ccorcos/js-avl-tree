import test from "ava"
import { AvlTree } from "../src/avl-tree"
import { compare } from "../src/utils"
import {
  InMemoryKeyValueStore,
  InMemoryAvlNodeStorage,
} from "../storage/memory"

const store = new InMemoryAvlNodeStorage<any, any>(new InMemoryKeyValueStore())

test("should return whether the tree is empty", async function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: compare,
  })
  t.is(tree.root, undefined)
  tree = await tree
    .transact()
    .insert(1, 1)
    .commit()
  t.assert(tree.root)
  tree = await tree
    .transact()
    .remove(1)
    .commit()
  t.is(tree.root, undefined)
})
