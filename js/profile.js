/**
 * profile.js — My Profile page logic
 * Imports shared utilities from app.js
 */

import { getInitials, colorFromName, showToast, getCurrentUser } from './app.js';

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://qaocsknhjnmqpgnrursm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhb2Nza25oam5tcXBnbnJ1cnNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MDEwNjQsImV4cCI6MjA5MTk3NzA2NH0.cyMSt67z82Df4g7TIfHydhVWSOheKS2NPSZYj3xNkZI";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function renderProfileHeader() {
  const name = getCurrentUser();

  const displayName = name || 'Your Profile';

  document.getElementById('profileName').textContent = displayName;

  const av = document.getElementById('profileAvatar');
  av.textContent = getInitials(displayName);
  av.style.background = colorFromName(displayName);
  av.style.fontSize = '1.5rem';
  av.style.color = '#fff';
  av.style.display = 'flex';
  av.style.alignItems = 'center';
  av.style.justifyContent = 'center';

  const ei = document.getElementById('editName');
  const eb = document.getElementById('editBio');

  if(ei) ei.value = name || '';
  if(eb) eb.value = '';
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

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

document.getElementById("saveProfileBtn")?.addEventListener("click", async () => {
  const username = localStorage.getItem("pg_username");

  if (!username) {
    showToast("Username belum ada");
    return;
  }

  const name = document.getElementById("editName").value.trim();
  const bio = document.getElementById("editBio").value.trim();

  const avatarFile = document.getElementById("editAvatar")?.files?.[0];
  const bannerFile = document.getElementById("editBanner")?.files?.[0];

  let avatarUrl = null;
  let bannerUrl = null;

  // upload avatar
  if (avatarFile) {
    const avatarName = `avatar-${username}-${Date.now()}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(avatarName, avatarFile, {
        upsert: true
      });

    if (!error) {
      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(avatarName);

      avatarUrl = data.publicUrl;
    }
  }

  // upload banner
  if (bannerFile) {
    const bannerName = `banner-${username}-${Date.now()}`;
    const { error } = await supabase.storage
      .from("banners")
      .upload(bannerName, bannerFile, {
        upsert: true
      });

    if (!error) {
      const { data } = supabase.storage
        .from("banners")
        .getPublicUrl(bannerName);

      bannerUrl = data.publicUrl;
    }
  }

  const payload = {
    username: username,
    display_name: name,
    bio: bio
  };

  if (avatarUrl) payload.avatar_url = avatarUrl;
  if (bannerUrl) payload.banner_url = bannerUrl;

  console.log("SAVE PAYLOAD:", payload);

  const { error: saveError } = await supabase
    .from("profiles")
    .upsert(payload, {
      onConflict: "username"
    });

    console.log("SAVE ERROR:", saveError);

  if (saveError) {
    console.error(saveError);
    showToast("Gagal save profile");
    return;
  }

  document.getElementById("editModal").classList.remove("open");

  await loadProfile();

  showToast("Profile updated");
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

async function loadProfile() {
  const username = localStorage.getItem("pg_username");

  if (!username) return;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("LOAD PROFILE ERROR:", error);
    return;
  }

  if (!data) {
    document.getElementById("profileName").textContent = username;
    document.getElementById("profileBio").textContent =
      "Photographer & visual storyteller";
    return;
  }

  document.getElementById("profileName").textContent =
    data.display_name || username;

  document.getElementById("profileBio").textContent =
    data.bio || "Photographer & visual storyteller";

  const avatar = document.getElementById("profileAvatar");
  const banner = document.querySelector(".profile-banner");

  if (data.avatar_url) {
    avatar.innerHTML = `
      <img src="${data.avatar_url}"
           style="width:100%;height:100%;object-fit:cover;border-radius:50%">
    `;
  }

  if (data.banner_url) {
    banner.style.backgroundImage = `url('${data.banner_url}')`;
    banner.style.backgroundSize = "cover";
    banner.style.backgroundPosition = "center";
  }
}

// ── Init ──────────────────────────────────────────────
renderProfileHeader();
loadProfile();
loadMyPosts();
