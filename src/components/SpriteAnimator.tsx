import { useRef, useEffect, useCallback } from "react";

export type PetState = "idle" | "thinking" | "talking" | "notify";

interface SpriteAnimatorProps {
  state: PetState;
  size?: number;
}

/** 动画帧配置 */
interface FrameConfig {
  /** 帧循环数组，每个元素是该状态下的绘制函数索引 */
  frames: number[];
  /** 帧间隔 ms */
  interval: number;
}

const STATE_CONFIGS: Record<PetState, FrameConfig> = {
  idle: { frames: [0, 1, 0, 2], interval: 400 },
  thinking: { frames: [3, 4, 3, 5], interval: 300 },
  talking: { frames: [6, 7, 6, 8], interval: 200 },
  notify: { frames: [9, 10, 9, 10], interval: 250 },
};

function SpriteAnimator({ state, size = 64 }: SpriteAnimatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameIdx = useRef(0);
  const rafId = useRef(0);
  const lastTime = useRef(0);
  const elapsed = useRef(0);
  const currentState = useRef<PetState>("idle");

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, s: PetState, frame: number) => {
      const c = size / 2;
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(c, c);

      // 呼吸动画缩放
      let breathScale = 1;
      if (s === "idle" && frame === 1) breathScale = 1.03;
      if (s === "talking") breathScale = 1 + 0.05 * Math.sin(Date.now() / 150);

      ctx.scale(breathScale, breathScale);

      const r = size * 0.42; // 身体/头半径

      switch (s) {
        case "idle":
          drawChibi(ctx, r, frame);
          break;
        case "thinking":
          drawThinking(ctx, r, frame);
          break;
        case "talking":
          drawTalking(ctx, r, frame);
          break;
        case "notify":
          drawNotify(ctx, r, frame);
          break;
      }

      ctx.restore();
    },
    [size]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    currentState.current = state;
    frameIdx.current = 0;
    elapsed.current = 0;
    lastTime.current = performance.now();

    const config = STATE_CONFIGS[state];

    const tick = (now: number) => {
      const dt = now - lastTime.current;
      lastTime.current = now;
      elapsed.current += dt;

      if (elapsed.current >= config.interval) {
        elapsed.current = 0;
        frameIdx.current = (frameIdx.current + 1) % config.frames.length;
      }

      draw(ctx, currentState.current, config.frames[frameIdx.current]);
      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId.current);
  }, [state, draw]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="block pointer-events-none"
      style={{ width: size, height: size }}
    />
  );
}

export default SpriteAnimator;

// ─── 绘制函数 ───────────────────────────────

/** idle: 睁眼 / 闭眼 */
function drawChibi(ctx: CanvasRenderingContext2D, r: number, frame: number) {
  // 脸
  ctx.fillStyle = "#f9c7c0";
  ctx.beginPath();
  ctx.ellipse(0, 2, r, r * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // 头发
  ctx.fillStyle = "#4a3728";
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.35, r * 1.05, r * 0.6, 0, Math.PI, 0);
  ctx.fill();
  // 刘海
  ctx.beginPath();
  ctx.ellipse(-r * 0.2, -r * 0.25, r * 0.55, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.2, -r * 0.25, r * 0.55, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  // 眼睛
  if (frame !== 2) {
    // 睁眼
    drawEye(ctx, -r * 0.3, -r * 0.08, r * 0.18);
    drawEye(ctx, r * 0.3, -r * 0.08, r * 0.18);
  } else {
    // 闭眼（眨眼）
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, -r * 0.05);
    ctx.quadraticCurveTo(-r * 0.3, r * 0.08, -r * 0.15, -r * 0.05);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.15, -r * 0.05);
    ctx.quadraticCurveTo(r * 0.3, r * 0.08, r * 0.45, -r * 0.05);
    ctx.stroke();
  }

  // 腮红
  ctx.fillStyle = "rgba(255,150,150,0.35)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.5, r * 0.15, r * 0.15, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.5, r * 0.15, r * 0.15, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // 嘴（微笑）
  ctx.strokeStyle = "#c97d7d";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, r * 0.2, r * 0.15, 0.1, Math.PI - 0.1);
  ctx.stroke();
}

/** thinking: 向上看 + 思考点 */
function drawThinking(ctx: CanvasRenderingContext2D, r: number, frame: number) {
  drawChibiBase(ctx, r);

  // 眼睛向上看
  const eyeY = -r * 0.18;
  drawEye(ctx, -r * 0.28, eyeY, r * 0.16);
  drawEye(ctx, r * 0.28, eyeY, r * 0.16);

  // 嘴（小 o 型）
  ctx.fillStyle = "#c97d7d";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.25, r * 0.08, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // 思考气泡点
  const dots = frame === 3 ? 1 : frame === 4 ? 2 : 3;
  ctx.fillStyle = "#888";
  for (let i = 0; i < dots; i++) {
    ctx.beginPath();
    ctx.arc(r * 0.55 + i * r * 0.25, -r * 0.65 - i * r * 0.15, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** talking: 张嘴说话 */
function drawTalking(ctx: CanvasRenderingContext2D, r: number, frame: number) {
  drawChibiBase(ctx, r);

  drawEye(ctx, -r * 0.3, -r * 0.08, r * 0.18);
  drawEye(ctx, r * 0.3, -r * 0.08, r * 0.18);

  // 说话嘴（开合）
  const open = frame === 7 ? r * 0.18 : r * 0.08;
  ctx.fillStyle = "#d4786b";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.28, r * 0.12, open, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.25, r * 0.06, open * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** notify: 兴奋闪烁 */
function drawNotify(ctx: CanvasRenderingContext2D, r: number, frame: number) {
  drawChibiBase(ctx, r);

  // 星星眼
  if (frame === 9) {
    drawStarEye(ctx, -r * 0.3, -r * 0.08, r * 0.2);
    drawStarEye(ctx, r * 0.3, -r * 0.08, r * 0.2);
  } else {
    drawEye(ctx, -r * 0.3, -r * 0.08, r * 0.2);
    drawEye(ctx, r * 0.3, -r * 0.08, r * 0.2);
  }

  // 开心嘴
  ctx.strokeStyle = "#c97d7d";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, r * 0.15, r * 0.2, 0.1, Math.PI - 0.1);
  ctx.stroke();

  // 感叹号
  ctx.fillStyle = "#ff6b6b";
  ctx.font = `bold ${r * 0.6}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("!", r * 0.65, -r * 0.6);
}

// ─── 辅助函数 ───────────────────────────────

function drawChibiBase(ctx: CanvasRenderingContext2D, r: number) {
  ctx.fillStyle = "#f9c7c0";
  ctx.beginPath();
  ctx.ellipse(0, 2, r, r * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#4a3728";
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.35, r * 1.05, r * 0.6, 0, Math.PI, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-r * 0.2, -r * 0.25, r * 0.55, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.2, -r * 0.25, r * 0.55, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,150,150,0.35)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.5, r * 0.15, r * 0.15, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(r * 0.5, r * 0.15, r * 0.15, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawEye(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(x, y, size, size * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#5a3825";
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.5, size * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // 高光
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x + size * 0.15, y - size * 0.2, size * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawStarEye(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(x, y, size, size * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 星形瞳
  ctx.fillStyle = "#e8a010";
  drawStar(ctx, x, y, size * 0.5);
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}
