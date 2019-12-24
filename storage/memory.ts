import { KeyValueWritableStorage } from "../src/key-value-storage"

export class InMemoryKeyValueStorage<T> implements KeyValueWritableStorage<T> {
  private map: Record<string, string> = {}

  async get(key: string): Promise<T | undefined> {
    const result = this.map[key]
    if (result === undefined) {
      return
    }
    return JSON.parse(result)
  }

  async batch(args: {
    set?: Record<string, T>
    remove?: Set<string>
  }): Promise<void> {
    if (args.set) {
      for (const [key, value] of Object.entries(args.set)) {
        // TODO: use Object.freeze instead for perf.
        this.map[key] = JSON.stringify(value)
      }
    }
    if (args.remove) {
      for (const key of Array.from(args.remove)) {
        delete this.map[key]
      }
    }
  }
}
