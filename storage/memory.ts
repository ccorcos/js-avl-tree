import { KeyValueWritableStorage, BatchArgs } from "../src/key-value-storage"

export class InMemoryKeyValueStorage<T> implements KeyValueWritableStorage<T> {
  private map: Record<string, string> = {}

  async get(key: string): Promise<T | undefined> {
    const result = this.map[key]
    if (result === undefined) {
      return
    }
    return JSON.parse(result)
  }

  async batch(args: BatchArgs<T>): Promise<void> {
    if (args.writes) {
      for (const [key, value] of Object.entries(args.writes)) {
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
