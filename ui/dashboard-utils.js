export function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function safeBookmarkHref(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:', 'ftp:'].includes(url.protocol.toLowerCase()) ? url.href : null;
  } catch {
    return null;
  }
}

export function showToast(message, type = null) {
  const text = String(message || '');
  if (typeof document === 'undefined') return;
  const inferredType = type || (/error|failed|could not|please|stopped|larger than/i.test(text) ? 'error' : /success|saved|restored|removed|organized|injected/i.test(text) ? 'success' : 'info');
  let region = document.getElementById('toastRegion');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toastRegion';
    region.className = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  const toast = document.createElement('div');
  toast.className = `app-toast toast-${inferredType}`;
  const label = document.createElement('span');
  label.textContent = text;
  const close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', 'Dismiss message');
  close.textContent = '×';
  close.onclick = () => toast.remove();
  toast.append(label, close);
  region.appendChild(toast);
  setTimeout(() => toast.remove(), inferredType === 'error' ? 8000 : 5000);
}

export function showConfirmModal(title, bodyHtml, onConfirm) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      if (onConfirm) onConfirm();
      resolve(true);
      return;
    }

    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const bodyEl = document.getElementById('confirmModalBody');
    const btnOk = document.getElementById('btnConfirmOk');
    const btnCancel = document.getElementById('btnConfirmCancel');

    if (!modal || !btnOk || !btnCancel) {
      if (onConfirm) onConfirm();
      resolve(true);
      return;
    }

    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = bodyHtml;
    modal.style.display = 'flex';
    const previousFocus = document.activeElement;
    btnCancel.focus?.();

    const onKeyDown = (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        (document.activeElement === btnCancel ? btnOk : btnCancel).focus?.();
      }
      if (e.key === 'Escape') {
        cleanup();
        resolve(false);
      }
    };

    const cleanup = () => {
      modal.style.display = 'none';
      previousFocus?.focus?.();
      btnOk.onclick = null;
      btnCancel.onclick = null;
      modal.onclick = null;
      if (typeof window !== 'undefined' && window.removeEventListener) {
        window.removeEventListener('keydown', onKeyDown);
      }
    };

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('keydown', onKeyDown);
    }

    modal.onclick = (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(false);
      }
    };

    btnCancel.onclick = () => {
      cleanup();
      resolve(false);
    };

    btnOk.onclick = async () => {
      cleanup();
      try {
        if (onConfirm) await onConfirm();
      } finally {
        resolve(true);
      }
    };
  });
}

export function resolveDestinationSettings(destSetting) {
  let destTitle = 'Organized Bookmarks';
  let targetRootParentId = '1';

  if (destSetting && typeof destSetting === 'object') {
    if (destSetting.targetRootSetting) {
      return resolveDestinationSettings(destSetting.targetRootSetting);
    }
    const parentId = destSetting.targetRootParentId || destSetting.targetParentId || '1';
    const title = destSetting.targetRootFolderTitle !== undefined
      ? destSetting.targetRootFolderTitle
      : 'Organized Bookmarks';
    return {
      destTitle: title,
      targetRootParentId: String(parentId)
    };
  }

  if (destSetting === 'dedicated') {
    destTitle = 'Organized Bookmarks';
    targetRootParentId = '1';
  } else if (destSetting === 'dedicated_other') {
    destTitle = 'Organized Bookmarks';
    targetRootParentId = '2';
  } else if (destSetting === 'bar') {
    destTitle = null;
    targetRootParentId = '1';
  } else if (destSetting === 'other') {
    destTitle = null;
    targetRootParentId = '2';
  }

  return { destTitle, targetRootParentId: String(targetRootParentId) };
}

export function getDestinationLocationLabel(destTitle, targetRootParentId) {
  return String(targetRootParentId) === '2'
    ? (destTitle ? `Other Bookmarks / ${destTitle}` : 'Other Bookmarks Root')
    : (destTitle ? `Bookmarks Bar / ${destTitle}` : 'Bookmarks Bar Root');
}
