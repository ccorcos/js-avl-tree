import test from "ava"
import { InMemoryShardedKeyValueStore } from "../storage/memory"
import { KeyValueIndexWritableStore, Index } from "../src/db-index"

// We're going to create a database for storing contacts.
interface Contact {
  id: string
  first: string
  last: string
  email: string
}

// This is saves all contacts based on id. Think of this as the primary key
// index on a SQL table. This is equivalent to the following SQL statement:
// ```
// create table contacts (
//   id text primary key,
//   first text,
//   last text,
//   email text
// )
// ```
const primary: Index<[string], Contact> = {
  name: "contacts-primary",
  sort: [1],
}

// Create an index that orders contacts by last name, then first name. This is
// useful for displaying contacts in an ordered list. This is equivalent to a
// SQL statement such as:
// ```
// create index contacts_last_first on contacts using btree (last, first)
// ```
const lastFirst: Index<[string, string, string], null> = {
  name: "contacts-last-first",
  sort: [1, 1, 1],
}

// Create an index that orders contacts email. This is useful for looking up a
// contact given in an email. This is equivalent to the following SQL statement:
// ```
// create index contacts_email on contacts using btree (email)
// ```
const email: Index<[string, string], null> = {
  name: "contacts-email",
  sort: [1, 1],
}

const store = new KeyValueIndexWritableStore(new InMemoryShardedKeyValueStore())

async function saveContact(contact: Contact) {
  // Remove the existing value from all indexes.
  const transaction: any = {} // new Transaction(store)
  const prev = await transaction.get(primary, [contact.id])
  if (prev) {
    transaction.remove(primary, [prev.id])
    transaction.remove(lastFirst, [prev.last, prev.first, prev.id])
    transaction.remove(email, [prev.email, prev.id])
  }

  // Add new value to all indexes.
  transaction.set(primary, [contact.id], contact)
  transaction.set(lastFirst, [contact.last, contact.first, contact.id], null)
  transaction.set(email, [contact.email, contact.id], null)

  await store.batch(transaction)
}

// /**
//  * Lists contacts in last-first name order.
//  */
// async function* listContacts() {
//   const tree = await lastFirstIndex.getTree()
//   const iter = await tree.begin()
//   while (iter.valid) {
//     const [last, first, id] = iter.node!.key
//     const contact = await contacts.get(id)
//     yield contact!
//     await iter.next()
//   }
// }

// /**
//  * Lookup all contacts for a given email address.
//  */
// async function* lookupContacts(email: string) {
//   const tree = await emailIndex.getTree()
//   const iter = await tree.ge([email, ""])
//   while (iter.valid) {
//     const [e, id] = iter.node!.key
//     if (e !== email) {
//       return
//     }
//     const contact = await contacts.get(id)
//     yield contact!
//     await iter.next()
//   }
// }

// test("contacts example", async function(t) {
//   await saveContact({
//     id: "1",
//     first: "chet",
//     last: "corcos",
//     email: "chet@corcos.com",
//   })
//   await saveContact({
//     id: "2",
//     first: "simon",
//     last: "last",
//     email: "simon@last.com",
//   })
//   await saveContact({
//     id: "3",
//     first: "andrew",
//     last: "langdon",
//     email: "andrew@langdon.com",
//   })
//   await saveContact({
//     id: "4",
//     first: "meghan",
//     last: "navarro",
//     email: "chet@corcos.com",
//   })

//   const lastFirstOrder: Array<Contact> = []
//   for await (const contact of listContacts()) {
//     lastFirstOrder.push(contact)
//   }
//   t.is(lastFirstOrder.length, 4)
//   t.deepEqual(
//     lastFirstOrder.map(c => c.last),
//     ["corcos", "langdon", "last", "navarro"]
//   )

//   const lookupResults: Array<Contact> = []
//   for await (const contact of lookupContacts("chet@corcos.com")) {
//     lookupResults.push(contact)
//   }

//   t.is(lookupResults.length, 2)
// })
