import { createContext, useContext, useEffect, useState, useCallback } from "react";

const AccessibilityContext = createContext(null);

const STEPS = [1, 1.125, 1.25, 1.4];

export function AccessibilityProvider({ children }) {
  const [hc, setHc] = useState(() => localStorage.getItem("omi_hc") === "1");
  const [scaleIdx, setScaleIdx] = useState(() => Number(localStorage.getItem("omi_scale") || 0));
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("hc", hc);
    localStorage.setItem("omi_hc", hc ? "1" : "0");
  }, [hc]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * STEPS[scaleIdx]}px`;
    localStorage.setItem("omi_scale", String(scaleIdx));
  }, [scaleIdx]);

  const announce = useCallback((msg) => {
    setAnnouncement("");
    setTimeout(() => setAnnouncement(msg), 60);
  }, []);

  const value = {
    hc,
    toggleHc: () => setHc((v) => !v),
    scale: STEPS[scaleIdx],
    incFont: () => setScaleIdx((i) => Math.min(i + 1, STEPS.length - 1)),
    decFont: () => setScaleIdx((i) => Math.max(i - 1, 0)),
    resetFont: () => setScaleIdx(0),
    announce,
    announcement,
  };
  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

export const useA11y = () => useContext(AccessibilityContext);
