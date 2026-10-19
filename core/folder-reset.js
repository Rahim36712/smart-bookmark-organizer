// A reset only moves bookmarks and removes empty folders. Never removeTree.
export function buildFolderResetPlan(tree) {
  const items = [];
  const folders = [];
  let managedCount = 0;
  const visit = (node, rootId, index, isRoot = false) => {
    if (node.unmodifiable) { managedCount++; return; }
    const system = isRoot || Boolean(node.folderType);
    const destination = system ? node.id : rootId;
    const record = {
      id: node.id, title: node.title, originalParentId: node.parentId,
      originalIndex: node.index ?? index, newParentId: destination
    };
    if (node.url) items.push({ ...record, url: node.url });
    else {
      if (!system) folders.push(record);
      (node.children || []).forEach((child, i) => visit(child, destination, i));
    }
  };
  for (const root of tree) {
    (root.children || []).forEach((node, i) => visit(node, node.id, i, true));
  }
  return { items, folders, managedCount, moves: items.filter(b => b.originalParentId !== b.newParentId) };
}

export async function resetBookmarkFolders(api, undoManager, onProgress = null) {
  if (!undoManager.storage) throw new Error('Undo storage is required before resetting folders.');
  const plan = buildFolderResetPlan(await api.getTree());
  if (!plan.folders.length && !plan.moves.length) {
    return { totalMoved: 0, removedFolders: 0, failedCount: 0, managedCount: plan.managedCount };
  }
  // Persist the entire original structure BEFORE the first mutation, including
  // empty folders and root-level links needed to restore sibling ordering.
  const snapshot = await undoManager.saveSnapshot(
    'Reset bookmark folders', plan.items, [], 'folder_reset', { folders: plan.folders }
  );
  let totalMoved = 0;
  let removedFolders = 0;
  let failedCount = 0;
  let completed = 0;
  const total = plan.moves.length + plan.folders.length;
  const progress = () => onProgress?.({ completed: ++completed, total, percent: Math.round(completed / total * 100) });
  for (const item of plan.moves) {
    try { await api.move(item.id, { parentId: item.newParentId }); totalMoved++; }
    catch { failedCount++; }
    progress();
  }
  for (const folder of [...plan.folders].reverse()) {
    try {
      // A failed move, managed child, or newly added link keeps this folder safe.
      const children = await api.getChildren(folder.id);
      if (children.length) failedCount++;
      else { await api.remove(folder.id); removedFolders++; }
    } catch { failedCount++; }
    progress();
  }
  return { snapshot, totalMoved, removedFolders, failedCount, managedCount: plan.managedCount };
}

export async function restoreFolderReset(manager, snapshot, onProgress = null) {
  const api = manager.bookmarksApi;
  const mapping = snapshot.restoredFolderIds || {};
  snapshot.restoredFolderIds = mapping;
  const folders = snapshot.folders || [];
  const folderIds = new Set(folders.map(f => f.id));
  const persist = async () => {
    const snapshots = await manager.getAllSnapshots();
    const index = snapshots.findIndex(s => s.id === snapshot.id);
    if (index < 0) throw new Error('Reset snapshot no longer exists.');
    snapshots[index] = snapshot;
    await manager.storage.set({ [manager.STORAGE_KEY]: snapshots });
  };
  const exists = async id => {
    try { return (await api.get(id))[0]; } catch { return null; }
  };
  const parentFor = node => {
    if (folderIds.has(node.originalParentId)) {
      if (!mapping[node.originalParentId]) throw new Error('Original parent could not be restored.');
      return mapping[node.originalParentId];
    }
    return node.originalParentId;
  };
  let failedCount = 0;
  let restoredCount = 0;
  let completed = 0;
  const total = folders.length + snapshot.items.length;
  const progress = () => onProgress?.({ completed: ++completed, total, percent: Math.round(completed / total * 100) });
  // IDs, not folder titles, preserve same-name siblings and localized roots.
  for (const folder of folders) {
    try {
      const original = await exists(folder.id);
      const recreated = mapping[folder.id] ? await exists(mapping[folder.id]) : null;
      if (original && !original.url) mapping[folder.id] = original.id;
      else if (recreated && !recreated.url) mapping[folder.id] = recreated.id;
      else {
        delete mapping[folder.id];
        const node = await api.create({ parentId: parentFor(folder), title: folder.title });
        mapping[folder.id] = node.id;
        // Persist each recreated ID so a partially failed restore can be retried.
        await persist();
      }
    } catch (error) {
      // A storage failure must stop before further mutations lose their mapping.
      if (mapping[folder.id] && !(await exists(folder.id))) throw error;
      failedCount++;
    }
    progress();
  }
  for (const item of snapshot.items) {
    try { await api.move(item.id, { parentId: parentFor(item) }); restoredCount++; }
    catch { failedCount++; }
    progress();
  }
  // Restore mixed folder/bookmark sibling order after every parent is populated.
  const siblings = new Map();
  for (const node of [...folders, ...snapshot.items]) {
    const group = siblings.get(node.originalParentId) || [];
    group.push(node);
    siblings.set(node.originalParentId, group);
  }
  for (const group of siblings.values()) {
    for (const node of group.sort((a, b) => a.originalIndex - b.originalIndex)) {
      try {
        const id = folderIds.has(node.id) ? mapping[node.id] : node.id;
        if (!id) throw new Error('Folder missing');
        await api.move(id, { parentId: parentFor(node), index: node.originalIndex });
      } catch { failedCount++; }
    }
  }
  snapshot.status = failedCount ? 'active' : 'restored';
  if (!failedCount) snapshot.restoredAt = new Date().toISOString();
  await persist();
  return { success: failedCount === 0, restoredCount, failedCount, total };
}
