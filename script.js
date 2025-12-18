// Import Firebase SDK via CDN (Browser Friendly)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, updateDoc, doc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// ============================================
// 🔐 YOUR FIREBASE CONFIGURATION
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyCCYY7jmpf4JBv0IfI5jeQu9hzbWRv08YY",
  authDomain: "echos-app-ff170.firebaseapp.com",
  projectId: "echos-app-ff170",
  storageBucket: "echos-app-ff170.firebasestorage.app",
  messagingSenderId: "200506270612",
  appId: "1:200506270612:web:89ace360d3a33cf41ee581",
  measurementId: "G-V7KJCTCQEQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ============================================
// 📱 APP LOGIC STARTS HERE
// ============================================

// State
let user = null;
let selectedTag = "General";

// DOM Elements
const views = {
    login: document.getElementById('login-screen'),
    app: document.getElementById('app-ui'),
    create: document.getElementById('create-view')
};

// 1. Auth Listener (Check if user is logged in)
onAuthStateChanged(auth, (u) => {
    if (u) {
        user = u;
        // Show App, Hide Login
        views.login.classList.add('hidden');
        views.app.classList.remove('hidden');
        
        // Set Header Avatar
        const avatarEl = document.getElementById('user-avatar');
        if(avatarEl) avatarEl.innerHTML = `<img src="${u.photoURL}" class="w-full h-full object-cover">`;
        
        // Load Posts
        loadFeed();
    } else {
        // Show Login, Hide App
        views.login.classList.remove('hidden');
        views.app.classList.add('hidden');
    }
});

// 2. Login Action
const loginBtn = document.getElementById('google-btn');
if(loginBtn) {
    loginBtn.onclick = () => {
        signInWithPopup(auth, provider).catch((error) => {
            alert("Login Failed: " + error.message);
            console.error(error);
        });
    };
}

// 3. Logout Action
window.logoutUser = () => signOut(auth);

// 4. Create Post Modal Logic
window.openCreate = () => views.create.classList.remove('hidden');
const closeBtn = document.getElementById('close-create');
if(closeBtn) closeBtn.onclick = () => views.create.classList.add('hidden');

// 5. Tag Selection Logic
document.querySelectorAll('.tag-select').forEach(btn => {
    btn.onclick = () => {
        // Reset styles
        document.querySelectorAll('.tag-select').forEach(b => {
            b.classList.remove('tag-active', 'bg-indigo-600', 'text-white');
            b.classList.add('bg-indigo-50', 'text-gray-500'); // Reset to default
        });
        
        // Set active style
        btn.classList.remove('bg-indigo-50', 'text-gray-500');
        btn.classList.add('tag-active', 'bg-indigo-600', 'text-white');
        
        selectedTag = btn.dataset.tag;
    };
});

// 6. Publish Post Logic
const pubBtn = document.getElementById('publish-btn');
if(pubBtn) {
    pubBtn.onclick = async () => {
        const inputVal = document.getElementById('post-input');
        const txt = inputVal.value.trim();
        
        if (!txt) return alert("Please write something!");
        if (!user) return alert("You are not logged in!");
        
        pubBtn.innerText = "Posting...";
        pubBtn.disabled = true;

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

            // Reset Form
            inputVal.value = "";
            views.create.classList.add('hidden');
            
        } catch (e) {
            console.error(e);
            alert("Error: " + e.message);
        }
        
        pubBtn.innerText = "Post";
        pubBtn.disabled = false;
    };
}

// 7. Feed System (Read from Database)
function loadFeed() {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50));
    
    onSnapshot(q, (snap) => {
        const container = document.getElementById('feed-container');
        if(!container) return;
        
        container.innerHTML = ""; // Clear list

        if (snap.empty) {
            container.innerHTML = `<div class="p-8 text-center text-gray-400">No echoes yet. Be the first!</div>`;
            return;
        }

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const isLiked = data.likes && data.likes.includes(user.uid);
            
            const div = document.createElement('div');
            div.className = "bg-white p-4 border-b border-gray-100";
            
            // Safe content (prevent HTML injection)
            const safeText = data.text ? data.text.replace(/</g, "&lt;") : "";

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

// 8. Like Function
window.toggleLike = async (id, isLiked) => {
    if(!user) return;
    const ref = doc(db, "posts", id);
    try {
        if (isLiked) {
            await updateDoc(ref, { likes: arrayRemove(user.uid) });
        } else {
            await updateDoc(ref, { likes: arrayUnion(user.uid) });
        }
    } catch(err) {
        console.log("Like Error:", err);
    }
};

// 9. Tab Switching (Simple)
window.switchTab = (tabName) => {
    if(tabName === 'home') {
        window.scrollTo({top: 0, behavior: 'smooth'});
    }
};
