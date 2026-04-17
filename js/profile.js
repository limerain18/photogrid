/**
 * profile.js — My Profile page logic
 * Imports shared utilities from app.js
 */

import { getInitials, colorFromName, showToast, getCurrentUser } from './app.js';

const PROFILE_KEY = 'photogrid_profile';

function loadProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; }
  catch { return {}; }
}
function saveProfileData(p) { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); }

function renderProfileHeader() {
  const name = getCurrentUser();
  const p    = loadProfile();

  const displayName = name || 'Your Profile';
  document.getElementById('profileName').textContent = displayName;
  if(p.bio) document.getElementById('profileBio').textContent = p.bio;

  const av = document.getElementById('profileAvatar');
  av.textContent = getInitials(displayName);
  av.style.background = colorFromName(displayName);
  av.style.fontSize = '1.5rem';
  av.style.color = '#fff';
  av.style.display = 'flex';
  av.style.alignItems = 'center';
  av.style.justifyContent = 'center';

  // Pre-fill edit form
  const ei = document.getElementById('editName');
  const eb = document.getElementById('editBio');
  if(ei) ei.value = name || '';
  if(eb) eb.value = p.bio || '';
}

// Edit profile modal
document.getElementById('editProfileBtn')?.addEventListener('click', () => {
  document.getElementById('editModal').classList.add('open');
  document.body.style.overflow = 'hidden';
});
document.getElementById('closeEditModal')?.addEventListener('click', () => {
  document.getElementById('editModal').classList.remove('open');
  document.body.style.overflow = '';
});
document.getElementById('editModal')?.addEventListener('click', e => {
  if(e.target===e.currentTarget){
    e.currentTarget.classList.remove('open');
    document.body.style.overflow='';
  }
});
document.getElementById('saveProfileBtn')?.addEventListener('click', () => {
  const name = document.getElementById('editName')?.value.trim();
  const bio  = document.getElementById('editBio')?.value.trim();
  if(!name){ showToast('Please enter a name.'); return; }

  localStorage.setItem('pg_username', name);
  saveProfileData({ bio });

  document.getElementById('editModal').classList.remove('open');
  document.body.style.overflow = '';
  renderProfileHeader();
  loadMyPosts();
  showToast('Profile updated!');
});

// ── Load my posts via Firebase ──────────────────────
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// Reuse existing app if already initialized
function getDB() {
  // app.js already initialized Firebase; grab the existing instance
  const apps = getApps();
  if(apps.length === 0) return null;
  return getDatabase(apps[0]);
}

function createCard(post, key) {
  // Minimal card for profile (no filter, always owner so show delete)
  const card = document.createElement('div');
  card.className = 'photo-card';
  card.dataset.key = key;

  card.innerHTML = `
    <img src="${post.src}" alt="" loading="lazy"/>
    <button class="card-delete-btn" title="Delete post">🗑</button>
    <div class="card-body">
      <div class="card-meta">
        <div class="avatar" style="background:${colorFromName(post.user)}">${getInitials(post.user)}</div>
        <span class="card-user">${post.user||'Anonymous'}</span>
        <span class="card-date">${new Date(post.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
      </div>
      ${post.caption ? `<p class="card-caption">${post.caption}</p>` : ''}
      <div class="card-footer">
        <span style="font-size:0.82rem;color:var(--text-muted)">♥ ${Object.keys(post.likedBy||{}).length}</span>
      </div>
    </div>`;

  card.querySelector('.card-delete-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    openDeleteConfirm(key);
  });

  return card;
}

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
document.getElementById('confirmDelete')?.addEventListener('click', async () => {
  if(!pendingDeleteKey) return;
  const key = pendingDeleteKey; pendingDeleteKey = null;
  document.getElementById('deleteModal').classList.remove('open');
  document.body.style.overflow = '';

  const db2 = getDB();
  if(db2) {
    const { remove } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
    await remove(ref(db2, `posts/${key}`));
  } else {
    // local fallback
    const LOCAL_KEY = 'photogrid_posts_local';
    const posts = JSON.parse(localStorage.getItem(LOCAL_KEY)||'[]').filter(p=>p.id!==key);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(posts));
    loadMyPosts();
  }
  showToast('Post deleted.');
});

function loadMyPosts() {
  const name = getCurrentUser();
  const grid  = document.getElementById('myGrid');
  const empty = document.getElementById('myEmptyState');
  const load  = document.getElementById('myLoading');

  if(!name) {
    if(load) load.style.display='none';
    if(empty){ empty.style.display='block'; empty.querySelector('p').textContent='Set a name to track your posts.'; }
    return;
  }

  const db2 = getDB();
  if(!db2) {
    // local fallback
    const posts = JSON.parse(localStorage.getItem('photogrid_posts_local')||'[]')
      .filter(p=>p.user===name);
    renderMyGrid(posts.map(p=>({key:p.id,data:p})));
    return;
  }

  const postsRef = ref(db2, 'posts');
  onValue(postsRef, snap => {
    const val = snap.val()||{};
    const mine = Object.entries(val)
      .filter(([,d])=>d.user===name)
      .map(([key,data])=>({key,data}))
      .sort((a,b)=>new Date(a.data.date)-new Date(b.data.date));
    renderMyGrid(mine);
  });
}

function renderMyGrid(posts) {
  const grid  = document.getElementById('myGrid');
  const empty = document.getElementById('myEmptyState');
  const load  = document.getElementById('myLoading');

  if(load) load.style.display='none';
  if(!grid) return;
  grid.innerHTML = '';

  if(posts.length===0) {
    if(empty) empty.style.display='block';
    document.getElementById('statPosts').textContent='0';
    document.getElementById('statLikes').textContent='0';
    return;
  }
  if(empty) empty.style.display='none';

  let totalLikes=0;
  [...posts].reverse().forEach(({key,data})=>{
    totalLikes += Object.keys(data.likedBy||{}).length;
    grid.appendChild(createCard(data,key));
  });
  document.getElementById('statPosts').textContent=posts.length;
  document.getElementById('statLikes').textContent=totalLikes;
}

// ── Init ──────────────────────────────────────────────
renderProfileHeader();
loadMyPosts();
