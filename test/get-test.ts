import test from "ava"
import { insert, get } from "../src/avl-tree3"
import {
  InMemoryKeyValueStore,
  AvlNodeStore,
  Transaction,
} from "../src/storage"
import { compare } from "../src/utils"

test("should return the size of the tree", function(t) {
  const store = new AvlNodeStore<number, number>(new InMemoryKeyValueStore())

  const transaction = new Transaction(store)
  const t1 = insert({ transaction, compare, key: 1, value: 4, root: undefined })
  const t2 = insert({ transaction, compare, key: 2, value: 5, root: t1 })
  const t3 = insert({ transaction, compare, key: 3, value: 6, root: t2 })
  transaction.commit()

  t.is(get({ store, compare, key: 1, root: t3 }), 4)
  t.is(get({ store, compare, key: 2, root: t3 }), 5)
  t.is(get({ store, compare, key: 3, root: t3 }), 6)
})
