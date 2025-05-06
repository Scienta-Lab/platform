"use client";

import logo from "@/public/logo.svg";
import Image from "next/image";
import Link from "next/link";

import { UserMenu } from "./user-menu";
import { useUser } from "./user-context";

export function AppHeader() {
  const user = useUser();
  return (
    <header className="sticky top-0 z-50 flex h-20 items-center justify-between overscroll-contain border-b border-gray-200 bg-white px-10">
      <Link href="/" className="contents">
        <Image src={logo} alt="Logo" width={120} height={40} unoptimized />
      </Link>
      <div className="flex items-center gap-4">
        <p className="text-sm text-gray-400">
          Hello, {user?.email ?? "Dear User"}
        </p>
        <UserMenu />
      </div>
    </header>
  );
}
