import { randomId } from "./utils"
import {
  KeyValueTransaction,
  KeyValueReadableStorage,
  KeyValueWritableStorage,
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

export type AvlNodeTransaction<K, V> = KeyValueTransaction<AvlNode<K, V>>

export type AvlNodeReadableStorage<K, V> = KeyValueReadableStorage<
  AvlNode<K, V>
>

export type AvlNodeWritableStorage<K, V> = KeyValueWritableStorage<
  AvlNode<K, V>
>

export async function getNode<K, V>(
  store: AvlNodeReadableStorage<K, V>,
  id: string | undefined
) {
  if (id === undefined) {
    return
  }
  return store.get(id)
}

export async function setNode<K, V>(
  store: AvlNodeTransaction<K, V>,
  node: AvlNode<K, V>
) {
  return store.set(node.id, node)
}

export function cloneNode<K, V>(
  transaction: AvlNodeTransaction<K, V>,
  node: AvlNode<K, V>
) {
  // When cloning a node, remove it from the write so we don't create unnecessary
  // amounts of data. The `checkStore` test cases make sure of this.
  transaction.unset(node.id)
  const newNode: AvlNode<K, V> = {
    ...node,
    id: randomId(),
  }
  return newNode
}
