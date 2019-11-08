import test from "ava"
import { AvlTree } from "../src/avl-tree"

test("should return whether the tree is empty", function(t) {
  var tree = new AvlTree<number, number>()
  t.true(tree.isEmpty())
  tree.insert(1, 1)
  t.false(tree.isEmpty())
  tree.delete(1)
  t.true(tree.isEmpty())
})
