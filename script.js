// Import Firebase SDK via CDN (Browser Friendly)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, updateDoc, doc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// ============================================
// ✅ YOUR FIREBASE CONFIGURATION (INTEGRATED)
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
    create: document.getElementById('create-view'),
    feed: document.getElementById('feed-view'),
    profile: document.getElementById('profile-view')
};

// 1. AUTH LISTENER (Check if user is logged in)
onAuthStateChanged(auth, (u) => {
    if (u) {
        user = u;
        // Hide Login, Show App
        if(views.login) views.login.classList.add('hidden');
        if(views.app) views.app.classList.remove('hidden');
        
        // Update Profile Info everywhere
        updateUserImages(u);
        
        // Load Feed
        loadFeed();
    } else {
        // Show Login, Hide App
        if(views.login) views.login.classList.remove('hidden');
        if(views.app) views.app.classList.add('hidden');
    }
});

function updateUserImages(u) {
    const photo = u.photoURL || "https://via.placeholder.com/40";
    
    // Update Header
    const headerImg = document.getElementById('header-avatar');
    if(headerImg) headerImg.innerHTML = `<img src="${photo}" class="w-full h-full object-cover">`;
    
    // Update Bottom Nav
    const navImg = document.getElementById('nav-profile-img');
    if(navImg) navImg.src = photo;

    // Update Profile Page
    const largeImg = document.getElementById('profile-large-img');
    if(largeImg) largeImg.src = photo;
    
    const pName = document.getElementById('profile-name');
    if(pName) pName.innerText = u.displayName;
    
    const pEmail = document.getElementById('profile-email');
    if(pEmail) pEmail.innerText = u.email;
}

// 2. LOGIN & LOGOUT ACTIONS
const loginBtn = document.getElementById('google-btn');
if(loginBtn) {
    loginBtn.onclick = () => {
        signInWithPopup(auth, provider).catch((error) => {
            alert("Login Failed: " + error.message);
            console.error(error);
        });
    };
}

window.logoutUser = () => signOut(auth);

// 3. TAB NAVIGATION
window.switchTab = (tabName) => {
    // Hide all views first
    if(views.feed) views.feed.classList.add('hidden');
    if(views.profile) views.profile.classList.add('hidden');
    
    // Reset Nav Styles
    const navHome = document.getElementById('nav-home');
    const navProfileImg = document.getElementById('nav-profile-img');

    if(navHome) navHome.classList.replace('text-indigo-600', 'text-gray-400');
    if(navProfileImg) navProfileImg.classList.remove('border-indigo-600', 'border-2');

    // Show Selected View
    if(tabName === 'home') {
        if(views.feed) views.feed.classList.remove('hidden');
        if(navHome) navHome.classList.replace('text-gray-400', 'text-indigo-600');
        window.scrollTo({top: 0});
    } 
    else if (tabName === 'profile') {
        if(views.profile) views.profile.classList.remove('hidden');
        if(navProfileImg) navProfileImg.classList.add('border-indigo-600', 'border-2');
    }
};

// 4. CREATE POST MODAL LOGIC
window.openCreate = () => {
    if(views.create) views.create.classList.remove('hidden');
};

const closeCreateBtn = document.getElementById('close-create');
if(closeCreateBtn) {
    closeCreateBtn.onclick = () => {
        if(views.create) views.create.classList.add('hidden');
    };
}

// Tag Selection Logic
document.querySelectorAll('.tag-select').forEach(btn => {
    btn.onclick = () => {
        // Reset styles
        document.querySelectorAll('.tag-select').forEach(b => {
            b.classList.remove('tag-active', 'bg-indigo-600', 'text-white');
            b.classList.add('bg-indigo-50', 'text-indigo-600');
        });
        // Activate clicked
        btn.classList.remove('bg-indigo-50', 'text-indigo-600');
        btn.classList.add('tag-active', 'bg-indigo-600', 'text-white');
        selectedTag = btn.dataset.tag;
    };
});

// PUBLISH BUTTON LOGIC
const publishBtn = document.getElementById('publish-btn');
if(publishBtn) {
    publishBtn.onclick = async () => {
        const inputEl = document.getElementById('post-input');
        const txt = inputEl.value.trim();
        
        if (!txt) return alert("Please write something!");
        if (!user) return alert("You must be logged in!");
        
        publishBtn.innerText = "Posting...";
        publishBtn.disabled = true;

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

            // Success
            inputEl.value = "";
            if(views.create) views.create.classList.add('hidden');
            switchTab('home'); // Return to feed
            
        } catch (e) {
            console.error(e);
            alert("Error posting: " + e.message);
        }
        
        publishBtn.innerText = "Post";
        publishBtn.disabled = false;
    };
}

// 5. FEED SYSTEM (Real-time)
function loadFeed() {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50));
    
    onSnapshot(q, (snap) => {
        const container = document.getElementById('feed-container');
        if(!container) return;
        
        container.innerHTML = ""; // Clear list

        if (snap.empty) {
            container.innerHTML = `
                <div class="p-10 text-center text-gray-400">
                    <i class="fa-regular fa-paper-plane text-4xl mb-3 opacity-30"></i><br>
                    No echoes yet.<br>Be the first to post!
                </div>`;
            return;
        }

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const isLiked = data.likes && data.likes.includes(user.uid);
            
            // Safety Check
            const safeText = data.text ? data.text.replace(/</g, "&lt;") : "";

            const div = document.createElement('div');
            div.className = "bg-white p-4 border-b border-gray-100 animate-fade-in";
            
            div.innerHTML = `
                <div class="flex gap-3">
                    <img src="${data.photo || 'https://via.placeholder.com/40'}" class="w-10 h-10 rounded-full bg-gray-200 object-cover border border-gray-100 flex-shrink-0">
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

// 6. LIKE FUNCTION
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
        console.error("Like Error:", err);
    }
};
