import { DatabaseSync } from "node:sqlite";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { basename, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = process.env.DATA_DIRECTORY
  ? resolve(process.env.DATA_DIRECTORY)
  : resolve(root, "data");
const backupDirectory = resolve(root, "backups");
const databasePath = resolve(dataDirectory, "helpsystempro-credito.db");
const requested = process.argv[2];

if (!requested)
  throw new Error("Informe o caminho de um backup criado pelo sistema.");
const source = resolve(requested);
if (!source.startsWith(`${backupDirectory}${sep}`))
  throw new Error(`Por segurança, o arquivo deve estar em ${backupDirectory}`);
if (!existsSync(source) || !source.toLowerCase().endsWith(".db"))
  throw new Error("Backup .db não encontrado.");

const lockPath = resolve(dataDirectory, "server.lock");
if (existsSync(lockPath)) {
  try {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    process.kill(Number(lock.pid), 0);
    throw new Error(
      "Feche o HelpSystemPro Crédito antes de restaurar um backup.",
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Feche"))
      throw error;
  }
}

const candidate = new DatabaseSync(source, { readOnly: true });
const integrity = candidate.prepare("PRAGMA integrity_check").get();
candidate.close();
if (integrity.integrity_check !== "ok")
  throw new Error(
    "O arquivo selecionado não passou na verificação de integridade.",
  );

mkdirSync(backupDirectory, { recursive: true });
if (existsSync(databasePath)) {
  const stamp = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replaceAll(".", "-");
  copyFileSync(
    databasePath,
    resolve(backupDirectory, `antes-da-restauracao-${stamp}.db`),
  );
}
for (const suffix of ["-wal", "-shm"]) {
  const sidecar = `${databasePath}${suffix}`;
  if (existsSync(sidecar)) rmSync(sidecar, { force: true });
}
copyFileSync(source, databasePath);
console.log(`Backup restaurado com sucesso: ${basename(source)}`);
console.log("Uma cópia da base anterior foi preservada na pasta backups.");
