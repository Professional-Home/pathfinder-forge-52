import React, { useEffect, useRef } from "react";
import { SPIN_REWARDS, SLICES_COUNT, SLICE_ANGLE } from "@/lib/spin-wheel/config";

interface SpinWheelCanvasProps {
  isSpinning: boolean;
  winningIndex: number | null;
  onSpinComplete?: () => void;
  size?: number;
}

export function SpinWheelCanvas({
  isSpinning,
  winningIndex,
  onSpinComplete,
  size = 380,
}: SpinWheelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const isAnimatingRef = useRef<boolean>(false);

  // Draw static or current frame of the wheel
  const drawWheel = (angle: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const center = (size * dpr) / 2;
    const radius = center - 16 * dpr;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate((angle * Math.PI) / 180);

    // Draw Outer Rim Glow
    ctx.beginPath();
    ctx.arc(0, 0, radius + 8 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = "#0f172a";
    ctx.fill();
    ctx.lineWidth = 4 * dpr;
    ctx.strokeStyle = "#06b6d4";
    ctx.stroke();

    // Draw Slices
    for (let i = 0; i < SLICES_COUNT; i++) {
      const sliceStart = (i * SLICE_ANGLE * Math.PI) / 180;
      const sliceEnd = ((i + 1) * SLICE_ANGLE * Math.PI) / 180;
      const reward = SPIN_REWARDS[i];

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, sliceStart, sliceEnd);
      ctx.closePath();

      // Slice background
      ctx.fillStyle = reward.color;
      ctx.fill();
      ctx.lineWidth = 2 * dpr;
      ctx.strokeStyle = "#0f172a";
      ctx.stroke();

      // Text label inside slice
      ctx.save();
      const textAngle = sliceStart + (SLICE_ANGLE * Math.PI) / 360;
      ctx.rotate(textAngle);

      // Label text
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.round(13 * dpr)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
      ctx.shadowBlur = 4 * dpr;
      ctx.fillText(reward.shortLabel, radius - 26 * dpr, 4 * dpr);

      // Probability percentage badge
      ctx.font = `600 ${Math.round(9 * dpr)}px monospace`;
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.fillText(`(${reward.probability}%)`, radius - 26 * dpr, 17 * dpr);

      ctx.restore();
    }

    // Outer edge decorative dots
    for (let i = 0; i < 24; i++) {
      const dotAngle = (i * 15 * Math.PI) / 180;
      const dotX = Math.cos(dotAngle) * (radius + 4 * dpr);
      const dotY = Math.sin(dotAngle) * (radius + 4 * dpr);
      ctx.beginPath();
      ctx.arc(dotX, dotY, 2.5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? "#38bdf8" : "#f8fafc";
      ctx.fill();
    }

    ctx.restore(); // restore wheel rotation

    // Center Hub (Fixed on top, doesn't rotate text)
    ctx.save();
    ctx.translate(center, center);

    // Center Outer Ring
    ctx.beginPath();
    ctx.arc(0, 0, 36 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = "#090d16";
    ctx.fill();
    ctx.lineWidth = 3 * dpr;
    ctx.strokeStyle = "#38bdf8";
    ctx.stroke();

    // Center Inner Core
    ctx.beginPath();
    ctx.arc(0, 0, 26 * dpr, 0, Math.PI * 2);
    const hubGrad = ctx.createRadialGradient(0, 0, 2 * dpr, 0, 0, 26 * dpr);
    hubGrad.addColorStop(0, "#0284c7");
    hubGrad.addColorStop(1, "#0369a1");
    ctx.fillStyle = hubGrad;
    ctx.fill();

    // Center Icon / Text
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(11 * dpr)}px -apple-system, sans-serif`;
    ctx.fillText("MICRYLIS", 0, -2 * dpr);
    ctx.font = `bold ${Math.round(8 * dpr)}px monospace`;
    ctx.fillStyle = "#bae6fd";
    ctx.fillText("★ WIN ★", 0, 10 * dpr);

    ctx.restore();

    // Needle Pointer on Top (Points down to the 12 o'clock position)
    ctx.save();
    ctx.translate(center, 12 * dpr);

    ctx.beginPath();
    ctx.moveTo(-12 * dpr, -4 * dpr);
    ctx.lineTo(12 * dpr, -4 * dpr);
    ctx.lineTo(0, 24 * dpr);
    ctx.closePath();

    ctx.fillStyle = "#f43f5e"; // Rose-500 needle
    ctx.fill();
    ctx.lineWidth = 2 * dpr;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    // Needle shadow
    ctx.beginPath();
    ctx.arc(0, -2 * dpr, 5 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.restore();
  };

  // Initial render & resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    drawWheel(rotationRef.current);
  }, [size]);

  // Handle Spin Animation Trigger
  useEffect(() => {
    if (!isSpinning || winningIndex === null || isAnimatingRef.current) return;

    isAnimatingRef.current = true;

    // Pointer is located at TOP (270 degrees in standard circle coordinates)
    // When wheel rotates by angle R, the slice at top is:
    // angleToTop = (270 - R) % 360
    // We want slice `winningIndex` center (which is winningIndex * 60 + 30) to align with top (270°).
    // So 270 - R = winningIndex * 60 + 30  =>  R = 270 - (winningIndex * 60 + 30) = 240 - winningIndex * 60.
    const sliceTargetAngle = (240 - winningIndex * SLICE_ANGLE + 360) % 360;

    // Add 6 to 8 full revolutions for dramatic suspense
    const extraRounds = 360 * 7;
    const currentAngle = rotationRef.current % 360;
    const totalRotationDelta = extraRounds + ((sliceTargetAngle - currentAngle + 360) % 360);
    const startAngle = rotationRef.current;
    const finalAngle = startAngle + totalRotationDelta;

    const duration = 4800; // 4.8 seconds
    const startTime = performance.now();

    // Smooth cubic bezier ease-out
    const easeOutCubic = (t: number): number => {
      return 1 - Math.pow(1 - t, 3.2);
    };

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(1, elapsed / duration);
      const easedProgress = easeOutCubic(progress);

      const currentRotation = startAngle + totalRotationDelta * easedProgress;
      rotationRef.current = currentRotation;
      drawWheel(currentRotation);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        rotationRef.current = finalAngle;
        drawWheel(finalAngle);
        isAnimatingRef.current = false;
        if (onSpinComplete) {
          onSpinComplete();
        }
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isSpinning, winningIndex, onSpinComplete]);

  return (
    <div className="relative flex items-center justify-center p-2 select-none">
      <canvas
        ref={canvasRef}
        className="drop-shadow-[0_0_35px_rgba(6,182,212,0.25)] transition-transform duration-300"
      />
    </div>
  );
}

