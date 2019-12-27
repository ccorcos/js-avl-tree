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

- clean up transactions ux.
  - creating a transaction, werid arguments for KeyValueIndexWritableStore inside contacts-example2.

- File storage abstraction with in-memory AVL store that flushes to disk.

- rip out treedb -- its no longer useful for us.
- clean up some of the avl-test-helpers.

- Make a Table abstraction like SQL for indexing documents.

- Reactivity + listeners for building an electron app
  - TodoMVC electron example.

- Methodology for cleaning up history if we want
  - this is useful for MVCC without too much storage requirements.
  - could be nice to be able to keep some snapshots around.

- accept custom randomId generator.

- garbage collection issue.
  - https://github.com/nodejs/node/issues/30554
  - https://bugs.chromium.org/p/v8/issues/detail?id=10003
