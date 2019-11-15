import test from "ava"
import { AvlTree } from "../src/avl-tree3"
import { InMemoryKeyValueStore, AvlNodeStore } from "../src/storage"
import { compare } from "../src/utils"

const store = new AvlNodeStore<any, any>(new InMemoryKeyValueStore())

test("should return the size of the tree", function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: compare,
  })

  tree = tree.insert(1, 4)
  tree = tree.insert(2, 5)
  tree = tree.insert(3, 6)

  t.is(tree.get(1), 4)
  t.is(tree.get(2), 5)
  t.is(tree.get(3), 6)
})
