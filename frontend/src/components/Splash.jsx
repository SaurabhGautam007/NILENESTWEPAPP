import React, { useEffect, useState } from "react";
import { BrandMark } from "@/components/Logo";

export default function Splash() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Hold briefly, fade out, unmount
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
        <BrandMark className="w-40 h-28 md:w-48 md:h-32" />
        <div
          className="mt-3 uppercase text-3xl md:text-4xl text-black leading-none text-center"
          style={{ fontFamily: "'Cinzel', 'Playfair Display', serif", fontWeight: 700, letterSpacing: "0.04em" }}
        >
          NileNest
        </div>
      </div>
      <div className="mt-8 text-xs tracking-[0.28em] uppercase text-secondary">Nature, unhurried</div>
    </div>
  );
}
