export type BatchArgs<V> = {
  writes?: Record<string, V>
  deletes?: Set<string>
}

export interface ShardedKeyValueReadableStorage<V> {
  get: (shard: string, key: string) => Promise<V | undefined>
}

export interface ShardedKeyValueWritableStorage<V>
  extends ShardedKeyValueReadableStorage<V> {
  batch: (args: Record<string, BatchArgs<V>>) => Promise<void>
}

export interface KeyValueReadableStorage<V> {
  get: (key: string) => Promise<V | undefined>
}

export interface KeyValueWritableStorage<V> extends KeyValueReadableStorage<V> {
  batch: (args: BatchArgs<V>) => Promise<void>
}

export class KeyValueStore<V> implements KeyValueWritableStorage<V> {
  constructor(
    private store: ShardedKeyValueWritableStorage<V>,
    private shard: string
  ) {}
  get = (key: string): Promise<V | undefined> => {
    return this.store.get(this.shard, key)
  }
  batch = (args: BatchArgs<V>): Promise<void> => {
    return this.store.batch({ [this.shard]: args })
  }
}

export class KeyValueTransaction<V> {
  constructor(public store: KeyValueReadableStorage<V>) {}

  // Cache to improve performance during a transaction.
  private cache: Record<string, V | undefined> = {}
  private writes: Record<string, V> = {}
  private deletes: Set<string> = new Set()

  get = async (key: string): Promise<V | undefined> => {
    if (!key) {
      return
    }
    if (key in this.writes) {
      return this.writes[key]
    }
    if (this.deletes.has(key)) {
      return undefined
    }
    if (key in this.cache) {
      return this.cache[key]
    }
    const value = await this.store.get(key)
    if (value !== undefined) {
      this.cache[key] = value
    }
    return value
  }

  set = (key: string, value: V) => {
    if (this.deletes.has(key)) {
      this.deletes.delete(key)
    }
    if (key in this.cache) {
      delete this.cache[key]
    }
    this.writes[key] = value
  }

  // Don't remove the key, but undo the set if there was one.
  unset = (key: string) => {
    if (key in this.writes) {
      delete this.writes[key]
    }
  }

  remove = (key: string) => {
    if (key in this.writes) {
      delete this.writes[key]
    }
    if (key in this.cache) {
      delete this.cache[key]
    }
    this.deletes.add(key)
  }
}
