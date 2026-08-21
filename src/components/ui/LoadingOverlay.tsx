import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

interface LoadingOverlayProps {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  badgeText?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isOpen,
  title = "Loading...",
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Top Thin Progress Line */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed top-0 left-0 right-0 z-50 h-[3px] overflow-hidden bg-primary/20"
          >
            <motion.div
              className="h-full w-1/3 bg-gradient-to-r from-primary via-emerald-400 to-primary rounded-full"
              animate={{ x: ["-100%", "350%"] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>

          {/* Minimal Floating Indicator */}
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-5 right-5 z-50 flex items-center gap-2.5 rounded-full border border-border/80 bg-background/80 px-4 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur-md"
          >
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>{title}</span>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
