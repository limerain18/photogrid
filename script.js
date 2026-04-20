/**
 * PhotoGrid — app.js
 * Uses Firebase Realtime Database for real-time shared posts.
 * Images are stored as base64 in the DB (fine for small galleries).
 *
 * SETUP REQUIRED — see README.md:
 *   1. Create a Firebase project at https://console.firebase.google.com
 *   2. Replace the firebaseConfig values below
 *   3. Enable "Realtime Database" and set rules to allow read/write (dev mode)
 */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ─────────────────────────────────────────────
//  🔥 REPLACE WITH YOUR FIREBASE CONFIG
// ─────────────────────────────────────────────
const SUPABASE_URL = "https://qaocsknhjnmqpgnrursm.supabase.co/";
const SUPABASE_KEY = "sb_publishable_XsMY_U9QPznyfufjHzA_9Q_A96jiuWG";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let firebaseReady = true;

// ── Local fallback when Firebase isn't configured ──
const LOCAL_KEY = 'photogrid_posts_local';
function loadLocalPosts() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; } catch { return []; }
}
function saveLocalPosts(p) { localStorage.setItem(LOCAL_KEY, JSON.stringify(p)); }

// ── Helpers ────────────────────────────────────────
export function getInitials(name) {
  return (name||'U').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
}
export function colorFromName(name) {
  const colors = ['#c45c3e','#4e7fb5','#6b9e6b','#9b6b9b','#c8963e','#5b8ea6'];
  let h=0; for(let i=0;i<(name||'').length;i++) h+=name.charCodeAt(i);
  return colors[h%colors.length];
}
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

export function showToast(msg) {
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(()=>t.classList.remove('show'), 2800);
}

// ── Current user ───────────────────────────────────
export function getCurrentUser() {
  return localStorage.getItem('pg_username') || '';
}
function setCurrentUser(name) {
  localStorage.setItem('pg_username', name);
}

// ── Session (for likes) ────────────────────────────
function getSessionId() {
  let s = localStorage.getItem('pg_session');
  if(!s){ s=uid(); localStorage.setItem('pg_session',s); }
  return s;
}

// ── Navbar user display ────────────────────────────
function updateNavUser() {
  const name = getCurrentUser();
  const el = document.getElementById('navUser');
  const av = document.getElementById('navAvatar');
  const nm = document.getElementById('navName');
  if(!el) return;
  if(name) {
    el.style.display = 'flex';
    av.textContent = getInitials(name);
    av.style.background = colorFromName(name);
    if(nm) nm.textContent = name;
    const ui = document.getElementById('userName');
    if(ui && !ui.value) ui.value = name;
  } else {
    el.style.display = 'none';
  }
}

// ── Name setup modal ────────────────────────────────
function checkNameSetup() {
  if(!getCurrentUser()) {
    const m = document.getElementById('nameModal');
    if(m) m.classList.add('open');
  }
}
document.getElementById('saveNameBtn')?.addEventListener('click', () => {
  const n = document.getElementById('setupName')?.value.trim();
  if(!n){ showToast('Please enter a name'); return; }
  setCurrentUser(n);
  document.getElementById('nameModal').classList.remove('open');
  updateNavUser();
  showToast(`Welcome, ${n}! 👋`);
});

// ── Posts cache (for lightbox nav) ─────────────────
let cachedPosts = []; // [{firebaseKey, ...postData}]

