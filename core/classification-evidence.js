// Shared platforms host unrelated subjects; their domain is only a weak hint.
export function isSharedPlatform(hostname) {
  return ['youtube.com', 'youtu.be', 'github.com', 'gitlab.com', 'reddit.com',
    'medium.com', 'linkedin.com', 'facebook.com', 'instagram.com', 'x.com',
    'twitter.com', 'google.com', 'notion.so', 'notion.site', 'stackoverflow.com']
    .some(domain => hostname === domain || hostname.endsWith('.' + domain));
}

export function normalizeBookmarkUrl(value) {
  try {
    const url = new URL(value);
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|fbclid|gclid|msclkid)$/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return url.href;
  } catch { return String(value || '').trim(); }
}

export function needsBookmarkReview(item) {
  return !item.isAlreadyOrganized && !item.reviewDecision &&
    (item.confidence !== 'high' || item.proposedCategoryId === 'other');
}

export function assignReviewedFolder(item, path, categories) {
  const category = categories.find(c => c.name === path[0]);
  Object.assign(item, {
    proposedPath: path, proposedFolderDisplay: path.join(' / '),
    proposedCategoryId: category?.id || 'custom', proposedCategoryName: path[0],
    proposedSubcategoryName: path[1] || null, proposedSubcategoryId: null,
    confidence: 'high', selected: true, reviewDecision: 'assign', isLearned: true, preserveChosenPath: true,
    icon: category?.icon || '📁', color: category?.color || '#4361ee',
    matchReason: 'Folder chosen by you for this bookmark'
  });
}
