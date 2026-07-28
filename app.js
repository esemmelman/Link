const STORAGE_KEY = 'link-deck-links-v1';
const elements = Object.fromEntries([
  'addButton', 'emptyAddButton', 'searchInput', 'categoryFilter', 'favoritesOnly', 'dataButton', 'linkGrid', 'emptyState', 'emptyMessage', 'resultCount',
  'linkDialog', 'linkForm', 'dialogTitle', 'linkId', 'linkTitle', 'linkUrl', 'linkCategory', 'linkDescription', 'linkFavorite', 'categorySuggestions', 'formMessage', 'closeDialogButton', 'cancelButton',
  'dataDialog', 'closeDataButton', 'exportButton', 'importInput', 'dataMessage', 'linkCardTemplate', 'installButton'
].map(id => [id, document.getElementById(id)]));

let links = loadLinks();
let installPrompt = null;

function loadLinks() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter(item => item && item.id && item.title && item.url) : [];
  } catch { return []; }
}

function saveLinks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
  render();
}

function safeUrl(value) {
  const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  const parsed = new URL(candidate);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Enter an HTTP or HTTPS address.');
  return parsed.href;
}

function categories() {
  return [...new Set(links.map(link => link.category || 'Uncategorized'))].sort((a, b) => a.localeCompare(b));
}

function renderFilters() {
  const selected = elements.categoryFilter.value;
  const names = categories();
  elements.categoryFilter.replaceChildren(new Option('All categories', 'all'), ...names.map(name => new Option(name, name)));
  elements.categoryFilter.value = names.includes(selected) ? selected : 'all';
  elements.categorySuggestions.replaceChildren(...names.filter(name => name !== 'Uncategorized').map(name => new Option(name)));
}

function visibleLinks() {
  const query = elements.searchInput.value.trim().toLowerCase();
  return links.filter(link => {
    const matchesText = !query || [link.title, link.url, link.category, link.description].some(value => (value || '').toLowerCase().includes(query));
    const matchesCategory = elements.categoryFilter.value === 'all' || (link.category || 'Uncategorized') === elements.categoryFilter.value;
    return matchesText && matchesCategory && (!elements.favoritesOnly.checked || link.favorite);
  }).sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.title.localeCompare(b.title));
}

function render() {
  renderFilters();
  const shown = visibleLinks();
  elements.linkGrid.replaceChildren(...shown.map(createCard));
  elements.emptyState.hidden = shown.length > 0;
  elements.emptyMessage.textContent = links.length ? 'Try changing your search or filters.' : 'Add your first destination to get started.';
  elements.resultCount.textContent = `${shown.length} ${shown.length === 1 ? 'link' : 'links'}`;
}

function createCard(link) {
  const card = elements.linkCardTemplate.content.firstElementChild.cloneNode(true);
  card.querySelector('.category-badge').textContent = link.category || 'Uncategorized';
  const favorite = card.querySelector('.favorite-button');
  favorite.textContent = link.favorite ? '★' : '☆';
  favorite.classList.toggle('active', Boolean(link.favorite));
  favorite.setAttribute('aria-label', link.favorite ? `Remove ${link.title} from favorites` : `Add ${link.title} to favorites`);
  favorite.onclick = () => { link.favorite = !link.favorite; saveLinks(); };
  const anchor = card.querySelector('.card-link');
  anchor.href = link.url;
  anchor.querySelector('h2').textContent = link.title;
  anchor.querySelector('p').textContent = link.description || 'Open this link';
  card.querySelector('.domain').textContent = new URL(link.url).hostname.replace(/^www\./, '');
  card.querySelector('.edit-button').onclick = () => openLinkDialog(link);
  card.querySelector('.delete-button').onclick = () => deleteLink(link);
  return card;
}

function openLinkDialog(link = null) {
  elements.linkForm.reset();
  elements.formMessage.textContent = '';
  elements.dialogTitle.textContent = link ? 'Edit link' : 'Add link';
  elements.linkId.value = link?.id || '';
  elements.linkTitle.value = link?.title || '';
  elements.linkUrl.value = link?.url || '';
  elements.linkCategory.value = link?.category || '';
  elements.linkDescription.value = link?.description || '';
  elements.linkFavorite.checked = Boolean(link?.favorite);
  elements.linkDialog.showModal();
  elements.linkTitle.focus();
}

function deleteLink(link) {
  if (!confirm(`Delete “${link.title}”?`)) return;
  links = links.filter(item => item.id !== link.id);
  saveLinks();
}

elements.linkForm.onsubmit = event => {
  event.preventDefault();
  try {
    const item = {
      id: elements.linkId.value || crypto.randomUUID(),
      title: elements.linkTitle.value.trim(),
      url: safeUrl(elements.linkUrl.value),
      category: elements.linkCategory.value.trim(),
      description: elements.linkDescription.value.trim(),
      favorite: elements.linkFavorite.checked
    };
    const index = links.findIndex(link => link.id === item.id);
    if (index < 0) links.push(item); else links[index] = item;
    saveLinks();
    elements.linkDialog.close();
  } catch (error) { elements.formMessage.textContent = error.message; }
};

function exportLinks() {
  const blob = new Blob([JSON.stringify({ app: 'Link Deck', version: 1, exportedAt: new Date().toISOString(), links }, null, 2)], { type: 'application/json' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `link-deck-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

async function importLinks(file) {
  const data = JSON.parse(await file.text());
  if (!data || !Array.isArray(data.links)) throw new Error('This is not a valid Link Deck backup.');
  const imported = data.links.map(item => ({
    id: item.id || crypto.randomUUID(), title: String(item.title || '').trim(), url: safeUrl(String(item.url || '')),
    category: String(item.category || '').trim(), description: String(item.description || '').trim(), favorite: Boolean(item.favorite)
  })).filter(item => item.title);
  if (!confirm(`Replace your current links with ${imported.length} imported ${imported.length === 1 ? 'link' : 'links'}?`)) return;
  links = imported;
  saveLinks();
  elements.dataMessage.textContent = 'Backup restored.';
}

elements.addButton.onclick = elements.emptyAddButton.onclick = () => openLinkDialog();
elements.cancelButton.onclick = elements.closeDialogButton.onclick = () => elements.linkDialog.close();
elements.dataButton.onclick = () => { elements.dataMessage.textContent = ''; elements.dataDialog.showModal(); };
elements.closeDataButton.onclick = () => elements.dataDialog.close();
elements.exportButton.onclick = exportLinks;
elements.importInput.onchange = async () => {
  try { if (elements.importInput.files[0]) await importLinks(elements.importInput.files[0]); }
  catch (error) { elements.dataMessage.textContent = error.message; }
  finally { elements.importInput.value = ''; }
};
[elements.searchInput, elements.categoryFilter, elements.favoritesOnly].forEach(control => control.addEventListener('input', render));
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; elements.installButton.hidden = false; });
elements.installButton.onclick = async () => { if (installPrompt) await installPrompt.prompt(); installPrompt = null; elements.installButton.hidden = true; };
window.addEventListener('appinstalled', () => { installPrompt = null; elements.installButton.hidden = true; });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js'));
render();
