import test from "ava"
import { AvlTree } from "../src/avl-test-helpers"
import { compare } from "../src/utils"
import { InMemoryKeyValueStorage } from "../storage/memory"
import { AvlNodeWritableStore } from "../src/avl-storage"

const store = new AvlNodeWritableStore<any, any>(new InMemoryKeyValueStorage())

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
