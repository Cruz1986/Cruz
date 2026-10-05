/**
 * Gives a signed-up account a staff role — how the first super admin is made. Later roles are managed in the
 * app (Admin → Users & roles).
 *
 *   DATABASE_URL=… pnpm admin:grant --email you@example.com [--role super_admin|content_admin|editor]
 *
 * The person must have signed in to the site once, so their account exists.
 */
import { parseArgs } from "node:util";
import postgres from "postgres";

const ROLES = ["super_admin", "content_admin", "editor"];
const { values } = parseArgs({
  options: { email: { type: "string" }, role: { type: "string", default: "super_admin" } },
});
const email = values.email?.trim().toLowerCase();
if (!email || !ROLES.includes(values.role!)) {
  console.error(`Usage: pnpm admin:grant --email <address> [--role ${ROLES.join("|")}]`);
  process.exit(2);
}

async function main(email: string, role: string) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const [user] = await sql<{ id: string }[]>`select id from auth.users where lower(email) = ${email}`;
    if (!user) {
      console.error(`No account for ${email}. Sign in to the site once with that address, then run this again.`);
      process.exitCode = 1;
    } else {
      const added = await sql`
        insert into public.user_roles (user_id, role_id)
        select ${user.id}, r.id from public.roles r where r.key = ${role}
        on conflict do nothing
        returning user_id`;
      console.log(added.length ? `${email} is now ${role}.` : `${email} already has ${role}.`);
    }
  } finally {
    await sql.end();
  }
}

main(email, values.role!).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
