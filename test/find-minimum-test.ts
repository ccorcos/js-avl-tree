import test from "ava"
import { AvlTree } from "../src/avl-tree"
import { InMemoryKeyValueStore, AvlNodeStore } from "../src/storage"
import { compare } from "../src/utils"

const store = new AvlNodeStore<any, any>(new InMemoryKeyValueStore())

test("should return the minimum key in the tree", async function(t) {
  let tree = new AvlTree<number, undefined>({
    store: store,
    root: undefined,
    compare: compare,
  })
  tree = await tree.insert(5, undefined)
  tree = await tree.insert(3, undefined)
  tree = await tree.insert(1, undefined)
  tree = await tree.insert(4, undefined)
  tree = await tree.insert(2, undefined)
  t.is((await tree.begin()).node?.key, 1)
})
