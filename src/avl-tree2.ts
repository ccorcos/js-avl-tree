import { Node } from "./node"

function randomId() {
  return Math.round(Math.random() * 1e10).toString()
}

class InMemoryKeyValueStore {
  private map: Record<string, string> = {}
  get(key: string) {
    return this.map[key]
  }
  set(key: string, value: string) {
    this.map[key] = value
  }
  delete(key: string) {
    delete this.map[key]
  }
}

class AvlNodeStore<K, V> {
  private store: InMemoryKeyValueStore
  get(id: string | undefined): AvlNode<K, V> | undefined {
    if (id === undefined) {
      return
    }
    const result = this.store.get(id)
    if (result !== undefined) {
      return JSON.parse(result)
    }
  }
  set(node: AvlNode<K, V>) {
    this.store.set(node.id, JSON.stringify(node))
  }
  delete(id: string) {
    this.store.delete(id)
  }
}

interface AvlNode<K, V> {
  id: string
  leftId: string | undefined
  rightId: string | undefined
  height: number
  key: K
  value: V
  //  size: number // TODO
}

type Compare<K> = (a: K, b: K) => number

export class AvlTree<K, V> {
  // _size = 0

  constructor(
    private store: AvlNodeStore<K, V>,
    private compare: Compare<K> = defaultCompare,
    private rootId: string | undefined
  ) {}

  root() {
    return this.store.get(this.rootId)
  }

  insert(key: K, value: V) {
    const newRoot = this._insert(key, value, this.root())
    return new AvlTree(this.store, this.compare, newRoot.id)
    // this._size++
  }

  _insert(key: K, value: V, root: AvlNode<K, V> | undefined): AvlNode<K, V> {
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
      this.store.set(newNode)
      return newNode
    }

    let newRoot: AvlNode<K, V>
    if (this.compare(key, root.key) < 0) {
      const left = this.store.get(root.leftId)
      const newLeft = this._insert(key, value, left)
      newRoot = {
        ...root,
        id: randomId(),
        leftId: newLeft.id,
      }
    } else if (this.compare(key, root.key) > 0) {
      const right = this.store.get(root.rightId)
      const newRight = this._insert(key, value, right)
      newRoot = {
        ...root,
        id: randomId(),
        rightId: newRight.id,
      }
    } else {
      // It's a duplicate so insertion failed, decrement size to make up for it
      // this._size--
      newRoot = {
        ...root,
        id: randomId(),
        value: value,
      }
      this.store.set(newRoot)
      return newRoot
    }

    // Update height and rebalance tree
    newRoot.height =
      Math.max(this.leftHeight(newRoot), this.rightHeight(newRoot)) + 1

    var balanceState = this.getBalanceState(newRoot)

    // this.store.set(newRoot)

    if (balanceState === BalanceState.UNBALANCED_LEFT) {
      if (this.compare(key, newRoot.left!.key) < 0) {
        // Left left case
        newRoot = newRoot.rotateRight()
      } else {
        // Left right case
        newRoot.left = newRoot.left!.rotateLeft()
        return newRoot.rotateRight()
      }
    }

    if (balanceState === BalanceState.UNBALANCED_RIGHT) {
      if (this.compare(key, newRoot.right!.key) > 0) {
        // Right right case
        newRoot = newRoot.rotateLeft()
      } else {
        // Right left case
        newRoot.right = newRoot.right!.rotateRight()
        return newRoot.rotateLeft()
      }
    }

    return newRoot
  }

  leftHeight(node: AvlNode<K, V>) {
    const left = this.store.get(node.leftId)
    if (!left) {
      return -1
    }
    return left.height
  }

  rightHeight(node: AvlNode<K, V>) {
    const right = this.store.get(node.rightId)
    if (!right) {
      return -1
    }
    return right.height
  }

  /**
   * Gets the balance state of a node, indicating whether the left or right
   * sub-trees are unbalanced.
   *
   * @private
   * @param {Node} node The node to get the difference from.
   * @return {BalanceState} The BalanceState of the node.
   */
  getBalanceState(node: AvlNode<K, V>) {
    var heightDifference = this.leftHeight(node) - this.rightHeight(node)
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

  delete(key: K) {
    this.rootId = this._delete(key, this.rootId)
    // this._size--
  }

  _delete(key: K, root: Node<K, V> | undefined) {
    // Perform regular BST deletion
    if (root === undefined) {
      // this._size++
      return root
    }

    if (this.compare(key, root.key) < 0) {
      // The key to be deleted is in the left sub-tree
      root.left = this._delete(key, root.left)
    } else if (this.compare(key, root.key) > 0) {
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
    if (this.rootId === undefined) {
      return undefined
    }

    const node = this._get(key, this.rootId)
    if (node) {
      return node.value
    }
  }

  _get(key: K, root: Node<K, V>): Node<K, V> | undefined {
    var result = this.compare(key, root.key)

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
    if (this.rootId === undefined) {
      return false
    }

    return !!this._get(key, this.rootId)
  }

  findMinimum() {
    return minValueNode(this.rootId!).key
  }

  findMaximum() {
    return maxValueNode(this.rootId!).key
  }

  size() {
    // return this._size
  }

  isEmpty() {
    // return this._size === 0
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
