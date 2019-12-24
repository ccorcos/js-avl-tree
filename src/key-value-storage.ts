export interface KeyValueReadableStorage<V> {
  get(key: string): Promise<V | undefined>
}

export interface KeyValueWritableStorage<V> extends KeyValueReadableStorage<V> {
  batch(args: { set?: Record<string, V>; remove?: Set<string> }): Promise<void>
}

export class KeyValueStorage {
  constructor(private store: KeyValueWritableStorage<any>) {}
  get(key: string): Promise<any | undefined> {
    return this.store.get(key)
  }
  batch(args: {
    set?: Record<string, any>
    remove?: Set<string>
  }): Promise<void> {
    return this.store.batch(args)
  }
  map<T>(namespace: string) {
    return new NamespacedKeyValueStorage<T>(this, namespace)
  }
}

export class NamespacedKeyValueStorage<V> {
  constructor(
    private store: KeyValueWritableStorage<V>,
    private namespace: string
  ) {}
  get(key: string): Promise<V | undefined> {
    return this.store.get(this.namespace + ":" + key)
  }
  batch(args: { set?: Record<string, V>; remove?: Set<string> }) {
    const newArgs: typeof args = {}
    if (args.set) {
      const set: typeof args["set"] = {}
      for (const [key, value] of Object.entries(args.set)) {
        set[this.namespace + ":" + key] = value
      }
      newArgs.set = set
    }
    if (args.remove) {
      const remove = new Set<string>()
      for (const key of Array.from(args.remove)) {
        remove.add(this.namespace + ":" + key)
      }
      newArgs.remove = remove
    }
    return newArgs
  }
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
