"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface Org {
  id: string;
  name: string;
}
interface UserOpt {
  id: string;
  name: string;
  role: string;
}

export function OrgUserSwitcher({
  orgs,
  currentOrgId,
  orgUsers,
  currentUserId,
}: {
  orgs: Org[];
  currentOrgId: string;
  orgUsers: UserOpt[];
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [orgId, setOrgId] = useState(currentOrgId);
  const [userId, setUserId] = useState(currentUserId ?? "");

  async function switchOrg(next: string) {
    setOrgId(next);
    await fetch("/api/org/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: next }),
    });
    startTransition(() => router.refresh());
  }

  async function switchUser(next: string) {
    setUserId(next);
    await fetch("/api/user/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: next }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <div className={`flex flex-col gap-2 ${isPending ? "opacity-60" : ""}`}>
      <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        Organization
        <select
          value={orgId}
          onChange={(e) => switchOrg(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
        >
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        Acting as
        <select
          value={userId}
          onChange={(e) => switchUser(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
        >
          {orgUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.role})
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
