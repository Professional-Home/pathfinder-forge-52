import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { User, Bell, Shield, LogOut } from "lucide-react";
import { mockUser } from "@/lib/mockUser";
import type { Domain } from "@/lib/domain";
import { supabase } from "@/utils/supabase";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
});

import { useState } from "react";

function SettingsPage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profile").select("*").eq("id", user.id).single();
      return data || { name: user.email?.split("@")[0], email: user.email };
    }
  });

  const user = { ...mockUser, lane: "student" as Domain };

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Error logging out:', error.message);
    } else {
      console.log('Successfully logged out');
      navigate({ to: '/' });
    }
  }

  async function handleSaveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSaveMessage("");

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const mobile = formData.get("mobile") as string;
    const college = formData.get("college") as string;
    const degree = formData.get("degree") as string;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Update profile table
    await supabase.from("profile").update({
      name,
      mobile,
      college,
      degree
    }).eq("id", user.id);

    // Update users table
    await supabase.from("users").update({
      name,
      phone_no: mobile
    }).eq("id", user.id);

    setSaving(false);
    setSaveMessage("Profile updated successfully!");
    
    // Clear success message after 3 seconds
    setTimeout(() => setSaveMessage(""), 3000);
  }

  return (
    <div className="space-y-12 max-w-3xl">
      <div>
        <h1 className="font-display text-4xl">Settings</h1>
        <p className="mt-2 text-muted-foreground">Manage your account, preferences, and notifications.</p>
      </div>

      <div className="space-y-8">
        <section>
          <div className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <User className="h-4 w-4" /> Profile Information
          </div>
          <div className="rounded-xl border border-border bg-background p-6">
            <div className="flex items-center gap-6 border-b border-border pb-6">
              <div className="grid h-20 w-20 place-items-center rounded-full bg-surface-elevated font-display text-3xl text-muted-foreground">
                {user.avatar}
              </div>
              <div>
                <button className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-surface-elevated transition">
                  Change avatar
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="grid gap-6 pt-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Full Name</label>
                <input name="name" type="text" defaultValue={profile?.name || user.name} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Email Address</label>
                <input type="email" defaultValue={profile?.email || user.email} disabled className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Mobile Number</label>
                <input name="mobile" type="tel" defaultValue={profile?.mobile || ""} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none" placeholder="+1 234 567 8900" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">College / University</label>
                <input name="college" type="text" defaultValue={profile?.college || ""} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none" placeholder="University Name" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Degree</label>
                <input name="degree" type="text" defaultValue={profile?.degree || ""} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none" placeholder="e.g. B.Sc. Computer Science" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Default Lane</label>
                <select defaultValue={user.lane} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none capitalize">
                  <option value="student">Student</option>
                  <option value="startup">Startup</option>
                  <option value="researcher">Researcher</option>
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">Changing your lane will completely reconfigure your learning path, mentors, and guidance feed.</p>
              </div>
            <div className="mt-6 flex items-center justify-end gap-4">
              {saveMessage && <span className="text-xs font-medium text-green-600 dark:text-green-400">{saveMessage}</span>}
              <button disabled={saving} className="rounded-md bg-foreground px-4 py-2 text-xs font-medium text-background hover:opacity-90 transition disabled:opacity-50">
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
            </form>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <Bell className="h-4 w-4" /> Notifications
          </div>
          <div className="rounded-xl border border-border bg-background p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Session reminders</div>
                <div className="text-xs text-muted-foreground">Get notified before a mentor session begins.</div>
              </div>
              <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-border text-foreground accent-foreground" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Weekly progress report</div>
                <div className="text-xs text-muted-foreground">Receive a summary of your learning path progress.</div>
              </div>
              <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-border text-foreground accent-foreground" />
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <Shield className="h-4 w-4" /> Account Security
          </div>
          <div className="rounded-xl border border-border bg-background p-6">
            <button className="text-sm text-foreground hover:underline">Change password...</button>
          </div>
        </section>

        <div className="flex justify-between border-t border-border pt-8">
          <button 
            className="inline-flex items-center gap-2 text-sm text-red-500 hover:text-red-600 transition cursor-pointer"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
