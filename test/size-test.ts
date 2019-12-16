import test from "ava"
import { AvlTree } from "../src/avl-tree"
import { compare } from "../src/utils"
import {
  InMemoryKeyValueStore,
  InMemoryAvlNodeStorage,
} from "../storage/memory"

const store = new InMemoryAvlNodeStorage<any, any>(new InMemoryKeyValueStore())

test("should return the size of the tree", async function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: compare,
  })
  t.is(tree.root, undefined)
  tree = await tree
    .transact()
    .insert(1, 1)
    .commit()
  t.is(tree.root?.count, 1)
  tree = await tree
    .transact()
    .insert(2, 1)
    .commit()
  t.is(tree.root?.count, 2)
  tree = await tree
    .transact()
    .insert(3, 1)
    .commit()
  t.is(tree.root?.count, 3)
  tree = await tree
    .transact()
    .insert(4, 1)
    .commit()
  t.is(tree.root?.count, 4)
  tree = await tree
    .transact()
    .insert(5, 1)
    .commit()
  t.is(tree.root?.count, 5)
  tree = await tree
    .transact()
    .insert(6, 1)
    .commit()
  t.is(tree.root?.count, 6)
  tree = await tree
    .transact()
    .insert(7, 1)
    .commit()
  t.is(tree.root?.count, 7)
  tree = await tree
    .transact()
    .insert(8, 1)
    .commit()
  t.is(tree.root?.count, 8)
  tree = await tree
    .transact()
    .insert(9, 1)
    .commit()
  t.is(tree.root?.count, 9)
  tree = await tree
    .transact()
    .insert(10, 1)
    .commit()
  t.is(tree.root?.count, 10)
  tree = await tree
    .transact()
    .remove(2)
    .commit()
  t.is(tree.root?.count, 9)
  tree = await tree
    .transact()
    .remove(4)
    .commit()
  t.is(tree.root?.count, 8)
  tree = await tree
    .transact()
    .remove(7)
    .commit()
  t.is(tree.root?.count, 7)
})
