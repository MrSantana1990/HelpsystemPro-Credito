import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../server/database.js";
import { createConsistentBackup } from "../server/backup.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
try {
  const result = createConsistentBackup(db, root, "backup-manual");
  console.log(`Backup criado e verificado: ${result.destination}`);
} finally {
  db.close();
}
