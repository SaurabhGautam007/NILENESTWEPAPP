import React, { useEffect, useState } from "react";

export default function Splash() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Hold 1.2s then fade out over 400ms — premium, intentional, not slow.
    const t1 = setTimeout(() => setFading(true), 1200);
    const t2 = setTimeout(() => setVisible(false), 1650);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!visible) return null;

  return (
    <div
      data-testid="splash"
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-white transition-opacity duration-500 ease-out pointer-events-none ${fading ? "opacity-0" : "opacity-100"}`}
    >
      <div
        className="flex flex-col items-center"
        style={{
          animation: "nn-splash-in 700ms cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        <img
          src="/nilenest-logo.png?v=3"
          srcSet="/nilenest-logo.png?v=3 1x, /nilenest-logo@2x.png?v=3 2x, /nilenest-logo@3x.png?v=3 3x"
          alt="NileNest"
          className="h-20 sm:h-24 md:h-28 w-auto object-contain select-none"
          draggable="false"
          style={{ imageRendering: "-webkit-optimize-contrast" }}
        />
      </div>
      <style>{`@keyframes nn-splash-in { from { opacity: 0.4; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}
