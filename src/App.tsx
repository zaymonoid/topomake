import { TopBar } from "./components/TopBar";
import { LeftRail } from "./components/LeftRail";
import { Canvas } from "./components/Canvas";
import { SidePanel } from "./components/SidePanel";
import { StatusBar } from "./components/StatusBar";
import { KeyboardRoot } from "./input/KeyboardRoot";

export function App() {
  return (
    <div className="app">
      <KeyboardRoot />
      <TopBar />
      <LeftRail />
      <Canvas />
      <SidePanel />
      <StatusBar />
    </div>
  );
}
