/*

TODO
- [x] make this thing immutable
- [x] migrate the rest of the tests.
  - [x] better DevX with classes. how to distinguish writes in batches?
  - [x] keep track of size.
  - [x] iterator type similar to red-black tree
  - [x] migrating custom-compare test to avl-tree3
    - [x] better size tests for remove()
  - [x] need to create better iterator ux
    - [x] find min, next
    - [x] find max, prev
    - [x] invalid iterator length 0 after .next(). node is nullable!
    - [x] forEach
    - [x] get method.
    - [x] for each method to iterate through the whole tree.
  - [x] migrate red-black tree tests
    - [ ] immutablility tests
    - [x] transaction number of writes test.
- [x] iterative instead of recursion.
  - [x] insert
  - [x] remove
- [x] cleanup vars
- [ ] make it async
  - [ ] run against leveldb
  - [ ] assemblyscript?
- [ ] benchmark

*/

import { Transaction, AvlNodeReadOnlyStore, AvlNodeStore } from "./storage"
import { randomId } from "./utils"

export interface AvlNode<K, V> {
  id: string
  leftId: string | undefined
  rightId: string | undefined
  key: K
  value: V
  height: number // Used internally by the AVL algorithm
  count: number
}

function clone<K, V>(node: AvlNode<K, V>): AvlNode<K, V> {
  const newNode = {
    ...node,
    id: randomId(),
  }
  return newNode
}

function leftHeight<K, V>(args: {
  transaction: Transaction<K, V>
  node: AvlNode<K, V>
}) {
  const { transaction, node } = args
  const left = transaction.get(node.leftId)
  if (!left) {
    return -1
  }
  return left.height
}

function rightHeight<K, V>(args: {
  transaction: Transaction<K, V>
  node: AvlNode<K, V>
}) {
  const { transaction, node } = args
  const right = transaction.get(node.rightId)
  if (!right) {
    return -1
  }
  return right.height
}

function leftCount<K, V>(args: {
  transaction: Transaction<K, V>
  node: AvlNode<K, V>
}) {
  const { transaction, node } = args
  const left = transaction.get(node.leftId)
  if (!left) {
    return 0
  }
  return left.count
}

function rightCount<K, V>(args: {
  transaction: Transaction<K, V>
  node: AvlNode<K, V>
}) {
  const { transaction, node } = args
  const right = transaction.get(node.rightId)
  if (!right) {
    return 0
  }
  return right.count
}

/**
 * Performs a right rotate on this node.
 *
 *       b                           a
 *      / \                         / \
 *     a   e -> b.rotateRight() -> c   b
 *    / \                             / \
 *   c   d                           d   e
 *
 */
function rotateRight<K, V>(args: {
  transaction: Transaction<K, V>
  root: AvlNode<K, V>
}) {
  const { transaction, root } = args
  if (!root.leftId) {
    throw Error("Cannot rotateRight without a left!")
  }
  const left = transaction.get(root.leftId)
  if (!left) {
    throw Error("Cannot rotateRight without a left!")
  }

  const a = clone(left)
  transaction.cleanup(left)
  const b = clone(root)
  transaction.cleanup(root)

  b.leftId = a.rightId
  a.rightId = b.id
  b.height =
    Math.max(
      leftHeight({ transaction, node: b }),
      rightHeight({ transaction, node: b })
    ) + 1
  a.height = Math.max(leftHeight({ transaction, node: a }), b.height) + 1
  b.count =
    leftCount({ transaction, node: b }) +
    rightCount({ transaction, node: b }) +
    1
  a.count = leftCount({ transaction, node: a }) + b.count + 1

  transaction.set(a)
  transaction.set(b)
  return a
}

/**
 * Performs a left rotate on this node.
 *
 *     a                              b
 *    / \                            / \
 *   c   b   -> a.rotateLeft() ->   a   e
 *      / \                        / \
 *     d   e                      c   d
 *
 */
