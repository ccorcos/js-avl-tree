import test from "ava"
import { TreeDb } from "../src/treedb"
import { LevelDb, LevelDbKeyValueStore } from "../storage/leveldb"
import { compare } from "../src/utils"

// Durable storage.
const store = new LevelDbKeyValueStore(new LevelDb("./contacts.leveldb"))

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
const contacts = new TreeDb<string, Contact>({
  name: "contacts",
  store: store,
  compare: compare,
})

// Create an index that orders contacts by last name, then first name. This is
// useful for displaying contacts in an ordered list. This is equivalent to a
// SQL statement such as:
// ```
// create index contacts_last_first on contacts using btree (last, first)
// ```
const lastFirstIndex = new TreeDb<[string, string, string], null>({
  name: "contacts-last-first",
  store: store,
  compare: (a, b) => {
    // Last
    if (a[0] > b[0]) {
      return 1
    }
    if (a[0] < b[0]) {
      return -1
    }

    // First
    if (a[1] > b[1]) {
      return 1
    }
    if (a[1] < b[1]) {
      return -1
    }

    // Id
    if (a[2] > b[2]) {
      return 1
    }
    if (a[2] < b[2]) {
      return -1
    }

    return 0
  },
})

// Create an index that orders contacts email. This is useful for looking up a
// contact given in an email. This is equivalent to the following SQL statement:
// ```
// create index contacts_email on contacts using btree (email)
// ```
const emailIndex = new TreeDb<[string, string], null>({
  name: "contacts-email",
  store: store,
  compare: (a, b) => {
    // Email
    if (a[0] > b[0]) {
      return 1
    }
    if (a[0] < b[0]) {
      return -1
    }

    // Id
    if (a[1] > b[1]) {
      return 1
    }
    if (a[1] < b[1]) {
      return -1
    }

    return 0
  },
})

async function saveContact(contact: Contact) {
  // Remove the existing value from all indexes.
  const existingContact = await contacts.get(contact.id)
  // TODO: batch!
  if (existingContact) {
    await contacts.remove(existingContact.id)
    await lastFirstIndex.remove([
      existingContact.last,
      existingContact.first,
      existingContact.id,
    ])
    await emailIndex.remove([existingContact.email, existingContact.id])
  }
  // Add new value to all indexes.
  await contacts.set(contact.id, contact)
  await lastFirstIndex.set([contact.last, contact.first, contact.id], null)
  await emailIndex.set([contact.email, contact.id], null)
}

/**
 * Lists contacts in last-first name order.
 */
async function* listContacts() {
  const tree = await lastFirstIndex.getTree()
  const iter = await tree.begin()
  while (iter.valid) {
    const [last, first, id] = iter.node!.key
    const contact = await contacts.get(id)
    yield contact!
    await iter.next()
  }
}

/**
 * Lookup all contacts for a given email address.
 */
async function* lookupContacts(email: string) {
  const tree = await emailIndex.getTree()
  const iter = await tree.ge([email, ""])
  while (iter.valid) {
    const [e, id] = iter.node!.key
    if (e !== email) {
      return
    }
    const contact = await contacts.get(id)
    yield contact!
    await iter.next()
  }
}

test("contacts example", async function(t) {
  await saveContact({
    id: "1",
    first: "chet",
    last: "corcos",
    email: "chet@corcos.com",
  })
  await saveContact({
    id: "2",
    first: "simon",
    last: "last",
    email: "simon@last.com",
  })
  await saveContact({
    id: "3",
    first: "andrew",
    last: "langdon",
    email: "andrew@langdon.com",
  })
  await saveContact({
    id: "4",
    first: "meghan",
    last: "navarro",
    email: "chet@corcos.com",
  })

  const lastFirstOrder: Array<Contact> = []
  for await (const contact of listContacts()) {
    lastFirstOrder.push(contact)
  }
  t.is(lastFirstOrder.length, 4)
  t.deepEqual(
    lastFirstOrder.map(c => c.last),
    ["corcos", "langdon", "last", "navarro"]
  )

  const lookupResults: Array<Contact> = []
  for await (const contact of lookupContacts("chet@corcos.com")) {
    lookupResults.push(contact)
  }

  t.is(lookupResults.length, 2)
})
