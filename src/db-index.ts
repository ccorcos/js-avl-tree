import {
  AvlNode,
  AvlNodeTransaction,
  AvlNodeWritableStorage,
} from "./avl-storage"

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
  gt?: Tuple
  gte?: Tuple
  lt?: Tuple
  lte?: Tuple
  limit?: number
}

interface IndexReadableStorage<K extends Tuple, V> {
  get(index: Index<K, V>, key: K): Promise<V | undefined>
  scan(index: Index<K, V>, args: ScanArgs): Promise<Array<[K, V]>>
}

interface IndexWritableStorage<K extends Tuple, V>
  extends IndexReadableStorage<K, V> {
  set(index: Index<K, V>, key: K, value: V): Promise<void>
  remove(index: Index<K, V>, key: K): Promise<void>
}

// We want to use AVL in memory at the very least. Could persist to files
// differently

// class AvlIndexStorage<K extends Tuple, V>
//   implements IndexWritableStorage<K, V> {

//   constructor(private store: AvlNodeWritableStorage<K, V>) {}
//   async get(index: Index<K, V>, key: K): Promise<V | undefined> {

//   }
//   scan(index: Index<K, V>, args: ScanArgs): Promise<Array<[K, V]>>
//   set(index: Index<K, V>, key: K, value: V): Promise<void>
//   remove(index: Index<K, V>, key: K): Promise<void>
// }

// File storage cannot incrementally write so it has to load the whole thing
// into memory regardless. In that case, it makes sense to just use an in-memory
// AVL tree under the hood.
class FileIndexStorage<K extends Tuple, V> {}

// insert(index, transaction, k, v)
// head = getHead(transaction, index)
// newHead = avl.insert(transaction, head, k, v)
// return newHead

// How do files work?
// - load entire file into memory, flush to disk with AVL tree in memory.
// - when scanning, we can scan writes as well as disk and compare results pretty easily.

function insert<K extends Tuple, V>(args: {
  transaction: AvlNodeTransaction<K, V>
  root: AvlNode<K, V> | undefined
  index: Index<K, V>
  key: K
  value: V
}) {}

function remove<K extends Tuple, V>(args: {
  transaction: AvlNodeTransaction<K, V>
  root: AvlNode<K, V> | undefined
  index: Index<K, V>
  key: K
}) {}

function get<K extends Tuple, V>(args: {
  transaction: AvlNodeTransaction<K, V>
  root: AvlNode<K, V> | undefined
  index: Index<K, V>
  key: K
}) {}

function scan<K extends Tuple, V>(args: {
  transaction: AvlNodeTransaction<K, V>
  root: AvlNode<K, V> | undefined
  index: Index<K, V>
  args: ScanArgs
}) {}

// const contacts: Index<[string], Contact> = {
//   name: "contacts",
//   sort: [1],
// }

// const contacts = new TreeDb<string, Contact>({
//   name: "contacts",

// const lastFirstIndex = new TreeDb<[string, string, string], null>({
//   name: "contacts-last-first",

// const emailIndex = new TreeDb<[string, string], null>({
//   name: "contacts-email",
