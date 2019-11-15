// import test from "ava"
// import { AvlTree } from "../src/avl-tree3"
// import { InMemoryKeyValueStore, AvlNodeStore } from "../src/storage"
// import { compare } from "../src/utils"

// const store = new AvlNodeStore<any, any>(new InMemoryKeyValueStore())

// test("should function correctly given a non-reverse customCompare", function(t) {
//   var tree = new AvlTree<number, number>({
//     store: store,
//     root: undefined,
//     compare: compare,
//   })
//   tree = tree.insert(2, 1)
//   tree = tree.insert(1, 1)
//   tree = tree.insert(3, 1)
//   t.is(tree.root!.count, 3)
//   t.is(tree.findMinimum(), 3)
//   t.is(tree.findMaximum(), 1)
//   tree.delete(3)
//   t.is(tree.size(), 2)
//   t.is(tree._root!.key, 2)
//   t.is(tree._root!.left, undefined)
//   t.is(tree._root!.right!.key, 1)
// })

// test("should work when the key is a complex object", function(t) {
//   const tree = new AvlTree<{ innerKey: number }, number>((a, b) => {
//     return a.innerKey - b.innerKey
//   })
//   tree.insert({ innerKey: 1 }, 1)
//   t.true(tree.contains({ innerKey: 1 }))
//   t.false(tree.contains({ innerKey: 2 }))
// })
