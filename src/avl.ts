import { randomId } from "./utils"
import { AvlNode, AvlNodeReadableStorage, AvlNodeTransaction } from "./storage"

type Compare<K> = (a: K, b: K) => number

async function leftHeight<K, V>(args: {
  transaction: AvlNodeTransaction<K, V>
  node: AvlNode<K, V>
}) {
  const { transaction, node } = args
  const left = await transaction.get(node.leftId)
  if (!left) {
    return -1
  }
  return left.height
}

async function rightHeight<K, V>(args: {
  transaction: AvlNodeTransaction<K, V>
  node: AvlNode<K, V>
}) {
  const { transaction, node } = args
  const right = await transaction.get(node.rightId)
  if (!right) {
    return -1
  }
  return right.height
}

async function leftCount<K, V>(args: {
  transaction: AvlNodeTransaction<K, V>
  node: AvlNode<K, V>
}) {
  const { transaction, node } = args
  const left = await transaction.get(node.leftId)
  if (!left) {
    return 0
  }
  return left.count
}

async function rightCount<K, V>(args: {
  transaction: AvlNodeTransaction<K, V>
  node: AvlNode<K, V>
}) {
  const { transaction, node } = args
  const right = await transaction.get(node.rightId)
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
async function rotateRight<K, V>(args: {
  transaction: AvlNodeTransaction<K, V>
  root: AvlNode<K, V>
}) {
  const { transaction, root } = args
  if (!root.leftId) {
    throw Error("Cannot rotateRight without a left!")
  }
  const left = await transaction.get(root.leftId)
  if (!left) {
    throw Error("Cannot rotateRight without a left!")
  }

  const a = transaction.clone(left)
  const b = transaction.clone(root)

  b.leftId = a.rightId
  a.rightId = b.id
  b.height =
    Math.max(
      await leftHeight({ transaction, node: b }),
      await rightHeight({ transaction, node: b })
    ) + 1
  a.height = Math.max(await leftHeight({ transaction, node: a }), b.height) + 1
  b.count =
    (await leftCount({ transaction, node: b })) +
    (await rightCount({ transaction, node: b })) +
    1
  a.count = (await leftCount({ transaction, node: a })) + b.count + 1

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
async function rotateLeft<K, V>(args: {
  transaction: AvlNodeTransaction<K, V>
  root: AvlNode<K, V>
}) {
  const { transaction, root } = args
  if (!root.rightId) {
    throw Error("Cannot rotateRight without a right!")
  }
  const right = await transaction.get(root.rightId)
  if (!right) {
    throw Error("Cannot rotateRight without a right!")
  }

  const b = transaction.clone(right)
  const a = transaction.clone(root)

  a.rightId = b.leftId
  b.leftId = a.id
  a.height =
    Math.max(
      await leftHeight({ transaction, node: a }),
      await rightHeight({ transaction, node: a })
    ) + 1
  b.height = Math.max(await rightHeight({ transaction, node: b }), a.height) + 1

  a.count =
    (await leftCount({ transaction, node: a })) +
    (await rightCount({ transaction, node: a })) +
    1
  b.count = (await rightCount({ transaction, node: b })) + a.count + 1

  transaction.set(a)
  transaction.set(b)
  return b
}

export async function get<K, V>(args: {
  store: AvlNodeReadableStorage<K, V>
  compare: Compare<K>
  root: AvlNode<K, V> | undefined
  key: K
}): Promise<V | undefined> {
  const { store, root, compare, key } = args
  let node = root
  while (node) {
    const direction = compare(key, node.key)
    if (direction < 0) {
      node = await store.get(node.leftId)
    } else if (direction > 0) {
      node = await store.get(node.rightId)
    } else {
      return node.value
    }
  }
}

/**
 * Find the path to a key or as close as possible.
 */
export async function findPath<K, V>(args: {
  store: AvlNodeReadableStorage<K, V>
  compare: Compare<K>
  root: AvlNode<K, V> | undefined
  key: K
}) {
  const { store, compare, root, key } = args
  const stack: Array<AvlNode<K, V>> = []
  let node = root
  while (node) {
    stack.push(node)
    const direction = compare(key, node.key)
    if (direction < 0) {
      node = await store.get(node.leftId)
    } else if (direction > 0) {
      node = await store.get(node.rightId)
    } else {
      node = undefined
    }
  }
  return stack
}

function clonePath<K, V>(
  transaction: AvlNodeTransaction<K, V>,
  path: Array<AvlNode<K, V>>
) {
  const newPath = [...path]
  // Clone the entire path.
  newPath[0] = transaction.clone(newPath[0])
  for (let i = 1; i < newPath.length; i++) {
    const prev = newPath[i - 1]
    const node = newPath[i]
    const newNode = transaction.clone(newPath[i])
    if (prev.leftId === node.id) {
      prev.leftId = newNode.id
    } else {
      prev.rightId = newNode.id
    }
    newPath[i] = newNode
  }
  return newPath
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
async function getBalanceState<K, V>(args: {
  transaction: AvlNodeTransaction<K, V>
  node: AvlNode<K, V>
}) {
  const heightDifference = (await leftHeight(args)) - (await rightHeight(args))
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

export async function insert<K, V>(args: {
  transaction: AvlNodeTransaction<K, V>
  root: AvlNode<K, V> | undefined
  compare: Compare<K>
  key: K
  value: V
}): Promise<AvlNode<K, V>> {
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
  const stack = clonePath(
    transaction,
    await findPath({ store: transaction, compare, root, key })
  )

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
    const newNode = await rebalanceInsert({ transaction, compare, key, node })

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
  return await rebalanceInsert({ transaction, compare, key, node: stack[0] })
}

async function rebalanceInsert<K, V>(args: {
  transaction: AvlNodeTransaction<K, V>
  compare: Compare<K>
  key: K
  node: AvlNode<K, V>
}) {
  const { transaction, compare, key, node } = args

  // Update height and rebalance tree
  node.height =
    Math.max(
      await leftHeight({ transaction, node }),
      await rightHeight({ transaction, node })
    ) + 1
  node.count =
    (await leftCount({ transaction, node })) +
    (await rightCount({ transaction, node })) +
    1

  const balanceState = await getBalanceState({ transaction, node })

  if (balanceState === BalanceState.UNBALANCED_LEFT) {
    const left = (await transaction.get(node.leftId))!
    const direction = compare(key, left.key)
    if (direction < 0) {
      // Left left case
      return rotateRight({ transaction, root: node })
    } else {
      // Left right case
      node.leftId = (await rotateLeft({ transaction, root: left })).id
      return rotateRight({ transaction, root: node })
    }
  }

  if (balanceState === BalanceState.UNBALANCED_RIGHT) {
    const right = (await transaction.get(node.rightId))!
    const direction = compare(key, right.key)
    if (direction > 0) {
      // Right right case
      return rotateLeft({ transaction, root: node })
    } else {
      // Right left case
      node.rightId = (await rotateRight({ transaction, root: right })).id
      return rotateLeft({ transaction, root: node })
    }
  }

  return node
}

export async function remove<K, V>(args: {
  transaction: AvlNodeTransaction<K, V>
  root: AvlNode<K, V> | undefined
  compare: Compare<K>
  key: K
}): Promise<AvlNode<K, V> | undefined> {
  const { transaction, root, compare, key } = args

  // Empty tree.
  if (root === undefined) {
    return
  }

  // Find the path to where we want to insert.
  const stack = clonePath(
    transaction,
    await findPath({ store: transaction, compare, root, key })
  )

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
  const left = await transaction.get(last.leftId)
  const right = await transaction.get(last.rightId)

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
      const newRoot = transaction.clone(right)
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
      const newRoot = transaction.clone(left)
      transaction.set(newRoot)
      stack.push(newRoot)
    }
  } else if (left && right) {
    // Node has 2 children, get the in-order successor.
    const inOrderSuccessor = await minNode({ store: transaction, root: right })
    last.key = inOrderSuccessor.key
    last.value = inOrderSuccessor.value

    // Note: this will never recur more than once because we've already
    // found the key we want to remove.
    const newRight = await remove({
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
    const newNode = await rebalanceRemove({ transaction, node })

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
  return await rebalanceRemove({ transaction, node: stack[0] })
}

async function rebalanceRemove<K, V>(args: {
  transaction: AvlNodeTransaction<K, V>
  node: AvlNode<K, V>
}) {
  const { transaction, node } = args

  // Update height and rebalance tree
  node.height =
    Math.max(
      await leftHeight({ transaction, node: node }),
      await rightHeight({ transaction, node: node })
    ) + 1
  node.count =
    (await leftCount({ transaction, node: node })) +
    (await rightCount({ transaction, node: node })) +
    1

  const balanceState = await getBalanceState({ transaction, node: node })
  if (balanceState === BalanceState.UNBALANCED_LEFT) {
    const left = await transaction.get(node.leftId)
    if (!left) {
      throw new Error("Left must exist!")
    }
    // Left left case
    if (
      (await getBalanceState({ transaction, node: left })) ===
        BalanceState.BALANCED ||
      (await getBalanceState({ transaction, node: left })) ===
        BalanceState.SLIGHTLY_UNBALANCED_LEFT
    ) {
      return rotateRight({ transaction, root: node })
    }
    // Left right case
    if (
      (await getBalanceState({ transaction, node: left })) ===
      BalanceState.SLIGHTLY_UNBALANCED_RIGHT
    ) {
      node.leftId = (await rotateLeft({ transaction, root: left })).id
      return rotateRight({ transaction, root: node })
    }
  }

  if (balanceState === BalanceState.UNBALANCED_RIGHT) {
    const right = await transaction.get(node.rightId)
    if (!right) {
      throw new Error("Right must exist!")
    }

    // Right right case
    if (
      (await getBalanceState({ transaction, node: right })) ===
        BalanceState.BALANCED ||
      (await getBalanceState({ transaction, node: right })) ===
        BalanceState.SLIGHTLY_UNBALANCED_RIGHT
    ) {
      return rotateLeft({ transaction, root: node })
    }
    // Right left case
    if (
      (await getBalanceState({ transaction, node: right })) ===
      BalanceState.SLIGHTLY_UNBALANCED_LEFT
    ) {
      node.rightId = (await rotateRight({ transaction, root: right })).id
      return rotateLeft({ transaction, root: node })
    }
  }

  return node
}

/**
 * Gets the minimum node, rooted in a particular node.
 */
export async function minNode<K, V>(args: {
  store: AvlNodeReadableStorage<K, V>
  root: AvlNode<K, V>
}) {
  const { store, root } = args
  let current = root
  let left: AvlNode<K, V> | undefined
  while ((left = await store.get(current.leftId))) {
    current = left
  }
  return current
}

/**
 * Gets the maximum node, rooted in a particular node.
 */
export async function maxNode<K, V>(args: {
  store: AvlNodeReadableStorage<K, V>
  root: AvlNode<K, V>
}) {
  const { store, root } = args
  let current = root
  let right: AvlNode<K, V> | undefined
  while ((right = await store.get(current.rightId))) {
    current = right
  }
  return current
}
