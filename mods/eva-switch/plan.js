// Pure logic for eva-switch: no herdr imports, so Vitest can load it.

// `seen` is the last focus { space, terminal }; `focus` is herdr's focused().
// Hint on a space change, or when focus lands on a different agent.
export function step(seen, focus, agents) {
  if (!focus) return { seen, hint: null };
  const terminal = focus.agent ?? focus.terminal;
  const next = { space: focus.space, terminal };
  const agent = agents.some((a) => a.address === terminal) ? terminal : null;
  const moved = seen && seen.space !== next.space;
  const newAgent = seen && agent && seen.terminal !== terminal;
  if (!moved && !newAgent) return { seen: next, hint: null };
  const kind = moved ? "space" : "agent";
  return { seen: next, hint: { kind, space: next.space, agent } };
}

export function card(hint, spaces, agents) {
  const a = agents.find((x) => x.address === hint.agent);
  return {
    space: spaces.find((s) => s.id === hint.space)?.name ?? "",
    agent: a
      ? { name: a.program?.name ?? "", status: a.status, title: a.title }
      : null,
  };
}
