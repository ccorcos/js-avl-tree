import test from "ava"
import { AvlTree } from "../src/avl-tree3"
import { InMemoryKeyValueStore, AvlNodeStore } from "../src/storage"
import { compare } from "../src/utils"

const store = new AvlNodeStore<any, any>(new InMemoryKeyValueStore())

test("should return the maximum key in the tree", function(t) {
  let tree = new AvlTree<number, undefined>({
    store: store,
    root: undefined,
    compare: compare,
  })
  tree = tree.insert(3, undefined)
  tree = tree.insert(5, undefined)
  tree = tree.insert(1, undefined)
  tree = tree.insert(4, undefined)
  tree = tree.insert(2, undefined)
  t.is(tree.findMaximum()?.node.key, 5)
})
