const STORAGE_KEY = 'link-deck-links-v1';
const TABLE_NAME = 'link_deck_links';
const config = window.LINK_DECK_CONFIG;
const db = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
const elements = Object.fromEntries([
  'addButton','emptyAddButton','searchInput','categoryFilter','favoritesOnly','dataButton','linkGrid','emptyState','emptyMessage','resultCount',
  'linkDialog','linkForm','dialogTitle','linkId','linkTitle','linkUrl','linkCategory','linkDescription','linkFavorite','categorySuggestions','formMessage','closeDialogButton','cancelButton',
  'dataDialog','closeDataButton','exportButton','importInput','dataMessage','linkCardTemplate','installButton',
  'authDialog','authForm','authEmail','authPassword','authMessage','signUpButton','signInButton','signOutButton','userEmail','mobileDataButton'
].map(id => [id, document.getElementById(id)]));
let links = [], currentUser = null, installPrompt = null;

function legacyLinks() {
  try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(value) ? value.filter(x => x?.id && x?.title && x?.url) : []; }
  catch { return []; }
}
function toRow(link) { return { id: link.id, user_id: currentUser.id, title: link.title, url: link.url, category: link.category || '', description: link.description || '', favorite: !!link.favorite, updated_at: new Date().toISOString() }; }
function fromRow(row) { return { id: row.id, title: row.title, url: row.url, category: row.category || '', description: row.description || '', favorite: !!row.favorite }; }
function safeUrl(value) {
  const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  const parsed = new URL(candidate);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Enter an HTTP or HTTPS address.');
  return parsed.href;
}
async function loadRemote() {
  const { data, error } = await db.from(TABLE_NAME).select('id,title,url,category,description,favorite').order('title');
  if (error) throw error; links = data.map(fromRow); render();
}
async function migrateLocal() {
  const local = legacyLinks(); if (!local.length) return 0;
  const { error } = await db.from(TABLE_NAME).upsert(local.map(toRow), { onConflict: 'id' });
  if (error) throw error; localStorage.removeItem(STORAGE_KEY); return local.length;
}
async function startSession(session) {
  currentUser = session.user; elements.userEmail.textContent = currentUser.email;
  elements.userEmail.hidden = elements.signOutButton.hidden = false;
  if (elements.authDialog.open) elements.authDialog.close();
  try { const count = await migrateLocal(); await loadRemote(); if (count) alert(`${count} local ${count === 1 ? 'link was' : 'links were'} moved to Supabase.`); }
  catch (error) { showAuth(); elements.authMessage.textContent = `Could not load Link Deck: ${error.message}`; }
}
function showAuth() {
  currentUser = null; links = []; render(); elements.userEmail.hidden = elements.signOutButton.hidden = true;
  if (!elements.authDialog.open) elements.authDialog.showModal();
}
function categories() { return [...new Set(links.map(x => x.category || 'Uncategorized'))].sort((a,b) => a.localeCompare(b)); }
function visibleLinks() {
  const q = elements.searchInput.value.trim().toLowerCase();
  return links.filter(x => (!q || [x.title,x.url,x.category,x.description].some(v => (v || '').toLowerCase().includes(q))) &&
    (elements.categoryFilter.value === 'all' || (x.category || 'Uncategorized') === elements.categoryFilter.value) &&
    (!elements.favoritesOnly.checked || x.favorite)).sort((a,b) => +b.favorite - +a.favorite || a.title.localeCompare(b.title));
}
function render() {
  const selected = elements.categoryFilter.value, names = categories();
  elements.categoryFilter.replaceChildren(new Option('All categories','all'), ...names.map(x => new Option(x,x)));
  elements.categoryFilter.value = names.includes(selected) ? selected : 'all';
  elements.categorySuggestions.replaceChildren(...names.filter(x => x !== 'Uncategorized').map(x => new Option(x)));
  const shown = visibleLinks(); elements.linkGrid.replaceChildren(...shown.map(createCard));
  elements.emptyState.hidden = !currentUser || shown.length > 0;
  elements.emptyMessage.textContent = links.length ? 'Try changing your search or filters.' : 'Add your first destination to get started.';
  elements.resultCount.textContent = currentUser ? `${shown.length} ${shown.length === 1 ? 'link' : 'links'}` : '';
}
function createCard(link) {
  const card = elements.linkCardTemplate.content.firstElementChild.cloneNode(true);
  card.querySelector('.category-badge').textContent = link.category || 'Uncategorized';
  const fav = card.querySelector('.favorite-button'); fav.textContent = link.favorite ? '★' : '☆'; fav.classList.toggle('active', link.favorite);
  fav.setAttribute('aria-label', link.favorite ? `Remove ${link.title} from favorites` : `Add ${link.title} to favorites`);
  fav.onclick = async () => { const old = link.favorite; link.favorite = !old; render(); const { error } = await db.from(TABLE_NAME).update({favorite:link.favorite,updated_at:new Date().toISOString()}).eq('id',link.id); if(error){link.favorite=old;render();alert(error.message);} };
  const anchor = card.querySelector('.card-link'); anchor.href = link.url; anchor.querySelector('h2').textContent = link.title; anchor.querySelector('p').textContent = link.description || 'Open this link';
  card.querySelector('.domain').textContent = new URL(link.url).hostname.replace(/^www\./,'');
  card.querySelector('.edit-button').onclick = () => openEditor(link); card.querySelector('.delete-button').onclick = () => deleteLink(link); return card;
}
function openEditor(link = null) {
  elements.linkForm.reset(); elements.formMessage.textContent = ''; elements.dialogTitle.textContent = link ? 'Edit link' : 'Add link';
  elements.linkId.value=link?.id||''; elements.linkTitle.value=link?.title||''; elements.linkUrl.value=link?.url||''; elements.linkCategory.value=link?.category||''; elements.linkDescription.value=link?.description||''; elements.linkFavorite.checked=!!link?.favorite;
  elements.linkDialog.showModal(); elements.linkTitle.focus();
}
async function deleteLink(link) {
  if (!confirm(`Delete “${link.title}”?`)) return; const { error } = await db.from(TABLE_NAME).delete().eq('id',link.id);
  if(error) return alert(error.message); links = links.filter(x => x.id !== link.id); render();
}
elements.linkForm.onsubmit = async event => {
  event.preventDefault(); elements.formMessage.textContent='';
  try { const item={id:elements.linkId.value||crypto.randomUUID(),title:elements.linkTitle.value.trim(),url:safeUrl(elements.linkUrl.value),category:elements.linkCategory.value.trim(),description:elements.linkDescription.value.trim(),favorite:elements.linkFavorite.checked};
    const {error}=await db.from(TABLE_NAME).upsert(toRow(item),{onConflict:'id'}); if(error) throw error;
    const i=links.findIndex(x=>x.id===item.id); if(i<0) links.push(item); else links[i]=item; render(); elements.linkDialog.close();
  } catch(error){elements.formMessage.textContent=error.message;}
};
function exportLinks(){const blob=new Blob([JSON.stringify({app:'Link Deck',version:2,exportedAt:new Date().toISOString(),links},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`link-deck-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);}
async function importLinks(file){
  const data=JSON.parse(await file.text());if(!data||!Array.isArray(data.links))throw new Error('This is not a valid Link Deck backup.');
  const incoming=data.links.map(x=>({id:x.id||crypto.randomUUID(),title:String(x.title||'').trim(),url:safeUrl(String(x.url||'')),category:String(x.category||'').trim(),description:String(x.description||'').trim(),favorite:!!x.favorite})).filter(x=>x.title);
  if(!confirm(`Replace your current links with ${incoming.length} imported ${incoming.length===1?'link':'links'}?`))return;
  const {error:removeError}=await db.from(TABLE_NAME).delete().eq('user_id',currentUser.id);if(removeError)throw removeError;
  if(incoming.length){const {error}=await db.from(TABLE_NAME).insert(incoming.map(toRow));if(error)throw error;} links=incoming;render();elements.dataMessage.textContent='Backup restored to Supabase.';
}
elements.authForm.onsubmit=async e=>{e.preventDefault();elements.authMessage.textContent='';elements.signInButton.disabled=true;const{error}=await db.auth.signInWithPassword({email:elements.authEmail.value.trim(),password:elements.authPassword.value});elements.signInButton.disabled=false;if(error)elements.authMessage.textContent=error.message;};
elements.signUpButton.onclick=async()=>{if(!elements.authForm.reportValidity())return;elements.authMessage.textContent='';elements.signUpButton.disabled=true;const{data,error}=await db.auth.signUp({email:elements.authEmail.value.trim(),password:elements.authPassword.value});elements.signUpButton.disabled=false;if(error)elements.authMessage.textContent=error.message;else if(!data.session)elements.authMessage.textContent='Check your email to confirm your account, then sign in.';};
elements.signOutButton.onclick=()=>db.auth.signOut(); elements.addButton.onclick=elements.emptyAddButton.onclick=()=>openEditor();
elements.authDialog.addEventListener('cancel', event => event.preventDefault());
elements.cancelButton.onclick=elements.closeDialogButton.onclick=()=>elements.linkDialog.close();
elements.dataButton.onclick=elements.mobileDataButton.onclick=()=>{elements.dataMessage.textContent='';elements.dataDialog.showModal();}; elements.closeDataButton.onclick=()=>elements.dataDialog.close(); elements.exportButton.onclick=exportLinks;
elements.importInput.onchange=async()=>{try{if(elements.importInput.files[0])await importLinks(elements.importInput.files[0]);}catch(error){elements.dataMessage.textContent=error.message;}finally{elements.importInput.value='';}};
[elements.searchInput,elements.categoryFilter,elements.favoritesOnly].forEach(x=>x.addEventListener('input',render));
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;elements.installButton.hidden=false;}); elements.installButton.onclick=async()=>{if(installPrompt)await installPrompt.prompt();installPrompt=null;elements.installButton.hidden=true;};
db.auth.onAuthStateChange((event,session)=>setTimeout(()=>{if(session&&(!currentUser||currentUser.id!==session.user.id))startSession(session);else if(!session)showAuth();},0));
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js')); render();
