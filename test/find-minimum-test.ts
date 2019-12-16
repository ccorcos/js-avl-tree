import test from "ava"
import { AvlTree } from "../src/avl-tree"
import { compare } from "../src/utils"
import {
  InMemoryKeyValueStore,
  InMemoryAvlNodeStorage,
} from "../storage/memory"

const store = new InMemoryAvlNodeStorage<any, any>(new InMemoryKeyValueStore())

test("should return the minimum key in the tree", async function(t) {
  let tree = new AvlTree<number, undefined>({
    store: store,
    root: undefined,
    compare: compare,
  })
  tree = await tree
    .transact()
    .insert(5, undefined)
    .commit()
  tree = await tree
    .transact()
    .insert(3, undefined)
    .commit()
  tree = await tree
    .transact()
    .insert(1, undefined)
    .commit()
  tree = await tree
    .transact()
    .insert(4, undefined)
    .commit()
  tree = await tree
    .transact()
    .insert(2, undefined)
    .commit()
  t.is((await tree.begin()).node?.key, 1)
})
