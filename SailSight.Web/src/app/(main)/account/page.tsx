"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Input, Button } from "@/components/ui/controls";


export default function AccountPage() {
  const { me, refresh, logout } = useAuth();
  const [displayName, setDisplayName] = useState(me?.displayName ?? "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMessage, setPwMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setDisplayName(me?.displayName ?? "");
  }, [me]);



  async function saveProfile() {
    await api.PATCH("/api/v1/me", { body: { displayName } });
    await refresh();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMessage(null);
    if (newPassword !== confirmPassword) {
      setPwMessage({ ok: false, text: "Passwords do not match." });
      return;
    }
    const { error } = await api.POST("/api/v1/me/password", { body: { currentPassword, newPassword } });
    if (error) {
      setPwMessage({ ok: false, text: "Could not change password. Check your current password." });
      return;
    }
    setPwMessage({ ok: true, text: "Password changed." });
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
  }

  if (!me) return <div>Loading…</div>;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-2xl font-bold text-action-primary">Account</h1>
        <div className="max-w-md space-y-2">
          <label className="block text-sm">Display name</label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <Button onClick={saveProfile}>Save</Button>
        </div>
        <p className="mt-2 text-sm text-text-secondary">{me.email} · {me.roles?.join(", ") || "User"}</p>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold">Change password</h2>
        <form onSubmit={changePassword} className="max-w-md space-y-2">
          <Input type="password" autoComplete="current-password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          <Input type="password" autoComplete="new-password" placeholder="New password (min 12 chars)" minLength={12} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          <Input type="password" autoComplete="new-password" placeholder="Confirm new password" minLength={12} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          {pwMessage && <div className={`text-sm ${pwMessage.ok ? "text-green-500" : "text-red-500"}`}>{pwMessage.text}</div>}
          <Button type="submit">Change password</Button>
        </form>
      </section>


      <section>
        <Button variant="danger" onClick={logout}>Sign out</Button>
      </section>
    </div>
  );
}
