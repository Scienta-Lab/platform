// https://nextjs.org/docs/app/guides/authentication#creating-a-data-access-layer-dal
import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { getUser } from "@/app/actions/get-user";

export const verifySession = cache(async () => {
  const user = await getUser();
  if (user instanceof Error) console.error(user.message);
  if (user instanceof Error || !user) redirect("/sign-in");

  return user;
});

const adminWhitelist = [
  "julien.duquesne@scientalab.com",
  "jonathan.plassais@scientalab.com",
];

export const verifyAdminSession = cache(async () => {
  const user = await verifySession();
  if (!adminWhitelist.includes(user.email)) redirect("/");
});
