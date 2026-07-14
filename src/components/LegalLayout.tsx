import { Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/brand";
import { SiteFooter } from "@/components/site-footer";
import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export function LegalLayout({ children, title, lastUpdated }: { children: ReactNode, title: string, lastUpdated: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur-xl transition-all duration-300">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:h-[4.25rem] sm:px-6">
          <Wordmark />
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to home</span>
            <span className="sm:hidden">Home</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-10 border-b border-border/60 pb-8 sm:mb-12">
            <h1 className="font-display text-3xl text-foreground sm:text-4xl md:text-5xl">{title}</h1>
            <p className="mt-4 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
          </div>
          <div className="space-y-8 text-sm leading-relaxed text-muted-foreground md:text-base">
            {children}
          </div>
        </motion.div>
      </main>
      <SiteFooter />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string, children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
      <div className="space-y-4">
        {children}
      </div>
    </section>
  );
}
