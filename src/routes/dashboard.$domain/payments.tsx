import { createFileRoute } from "@tanstack/react-router";
import { Download, CreditCard, Receipt } from "lucide-react";
import { mockUser } from "@/lib/mockUser";

export const Route = createFileRoute("/dashboard/$domain/payments")({
  component: PaymentsPage,
});

function PaymentsPage() {
  const { domain } = Route.useParams();
  const user = { ...mockUser, lane: domain as Domain };

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-display text-4xl">Payments</h1>
        <p className="mt-2 text-muted-foreground">Manage your billing, invoices, and saved methods.</p>
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">Payment Methods</div>
          <div className="rounded-xl border border-border bg-background p-5">
            <div className="flex items-center gap-4">
              <div className="grid h-10 w-14 place-items-center rounded bg-surface-elevated border border-border">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">•••• •••• •••• 4242</div>
                <div className="text-xs text-muted-foreground">Expires 12/28</div>
              </div>
              <button className="text-xs text-muted-foreground hover:text-foreground">Edit</button>
            </div>
            <button className="mt-4 w-full rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition">
              + Add payment method
            </button>
          </div>
        </div>

        <div>
          <div className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">Current Plan</div>
          <div className="rounded-xl border border-border bg-background p-5">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium">Free Forever Tier</div>
                <div className="mt-1 text-sm text-muted-foreground">Pay per mentor session.</div>
              </div>
              <div className="inline-flex rounded bg-surface px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">Active</div>
            </div>
            <button className="mt-6 rounded-md bg-foreground px-4 py-2 text-xs text-background hover:opacity-90 transition">
              Upgrade to Pro
            </button>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">Payment History</div>
        {user.paymentHistory.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
            <Receipt className="mx-auto mb-4 h-8 w-8 text-border-strong" />
            <p>No past transactions found.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-background">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-elevated text-xs text-muted-foreground">
                <tr>
                  <th className="p-4 font-normal">Date</th>
                  <th className="p-4 font-normal">Description</th>
                  <th className="p-4 font-normal">Amount</th>
                  <th className="p-4 font-normal text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {user.paymentHistory.map((p, idx) => (
                  <tr key={idx} className="hover:bg-surface-elevated transition-colors">
                    <td className="p-4">{p.date}</td>
                    <td className="p-4 font-medium">{p.type}</td>
                    <td className="p-4 font-mono">${p.amount.toFixed(2)}</td>
                    <td className="p-4 text-right">
                      <button className="text-muted-foreground hover:text-foreground">
                        <Download className="h-4 w-4 inline-block" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
