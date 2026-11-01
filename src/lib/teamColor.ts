export function normalizedTeamColor(color: string | null | undefined) {
  const value = color?.replace(/^#/, "");
  return value && /^[\da-f]{6}$/i.test(value) ? value.toUpperCase() : null;
}

export function jerseyStyle(color: string | null | undefined, borderColor?: string) {
  const normalizedColor = normalizedTeamColor(color);
  const style: { backgroundColor?: string; color?: string; borderColor?: string } = {};
  if (normalizedColor) {
    const red = Number.parseInt(normalizedColor.slice(0, 2), 16);
    const green = Number.parseInt(normalizedColor.slice(2, 4), 16);
    const blue = Number.parseInt(normalizedColor.slice(4, 6), 16);
    const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
    style.backgroundColor = `#${normalizedColor}`;
    style.color = brightness > 155 ? "#111827" : "#fff";
  }
  if (borderColor) style.borderColor = borderColor;
  return Object.keys(style).length ? style : undefined;
}
