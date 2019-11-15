import test from "ava"
import { AvlTree } from "../src/avl-tree"
import { InMemoryKeyValueStore, AvlNodeStore } from "../src/storage"
import { compare } from "../src/utils"

const store = new AvlNodeStore<any, any>(new InMemoryKeyValueStore())

test("should return the size of the tree", function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: compare,
  })
  t.is(tree.root, undefined)
  tree = tree.insert(1, 1)
  t.is(tree.root?.count, 1)
  tree = tree.insert(2, 1)
  t.is(tree.root?.count, 2)
  tree = tree.insert(3, 1)
  t.is(tree.root?.count, 3)
  tree = tree.insert(4, 1)
  t.is(tree.root?.count, 4)
  tree = tree.insert(5, 1)
  t.is(tree.root?.count, 5)
  tree = tree.insert(6, 1)
  t.is(tree.root?.count, 6)
  tree = tree.insert(7, 1)
  t.is(tree.root?.count, 7)
  tree = tree.insert(8, 1)
  t.is(tree.root?.count, 8)
  tree = tree.insert(9, 1)
  t.is(tree.root?.count, 9)
  tree = tree.insert(10, 1)
  t.is(tree.root?.count, 10)
  tree = tree.remove(2)
  t.is(tree.root?.count, 9)
  tree = tree.remove(4)
  t.is(tree.root?.count, 8)
  tree = tree.remove(7)
  t.is(tree.root?.count, 7)
})