function rotateLeft<K, V>(args: {
  transaction: Transaction<K, V>
  root: AvlNode<K, V>
}) {
  const { transaction, root } = args
  if (!root.rightId) {
    throw Error("Cannot rotateRight without a right!")
  }
  const right = transaction.get(root.rightId)
  if (!right) {
    throw Error("Cannot rotateRight without a right!")
  }

  const b = clone(right)
  transaction.cleanup(right)
  const a = clone(root)
  transaction.cleanup(root)

  a.rightId = b.leftId
  b.leftId = a.id
  a.height =
    Math.max(
      leftHeight({ transaction, node: a }),
      rightHeight({ transaction, node: a })
    ) + 1
  b.height = Math.max(rightHeight({ transaction, node: b }), a.height) + 1

  a.count =
    leftCount({ transaction, node: a }) +
    rightCount({ transaction, node: a }) +
    1
  b.count = rightCount({ transaction, node: b }) + a.count + 1

  transaction.set(a)
  transaction.set(b)
  return b
}

type Compare<K> = (a: K, b: K) => number

/**
 * Find the path to a key or as close as possible.
 */
function findPath<K, V>(args: {
  store: AvlNodeReadOnlyStore<K, V>
  compare: Compare<K>
  root: AvlNode<K, V>
  key: K
}) {
  const { store, compare, root, key } = args
  const stack: Array<AvlNode<K, V>> = []
  let node: AvlNode<K, V> | undefined = root
  while (node) {
    stack.push(node)
    const direction = compare(key, node.key)
    if (direction < 0) {
      node = store.get(node.leftId)
    } else if (direction > 0) {
      node = store.get(node.rightId)
    } else {
      node = undefined
    }
  }
  return stack
}

function clonePath<K, V>(path: Array<AvlNode<K, V>>) {
  const newPath = [...path]
  // Clone the entire path.
  newPath[0] = clone(newPath[0])
  for (let i = 1; i < newPath.length; i++) {
    const prev = newPath[i - 1]
    const node = newPath[i]
    const newNode = clone(newPath[i])
    if (prev.leftId === node.id) {
      prev.leftId = newNode.id
    } else {
      prev.rightId = newNode.id
    }
    newPath[i] = newNode
  }
  return newPath
}

export function insert<K, V>(args: {
  transaction: Transaction<K, V>
  root: AvlNode<K, V> | undefined
  compare: Compare<K>
  key: K
  value: V
}): AvlNode<K, V> {
  const { transaction, root, compare, key, value } = args

  // Root doesn't exist.
  if (root === undefined) {
    const newNode: AvlNode<K, V> = {
      id: randomId(),
      leftId: undefined,
      rightId: undefined,
      key: key,
      value: value,
      height: 0,
      count: 1,
    }
    transaction.set(newNode)
    return newNode
  }

  // Find the path to where we want to insert.
  const stack = clonePath(findPath({ store: transaction, compare, root, key }))

  // Insert at the end of the stack.
  const last = stack[stack.length - 1]
  const direction = compare(key, last.key)

  // Found an exact match, no need to rebalance.
  if (direction === 0) {
    // Set the value of the last node.
    stack[stack.length - 1].value = value
    // Save the new path.
    for (const node of stack) {
      transaction.set(node)
    }
    // Return the new root.
    return stack[0]
  }

  // Insert new key-value node.
  const newNode: AvlNode<K, V> = {
    id: randomId(),
    leftId: undefined,
    rightId: undefined,
    key: key,
    value: value,
    height: 0,
    count: 1,
  }
  if (direction < 0) {
    last.leftId = newNode.id
  } else {
    last.rightId = newNode.id
  }
  stack.push(newNode)

  // Save the new path.
  for (const node of stack) {
    transaction.set(node)
  }

  // Balance the tree.
  while (stack.length > 1) {
    // Warning: rebalancing is going to make the rest of the stack invalid.
    // That is why we're using `pop()` to ensure that we don't use it anymore.
    const node = stack.pop()!
    const newNode = rebalanceInsert({ transaction, compare, key, node })

    // Update pointer from the previous node.
    if (node.id !== newNode.id) {
      const prev = stack[stack.length - 1]
      if (prev.leftId === node.id) {
        prev.leftId = newNode.id
      } else {
        prev.rightId = newNode.id
      }
    }
  }
  return rebalanceInsert({ transaction, compare, key, node: stack[0] })
}

