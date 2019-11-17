import test from "ava"
import { AvlTree } from "../src/avl-tree"
import { compare } from "../src/utils"
import {
  InMemoryKeyValueStore,
  InMemoryAvlNodeStorage,
} from "../storage/memory"

const store = new InMemoryAvlNodeStorage<any, any>(new InMemoryKeyValueStore())

test("should return the maximum key in the tree", async function(t) {
  let tree = new AvlTree<number, undefined>({
    store: store,
    root: undefined,
    compare: compare,
  })
  tree = await tree.insert(3, undefined)
  tree = await tree.insert(5, undefined)
  tree = await tree.insert(1, undefined)
  tree = await tree.insert(4, undefined)
  tree = await tree.insert(2, undefined)
  t.is((await tree.end()).node?.key, 5)
})
