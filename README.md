# TreeDb

This library is a very simple database primitive.

## Description

**Jargon Warning**

TreeDb is an immutable AVL-tree with a custom comparison function built on top of any key-value store. Let's break that down:

- An [AVL-tree](https://en.wikipedia.org/wiki/AVL_tree) is a [balanced binary search tree](https://en.wikipedia.org/wiki/Self-balancing_binary_search_tree) algorithm with `O(log n)` inserts, updates, and deletions. Any database fundamentally operates on binary trees.

- The AVL-tree is immutable, meaning that it is a [persistent data-structure](https://en.wikipedia.org/wiki/Persistent_data_structure). That means you the entire history of the database is preserved so can rewind the database. This is also a very nice property for dealing with [multi-version concurrency control](https://en.wikipedia.org/wiki/Multiversion_concurrency_control).

- The AVL-tree orders values using a custom comparison function. This is really useful for creating [composite indexes](https://en.wikipedia.org/wiki/Composite_index_(database)).

- This AVL-tree is built on top of any key-value store and can be written to durable storage using, for example, LevelDb.

## Example

Soming soon...

## To Do

- use key-value storage as the basis for everything.
  - construct nodestorage from key-value storage.
  - construct nodetransaction from key-value transaction
  - construct indexstorage from key-value storage.
  - construct head-storage.
  - do all of this on AVL and consider how this can work with files later.

- avl transaction should use an underyling storage transaction.
- the transaction layer should be on key-value-storage, not on AVL storage.

- index storage + transaction abstractions
- contacts app test example
- client reactivity + TodoMVC

- batched set/get across multiple trees.
  - see contacts-example test.
  - [ ] rewrite contacts-example using primitives instead of AVLTree.
    - [ ] treedb should be called avl-index and have some functions for writing the head.
          then, treedb is just a collection of indexes?
  - [ ] think about what's the best abstraction for this?

- methodology for cleaning up history if we want
  - this is useful for MVCC without too much storage requirements.
  - could be nice to be able to keep some snapshots around.

- [ ] scan / cursoring
- [ ] better abstractions for indexes.

- [ ] accept custom randomId generator.

- [ ] TodoMVC electron app
  - [ ] Reactivity?

- garbage collection issue.
  - https://github.com/nodejs/node/issues/30554
  - https://bugs.chromium.org/p/v8/issues/detail?id=10003