function rebalanceInsert<K, V>(args: {
  transaction: Transaction<K, V>
  compare: Compare<K>
  key: K
  node: AvlNode<K, V>
}) {
  const { transaction, compare, key, node } = args

  // Update height and rebalance tree
  node.height =
    Math.max(
      leftHeight({ transaction, node }),
      rightHeight({ transaction, node })
    ) + 1
  node.count =
    leftCount({ transaction, node }) + rightCount({ transaction, node }) + 1

  const balanceState = getBalanceState({ transaction, node })

  if (balanceState === BalanceState.UNBALANCED_LEFT) {
    const left = transaction.get(node.leftId)!
    const direction = compare(key, left.key)
    if (direction < 0) {
      // Left left case
      return rotateRight({ transaction, root: node })
    } else {
      // Left right case
      node.leftId = rotateLeft({ transaction, root: left }).id
      return rotateRight({ transaction, root: node })
    }
  }

  if (balanceState === BalanceState.UNBALANCED_RIGHT) {
    const right = transaction.get(node.rightId)!
    const direction = compare(key, right.key)
    if (direction > 0) {
      // Right right case
      return rotateLeft({ transaction, root: node })
    } else {
      // Right left case
      node.rightId = rotateRight({ transaction, root: right }).id
      return rotateLeft({ transaction, root: node })
    }
  }

  return node
}

export function remove<K, V>(args: {
  transaction: Transaction<K, V>
  root: AvlNode<K, V> | undefined
  compare: Compare<K>
  key: K
}): AvlNode<K, V> | undefined {
  const { transaction, root, compare, key } = args

  // Empty tree.
  if (root === undefined) {
    return
  }

  const stack = clonePath(findPath({ store: transaction, compare, root, key }))
  const last = stack.pop()!
  const prev = stack[stack.length - 1]

  // Key not found.
  if (compare(key, last.key) !== 0) {
    return root
  }

  // Save the new path.
  for (const node of stack) {
    transaction.set(node)
  }

  // Remove from the end of the stack.
  const left = transaction.get(last.leftId)
  const right = transaction.get(last.rightId)

  if (!left && !right) {
    // Update pointer from the previous node.
    if (prev) {
      if (prev.leftId === last.id) {
        prev.leftId = undefined
      } else {
        prev.rightId = undefined
      }
    } else {
      return undefined
    }
  } else if (!left && right) {
    // Update pointer from the previous node.
    if (prev) {
      if (prev.leftId === last.id) {
        prev.leftId = right.id
      } else {
        prev.rightId = right.id
      }
    } else {
      const newRoot = clone(right)
      transaction.set(newRoot)
      stack.push(newRoot)
    }
  } else if (left && !right) {
    // Update pointer from the previous node.
    if (prev) {
      if (prev.leftId === last.id) {
        prev.leftId = left.id
      } else {
        prev.rightId = left.id
      }
    } else {
      const newRoot = clone(left)
      transaction.set(newRoot)
      stack.push(newRoot)
    }
  } else if (left && right) {
    // Node has 2 children, get the in-order successor.
    const inOrderSuccessor = minNode({ transaction, root: right })
    last.key = inOrderSuccessor.key
    last.value = inOrderSuccessor.value

    // Note: this will never recur more than once because we've already
    // found the key we want to remove.
    const newRight = remove({
      transaction,
      compare,
      root: right,
      key: inOrderSuccessor.key,
    })
    last.rightId = newRight?.id
    transaction.set(last)
    stack.push(last)
  }

  // Balance the tree.
  while (stack.length > 1) {
    // Warning: rebalancing is going to make the rest of the stack invalid.
    // That is why we're using `pop()` to ensure that we don't use it anymore.
    const node = stack.pop()!
    const newNode = rebalanceRemove({ transaction, node })

    // Update pointer from the previous node.
    if (node.id !== newNode.id) {
      const prev = stack[stack.length - 1]
      if (prev.leftId === node.id) {
        prev.leftId = newNode.id
      } else {
        prev.rightId = newNode.id
      }
    }
  }
  return rebalanceRemove({ transaction, node: stack[0] })
}

