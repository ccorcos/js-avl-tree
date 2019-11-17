import { TreeDb } from "../src/treedb"
import { LevelDb, LevelDbAvlNodeStorage } from "../storage/leveldb"
import { compare } from "../src/utils"
import { benchmark } from "./benchmark"

async function main() {
  console.log("starting")
  await benchmark(
    "treedb",
    new TreeDb<string, string>({
      storage: new LevelDbAvlNodeStorage(new LevelDb("./chet.leveldb")),
      // storage: new InMemoryAvlNodeStorage(new InMemoryKeyValueStore()),
      compare: compare,
    })
  )
  console.log("done")
}

main()
