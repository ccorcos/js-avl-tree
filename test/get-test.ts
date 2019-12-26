import test from "ava"
import { AvlTree } from "../src/avl-test-helpers"
import { compare } from "../src/utils"
import { InMemoryKeyValueStorage } from "../storage/memory"
import { AvlNodeWritableStore } from "../src/avl-storage"

const store = new AvlNodeWritableStore<any, any>(new InMemoryKeyValueStorage())

test("should return the size of the tree", async function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: compare,
  })

  tree = await tree.insert(1, 4)
  tree = await tree.insert(2, 5)
  tree = await tree.insert(3, 6)

  t.is(await tree.get(1), 4)
  t.is(await tree.get(2), 5)
  t.is(await tree.get(3), 6)
})