function rebalanceRemove<K, V>(args: {
  transaction: Transaction<K, V>
  node: AvlNode<K, V>
}) {
  const { transaction, node } = args

  // Update height and rebalance tree
  node.height =
    Math.max(
      leftHeight({ transaction, node: node }),
      rightHeight({ transaction, node: node })
    ) + 1
  node.count =
    leftCount({ transaction, node: node }) +
    rightCount({ transaction, node: node }) +
    1

  const balanceState = getBalanceState({ transaction, node: node })
  if (balanceState === BalanceState.UNBALANCED_LEFT) {
    const left = transaction.get(node.leftId)
    if (!left) {
      throw new Error("Left must exist!")
    }
    // Left left case
    if (
      getBalanceState({ transaction, node: left }) === BalanceState.BALANCED ||
      getBalanceState({ transaction, node: left }) ===
        BalanceState.SLIGHTLY_UNBALANCED_LEFT
    ) {
      return rotateRight({ transaction, root: node })
    }
    // Left right case
    if (
      getBalanceState({ transaction, node: left }) ===
      BalanceState.SLIGHTLY_UNBALANCED_RIGHT
    ) {
      node.leftId = rotateLeft({ transaction, root: left }).id
      return rotateRight({ transaction, root: node })
    }
  }

  if (balanceState === BalanceState.UNBALANCED_RIGHT) {
    const right = transaction.get(node.rightId)
    if (!right) {
      throw new Error("Right must exist!")
    }

    // Right right case
    if (
      getBalanceState({ transaction, node: right }) === BalanceState.BALANCED ||
      getBalanceState({ transaction, node: right }) ===
        BalanceState.SLIGHTLY_UNBALANCED_RIGHT
    ) {
      return rotateLeft({ transaction, root: node })
    }
    // Right left case
    if (
      getBalanceState({ transaction, node: right }) ===
      BalanceState.SLIGHTLY_UNBALANCED_LEFT
    ) {
      node.rightId = rotateRight({ transaction, root: right }).id
      return rotateLeft({ transaction, root: node })
    }
  }

  return node
}

/**
 * Gets the minimum node, rooted in a particular node.
 */
function minNode<K, V>(args: {
  transaction: Transaction<K, V>
  root: AvlNode<K, V>
}) {
  const { transaction, root } = args
  let current = root
  let left: AvlNode<K, V> | undefined
  while ((left = transaction.get(current.leftId))) {
    current = left
  }
  return current
}

/**
 * Gets the maximum node, rooted in a particular node.
 */
function maxNode<K, V>(args: {
  transaction: Transaction<K, V>
  root: AvlNode<K, V>
}) {
  const { transaction, root } = args
  let current = root
  let right: AvlNode<K, V> | undefined
  while ((right = transaction.get(current.rightId))) {
    current = right
  }
  return current
}

/**
 * Represents how balanced a node's left and right children are.
 */
const BalanceState = {
  UNBALANCED_RIGHT: 1,
  SLIGHTLY_UNBALANCED_RIGHT: 2,
  BALANCED: 3,
  SLIGHTLY_UNBALANCED_LEFT: 4,
  UNBALANCED_LEFT: 5,
}

