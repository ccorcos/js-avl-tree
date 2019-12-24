export interface KeyValueReadableStorage<V> {
  get(key: string): Promise<V | undefined>
}

export interface KeyValueWritableStorage<V> extends KeyValueReadableStorage<V> {
  batch(args: { set?: Record<string, V>; remove?: Set<string> }): Promise<void>
}

export class KeyValueTransaction<V> {
  constructor(public store: KeyValueWritableStorage<V>) {}

  // Cache to improve performance during a transaction.
  private cache: Record<string, V | undefined> = {}
  private sets: Record<string, V> = {}
  private removes: Set<string> = new Set()

  async get(key: string): Promise<V | undefined> {
    if (!key) {
      return
    }
    if (key in this.sets) {
      return this.sets[key]
    }
    if (this.removes.has(key)) {
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

  set(key: string, value: V) {
    if (this.removes.has(key)) {
      this.removes.delete(key)
    }
    if (key in this.cache) {
      delete this.cache[key]
    }
    this.sets[key] = value
  }

  // Don't remove the key, but undo the set if there was one.
  unset(key: string) {
    if (key in this.sets) {
      delete this.sets[key]
    }
  }

  remove(key: string) {
    if (key in this.sets) {
      delete this.sets[key]
    }
    if (key in this.cache) {
      delete this.cache[key]
    }
    this.removes.add(key)
  }

  async commit() {
    await this.store.batch({
      set: this.sets,
      remove: this.removes,
    })
    this.sets = {}
    this.cache = {}
    this.removes.clear()
  }
}
