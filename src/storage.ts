import { AvlNode } from "./avl-tree3"

function randomId() {
  return Math.round(Math.random() * 1e10).toString()
}

export function clone<K, V>(node: AvlNode<K, V>): AvlNode<K, V> {
  const newNode = {
    ...node,
    id: randomId(),
  }
  return newNode
}

export class InMemoryKeyValueStore {
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

export class AvlNodeStore<K, V> {
  constructor(private store: InMemoryKeyValueStore) {}

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

export class Transaction<K, V> {
  constructor(private store: AvlNodeStore<K, V>) {}

  private cache: Record<string, AvlNode<K, V> | undefined> = {}
  private writes: Record<string, AvlNode<K, V>> = {}

  // Transactions have a caching layer to improve performance and also
  // return data that is queued to be written.
  get(id: string | undefined): AvlNode<K, V> | undefined {
    if (!id) {
      return
    }
    if (id in this.writes) {
      return this.writes[id]
    }
    if (id in this.cache) {
      return this.cache[id]
    }
    const data = this.store.get(id)
    this.cache[id] = data
    return data
  }

  set(value: AvlNode<K, V>) {
    const id = value.id
    this.cache[id] = value
    this.writes[id] = value
  }

  commit() {
    for (const node of Object.values(this.writes)) {
      this.store.set(node)
    }
    // Writable nodes can no longer be accessed after the transaction is written.
    this.writes = {}
    // Let the garbage collector clean up the cache.
    this.cache = {}
  }
}
