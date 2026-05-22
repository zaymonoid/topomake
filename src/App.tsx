import { Canvas } from "./components/Canvas";
import { LeftRail } from "./components/LeftRail";
import { SidePanel } from "./components/SidePanel";
import { StatusBar } from "./components/StatusBar";
import { TopBar } from "./components/TopBar";
import { KeyboardRoot } from "./input/KeyboardRoot";
// Side-effect import: boots the katha runtime + store at module-evaluation
// time. Components import the resolved `store` directly from this module.
import "./state/store";

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
