export class Node<K, V> {
  left: Node<K, V> | undefined
  right: Node<K, V> | undefined
  height: number = 0
  constructor(public key: K, public value: V) {}

  /**
   * Performs a right rotate on this node.
   *
   *       b                           a
   *      / \                         / \
   *     a   e -> b.rotateRight() -> c   b
   *    / \                             / \
   *   c   d                           d   e
   *
   * @return {Node} The root of the sub-tree; the node where this node used to be.
   */
  rotateRight() {
    var other = this.left
    if (!other) {
      throw Error("Cannot rotateRight without a left!")
    }
    this.left = other.right
    other.right = this
    this.height = Math.max(this.leftHeight(), this.rightHeight()) + 1
    other.height = Math.max(other.leftHeight(), this.height) + 1
    return other
  }

  /**
   * Performs a left rotate on this node.
   *
   *     a                              b
   *    / \                            / \
   *   c   b   -> a.rotateLeft() ->   a   e
   *      / \                        / \
   *     d   e                      c   d
   *
   * @return {Node} The root of the sub-tree; the node where this node used to be.
   */
  rotateLeft() {
    var other = this.right
    if (!other) {
      throw Error("Cannot rotateLeft without a right!")
    }
    this.right = other.left
    other.left = this
    this.height = Math.max(this.leftHeight(), this.rightHeight()) + 1
    other.height = Math.max(other.rightHeight(), this.height) + 1
    return other
  }

  /**
   * Convenience function to get the height of the left child of the node,
   * returning -1 if the node is undefined.
   *
   * @return {number} The height of the left child, or -1 if it doesn't exist.
   */
  leftHeight() {
    if (!this.left) {
      return -1
    }
    return this.left.height
  }

  /**
   * Convenience function to get the height of the right child of the node,
   * returning -1 if the node is undefined.
   *
   * @return {number} The height of the right child, or -1 if it doesn't exist.
   */
  rightHeight() {
    if (!this.right) {
      return -1
    }
    return this.right.height
  }
}
