"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { PreviewTab } from "./AppPreview";
import styles from "./landing.module.css";

export default function ScreenSequence({ screens, active, onChange, reduced, english }: {
  screens: { id: PreviewTab; label: string }[];
  active: PreviewTab;
  onChange: (screen: PreviewTab) => void;
  reduced: boolean | null;
  english: boolean;
}) {
  const selected = screens.findIndex(screen => screen.id === active);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || reduced) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      onChange(screens[(selected + 1) % screens.length].id);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [paused, reduced, selected, screens, onChange]);
  return <div className={styles.screenDeck} onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerCancel={() => setPaused(false)} onPointerLeave={() => setPaused(false)}>
    {screens.map((screen, index) => {
      const offset = ((index - selected + screens.length + 2) % screens.length) - 2;
      const front = offset === 0;
      return <motion.div key={screen.id} className={styles.deckPhone}
        aria-hidden={!front}
        initial={false}
        animate={{ x: offset * 125, y: Math.abs(offset) * 22, rotate: offset * 10,
          scale: front ? 1 : .88 - Math.abs(offset) * .06,
          opacity: 1,
          filter: front ? "blur(0px)" : "blur(4px)" }}
        transition={{ duration: reduced ? 0 : .5, ease: [.22, 1, .36, 1] }}
        style={{ zIndex: 3 - Math.abs(offset), pointerEvents: front ? "auto" : "none" }}>
        <motion.div drag={reduced ? false : "x"} dragConstraints={{ left: 0, right: 0 }} dragElastic={.18}
          onDragEnd={(_, info) => {
            if (Math.abs(info.offset.x) > 35) onChange(screens[(selected + (info.offset.x < 0 ? 1 : -1) + screens.length) % screens.length].id);
          }}>
          <Image src={`/images/landing/${screen.id}.webp`} width={708} height={1442}
            sizes="(max-width: 600px) 175px, 210px" draggable={false}
            alt={front ? `${screen.label} — FinTrack ${english ? "in light mode" : "dalam mode light"}` : ""} />
        </motion.div>
      </motion.div>;
    })}
  </div>;
}




