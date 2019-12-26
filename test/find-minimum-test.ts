import test from "ava"
import { AvlTree } from "../src/avl-test-helpers"
import { compare } from "../src/utils"
import { InMemoryKeyValueStore } from "../storage/memory"
import { AvlNodeWritableStore } from "../src/avl-storage"

const store = new AvlNodeWritableStore<any, any>(new InMemoryKeyValueStore())

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
