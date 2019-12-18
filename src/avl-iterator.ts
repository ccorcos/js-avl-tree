/**
 * A convenient abstraction that isn't quite so functional.
 */
export class AvlTree<K, V> {
  store: AvlNodeWritableStorage<K, V>
  root: AvlNode<K, V> | undefined
  compare: Compare<K>

  constructor(args: {
    store: AvlNodeWritableStorage<K, V>
    root: AvlNode<K, V> | undefined
    compare: Compare<K>
  }) {
    this.store = args.store
    this.root = args.root
    this.compare = args.compare
  }

  async find(key: K): Promise<AvlTreeIterator<K, V>> {
    if (!this.root) {
      return new AvlTreeIterator({
        root: this.root,
        store: this.store,
        stack: [],
      })
    }
    const stack = await findPath({
      store: this.store,
      compare: this.compare,
      root: this.root,
      key,
    })
    const last = stack[stack.length - 1]
    if (this.compare(key, last.key) === 0) {
      return new AvlTreeIterator({
        root: this.root,
        store: this.store,
        stack,
      })
    } else {
      return new AvlTreeIterator({
        root: this.root,
        store: this.store,
        stack: [],
      })
    }
  }

  async begin(): Promise<AvlTreeIterator<K, V>> {
    let node = this.root
    const stack: Array<AvlNode<K, V>> = []
    while (node) {
      stack.push(node)
      node = await this.store.get(node.leftId)
    }
    return new AvlTreeIterator({
      root: this.root,
      store: this.store,
      stack,
    })
  }

  async end(): Promise<AvlTreeIterator<K, V>> {
    let node = this.root
    const stack: Array<AvlNode<K, V>> = []
    while (node) {
      stack.push(node)
      node = await this.store.get(node.rightId)
    }
    return new AvlTreeIterator({
      root: this.root,
      store: this.store,
      stack,
    })
  }

  /**
   * Find the nth item in the tree.
   */
  async at(idx: number): Promise<AvlTreeIterator<K, V>> {
    const root = this.root
    if (idx < 0 || !root) {
      return new AvlTreeIterator({
        root: this.root,
        store: this.store,
        stack: [],
      })
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
        return new AvlTreeIterator({
          root: this.root,
          store: this.store,
          stack: stack,
        })
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
    return new AvlTreeIterator({
      root: this.root,
      store: this.store,
      stack: [],
    })
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
    return new AvlTreeIterator({
      root: this.root,
      store: this.store,
      stack,
    })
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
    return new AvlTreeIterator({
      root: this.root,
      store: this.store,
      stack,
    })
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
    return new AvlTreeIterator({
      root: this.root,
      store: this.store,
      stack,
    })
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
    return new AvlTreeIterator({
      root: this.root,
      store: this.store,
      stack,
    })
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

  // TODO: scan
}

/**
 * Represents a path into an `AvlTreeIterator` with helpful methods for
 * traversing the tree.
 */
export class AvlTreeIterator<K, V> {
  store: AvlNodeWritableStorage<K, V>
  root: AvlNode<K, V> | undefined
  stack: Array<AvlNode<K, V>>

  constructor(args: {
    store: AvlNodeWritableStorage<K, V>
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
      const left = await this.store.get(stack[stack.length - 1].leftId)
      if (left) {
        idx = left.count
      }
    }
    for (let s = stack.length - 2; s >= 0; --s) {
      if (stack[s + 1].id === stack[s].rightId) {
        ++idx
        const left = await this.store.get(stack[s].leftId)
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
    const right = await this.store.get(n.rightId)
    if (right) {
      n = right
      while (n) {
        stack.push(n)
        n = await this.store.get(n.leftId)
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
    const left = await this.store.get(n.leftId)
    if (left) {
      n = left
      while (n) {
        stack.push(n)
        n = await this.store.get(n.rightId)
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
