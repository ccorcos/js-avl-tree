import { AvlTree, AvlNode, AvlNodeStorage } from "./avl-tree"

export interface KeyValueStorage {
  get(key: string): Promise<any>
  set(key: string, value: any): Promise<void>
  delete(key: string): Promise<void>
}

function headKey(treeName: string) {
  return "avltree-head:" + treeName
}

export class TreeDb<K, V> {
  private store: KeyValueStorage

  private storage: AvlNodeStorage<K, V> = {
    get: async (id: string | undefined): Promise<AvlNode<K, V> | undefined> => {
      if (id === undefined) {
        return
      }
      return this.store.get(id)
    },
    set: async (node: AvlNode<K, V>): Promise<void> => {
      return this.store.set(node.id, node)
    },
    // delete: async (id: string): Promise<void> => {
    //   return this.store.delete(id)
    // },
  }

  private compare: (a: K, b: K) => number

  private name: string
  constructor(args: {
    name: string
    store: KeyValueStorage
    compare: (a: K, b: K) => number
  }) {
    this.name = args.name
    this.store = args.store
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
    const newTree = await tree
      .transact()
      .insert(key, value)
      .commit()
    await this.store.set(headKey(this.name), newTree.root?.id)
    this.tree = newTree
  }

  async remove(key: K): Promise<void> {
    const tree = await this.getTree()
    const newTree = await tree
      .transact()
      .remove(key)
      .commit()
    await this.store.set(headKey(this.name), newTree.root?.id)
    this.tree = newTree
  }
}
