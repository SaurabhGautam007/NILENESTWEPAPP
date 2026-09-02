import React, { useEffect, useState } from "react";

export default function Splash() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 650);
    const t2 = setTimeout(() => setVisible(false), 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!visible) return null;

  return (
    <div
      data-testid="splash"
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-700 ease-out pointer-events-none ${fading ? "opacity-0" : "opacity-100"}`}
    >
      <div className="animate-fade-up">
        <img
          src="/nilenest-logo.png?v=3"
          srcSet="/nilenest-logo.png?v=3 1x, /nilenest-logo@2x.png?v=3 2x, /nilenest-logo@3x.png?v=3 3x"
          alt="NileNest"
          className="h-40 md:h-48 w-auto object-contain select-none"
          draggable="false"
          style={{ imageRendering: "-webkit-optimize-contrast" }}
        />
      </div>
      <div className="mt-6 text-xs tracking-[0.28em] uppercase text-secondary">Nature, unhurried</div>
    </div>
  );
}
