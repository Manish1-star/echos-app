import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, updateDoc, doc, arrayUnion, arrayRemove, deleteDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// ⚠️ PASTE YOUR CONFIG HERE
const firebaseConfig = {
   // तपाइको config यहाँ
   apiKey: "AIzaSyCCYY7jmpf4JBv0IfI5jeQu9hzbWRv08YY",
   authDomain: "echos-app-ff170.firebaseapp.com",
   projectId: "echos-app-ff170",
   storageBucket: "echos-app-ff170.firebasestorage.app",
   messagingSenderId: "200506270612",
   appId: "1:200506270612:web:89ace360d3a33cf41ee581",
   measurementId: "G-V7KJCTCQEQ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

let user = null;
let currentChatUser = null; 
let currentPostId = null;
let selectedImage = null;
let selectedTag = "General";

const views = {
    login: document.getElementById('login-screen'),
    app: document.getElementById('app-ui'),
    feed: document.getElementById('feed-view'),
    profile: document.getElementById('profile-view')
};

// 1. AUTH & INIT
onAuthStateChanged(auth, (u) => {
    if (u) {
        user = u;
        views.login.classList.add('hidden');
        views.app.classList.remove('hidden');
        updateUI(u);
        loadFeed();
    } else {
        views.login.classList.remove('hidden');
        views.app.classList.add('hidden');
    }
});

function updateUI(u) {
    const photo = u.photoURL || "https://via.placeholder.com/50";
    document.getElementById('header-avatar').innerHTML = `<img src="${photo}" class="w-full h-full object-cover">`;
    document.getElementById('sidebar-img').src = photo;
    document.getElementById('sidebar-name').innerText = u.displayName;
    document.getElementById('profile-large-img').src = photo;
    document.getElementById('profile-name').innerText = u.displayName;
    document.getElementById('profile-email').innerText = u.email;
    document.getElementById('comment-user-img').src = photo;
}

// 2. NAVIGATION & MODALS
window.toggleSidebar = () => {
    const sb = document.getElementById('app-sidebar');
    const ov = document.getElementById('overlay');
    const isOpen = !sb.classList.contains('-translate-x-full');
    
    if(isOpen) {
        sb.classList.add('-translate-x-full');
        ov.classList.add('hidden');
    } else {
        sb.classList.remove('-translate-x-full');
        ov.classList.remove('hidden');
    }
};

window.switchTab = (tab) => {
    views.feed.classList.add('hidden');
    views.profile.classList.add('hidden');
    if(tab === 'home') views.feed.classList.remove('hidden');
    if(tab === 'profile') views.profile.classList.remove('hidden');
    window.scrollTo({top:0});
};

window.closeAllModals = () => {
    document.getElementById('create-view').classList.add('hidden');
    document.getElementById('privacy-modal').classList.add('hidden');
    document.getElementById('comment-modal').classList.add('hidden');
    document.getElementById('comment-modal').classList.remove('translate-y-0');
    document.getElementById('comment-modal').classList.add('translate-y-full');
    document.getElementById('overlay').classList.add('hidden');
    // Also close sidebar if open
    document.getElementById('app-sidebar').classList.add('-translate-x-full');
};

window.openCreate = () => {
    document.getElementById('create-view').classList.remove('hidden');
};

window.openPrivacy = () => {
    document.getElementById('privacy-modal').classList.remove('hidden');
};

// 3. POSTING SYSTEM (With Image)
document.getElementById('post-image-upload').onchange = (e) => {
    const file = e.target.files[0];
    if(file){
        selectedImage = file;
        const reader = new FileReader();
        reader.onload = (e) => document.getElementById('image-preview').src = e.target.result;
        reader.readAsDataURL(file);
        document.getElementById('image-preview-container').classList.remove('hidden');
    }
};

window.removeImage = () => {
    selectedImage = null;
    document.getElementById('post-image-upload').value = "";
    document.getElementById('image-preview-container').classList.add('hidden');
};

document.getElementById('publish-btn').onclick = async () => {
    const txt = document.getElementById('post-input').value.trim();
    if (!txt && !selectedImage) return alert("Please write something or add a photo.");
    
    const btn = document.getElementById('publish-btn');
    btn.innerText = "Posting...";
    btn.disabled = true;

    try {
        let url = null;
        if(selectedImage) {
            const imgRef = ref(storage, `posts/${user.uid}/${Date.now()}`);
            await uploadBytes(imgRef, selectedImage);
            url = await getDownloadURL(imgRef);
        }

        await addDoc(collection(db, "posts"), {
            text: txt,
            imageUrl: url,
            uid: user.uid,
            name: user.displayName,
            photo: user.photoURL,
            tag: selectedTag,
            likes: [],
            createdAt: serverTimestamp()
        });

        document.getElementById('post-input').value = "";
        removeImage();
        closeAllModals();
        switchTab('home');
    } catch (e) { alert("Error: " + e.message); }
    btn.innerText = "Post";
    btn.disabled = false;
};

// 4. FEED & ACTIONS (Copy, Like, Delete)
function loadFeed() {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50));
    onSnapshot(q, (snap) => {
        const container = document.getElementById('feed-container');
        container.innerHTML = "";
        
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;
            const isLiked = data.likes && data.likes.includes(user.uid);
            const isMine = data.uid === user.uid;
            
            const div = document.createElement('div');
            div.className = "bg-white p-4 border-b border-gray-100 mb-2 shadow-sm animate-slide-up";
            
            // Delete Logic
            const delBtn = isMine ? `<button onclick="deletePost('${id}')" class="text-gray-300 hover:text-red-500"><i class="fa-solid fa-trash"></i></button>` : '';
            
            // Image Logic
            const imgHtml = data.imageUrl ? `<img src="${data.imageUrl}" class="w-full h-auto rounded-xl mt-3 border border-gray-100 bg-gray-50" loading="lazy" onclick="window.open('${data.imageUrl}','_blank')">` : '';

            // Copy Text Logic
            const textContent = data.text || "";

            div.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div class="flex gap-3 items-center cursor-pointer" onclick="openChatWith('${data.uid}', '${data.name}', '${data.photo}')">
                        <img src="${data.photo}" class="w-10 h-10 rounded-full border border-gray-200 object-cover">
                        <div>
                            <h4 class="font-bold text-sm text-gray-900">${data.name}</h4>
                            <span class="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full uppercase font-bold tracking-wide">#${data.tag||'General'}</span>
                        </div>
                    </div>
                    <div class="flex gap-3">
                        <button onclick="copyText('${textContent.replace(/'/g, "\\'")}')" class="text-gray-300 hover:text-indigo-500"><i class="fa-regular fa-copy"></i></button>
                        ${delBtn}
                    </div>
                </div>
                
                <p class="text-gray-800 text-[15px] whitespace-pre-wrap leading-relaxed select-text">${textContent}</p>
                ${imgHtml}
                
                <div class="mt-4 flex items-center gap-6 border-t border-gray-50 pt-3">
                    <button onclick="toggleLike('${id}', ${isLiked})" class="flex items-center gap-2 text-sm ${isLiked ? 'text-red-500 font-bold' : 'text-gray-500'}">
                        <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart text-lg"></i> 
                        <span>${data.likes ? data.likes.length : 0}</span>
                    </button>
                    <button onclick="openComments('${id}')" class="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600">
                        <i class="fa-regular fa-comment text-lg"></i> Comment
                    </button>
                </div>
            `;
            container.appendChild(div);
        });
    });
}

// 5. UTILS (Copy, Like, Delete)
window.copyText = (text) => {
    if(!text) return;
    navigator.clipboard.writeText(text).then(() => alert("Copied to clipboard!"));
};

window.toggleLike = async (id, isLiked) => {
    const ref = doc(db, "posts", id);
    if(isLiked) await updateDoc(ref, { likes: arrayRemove(user.uid) });
    else await updateDoc(ref, { likes: arrayUnion(user.uid) });
};

window.deletePost = async (id) => {
    if(confirm("Delete this post?")) await deleteDoc(doc(db, "posts", id));
};

// 6. COMMENTS SYSTEM
window.openComments = (postId) => {
    currentPostId = postId;
    const modal = document.getElementById('comment-modal');
    document.getElementById('overlay').classList.remove('hidden');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('translate-y-full');
        modal.classList.add('translate-y-0');
    }, 10);
    
    // Load Comments
    const list = document.getElementById('comments-list');
    list.innerHTML = '<div class="text-center text-gray-400 mt-4">Loading...</div>';
    
    const q = query(collection(db, `posts/${postId}/comments`), orderBy("createdAt", "asc"));
    onSnapshot(q, (snap) => {
        list.innerHTML = "";
        if(snap.empty) {
            list.innerHTML = '<div class="text-center text-gray-400 mt-4">No comments yet.</div>';
            return;
        }
        snap.forEach(doc => {
            const c = doc.data();
            const d = document.createElement('div');
            d.className = "flex gap-3 mb-3";
            d.innerHTML = `
                <img src="${c.photo}" class="w-8 h-8 rounded-full bg-gray-200">
                <div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm">
                    <span class="font-bold text-xs block mb-1">${c.name}</span>
                    <p class="text-sm text-gray-700">${c.text}</p>
                </div>
            `;
            list.appendChild(d);
        });
        list.scrollTop = list.scrollHeight;
    });
};

document.getElementById('send-comment-btn').onclick = async () => {
    const inp = document.getElementById('comment-input');
    const txt = inp.value.trim();
    if(!txt) return;
    
    await addDoc(collection(db, `posts/${currentPostId}/comments`), {
        text: txt,
        uid: user.uid,
        name: user.displayName,
        photo: user.photoURL,
        createdAt: serverTimestamp()
    });
    inp.value = "";
};

// 7. CHAT SYSTEM (1-on-1)
window.openChatWith = async (targetUid, targetName, targetPhoto) => {
    if(targetUid === user.uid) return alert("That's you!");
    
    currentChatUser = { uid: targetUid, name: targetName };
    const modal = document.getElementById('chat-modal');
    
    // UI Setup
    document.getElementById('chat-header-img').src = targetPhoto;
    document.getElementById('chat-header-name').innerText = targetName;
    modal.classList.remove('hidden');
    
    // Chat ID (Alphabetical Order to make it unique for pair)
    const chatId = [user.uid, targetUid].sort().join("_");
    const msgsDiv = document.getElementById('chat-messages');
    
    const q = query(collection(db, `chats/${chatId}/messages`), orderBy("createdAt", "asc"));
    onSnapshot(q, (snap) => {
        msgsDiv.innerHTML = "";
        snap.forEach(doc => {
            const m = doc.data();
            const isMe = m.uid === user.uid;
            const div = document.createElement('div');
            div.className = `flex ${isMe ? 'justify-end' : 'justify-start'}`;
            div.innerHTML = `
                <div class="max-w-[70%] px-4 py-2 rounded-2xl text-sm ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'}">
                    ${m.text}
                </div>
            `;
            msgsDiv.appendChild(div);
        });
        msgsDiv.scrollTop = msgsDiv.scrollHeight;
    });

    // Send Btn Logic
    document.getElementById('send-chat-btn').onclick = async () => {
        const cinp = document.getElementById('chat-input');
        const txt = cinp.value.trim();
        if(!txt) return;
        
        await addDoc(collection(db, `chats/${chatId}/messages`), {
            text: txt,
            uid: user.uid,
            createdAt: serverTimestamp()
        });
        cinp.value = "";
    };
};

window.closeChat = () => {
    document.getElementById('chat-modal').classList.add('hidden');
    currentChatUser = null;
};

// 8. PROFILE PIC UPLOAD
document.getElementById('profile-upload').onchange = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    if(!confirm("Update profile picture?")) return;
    
    try {
        const refLink = ref(storage, `profiles/${user.uid}`);
        await uploadBytes(refLink, file);
        const url = await getDownloadURL(refLink);
        await updateProfile(user, { photoURL: url });
        alert("Profile Updated! Reload app.");
        location.reload();
    } catch(e) { alert("Error: " + e.message); }
};

// Tags Logic
document.querySelectorAll('.tag-select').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tag-select').forEach(b => {
            b.classList.remove('bg-indigo-600','text-white');
            b.classList.add('bg-white','text-gray-500');
        });
        btn.classList.remove('bg-white','text-gray-500');
        btn.classList.add('bg-indigo-600','text-white');
        selectedTag = btn.dataset.tag;
    };
});
window.logoutUser = () => signOut(auth);
document.getElementById('google-btn').onclick = () => signInWithPopup(auth, provider);
