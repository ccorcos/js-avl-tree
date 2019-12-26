import { AvlNode, getNode } from "./avl-storage"
import {
  ShardedKeyValueReadableStorage,
  ShardedKeyValueWritableStorage,
  KeyValueReadableStore,
  ShardedKeyValueTransaction,
  KeyValueTransaction,
} from "./key-value-storage"
import * as avl from "./avl-tree"
import * as iter from "./avl-iterator"

// TODO: encodings
// export type BooleanValue = { t: "boolean"; v: boolean }
// export type NumberValue = { t: "number"; v: number } // float32
// export type StringValue = { t: "string"; v: string }
// export type DateValue = { t: "date"; v: string }
// type ArrayValue = {t: "array", }

export type Value = string | number | boolean
export type Tuple = Array<Value>

export const MIN = Symbol("min")
export const MAX = Symbol("max")
export type QueryValue = Value | typeof MIN | typeof MAX
export type QueryTuple = Array<QueryValue>

export type Direction = 1 | -1
export type Sort = Array<Direction>

const rank = ["number", "string", "boolean"]

function compareQueryValue(a: QueryValue, b: QueryValue): number {
  // Check the bounds.
  if (a === MIN) {
    if (b === MIN) {
      return 0
    } else {
      return -1
    }
  } else if (b === MIN) {
    return 1
  } else if (a === MAX) {
    if (b === MAX) {
      return 0
    } else {
      return 1
    }
  } else if (b === MAX) {
    return -1
  }

  const at = typeof a
  const bt = typeof b
  if (at === bt) {
    if (a > b) {
      return 1
    }
    if (a < b) {
      return -1
    }
    return 0
  }

  return rank.indexOf(at) - rank.indexOf(bt)
}

function compareQueryTuple(sort: Sort) {
  if (sort.length === 0) {
    throw new Error("Sort length 0.")
  }
  return (a: QueryTuple, b: QueryTuple) => {
    if (a.length !== sort.length) {
      throw new Error(`Sort length mismatch. ${JSON.stringify({ a, sort })}`)
    }
    if (b.length !== sort.length) {
      throw new Error(`Sort length mismatch. ${JSON.stringify({ b, sort })}`)
    }
    for (let i = 0; i < sort.length; i++) {
      const dir = compareQueryValue(a[i], b[i])
      if (dir === 0) {
        continue
      }
      return dir * sort[i]
    }
    return 0
  }
}

export type Index<K extends Tuple, V> = {
  name: string
  sort: Sort
}

export type ScanArgs = {
  gt?: QueryTuple
  gte?: QueryTuple
  lt?: QueryTuple
  lte?: QueryTuple
  limit?: number
}

export interface IndexReadableStorage {
  get: <K extends Tuple, V>(
    index: Index<K, V>,
    key: K
  ) => Promise<V | undefined>
  scan: <K extends Tuple, V>(
    index: Index<K, V>,
    args: ScanArgs
  ) => Promise<Array<[K, V]>>
}

export interface IndexWritableStorage extends IndexReadableStorage {
  batch: (args: KeyValueIndexTransaction) => Promise<void>
}

export class KeyValueIndexReadableStore implements IndexReadableStorage {
  constructor(protected store: ShardedKeyValueReadableStorage) {}

  protected get head() {
    return new KeyValueReadableStore<string | undefined>(this.store, "head")
  }

  protected index<K extends Tuple, V>(index: Index<K, V>) {
    return new KeyValueReadableStore<AvlNode<K, V>>(this.store, index.name)
  }

  async get<K extends Tuple, V>(
    index: Index<K, V>,
    key: K
  ): Promise<V | undefined> {
    const rootId = await this.head.get(index.name)
    const store = this.index(index)
    const compare = compareQueryTuple(index.sort)
    const root = await getNode(store, rootId)
    return avl.get({ store, compare, root, key })
  }

  async scan<K extends Tuple, V>(
    index: Index<K, V>,
    args: ScanArgs = {}
  ): Promise<Array<[K, V]>> {
    const rootId = await this.head.get(index.name)
    const store = this.index(index)
    const compare = compareQueryTuple(index.sort)
    const root = await getNode(store, rootId)

    const results: Array<[K, V]> = []

    let i = args.gt
      ? await iter.gt({ store, compare, root, key: args.gt })
      : args.gte
      ? await iter.ge({ store, compare, root, key: args.gte })
      : await iter.begin({ store, root })

    while (i.valid && i.node) {
      // TODO: this is an annoying cast.
      results.push([i.node.key as K, i.node.value])
      await i.next()
      if (args.limit && results.length === args.limit) {
        break
      }
      if (args.lt && i.node && compare(i.node.key, args.lt) !== -1) {
        break
      }
      if (args.lte && i.node && compare(i.node.key, args.lte) === 1) {
        break
      }
    }

    return results
  }
}

export class KeyValueIndexWritableStore extends KeyValueIndexReadableStore
  implements IndexWritableStorage {
  constructor(protected store: ShardedKeyValueWritableStorage) {
    super(store)
  }

  async batch(transaction: KeyValueIndexTransaction): Promise<void> {
    await this.store.batch(transaction.transaction)
  }
}

export class KeyValueIndexTransaction implements IndexReadableStorage {
  public transaction: ShardedKeyValueTransaction
  private store: IndexReadableStorage

  constructor(store: ShardedKeyValueReadableStorage) {
    this.transaction = new ShardedKeyValueTransaction(store)
    this.store = new KeyValueIndexReadableStore(this.transaction)
  }

  async get<K extends Tuple, V>(
    index: Index<K, V>,
    key: K
  ): Promise<V | undefined> {
    return this.store.get(index, key)
  }

  async scan<K extends Tuple, V>(
    index: Index<K, V>,
    args: ScanArgs
  ): Promise<Array<[K, V]>> {
    return this.store.scan(index, args)
  }

  protected get head() {
    return this.transaction.getShard<string | undefined>("head")
  }

  protected index<K extends Tuple, V>(index: Index<K, V>) {
    return this.transaction.getShard<AvlNode<K, V>>(index.name)
  }

  set = async <K extends Tuple, V>(index: Index<K, V>, key: K, value: V) => {
    const rootId = await this.head.get(index.name)
    const transaction = this.index(index)
    const compare = compareQueryTuple(index.sort)
    let root = await getNode(transaction, rootId)
    root = await avl.insert({ transaction, compare, root, key, value })
    this.head.set(index.name, root.id)
  }

  remove = async <K extends Tuple, V>(index: Index<K, V>, key: K) => {
    const rootId = await this.head.get(index.name)
    const transaction = this.index(index)
    const compare = compareQueryTuple(index.sort)
    let root = await getNode(transaction, rootId)
    root = await avl.remove({ transaction, compare, root, key })
    this.head.set(index.name, root?.id)
  }
}
