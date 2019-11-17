import { AvlNode, AvlNodeStorage } from "./avl-tree"

export class InMemoryKeyValueStore {
  map: Record<string, string> = {}
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

export class AvlNodeStore<K, V> implements AvlNodeStorage<K, V> {
  constructor(public store: InMemoryKeyValueStore) {}

  async get(id: string | undefined): Promise<AvlNode<K, V> | undefined> {
    if (id === undefined) {
      return
    }
    const result = this.store.get(id)
    if (result !== undefined) {
      return JSON.parse(result)
    }
  }

  async set(node: AvlNode<K, V>) {
    this.store.set(node.id, JSON.stringify(node))
  }

  async delete(id: string) {
    this.store.delete(id)
  }
}
