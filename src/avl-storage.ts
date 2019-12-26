import { randomId } from "./utils"
import {
  KeyValueWritableStorage,
  BatchArgs,
  KeyValueReadableStorage,
} from "./key-value-storage"

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

// Some type issues with KeyValueStorage so we are not using method syntax.
// https://github.com/microsoft/TypeScript/issues/35843
export interface AvlNodeReadableStorage<K, V> {
  get: (id: string | undefined) => Promise<AvlNode<K, V> | undefined>
}

export interface AvlNodeWritableStorage<K, V>
  extends AvlNodeReadableStorage<K, V> {
  batch: (args: BatchArgs<string, AvlNode<K, V>>) => Promise<void>
}

export class AvlNodeReadableStore<K, V>
  implements AvlNodeReadableStorage<K, V> {
  constructor(private store: KeyValueReadableStorage<AvlNode<K, V>>) {}

  get = async (id: string | undefined): Promise<AvlNode<K, V> | undefined> => {
    if (id === undefined) {
      return
    }
    return this.store.get(id)
  }
}

export class AvlNodeWritableStore<K, V>
  implements AvlNodeWritableStorage<K, V> {
  constructor(private store: KeyValueWritableStorage<AvlNode<K, V>>) {}

  get = async (id: string | undefined): Promise<AvlNode<K, V> | undefined> => {
    if (id === undefined) {
      return
    }
    return this.store.get(id)
  }

  batch = async (args: BatchArgs<string, AvlNode<K, V>>): Promise<void> => {
    this.store.batch(args)
  }
}

// TODO: Reuse KeyValueTransaction?
export class AvlNodeTransaction<K, V> implements AvlNodeReadableStorage<K, V> {
  constructor(public store: AvlNodeReadableStorage<K, V>) {}

  private cache: Map<string, AvlNode<K, V> | undefined> = new Map()
  public writes: Map<string, AvlNode<K, V>> = new Map()

  // Transactions have a caching layer to improve performance and also
  // return data that is queued to be written.
  get = async (id: string | undefined): Promise<AvlNode<K, V> | undefined> => {
    if (!id) {
      return
    }
    if (this.writes.has(id)) {
      return this.writes.get(id)
    }
    if (this.cache.has(id)) {
      return this.cache.get(id)
    }
    const data = await this.store.get(id)
    this.cache.set(id, data)
    return data
  }

  set = (value: AvlNode<K, V>) => {
    const id = value.id
    this.cache.set(id, value)
    this.writes.set(id, value)
  }

  clone = (node: AvlNode<K, V>): AvlNode<K, V> => {
    // When cloning a node, remove it from the write so we don't create unnecessary
    // amounts of data. The `checkStore` test cases make sure of this.
    this.writes.delete(node.id)
    const newNode = {
      ...node,
      id: randomId(),
    }
    return newNode
  }
}