/**
 * Gets the balance state of a node, indicating whether the left or right
 * sub-trees are unbalanced.
 */
function getBalanceState<K, V>(args: {
  transaction: Transaction<K, V>
  node: AvlNode<K, V>
}) {
  const heightDifference = leftHeight(args) - rightHeight(args)
  switch (heightDifference) {
    case -2:
      return BalanceState.UNBALANCED_RIGHT
    case -1:
      return BalanceState.SLIGHTLY_UNBALANCED_RIGHT
    case 1:
      return BalanceState.SLIGHTLY_UNBALANCED_LEFT
    case 2:
      return BalanceState.UNBALANCED_LEFT
    default:
      return BalanceState.BALANCED
  }
}

/**
 * A convenient abstraction that isn't quite so functional.
 */
export class AvlTree<K, V> {
  store: AvlNodeStore<K, V>
  root: AvlNode<K, V> | undefined
  compare: Compare<K>

  constructor(args: {
    store: AvlNodeStore<K, V>
    root: AvlNode<K, V> | undefined
    compare: Compare<K>
  }) {
    this.store = args.store
    this.root = args.root
    this.compare = args.compare
  }

  insert(key: K, value: V) {
    const transaction = new Transaction(this.store)
    const newRoot = insert({
      transaction,
      compare: this.compare,
      root: this.root,
      key: key,
      value: value,
    })
    transaction.commit()
    // TODO: this should be persisted.
    return new AvlTree({
      store: this.store,
      compare: this.compare,
      root: newRoot,
    })
  }

  remove(key: K) {
    const transaction = new Transaction(this.store)
    const newRoot = remove({
      transaction,
      compare: this.compare,
      root: this.root,
      key,
    })
    transaction.commit()
    // TODO: this should be persisted.
    return new AvlTree({
      store: this.store,
      compare: this.compare,
      root: newRoot,
    })
  }

  get(key: K): V | undefined {
    const { store, root, compare } = this
    let node = root
    while (node) {
      const direction = compare(key, node.key)
      if (direction < 0) {
        node = store.get(node.leftId)
      } else if (direction > 0) {
        node = store.get(node.rightId)
      } else {
        return node.value
      }
    }
  }

  find(key: K): AvlTreeIterator<K, V> {
    if (!this.root) {
      return new AvlTreeIterator({ tree: this, stack: [] })
    }
    const stack = findPath({
      store: this.store,
      compare: this.compare,
      root: this.root,
      key,
    })
    const last = stack[stack.length - 1]
    if (this.compare(key, last.key) === 0) {
      return new AvlTreeIterator({ tree: this, stack })
    } else {
      return new AvlTreeIterator({ tree: this, stack: [] })
    }
  }

  begin(): AvlTreeIterator<K, V> {
    let node = this.root
    const stack: Array<AvlNode<K, V>> = []
    while (node) {
      stack.push(node)
      node = this.store.get(node.leftId)
    }
    return new AvlTreeIterator({ tree: this, stack })
  }

  end(): AvlTreeIterator<K, V> {
    let node = this.root
    const stack: Array<AvlNode<K, V>> = []
    while (node) {
      stack.push(node)
      node = this.store.get(node.rightId)
    }
    return new AvlTreeIterator({ tree: this, stack })
  }

  /**
   * Find the nth item in the tree.
   */
  at(idx: number): AvlTreeIterator<K, V> {
    const root = this.root
    if (idx < 0 || !root) {
      return new AvlTreeIterator({ tree: this, stack: [] })
    }
    let node = root
    const stack: Array<AvlNode<K, V>> = []
    while (true) {
      stack.push(node)
      const left = this.store.get(node.leftId)
      if (left) {
        if (idx < left.count) {
          node = left
          continue
        }
        idx -= left.count
      }
      if (!idx) {
        return new AvlTreeIterator({ tree: this, stack: stack })
      }
      idx -= 1
      const right = this.store.get(node.rightId)
      if (right) {
        if (idx >= right.count) {
          break
        }
        node = right
      } else {
        break
      }
    }
    return new AvlTreeIterator({ tree: this, stack: [] })
  }

