"use client";
import { useState } from "react";
import { Users, Plus, MoreVertical, Shield, UserCheck, UserX, KeyRound, Bot, Save, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrgUsers, useCreateUser, useUpdateUser, useDeactivateUser, useResetPassword } from "@/hooks/useSettings";
import { useBotConfig, useUpdateBotConfig } from "@/hooks/useSettings";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { OrgUser } from "@/types";

type Tab = "users" | "bot";

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full",
      role === "admin" ? "bg-[#2D1252]/10 text-[#2D1252]" : "bg-blue-50 text-blue-700"
    )}>
      {role === "admin" && <Shield className="w-2.5 h-2.5" />}
      {role === "admin" ? "Admin" : "Sales"}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full",
      active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", active ? "bg-emerald-500" : "bg-gray-400")} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

interface CreateModalProps {
  onClose: () => void;
}

function CreateUserModal({ onClose }: CreateModalProps) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "sales" as "admin" | "sales" });
  const create = useCreateUser();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync(form);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-base font-bold text-[#2D1252] mb-5">Create New User</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F05A28]/30 focus:border-[#F05A28]"
              placeholder="Full name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F05A28]/30 focus:border-[#F05A28]"
              placeholder="email@company.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
            <input
              required
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F05A28]/30 focus:border-[#F05A28]"
              placeholder="Min. 8 characters"
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "sales" })}
              className="w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F05A28]/30 focus:border-[#F05A28] bg-white"
            >
              <option value="sales">Sales / Pre-sales</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#F05A28] hover:bg-[#d94e22] rounded-xl transition-colors disabled:opacity-60"
            >
              {create.isPending ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ActionMenuProps {
  user: OrgUser;
  currentUserId: string;
}

function ActionMenu({ user, currentUserId }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const updateUser = useUpdateUser();
  const deactivate = useDeactivateUser();
  const resetPwd = useResetPassword();

  const isSelf = user.id === currentUserId;

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    await resetPwd.mutateAsync({ id: user.id, password: newPassword });
    setResetOpen(false);
    setNewPassword("");
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <MoreVertical className="w-4 h-4 text-gray-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-44 text-sm">
            {!isSelf && (
              <button
                onClick={() => { updateUser.mutate({ id: user.id, data: { role: user.role === "admin" ? "sales" : "admin" } }); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"
              >
                <Shield className="w-3.5 h-3.5" />
                Make {user.role === "admin" ? "Sales" : "Admin"}
              </button>
            )}
            <button
              onClick={() => { setResetOpen(true); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Reset Password
            </button>
            {!isSelf && user.is_active && (
              <button
                onClick={() => { deactivate.mutate(user.id); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-red-600"
              >
                <UserX className="w-3.5 h-3.5" />
                Deactivate
              </button>
            )}
            {!isSelf && !user.is_active && (
              <button
                onClick={() => { updateUser.mutate({ id: user.id, data: { is_active: true } }); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-emerald-50 text-emerald-700"
              >
                <UserCheck className="w-3.5 h-3.5" />
                Reactivate
              </button>
            )}
          </div>
        </>
      )}
      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-base font-bold text-[#2D1252] mb-1">Reset Password</h2>
            <p className="text-xs text-gray-500 mb-4">Setting new password for <strong>{user.name}</strong></p>
            <form onSubmit={handleReset} className="space-y-4">
              <input
                required
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                minLength={8}
                className="w-full px-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F05A28]/30 focus:border-[#F05A28]"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setResetOpen(false)} className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
                <button type="submit" disabled={resetPwd.isPending} className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#F05A28] hover:bg-[#d94e22] rounded-xl transition-colors disabled:opacity-60">
                  {resetPwd.isPending ? "Saving..." : "Reset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bot Config Tab ────────────────────────────────────────────────────────────
const CHAR_LIMIT = 2000;

function BotConfigTab() {
  const { data: config, isLoading } = useBotConfig();
  const update = useUpdateBotConfig();

  const [botName, setBotName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [saved, setSaved] = useState(false);

  // Sync fetched values into local state once loaded
  useEffect(() => {
    if (config) {
      setBotName(config.bot_name);
      setInstructions(config.instructions ?? "");
    }
  }, [config]);

  async function handleSave() {
    await update.mutateAsync({ bot_name: botName, instructions: instructions || null });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const isDirty =
    config !== undefined &&
    (botName !== config.bot_name || (instructions || null) !== (config.instructions ?? null));

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4 animate-pulse">
        <div className="h-10 bg-gray-100 rounded-xl" />
        <div className="h-48 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Info banner */}
      <div className="flex gap-3 bg-[#2D1252]/[0.04] border border-[#2D1252]/10 rounded-xl px-4 py-3.5">
        <Info className="w-4 h-4 text-[#2D1252] mt-0.5 flex-shrink-0" />
        <p className="text-xs text-gray-600 leading-relaxed">
          These instructions customize how the chatbot behaves — its tone, focus areas, or response style.
          The bot will always answer only from your knowledge base and will never fabricate information.
          Think of this like setting up a custom GPT.
        </p>
      </div>

      {/* Bot name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Bot Name</label>
        <input
          type="text"
          value={botName}
          onChange={(e) => setBotName(e.target.value)}
          maxLength={60}
          placeholder="Maya"
          className="w-full px-4 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F05A28]/30 focus:border-[#F05A28] transition-all"
        />
        <p className="text-[10px] text-gray-400 mt-1">The name the bot uses to introduce itself.</p>
      </div>

      {/* Custom instructions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Custom Instructions</label>
        <div className="relative">
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value.slice(0, CHAR_LIMIT))}
            rows={12}
            placeholder={
              "Describe how the bot should behave. Examples:\n\n" +
              "- Always respond in a formal, executive-level tone\n" +
              "- Prioritise highlighting iMocha's enterprise security certifications when relevant\n" +
              "- When asked about pricing, always recommend scheduling a call with the sales team\n" +
              "- Focus answers on the APAC market context"
            }
            className="w-full px-4 py-3.5 text-sm text-gray-900 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#F05A28]/30 focus:border-[#F05A28] transition-all resize-none placeholder:text-gray-400 leading-relaxed"
          />
          <div className={cn(
            "absolute bottom-3 right-3 text-[10px] font-medium",
            instructions.length > CHAR_LIMIT * 0.9 ? "text-amber-500" : "text-gray-400"
          )}>
            {instructions.length} / {CHAR_LIMIT}
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">
          Leave blank to use default behaviour. Changes apply to all new messages immediately.
        </p>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={!isDirty || update.isPending}
        className={cn(
          "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
          isDirty && !update.isPending
            ? "bg-[#F05A28] hover:bg-[#d94e22] text-white shadow-sm shadow-orange-200"
            : saved
            ? "bg-emerald-500 text-white"
            : "bg-gray-100 text-gray-400 cursor-not-allowed"
        )}
      >
        <Save className="w-4 h-4" />
        {update.isPending ? "Saving..." : saved ? "Saved!" : "Save Changes"}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user: currentUser } = useAuthStore();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("users");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") router.replace("/chat");
  }, [currentUser, router]);

  const { data: users, isLoading } = useOrgUsers();

  const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "users", label: "Users", icon: Users },
    { id: "bot", label: "Bot Configuration", icon: Bot },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#2D1252]/10 flex items-center justify-center">
              {tab === "users"
                ? <Users className="w-5 h-5 text-[#2D1252]" />
                : <Bot className="w-5 h-5 text-[#2D1252]" />}
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#2D1252]">Settings</h1>
              <p className="text-xs text-gray-500">
                {tab === "users" ? "Manage org members and their access roles" : "Customise chatbot behaviour"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Tab switcher */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    tab === id
                      ? "bg-white text-[#2D1252] shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
            {tab === "users" && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#F05A28] hover:bg-[#d94e22] px-4 py-2 rounded-xl transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add User
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "users" ? (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                <span>Name</span>
                <span>Email</span>
                <span>Role</span>
                <span>Status</span>
                <span />
              </div>

              {isLoading ? (
                <div className="divide-y divide-gray-100 animate-pulse">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-5 py-4 items-center">
                      <div>
                        <div className="h-3.5 bg-gray-200 rounded w-32 mb-1.5" />
                        <div className="h-2.5 bg-gray-100 rounded w-20" />
                      </div>
                      <div className="h-3 bg-gray-200 rounded w-40" />
                      <div className="h-5 bg-gray-100 rounded-full w-16" />
                      <div className="h-5 bg-gray-100 rounded-full w-14" />
                      <div className="h-6 bg-gray-100 rounded w-6" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {users?.map((u) => (
                    <div key={u.id} className={cn("grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-5 py-4 items-center", !u.is_active && "opacity-60")}>
                      <div>
                        <p className="text-sm font-semibold text-[#2D1252]">{u.name}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Joined {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <p className="text-sm text-gray-600 truncate">{u.email}</p>
                      <RoleBadge role={u.role} />
                      <StatusBadge active={u.is_active} />
                      <ActionMenu user={u} currentUserId={currentUser?.id ?? ""} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Role legend */}
            <div className="mt-4 bg-gray-50 rounded-xl px-5 py-4">
              <p className="text-xs font-semibold text-gray-600 mb-2">Role Permissions</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-500">
                <div className="flex items-start gap-2">
                  <Shield className="w-3.5 h-3.5 text-[#2D1252] mt-0.5 flex-shrink-0" />
                  <span><strong className="text-[#2D1252]">Admin</strong> — Full access: chat, KB upload/delete, analysis, RFP, analytics, user management, bot config</span>
                </div>
                <div className="flex items-start gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span><strong className="text-blue-700">Sales</strong> — Chat, KB view, analysis, RFP · Cannot upload/delete KB or view analytics</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <BotConfigTab />
        )}
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
