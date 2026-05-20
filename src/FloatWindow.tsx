import { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit, listen } from "@tauri-apps/api/event";
import SpriteAnimator, { type PetState } from "./components/SpriteAnimator";

function FloatWindow() {
  const [hover, setHover] = useState(false);
  const [notifyCount, setNotifyCount] = useState(0);
  const [petState, setPetState] = useState<PetState>("idle");
  const notifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 触发通知动画，短暂闪烁后恢复
  const triggerNotify = () => {
    setPetState("notify");
    if (notifyTimer.current) clearTimeout(notifyTimer.current);
    notifyTimer.current = setTimeout(() => setPetState("idle"), 2000);
  };

  useEffect(() => {
    // 通知计数
    const unlistenCount = listen<{ count: number }>(
      "notify-count",
      (event) => {
        setNotifyCount(event.payload.count);
        triggerNotify();
      }
    );

    // WS 连接状态 → thinking / idle
    const unlistenStatus = listen<string>("ws-status", (event) => {
      if (event.payload === "connecting") {
        setPetState("thinking");
      } else if (event.payload === "connected") {
        setPetState("idle");
      }
    });

    // 收到消息 → talking
    const unlistenMsg = listen<Record<string, unknown>>(
      "agent-message",
      (event) => {
        const role = event.payload.role as string;
        if (role === "assistant") {
          setPetState("talking");
          // 2 秒后回到 idle
          if (notifyTimer.current) clearTimeout(notifyTimer.current);
          notifyTimer.current = setTimeout(() => setPetState("idle"), 2000);
        } else if (role === "notify") {
          triggerNotify();
        }
      }
    );

    return () => {
      unlistenCount.then((fn) => fn());
      unlistenStatus.then((fn) => fn());
      unlistenMsg.then((fn) => fn());
      if (notifyTimer.current) clearTimeout(notifyTimer.current);
    };
  }, []);

  // 原生事件监听，确保 Tauri startDragging 能正确捕获鼠标事件
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        getCurrentWindow().startDragging();
        e.preventDefault();
      }
    };

    el.addEventListener("mousedown", onMouseDown);
    return () => el.removeEventListener("mousedown", onMouseDown);
  }, []);

  const handleClick = () => {
    emit("open-chat", {});
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center select-none cursor-grab"
      onClick={handleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="relative">
        {/* 精灵动画/角色 */}
        <div
          className={`transition-all duration-200
            ${hover ? "scale-110" : "scale-100"}
          `}
          style={{ filter: hover ? "drop-shadow(0 0 8px rgba(168,85,247,0.6))" : "none" }}
        >
          <SpriteAnimator state={petState} size={64} />
        </div>

        {/* 通知角标 */}
        {notifyCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full font-bold px-1 animate-pulse shadow-md">
            {notifyCount > 99 ? "99+" : notifyCount}
          </span>
        )}

        {/* 状态标签（hover 显示） */}
        {hover && (
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap">
            {petState === "idle" && "待机中"}
            {petState === "thinking" && "思考中..."}
            {petState === "talking" && "说话中..."}
            {petState === "notify" && "有消息!"}
          </div>
        )}
      </div>
    </div>
  );
}

export default FloatWindow;
