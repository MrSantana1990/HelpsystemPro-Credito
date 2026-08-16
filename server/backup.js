import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

export function createConsistentBackup(
  database,
  root,
  prefix = "helpsystempro-credito",
) {
  const backupDirectory = resolve(root, "backups");
  mkdirSync(backupDirectory, { recursive: true });
  const stamp = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replaceAll(".", "-");
  const fileName = `${prefix}-${stamp}.db`;
  const destination = resolve(backupDirectory, fileName);
  const escaped = destination.replaceAll("'", "''");
  database.exec(`VACUUM INTO '${escaped}'`);
  const integrity = new DatabaseSync(destination, { readOnly: true });
  const result = integrity.prepare("PRAGMA integrity_check").get();
  integrity.close();
  if (result.integrity_check !== "ok")
    throw new Error(
      "O backup criado não passou na verificação de integridade.",
    );
  return { destination, fileName };
}