  ge(key: K): AvlTreeIterator<K, V> {
    let node = this.root
    const stack: Array<AvlNode<K, V>> = []
    let last_ptr = 0
    while (node) {
      let direction = this.compare(key, node.key)
      stack.push(node)
      if (direction <= 0) {
        last_ptr = stack.length
      }
      if (direction <= 0) {
        node = this.store.get(node.leftId)
      } else {
        node = this.store.get(node.rightId)
      }
    }
    // TODO: this feels sketchy
    stack.length = last_ptr
    return new AvlTreeIterator({ tree: this, stack })
  }

  gt(key: K): AvlTreeIterator<K, V> {
    let node = this.root
    const stack: Array<AvlNode<K, V>> = []
    let last_ptr = 0
    while (node) {
      let direction = this.compare(key, node.key)
      stack.push(node)
      if (direction < 0) {
        last_ptr = stack.length
      }
      if (direction < 0) {
        node = this.store.get(node.leftId)
      } else {
        node = this.store.get(node.rightId)
      }
    }
    // TODO: this feels sketchy
    stack.length = last_ptr
    return new AvlTreeIterator({ tree: this, stack })
  }

  lt(key: K): AvlTreeIterator<K, V> {
    let node = this.root
    const stack: Array<AvlNode<K, V>> = []
    let last_ptr = 0
    while (node) {
      let direction = this.compare(key, node.key)
      stack.push(node)
      if (direction > 0) {
        last_ptr = stack.length
      }
      if (direction <= 0) {
        node = this.store.get(node.leftId)
      } else {
        node = this.store.get(node.rightId)
      }
    }
    // TODO: this feels sketchy
    stack.length = last_ptr
    return new AvlTreeIterator({ tree: this, stack })
  }

  le(key: K): AvlTreeIterator<K, V> {
    let node = this.root
    const stack: Array<AvlNode<K, V>> = []
    let last_ptr = 0
    while (node) {
      let direction = this.compare(key, node.key)
      stack.push(node)
      if (direction >= 0) {
        last_ptr = stack.length
      }
      if (direction < 0) {
        node = this.store.get(node.leftId)
      } else {
        node = this.store.get(node.rightId)
      }
    }
    // TODO: this feels sketchy
    stack.length = last_ptr
    return new AvlTreeIterator({ tree: this, stack })
  }

  // This allows you to do forEach
  *[Symbol.iterator]() {
    let iter = this.begin()
    while (iter.valid) {
      yield iter.node!
      iter.next()
    }
  }

  walk() {
    return new AvlTreeWalker({
      store: this.store,
      node: this.root,
    })
  }

  // TODO: batch
  // TODO: scan
}

/**
 * Represents a path into an `AvlTreeIterator` with helpful methods for
 * traversing the tree.
 */
export class AvlTreeIterator<K, V> {
  tree: AvlTree<K, V>
  stack: Array<AvlNode<K, V>>

  constructor(args: { tree: AvlTree<K, V>; stack: Array<AvlNode<K, V>> }) {
    this.tree = args.tree
    this.stack = args.stack
  }

  /**
   * Node that the iterator is pointing to.
   */
  get node() {
    if (this.stack.length > 0) {
      return this.stack[this.stack.length - 1]
    }
  }

  /**
   * Makes a copy of an iterator.
   */
  clone(): AvlTreeIterator<K, V> {
    return new AvlTreeIterator({
      tree: this.tree,
      stack: [...this.stack],
    })
  }

