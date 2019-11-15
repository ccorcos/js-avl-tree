/*

TODO
- [x] make this thing immutable
- [x] migrate the rest of the tests.
  - [ ] better DevX with classes. how to distinguish writes in batches?
  - [ ] keep track of size.
  - [ ] iterator type similar to red-black tree
  - [ ] migrate red-black tree tests
  - [ ] immutablility tests
-  [ ] cleanup vars
- [ ] make it async
  - [ ] run against leveldb
- [ ] benchmark

*/

import { Transaction, AvlNodeReadOnlyStore } from "./storage"
import { randomId } from "./utils"

export interface AvlNode<K, V> {
  id: string
  leftId: string | undefined
  rightId: string | undefined
  height: number
  key: K
  value: V
  //  size: number // TODO
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

  var b = clone(right)
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

  transaction.set(a)
  transaction.set(b)
  return b
}

type Compare<K> = (a: K, b: K) => number

export function insert<K, V>(args: {
  transaction: Transaction<K, V>
  root: AvlNode<K, V> | undefined
  compare: Compare<K>
  key: K
  value: V
}): AvlNode<K, V> {
  const { transaction, root, compare, key, value } = args

  // Perform regular BST insertion
  if (root === undefined) {
    const newNode: AvlNode<K, V> = {
      id: randomId(),
      leftId: undefined,
      rightId: undefined,
      height: 0,
      key: key,
      value: value,
    }
    transaction.set(newNode)
    return newNode
  }

  const newRoot: AvlNode<K, V> = clone(root)
  transaction.cleanup(root)
  if (compare(key, root.key) < 0) {
    const left = transaction.get(root.leftId)
    const newLeft = insert({ transaction, compare, key, value, root: left })
    if (left) {
      transaction.cleanup(left)
    }
    newRoot.leftId = newLeft.id
  } else if (compare(key, root.key) > 0) {
    const right = transaction.get(root.rightId)
    const newRight = insert({ transaction, compare, key, value, root: right })
    if (right) {
      transaction.cleanup(right)
    }
    newRoot.rightId = newRight.id
  } else {
    // It's a duplicate so insertion failed, decrement size to make up for it
    // this._size--
    newRoot.value = value
    transaction.set(newRoot)
    return newRoot
  }

  // Update height and rebalance tree
  newRoot.height =
    Math.max(
      leftHeight({ transaction, node: newRoot }),
      rightHeight({ transaction, node: newRoot })
    ) + 1
  var balanceState = getBalanceState({ transaction, node: newRoot })

  if (balanceState === BalanceState.UNBALANCED_LEFT) {
    const left = transaction.get(newRoot.leftId)
    if (!left) {
      throw new Error("Left must exist.")
    }
    if (compare(key, left.key) < 0) {
      return rotateRight({ transaction, root: newRoot })
    } else {
      // Left right case
      newRoot.leftId = rotateLeft({ transaction, root: left }).id
      return rotateRight({ transaction, root: newRoot })
    }
  }

  if (balanceState === BalanceState.UNBALANCED_RIGHT) {
    const right = transaction.get(newRoot.rightId)
    if (!right) {
      throw new Error("Right must exist.")
    }

    if (compare(key, right.key) > 0) {
      // Right right case
      return rotateLeft({ transaction, root: newRoot })
    } else {
      // Right left case
      newRoot.rightId = rotateRight({ transaction, root: right }).id
      return rotateLeft({ transaction, root: newRoot })
    }
  }

  transaction.set(newRoot)
  return newRoot
}

