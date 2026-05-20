import { useState, useEffect, useRef } from "react";
import { listen, emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

interface Message {
  id: number;
  role: string;
  content: string;
  time: string;
}

function ChatWindow() {
  const [wsStatus, setWsStatus] = useState<string>("disconnected");
  const [messages, setMessages] = useState<Message[]>([]);
  const [notifyCount, setNotifyCount] = useState(0);
  const [input, setInput] = useState("");
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 请求通知权限
  useEffect(() => {
    (async () => {
      let granted = await isPermissionGranted();
      if (!granted) {
        const result = await requestPermission();
        granted = result === "granted";
      }
      if (granted) {
        // 发一条测试通知确认权限
        sendNotification({ title: "Hermes", body: "通知系统就绪" });
      }
    })();
  }, []);

  useEffect(() => {
    const unlistenStatus = listen<string>("ws-status", (event) => {
      setWsStatus(event.payload);
    });

    // 接收所有消息 → 显示在列表
    const unlistenMsg = listen<Record<string, unknown>>(
      "agent-message",
      (event) => {
        const payload = event.payload;
        const newMsg: Message = {
          id: Date.now(),
          role: (payload.role as string) ?? "system",
          content: (payload.content as string) ?? JSON.stringify(payload),
          time: new Date().toLocaleTimeString(),
        };
        setMessages((prev) => [...prev, newMsg]);
      }
    );

    // 接收通知消息 → 系统弹窗 + 计数
    const unlistenNotify = listen<{ title: string; body: string }>(
      "notify-message",
      async (event) => {
        const { title, body } = event.payload;
        // 系统桌面通知
        sendNotification({ title, body });
        // 增加通知计数，同步到悬浮球
        setNotifyCount((prev) => {
          const next = prev + 1;
          emit("notify-count", { count: next });
          return next;
        });
      }
    );

    invoke<string>("get_ws_status").then(setWsStatus);

    return () => {
      unlistenStatus.then((fn) => fn());
      unlistenMsg.then((fn) => fn());
      unlistenNotify.then((fn) => fn());
    };
  }, []);

  const sendTest = (role: string) => {
    const contents: Record<string, string> = {
      assistant: "你好！我是 Hermes，有什么可以帮助你的？",
      notify: "提醒：下午 3 点有会议",
      system: "这是一条系统消息",
    };
    invoke("send_test_message", {
      role,
      content: contents[role] ?? "test",
    });
  };

  const sendInput = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: "user",
        content: text,
        time: new Date().toLocaleTimeString(),
      },
    ]);
    setInput("");
    sendTest("assistant");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendInput();
    }
  };

  const handleClose = async () => {
    await getCurrentWindow().hide();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* 标题栏 */}
      <header
        className="flex items-center justify-between px-3 py-2 border-b border-gray-700 cursor-grab active:cursor-grabbing"
        onMouseDown={() => getCurrentWindow().startDragging()}
      >
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-bold">Hermes</h1>
          {notifyCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {notifyCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              wsStatus === "connected"
                ? "bg-green-400"
                : wsStatus === "connecting"
                  ? "bg-yellow-400 animate-pulse"
                  : "bg-red-400"
            }`}
          />
          <span className="text-xs text-gray-400 capitalize">{wsStatus}</span>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-white text-xs px-2 py-0.5 rounded hover:bg-gray-700 transition"
          >
            &#x2715;
          </button>
        </div>
      </header>

      {/* 消息列表 */}
      <main className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {messages.length === 0 ? (
          <p className="text-gray-600 text-center text-sm mt-8">
            等待消息...
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : msg.role === "assistant"
                      ? "bg-gray-700 text-gray-100"
                      : msg.role === "notify"
                        ? "bg-gradient-to-r from-yellow-700 to-orange-700 text-yellow-100 border border-yellow-600"
                        : "bg-gray-800 text-gray-400"
                }`}
              >
                {msg.role === "notify" && (
                  <div className="text-[10px] text-yellow-300 mb-1 font-bold uppercase tracking-wide">
                    通知
                  </div>
                )}
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <span className="text-[10px] opacity-50 mt-1 block">
                  {msg.time}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={listEndRef} />
      </main>

      {/* 测试按钮 */}
      <div className="flex gap-1 px-3 py-1.5 border-t border-gray-800">
        <button
          onClick={() => sendTest("assistant")}
          className="px-2 py-1 text-[11px] bg-gray-700 hover:bg-gray-600 rounded transition"
        >
          Assistant
        </button>
        <button
          onClick={() => sendTest("notify")}
          className="px-2 py-1 text-[11px] bg-yellow-800 hover:bg-yellow-700 rounded transition"
        >
          Notify
        </button>
        <button
          onClick={() => sendTest("system")}
          className="px-2 py-1 text-[11px] bg-gray-800 hover:bg-gray-700 rounded transition"
        >
          System
        </button>
      </div>

      {/* 输入框 */}
      <div className="flex gap-2 px-3 py-2 border-t border-gray-700">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息..."
          className="flex-1 bg-gray-800 text-white text-sm px-3 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
        <button
          onClick={sendInput}
          disabled={!input.trim()}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-lg transition"
        >
          发送
        </button>
      </div>
    </div>
  );
}

export default ChatWindow;
