import test from "ava"
import { AvlTree } from "../src/avl-test-helpers"
import { compare } from "../src/utils"
import { InMemoryKeyValueStore } from "../storage/memory"

const store = new InMemoryKeyValueStore<any>()

test("should not change the size of a tree with no root", async function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: compare,
  })
  tree = await tree.remove(1)
  t.is(tree.root, undefined)
})

test("should delete a single key", async function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: compare,
  })
  tree = await tree.insert(1, 1)
  tree = await tree.remove(1)
  t.is(tree.root, undefined)
})

/**
 *       _4_                       _2_
 *      /   \                     /   \
 *     2     6  -> delete(6) ->  1     4
 *    / \                             /
 *   1   3                           3
 */
test("should correctly balance the left left case", async function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: compare,
  })
  tree = await tree.insert(4, 4)
  tree = await tree.insert(2, 2)
  tree = await tree.insert(6, 6)
  tree = await tree.insert(3, 3)
  tree = await tree.insert(5, 5)
  tree = await tree.insert(1, 1)
  tree = await tree.insert(7, 7)
  tree = await tree.remove(7)
  tree = await tree.remove(5)
  tree = await tree.remove(6)
  t.is(tree.root?.key, 2)
  t.is(tree.root?.value, 2)
  t.is((await tree.walk().left.node)?.key, 1)
  t.is((await tree.walk().left.node)?.value, 1)
  t.is((await tree.walk().right.node)?.key, 4)
  t.is((await tree.walk().right.node)?.value, 4)
  t.is((await tree.walk().right.left.node)?.key, 3)
  t.is((await tree.walk().right.left.node)?.value, 3)
})

/**
 *       _4_                       _6_
 *      /   \                     /   \
 *     2     6  -> delete(2) ->  4     7
 *          / \                   \
 *         5   7                  5
 */
test("should correctly balance the right right case", async function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: compare,
  })
  tree = await tree.insert(4, 4)
  tree = await tree.insert(2, 2)
  tree = await tree.insert(6, 6)
  tree = await tree.insert(3, 3)
  tree = await tree.insert(5, 5)
  tree = await tree.insert(1, 1)
  tree = await tree.insert(7, 7)
  tree = await tree.remove(1)
  tree = await tree.remove(3)
  tree = await tree.remove(2)
  t.is(tree.root?.key, 6)
  t.is(tree.root?.value, 6)
  t.is((await tree.walk().left.node)?.key, 4)
  t.is((await tree.walk().left.node)?.value, 4)
  t.is((await tree.walk().left.right.node)?.key, 5)
  t.is((await tree.walk().left.right.node)?.value, 5)
  t.is((await tree.walk().right.node)?.key, 7)
  t.is((await tree.walk().right.node)?.value, 7)
})

/**
 *       _6_                       _4_
 *      /   \                     /   \
 *     2     7  -> delete(8) ->  2     6
 *    / \     \                 / \   / \
 *   1   4     8               1   3 5   7
 *      / \
 *     3   5
 */
test("should correctly balance the left right case", async function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: compare,
  })
  tree = await tree.insert(6, 6)
  tree = await tree.insert(2, 2)
  tree = await tree.insert(7, 7)
  tree = await tree.insert(1, 1)
  tree = await tree.insert(8, 8)
  tree = await tree.insert(4, 4)
  tree = await tree.insert(3, 3)
  tree = await tree.insert(5, 5)
  tree = await tree.remove(8)
  t.is(tree.root?.key, 4)
  t.is(tree.root?.value, 4)
  t.is((await tree.walk().left.node)?.key, 2)
  t.is((await tree.walk().left.node)?.value, 2)
  t.is((await tree.walk().left.left.node)?.key, 1)
  t.is((await tree.walk().left.left.node)?.value, 1)
  t.is((await tree.walk().left.right.node)?.key, 3)
  t.is((await tree.walk().left.right.node)?.value, 3)
  t.is((await tree.walk().right.node)?.key, 6)
  t.is((await tree.walk().right.node)?.value, 6)
  t.is((await tree.walk().right.left.node)?.key, 5)
  t.is((await tree.walk().right.left.node)?.value, 5)
  t.is((await tree.walk().right.right.node)?.key, 7)
  t.is((await tree.walk().right.right.node)?.value, 7)
})

/**
 *       _3_                       _5_
 *      /   \                     /   \
 *     2     7  -> delete(1) ->  3     7
 *    /     / \                 / \   / \
 *   1     5   8               2   4 6   8
 *        / \
 *       4   6
 */
test("should correctly balance the right left case", async function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: compare,
  })
  tree = await tree.insert(3, 3)
  tree = await tree.insert(2, 2)
  tree = await tree.insert(7, 7)
  tree = await tree.insert(1, 1)
  tree = await tree.insert(8, 8)
  tree = await tree.insert(5, 5)
  tree = await tree.insert(4, 4)
  tree = await tree.insert(6, 6)
  tree = await tree.remove(1)
  t.is(tree.root?.key, 5)
  t.is(tree.root?.value, 5)
  t.is((await tree.walk().left.node)?.key, 3)
  t.is((await tree.walk().left.node)?.value, 3)
  t.is((await tree.walk().left.left.node)?.key, 2)
  t.is((await tree.walk().left.left.node)?.value, 2)
  t.is((await tree.walk().left.right.node)?.key, 4)
  t.is((await tree.walk().left.right.node)?.value, 4)
  t.is((await tree.walk().right.node)?.key, 7)
  t.is((await tree.walk().right.node)?.value, 7)
  t.is((await tree.walk().right.left.node)?.key, 6)
  t.is((await tree.walk().right.left.node)?.value, 6)
  t.is((await tree.walk().right.right.node)?.key, 8)
  t.is((await tree.walk().right.right.node)?.value, 8)
})

test("should take the right child if the left does not exist", async function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: compare,
  })
  tree = await tree.insert(1, 1)
  tree = await tree.insert(2, 2)
  tree = await tree.remove(1)
  t.is(tree.root?.key, 2)
  t.is(tree.root?.value, 2)
})

test("should take the left child if the right does not exist", async function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: compare,
  })
  tree = await tree.insert(2, 2)
  tree = await tree.insert(1, 1)
  tree = await tree.remove(2)
  t.is(tree.root?.key, 1)
  t.is(tree.root?.value, 1)
})

test("should get the right child if the node has 2 leaf children", async function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: compare,
  })
  tree = await tree.insert(2, 2)
  tree = await tree.insert(1, 1)
  tree = await tree.insert(3, 3)
  tree = await tree.remove(2)
  t.is(tree.root?.key, 3)
  t.is(tree.root?.value, 3)
})

test("should get the in-order successor if the node has both children", async function(t) {
  let tree = new AvlTree<number, number>({
    store: store,
    root: undefined,
    compare: compare,
  })
  tree = await tree.insert(2, 2)
  tree = await tree.insert(1, 1)
  tree = await tree.insert(4, 4)
  tree = await tree.insert(3, 3)
  tree = await tree.insert(5, 5)
  tree = await tree.remove(2)
  t.is(tree.root?.key, 3)
  t.is(tree.root?.value, 3)
})
