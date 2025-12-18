import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, updateDoc, doc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// ============================================
// ⚠️ PASTE YOUR FIREBASE CONFIG HERE AGAIN
// ============================================
const firebaseConfig = {
  // ... Paste your config keys here ...
  apiKey: "YOUR_API_KEY", 
  // ... (Keep your existing config) ...
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// State
let user = null;
let selectedTag = "General";

// DOM Elements
const views = {
    login: document.getElementById('login-screen'),
    app: document.getElementById('app-ui'),
    create: document.getElementById('create-view'),
    feed: document.getElementById('feed-view'),
    profile: document.getElementById('profile-view')
};

// 1. AUTH LISTENER
onAuthStateChanged(auth, (u) => {
    if (u) {
        user = u;
        // Show App
        views.login.classList.add('hidden');
        views.app.classList.remove('hidden');
        
        // Update All Profile Images
        updateUserImages(u);
        
        // Load Feed
        loadFeed();
    } else {
        // Show Login
        views.login.classList.remove('hidden');
        views.app.classList.add('hidden');
    }
});

function updateUserImages(u) {
    const photo = u.photoURL || "https://via.placeholder.com/40";
    
    // Header Icon
    const headerImg = document.getElementById('header-avatar');
    if(headerImg) headerImg.innerHTML = `<img src="${photo}" class="w-full h-full object-cover">`;
    
    // Bottom Nav Icon
    const navImg = document.getElementById('nav-profile-img');
    if(navImg) navImg.src = photo;

    // Profile Page Info
    const largeImg = document.getElementById('profile-large-img');
    const pName = document.getElementById('profile-name');
    const pEmail = document.getElementById('profile-email');
    
    if(largeImg) largeImg.src = photo;
    if(pName) pName.innerText = u.displayName;
    if(pEmail) pEmail.innerText = u.email;
}

// 2. ACTIONS (Login/Logout)
const loginBtn = document.getElementById('google-btn');
if(loginBtn) loginBtn.onclick = () => signInWithPopup(auth, provider).catch(console.error);
window.logoutUser = () => signOut(auth);

// 3. NAVIGATION (Switch Tabs)
window.switchTab = (tabName) => {
    // Hide all views first
    views.feed.classList.add('hidden');
    views.profile.classList.add('hidden');
    
    // Reset Nav Colors
    document.getElementById('nav-home').classList.replace('text-indigo-600', 'text-gray-400');
    // We don't change profile text color because it's an image, but we can handle border
    document.getElementById('nav-profile-img').classList.remove('border-indigo-600', 'border-2');

    if(tabName === 'home') {
        views.feed.classList.remove('hidden');
        document.getElementById('nav-home').classList.replace('text-gray-400', 'text-indigo-600');
        window.scrollTo({top: 0});
    } 
    else if (tabName === 'profile') {
        views.profile.classList.remove('hidden');
        // Add active border to profile pic
        document.getElementById('nav-profile-img').classList.add('border-indigo-600', 'border-2');
    }
};

// 4. CREATE POST
window.openCreate = () => views.create.classList.remove('hidden');
document.getElementById('close-create').onclick = () => views.create.classList.add('hidden');

// Tag Logic
document.querySelectorAll('.tag-select').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tag-select').forEach(b => {
            b.classList.remove('tag-active', 'bg-indigo-600', 'text-white');
            b.classList.add('bg-indigo-50', 'text-indigo-600');
        });
        btn.classList.remove('bg-indigo-50', 'text-indigo-600');
        btn.classList.add('tag-active', 'bg-indigo-600', 'text-white');
        selectedTag = btn.dataset.tag;
    };
});

// Publish
document.getElementById('publish-btn').onclick = async () => {
    const txt = document.getElementById('post-input').value.trim();
    if (!txt || !user) return;
    
    const btn = document.getElementById('publish-btn');
    btn.innerText = "Posting...";
    btn.disabled = true;

    try {
        await addDoc(collection(db, "posts"), {
            text: txt,
            uid: user.uid,
            name: user.displayName,
            photo: user.photoURL,
            tag: selectedTag,
            likes: [],
            createdAt: serverTimestamp()
        });
        document.getElementById('post-input').value = "";
        views.create.classList.add('hidden');
        switchTab('home'); // Go back to home after posting
    } catch (e) {
        alert(e.message);
    }
    btn.innerText = "Post";
    btn.disabled = false;
};

// 5. FEED SYSTEM
function loadFeed() {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50));
    onSnapshot(q, (snap) => {
        const container = document.getElementById('feed-container');
        container.innerHTML = "";
        
        if(snap.empty) {
            container.innerHTML = `<div class="p-10 text-center text-gray-400">No echoes yet.</div>`;
            return;
        }

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const isLiked = data.likes && data.likes.includes(user.uid);
            // Prevent XSS
            const safeText = data.text ? data.text.replace(/</g, "&lt;") : "";

            const div = document.createElement('div');
            div.className = "bg-white p-4 border-b border-gray-100";
            div.innerHTML = `
                <div class="flex gap-3">
                    <img src="${data.photo || 'https://via.placeholder.com/40'}" class="w-10 h-10 rounded-full bg-gray-200 object-cover border border-gray-100">
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-start">
                            <span class="font-bold text-sm text-gray-900">${data.name || 'Anonymous'}</span>
                            <span class="text-[10px] uppercase font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full tracking-wide">#${data.tag || 'General'}</span>
                        </div>
                        <p class="text-gray-800 mt-1 text-[15px] whitespace-pre-wrap leading-relaxed">${safeText}</p>
                        <div class="mt-3 flex gap-4">
                            <button onclick="toggleLike('${docSnap.id}', ${isLiked})" class="flex items-center gap-1.5 text-sm transition-colors ${isLiked ? 'text-red-500 font-medium' : 'text-gray-400'}">
                                <i class="${isLiked ? 'fa-solid animate-like' : 'fa-regular'} fa-heart text-lg"></i> 
                                <span>${data.likes ? data.likes.length : 0}</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
    });
}

window.toggleLike = async (id, isLiked) => {
    if(!user) return;
    const ref = doc(db, "posts", id);
    try {
        if (isLiked) await updateDoc(ref, { likes: arrayRemove(user.uid) });
        else await updateDoc(ref, { likes: arrayUnion(user.uid) });
    } catch(err) { console.error(err); }
};
