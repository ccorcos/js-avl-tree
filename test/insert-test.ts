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
  tree = tree.insert(1, 1)
  tree = tree.insert(2, 1)
  tree = tree.insert(3, 1)
  tree = tree.insert(4, 1)
  tree = tree.insert(5, 1)
  t.is(tree.root?.count, 5)
})

test("should ignore insert of duplicate key", function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: compare,
  })
  tree = tree.insert(1, 1)
  tree = tree.insert(1, 1)
  t.is(tree.root?.count, 1)
})

/**
 *         c
 *        / \           _b_
 *       b   z         /   \
 *      / \     ->    a     c
 *     a   y         / \   / \
 *    / \           w   x y   z
 *   w   x
 */
test("should correctly balance the left left case", function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: compare,
  })
  tree = tree.insert(3, 1)
  tree = tree.insert(2, 1)
  tree = tree.insert(1, 1)
  t.is(tree.root?.key, 2)
})

/**
 *       c
 *      / \           _b_
 *     a   z         /   \
 *    / \     ->    a     c
 *   w   b         / \   / \
 *      / \       w   x y   z
 *     x   y
 */
test("should correctly balance the left right case", function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: compare,
  })
  tree = tree.insert(3, 1)
  tree = tree.insert(1, 1)
  tree = tree.insert(2, 1)
  t.is(tree.root?.key, 2)
})

/**
 *     a
 *    / \               _b_
 *   w   b             /   \
 *      / \     ->    a     c
 *     x   c         / \   / \
 *        / \       w   x y   z
 *       y   z
 */
test("should correctly balance the right right case", function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: compare,
  })
  tree = tree.insert(1, 1)
  tree = tree.insert(2, 1)
  tree = tree.insert(3, 1)
  t.is(tree.root?.key, 2)
})

/**
 *     a
 *    / \             _b_
 *   w   c           /   \
 *      / \   ->    a     c
 *     b   z       / \   / \
 *    / \         w   x y   z
 *   x   y
 */
test("should correctly balance the right left case", function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: compare,
  })
  tree = tree.insert(1, 1)
  tree = tree.insert(3, 1)
  tree = tree.insert(2, 1)
  t.is(tree.root?.key, 2)
})
