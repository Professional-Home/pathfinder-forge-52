import { Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/brand";
import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export function LegalLayout({ children, title, lastUpdated }: { children: ReactNode, title: string, lastUpdated: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-40 w-full transition-all duration-300">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6 w-full">
          <Wordmark />
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16 md:py-24 flex-1 w-full">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-12 border-b border-border/60 pb-8">
            <h1 className="font-display text-4xl md:text-5xl text-foreground">{title}</h1>
            <p className="mt-4 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
          </div>
          <div className="space-y-8 text-muted-foreground leading-relaxed text-sm md:text-base">
            {children}
          </div>
        </motion.div>
      </main>
      <footer className="border-t border-border/60 mt-auto">
        <div className="mx-auto max-w-4xl px-6 py-8 flex flex-col md:flex-row justify-between items-center gap-6 text-xs text-muted-foreground w-full">
           <div>© {new Date().getFullYear()} MentorForge. All rights reserved.</div>
           <div className="flex flex-wrap justify-center gap-4">
             <Link to="/return-policy" className="hover:text-foreground transition-colors">Return Policy</Link>
             <Link to="/refund-policy" className="hover:text-foreground transition-colors">Refund Policy</Link>
             <Link to="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
             <Link to="/disclaimer" className="hover:text-foreground transition-colors">Disclaimer</Link>
             <Link to="/about" className="hover:text-foreground transition-colors">About & Contact</Link>
           </div>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string, children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-foreground font-display">{title}</h2>
      <div className="space-y-4">
        {children}
      </div>
    </section>
  );
}
