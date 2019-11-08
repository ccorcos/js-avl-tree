import { Node } from "./node"

export class AvlTree<K, V> {
  _root: Node<K, V> | undefined
  _size = 0

  constructor(private _compare: (a: K, b: K) => number = defaultCompare) {}

  insert(key: K, value: V) {
    this._root = this._insert(key, value, this._root)
    this._size++
  }

  _insert(key: K, value: V, root: Node<K, V> | undefined) {
    // Perform regular BST insertion
    if (root === undefined) {
      return new Node(key, value)
    }

    if (this._compare(key, root.key) < 0) {
      root.left = this._insert(key, value, root.left)
    } else if (this._compare(key, root.key) > 0) {
      root.right = this._insert(key, value, root.right)
    } else {
      // It's a duplicate so insertion failed, decrement size to make up for it
      this._size--
      return root
    }

    // Update height and rebalance tree
    root.height = Math.max(root.leftHeight(), root.rightHeight()) + 1
    var balanceState = getBalanceState(root)

    if (balanceState === BalanceState.UNBALANCED_LEFT) {
      if (this._compare(key, root.left!.key) < 0) {
        // Left left case
        root = root.rotateRight()
      } else {
        // Left right case
        root.left = root.left!.rotateLeft()
        return root.rotateRight()
      }
    }

    if (balanceState === BalanceState.UNBALANCED_RIGHT) {
      if (this._compare(key, root.right!.key) > 0) {
        // Right right case
        root = root.rotateLeft()
      } else {
        // Right left case
        root.right = root.right!.rotateRight()
        return root.rotateLeft()
      }
    }

    return root
  }

  delete(key: K) {
    this._root = this._delete(key, this._root)
    this._size--
  }

  _delete(key: K, root: Node<K, V> | undefined) {
    // Perform regular BST deletion
    if (root === undefined) {
      this._size++
      return root
    }

    if (this._compare(key, root.key) < 0) {
      // The key to be deleted is in the left sub-tree
      root.left = this._delete(key, root.left)
    } else if (this._compare(key, root.key) > 0) {
      // The key to be deleted is in the right sub-tree
      root.right = this._delete(key, root.right)
    } else {
      // root is the node to be deleted
      if (!root.left && !root.right) {
        root = undefined
      } else if (!root.left && root.right) {
        root = root.right
      } else if (root.left && !root.right) {
        root = root.left
      } else {
        // Node has 2 children, get the in-order successor
        var inOrderSuccessor = minValueNode(root.right!)
        root.key = inOrderSuccessor.key
        root.value = inOrderSuccessor.value
        root.right = this._delete(inOrderSuccessor.key, root.right)
      }
    }

    if (root === undefined) {
      return root
    }

    // Update height and rebalance tree
    root.height = Math.max(root.leftHeight(), root.rightHeight()) + 1
    var balanceState = getBalanceState(root)

    if (balanceState === BalanceState.UNBALANCED_LEFT) {
      // Left left case
      if (
        getBalanceState(root.left!) === BalanceState.BALANCED ||
        getBalanceState(root.left!) === BalanceState.SLIGHTLY_UNBALANCED_LEFT
      ) {
        return root.rotateRight()
      }
      // Left right case
      if (
        getBalanceState(root.left!) === BalanceState.SLIGHTLY_UNBALANCED_RIGHT
      ) {
        root.left = root.left!.rotateLeft()
        return root.rotateRight()
      }
    }

    if (balanceState === BalanceState.UNBALANCED_RIGHT) {
      // Right right case
      if (
        getBalanceState(root.right!) === BalanceState.BALANCED ||
        getBalanceState(root.right!) === BalanceState.SLIGHTLY_UNBALANCED_RIGHT
      ) {
        return root.rotateLeft()
      }
      // Right left case
      if (
        getBalanceState(root.right!) === BalanceState.SLIGHTLY_UNBALANCED_LEFT
      ) {
        root.right = root.right!.rotateRight()
        return root.rotateLeft()
      }
    }

    return root
  }
  get(key: K) {
    if (this._root === undefined) {
      return undefined
    }

    const node = this._get(key, this._root)
    if (node) {
      return node.value
    }
  }

  _get(key: K, root: Node<K, V>): Node<K, V> | undefined {
    var result = this._compare(key, root.key)

    if (result === 0) {
      return root
    }

    if (result < 0) {
      if (!root.left) {
        return undefined
      }
      return this._get(key, root.left)
    }

    if (!root.right) {
      return undefined
    }
    return this._get(key, root.right)
  }

  contains(key: K) {
    if (this._root === undefined) {
      return false
    }

    return !!this._get(key, this._root)
  }

  findMinimum() {
    return minValueNode(this._root!).key
  }

  findMaximum() {
    return maxValueNode(this._root!).key
  }

  size() {
    return this._size
  }

  isEmpty() {
    return this._size === 0
  }
}

/**
 * Gets the minimum value node, rooted in a particular node.
 */
function minValueNode<K, V>(root: Node<K, V>) {
  var current = root
  while (current.left) {
    current = current.left
  }
  return current
}

/**
 * Gets the maximum value node, rooted in a particular node.
 */
function maxValueNode<K, V>(root: Node<K, V>) {
  var current = root
  while (current.right) {
    current = current.right
  }
  return current
}

/**
 * Represents how balanced a node's left and right children are.
 *
 * @private
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
 *
 * @private
 * @param {Node} node The node to get the difference from.
 * @return {BalanceState} The BalanceState of the node.
 */
function getBalanceState<K, V>(node: Node<K, V>) {
  var heightDifference = node.leftHeight() - node.rightHeight()
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
 * Compares two keys with each other.
 * Returns -1, 0 or 1 if a < b, a == b or a > b respectively.
 */
function defaultCompare<K>(a: K, b: K): number {
  if (a > b) {
    return 1
  }
  if (a < b) {
    return -1
  }
  return 0
}
