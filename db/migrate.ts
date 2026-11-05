import "dotenv/config";
import { applySqlMigrations } from "./index";

async function main() {
  await applySqlMigrations();
  console.log("Migrations applied successfully.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
