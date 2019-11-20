# TreeDb

This library is a very simple database primitive.

## Description

**Warning: Jargon**

TreeDb is an immutable AVL-tree with a custom comparison function built on top of any key-value store. Let's break that down:

- An [AVL-tree](https://en.wikipedia.org/wiki/AVL_tree) is a [balanced binary search tree](https://en.wikipedia.org/wiki/Self-balancing_binary_search_tree) algorithm with `O(log n)` inserts, updates, and deletions. Any database fundamentally operates on binary trees.

- The AVL-tree is immutable, meaning that it is a [persistent data-structure](https://en.wikipedia.org/wiki/Persistent_data_structure). That means you the entire history of the database is preserved so can rewind the database. This is also a very nice property for dealing with [multi-version concurrency control](https://en.wikipedia.org/wiki/Multiversion_concurrency_control).

- The AVL-tree orders values using a custom comparison function. This is really useful for creating [composite indexes](https://en.wikipedia.org/wiki/Composite_index_(database)).

- This AVL-tree is built on top of any key-value store and can be written to durable storage using, for example, LevelDb.

## Example

Soming soon...

## To Do

- contacts example
  - batch get/set
  - scan / cursoring
  - better abstractions for indexes.
- accept custom randomId generator.
- garbage collection issue.