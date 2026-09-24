import { collection, query } from "firebase/firestore";
import { FileText, Mail, MapPin, Phone, Search, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useProfile } from "@/auth/AuthProvider";
import { Avatar, Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Select, Skeleton } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { brandLabel } from "@/lib/card";
import { db } from "@/lib/firebase";
import { formatDate, num } from "@/lib/format";
import { useCollection } from "@/lib/hooks";
import { roles } from "@/lib/meta";
import type { Role, UserProfile } from "@/lib/types";

const roleTone = { customer: "blue", donor: "violet", restaurant: "amber", needy: "green", admin: "gray" } as const;

function MemberDetail({ member, onClose }: { member: UserProfile; onClose: () => void }) {
  const me = useProfile();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const suspended = member.status === "suspended";

  async function toggle() {
    setBusy(true);
    try {
      await api.setUserStatus({ uid: member.id, status: suspended ? "active" : "suspended" });
      toast.success(suspended ? `${member.name} has been reinstated.` : `${member.name} has been suspended.`);
      setConfirm(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-3">
          <Avatar name={member.name} className="size-11 text-sm" />
          <span>
            {member.name}
            <span className="mt-0.5 flex gap-1.5">
              <Badge tone={roleTone[member.role]}>{roles[member.role].label}</Badge>
              <Badge tone={suspended ? "red" : "green"} dot>{suspended ? "Suspended" : "Active"}</Badge>
            </span>
          </span>
        </span>
      }
      footer={
        <>
          {member.role !== "admin" && (
            <Button variant="secondary" icon={FileText} onClick={() => navigate(`/app/admin/reports?member=${member.id}`)}>
              Generate report
            </Button>
          )}
          {member.id !== me.id &&
            (confirm ? (
              <Button variant={suspended ? "primary" : "danger"} loading={busy} onClick={toggle}>
                Confirm {suspended ? "reinstate" : "suspension"}
              </Button>
            ) : (
              <Button variant={suspended ? "primary" : "danger"} icon={suspended ? ShieldCheck : ShieldAlert} onClick={() => setConfirm(true)}>
                {suspended ? "Reinstate" : "Suspend"}
              </Button>
            ))}
        </>
      }
    >
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div className="flex gap-3">
          <Mail className="mt-0.5 size-4 text-stone-400" />
          <div>
            <dt className="text-stone-500">Email</dt>
            <dd className="font-medium break-all text-stone-900">{member.email}</dd>
          </div>
        </div>
        <div className="flex gap-3">
          <Phone className="mt-0.5 size-4 text-stone-400" />
          <div>
            <dt className="text-stone-500">Phone</dt>
            <dd className="font-medium text-stone-900">{member.phone || "—"}</dd>
          </div>
        </div>
        <div className="flex gap-3 sm:col-span-2">
          <MapPin className="mt-0.5 size-4 text-stone-400" />
          <div>
            <dt className="text-stone-500">Address</dt>
            <dd className="font-medium text-stone-900">{member.address}</dd>
          </div>
        </div>
        <div>
          <dt className="text-stone-500">Member since</dt>
          <dd className="font-medium text-stone-900">{formatDate(member.createdAt)}</dd>
        </div>
        {member.payment && (
          <div>
            <dt className="text-stone-500">Payment on file</dt>
            <dd className="font-medium text-stone-900">
              {brandLabel[member.payment.brand]} •••• {member.payment.last4}
            </dd>
          </div>
        )}
        {member.restaurant?.cuisine && (
          <div>
            <dt className="text-stone-500">Cuisine</dt>
            <dd className="font-medium text-stone-900">{member.restaurant.cuisine}</dd>
          </div>
        )}
      </dl>
      {confirm && !suspended && (
        <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          Suspending signs {member.name} out everywhere and blocks sign-in until reinstated. Their data is kept.
        </p>
      )}
    </Modal>
  );
}

export default function Members() {
  const { data: users, loading } = useCollection<UserProfile>(query(collection(db, "users")), "admin-users");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [status, setStatus] = useState<"" | "active" | "suspended">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter(
        (u) =>
          (!role || u.role === role) &&
          (!status || u.status === status) &&
          (!q || `${u.name} ${u.email} ${u.phone ?? ""} ${u.address}`.toLowerCase().includes(q)),
      )
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  }, [users, search, role, status]);

  const selected = users.find((u) => u.id === selectedId) ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Members"
        description={`${num(users.length)} members · ${num(users.filter((u) => u.status === "suspended").length)} suspended`}
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-stone-100 p-4 sm:p-5 lg:flex-row">
          <div className="flex-1">
            <Input placeholder="Search name, email, phone, address…" leading={<Search className="size-4" />} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <Select value={role} onChange={(e) => setRole(e.target.value as Role | "")} className="min-w-44" aria-label="Filter by type">
              <option value="">All account types</option>
              {(Object.keys(roles) as Role[]).map((r) => <option key={r} value={r}>{roles[r].label}</option>)}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="min-w-36" aria-label="Filter by status">
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/60 text-left text-xs text-stone-500">
                  <th className="px-5 py-2.5 font-medium sm:px-6">Member</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="hidden px-3 py-2.5 font-medium md:table-cell">Phone</th>
                  <th className="hidden px-3 py-2.5 font-medium lg:table-cell">Joined</th>
                  <th className="px-5 py-2.5 text-right font-medium sm:px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtered.map((u) => (
                  <tr key={u.id} onClick={() => setSelectedId(u.id)} className="cursor-pointer transition hover:bg-stone-50/80">
                    <td className="px-5 py-3 sm:px-6">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-stone-900">{u.name}</p>
                          <p className="truncate text-xs text-stone-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3"><Badge tone={roleTone[u.role]}>{roles[u.role].label}</Badge></td>
                    <td className="hidden px-3 py-3 text-stone-600 tabular md:table-cell">{u.phone || "—"}</td>
                    <td className="hidden px-3 py-3 text-stone-500 tabular lg:table-cell">{formatDate(u.createdAt)}</td>
                    <td className="px-5 py-3 text-right sm:px-6">
                      <Badge tone={u.status === "active" ? "green" : "red"} dot>{u.status === "active" ? "Active" : "Suspended"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Users} title="No members match" description="Try clearing the filters." />
        )}
      </Card>

      {selected && <MemberDetail key={selected.id} member={selected} onClose={() => setSelectedId(null)} />}
    </>
  );
}
