import test from "ava"
import { AvlTree } from "../src/avl-tree"
import { InMemoryKeyValueStore, AvlNodeStore } from "../src/storage"
import { compare } from "../src/utils"

const store = new AvlNodeStore<any, any>(new InMemoryKeyValueStore())

test("should return whether the tree is empty", function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: compare,
  })
  t.is(tree.root, undefined)
  tree = tree.insert(1, 1)
  t.assert(tree.root)
  tree = tree.remove(1)
  t.is(tree.root, undefined)
})
