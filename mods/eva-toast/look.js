// What each notification level looks like: plate kanji, its English word, and
// color names from eva.js `C` (kept as names so this file loads without gpui).
// Red is for warnings only; error blinks while MOTION is on.
const LOOK = {
  error: {
    kanji: "警告",
    word: "ALERT",
    plate: "red",
    ink: "white",
    blink: true,
  },
  warning: {
    kanji: "注意",
    word: "CAUTION",
    plate: "red",
    ink: "white",
    blink: false,
  },
  success: {
    kanji: "完了",
    word: "CLEAR",
    plate: "green",
    ink: "ink",
    blink: false,
  },
  info: {
    kanji: "通報",
    word: "NOTICE",
    plate: "purple",
    ink: "white",
    blink: false,
  },
};

export const look = (level) => ({ ...(LOOK[level] ?? LOOK.info) });

// Herdr's "<machine> needs login; run hc machine login <machine>" body, as the
// shipped toast reads it.
export function loginCommand(body) {
  const m =
    /^([a-z0-9][a-z0-9_.-]{0,31}) needs login; run hc machine login \1$/.exec(
      body ?? "",
    );
  return m ? { machine: m[1], command: `hc machine login ${m[1]}` } : null;
}
