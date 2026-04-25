/**
 * EventMedia App Logic
 * Handles drag & drop, file previews, mock upload, and gallery population
 */

// --- IndexedDB Setup ---
const DB_NAME = 'MediaGalleryDB';
const STORE_NAME = 'galleryStore';

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function savePostToDB(post) {
    try {
        const db = await initDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.put(post);
    } catch (e) {
        console.error("Error saving to DB:", e);
    }
}

async function getPostsFromDB() {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error("Error reading DB:", e);
        return [];
    }
}

// Window-level functions for inline HTML calls (Reactions & Comments)
window.reactToPost = function(postId, reactionType) {
    const post = window.mockGalleryData.find(p => p.id === postId);
    if(post) {
        if(!post.reactions) post.reactions = { like: 0, heart: 0, sad: 0, wow: 0 };
        post.reactions[reactionType]++;
        document.getElementById(`${reactionType}-${postId}`).innerText = post.reactions[reactionType];
        if (post.isLocal) savePostToDB(post);
    }
};

window.addComment = function(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value.trim();
    if(!text) return;
    
    const post = window.mockGalleryData.find(p => p.id === postId);
    if(post) {
        if(!post.comments) post.comments = [];
        post.comments.push({ author: "You", text: text });
        
        // Re-render just this comment section
        const commentSection = document.getElementById(`comments-${postId}`);
        const newCommentElement = document.createElement('div');
        newCommentElement.className = 'comment';
        newCommentElement.innerHTML = `<span class="comment-author">You</span>${text}`;
        commentSection.appendChild(newCommentElement);
        
        // Update comment count
        const countSpan = document.getElementById(`comment-count-${postId}`);
        countSpan.innerText = post.comments.length;
        
        input.value = ''; // clear input
        if (post.isLocal) savePostToDB(post);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const previewArea = document.getElementById('preview-area');
    const uploadBtn = document.getElementById('upload-btn');
    const clearBtn = document.getElementById('clear-btn');
    const galleryGrid = document.getElementById('gallery-grid');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const eventSelect = document.getElementById('event-select');

    let selectedFiles = []; // Store selected files

    const now = new Date();
    
    // --- Media Gallery Data (Mock Initial Data) ---
    window.mockGalleryData = [
        { 
            id: 1, type: 'image', src: 'https://picsum.photos/seed/wedding1/600/400', title: 'Bride & Groom setup', size: '2.4 MB', 
            date: new Date(now.getTime() - 1000 * 60 * 60 * 2).toLocaleString(), user: 'Alice Smith', avatar: 'A',
            reactions: { like: 12, heart: 5, sad: 0 },
            comments: [{ author: 'John', text: 'Beautiful setup!' }]
        },
        { 
            id: 2, type: 'image', src: 'https://picsum.photos/seed/wedding2/600/400', title: 'Reception Hall', size: '1.8 MB', 
            date: new Date(now.getTime() - 1000 * 60 * 60 * 5).toLocaleString(), user: 'Michael B.', avatar: 'M',
            reactions: { like: 8, heart: 1, sad: 0 },
            comments: []
        },
        { 
            id: 3, type: 'video', src: '', title: 'First Dance', size: '15 MB', 
            date: new Date(now.getTime() - 1000 * 60 * 60 * 24).toLocaleString(), user: 'Sarah W.', avatar: 'S', isMockVideo: true,
            reactions: { like: 45, heart: 20, sad: 1 },
            comments: [{ author: 'David', text: 'Amazing dance! 😍' }]
        },
        { 
            id: 4, type: 'image', src: 'https://picsum.photos/seed/wedding3/600/400', title: 'Cake Cutting', size: '3.1 MB', 
            date: new Date(now.getTime() - 1000 * 60 * 60 * 48).toLocaleString(), user: 'Emily R.', avatar: 'E',
            reactions: { like: 3, heart: 5, sad: 0 },
            comments: []
        }
    ];

    // Initialize Gallery
    renderGallery(window.mockGalleryData);

    // Load from IndexedDB
    getPostsFromDB().then(localPosts => {
        if (localPosts && localPosts.length > 0) {
            localPosts.forEach(post => {
                if (post.fileObj) {
                    try {
                        post.src = URL.createObjectURL(post.fileObj);
                    } catch(e) {
                        console.error('Cannot create object URL on mobile', e);
                    }
                }
            });
            // We prepend local posts, newest first. Assuming ID is timestamp.
            localPosts.sort((a, b) => b.id - a.id);
            window.mockGalleryData = [...localPosts, ...window.mockGalleryData];
            renderGallery(window.mockGalleryData);
        }
    });

    // --- Drag & Drop Handling ---

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => uploadArea.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('dragover'), false);
    });

    uploadArea.addEventListener('drop', handleDrop, false);
    fileInput.addEventListener('change', handleFileSelect, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    function handleFileSelect(e) {
        const files = e.target.files;
        handleFiles(files);
    }

    function handleFiles(files) {
        const fileArray = Array.from(files);
        let validFiles = true;

        fileArray.forEach(file => {
            // No file size limit validation anymore
            selectedFiles.push(file);
        });

        if (selectedFiles.length > 0) {
            updatePreview();
            uploadBtn.disabled = false;
            clearBtn.style.display = 'block';
        }
    }

    // Event Selector Change
    eventSelect.addEventListener('change', () => {
        if (selectedFiles.length > 0) {
            uploadBtn.disabled = false;
        }
    });

    // --- File Preview Generation ---
    function updatePreview() {
        previewArea.innerHTML = '';
        
        selectedFiles.forEach((file, index) => {
            const previewItem = document.createElement('div');
            previewItem.classList.add('preview-item');
            
            // Format Size
            let fileSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
            
            const overlayInfo = `
                <div class="file-info-overlay" title="${file.name}">
                    ${file.name}<br>
                    <span style="color:var(--accent-color)">${fileSize}</span>
                </div>
            `;
            
            const btnRemove = `
                <button class="remove-btn" type="button" data-index="${index}">
                    <ion-icon name="close-outline"></ion-icon>
                </button>
            `;

            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onloadend = () => {
                    previewItem.innerHTML = `<img src="${reader.result}" alt="${file.name}">` + overlayInfo + btnRemove;
                }
            } else if (file.type.startsWith('video/')) {
                // Mock Video thumbnail (could generate real one but complex for frontend)
                previewItem.innerHTML = `
                    <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#0f172a; color:#cbd5e1;">
                         <ion-icon name="videocam-outline" style="font-size: 2rem;"></ion-icon>
                    </div>` + overlayInfo + btnRemove;
            }

            previewArea.appendChild(previewItem);
        });
    }

    // Remove specific file from preview
    previewArea.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-btn');
        if (removeBtn) {
            const index = parseInt(removeBtn.getAttribute('data-index'));
            selectedFiles.splice(index, 1);
            updatePreview();
            
            if (selectedFiles.length === 0) {
                uploadBtn.disabled = true;
                clearBtn.style.display = 'none';
                fileInput.value = ''; // clear input
            }
        }
    });

    // Clear All
    clearBtn.addEventListener('click', () => {
        selectedFiles = [];
        fileInput.value = '';
        updatePreview();
        uploadBtn.disabled = true;
        clearBtn.style.display = 'none';
    });

    // --- Upload Mock Simulation ---
    document.querySelector('.upload-section').insertAdjacentHTML('beforeend', `
        <div class="upload-progress-overlay" id="progress-overlay">
            <div class="spinner"></div>
            <h3 style="margin-bottom: 10px;">Uploading Media...</h3>
            <p id="progress-text" style="color:var(--text-muted)">0%</p>
        </div>
    `);

    uploadBtn.addEventListener('click', () => {
        if (selectedFiles.length === 0) return;

        const overlay = document.getElementById('progress-overlay');
        const progressText = document.getElementById('progress-text');
        overlay.classList.add('active');
        
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.floor(Math.random() * 15) + 5;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                progressText.innerText = "Processing...";
                
                setTimeout(() => {
                    overlay.classList.remove('active');
                    processSuccessfulUpload();
                }, 1000);
            }
            progressText.innerText = progress + '%';
        }, 300);
    });

    async function processSuccessfulUpload() {
        // Helper to convert file to base64
        const fileToBase64 = (f) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(f);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });

        // Create new gallery items from uploaded files
        const filesToProcess = [...selectedFiles].reverse();
        for (const file of filesToProcess) {
            const isImage = file.type.startsWith('image/');
            let finalSrc = URL.createObjectURL(file);
            
            try {
                // Base64 persistence to ensure videos/images don't break on mobile after reload
                finalSrc = await fileToBase64(file);
            } catch(e) {
                console.error('Base64 conversion failed', e);
            }

            const newItem = {
                id: Date.now() + Math.floor(Math.random()*10000),
                type: isImage ? 'image' : 'video',
                src: finalSrc, // Use base64 for reliable local DB storage
                title: file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name,
                size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
                date: new Date().toLocaleString(),
                user: 'You', // Since it's from the current user
                avatar: 'Y',
                reactions: { like: 0, heart: 0, sad: 0 },
                comments: [],
                isLocal: true // flag knowing it's from current session
            };
            window.mockGalleryData.unshift(newItem); // add to top
            savePostToDB(newItem); // Persist to IndexedDB
        }

        // Reset
        selectedFiles = [];
        fileInput.value = '';
        updatePreview();
        uploadBtn.disabled = true;
        clearBtn.style.display = 'none';
        
        // Re-render gallery
        renderGallery(window.mockGalleryData);
    }

    // --- Gallery Rendering ---
    function renderGallery(items) {
        galleryGrid.innerHTML = '';
        items.forEach(item => {
            const card = document.createElement('div');
            card.classList.add('gallery-card');
            card.setAttribute('data-type', item.type);

            let mediaContent = '';
            
            if (item.type === 'image') {
                mediaContent = `<img src="${item.src}" alt="${item.title}">`;
            } else if (item.type === 'video') {
                if (item.isMockVideo) {
                    mediaContent = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#1e293b; color:#94a3b8; aspect-ratio:4/3;">
                         <ion-icon name="play-circle-outline" style="font-size: 4rem; color:var(--primary-color)"></ion-icon>
                    </div>`;
                } else {
                     mediaContent = `<video src="${item.src}" controls style="width:100%; aspect-ratio:4/3; object-fit:cover; background:#000;"></video>`;
                }
            }

            const badgeIcon = item.type === 'video' ? 'videocam' : 'image';

            card.innerHTML = `
                <div class="post-header">
                    <div class="user-avatar">${item.avatar || 'U'}</div>
                    <div class="user-info">
                        <span class="uploader-name">${item.user || 'Unknown User'}</span>
                        <span class="upload-time">${item.date}</span>
                    </div>
                </div>
                <div style="position:relative;">
                    ${mediaContent}
                    <div class="card-badge">
                        <ion-icon name="${badgeIcon}"></ion-icon> ${item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                    </div>
                </div>
                <div class="post-footer">
                    <div class="reaction-bar">
                        <button class="reaction-btn liked" onclick="reactToPost(${item.id}, 'like')">👍 <span id="like-${item.id}">${item.reactions?.like || 0}</span></button>
                        <button class="reaction-btn hearted" onclick="reactToPost(${item.id}, 'heart')">❤️ <span id="heart-${item.id}">${item.reactions?.heart || 0}</span></button>
                        <button class="reaction-btn sadded" onclick="reactToPost(${item.id}, 'sad')">😢 <span id="sad-${item.id}">${item.reactions?.sad || 0}</span></button>
                        <button class="reaction-btn">💬 <span id="comment-count-${item.id}">${item.comments ? item.comments.length : 0}</span></button>
                    </div>
                    <div class="comments-section" id="comments-${item.id}">
                        ${(item.comments || []).map(c => `<div class="comment"><span class="comment-author">${c.author}</span>${c.text}</div>`).join('')}
                    </div>
                    <div class="add-comment">
                        <input type="text" id="comment-input-${item.id}" placeholder="Write a comment...">
                        <button onclick="addComment(${item.id})"><ion-icon name="send"></ion-icon></button>
                    </div>
                </div>
            `;
            galleryGrid.appendChild(card);
        });
    }

    // Gallery Filtering
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.getAttribute('data-filter');
            
            if (filter === 'all') {
                renderGallery(window.mockGalleryData);
            } else {
                const filtered = window.mockGalleryData.filter(item => item.type === filter);
                renderGallery(filtered);
            }
        });
    });

});
