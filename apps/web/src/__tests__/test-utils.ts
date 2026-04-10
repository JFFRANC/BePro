export function parseOklch(value: string) {
  const match = value.match(
    /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/,
  );
  if (!match) return null;
  return {
    l: parseFloat(match[1]),
    c: parseFloat(match[2]),
    h: parseFloat(match[3]),
  };
}
