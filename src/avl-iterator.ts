import { AvlNode, AvlNodeReadableStorage, getNode } from "./avl-storage"
import { Compare, findPath } from "./avl-tree"

/**
 * Represents a path into an `AvlTreeIterator` with helpful methods for
 * traversing the tree.
 */
export class AvlTreeIterator<K, V> {
  store: AvlNodeReadableStorage<K, V>
  root: AvlNode<K, V> | undefined
  stack: Array<AvlNode<K, V>>

  constructor(args: {
    store: AvlNodeReadableStorage<K, V>
    root: AvlNode<K, V> | undefined
    stack: Array<AvlNode<K, V>>
  }) {
    this.store = args.store
    this.root = args.root
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
      root: this.root,
      store: this.store,
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
      let r = this.root
      if (r) {
        return r.count
      }
      return 0
    } else {
      const left = await getNode(this.store, stack[stack.length - 1].leftId)
      if (left) {
        idx = left.count
      }
    }
    for (let s = stack.length - 2; s >= 0; --s) {
      if (stack[s + 1].id === stack[s].rightId) {
        ++idx
        const left = await getNode(this.store, stack[s].leftId)
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
    const right = await getNode(this.store, n.rightId)
    if (right) {
      n = right
      while (n) {
        stack.push(n)
        n = await getNode(this.store, n.leftId)
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
    const left = await getNode(this.store, n.leftId)
    if (left) {
      n = left
      while (n) {
        stack.push(n)
        n = await getNode(this.store, n.rightId)
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

export async function find<K, V>(args: {
  store: AvlNodeReadableStorage<K, V>
  root: AvlNode<K, V> | undefined
  compare: Compare<K>
  key: K
}): Promise<AvlTreeIterator<K, V>> {
  const { store, root, compare, key } = args
  if (!root) {
    return new AvlTreeIterator({ root, store, stack: [] })
  }
  const stack = await findPath({ store, compare, root, key })
  const last = stack[stack.length - 1]
  if (compare(key, last.key) === 0) {
    return new AvlTreeIterator({ root, store, stack })
  } else {
    return new AvlTreeIterator({ root, store, stack: [] })
  }
}

export async function begin<K, V>(args: {
  store: AvlNodeReadableStorage<K, V>
  root: AvlNode<K, V> | undefined
}): Promise<AvlTreeIterator<K, V>> {
  const { store, root } = args
  let node = root
  const stack: Array<AvlNode<K, V>> = []
  while (node) {
    stack.push(node)
    node = await getNode(store, node.leftId)
  }
  return new AvlTreeIterator({ root, store, stack })
}

export async function end<K, V>(args: {
  store: AvlNodeReadableStorage<K, V>
  root: AvlNode<K, V> | undefined
}): Promise<AvlTreeIterator<K, V>> {
  const { store, root } = args
  let node = root
  const stack: Array<AvlNode<K, V>> = []
  while (node) {
    stack.push(node)
    node = await getNode(store, node.rightId)
  }
  return new AvlTreeIterator({ root, store, stack })
}

/**
 * Find the nth item in the tree.
 */
export async function at<K, V>(args: {
  store: AvlNodeReadableStorage<K, V>
  root: AvlNode<K, V> | undefined
  idx: number
}): Promise<AvlTreeIterator<K, V>> {
  const { store, root } = args
  let idx = args.idx
  if (idx < 0 || !root) {
    return new AvlTreeIterator({ root, store, stack: [] })
  }
  let node = root
  const stack: Array<AvlNode<K, V>> = []
  while (true) {
    stack.push(node)
    const left = await getNode(store, node.leftId)
    if (left) {
      if (idx < left.count) {
        node = left
        continue
      }
      idx -= left.count
    }
    if (!idx) {
      return new AvlTreeIterator({ root, store, stack })
    }
    idx -= 1
    const right = await getNode(store, node.rightId)
    if (right) {
      if (idx >= right.count) {
        break
      }
      node = right
    } else {
      break
    }
  }
  return new AvlTreeIterator({ root, store, stack: [] })
}

export async function ge<K, V>(args: {
  store: AvlNodeReadableStorage<K, V>
  root: AvlNode<K, V> | undefined
  compare: Compare<K>
  key: K
}): Promise<AvlTreeIterator<K, V>> {
  const { store, root, compare, key } = args
  let node = root
  const stack: Array<AvlNode<K, V>> = []
  let last_ptr = 0
  while (node) {
    let direction = compare(key, node.key)
    stack.push(node)
    if (direction <= 0) {
      last_ptr = stack.length
    }
    if (direction <= 0) {
      node = await getNode(store, node.leftId)
    } else {
      node = await getNode(store, node.rightId)
    }
  }
  // TODO: this feels sketchy
  stack.length = last_ptr
  return new AvlTreeIterator({ root, store, stack })
}

export async function gt<K, V>(args: {
  store: AvlNodeReadableStorage<K, V>
  root: AvlNode<K, V> | undefined
  compare: Compare<K>
  key: K
}): Promise<AvlTreeIterator<K, V>> {
  const { store, root, compare, key } = args
  let node = root
  const stack: Array<AvlNode<K, V>> = []
  let last_ptr = 0
  while (node) {
    let direction = compare(key, node.key)
    stack.push(node)
    if (direction < 0) {
      last_ptr = stack.length
    }
    if (direction < 0) {
      node = await getNode(store, node.leftId)
    } else {
      node = await getNode(store, node.rightId)
    }
  }
  // TODO: this feels sketchy
  stack.length = last_ptr
  return new AvlTreeIterator({ root, store, stack })
}

export async function lt<K, V>(args: {
  store: AvlNodeReadableStorage<K, V>
  root: AvlNode<K, V> | undefined
  compare: Compare<K>
  key: K
}): Promise<AvlTreeIterator<K, V>> {
  const { store, root, compare, key } = args
  let node = root
  const stack: Array<AvlNode<K, V>> = []
  let last_ptr = 0
  while (node) {
    let direction = compare(key, node.key)
    stack.push(node)
    if (direction > 0) {
      last_ptr = stack.length
    }
    if (direction <= 0) {
      node = await getNode(store, node.leftId)
    } else {
      node = await getNode(store, node.rightId)
    }
  }
  // TODO: this feels sketchy
  stack.length = last_ptr
  return new AvlTreeIterator({ root, store, stack })
}

export async function le<K, V>(args: {
  store: AvlNodeReadableStorage<K, V>
  root: AvlNode<K, V> | undefined
  compare: Compare<K>
  key: K
}): Promise<AvlTreeIterator<K, V>> {
  const { store, root, compare, key } = args
  let node = root
  const stack: Array<AvlNode<K, V>> = []
  let last_ptr = 0
  while (node) {
    let direction = compare(key, node.key)
    stack.push(node)
    if (direction >= 0) {
      last_ptr = stack.length
    }
    if (direction < 0) {
      node = await getNode(store, node.leftId)
    } else {
      node = await getNode(store, node.rightId)
    }
  }
  // TODO: this feels sketchy
  stack.length = last_ptr
  return new AvlTreeIterator({ root, store, stack })
}

/**
 * This is really only useful for testing.
 */
export async function getAllNodes<K, V>(args: {
  store: AvlNodeReadableStorage<K, V>
  root: AvlNode<K, V> | undefined
}) {
  const items: Array<AvlNode<K, V>> = []
  let iter = await begin(args)
  while (iter.valid) {
    items.push(iter.node!)
    await iter.next()
  }
  return items
}
