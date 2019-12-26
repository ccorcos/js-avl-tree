export type BatchArgs<K, V> = {
  writes?: Map<K, V>
  deletes?: Set<K>
}

export interface ShardedKeyValueReadableStorage<V> {
  get: (shard: string, key: string) => Promise<V | undefined>
}

export interface ShardedKeyValueWritableStorage<V>
  extends ShardedKeyValueReadableStorage<V> {
  batch: (args: Record<string, BatchArgs<string, V>>) => Promise<void>
}

export interface KeyValueReadableStorage<V> {
  get: (key: string) => Promise<V | undefined>
}

export interface KeyValueWritableStorage<V> extends KeyValueReadableStorage<V> {
  batch: (args: BatchArgs<string, V>) => Promise<void>
}

export class KeyValueStore<V> implements KeyValueWritableStorage<V> {
  constructor(
    private store: ShardedKeyValueWritableStorage<V>,
    private shard: string
  ) {}
  get = (key: string): Promise<V | undefined> => {
    return this.store.get(this.shard, key)
  }
  batch = (args: BatchArgs<string, V>): Promise<void> => {
    return this.store.batch({ [this.shard]: args })
  }
}

export class KeyValueTransaction<V> {
  constructor(public store: KeyValueReadableStorage<V>) {}

  // Cache to improve performance during a transaction.
  private cache: Map<string, V | undefined> = new Map()
  private writes: Map<string, V> = new Map()
  private deletes: Set<string> = new Set()

  get = async (key: string): Promise<V | undefined> => {
    if (!key) {
      return
    }
    if (this.writes.has(key)) {
      return this.writes.get(key)
    }
    if (this.deletes.has(key)) {
      return undefined
    }
    if (this.cache.has(key)) {
      return this.cache.get(key)
    }
    const value = await this.store.get(key)
    this.cache.set(key, value)
    return value
  }

  set = (key: string, value: V) => {
    if (this.deletes.has(key)) {
      this.deletes.delete(key)
    }
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }
    this.writes.set(key, value)
  }

  // Don't remove the key, but undo the set if there was one.
  unset = (key: string) => {
    if (this.writes.has(key)) {
      this.writes.delete(key)
    }
  }

  remove = (key: string) => {
    if (this.writes.has(key)) {
      this.writes.delete(key)
    }
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }
    this.deletes.add(key)
  }
}
