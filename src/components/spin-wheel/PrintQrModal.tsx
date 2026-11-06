import React, { useState, useEffect, useRef } from "react";
import { Download, QrCode, X, Check, Copy, Printer, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PrintQrModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrintQrModal({ open, onOpenChange }: PrintQrModalProps) {
  const [spinUrl, setSpinUrl] = useState("https://micrylis.com/spin");
  const [copied, setCopied] = useState(false);
  const [qrPngUrl, setQrPngUrl] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      const targetUrl = origin.includes("localhost")
        ? "https://micrylis.com/spin" // Production fallback for print materials
        : `${origin}/spin`;
      setSpinUrl(targetUrl);

      // Generate High-DPI QR Code (1000x1000px, 300 DPI print quality)
      const encoded = encodeURIComponent(targetUrl);
      setQrPngUrl(
        `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encoded}&margin=20&format=png`
      );
    }
  }, [open]);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(spinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPng = async () => {
    try {
      const response = await fetch(qrPngUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `micrylis-spin-wheel-qr-300dpi.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      window.open(qrPngUrl, "_blank");
    }
  };

  const downloadSvg = () => {
    const encoded = encodeURIComponent(spinUrl);
    const svgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encoded}&margin=20&format=svg`;
    window.open(svgUrl, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#0b0f19] text-white border-cyan-500/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
            <QrCode className="h-5 w-5 text-cyan-400" />
            Print & Digital QR Code Generator
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 text-center">
          <p className="text-xs text-slate-400 mb-4">
            Suitable for both digital marketing (Instagram, WhatsApp) and physical print (posters, standees, brochures).
          </p>

          {/* QR Code Container */}
          <div className="mx-auto flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-xl w-64 h-64 border-4 border-cyan-500/30">
            {qrPngUrl ? (
              <img
                src={qrPngUrl}
                alt="Micrylis Spin Wheel QR Code"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-slate-400 text-xs">Generating QR...</div>
            )}
          </div>

          {/* Target URL */}
          <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-900 border border-slate-800 p-2 text-left">
            <span className="font-mono text-xs text-cyan-300 truncate mr-2">
              {spinUrl}
            </span>
            <button
              onClick={handleCopyUrl}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 shrink-0"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          {/* Download Buttons */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              onClick={downloadPng}
              className="flex items-center justify-center gap-2 rounded-lg bg-cyan-500 py-2.5 px-3 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition"
            >
              <Download className="h-4 w-4" />
              Download PNG (300 DPI)
            </button>

            <button
              onClick={downloadSvg}
              className="flex items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-slate-900 py-2.5 px-3 text-xs font-bold text-cyan-300 hover:bg-slate-800 transition"
            >
              <ExternalLink className="h-4 w-4" />
              Download SVG (Vector)
            </button>
          </div>

          <p className="mt-3 text-[11px] text-slate-400">
            Vector SVG is recommended for large flex banners and hoardings as it never pixelates.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

