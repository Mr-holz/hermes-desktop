import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import FloatWindow from "./FloatWindow";
import ChatWindow from "./ChatWindow";

function App() {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setLabel(getCurrentWindow().label);
  }, []);

  if (label === null) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-transparent text-white text-xs">
        loading...
      </div>
    );
  }

  switch (label) {
    case "float":
      return <FloatWindow />;
    case "main":
      return <ChatWindow />;
    default:
      return <ChatWindow />;
  }
}

export default App;
