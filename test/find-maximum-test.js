import test from "ava"
import { AvlTree } from "../src/avl-tree"

test("should return the maximum key in the tree", function(t) {
  var tree = new AvlTree()
  tree.insert(3, undefined)
  tree.insert(5, undefined)
  tree.insert(1, undefined)
  tree.insert(4, undefined)
  tree.insert(2, undefined)
  t.is(tree.findMaximum(), 5)
})
