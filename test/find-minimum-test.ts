import test from "ava"
import { AvlTree } from "../src/avl-tree"
import { InMemoryKeyValueStore, AvlNodeStore } from "../src/storage"
import { compare } from "../src/utils"

const store = new AvlNodeStore<any, any>(new InMemoryKeyValueStore())

test("should return the minimum key in the tree", function(t) {
  let tree = new AvlTree<number, undefined>({
    store: store,
    root: undefined,
    compare: compare,
  })
  tree = tree.insert(5, undefined)
  tree = tree.insert(3, undefined)
  tree = tree.insert(1, undefined)
  tree = tree.insert(4, undefined)
  tree = tree.insert(2, undefined)
  t.is(tree.findMinimum()?.node.key, 1)
})