  /**
   * Returns the position of the node this iterator is point to in the sorted list.
   */
  index() {
    let idx = 0
    let stack = this.stack
    if (stack.length === 0) {
      let r = this.tree.root
      if (r) {
        return r.count
      }
      return 0
    } else {
      const left = this.tree.store.get(stack[stack.length - 1].leftId)
      if (left) {
        idx = left.count
      }
    }
    for (let s = stack.length - 2; s >= 0; --s) {
      if (stack[s + 1].id === stack[s].rightId) {
        ++idx
        const left = this.tree.store.get(stack[s].leftId)
        if (left) {
          idx += left.count
        }
      }
    }
    return idx
  }

  /**
   * Advances iterator to next element in list.
   */
  next() {
    let stack = this.stack
    if (stack.length === 0) {
      throw new Error("Invalid iterator")
    }
    let n: AvlNode<K, V> | undefined = stack[stack.length - 1]
    const right = this.tree.store.get(n.rightId)
    if (right) {
      n = right
      while (n) {
        stack.push(n)
        n = this.tree.store.get(n.leftId)
      }
    } else {
      stack.pop()
      while (stack.length > 0 && stack[stack.length - 1].rightId === n.id) {
        n = stack[stack.length - 1]
        stack.pop()
      }
    }
  }

  /**
   * Moves iterator backward one element.
   */
  prev() {
    const stack = this.stack
    if (stack.length === 0) {
      throw new Error("Invalid iterator")
    }
    let n: AvlNode<K, V> | undefined = stack[stack.length - 1]
    const left = this.tree.store.get(n.leftId)
    if (left) {
      n = left
      while (n) {
        stack.push(n)
        n = this.tree.store.get(n.rightId)
      }
    } else {
      stack.pop()
      while (stack.length > 0 && stack[stack.length - 1].leftId === n.id) {
        n = stack[stack.length - 1]
        stack.pop()
      }
    }
  }

  /**
   * Checks if iterator is at end of tree.
   */
  get hasNext() {
    const stack = this.stack
    if (stack.length === 0) {
      return false
    }
    if (stack[stack.length - 1].rightId) {
      return true
    }
    for (let s = stack.length - 1; s > 0; --s) {
      if (stack[s - 1].leftId === stack[s].id) {
        return true
      }
    }
    return false
  }

  /**
   * Checks if iterator is at start of tree.
   */
  get hasPrev() {
    const stack = this.stack
    if (stack.length === 0) {
      return false
    }
    if (stack[stack.length - 1].leftId) {
      return true
    }
    for (let s = stack.length - 1; s > 0; --s) {
      if (stack[s - 1].rightId === stack[s].id) {
        return true
      }
    }
    return false
  }

  get valid() {
    return this.stack.length !== 0
  }
}

/**
 * A helper method for walking a a tree.
 */
export class AvlTreeWalker<K, V> {
  store: AvlNodeStore<K, V>
  node: AvlNode<K, V> | undefined

  constructor(args: {
    store: AvlNodeStore<K, V>
    node: AvlNode<K, V> | undefined
  }) {
    this.store = args.store
    this.node = args.node
  }

  get left() {
    if (this.node) {
      const left = this.store.get(this.node.leftId)
      if (left) {
        return new AvlTreeWalker({
          store: this.store,
          node: left,
        })
      }
    }
  }

  get right() {
    if (this.node) {
      const right = this.store.get(this.node.rightId)
      if (right) {
        return new AvlTreeWalker({
          store: this.store,
          node: right,
        })
      }
    }
  }
}

function printNode<K, V>(
  node: AvlNode<K, V> | undefined,
  store: AvlNodeReadOnlyStore<K, V>,
  indent = ""
): any {
  if (!node) {
    return
  }
  return [
    indent + node.key + "(" + node.count + ")",
    printNode(store.get(node?.leftId), store, indent + "l:"),
    printNode(store.get(node?.rightId), store, indent + "r:"),
  ]
    .filter(Boolean)
    .join("\n")
}

export function printTree<K, V>(t: AvlTree<K, V>) {
  return printNode(t.root, t.store)
}
