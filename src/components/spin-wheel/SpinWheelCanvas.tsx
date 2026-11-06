import React, { useEffect, useRef, useState } from "react";
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
  size = 360,
}: SpinWheelCanvasProps) {
  const [rotation, setRotation] = useState<number>(0);
  const [isPointerTicking, setIsPointerTicking] = useState<boolean>(false);
  const isAnimatingRef = useRef<boolean>(false);
  const rotationRef = useRef<number>(0);

  const center = size / 2;
  const radius = center - 18;

  // Convert polar coordinates (degrees, distance) to cartesian (x, y)
  const polarToCartesian = (centerX: number, centerY: number, rad: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + rad * Math.cos(angleInRadians),
      y: centerY + rad * Math.sin(angleInRadians),
    };
  };

  // Generate SVG path for a 60-degree slice
  const describeArc = (x: number, y: number, rad: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, rad, endAngle);
    const end = polarToCartesian(x, y, rad, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${x} ${y} L ${start.x} ${start.y} A ${rad} ${rad} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
  };

  // Ultra-smooth GPU-accelerated spin animation
  useEffect(() => {
    if (!isSpinning || winningIndex === null || isAnimatingRef.current) return;

    isAnimatingRef.current = true;

    // Pointer is at TOP (0 degrees in our polar SVG coordinate system)
    // Slice i is centered at (i * 60 + 30) degrees
    // When wheel rotates clockwise by angle R, the slice at top is: (360 - (R % 360))
    // We want: (360 - (R % 360)) = winningIndex * 60 + 30
    // => R % 360 = 360 - (winningIndex * 60 + 30)
    const targetSliceCenter = winningIndex * SLICE_ANGLE + SLICE_ANGLE / 2;
    const targetMod360 = (360 - targetSliceCenter + 360) % 360;

    // Add 7 to 9 full smooth revolutions for high excitement
    const fullTurns = 360 * 8;
    const currentRot = rotationRef.current;
    const currentMod360 = currentRot % 360;
    const additionalRotation = (targetMod360 - currentMod360 + 360) % 360;
    const totalDelta = fullTurns + additionalRotation;
    const targetRotation = currentRot + totalDelta;

    const duration = 5200; // 5.2 seconds for realistic momentum & suspense
    const startTime = performance.now();

    // Natural physics easing: quick initial acceleration, prolonged smooth cubic deceleration
    const naturalEaseOut = (t: number) => {
      return 1 - Math.pow(1 - t, 3.8);
    };

    let lastTickAngle = currentRot;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = naturalEaseOut(progress);

      const currentAngle = currentRot + totalDelta * eased;
      setRotation(currentAngle);
      rotationRef.current = currentAngle;

      // Pointer ticking motion when divider lines pass
      if (Math.abs(currentAngle - lastTickAngle) >= SLICE_ANGLE) {
        setIsPointerTicking(true);
        setTimeout(() => setIsPointerTicking(false), 50);
        lastTickAngle = currentAngle;
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setRotation(targetRotation);
        rotationRef.current = targetRotation;
        isAnimatingRef.current = false;
        if (onSpinComplete) {
          onSpinComplete();
        }
      }
    };

    requestAnimationFrame(animate);
  }, [isSpinning, winningIndex, onSpinComplete]);

  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{ width: size, height: size }}
    >
      {/* Outer Subtle Theme Ring / Glow */}
      <div
        className="absolute inset-0 rounded-full border border-border/80 bg-surface shadow-[0_12px_40px_-8px_rgba(0,0,0,0.12)]"
        style={{
          boxShadow: isSpinning
            ? "0 0 45px -5px rgba(37,99,235,0.25), 0 10px 30px -5px rgba(0,0,0,0.1)"
            : "0 10px 30px -5px rgba(0,0,0,0.08)",
        }}
      />

      {/* SVG Rotating Wheel Core */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="relative z-10"
        style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: "center center",
          willChange: "transform",
        }}
      >
        <defs>
          {/* Outer Border Gradient */}
          <linearGradient id="wheelRimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="50%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          {/* Slices Drop Shadows */}
          <filter id="sliceShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Outer Rim Circle */}
        <circle
          cx={center}
          cy={center}
          r={radius + 8}
          fill="#1e293b"
          stroke="#334155"
          strokeWidth="3"
        />

        {/* 6 Wheel Slices */}
        {SPIN_REWARDS.map((reward, i) => {
          const startAngle = i * SLICE_ANGLE;
          const endAngle = (i + 1) * SLICE_ANGLE;
          const midAngle = startAngle + SLICE_ANGLE / 2;
          const pathData = describeArc(center, center, radius, startAngle, endAngle);

          return (
            <g key={reward.id}>
              {/* Slice Sector */}
              <path
                d={pathData}
                fill={reward.color}
                stroke="#0f172a"
                strokeWidth="2"
              />

              {/* Text & Probability Label */}
              <g
                transform={`rotate(${midAngle}, ${center}, ${center}) translate(${center}, ${
                  center - radius + 32
                })`}
              >
                {/* Short Label */}
                <text
                  x="0"
                  y="0"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="12.5"
                  fontWeight="800"
                  fontFamily="'Geist Sans', -apple-system, sans-serif"
                  style={{
                    textShadow: "0 2px 4px rgba(0,0,0,0.6)",
                    letterSpacing: "0.5px",
                  }}
                >
                  {reward.shortLabel}
                </text>

                {/* Probability Tag */}
                <text
                  x="0"
                  y="15"
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.85)"
                  fontSize="9.5"
                  fontWeight="600"
                  fontFamily="'Geist Mono', monospace"
                  style={{ textShadow: "0 1px 2px rgba(0,0,0,0.7)" }}
                >
                  {reward.probability}%
                </text>
              </g>
            </g>
          );
        })}

        {/* Rim Decorative Studs / Lights */}
        {Array.from({ length: 24 }).map((_, idx) => {
          const studAngle = idx * 15;
          const studPos = polarToCartesian(center, center, radius + 4, studAngle);
          return (
            <circle
              key={idx}
              cx={studPos.x}
              cy={studPos.y}
              r={2.5}
              fill={idx % 2 === 0 ? "#f8fafc" : "#38bdf8"}
            />
          );
        })}
      </svg>

      {/* Center Fixed Hub / Logo Badge (Does NOT rotate with wheel) */}
      <div
        className="absolute z-20 flex flex-col items-center justify-center rounded-full border-4 border-slate-900 bg-gradient-to-b from-slate-800 to-slate-950 text-white shadow-xl"
        style={{ width: size * 0.22, height: size * 0.22 }}
      >
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-slate-900/90 text-center p-1">
          <span className="font-display text-[9px] font-black uppercase tracking-widest text-cyan-400">
            Micrylis
          </span>
          <span className="font-mono text-[7.5px] font-bold text-slate-300">
            ★ SPIN ★
          </span>
        </div>
      </div>

      {/* Top Precision Needle Pointer (Stationary with Click Oscillation) */}
      <div
        className="pointer-events-none absolute top-1 z-30 transition-transform duration-75"
        style={{
          transform: isPointerTicking ? "rotate(-12deg) scale(1.05)" : "rotate(0deg)",
          transformOrigin: "top center",
        }}
      >
        <svg width="28" height="36" viewBox="0 0 28 36" fill="none">
          {/* Needle Drop Shadow */}
          <path
            d="M14 34L4 6C4 2.68629 8.47715 0 14 0C19.5228 0 24 2.68629 24 6L14 34Z"
            fill="rgba(0,0,0,0.3)"
          />
          {/* Needle Body */}
          <path
            d="M14 32L5 6C5 3 9 1 14 1C19 1 23 3 23 6L14 32Z"
            fill="#e11d48" // Rose accent
            stroke="#ffffff"
            strokeWidth="2"
          />
          {/* Top Pivot Bead */}
          <circle cx="14" cy="7" r="4" fill="#ffffff" />
        </svg>
      </div>
    </div>
  );
}
