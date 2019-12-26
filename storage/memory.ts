import {
  ShardedKeyValueWritableStorage,
  KeyValueWritableStorage,
  ShardedKeyValueTransaction,
  KeyValueTransaction,
} from "../src/key-value-storage"

export class InMemoryShardedKeyValueStore
  implements ShardedKeyValueWritableStorage {
  private map: Map<string, KeyValueWritableStorage<any>> = new Map()

  get = async (shard: string, key: string): Promise<any | undefined> => {
    return this.map.get(shard)?.get(key)
  }

  batch = async (args: ShardedKeyValueTransaction): Promise<void> => {
    Object.entries(args.shards).map(([shard, batch]) => {
      let store = this.map.get(shard)
      if (!store) {
        store = new InMemoryKeyValueStore()
        this.map.set(shard, store)
      }
      store.batch(batch)
    })
  }
}

export class InMemoryKeyValueStore<T> implements KeyValueWritableStorage<T> {
  private map: Record<string, string> = {}

  async get(key: string): Promise<T | undefined> {
    const result = this.map[key]
    if (result === undefined) {
      return
    }
    return JSON.parse(result)
  }

  async batch(args: KeyValueTransaction<T>): Promise<void> {
    if (args.writes) {
      for (const [key, value] of args.writes.entries()) {
        // TODO: use Object.freeze instead for perf.
        this.map[key] = JSON.stringify(value)
      }
    }
    if (args.deletes) {
      for (const key of Array.from(args.deletes)) {
        delete this.map[key]
      }
    }
  }
}
