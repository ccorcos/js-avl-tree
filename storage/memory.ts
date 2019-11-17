import { AvlNode, AvlNodeStorage } from "../src/avl-tree"

export class InMemoryKeyValueStore {
  private map: Record<string, string> = {}
  async get(key: string) {
    return this.map[key]
  }
  async set(key: string, value: string) {
    this.map[key] = value
  }
  async delete(key: string) {
    delete this.map[key]
  }
}

export class InMemoryAvlNodeStorage<K, V> implements AvlNodeStorage<K, V> {
  constructor(private store: InMemoryKeyValueStore) {}
  async get(id: string | undefined) {
    if (!id) {
      return
    }
    const result = await this.store.get(id)
    if (result !== undefined) {
      return JSON.parse(result)
    }
  }
  async set(node: AvlNode<K, V>) {
    await this.store.set(node.id, JSON.stringify(node))
  }
  async delete(id: string) {
    await this.store.delete(id)
  }
}
