import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, updateDoc, doc, arrayUnion, arrayRemove, deleteDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// ============================================
// ⚠️ PASTE YOUR CONFIG HERE
// ============================================
const firebaseConfig = {
   // तपाइको पुरानो config यहाँ राख्नुहोस
   apiKey: "AIzaSyCCYY7jmpf4JBv0IfI5jeQu9hzbWRv08YY",
   authDomain: "echos-app-ff170.firebaseapp.com",
   projectId: "echos-app-ff170",
   storageBucket: "echos-app-ff170.firebasestorage.app", // यो लाइन मिलेन भने फोटो जादैन
   messagingSenderId: "200506270612",
   appId: "1:200506270612:web:89ace360d3a33cf41ee581",
   measurementId: "G-V7KJCTCQEQ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// State
let user = null;
let selectedTag = "General";
let selectedImageFile = null;

// DOM Elements
const views = {
    login: document.getElementById('login-screen'),
    app: document.getElementById('app-ui'),
    create: document.getElementById('create-view'),
    feed: document.getElementById('feed-view'),
    profile: document.getElementById('profile-view')
};

// 1. AUTH & SIDEBAR INFO
onAuthStateChanged(auth, (u) => {
    if (u) {
        user = u;
        views.login.classList.add('hidden');
        views.app.classList.remove('hidden');
        updateUserUI(u);
        loadFeed();
    } else {
        views.login.classList.remove('hidden');
        views.app.classList.add('hidden');
    }
});

function updateUserUI(u) {
    const photo = u.photoURL || "https://via.placeholder.com/50";
    // Header
    document.getElementById('header-avatar').innerHTML = `<img src="${photo}" class="w-full h-full object-cover">`;
    // Sidebar
    document.getElementById('sidebar-img').src = photo;
    document.getElementById('sidebar-name').innerText = u.displayName;
    document.getElementById('sidebar-email').innerText = u.email;
    // Profile
    document.getElementById('profile-large-img').src = photo;
    document.getElementById('profile-name').innerText = u.displayName;
    document.getElementById('profile-email').innerText = u.email;
}

// 2. SIDEBAR LOGIC
window.toggleSidebar = () => {
    const sb = document.getElementById('app-sidebar');
    const ov = document.getElementById('sidebar-overlay');
    if (sb.classList.contains('-translate-x-full')) {
        sb.classList.remove('-translate-x-full');
        ov.classList.remove('hidden');
    } else {
        sb.classList.add('-translate-x-full');
        ov.classList.add('hidden');
    }
};

// 3. NAVIGATION
window.switchTab = (tab) => {
    views.feed.classList.add('hidden');
    views.profile.classList.add('hidden');
    if(tab === 'home') views.feed.classList.remove('hidden');
    if(tab === 'profile') views.profile.classList.remove('hidden');
};

// 4. IMAGE PREVIEW (CREATE POST)
document.getElementById('post-image-upload').onchange = (e) => {
    const file = e.target.files[0];
    if(file){
        selectedImageFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('image-preview').src = e.target.result;
            document.getElementById('image-preview-container').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
};
window.removeImage = () => {
    selectedImageFile = null;
    document.getElementById('post-image-upload').value = "";
    document.getElementById('image-preview-container').classList.add('hidden');
};

// 5. CREATE POST (With Image Upload)
window.openCreate = () => views.create.classList.remove('hidden');
document.getElementById('close-create').onclick = () => views.create.classList.add('hidden');

document.getElementById('publish-btn').onclick = async () => {
    const txt = document.getElementById('post-input').value.trim();
    if (!txt && !selectedImageFile) return alert("Write something or add a photo!");
    
    const btn = document.getElementById('publish-btn');
    btn.innerText = "Posting...";
    btn.disabled = true;

    try {
        let imageUrl = null;
        
        // Upload Image if exists
        if(selectedImageFile) {
            const imgRef = ref(storage, `posts/${user.uid}/${Date.now()}`);
            await uploadBytes(imgRef, selectedImageFile);
            imageUrl = await getDownloadURL(imgRef);
        }

        await addDoc(collection(db, "posts"), {
            text: txt,
            imageUrl: imageUrl,
            uid: user.uid,
            name: user.displayName,
            photo: user.photoURL,
            tag: selectedTag,
            likes: [],
            createdAt: serverTimestamp()
        });
        
        // Reset
        document.getElementById('post-input').value = "";
        removeImage();
        views.create.classList.add('hidden');
        switchTab('home');

    } catch (e) {
        alert("Error: " + e.message);
        console.error(e);
    }
    btn.innerText = "Post";
    btn.disabled = false;
};

// 6. PROFILE PICTURE UPLOAD
document.getElementById('profile-upload').onchange = async (e) => {
    const file = e.target.files[0];
    if(!file) return;

    if(!confirm("Change profile picture?")) return;

    try {
        const storageRef = ref(storage, `profiles/${user.uid}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        // Update Firebase Auth
        await updateProfile(user, { photoURL: url });
        
        // Update UI
        updateUserUI(user);
        alert("Profile updated! Restart app to see changes everywhere.");
        
    } catch(err) {
        alert("Upload Failed: " + err.message);
    }
};

// 7. FEED SYSTEM (With Delete & Share)
function loadFeed() {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50));
    onSnapshot(q, (snap) => {
        const container = document.getElementById('feed-container');
        container.innerHTML = "";
        
        let myCount = 0;

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const isLiked = data.likes && data.likes.includes(user.uid);
            const isMyPost = data.uid === user.uid;
            if(isMyPost) myCount++;

            const div = document.createElement('div');
            div.className = "bg-white p-4 border-b border-gray-100 mb-2 shadow-sm";
            
            // Delete Button Logic
            const deleteBtn = isMyPost ? 
                `<button onclick="deletePost('${docSnap.id}')" class="text-gray-400 hover:text-red-500"><i class="fa-solid fa-trash"></i></button>` : '';

            // Image Logic
            const postImage = data.imageUrl ? 
                `<img src="${data.imageUrl}" class="w-full h-auto rounded-xl mt-3 border border-gray-100" loading="lazy" onclick="viewImage('${data.imageUrl}')">` : '';

            div.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div class="flex gap-3">
                        <img src="${data.photo || 'https://via.placeholder.com/40'}" class="w-10 h-10 rounded-full bg-gray-200 object-cover border">
                        <div>
                            <h4 class="font-bold text-sm text-gray-900">${data.name}</h4>
                            <span class="text-xs text-indigo-500">#${data.tag || 'General'}</span>
                        </div>
                    </div>
                    ${deleteBtn}
                </div>
                
                <p class="text-gray-800 text-[15px] whitespace-pre-wrap leading-relaxed">${data.text || ''}</p>
                ${postImage}
                
                <div class="mt-4 flex items-center justify-between border-t border-gray-50 pt-3">
                    <div class="flex gap-6">
                        <button onclick="toggleLike('${docSnap.id}', ${isLiked})" class="flex items-center gap-2 text-sm ${isLiked ? 'text-red-500' : 'text-gray-500'}">
                            <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart text-lg"></i> 
                            <span>${data.likes ? data.likes.length : 0}</span>
                        </button>
                        <button class="flex items-center gap-2 text-sm text-gray-500">
                            <i class="fa-regular fa-comment text-lg"></i> 
                            <span>0</span>
                        </button>
                    </div>
                    <button onclick="sharePost('${data.text}')" class="text-gray-500">
                        <i class="fa-solid fa-share-nodes text-lg"></i>
                    </button>
                </div>
            `;
            container.appendChild(div);
        });
        
        // Update Post Count in Profile
        const countEl = document.getElementById('my-post-count');
        if(countEl) countEl.innerText = myCount;
    });
}

