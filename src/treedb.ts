import { AvlTree, AvlNodeStorage } from "./avl-tree"

// TODO: need some kind of storage for the tree pointer.
export class TreeDb<K, V> {
  private storage: AvlNodeStorage<K, V>
  private compare: (a: K, b: K) => number
  constructor(args: {
    storage: AvlNodeStorage<K, V>
    compare: (a: K, b: K) => number
  }) {
    this.storage = args.storage
    this.compare = args.compare
  }

  private tree: AvlTree<K, V> | undefined
  async getTree() {
    if (this.tree) {
      return this.tree
    }

    // Change the root key and you can have many trees!
    // const nodeId = await this.db.get("root")
    this.tree = new AvlTree<K, V>({
      store: this.storage,
      compare: this.compare,
      root: undefined,
    })
    return this.tree
  }

  async get(key: K): Promise<V | undefined> {
    const tree = await this.getTree()
    const node = (await tree.find(key)).node
    if (node) {
      return node.value
    }
  }

  async set(key: K, value: V): Promise<void> {
    const tree = await this.getTree()
    this.tree = await tree.insert(key, value)
  }
}
