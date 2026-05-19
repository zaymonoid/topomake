import { TopBar } from "./components/TopBar";
import { Canvas } from "./components/Canvas";
import { SidePanel } from "./components/SidePanel";
import { KeyboardRoot } from "./input/KeyboardRoot";

export function App() {
  return (
    <div className="app">
      <KeyboardRoot />
      <TopBar />
      <div className="main">
        <Canvas />
        <SidePanel />
      </div>
    </div>
  );
}