export function remove<K, V>(args: {
  transaction: Transaction<K, V>
  root: AvlNode<K, V> | undefined
  compare: Compare<K>
  key: K
}): AvlNode<K, V> | undefined {
  const { transaction, root, compare, key } = args

  // Perform regular BST deletion
  if (root === undefined) {
    return root
  }

  let newRoot = clone(root)
  transaction.cleanup(root)

  if (compare(key, newRoot.key) < 0) {
    // The key to be deleted is in the left sub-tree
    const left = transaction.get(newRoot.leftId)
    const newLeft = remove({ transaction, compare, key, root: left })
    if (left) {
      transaction.cleanup(left)
    }
    newRoot.leftId = newLeft ? newLeft.id : undefined
  } else if (compare(key, newRoot.key) > 0) {
    // The key to be deleted is in the right sub-tree
    const right = transaction.get(newRoot.rightId)
    const newRight = remove({ transaction, compare, key, root: right })
    if (right) {
      transaction.cleanup(right)
    }
    newRoot.rightId = newRight ? newRight.id : undefined
  } else {
    // root is the node to be deleted
    const left = transaction.get(newRoot.leftId)
    const right = transaction.get(newRoot.rightId)
    if (!left && !right) {
      transaction.cleanup(newRoot)
      return undefined
    } else if (!left && right) {
      transaction.cleanup(newRoot)
      newRoot = right
    } else if (left && !right) {
      transaction.cleanup(newRoot)
      newRoot = left
    } else if (left && right) {
      // Node has 2 children, get the in-order successor
      var inOrderSuccessor = minNode({ transaction, root: right })
      newRoot.key = inOrderSuccessor.key
      newRoot.value = inOrderSuccessor.value
      const newRight = remove({ transaction, compare, root: right, key })
      transaction.cleanup(right)
      newRoot.rightId = newRight ? newRight.id : undefined
    }
  }

  // Update height and rebalance tree
  newRoot.height =
    Math.max(
      leftHeight({ transaction, node: newRoot }),
      rightHeight({ transaction, node: newRoot })
    ) + 1
  var balanceState = getBalanceState({ transaction, node: newRoot })

  if (balanceState === BalanceState.UNBALANCED_LEFT) {
    const left = transaction.get(newRoot.leftId)
    if (!left) {
      throw new Error("Left must exist!")
    }
    // Left left case
    if (
      getBalanceState({ transaction, node: left }) === BalanceState.BALANCED ||
      getBalanceState({ transaction, node: left }) ===
        BalanceState.SLIGHTLY_UNBALANCED_LEFT
    ) {
      return rotateRight({ transaction, root: newRoot })
    }
    // Left right case
    if (
      getBalanceState({ transaction, node: left }) ===
      BalanceState.SLIGHTLY_UNBALANCED_RIGHT
    ) {
      newRoot.leftId = rotateLeft({ transaction, root: left }).id
      return rotateRight({ transaction, root: newRoot })
    }
  }

  if (balanceState === BalanceState.UNBALANCED_RIGHT) {
    const right = transaction.get(newRoot.rightId)
    if (!right) {
      throw new Error("Right must exist!")
    }

    // Right right case
    if (
      getBalanceState({ transaction, node: right }) === BalanceState.BALANCED ||
      getBalanceState({ transaction, node: right }) ===
        BalanceState.SLIGHTLY_UNBALANCED_RIGHT
    ) {
      return rotateLeft({ transaction, root: newRoot })
    }
    // Right left case
    if (
      getBalanceState({ transaction, node: right }) ===
      BalanceState.SLIGHTLY_UNBALANCED_LEFT
    ) {
      newRoot.rightId = rotateRight({ transaction, root: right }).id
      return rotateLeft({ transaction, root: newRoot })
    }
  }

  return newRoot
}

/**
 * Gets the minimum node, rooted in a particular node.
 */
function minNode<K, V>(args: {
  transaction: Transaction<K, V>
  root: AvlNode<K, V>
}) {
  const { transaction, root } = args
  var current = root
  var left: AvlNode<K, V> | undefined
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
  var current = root
  var right: AvlNode<K, V> | undefined
  while ((right = transaction.get(current.rightId))) {
    current = right
  }
  return current
}

export function get<K, V>(args: {
  store: AvlNodeReadOnlyStore<K, V>
  compare: Compare<K>
  root: AvlNode<K, V> | undefined
  key: K
}): V | undefined {
  const { store, root, compare, key } = args

  if (root === undefined) {
    return undefined
  }

  const result = compare(key, root.key)

  if (result === 0) {
    return root.value
  }

  if (result < 0) {
    const left = store.get(root.leftId)
    if (!left) {
      return undefined
    }
    return get({ store, compare, key, root: left })
  }

  const right = store.get(root.rightId)
  if (!right) {
    return undefined
  }
  return get({ store, compare, key, root: right })
}

/**
 * Represents how balanced a node's left and right children are.
 */
var BalanceState = {
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
  var heightDifference = leftHeight(args) - rightHeight(args)
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
