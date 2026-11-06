import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  Sparkles,
  Download,
  QrCode,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Filter,
  RefreshCw,
  Phone,
  Mail,
  Copy,
  Check,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard, AdminDataTable, AdminToolbar } from "@/components/admin/admin-shared";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { PrintQrModal } from "@/components/spin-wheel/PrintQrModal";
import type { SpinWheelEntry } from "@/lib/spin-wheel/types";
import { fetchAdminSpinEntries } from "@/lib/spin-wheel-server";

export const Route = createFileRoute("/admin/spin-wheel")({
  component: AdminSpinWheelPage,
});

function AdminSpinWheelPage() {
  const [entries, setEntries] = useState<SpinWheelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load entries
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchAdminSpinEntries();
      setEntries(res.entries || []);
    } catch (e) {
      console.error("Failed to load spin wheel entries:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered entries
  const filtered = useMemo(() => {
    return entries.filter((item) => {
      const matchesSearch =
        search === "" ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.email.toLowerCase().includes(search.toLowerCase()) ||
        (item.phone && item.phone.includes(search)) ||
        item.voucherCode.toLowerCase().includes(search.toLowerCase()) ||
        item.rewardTitle.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [entries, search, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = entries.length;
    const claimed = entries.filter((e) => e.isClaimed || e.status === "claimed").length;
    const rejected = entries.filter((e) => e.status === "rejected").length;
    const won = total - claimed - rejected;
    return { total, claimed, won, rejected };
  }, [entries]);

  // CSV Export
  const handleExportCsv = () => {
    if (entries.length === 0) return;

    const headers = [
      "ID",
      "Name",
      "Email",
      "Phone",
      "College",
      "Reward Title",
      "Voucher Code",
      "Probability %",
      "Status",
      "Claimed",
      "Claim Notes",
      "Created At",
    ];

    const rows = entries.map((e) => [
      `"${e.id}"`,
      `"${e.name || ""}"`,
      `"${e.email || ""}"`,
      `"${e.phone || ""}"`,
      `"${e.college || ""}"`,
      `"${e.rewardTitle || ""}"`,
      `"${e.voucherCode || ""}"`,
      `"${e.probabilityPct || ""}"`,
      `"${e.status || ""}"`,
      `"${e.isClaimed ? "YES" : "NO"}"`,
      `"${(e.claimNotes || "").replace(/"/g, '""')}"`,
      `"${e.createdAt || ""}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `micrylis-spin-leads-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyVoucher = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <AdminPageHeader
        title="Spin & Win Participants"
        description="Monitor promotional wheel spins, participant details, won rewards, and claims."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQrModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition"
            >
              <QrCode className="h-4 w-4 text-cyan-500" />
              Print QR Code
            </button>
            <button
              onClick={handleExportCsv}
              disabled={entries.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export CSV ({entries.length})
            </button>
          </div>
        }
      />

      {/* Analytics KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Total Spins
          </div>
          <div className="text-2xl font-black text-foreground mt-1">{stats.total}</div>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="text-xs text-emerald-400 uppercase tracking-wider font-medium">
            Claimed Rewards
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{stats.claimed}</div>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="text-xs text-amber-400 uppercase tracking-wider font-medium">
            Pending / Unclaimed
          </div>
          <div className="text-2xl font-black text-amber-400 mt-1">{stats.won}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Declined / Rejected
          </div>
          <div className="text-2xl font-black text-muted-foreground mt-1">{stats.rejected}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, email, phone, voucher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-1.5 pl-9 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex rounded-lg border border-border p-0.5 bg-background text-xs">
            {["all", "won", "claimed", "rejected"].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1 rounded-md capitalize transition ${
                  statusFilter === tab
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <button
            onClick={loadData}
            title="Refresh"
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Participant</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Reward Won</th>
                <th className="px-4 py-3">Voucher Code</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading participant records...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    No spin entries found matching your criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20 transition">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{item.name}</div>
                      {item.college && (
                        <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                          {item.college}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-foreground">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span>{item.email}</span>
                      </div>
                      {item.phone && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span>{item.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{item.rewardTitle}</span>
                      <span className="ml-1.5 text-[10px] text-cyan-400 font-mono">
                        ({item.probabilityPct}%)
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-1.5 rounded bg-muted px-2 py-0.5 font-mono font-bold text-foreground">
                        <span>{item.voucherCode}</span>
                        <button
                          onClick={() => copyVoucher(item.voucherCode)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {copiedId === item.voucherCode ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          item.status === "claimed"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : item.status === "rejected"
                            ? "bg-slate-700/20 text-muted-foreground border border-slate-700"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-[11px]">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print QR Code Modal */}
      <PrintQrModal open={qrModalOpen} onOpenChange={setQrModalOpen} />
    </div>
  );
}

