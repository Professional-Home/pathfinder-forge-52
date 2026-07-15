import { createFileRoute } from "@tanstack/react-router";
import { Award, Download } from "lucide-react";
import { mockUser, type Lane } from "@/lib/mockUser";

export const Route = createFileRoute("/dashboard/certificates")({
  component: CertificatesPage,
});

function CertificatesPage() {
  const user = { ...mockUser, lane: "student" as Lane };

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-display text-4xl">Certificates</h1>
        <p className="mt-2 text-muted-foreground">Verifiable credentials for your completed tracks.</p>
      </div>

      <section>
        <div className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">Earned</div>
        {user.certificates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
            <Award className="mx-auto mb-4 h-8 w-8 text-border-strong" />
            <p>You haven't earned any certificates yet.</p>
            <p className="mt-1 text-sm">Complete your first course to unlock.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {user.certificates.map(cert => (
              <div key={cert.certId} className="flex items-center justify-between rounded-xl border border-border bg-background p-5">
                <div className="flex items-center gap-4">
                  <div className={`grid h-12 w-12 place-items-center rounded-lg bg-${user.lane}/10`}>
                    <Award className={`h-6 w-6 text-${user.lane}`} />
                  </div>
                  <div>
                    <div className="font-medium">Product Design Fundamentals</div>
                    <div className="text-xs text-muted-foreground">Issued: {cert.issuedDate}</div>
                  </div>
                </div>
                <button className="rounded-md border border-border p-2 text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition">
                  <Download className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {user.enrolledCourses.length > 0 && (
        <section>
          <div className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">In Progress</div>
          <div className="grid gap-4 md:grid-cols-2">
            {user.enrolledCourses.map(e => (
              <div key={e.courseId} className="rounded-xl border border-border bg-surface-elevated p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-muted-foreground">Product Design Fundamentals</div>
                    <div className="mt-1 text-sm font-display text-foreground">{100 - e.progress}% away from certificate</div>
                  </div>
                  <Award className="h-5 w-5 text-muted-foreground/30" />
                </div>
                <div className="mt-4 h-1.5 w-full rounded-full bg-border">
                  <div className={`h-full rounded-full bg-${user.lane}/50`} style={{ width: `${e.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
