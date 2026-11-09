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
  AlertTriangle,
  ShieldAlert,
  Eye,
  EyeOff,
  Award,
  FileCheck,
  ExternalLink,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard, AdminDataTable, AdminToolbar } from "@/components/admin/admin-shared";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { PrintQrModal } from "@/components/spin-wheel/PrintQrModal";
import type { SpinWheelEntry } from "@/lib/spin-wheel/types";
import {
  fetchAdminSpinEntries,
  redeemSpinRewardAdmin,
  verifyFormManualAdmin,
} from "@/lib/spin-wheel-server";
import { supabase } from "@/utils/supabase";

export const Route = createFileRoute("/admin/spin-wheel")({
  component: AdminSpinWheelPage,
});

function AdminSpinWheelPage() {
  const [entries, setEntries] = useState<SpinWheelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formFilter, setFormFilter] = useState<string>("all");
  const [unmaskPii, setUnmaskPii] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Load entries
  const loadData = async (shouldUnmask = unmaskPii) => {
    setLoading(true);
    setAuthError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || undefined;

      const res = await fetchAdminSpinEntries({
        data: { authToken: token, unmask: shouldUnmask },
      });

      if (!res.success && res.code === "UNAUTHORIZED") {
        setAuthError(
          res.error || "Admin authentication required. Please sign in as an administrator."
        );
        setEntries([]);
      } else {
        setEntries(res.entries || []);
      }
    } catch (e: any) {
      console.error("Failed to load spin wheel entries:", e);
      setAuthError(e.message || "Failed to load spin wheel entries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(unmaskPii);
  }, [unmaskPii]);

  const toggleUnmask = () => {
    setUnmaskPii((prev) => !prev);
  };

  // Actions
  const handleRedeem = async (entry: SpinWheelEntry) => {
    const notes = window.prompt(
      `Confirm redemption fulfillment for "${entry.name}" (${entry.voucherCode}).\nOptional fulfillment notes:`,
      ""
    );
    if (notes === null) return;

    setActionLoadingId(entry.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await redeemSpinRewardAdmin({
        data: { authToken: token, entryId: entry.id, notes: notes || undefined },
      });
      if (res.success) {
        await loadData();
      } else {
        alert(res.message || "Failed to mark as redeemed.");
      }
    } catch (e: any) {
      alert(e.message || "Redemption request failed.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleManualVerify = async (entry: SpinWheelEntry) => {
    if (
      !window.confirm(
        `Manually mark Google Form as VERIFIED for "${entry.name}" (${entry.voucherCode})?`
      )
    ) {
      return;
    }

    setActionLoadingId(entry.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await verifyFormManualAdmin({
        data: {
          authToken: token,
          entryId: entry.id,
          notes: "Manually verified in admin dashboard",
        },
      });
      if (res.success) {
        await loadData();
      } else {
        alert(res.message || "Failed to verify form.");
      }
    } catch (e: any) {
      alert(e.message || "Verification request failed.");
    } finally {
      setActionLoadingId(null);
    }
  };

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

      const rStatus = item.rewardStatus || (item.status === "claimed" ? "REDEEMED" : item.status === "rejected" ? "REJECTED" : "PENDING");
      const fStatus = item.formStatus || (item.status === "claimed" ? "FORM_VERIFIED" : "NOT_APPLICABLE");

      const matchesRewardStatus =
        statusFilter === "all" ||
        rStatus.toLowerCase() === statusFilter.toLowerCase() ||
        item.status === statusFilter;

      const matchesFormStatus =
        formFilter === "all" ||
        fStatus.toLowerCase() === formFilter.toLowerCase();

      return matchesSearch && matchesRewardStatus && matchesFormStatus;
    });
  }, [entries, search, statusFilter, formFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = entries.length;
    const redeemed = entries.filter((e) => (e.rewardStatus === "REDEEMED" || e.status === "claimed")).length;
    const formVerified = entries.filter((e) => e.formStatus === "FORM_VERIFIED").length;
    const formPending = entries.filter((e) => e.formStatus === "FORM_PENDING" || e.formStatus === "FORM_SUBMITTED").length;
    const rejected = entries.filter((e) => e.rewardStatus === "REJECTED" || e.status === "rejected").length;
    const pending = total - redeemed - rejected;
    return { total, redeemed, formVerified, formPending, pending, rejected };
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
      "Reward Status",
      "Form Status",
      "Form URL",
      "Form Opened At",
      "Form Submitted At",
      "Form Verified At",
      "Redeemed At",
      "Redeemed By Admin",
      "Redemption Notes",
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
      `"${e.rewardStatus || e.status || "PENDING"}"`,
      `"${e.formStatus || "NOT_APPLICABLE"}"`,
      `"${e.formUrl || ""}"`,
      `"${e.formOpenedAt || ""}"`,
      `"${e.formSubmittedAt || ""}"`,
      `"${e.formVerifiedAt || ""}"`,
      `"${e.redeemedAt || ""}"`,
      `"${e.redeemedByAdmin || ""}"`,
      `"${(e.redemptionNotes || e.claimNotes || "").replace(/"/g, '""')}"`,
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
        title="Spin & Win Participants & Google Forms"
        description="Monitor promotional wheel spins, Google Form submissions, webhooks, and reward redemptions."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={toggleUnmask}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition"
              title={unmaskPii ? "Mask PII" : "Unmask PII (Audit Logged)"}
            >
              {unmaskPii ? (
                <>
                  <EyeOff className="h-4 w-4 text-amber-500" />
                  Mask PII
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 text-cyan-500" />
                  Reveal PII
                </>
              )}
            </button>
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

      {/* Security Auth Warning Banner */}
      {authError && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
          <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 text-destructive" />
          <div className="space-y-1">
            <div className="font-bold text-sm text-destructive">Admin Authorization Required</div>
            <p className="text-destructive/90">{authError}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Participant PII, won rewards, and claims are protected. Please sign in via the Admin Login portal.
            </p>
          </div>
        </div>
      )}

      {/* Analytics KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Total Spins
          </div>
          <div className="text-2xl font-black text-foreground mt-1">{stats.total}</div>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="text-xs text-emerald-400 uppercase tracking-wider font-medium">
            Redeemed
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{stats.redeemed}</div>
        </div>
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
          <div className="text-xs text-cyan-400 uppercase tracking-wider font-medium">
            Form Verified
          </div>
          <div className="text-2xl font-black text-cyan-400 mt-1">{stats.formVerified}</div>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="text-xs text-amber-400 uppercase tracking-wider font-medium">
            Form Pending
          </div>
          <div className="text-2xl font-black text-amber-400 mt-1">{stats.formPending}</div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-card p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Rejected
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

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {/* Reward Status Filter */}
          <div className="flex rounded-lg border border-border p-0.5 bg-background text-xs">
            {["all", "PENDING", "ACCEPTED", "REDEEMED", "REJECTED"].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  statusFilter === tab
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "all" ? "All Rewards" : tab}
              </button>
            ))}
          </div>

          {/* Form Status Filter */}
          <div className="flex rounded-lg border border-border p-0.5 bg-background text-xs">
            {["all", "FORM_PENDING", "FORM_VERIFIED"].map((fTab) => (
              <button
                key={fTab}
                onClick={() => setFormFilter(fTab)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition ${
                  formFilter === fTab
                    ? "bg-cyan-600 text-white font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {fTab === "all" ? "All Forms" : fTab === "FORM_PENDING" ? "Pending Form" : "Verified Form"}
              </button>
            ))}
          </div>

          <button
            onClick={() => loadData(unmaskPii)}
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
                <th className="px-4 py-3">Reward Won</th>
                <th className="px-4 py-3">Voucher</th>
                <th className="px-4 py-3">Reward State</th>
                <th className="px-4 py-3">Google Form State</th>
                <th className="px-4 py-3">Timestamps</th>
                <th className="px-4 py-3 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading participant records...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">
                    No spin entries found matching your criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const rStatus = item.rewardStatus || (item.status === "claimed" ? "REDEEMED" : item.status === "rejected" ? "REJECTED" : "PENDING");
                  const fStatus = item.formStatus || (item.status === "claimed" ? "FORM_VERIFIED" : "NOT_APPLICABLE");
                  const isLoading = actionLoadingId === item.id;

                  return (
                    <tr key={item.id} className="hover:bg-muted/20 transition">
                      {/* Participant */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">{item.name}</div>
                        <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mt-0.5">
                          <Mail className="h-3 w-3" />
                          <span>{item.email}</span>
                        </div>
                        {item.phone && (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                            <Phone className="h-3 w-3" />
                            <span>{item.phone}</span>
                          </div>
                        )}
                        {item.college && (
                          <div className="text-[10px] text-muted-foreground/80 truncate max-w-[170px] mt-0.5">
                            {item.college}
                          </div>
                        )}
                      </td>

                      {/* Reward Won */}
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{item.rewardTitle}</span>
                        <div className="text-[10px] text-cyan-400 font-mono mt-0.5">
                          Probability: {item.probabilityPct}%
                        </div>
                      </td>

                      {/* Voucher Code */}
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

                      {/* Reward Lifecycle Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            rStatus === "REDEEMED"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : rStatus === "ACCEPTED"
                              ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                              : rStatus === "REJECTED"
                              ? "bg-slate-700/20 text-muted-foreground border border-slate-700"
                              : rStatus === "EXPIRED"
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}
                        >
                          {rStatus}
                        </span>
                        {item.redeemedAt && (
                          <div className="text-[10px] text-muted-foreground mt-1">
                            Redeemed: {new Date(item.redeemedAt).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Google Form Status */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              fStatus === "FORM_VERIFIED"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : fStatus === "FORM_SUBMITTED"
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                : fStatus === "FORM_PENDING"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-muted text-muted-foreground border border-border"
                            }`}
                          >
                            {fStatus}
                          </span>
                          {item.formUrl && (
                            <div>
                              <a
                                href={item.formUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                              >
                                <span>Form Link</span>
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            </div>
                          )}
                          {item.formVerifiedAt && (
                            <div className="text-[10px] text-muted-foreground">
                              Verified: {new Date(item.formVerifiedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Timestamps */}
                      <td className="px-4 py-3 text-muted-foreground font-mono text-[11px]">
                        <div>Spun: {new Date(item.createdAt).toLocaleDateString()}</div>
                        <div className="text-[10px]">
                          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Admin Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Manual Verify Form button */}
                          {fStatus !== "FORM_VERIFIED" && rStatus !== "REJECTED" && (
                            <button
                              onClick={() => handleManualVerify(item)}
                              disabled={isLoading}
                              className="inline-flex items-center gap-1 rounded bg-muted hover:bg-muted/80 px-2 py-1 text-[10px] font-medium text-foreground border border-border transition disabled:opacity-50"
                              title="Manually mark form submission as verified"
                            >
                              <FileCheck className="h-3 w-3 text-cyan-400" />
                              Verify Form
                            </button>
                          )}

                          {/* Redeem button (active only when form verified and not yet redeemed) */}
                          {rStatus !== "REDEEMED" && rStatus !== "REJECTED" ? (
                            <button
                              onClick={() => handleRedeem(item)}
                              disabled={isLoading || fStatus !== "FORM_VERIFIED"}
                              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[10px] font-bold transition disabled:opacity-40 disabled:cursor-not-allowed ${
                                fStatus === "FORM_VERIFIED"
                                  ? "bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs"
                                  : "bg-muted text-muted-foreground border border-border"
                              }`}
                              title={
                                fStatus === "FORM_VERIFIED"
                                  ? "Fulfill & Mark Redeemed"
                                  : "Requires Form Verification before redemption"
                              }
                            >
                              <Award className="h-3 w-3" />
                              Redeem
                            </button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic px-2">
                              {rStatus === "REDEEMED" ? "Fitted / Done" : "Dismissed"}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
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

