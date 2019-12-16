import test from "ava"
import { AvlTree } from "../src/avl-tree"
import { compare } from "../src/utils"
import {
  InMemoryKeyValueStore,
  InMemoryAvlNodeStorage,
} from "../storage/memory"

const store = new InMemoryAvlNodeStorage<any, any>(new InMemoryKeyValueStore())

test("should return the size of the tree", async function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: compare,
  })

  tree = await tree
    .transact()
    .insert(1, 4)
    .commit()
  tree = await tree
    .transact()
    .insert(2, 5)
    .commit()
  tree = await tree
    .transact()
    .insert(3, 6)
    .commit()

  t.is(await tree.get(1), 4)
  t.is(await tree.get(2), 5)
  t.is(await tree.get(3), 6)
})
