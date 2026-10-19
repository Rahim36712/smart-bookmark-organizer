// Folder IDs, rather than names, keep protection unambiguous after renames.
export function protectedFolderIds(folders, excluded = []) {
  const protectedIds = new Set(excluded.map(String));
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of folders) {
      if (protectedIds.has(String(folder.parentId)) && !protectedIds.has(String(folder.id))) {
        protectedIds.add(String(folder.id));
        changed = true;
      }
    }
  }
  return protectedIds;
}

export function eligibleBookmarks(scan, settings) {
  const protectedIds = protectedFolderIds(scan.folders, settings.excludedFolderIds || []);
  return scan.bookmarks.filter(item => !protectedIds.has(String(item.parentId)));
}

export function applyConfidenceDefaults(plan, settings) {
  for (const item of plan) {
    if (settings.highConfidenceOnly !== false && item.confidence !== 'high') item.selected = false;
  }
  return plan;
}

export function markCurrentDestinations(plan, scan, settings) {
  const root = String(settings.targetRootParentId || '1');
  const title = settings.targetRootFolderTitle === undefined ? 'Organized Bookmarks' : settings.targetRootFolderTitle;
  const children = new Map();
  for (const folder of scan.folders) {
    const parent = String(folder.parentId);
    if (!children.has(parent)) children.set(parent, new Map());
    const siblings = children.get(parent);
    if (!siblings.has(folder.title.toLowerCase())) siblings.set(folder.title.toLowerCase(), folder);
  }
  for (const item of plan) {
    let parent = root;
    for (const segment of [...(title ? [title] : []), ...(item.proposedPath || [])]) {
      const folder = children.get(parent)?.get(segment.toLowerCase());
      if (!folder) { parent = null; break; }
      parent = String(folder.id);
    }
    item.isAlreadyOrganized = parent !== null && String(item.currentParentId) === parent;
  }
  return plan;
}
