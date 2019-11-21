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

- garbage collection issue.
  - https://github.com/nodejs/node/issues/30554
  - https://bugs.chromium.org/p/v8/issues/detail?id=10003
- [ ] contacts example test
  - See thoughts below
  - [ ] batch get/set
    - we want to separate transactions from trees, because we would like to transact across multiple trees.
  - [ ] scan / cursoring
  - [ ] better abstractions for indexes.
- [ ] accept custom randomId generator.
- [ ] TodoMVC electron app
  - [ ] Reactivity?

## Thinking

If you want to write to multiple trees in one transaction, then its weird for both the store and the transaction to be encapsulated inside the AvlTree. "Pulling it out is a little awkward, but I think it's the proper way to do it." -- Meghan

AvlTree
  - root
  - compare
  - get(store)
  - insert(transaction)
  - remove(transaction)

I don't see any real need for all these fancy iterator functions other than being able to scan over the index. It is kind of cool to be able to remove items mid-iteration, like an efficient Array.filter. I don't think that's very practical though.

  - scan(store, {gt | gte} & {lt | lte})

The types are going to be tricky for a thing like this... There needs to be a min and a max sentinel value... Hmm. Maybe we can think about how indexes work first. Then we'd have some better constraints.

^TODO^