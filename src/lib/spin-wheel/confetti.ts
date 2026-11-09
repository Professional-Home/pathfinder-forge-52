/**
 * Zero-dependency Canvas Confetti Burst
 */
export function fireConfetti() {
  if (typeof window === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "99999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    document.body.removeChild(canvas);
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;

  const colors = ["#06b6d4", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#e11d48"];
  const particleCount = 120;
  const particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    rotation: number;
    rotSpeed: number;
    opacity: number;
  }> = [];

  for (let i = 0; i < particleCount; i++) {
    const angle = (Math.random() * Math.PI) - Math.PI / 2;
    const speed = 12 + Math.random() * 18;
    particles.push({
      x: canvas.width / 2,
      y: canvas.height * 0.45,
      vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
      vy: -Math.abs(Math.sin(angle) * speed) - 4,
      size: (6 + Math.random() * 8) * dpr,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.2,
      opacity: 1,
    });
  }

  let animationFrame: number;
  const startTime = Date.now();
  const duration = 3500; // 3.5 seconds

  function render() {
    const elapsed = Date.now() - startTime;
    if (elapsed > duration || !ctx) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const progress = elapsed / duration;

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.45 * dpr; // Gravity
      p.vx *= 0.98; // Drag
      p.rotation += p.rotSpeed;
      p.opacity = Math.max(0, 1 - progress * 1.2);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.opacity;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }

    animationFrame = requestAnimationFrame(render);
  }

  render();
}