// ── Create card DOM ─────────────────────────────────
function createCard(post, firebaseKey) {
  const isOwner = post.user === getCurrentUser();
  const liked   = (post.likedBy||{})[getSessionId()];

  const card = document.createElement('div');
  card.className = 'photo-card';
  card.dataset.key = firebaseKey;

  card.innerHTML = `
    <img src="${post.src}" alt="${escHtml(post.caption||'')}" loading="lazy"/>
    ${isOwner ? `<button class="card-delete-btn" title="Delete post">🗑</button>` : ''}
    <div class="card-body">
      <div class="card-meta">
        <div class="avatar" style="background:${colorFromName(post.user)}">${getInitials(post.user)}</div>
        <span class="card-user">${escHtml(post.user||'Anonymous')}</span>
        <span class="card-date">${formatDate(post.date)}</span>
      </div>
      ${post.caption ? `<p class="card-caption">${escHtml(post.caption)}</p>` : ''}
      <div class="card-footer">
        <button class="card-likes ${liked?'liked':''}" data-key="${firebaseKey}">
          ♥ <span>${countLikes(post.likedBy)}</span>
        </button>
      </div>
    </div>`;

  // Like
  card.querySelector('.card-likes').addEventListener('click', e => {
    e.stopPropagation();
    toggleLike(firebaseKey, post, card);
  });

  // Delete (owner only)
  card.querySelector('.card-delete-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    openDeleteConfirm(firebaseKey);
  });

  // Open lightbox
  card.querySelector('img').addEventListener('click', () => openLightbox(firebaseKey));
  card.querySelector('.card-caption')?.addEventListener('click', () => openLightbox(firebaseKey));

  return card;
}

function countLikes(likedBy) {
  if(!likedBy) return 0;
  return Object.keys(likedBy).length;
}

// ── Render grid ─────────────────────────────────────
function renderGrid(posts) {
  const grid  = document.getElementById('photoGrid');
  const empty = document.getElementById('emptyState');
  const load  = document.getElementById('loadingState');

  if(!grid) return;
  if(load) load.style.display = 'none';
  grid.innerHTML = '';

  if(posts.length === 0) {
    if(empty) empty.style.display = 'block';
    return;
  }
  if(empty) empty.style.display = 'none';

  // newest first
  [...posts].reverse().forEach(({key, data}) => grid.appendChild(createCard(data, key)));
}

// ── Firebase listener ───────────────────────────────
async function startListening() {
  const load = document.getElementById("loadingState");
  const empty = document.getElementById("emptyState");

  if (load) load.style.display = "block";

  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("date", { ascending: true });

  if (load) load.style.display = "none";

  if (error) {
    console.error("load error:", error);
    if (empty) empty.style.display = "block";
    return;
  }

  cachedPosts = (data || []).map(post => ({
    key: String(post.id),
    data: {
      user: post.user_name,
      caption: post.caption,
      src: post.src,
      date: post.date,
      likedBy: post.liked_by || {}
    }
  }));

  renderGrid(cachedPosts);
}

// ── Toggle like ─────────────────────────────────────
async function toggleLike(key, post, card) {
  const sid = getSessionId();
  const liked = !!(post.likedBy||{})[sid];

  if(firebaseReady) {
    const likeRef = ref(db, `posts/${key}/likedBy/${sid}`);
    if(liked) {
      await remove(likeRef);
    } else {
      await update(ref(db,`posts/${key}/likedBy`), {[sid]: true});
    }
    // UI updates via onValue listener
  } else {
    // local fallback
    const posts = loadLocalPosts();
    const p = posts.find(x=>x.id===key);
    if(!p) return;
    p.likedBy = p.likedBy || {};
    if(liked) delete p.likedBy[sid]; else p.likedBy[sid]=true;
    saveLocalPosts(posts);
    const btn = card?.querySelector('.card-likes');
    if(btn) {
      btn.querySelector('span').textContent = countLikes(p.likedBy);
      btn.classList.toggle('liked', !liked);
    }
  }
}

// ── Delete ──────────────────────────────────────────
let pendingDeleteKey = null;

