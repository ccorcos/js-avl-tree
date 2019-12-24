import { randomId } from "./utils"
import { KeyValueWritableStorage } from "./key-value-storage"

export type BatchArgs<V> = {
  writes?: Record<string, V>
  deletes?: Set<string>
}

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
  // Some type issues with key-value storage.
  // https://github.com/microsoft/TypeScript/issues/35843
  type: "avl-node-storage"
  get(id: string | undefined): Promise<AvlNode<K, V> | undefined>
}

export interface AvlNodeWritableStorage<K, V>
  extends AvlNodeReadableStorage<K, V> {
  batch(args: BatchArgs<AvlNode<K, V>>): Promise<void>
}

export class AvlNodeStorage<K, V> implements AvlNodeWritableStorage<K, V> {
  type = "avl-node-storage" as const
  constructor(private store: KeyValueWritableStorage<AvlNode<K, V>>) {}

  async get(id: string | undefined): Promise<AvlNode<K, V> | undefined> {
    if (id === undefined) {
      return
    }
    return this.store.get(id)
  }

  async batch(args: BatchArgs<AvlNode<K, V>>): Promise<void> {
    this.store.batch(args)
  }
}

export class AvlNodeTransaction<K, V> implements AvlNodeReadableStorage<K, V> {
  type = "avl-node-storage" as const

  constructor(public store: AvlNodeWritableStorage<K, V>) {}

  private cache: Record<string, AvlNode<K, V> | undefined> = {}
  public writes: Record<string, AvlNode<K, V>> = {}

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
}
