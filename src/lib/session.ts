import { cookies } from "next/headers";
import { db } from "@/db";
import { organizations, users } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { ensureSeeded } from "@/lib/seed";

export const ORG_COOKIE = "tm_org";
export const USER_COOKIE = "tm_user";

export async function listOrganizations() {
  await ensureSeeded();
  return db.select().from(organizations).orderBy(asc(organizations.createdAt));
}

export async function listUsers(orgId: string) {
  return db.select().from(users).where(eq(users.orgId, orgId)).orderBy(asc(users.createdAt));
}

export async function getCurrentOrg() {
  await ensureSeeded();
  const orgs = await db.select().from(organizations).orderBy(asc(organizations.createdAt));
  if (orgs.length === 0) throw new Error("No organizations found");

  const cookieStore = await cookies();
  const wanted = cookieStore.get(ORG_COOKIE)?.value;
  return orgs.find((o) => o.id === wanted) ?? orgs[0];
}

export async function getCurrentUser(orgId: string) {
  const orgUsers = await listUsers(orgId);
  if (orgUsers.length === 0) return null;

  const cookieStore = await cookies();
  const wanted = cookieStore.get(USER_COOKIE)?.value;
  return orgUsers.find((u) => u.id === wanted) ?? orgUsers[0];
}

export async function getSessionContext() {
  const org = await getCurrentOrg();
  const orgs = await listOrganizations();
  const orgUsers = await listUsers(org.id);
  const user = await getCurrentUser(org.id);
  return { org, orgs, orgUsers, user };
}
