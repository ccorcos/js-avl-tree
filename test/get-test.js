import test from "ava"
import { AvlTree } from "../src/avl-tree"

test("should return the size of the tree", function(t) {
  var tree = new AvlTree()
  t.is(tree.get(1), undefined)
  t.is(tree.get(2), undefined)
  t.is(tree.get(3), undefined)
  tree.insert(1, 4)
  tree.insert(2, 5)
  tree.insert(3, 6)
  t.is(tree.get(1), 4)
  t.is(tree.get(2), 5)
  t.is(tree.get(3), 6)
})
