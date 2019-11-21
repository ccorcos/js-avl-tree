import { randomId } from "./utils"

export interface AvlNodeStorage<K, V> {
  get(id: string | undefined): Promise<AvlNode<K, V> | undefined>
  set(node: AvlNode<K, V>): Promise<void>
  // delete(id: string): Promise<void>
}

export interface AvlNodeReadOnlyStorage<K, V> {
  get(id: string | undefined): Promise<AvlNode<K, V> | undefined>
}

export interface AvlNode<K, V> {
  id: string
  leftId: string | undefined
  rightId: string | undefined
  key: K
  value: V
  height: number // Used internally by the AVL algorithm
  count: number
}

export class Transaction<K, V> {
  constructor(public store: AvlNodeStorage<K, V>) {}

  private cache: Record<string, AvlNode<K, V> | undefined> = {}
  private writes: Record<string, AvlNode<K, V>> = {}

  // Transactions have a caching layer to improve performance and also
  // return data that is queued to be written.
  async get(id: string | undefined): Promise<AvlNode<K, V> | undefined> {
    if (!id) {
      return
    }
    if (id in this.writes) {
      return this.writes[id]
    }
    if (id in this.cache) {
      return this.cache[id]
    }
    const data = await this.store.get(id)
    this.cache[id] = data
    return data
  }

  set(value: AvlNode<K, V>) {
    const id = value.id
    this.cache[id] = value
    this.writes[id] = value
  }

  clone(node: AvlNode<K, V>): AvlNode<K, V> {
    // When cloning a node, remove it from the write so we don't create unnecessary
    // amounts of data. The `checkStore` test cases make sure of this.
    delete this.writes[node.id]
    const newNode = {
      ...node,
      id: randomId(),
    }
    return newNode
  }

  async commit() {
    for (const node of Object.values(this.writes)) {
      await this.store.set(node)
    }
    // Writable nodes can no longer be accessed after the transaction is written.
    this.writes = {}
    // Let the garbage collector clean up the cache.
    this.cache = {}
  }
}

