import { AvlNodeWritableStorage, AvlNodeWritableStore } from "./avl-storage"
import { AvlTree } from "./avl-test-helpers"
import { KeyValueWritableStorage } from "./key-value-storage"

function headKey(treeName: string) {
  return "avltree-head:" + treeName
}

export class TreeDb<K, V> {
  private store: KeyValueWritableStorage<any>
  private storage: AvlNodeWritableStorage<K, V>

  private compare: (a: K, b: K) => number

  private name: string
  constructor(args: {
    name: string
    store: KeyValueWritableStorage<any>
    compare: (a: K, b: K) => number
  }) {
    this.name = args.name
    this.store = args.store
    this.storage = new AvlNodeWritableStore(args.store)
    this.compare = args.compare
  }

  private tree: AvlTree<K, V> | undefined
  async getTree() {
    if (this.tree) {
      return this.tree
    }
    const nodeId: string = await this.store.get(headKey(this.name))
    const root = await this.storage.get(nodeId)
    this.tree = new AvlTree<K, V>({
      store: this.storage,
      compare: this.compare,
      root: root,
    })
    return this.tree
  }

  async get(key: K): Promise<V | undefined> {
    const tree = await this.getTree()
    return await tree.get(key)
  }

  async set(key: K, value: V): Promise<void> {
    const tree = await this.getTree()
    const newTree = await tree.insert(key, value)
    await this.store.batch({
      writes: new Map([[headKey(this.name), newTree.root?.id]]),
    })
    this.tree = newTree
  }

  async remove(key: K): Promise<void> {
    const tree = await this.getTree()
    const newTree = await tree.remove(key)
    await this.store.batch({
      writes: new Map([[headKey(this.name), newTree.root?.id]]),
    })
    this.tree = newTree
  }
}
