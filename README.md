# Locked In - Modularized

A focus timer app with session tracking, built with modular JavaScript and localStorage + Firebase sync.

## 📁 Project Structure

```
├── index.html              (HTML shell, script references)
├── css/
│   └── style.css           (All styles extracted)
└── js/
    ├── utils.js            (No deps: formatting, DOM helpers, confetti)
    ├── storage.js          (Depends: utils. Firebase config, load/save data)
    ├── auth.js             (Depends: utils, storage. Login, signup, logout)
    ├── session.js          (Depends: utils, storage. Timer, camera, trackers)
    ├── ui.js               (Depends: utils, storage, session. Screen nav, rendering)
    ├── analytics.js        (Depends: all. Summary, insights, logs, heatmap)
    └── app.js              (Depends: all. Manual modal, app boot)
```

**Load order matters** — each file depends on earlier ones, no circular deps.

## 🚀 Quick Start

### Local Development
1. Clone/download this folder
2. Open `index.html` in a browser (works offline, uses localStorage)
3. No build step needed!

### Deploy to GitHub Pages

1. Create a repo on GitHub
2. Push these files:
   ```bash
   git init
   git add .
   git commit -m "Initial modularized Locked In"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/locked-in.git
   git push -u origin main
   ```
3. Go to **Settings → Pages → Source: Deploy from a branch**
4. Select `main` branch, `/ (root)`, and **Save**
5. Your app is live at `https://YOUR_USERNAME.github.io/locked-in/`

### Optional: Firebase Cloud Sync

To enable sign-in and cloud sync:

1. Go to **[firebase.google.com](https://firebase.google.com)** → Create Project
2. Enable **Authentication** (Google + Email/Password)
3. Create **Firestore Database** (test mode to start)
4. Get your **Web App config** from Project Settings
5. Replace `firebaseConfig` in `js/storage.js` with your keys
6. Set Firestore rules:
   ```
   match /users/{uid} {
     allow read, write: if request.auth != null && request.auth.uid == uid;
   }
   ```

(Otherwise data stays on-device only — still fully functional!)

## 📝 Making Changes

**To add a feature:**
- New util? → `js/utils.js`
- Storage logic? → `js/storage.js`
- UI rendering? → `js/ui.js`
- Analytics/heatmap? → `js/analytics.js`

**To edit styles:**
- Everything is in `css/style.css` (compacted, but readable)

## 🔧 Architecture Notes

- **No bundler** — load via simple `<script>` tags in dependency order
- **Globals shared:** `subjects`, `trackers`, `sessions`, `goals`, `$()`, `fbUser`
- **No conflicts** — each module wraps private state, exports via globals
- **Easy debugging** — DevTools Source tab shows each file separately

## 💾 Browser Storage

- **localStorage** (device-only backup)
- **Firestore** (cloud, if Firebase configured)
- **Session RAM** (timer state, draft entries)

If Firebase is offline, data still saves to localStorage and syncs when you sign in next.

---

Built with ❤️ for deep focus.
