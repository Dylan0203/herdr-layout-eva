// Herdr's script engine compares code points in localeCompare, so every uppercase
// name would sort before every lowercase one. Finder ignores case: so does this.
const byName = (a, b) => {
  const x = a.toLowerCase(), y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : a < b ? -1 : a > b ? 1 : 0;
};

// The tree's entries for one folder, within what's left of the total budget.
// Sorted before cutting, so a cut drops the alphabetical tail and nothing else.
export const fitFolder = (entries, room) =>
  [...entries].sort((a, b) => Number(b.dir) - Number(a.dir) || byName(a.name, b.name)).slice(0, Math.max(0, room));
