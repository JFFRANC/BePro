export interface ActiveMatchItem {
  id: string;
  path: string;
  exactMatch?: boolean;
}

function normalize(pathname: string): string {
  const withoutQuery = pathname.split("?")[0].split("#")[0];
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}

export function resolveActiveItem(
  pathname: string,
  items: ActiveMatchItem[],
): string | null {
  if (!pathname) return null;
  const current = normalize(pathname);

  let bestId: string | null = null;
  let bestLength = -1;

  for (const item of items) {
    const itemPath = normalize(item.path);

    if (item.exactMatch) {
      if (current === itemPath && itemPath.length > bestLength) {
        bestId = item.id;
        bestLength = itemPath.length;
      }
      continue;
    }

    const isExact = current === itemPath;
    // Para evitar que "/" haga prefix-match de todo, exigimos exactMatch en items raíz.
    const isPrefix = itemPath !== "/" && current.startsWith(itemPath + "/");

    if ((isExact || isPrefix) && itemPath.length > bestLength) {
      bestId = item.id;
      bestLength = itemPath.length;
    }
  }

  return bestId;
}
