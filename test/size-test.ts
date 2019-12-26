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
  t.is(tree.root, undefined)
  tree = await tree.insert(1, 1)
  t.is(tree.root?.count, 1)
  tree = await tree.insert(2, 1)
  t.is(tree.root?.count, 2)
  tree = await tree.insert(3, 1)
  t.is(tree.root?.count, 3)
  tree = await tree.insert(4, 1)
  t.is(tree.root?.count, 4)
  tree = await tree.insert(5, 1)
  t.is(tree.root?.count, 5)
  tree = await tree.insert(6, 1)
  t.is(tree.root?.count, 6)
  tree = await tree.insert(7, 1)
  t.is(tree.root?.count, 7)
  tree = await tree.insert(8, 1)
  t.is(tree.root?.count, 8)
  tree = await tree.insert(9, 1)
  t.is(tree.root?.count, 9)
  tree = await tree.insert(10, 1)
  t.is(tree.root?.count, 10)
  tree = await tree.remove(2)
  t.is(tree.root?.count, 9)
  tree = await tree.remove(4)
  t.is(tree.root?.count, 8)
  tree = await tree.remove(7)
  t.is(tree.root?.count, 7)
})
