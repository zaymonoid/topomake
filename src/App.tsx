import { Canvas } from "./components/Canvas";
import { LeftRail } from "./components/LeftRail";
import { SidePanel } from "./components/SidePanel";
import { StatusBar } from "./components/StatusBar";
import { TopBar } from "./components/TopBar";
import { KeyboardRoot } from "./input/KeyboardRoot";
import { usePersistence } from "./state/persistence";

export function App() {
  usePersistence();
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
