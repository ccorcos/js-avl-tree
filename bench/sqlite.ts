import { SqliteKeyValueStore } from "../storage/sqlite"
import { benchmark } from "./benchmark"

async function main() {
  console.log("starting")
  await benchmark("sqlite", new SqliteKeyValueStore("./test.sqlite3"))
  console.log("done")
}

main()
