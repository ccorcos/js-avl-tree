export interface ShardedKeyValueReadableStorage {
  get: (shard: string, key: string) => Promise<any | undefined>
}

export interface ShardedKeyValueWritableStorage
  extends ShardedKeyValueReadableStorage {
  batch: (args: ShardedKeyValueTransaction) => Promise<void>
}

export interface KeyValueReadableStorage<V> {
  get: (key: string) => Promise<V | undefined>
}

export interface KeyValueWritableStorage<V> extends KeyValueReadableStorage<V> {
  batch: (args: KeyValueTransaction<V>) => Promise<void>
}

export class KeyValueReadableStore<V> implements KeyValueReadableStorage<V> {
  constructor(
    protected store: ShardedKeyValueReadableStorage,
    protected shard: string
  ) {}
  get = (key: string): Promise<V | undefined> => {
    return this.store.get(this.shard, key)
  }
}

// export class KeyValueWritableStore<V> extends KeyValueReadableStore<V>
//   implements KeyValueWritableStorage<V> {
//   constructor(
//     protected store: ShardedKeyValueWritableStorage<V>,
//     protected shard: string
//   ) {
//     super(store, shard)
//   }
//   batch = (args: KeyValueTransaction<V>): Promise<void> => {
//     return this.store.batch({ [this.shard]: args })
//   }
// }

export class KeyValueTransaction<V> {
  constructor(public store: KeyValueReadableStorage<V>) {}

  // Cache to improve performance during a transaction.
  private cache: Map<string, V | undefined> = new Map()
  public writes: Map<string, V> = new Map()
  public deletes: Set<string> = new Set()

  get = async (key: string): Promise<V | undefined> => {
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

export class ShardedKeyValueTransaction
  implements ShardedKeyValueReadableStorage {
  constructor(public store: ShardedKeyValueReadableStorage) {}

  public shards: Record<string, KeyValueTransaction<any>> = {}

  public getShard<T>(shard: string): KeyValueTransaction<T> {
    let transaction = this.shards[shard]
    if (!transaction) {
      transaction = new KeyValueTransaction(
        new KeyValueReadableStore(this.store, shard)
      )
      this.shards[shard] = transaction
    }
    return transaction
  }

  get = async (shard: string, key: string): Promise<any | undefined> => {
    return this.getShard(shard).get(key)
  }

  set = (shard: string, key: string, value: any) => {
    return this.getShard(shard).set(key, value)
  }

  unset = (shard: string, key: string) => {
    return this.getShard(shard).unset(key)
  }

  remove = (shard: string, key: string) => {
    return this.getShard(shard).remove(key)
  }
}
