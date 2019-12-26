/*

This file contains abstractations that are useful for writing concise tests around
the AVL tree algorithm. However, it is not the best way to use this library.

*/

import {
  AvlNode,
  AvlNodeWritableStorage,
  AvlNodeTransaction,
  AvlNodeReadableStorage,
  getNode,
} from "./avl-storage"
import { Compare, insert, remove, get } from "./avl-tree"
import {
  AvlTreeIterator,
  find,
  begin,
  end,
  at,
  lt,
  le,
  gt,
  ge,
} from "./avl-iterator"
import { KeyValueTransaction } from "./key-value-storage"

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

  async insert(key: K, value: V) {
    const transaction = new KeyValueTransaction(this.store)
    const newRoot = await insert({
      transaction,
      compare: this.compare,
      root: this.root,
      key: key,
      value: value,
    })
    await this.store.batch(transaction)
    return new AvlTree({
      store: this.store,
      compare: this.compare,
      root: newRoot,
    })
  }

  async remove(key: K) {
    const transaction = new KeyValueTransaction(this.store)
    const newRoot = await remove({
      transaction,
      compare: this.compare,
      root: this.root,
      key,
    })
    await this.store.batch(transaction)
    return new AvlTree({
      store: this.store,
      compare: this.compare,
      root: newRoot,
    })
  }

  async get(key: K): Promise<V | undefined> {
    return get({
      store: this.store,
      compare: this.compare,
      root: this.root,
      key,
    })
  }

  async find(key: K): Promise<AvlTreeIterator<K, V>> {
    return find({
      store: this.store,
      compare: this.compare,
      root: this.root,
      key,
    })
  }

  async begin(): Promise<AvlTreeIterator<K, V>> {
    return begin({ store: this.store, root: this.root })
  }

  async end(): Promise<AvlTreeIterator<K, V>> {
    return end({ store: this.store, root: this.root })
  }

  async at(idx: number): Promise<AvlTreeIterator<K, V>> {
    return at({ store: this.store, root: this.root, idx })
  }

  async ge(key: K): Promise<AvlTreeIterator<K, V>> {
    return ge({
      store: this.store,
      root: this.root,
      compare: this.compare,
      key,
    })
  }

  async gt(key: K): Promise<AvlTreeIterator<K, V>> {
    return gt({
      store: this.store,
      root: this.root,
      compare: this.compare,
      key,
    })
  }

  async lt(key: K): Promise<AvlTreeIterator<K, V>> {
    return lt({
      store: this.store,
      root: this.root,
      compare: this.compare,
      key,
    })
  }

  async le(key: K): Promise<AvlTreeIterator<K, V>> {
    return le({
      store: this.store,
      root: this.root,
      compare: this.compare,
      key,
    })
  }

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
    return new AvlTreeBatch({
      root: this.root,
      compare: this.compare,
      store: this.store,
    })
  }
}

/**
 * A helper for batching transactions.
 */
export class AvlTreeBatch<K, V> {
  private root: AvlNode<K, V> | undefined
  private compare: Compare<K>
  private store: AvlNodeWritableStorage<K, V>
  private transaction: AvlNodeTransaction<K, V>
  private tasks: Array<
    (root: AvlNode<K, V> | undefined) => Promise<AvlNode<K, V> | undefined>
  > = []

  constructor(args: {
    root: AvlNode<K, V> | undefined
    compare: Compare<K>
    store: AvlNodeWritableStorage<K, V>
  }) {
    this.root = args.root
    this.compare = args.compare
    this.store = args.store
    this.transaction = new KeyValueTransaction(args.store)
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
    await this.store.batch(this.transaction)
    return new AvlTree({
      store: this.store,
      compare: this.compare,
      root: root,
    })
  }
}

/**
 * A helper method for walking a a tree.
 */
export class AvlTreeWalker<K, V> {
  store: AvlNodeReadableStorage<K, V>
  node: Promise<AvlNode<K, V> | undefined>

  constructor(args: {
    store: AvlNodeReadableStorage<K, V>
    node: Promise<AvlNode<K, V> | undefined>
  }) {
    this.store = args.store
    this.node = args.node
  }

  get left() {
    const left = this.node.then(n => n && getNode(this.store, n.leftId))
    return new AvlTreeWalker({
      store: this.store,
      node: left,
    })
  }

  get right() {
    const right = this.node.then(n => n && getNode(this.store, n.rightId))
    return new AvlTreeWalker({
      store: this.store,
      node: right,
    })
  }
}

async function printNode<K, V>(
  node: AvlNode<K, V> | undefined,
  store: AvlNodeReadableStorage<K, V>,
  indent = ""
): Promise<any> {
  if (!node) {
    return
  }
  return [
    indent + node.key + "(" + node.count + ")",
    await printNode(await getNode(store, node?.leftId), store, indent + "l:"),
    await printNode(await getNode(store, node?.rightId), store, indent + "r:"),
  ]
    .filter(Boolean)
    .join("\n")
}

export function printTree<K, V>(t: AvlTree<K, V>) {
  return printNode(t.root, t.store)
}
