export interface KeyValueReadableStorage<K, V> {
  get(key: K): Promise<V | undefined>
}

export interface KeyValueWritableStorage<K, V>
  extends KeyValueReadableStorage<K, V> {
  batch(args: { set?: Map<K, V>; remove?: Set<K> }): Promise<void>
}

export class KeyValueTransaction<K, V> {
  constructor(public store: KeyValueWritableStorage<K, V>) {}

  // Cache to improve performance during a transaction.
  private cache: Map<K, V | undefined> = new Map()
  private sets: Map<K, V> = new Map()
  private removes: Set<K> = new Set()

  async get(key: K): Promise<V | undefined> {
    if (!key) {
      return
    }
    if (this.sets.has(key)) {
      return this.sets.get(key)
    }
    if (this.removes.has(key)) {
      return undefined
    }
    if (this.cache.has(key)) {
      return this.cache.get(key)
    }
    const value = await this.store.get(key)
    if (value !== undefined) {
      this.cache.set(key, value)
    }
    return value
  }

  set(key: K, value: V) {
    if (this.removes.has(key)) {
      this.removes.delete(key)
    }
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }
    this.sets.set(key, value)
  }

  // Don't remove the key, but undo the set if there was one.
  unset(key: K) {
    if (this.sets.has(key)) {
      this.sets.delete(key)
    }
  }

  remove(key: K) {
    if (this.sets.has(key)) {
      this.sets.delete(key)
    }
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }
    this.removes.add(key)
  }

  async commit() {
    await this.store.batch({
      set: this.sets,
      remove: this.removes,
    })
    this.sets.clear()
    this.removes.clear()
    this.cache.clear()
  }
}