// 8. ACTIONS
window.toggleLike = async (id, isLiked) => {
    const ref = doc(db, "posts", id);
    if (isLiked) await updateDoc(ref, { likes: arrayRemove(user.uid) });
    else await updateDoc(ref, { likes: arrayUnion(user.uid) });
};

window.deletePost = async (id) => {
    if(confirm("Are you sure you want to delete this post?")) {
        await deleteDoc(doc(db, "posts", id));
    }
};

window.sharePost = (text) => {
    if (navigator.share) {
        navigator.share({
            title: 'Check this on Echos',
            text: text || 'Check out this photo on Echos!',
            url: window.location.href
        });
    } else {
        alert("Link copied!");
    }
};

window.viewImage = (url) => {
    window.open(url, '_blank');
}

// Actions
window.logoutUser = () => signOut(auth);
document.getElementById('google-btn').onclick = () => signInWithPopup(auth, provider);
document.querySelectorAll('.tag-select').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tag-select').forEach(b => b.classList.replace('bg-indigo-600', 'bg-gray-100'));
        document.querySelectorAll('.tag-select').forEach(b => b.classList.replace('text-white', 'text-gray-500'));
        btn.classList.replace('bg-gray-100', 'bg-indigo-600');
        btn.classList.replace('text-gray-500', 'text-white');
        selectedTag = btn.dataset.tag;
    };
});