function openDeleteConfirm(key) {
  pendingDeleteKey = key;
  document.getElementById('deleteModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

document.getElementById('cancelDelete')?.addEventListener('click', () => {
  pendingDeleteKey = null;
  document.getElementById('deleteModal').classList.remove('open');
  document.body.style.overflow = '';
});
document.getElementById('deleteModal')?.addEventListener('click', e => {
  if(e.target===e.currentTarget){
    pendingDeleteKey=null;
    e.currentTarget.classList.remove('open');
    document.body.style.overflow='';
  }
});
document.getElementById('confirmDelete')?.addEventListener('click', async () => {
  if(!pendingDeleteKey) return;
  const key = pendingDeleteKey;
  pendingDeleteKey = null;
  document.getElementById('deleteModal').classList.remove('open');

  // Close lightbox if open for this post
  const lb = document.getElementById('lightbox');
  if(lb.classList.contains('open') && document.getElementById('lightboxImg').dataset.key===key) {
    lb.classList.remove('open');
  }
  document.body.style.overflow = '';

  if(firebaseReady) {
    await remove(ref(db, `posts/${key}`));
  } else {
    const posts = loadLocalPosts().filter(p=>p.id!==key);
    saveLocalPosts(posts);
    cachedPosts = cachedPosts.filter(p=>p.key!==key);
    renderGrid(cachedPosts);
  }
  showToast('Post deleted.');
});

// ── Upload modal ─────────────────────────────────────
let selectedFiles = [];

function openModal() {
  if(!getCurrentUser()) { checkNameSetup(); return; }
  document.getElementById('uploadModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  document.getElementById('uploadModal').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('openUploadModal')?.addEventListener('click', openModal);
document.getElementById('openUploadModalHero')?.addEventListener('click', openModal);
document.getElementById('closeModal')?.addEventListener('click', closeModal);
document.getElementById('uploadModal')?.addEventListener('click', e => {
  if(e.target===e.currentTarget) closeModal();
});

document.getElementById('browseBtn')?.addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('dropZone')?.addEventListener('click', e => {
  if(e.target.closest('.btn-browse')) return;
  document.getElementById('fileInput').click();
});
document.getElementById('fileInput')?.addEventListener('change', e => {
  handleFiles(Array.from(e.target.files));
});

const dz = document.getElementById('dropZone');
if(dz) {
  dz.addEventListener('dragover', e=>{ e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', ()=>dz.classList.remove('dragover'));
  dz.addEventListener('drop', e=>{
    e.preventDefault(); dz.classList.remove('dragover');
    handleFiles(Array.from(e.dataTransfer.files).filter(f=>f.type.startsWith('image/')));
  });
}

function handleFiles(files) {
  files.forEach(file => {
    if(file.size > 5*1024*1024){ showToast('File too large (max 5MB)'); return; }
    if(!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ev => {
      selectedFiles.push({file, src: ev.target.result});
      renderPreviews();
    };
    reader.readAsDataURL(file);
  });
}

function renderPreviews() {
  const c = document.getElementById('previewContainer');
  if(!c) return;
  c.innerHTML = '';
  selectedFiles.forEach((item,i) => {
    const t = document.createElement('div');
    t.className = 'preview-thumb';
    t.innerHTML = `<img src="${item.src}" alt=""/><button class="remove-thumb" data-i="${i}">&times;</button>`;
    t.querySelector('.remove-thumb').addEventListener('click', ()=>{ selectedFiles.splice(i,1); renderPreviews(); });
    c.appendChild(t);
  });
}

document.getElementById('postBtn')?.addEventListener('click', submitPost);

async function submitPost() {
  const userName =
    document.getElementById('userName')?.value.trim() ||
    getCurrentUser() ||
    'Anonymous';

  const caption =
    document.getElementById('caption')?.value.trim() || '';

  if (selectedFiles.length === 0) {
    showToast('Please select at least one photo!');
    return;
  }

  const btn = document.getElementById('postBtn');
  btn.disabled = true;
  btn.textContent = 'Posting…';

  if (userName !== getCurrentUser()) {
    setCurrentUser(userName);
  }

  for (const item of selectedFiles) {
    const fileName = `${Date.now()}-${item.file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('posts')
      .upload(fileName, item.file);

    if (uploadError) {
      console.error('upload error:', uploadError);
      continue;
    }

    const { data: publicData } = supabase.storage
      .from('posts')
      .getPublicUrl(fileName);

    const post = {
      user_name: userName,
      caption: caption,
      src: publicData.publicUrl,
      date: new Date().toISOString(),
      liked_by: {}
    };

    const { error: insertError } = await supabase
      .from('posts')
      .insert(post);

    if (insertError) {
      console.error('insert error:', insertError);
    }
  }

  await startListening();

  selectedFiles = [];
  document.getElementById('previewContainer').innerHTML = '';
  document.getElementById('caption').value = '';
  document.getElementById('fileInput').value = '';

  btn.disabled = false;
  btn.textContent = 'Post Photo';

  closeModal();
  updateNavUser();
  showToast('✓ Photo posted!');
}

  selectedFiles = [];
  document.getElementById('previewContainer').innerHTML = '';
  document.getElementById('caption').value = '';
  document.getElementById('fileInput').value = '';
  btn.disabled = false; btn.textContent = 'Post Photo';

  closeModal();
  updateNavUser();
  showToast('✓ Photo posted!');


// ── Lightbox ─────────────────────────────────────────
let lbIndex = 0;

function getDisplayedPosts() {
  return [...cachedPosts].reverse();
}

function openLightbox(key) {
  const displayed = getDisplayedPosts();
  lbIndex = displayed.findIndex(p=>p.key===key);
  if(lbIndex===-1) return;
  renderLightbox(displayed);
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function renderLightbox(displayed) {
  displayed = displayed || getDisplayedPosts();
  const {key, data: post} = displayed[lbIndex];

  document.getElementById('lightboxImg').src = post.src;
  document.getElementById('lightboxImg').dataset.key = key;

  const color = colorFromName(post.user);
  const av = document.getElementById('lightboxAvatar');
  av.textContent = getInitials(post.user);
  av.style.background = color;

  document.getElementById('lightboxUser').textContent = post.user||'Anonymous';
  document.getElementById('lightboxDate').textContent = formatDate(post.date);
  document.getElementById('lightboxCaption').textContent = post.caption||'';

  const sid = getSessionId();
  const liked = !!(post.likedBy||{})[sid];
  document.getElementById('likeCount').textContent = countLikes(post.likedBy);
  document.getElementById('lightboxLike').className = 'like-btn'+(liked?' liked':'');

  // Show delete only for owner
  const delBtn = document.getElementById('lightboxDeleteBtn');
  if(delBtn) delBtn.style.display = (post.user===getCurrentUser()) ? '' : 'none';

  document.getElementById('lightboxPrev').style.display = lbIndex > 0 ? '' : 'none';
  document.getElementById('lightboxNext').style.display = lbIndex < displayed.length-1 ? '' : 'none';
}

document.getElementById('lightboxClose')?.addEventListener('click', ()=>{
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow='';
});
document.getElementById('lightbox')?.addEventListener('click', e=>{
  if(e.target===e.currentTarget){
    e.currentTarget.classList.remove('open');
    document.body.style.overflow='';
  }
});
document.getElementById('lightboxPrev')?.addEventListener('click', ()=>{
  if(lbIndex>0){ lbIndex--; renderLightbox(); }
});
document.getElementById('lightboxNext')?.addEventListener('click', ()=>{
  const d=getDisplayedPosts();
  if(lbIndex<d.length-1){ lbIndex++; renderLightbox(); }
});
document.getElementById('lightboxLike')?.addEventListener('click', ()=>{
  const key = document.getElementById('lightboxImg').dataset.key;
  const p = cachedPosts.find(x=>x.key===key);
  if(p) toggleLike(key, p.data, null);
});
document.getElementById('lightboxDeleteBtn')?.addEventListener('click', ()=>{
  const key = document.getElementById('lightboxImg').dataset.key;
  openDeleteConfirm(key);
});

document.addEventListener('keydown', e=>{
  const lb = document.getElementById('lightbox');
  if(!lb.classList.contains('open')) return;
  if(e.key==='Escape'){ lb.classList.remove('open'); document.body.style.overflow=''; }
  const d=getDisplayedPosts();
  if(e.key==='ArrowLeft'&&lbIndex>0){ lbIndex--; renderLightbox(d); }
  if(e.key==='ArrowRight'&&lbIndex<d.length-1){ lbIndex++; renderLightbox(d); }
});

// ── Hamburger ────────────────────────────────────────
document.getElementById('hamburger')?.addEventListener('click', ()=>{
  document.querySelector('.nav-links')?.classList.toggle('open');
});

// ── Init ─────────────────────────────────────────────
checkNameSetup();
updateNavUser();
startListening();
