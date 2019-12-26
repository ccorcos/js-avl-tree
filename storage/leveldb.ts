import * as level from "level"
import { KeyValueWritableStorage, BatchArgs } from "../src/key-value-storage"

type LevelBatchOp =
  | { type: "del"; key: string }
  | { type: "put"; key: string; value: string }

interface LevelUp {
  put(key: string, value: string): Promise<void>
  get(key: string): Promise<string>
  del(key: string): Promise<void>
  batch(ops: Array<LevelBatchOp>): Promise<void>
}

/**
 * A wrapper around LevelUp with better semantics.
 */
export class LevelDb {
  db: LevelUp
  constructor(dbPath: string) {
    this.db = new level<string>(dbPath)
  }

  async get(id: string): Promise<string | undefined> {
    try {
      const result = await this.db.get(id)
      if (result === undefined) {
        return
      }
      return result
    } catch (error) {
      if (error.notFound) {
        return
      } else {
        throw error
      }
    }
  }

  async put(key: string, value: string): Promise<void> {
    await this.db.put(key, value)
  }

  async del(id: string): Promise<void> {
    try {
      await this.db.del(id)
    } catch (error) {
      if (error.notFound) {
        return
      } else {
        throw error
      }
    }
  }

  async batch(ops: Array<LevelBatchOp>): Promise<void> {
    await this.db.batch(ops)
  }
}

export class LevelDbKeyValueStore<T> implements KeyValueWritableStorage<T> {
  constructor(private db: LevelDb) {}

  async get(key: string): Promise<T | undefined> {
    const result = await this.db.get(key)
    if (result === undefined) {
      return
    }
    return JSON.parse(result)
  }

  async batch(args: BatchArgs<string, T>): Promise<void> {
    await this.db.batch([
      ...(args.writes
        ? Array.from(args.writes.entries()).map(([key, value]) => ({
            type: "put" as const,
            key,
            value: JSON.stringify(value),
          }))
        : []),
      ...(args.deletes
        ? Array.from(args.deletes).map(key => ({ type: "del" as const, key }))
        : []),
    ])
  }
}
