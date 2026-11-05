import "dotenv/config";
import { config } from "dotenv";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "../db";
import { bids, competitions, purchaseRequests, users } from "../db/schema";

config({ path: ".env.local", override: true });

async function main() {
  const db = getDb();
  const [buyer] = await db
    .select()
    .from(users)
    .where(eq(users.email, "buyer@safqah.demo"))
    .limit(1);
  const passwordOk = Boolean(
    buyer && (await compare("SafqahDemo1!", buyer.passwordHash)),
  );
  const requestCount = (await db.select().from(purchaseRequests)).length;
  const bidCount = (await db.select().from(bids)).length;
  const [competition] = await db.select().from(competitions).limit(1);

  console.log(
    JSON.stringify(
      {
        passwordOk,
        role: buyer?.role ?? null,
        requestCount,
        bidCount,
        competitionStatus: competition?.status ?? null,
      },
      null,
      2,
    ),
  );
  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  await closeDb();
  process.exit(1);
});
