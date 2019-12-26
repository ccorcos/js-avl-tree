import { TreeDb } from "../src/treedb"
import { LevelDb, LevelDbKeyValueStore } from "../storage/leveldb"
import { compare } from "../src/utils"
import { benchmark } from "./benchmark"

async function main() {
  console.log("starting")
  await benchmark(
    "treedb",
    new TreeDb<string, string>({
      name: "test" + Math.random().toString(),
      store: new LevelDbKeyValueStore(new LevelDb("./test.leveldb")),
      compare: compare,
    })
  )
  console.log("done")
}

main()
