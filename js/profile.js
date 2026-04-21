/**
 * profile.js — My Profile page logic
 * Imports shared utilities from app.js
 */

import { getInitials, colorFromName, showToast, getCurrentUser } from './app.js';

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://qaocsknhjnmqpgnrursm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhb2Nza25oam5tcXBnbnJ1cnNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MDEwNjQsImV4cCI6MjA5MTk3NzA2NH0.cyMSt67z82Df4g7TIfHydhVWSOheKS2NPSZYj3xNkZI";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

  localStorage.setItem("pg_username", username);

   await loadProfile();
   await loadMyPosts();

showToast("Profile updated");
});


async function loadMyPosts() {
  const username = localStorage.getItem("pg_username");

  if (!username) return;

  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("user_name", username)
    .order("date", { ascending: false });

  if (error) {
    console.error("LOAD POSTS ERROR:", error);
    return;
  }

  renderMyGrid(data || []);
}

function renderMyGrid(posts) {
  const grid = document.getElementById("myGrid");
  const empty = document.getElementById("myEmptyState");
  const load = document.getElementById("myLoading");

  if (load) load.style.display = "none";
  if (!grid) return;

  grid.innerHTML = "";

  if (posts.length === 0) {
    empty.style.display = "block";
    document.getElementById("statPosts").textContent = "0";
    document.getElementById("statLikes").textContent = "0";
    return;
  }

  empty.style.display = "none";

  let totalLikes = 0;

  posts.forEach((post) => {
    totalLikes += Object.keys(post.liked_by || {}).length;

    const card = document.createElement("div");
    card.className = "photo-card";

    card.innerHTML = `
      <img src="${post.src}" alt="">
      <div class="card-body">
        <p>${post.caption || ""}</p>
      </div>
    `;

    grid.appendChild(card);
  });

  document.getElementById("statPosts").textContent = posts.length;
  document.getElementById("statLikes").textContent = totalLikes;
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

  document.getElementById("editName").value =
  data.display_name || username;

  document.getElementById("editBio").value =
  data.bio || "";

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
document.addEventListener("DOMContentLoaded", async () => {
  await loadProfile();
  await loadMyPosts();
});
