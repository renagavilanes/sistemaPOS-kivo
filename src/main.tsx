import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

function dismissLaunchSplash() {
  const splash = document.getElementById("kivo-splash");
  if (!splash) return;

  const remove = () => splash.remove();
  splash.addEventListener("transitionend", remove, { once: true });
  splash.classList.add("is-done");
  window.setTimeout(remove, 500);
}

createRoot(document.getElementById("root")!).render(<App />);
requestAnimationFrame(() => {
  requestAnimationFrame(dismissLaunchSplash);
});