async function leftHeight<K, V>(args: {
  transaction: Transaction<K, V>
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
  transaction: Transaction<K, V>
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
  transaction: Transaction<K, V>
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
  transaction: Transaction<K, V>
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
  transaction: Transaction<K, V>
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
  transaction: Transaction<K, V>
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

type Compare<K> = (a: K, b: K) => number

/**
 * Find the path to a key or as close as possible.
 */
async function findPath<K, V>(args: {
  store: AvlNodeReadOnlyStorage<K, V>
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
  transaction: Transaction<K, V>,
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

export async function insert<K, V>(args: {
  transaction: Transaction<K, V>
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
  transaction: Transaction<K, V>
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
  transaction: Transaction<K, V>
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
    const inOrderSuccessor = await minNode({ transaction, root: right })
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
  transaction: Transaction<K, V>
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
async function minNode<K, V>(args: {
  transaction: Transaction<K, V>
  root: AvlNode<K, V>
}) {
  const { transaction, root } = args
  let current = root
  let left: AvlNode<K, V> | undefined
  while ((left = await transaction.get(current.leftId))) {
    current = left
  }
  return current
}

/**
 * Gets the maximum node, rooted in a particular node.
 */
async function maxNode<K, V>(args: {
  transaction: Transaction<K, V>
  root: AvlNode<K, V>
}) {
  const { transaction, root } = args
  let current = root
  let right: AvlNode<K, V> | undefined
  while ((right = await transaction.get(current.rightId))) {
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
async function getBalanceState<K, V>(args: {
  transaction: Transaction<K, V>
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

/**
 * A convenient abstraction that isn't quite so functional.
 */
export class AvlTree<K, V> {
  store: AvlNodeStorage<K, V>
  root: AvlNode<K, V> | undefined
  compare: Compare<K>

  constructor(args: {
    store: AvlNodeStorage<K, V>
    root: AvlNode<K, V> | undefined
    compare: Compare<K>
  }) {
    this.store = args.store
    this.root = args.root
    this.compare = args.compare
  }

  async insert(key: K, value: V) {
    const transaction = new Transaction(this.store)
    const newRoot = await insert({
      transaction,
      compare: this.compare,
      root: this.root,
      key: key,
      value: value,
    })
    await transaction.commit()
    // TODO: this should be persisted.
    return new AvlTree({
      store: this.store,
      compare: this.compare,
      root: newRoot,
    })
  }

  async remove(key: K) {
    const transaction = new Transaction(this.store)
    const newRoot = await remove({
      transaction,
      compare: this.compare,
      root: this.root,
      key,
    })
    await transaction.commit()
    // TODO: this should be persisted.
    return new AvlTree({
      store: this.store,
      compare: this.compare,
      root: newRoot,
    })
  }

  async get(key: K): Promise<V | undefined> {
    const { store, root, compare } = this
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

  async find(key: K): Promise<AvlTreeIterator<K, V>> {
    if (!this.root) {
      return new AvlTreeIterator({ tree: this, stack: [] })
    }
    const stack = await findPath({
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

  async begin(): Promise<AvlTreeIterator<K, V>> {
    let node = this.root
    const stack: Array<AvlNode<K, V>> = []
    while (node) {
      stack.push(node)
      node = await this.store.get(node.leftId)
    }
    return new AvlTreeIterator({ tree: this, stack })
  }

  async end(): Promise<AvlTreeIterator<K, V>> {
    let node = this.root
    const stack: Array<AvlNode<K, V>> = []
    while (node) {
      stack.push(node)
      node = await this.store.get(node.rightId)
    }
    return new AvlTreeIterator({ tree: this, stack })
  }

  /**
   * Find the nth item in the tree.
   */
  async at(idx: number): Promise<AvlTreeIterator<K, V>> {
    const root = this.root
    if (idx < 0 || !root) {
      return new AvlTreeIterator({ tree: this, stack: [] })
    }
    let node = root
    const stack: Array<AvlNode<K, V>> = []
    while (true) {
      stack.push(node)
      const left = await this.store.get(node.leftId)
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
      const right = await this.store.get(node.rightId)
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

  async ge(key: K): Promise<AvlTreeIterator<K, V>> {
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
        node = await this.store.get(node.leftId)
      } else {
        node = await this.store.get(node.rightId)
      }
    }
    // TODO: this feels sketchy
    stack.length = last_ptr
    return new AvlTreeIterator({ tree: this, stack })
  }

  async gt(key: K): Promise<AvlTreeIterator<K, V>> {
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
        node = await this.store.get(node.leftId)
      } else {
        node = await this.store.get(node.rightId)
      }
    }
    // TODO: this feels sketchy
    stack.length = last_ptr
    return new AvlTreeIterator({ tree: this, stack })
  }

  async lt(key: K): Promise<AvlTreeIterator<K, V>> {
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
        node = await this.store.get(node.leftId)
      } else {
        node = await this.store.get(node.rightId)
      }
    }
    // TODO: this feels sketchy
    stack.length = last_ptr
    return new AvlTreeIterator({ tree: this, stack })
  }

  async le(key: K): Promise<AvlTreeIterator<K, V>> {
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
        node = await this.store.get(node.leftId)
      } else {
        node = await this.store.get(node.rightId)
      }
    }
    // TODO: this feels sketchy
    stack.length = last_ptr
    return new AvlTreeIterator({ tree: this, stack })
  }

  // This allows you to do forEach
  // async *[Symbol.iterator]() {
  //   let iter = await this.begin()
  //   while (iter.valid) {
  //     yield iter.node!
  //     await iter.next()
  //   }
  // }

  async nodes() {
    const items: Array<AvlNode<K, V>> = []
    let iter = await this.begin()
    while (iter.valid) {
      items.push(iter.node!)
      await iter.next()
    }
    return items
  }

  walk() {
    return new AvlTreeWalker({
      store: this.store,
      node: Promise.resolve(this.root),
    })
  }

  batch() {
    const transaction = new Transaction(this.store)
    return new AvlTreeBatch({
      root: this.root,
      compare: this.compare,
      transaction,
    })
  }

  // TODO: scan
}

export class AvlTreeBatch<K, V> {
  private root: AvlNode<K, V> | undefined
  private compare: Compare<K>
  private transaction: Transaction<K, V>
  private tasks: Array<
    (root: AvlNode<K, V> | undefined) => Promise<AvlNode<K, V> | undefined>
  > = []

  constructor(args: {
    root: AvlNode<K, V> | undefined
    compare: Compare<K>
    transaction: Transaction<K, V>
  }) {
    this.root = args.root
    this.compare = args.compare
    this.transaction = args.transaction
  }

  insert(key: K, value: V) {
    this.tasks.push(root =>
      insert({
        transaction: this.transaction,
        compare: this.compare,
        root: root,
        key: key,
        value: value,
      })
    )
    return this
  }

  remove(key: K) {
    this.tasks.push(root =>
      remove({
        transaction: this.transaction,
        compare: this.compare,
        root: root,
        key: key,
      })
    )
    return this
  }

  async commit() {
    let root = this.root
    for (const task of this.tasks) {
      root = await task(root)
    }
    await this.transaction.commit()
    return new AvlTree({
      store: this.transaction.store,
      compare: this.compare,
      root: root,
    })
  }
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
  async index() {
    let idx = 0
    let stack = this.stack
    if (stack.length === 0) {
      let r = this.tree.root
      if (r) {
        return r.count
      }
      return 0
    } else {
      const left = await this.tree.store.get(stack[stack.length - 1].leftId)
      if (left) {
        idx = left.count
      }
    }
    for (let s = stack.length - 2; s >= 0; --s) {
      if (stack[s + 1].id === stack[s].rightId) {
        ++idx
        const left = await this.tree.store.get(stack[s].leftId)
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
  async next() {
    let stack = this.stack
    if (stack.length === 0) {
      throw new Error("Invalid iterator")
    }
    let n: AvlNode<K, V> | undefined = stack[stack.length - 1]
    const right = await this.tree.store.get(n.rightId)
    if (right) {
      n = right
      while (n) {
        stack.push(n)
        n = await this.tree.store.get(n.leftId)
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
  async prev() {
    const stack = this.stack
    if (stack.length === 0) {
      throw new Error("Invalid iterator")
    }
    let n: AvlNode<K, V> | undefined = stack[stack.length - 1]
    const left = await this.tree.store.get(n.leftId)
    if (left) {
      n = left
      while (n) {
        stack.push(n)
        n = await this.tree.store.get(n.rightId)
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
  store: AvlNodeStorage<K, V>
  node: Promise<AvlNode<K, V> | undefined>

  constructor(args: {
    store: AvlNodeStorage<K, V>
    node: Promise<AvlNode<K, V> | undefined>
  }) {
    this.store = args.store
    this.node = args.node
  }

  get left() {
    const left = this.node.then(n => n && this.store.get(n.leftId))
    return new AvlTreeWalker({
      store: this.store,
      node: left,
    })
  }

  get right() {
    const right = this.node.then(n => n && this.store.get(n.rightId))
    return new AvlTreeWalker({
      store: this.store,
      node: right,
    })
  }
}

async function printNode<K, V>(
  node: AvlNode<K, V> | undefined,
  store: AvlNodeReadOnlyStorage<K, V>,
  indent = ""
): Promise<any> {
  if (!node) {
    return
  }
  return [
    indent + node.key + "(" + node.count + ")",
    await printNode(await store.get(node?.leftId), store, indent + "l:"),
    await printNode(await store.get(node?.rightId), store, indent + "r:"),
  ]
    .filter(Boolean)
    .join("\n")
}

export function printTree<K, V>(t: AvlTree<K, V>) {
  return printNode(t.root, t.store)
}
