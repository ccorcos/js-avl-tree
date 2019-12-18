import { randomId } from "./utils"

export interface AvlNode<K, V> {
  // Node ids.
  id: string
  leftId: string | undefined
  rightId: string | undefined
  // Used internally by the AVL algorithm
  height: number
  // Key-value pair.
  key: K
  value: V
  // Total size of subtree including this node.
  count: number
}

export interface AvlNodeReadableStorage<K, V> {
  get(id: string | undefined): Promise<AvlNode<K, V> | undefined>
}

export interface AvlNodeWritableStorage<K, V> {
  get(id: string | undefined): Promise<AvlNode<K, V> | undefined>
  set(node: AvlNode<K, V>): Promise<void>
  // delete(id: string): Promise<void>
}

export class AvlNodeTransaction<K, V> {
  constructor(public store: AvlNodeWritableStorage<K, V>) {}

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
