# 📷 PhotoGrid — Real-Time Photo Gallery

A shared, real-time photo gallery. Every user who visits the site can **see each other's photos live** via Firebase Realtime Database.

---

## ✨ Features

| Feature | Details |
|---|---|
| 📤 Upload photos | Drag & drop or browse — JPG, PNG, GIF, WEBP up to 5MB |
| 🗑 Delete posts | Your own posts show a trash button (card + lightbox) |
| 👁 See all users | The Live Feed shows everyone's posts in real time |
| ♥ Likes | Like any photo — count updates live for everyone |
| 🔭 Lightbox | Full-screen viewer with ← → keyboard nav |
| 👤 Profile page | See your own posts, total likes, edit your name/bio |
| 📱 Responsive | Mobile-friendly masonry grid |

---

## 🔥 Step 1 — Set Up Firebase (required for shared posts)

**Why Firebase?** Since this is a static site (no server), Firebase provides a free real-time database so all users see each other's photos.

### A. Create a Firebase project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → give it a name → Continue
3. Disable Google Analytics (optional) → **Create project**

### B. Create a Realtime Database

1. In the sidebar: **Build → Realtime Database**
2. Click **Create Database**
3. Choose a region (any is fine)
4. Select **"Start in test mode"** → Enable
   > ⚠️ Test mode allows open read/write for 30 days. For production, set proper rules.

### C. Get your config

1. Go to **Project Settings** (gear icon ⚙️)
2. Scroll to **"Your apps"** → click **</>** (Web)
3. Register app with a nickname → **Register app**
4. Copy the `firebaseConfig` object shown

### D. Paste config into the code

Open `js/app.js` and replace the placeholder at the top:

```javascript
const firebaseConfig = {
  apiKey:            "AIzaSy...",          // ← paste your values
  authDomain:        "my-project.firebaseapp.com",
  databaseURL:       "https://my-project-default-rtdb.firebaseio.com",
  projectId:         "my-project",
  storageBucket:     "my-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123:web:abc123"
};
```

---

## 🚀 Step 2 — Deploy to GitHub Pages (free hosting)

### Option A — GitHub website (no terminal needed)

1. Go to [https://github.com/new](https://github.com/new) and create a new **public** repo
2. Click **"uploading an existing file"** and drag in all the project files
3. Commit the files
4. Go to **Settings → Pages**
5. Under Source: select **Deploy from a branch** → `main` → `/ (root)`
6. Click **Save**

Your site goes live at:
```
https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/
```

### Option B — Git CLI

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/REPO.git
git branch -M main
git push -u origin main
# Then enable Pages in repo Settings → Pages
```

---

## 📁 File Structure

```
photogrid/
├── index.html          ← Live feed (main page)
├── profile.html        ← My posts & profile
├── css/
│   └── style.css       ← All styles
├── js/
│   ├── app.js          ← Firebase, upload, grid, lightbox, delete, likes
│   └── profile.js      ← Profile page logic
└── README.md
```

---

## 🧑‍💻 How "See Other Users' Posts" Works

- When someone visits the site, they pick a **display name** (stored in their browser)
- Every photo they upload is saved to **Firebase** with their name
- Firebase sends all posts to **every visitor in real time**
- You can see who posted by their name and avatar on each card
- The **Live Feed** shows all users' posts, newest first

---

## 🔒 Database Rules (for production)

Once you're done testing, update Firebase Realtime Database rules to:

```json
{
  "rules": {
    "posts": {
      ".read": true,
      ".write": true,
      "$postId": {
        ".validate": "newData.hasChildren(['user','src','date'])"
      }
    }
  }
}
```

For real auth-based deletion (so only the original poster can delete), connect Firebase Authentication.

---

## 📝 Notes

- Images are stored as **base64 strings** in the database. This works well for small galleries but may hit Firebase's free tier limits for large/many images. For bigger sites, use [Cloudinary](https://cloudinary.com) or [Firebase Storage](https://firebase.google.com/docs/storage) instead.
- The **delete button** only appears on cards/lightbox for posts matching your current display name.
- Works offline in local mode (posts saved to browser) until Firebase is configured.
