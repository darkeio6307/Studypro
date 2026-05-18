// ============================================================
// studyPro v6.0 — UP Board Class 12 Study + Social App
// Zero Bug Policy — ES6 Template Literals ONLY for HTML
// ============================================================

// ===== FIREBASE CONFIG =====
const firebaseConfig = {
  apiKey: "AIzaSyC-psUKqTO9u5kCuA3OUqWT63Ey0IvDei4",
  authDomain: "study-ae01d.firebaseapp.com",
  databaseURL: "https://study-ae01d-default-rtdb.firebaseio.com",
  projectId: "study-ae01d",
  storageBucket: "study-ae01d.firebasestorage.app",
  messagingSenderId: "198271524977",
  appId: "1:198271524977:web:d54ad6d58cd6c5c4103bd0",
  measurementId: "G-Q51PB50Q51"
};

// ===== INIT FIREBASE =====
let app, auth, db, storage;
let firebaseLoaded = false;

try {
  if (typeof firebase === 'undefined') {
    throw new Error('Firebase SDK not loaded');
  }
  firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db = firebase.firestore();
  storage = firebase.storage();
  firebaseLoaded = true;
} catch (err) {
  console.error('Firebase init failed:', err);
  const errScreen = document.getElementById('firebase-error');
  if (errScreen) errScreen.classList.add('visible');
}

// ===== CONSTANTS =====
const ADMIN_EMAIL = 'moharshad687@gmail.com';
const ADMIN_PIN = '7860';
const ytApiKey = 'AIzaSyAra2lkY-sdBKeahyfmb4qNlpSmnBeOnkA';

// ===== STATE =====
const state = {
  user: null,
  profile: null,
  theme: localStorage.getItem('studyPro_theme') || 'golden',
  tab: 'home',
  examDate: new Date('2027-02-15T09:00:00'),
  isAdmin: false,
  sidebarOpen: false,
  testTimerInterval: null,
  activeSubject: 'all',
  activeHomeworkSubject: 'Hindi',
  installPrompt: null,
  calcExpr: '',
  todos: JSON.parse(localStorage.getItem('studyPro_todos') || '[]'),
  initialized: false,
  timerIntervalId: null,
  storyTimeout: null,
  examSoonMode: false,
  notifOpen: false
};

// ===== DOM HELPERS =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ===== DATA MAP for dynamic references (zero escaping hell) =====
const dataMap = {};

// ===== UTILITY FUNCTIONS =====
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTime(isoString) {
  if (!isoString) return 'Recently';
  const date = new Date(isoString);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString();
}

function showToast(msg, type) {
  type = type || 'success';
  const toast = $('#toast');
  const toastMsg = $('#toast-msg');
  const toastIcon = $('#toast-icon');
  if (!toast || !toastMsg || !toastIcon) return;
  toastMsg.textContent = msg;
  let iconClass = 'fa-circle-check';
  let iconColor = 'var(--app-success)';
  if (type === 'error') {
    iconClass = 'fa-circle-xmark';
    iconColor = 'var(--app-danger)';
  } else if (type === 'info') {
    iconClass = 'fa-circle-info';
    iconColor = 'var(--app-accent)';
  }
  toastIcon.className = `fa-solid ${iconClass}`;
  toastIcon.style.color = iconColor;
  toast.classList.add('show');
  setTimeout(() => { toast.classList.remove('show'); }, 3200);
}

// ===== IMAGE COMPRESSION =====
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        const maxDim = 800;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h / w) * maxDim);
            w = maxDim;
          } else {
            w = Math.round((w / h) * maxDim);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const tryCompress = (quality) => {
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Compression failed'));
              return;
            }
            if (blob.size > 500000 && quality > 0.3) {
              tryCompress(quality - 0.1);
            } else {
              resolve(blob);
            }
          }, 'image/jpeg', quality);
        };
        tryCompress(0.6);
      };
      img.onerror = () => reject(new Error('Invalid image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

// ===== FILE VALIDATION =====
function validateImageFile(input) {
  const file = input.files[0];
  if (!file) return null;
  if (!file.type.startsWith('image/')) {
    showToast('Videos not allowed', 'error');
    input.value = '';
    return null;
  }
  return file;
}

// ===== UPLOAD TO FIREBASE STORAGE =====
async function uploadImageBlob(blob, path) {
  if (!storage) throw new Error('Storage not available');
  const ref = storage.ref().child(path);
  const snap = await ref.put(blob);
  return await snap.ref.getDownloadURL();
}

// ===== THEME =====
function applyTheme(theme) {
  const body = document.body;
  const classes = body.className.split(' ').filter((c) => !c.startsWith('theme-'));
  classes.push(`theme-${theme}`);
  body.className = classes.join(' ');
  state.theme = theme;
  localStorage.setItem('studyPro_theme', theme);
  $$('.theme-pill').forEach((p) => p.classList.remove('active'));
  const pill = $(`#pill-${theme}`);
  if (pill) pill.classList.add('active');
  const labels = { light: 'Light Mode', dark: 'Dark Mode', golden: 'Golden Silver' };
  const label = $('#theme-label');
  if (label) label.textContent = labels[theme] || 'Golden Silver';
}

// ===== MODAL MANAGEMENT =====
function closeAllModals() {
  $$('.modal-overlay').forEach((m) => m.classList.remove('open'));
  const videoModal = $('#video-modal');
  if (videoModal) {
    videoModal.classList.remove('open');
    const iframe = $('#video-iframe');
    if (iframe) iframe.src = '';
  }
  const testModal = $('#test-modal');
  if (testModal) {
    testModal.classList.remove('open');
    const tiframe = $('#test-iframe');
    if (tiframe) tiframe.src = '';
    if (state.testTimerInterval) {
      clearInterval(state.testTimerInterval);
      state.testTimerInterval = null;
    }
  }
  const lectureModal = $('#lecture-modal');
  if (lectureModal) {
    lectureModal.classList.remove('open');
    const liframe = $('#lecture-iframe');
    if (liframe) liframe.src = '';
  }
  const storyModal = $('#story-modal');
  if (storyModal) {
    storyModal.classList.remove('open');
    if (state.storyTimeout) {
      clearTimeout(state.storyTimeout);
      state.storyTimeout = null;
    }
  }
}

function closeAllOverlays() {
  closeAllModals();
  state.sidebarOpen = false;
  const sidebar = $('#sidebar');
  const overlay = $('#sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  const adminPanel = $('#admin-panel');
  if (adminPanel) adminPanel.classList.remove('open');
  const hwView = $('#homework-view');
  if (hwView) hwView.classList.remove('open');
  const authScreen = $('#auth-screen');
  if (authScreen && state.user) {
    authScreen.classList.add('hidden-auth');
    setTimeout(() => authScreen.classList.add('hidden'), 600);
  }
}

// ===== ADMIN PIN =====
function verifyAdminPin() {
  const pin = prompt('Enter Admin PIN:');
  if (pin === null) return false;
  if (pin !== ADMIN_PIN) {
    showToast('Incorrect Admin PIN', 'error');
    return false;
  }
  return true;
}

function requireAdminDelete(callback) {
  if (!state.isAdmin) return;
  if (verifyAdminPin()) {
    callback();
  }
}

// ===== EXAM TIMER =====
async function updateTimer() {
  const timerEl = $('#exam-timer');
  const badge = $('#exam-timer-badge');
  if (!timerEl) return;

  // Check admin "Soon" mode
  if (db) {
    try {
      const settingsDoc = await db.collection('settings').doc('examTimer').get();
      if (settingsDoc.exists && settingsDoc.data().soonMode) {
        timerEl.textContent = 'Soon...';
        timerEl.style.color = 'var(--app-text-muted)';
        if (badge) badge.classList.add('glow-soon');
        return;
      }
    } catch (e) {}
  }

  if (!db) {
    timerEl.textContent = 'Soon...';
    return;
  }

  try {
    const snap = await db.collection('datesheet').orderBy('date', 'asc').get();
    const now = new Date();
    let nextExam = null;
    snap.docs.forEach((d) => {
      const data = d.data();
      const examDate = new Date(`${data.date}T${data.time || '09:00'}`);
      if (examDate > now && !nextExam) {
        nextExam = { date: examDate, subject: data.subject, name: data.name };
      }
    });

    if (!nextExam) {
      timerEl.textContent = 'Soon...';
      timerEl.style.color = 'var(--app-text-muted)';
      if (badge) badge.classList.add('glow-soon');
      return;
    }

    if (badge) badge.classList.remove('glow-soon');
    const diff = nextExam.date - now;
    if (diff <= 0) {
      timerEl.textContent = 'Exam Started!';
      timerEl.style.color = 'var(--app-danger)';
      return;
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    timerEl.textContent = `${nextExam.subject}: ${days}d ${hours}h ${mins}m`;
    timerEl.style.color = '';
  } catch (e) {
    timerEl.textContent = 'Soon...';
  }
}

// ===== AUTH =====
async function handleLogin(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!auth) { showToast('Auth not available', 'error'); return; }
  const emailEl = $('#login-email');
  const pwEl = $('#login-password');
  const btn = $('#login-submit');
  if (!emailEl || !pwEl) return;
  const email = emailEl.value.trim();
  const password = pwEl.value;
  if (!email || !password) { showToast('Please fill in all fields', 'error'); return; }

  const originalText = btn ? btn.innerHTML : '<span>Log In</span>';
  if (btn) { btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Logging in...'; btn.disabled = true; }

  try {
    await auth.signInWithEmailAndPassword(email, password);
    showToast('Welcome back!');
  } catch (err) {
    showToast(err.message || 'Login failed', 'error');
    if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
  }
}

async function handleRegister(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!auth) { showToast('Auth not available', 'error'); return; }
  const emailEl = $('#reg-email');
  const pwEl = $('#reg-password');
  const nameEl = $('#reg-name');
  const clsEl = $('#reg-class');
  const btn = $('#reg-submit');
  if (!emailEl || !pwEl || !nameEl) return;

  const email = emailEl.value.trim();
  const password = pwEl.value;
  const name = nameEl.value.trim();
  const cls = clsEl ? clsEl.value : '12';

  if (!email || !password || !name) { showToast('Please fill in all fields', 'error'); return; }
  if (password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }

  const originalText = btn ? btn.innerHTML : '<span>Create Account</span>';
  if (btn) { btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Creating...'; btn.disabled = true; }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await db.collection('users').doc(cred.user.uid).set({
      name: name,
      class: cls,
      email: email,
      subjects: 'Hindi, English, Physics, Chemistry, Math',
      seatNumber: 'UP-2027-88421',
      createdAt: new Date().toISOString(),
      board: 'UP',
      bio: 'Class 12 UP Board student preparing for excellence.',
      target: '95%',
      city: 'Lakhimpur Kheri',
      phone: '',
      photoURL: '',
      vipTier: 'free'
    });
    showToast('Account created! Welcome!');
  } catch (err) {
    showToast(err.message || 'Registration failed', 'error');
    if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
  }
}

async function handleGoogleAuth(e, isRegister) {
  if (e && e.preventDefault) e.preventDefault();
  if (e && e.stopPropagation) e.stopPropagation();
  if (!auth) { showToast('Auth not available', 'error'); return; }

  const btnId = isRegister ? 'google-register' : 'google-login';
  const btn = $(`#${btnId}`);
  const originalHtml = isRegister
    ? '<i class="fa-brands fa-google"></i><span>Sign up with Google</span>'
    : '<i class="fa-brands fa-google"></i><span>Continue with Google</span>';

  try {
    if (btn) btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Connecting...';
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    const user = result.user;

    const profileDoc = await db.collection('users').doc(user.uid).get();
    if (!profileDoc.exists) {
      await db.collection('users').doc(user.uid).set({
        name: user.displayName || 'Student',
        class: '12',
        email: user.email,
        subjects: 'Hindi, English, Physics, Chemistry, Math',
        seatNumber: 'UP-2027-88421',
        createdAt: new Date().toISOString(),
        board: 'UP',
        bio: 'Class 12 UP Board student preparing for excellence.',
        target: '95%',
        city: 'Lakhimpur Kheri',
        phone: '',
        photoURL: user.photoURL || '',
        vipTier: 'free'
      });
    } else if (user.photoURL) {
      await db.collection('users').doc(user.uid).update({
        photoURL: user.photoURL
      });
    }
    showToast('Signed in with Google!');
  } catch (err) {
    showToast(err.message || 'Google sign-in failed', 'error');
    if (btn) btn.innerHTML = originalHtml;
  }
}

// ===== PROFILE =====
async function loadProfile(uid) {
  if (!db) return;
  try {
    const docSnap = await db.collection('users').doc(uid).get();
    if (docSnap.exists) {
      const data = docSnap.data();
      if (state.user && state.user.photoURL && !data.photoURL) {
        data.photoURL = state.user.photoURL;
      }
      state.profile = data;
      renderProfile();
    }
  } catch (e) {
    console.error('loadProfile error:', e);
  }
}

function getVipFrameClass(email, tier) {
  if (email === ADMIN_EMAIL) return 'avatar-frame-founder';
  if (tier === 'gold') return 'avatar-frame-gold';
  if (tier === 'silver') return 'avatar-frame-silver';
  if (tier === 'bronze') return 'avatar-frame-bronze';
  return '';
}

function renderProfile() {
  const p = state.profile || {};
  const name = p.name || (state.user && state.user.displayName) || 'Student';
  const email = p.email || (state.user && state.user.email) || 'student@school.edu';
  const cls = p.class || '12';
  const subjects = p.subjects || 'Hindi, English, Physics, Chemistry, Math';
  const seat = p.seatNumber || 'UP-2027-88421';
  const bio = p.bio || 'Class 12 UP Board student preparing for excellence.';
  const target = p.target || '95%';
  const city = p.city || 'LKH';
  const phone = p.phone || '--';
  const photoURL = p.photoURL || (state.user && state.user.photoURL) || '';
  const vipTier = p.vipTier || 'free';

  // Welcome name
  const welcomeEl = $('#home-welcome');
  if (welcomeEl) welcomeEl.textContent = name.split(' ')[0];

  // Profile name, class, bio
  const nameEl = $('#profile-name');
  const classEl = $('#profile-class');
  const bioEl = $('#profile-bio');
  if (nameEl) nameEl.textContent = name;
  if (classEl) classEl.textContent = `Class ${cls} \u2022 UP Board`;
  if (bioEl) bioEl.textContent = bio;

  // Photo / Avatar
  const photoEl = $('#profile-photo');
  const avatarEl = $('#profile-avatar');
  if (photoURL && photoEl) {
    photoEl.src = photoURL;
    photoEl.classList.remove('hidden');
    photoEl.onerror = () => {
      photoEl.classList.add('hidden');
      if (avatarEl) {
        avatarEl.classList.remove('hidden');
        avatarEl.textContent = name.charAt(0).toUpperCase();
      }
    };
    if (avatarEl) avatarEl.classList.add('hidden');
  } else if (photoEl) {
    photoEl.classList.add('hidden');
    if (avatarEl) {
      avatarEl.classList.remove('hidden');
      avatarEl.textContent = name.charAt(0).toUpperCase();
    }
  }

  // VIP Frame
  const avatarContainer = $('#avatar-frame-container');
  if (avatarContainer) {
    avatarContainer.className = `w-28 h-28 rounded-full mx-auto mb-4 relative ${getVipFrameClass(email, vipTier)}`;
  }

  // VIP Badge
  const vipBadge = $('#vip-badge');
  if (vipBadge) {
    if (email === ADMIN_EMAIL || vipTier !== 'free') {
      vipBadge.classList.remove('hidden');
      vipBadge.textContent = email === ADMIN_EMAIL ? 'Founder' : (vipTier || 'VIP').toUpperCase();
    } else {
      vipBadge.classList.add('hidden');
    }
  }

  // Verified / Blue Tick
  const verifiedEl = $('#profile-verified');
  if (verifiedEl) {
    verifiedEl.classList.toggle('hidden', email !== ADMIN_EMAIL);
  }

  // Stats
  const targetEl = $('#profile-target');
  const cityEl = $('#profile-city');
  const phoneEl = $('#profile-phone');
  if (targetEl) targetEl.textContent = target;
  if (cityEl) cityEl.textContent = city;
  if (phoneEl) phoneEl.textContent = phone;

  // Info fields
  const seatEl = $('#profile-seat');
  const subjectsEl = $('#profile-subjects');
  const emailEl = $('#profile-email');
  if (seatEl) seatEl.textContent = seat;
  if (subjectsEl) subjectsEl.textContent = subjects;
  if (emailEl) emailEl.textContent = email;

  // VIP Status Card
  const vipTierText = $('#vip-tier-text');
  if (vipTierText) {
    if (email === ADMIN_EMAIL) {
      vipTierText.textContent = 'Founder (Admin)';
    } else {
      const tierMap = { free: 'Free Member', bronze: 'Bronze VIP', silver: 'Silver VIP', gold: 'Gold VIP' };
      vipTierText.textContent = tierMap[vipTier] || 'Free Member';
    }
  }

  // Social badge
  const socialBadge = $('#social-badge');
  if (socialBadge) {
    socialBadge.classList.toggle('hidden', email !== ADMIN_EMAIL && vipTier === 'free');
  }

  // Admin check
  state.isAdmin = (email === ADMIN_EMAIL);
  const adminBtn = $('#admin-btn-container');
  if (adminBtn) adminBtn.classList.toggle('hidden', !state.isAdmin);

  // Edit form prefill
  const editName = $('#edit-name');
  const editClass = $('#edit-class');
  const editSubjects = $('#edit-subjects');
  const editSeat = $('#edit-seat');
  const editBio = $('#edit-bio');
  const editTarget = $('#edit-target');
  const editCity = $('#edit-city');
  const editPhone = $('#edit-phone');
  const editPhotoUrl = $('#edit-photo-url');

  if (editName) editName.value = name;
  if (editClass) editClass.value = cls;
  if (editSubjects) editSubjects.value = subjects;
  if (editSeat) editSeat.value = seat;
  if (editBio) editBio.value = bio;
  if (editTarget) editTarget.value = target;
  if (editCity) editCity.value = city === 'LKH' ? '' : city;
  if (editPhone) editPhone.value = phone === '--' ? '' : phone;
  if (editPhotoUrl) editPhotoUrl.value = photoURL;
}

async function saveProfile(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!state.user || !db) return;
  try {
    const data = {
      name: $('#edit-name')?.value || '',
      class: $('#edit-class')?.value || '12',
      subjects: $('#edit-subjects')?.value || '',
      seatNumber: $('#edit-seat')?.value || '',
      bio: $('#edit-bio')?.value || '',
      target: $('#edit-target')?.value || '',
      city: $('#edit-city')?.value || '',
      phone: $('#edit-phone')?.value || '',
      photoURL: $('#edit-photo-url')?.value || ''
    };
    await db.collection('users').doc(state.user.uid).update(data);
    state.profile = Object.assign({}, state.profile || {}, data);
    renderProfile();
    closeEditModal();
    showToast('Profile updated!');
  } catch (e) {
    showToast(e.message || 'Update failed', 'error');
  }
}

async function handleProfileImageUpload(input) {
  const file = validateImageFile(input);
  if (!file) return;
  try {
    showToast('Compressing image...', 'info');
    const blob = await compressImage(file);
    const path = `profiles/${state.user.uid}_${Date.now()}.jpg`;
    const url = await uploadImageBlob(blob, path);
    const urlEl = $('#edit-photo-url');
    if (urlEl) urlEl.value = url;
    showToast('Photo uploaded! Save profile to apply.');
  } catch (err) {
    showToast(err.message || 'Upload failed', 'error');
  }
}

// ===== NOTIFICATIONS =====
async function checkNotifications() {
  const dot = $('#notif-dot');
  if (!db || !dot) return;
  try {
    const lastSeen = localStorage.getItem('studyPro_lastNoticeSeen') || '';
    const snap = await db.collection('notices').orderBy('createdAt', 'desc').limit(1).get();
    if (snap.empty) { dot.classList.add('hidden'); return; }
    const latest = snap.docs[0].data().createdAt || '';
    if (latest && latest > lastSeen) {
      dot.classList.remove('hidden');
    } else {
      dot.classList.add('hidden');
    }
  } catch (e) {
    dot.classList.add('hidden');
  }
}

function openNotifications() {
  localStorage.setItem('studyPro_lastNoticeSeen', new Date().toISOString());
  const dot = $('#notif-dot');
  if (dot) dot.classList.add('hidden');
  switchTab('home');
  showToast('Notices updated!', 'info');
}

// ===== NOTICES =====
async function loadNotices() {
  const container = $('#notices-list');
  if (!container || !db) return;
  try {
    const snap = await db.collection('notices').orderBy('createdAt', 'desc').limit(8).get();
    if (snap.empty) {
      container.innerHTML = `<div class="flex gap-3 items-start"><div class="w-2 h-2 rounded-full mt-2 shrink-0" style="background:var(--app-text-dim)"></div><div><p class="text-sm leading-relaxed" style="color:var(--app-text-muted)">No notices yet. Check back later!</p></div></div>`;
      return;
    }
    let html = '';
    snap.docs.forEach((docItem, idx) => {
      const n = docItem.data();
      const isUrgent = n.priority === 'urgent';
      const dateStr = n.createdAt ? new Date(n.createdAt).toLocaleDateString() : 'Recently';
      const dotClass = isUrgent ? 'bg-amber-500 shadow-sm shadow-amber-500/50' : '';
      const dotStyle = isUrgent ? '' : 'style="background:var(--app-text-dim)"';
      html += `<div class="flex gap-3 items-start slide-in" style="animation-delay:${idx * 0.05}s"><div class="w-2 h-2 rounded-full mt-2 shrink-0 ${dotClass}" ${dotStyle}></div><div><p class="text-sm leading-relaxed" style="color:var(--app-text-muted)">${escapeHtml(n.body)}</p><p class="text-[11px] mt-1 font-medium" style="color:var(--app-text-dim)">${escapeHtml(dateStr)}</p></div></div>`;
      if (idx < snap.docs.length - 1) {
        html += `<div class="h-px my-2.5" style="background:var(--app-border)"></div>`;
      }
    });
    container.innerHTML = html;
  } catch (e) {
    console.error('Load notices error:', e);
  }
}

// ===== DATE SHEET =====
async function loadDateSheet() {
  const container = $('#datesheet-list');
  const adminContainer = $('#admin-datesheet-list');
  if (!db) return;
  try {
    const snap = await db.collection('datesheet').orderBy('date', 'asc').get();
    const now = new Date();
    let html = '';
    if (snap.empty) {
      html = '<p class="text-xs text-center py-4" style="color:var(--app-text-dim)">No exam dates added yet.</p>';
    } else {
      snap.docs.forEach((docItem) => {
        const d = docItem.data();
        const examDate = new Date(`${d.date}T${d.time || '09:00'}`);
        const isPast = examDate < now;
        const statusColor = isPast ? 'var(--app-text-dim)' : 'var(--app-success)';
        const statusText = isPast ? 'Completed' : 'Upcoming';
        const subColors = { Hindi: '#f97316', English: '#8b5cf6', Mathematics: '#f59e0b', Physics: '#3b82f6', Chemistry: '#22c55e' };
        const color = subColors[d.subject] || '#3b82f6';
        html += `<div class="flex items-center justify-between p-3 rounded-xl border" style="background:var(--app-surface2);border-color:var(--app-border)"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style="background:${color}">${d.subject ? d.subject.charAt(0) : 'E'}</div><div><p class="text-sm font-bold" style="color:var(--app-text)">${escapeHtml(d.name)}</p><p class="text-[11px]" style="color:var(--app-text-dim)">${escapeHtml(d.subject)} \u2022 ${escapeHtml(d.shift)} \u2022 ${escapeHtml(d.time)}</p></div></div><div class="text-right"><p class="text-xs font-bold" style="color:${statusColor}">${statusText}</p><p class="text-[10px]" style="color:var(--app-text-dim)">${new Date(d.date).toLocaleDateString()}</p></div></div>`;
      });
    }
    if (container) container.innerHTML = html;
    if (adminContainer) adminContainer.innerHTML = renderAdminDateSheetList(snap, now);
  } catch (e) {
    console.error('Load date sheet error:', e);
  }
}

function renderAdminDateSheetList(snap, now) {
  if (!snap || snap.empty) return '<p class="text-xs text-center py-4" style="color:var(--app-text-dim)">No exam dates added yet.</p>';
  let html = '';
  snap.docs.forEach((docItem) => {
    const d = docItem.data();
    html += `<div class="flex items-center justify-between p-3 rounded-xl border" style="background:var(--app-surface2);border-color:var(--app-border)"><div class="overflow-hidden"><p class="text-sm font-bold truncate" style="color:var(--app-text)">${escapeHtml(d.name)}</p><p class="text-[11px]" style="color:var(--app-text-dim)">${escapeHtml(d.subject)} \u2022 ${new Date(d.date).toLocaleDateString()}</p></div>`;
    if (state.isAdmin) {
      html += `<button type="button" onclick="App.handleAdminDelete('datesheet','${docItem.id}')" class="admin-delete-btn ml-2" title="Delete"><i class="fa-solid fa-trash text-xs"></i></button>`;
    }
    html += '</div>';
  });
  return html;
}

// ===== SUBJECT META =====
const subjectMeta = {
  Hindi:       { from: 'from-orange-950/60', to: 'to-red-950/60',    text: 'text-orange-400', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.2)',  solid: '#f97316' },
  English:     { from: 'from-violet-950/60', to: 'to-purple-950/60',  text: 'text-violet-400', bg: 'rgba(139,92,246,0.1)',  border: 'rgba(139,92,246,0.2)',  solid: '#8b5cf6' },
  Mathematics: { from: 'from-amber-950/60',  to: 'to-orange-950/60',  text: 'text-amber-400',  bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)',  solid: '#f59e0b' },
  Physics:     { from: 'from-blue-950/60',   to: 'to-indigo-950/60',  text: 'text-blue-400',   bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.2)',  solid: '#3b82f6' },
  Chemistry:   { from: 'from-emerald-950/60',to: 'to-teal-950/60',    text: 'text-emerald-400',bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.2)',   solid: '#22c55e' },
};

// ===== LECTURES =====
async function loadLectures() {
  const container = $('#lectures-grid');
  if (!container || !db) return;
  container.innerHTML = '<div class="col-span-full space-y-4"><div class="skeleton h-40 rounded-2xl"></div><div class="skeleton h-40 rounded-2xl"></div></div>';
  try {
    const snap = await db.collection('lectures').get();
    const defaults = [
      { title: 'Electric Charges & Fields', subject: 'Physics', chapter: 'Ch. 1', progress: 65, total: 12, current: 8, duration: '45 min', url: '' },
      { title: 'The Solid State', subject: 'Chemistry', chapter: 'Ch. 1', progress: 90, total: 12, current: 11, duration: '38 min', url: '' },
      { title: 'Relations & Functions', subject: 'Mathematics', chapter: 'Ch. 1', progress: 45, total: 12, current: 5, duration: '52 min', url: '' },
      { title: 'Hindi Grammar - Muhavare', subject: 'Hindi', chapter: 'Ch. 5', progress: 60, total: 10, current: 6, duration: '30 min', url: '' },
      { title: 'English Literature - Prose', subject: 'English', chapter: 'Ch. 2', progress: 75, total: 12, current: 9, duration: '40 min', url: '' },
    ];
    let items = snap.empty ? defaults : snap.docs.map((d) => {
      const data = d.data();
      data.id = d.id;
      return data;
    });
    if (state.activeSubject !== 'all') {
      items = items.filter((l) => l.subject === state.activeSubject);
    }
    if (items.length === 0) {
      container.innerHTML = '<p class="text-sm text-center py-8 col-span-full" style="color:var(--app-text-dim)">No lectures for this subject yet.</p>';
      return;
    }
    let html = '';
    items.forEach((l, idx) => {
      const color = subjectMeta[l.subject] || subjectMeta.Physics;
      const progress = l.progress || Math.round(((l.current || 0) / (l.total || 1)) * 100);
      const hasUrl = l.url && l.url.trim().length > 0;
      const safeId = l.id || `default_${idx}`;

      if (hasUrl) {
        dataMap[`lec_${safeId}`] = { url: l.url, title: l.title };
      }

      html += `<div class="app-card shadow-sm animate-fade-up" style="animation-delay:${idx * 0.08}s"><div class="h-36 bg-gradient-to-br ${color.from} ${color.to} flex items-center justify-center relative border-b" style="border-color:var(--app-border)"><i class="fa-solid fa-book-open text-5xl ${color.text} opacity-40"></i><span class="absolute top-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-lg text-white border border-white/10 shadow-lg backdrop-blur-sm" style="background:rgba(0,0,0,0.5)">${escapeHtml(l.duration || '40 min')}</span></div><div class="p-4"><span class="badge mb-2.5" style="background:${color.bg};color:${color.solid};border-color:${color.border}"><i class="fa-solid fa-circle text-[6px]"></i> ${escapeHtml(l.subject)}</span><h3 class="font-bold text-sm mb-1" style="color:var(--app-text)">${escapeHtml(l.title)}</h3><p class="text-xs line-clamp-2 leading-relaxed" style="color:var(--app-text-dim)">${escapeHtml(l.chapter)} \u2022 ${escapeHtml(l.subject)} fundamentals.</p><div class="mt-3.5 flex items-center gap-3"><div class="progress-track flex-1"><div class="progress-fill" style="background:${color.solid};width:${progress}%"></div></div><span class="text-[10px] font-mono font-bold" style="color:var(--app-text-dim)">${l.current || 0}/${l.total || 12}</span></div>${hasUrl ? `<button type="button" onclick="App.openLectureById('${safeId}')" class="app-btn mt-3 w-full" style="padding:10px 16px;font-size:12px;background:${color.solid};color:#fff"><i class="fa-solid fa-play"></i><span>Watch Lecture</span></button>` : ''}</div></div>`;
    });
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<p class="text-sm text-center py-8 col-span-full" style="color:var(--app-text-dim)">Unable to load lectures.</p>';
  }
}

function openLectureById(id) {
  const data = dataMap[`lec_${id}`];
  if (data) openLecture(data.url, data.title);
}

function openLecture(url, title) {
  closeAllModals();
  const modal = $('#lecture-modal');
  const titleEl = $('#lecture-modal-title');
  const iframe = $('#lecture-iframe');
  const linkEl = $('#lecture-external-link');
  if (!modal) return;
  if (titleEl) titleEl.textContent = title || 'Watch Lecture';

  let embedUrl = url || '';
  if (url && url.includes('youtube.com/watch?v=')) {
    const vId = url.split('v=')[1]?.split('&')[0];
    if (vId) embedUrl = `https://www.youtube.com/embed/${vId}?rel=0&modestbranding=1`;
  } else if (url && url.includes('youtu.be/')) {
    const vId = url.split('youtu.be/')[1];
    if (vId) embedUrl = `https://www.youtube.com/embed/${vId}?rel=0&modestbranding=1`;
  } else if (url && url.includes('drive.google.com/file/d/')) {
    const after = url.substring(url.indexOf('drive.google.com/file/d/') + 24);
    const fileId = after.split('/')[0].split('?')[0];
    embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
  }

  if (iframe) iframe.src = embedUrl;
  if (linkEl) linkEl.href = url;
  modal.classList.add('open');
}

function closeLecture() {
  const modal = $('#lecture-modal');
  const iframe = $('#lecture-iframe');
  if (modal) modal.classList.remove('open');
  if (iframe) iframe.src = '';
}

// ===== MOCK TESTS =====
async function loadTests() {
  const container = $('#tests-grid');
  if (!container || !db) return;
  container.innerHTML = '<div class="space-y-4"><div class="skeleton h-32 rounded-2xl"></div><div class="skeleton h-32 rounded-2xl"></div></div>';
  try {
    const snap = await db.collection('tests').orderBy('createdAt', 'desc').get();
    if (snap.empty) {
      container.innerHTML = '<div class="text-center py-14"><div class="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style="background:var(--app-surface2);border:1px solid var(--app-border)"><i class="fa-solid fa-file-circle-check text-2xl" style="color:var(--app-text-dim)"></i></div><p class="text-sm font-semibold" style="color:var(--app-text-muted)">No mock tests available yet</p><p class="text-xs mt-1" style="color:var(--app-text-dim)">Check back after admin adds tests.</p></div>';
      return;
    }
    let html = '';
    snap.docs.forEach((docItem, idx) => {
      const t = docItem.data();
      if (state.activeSubject !== 'all' && t.subject !== state.activeSubject) return;
      const color = subjectMeta[t.subject] || subjectMeta.Physics;
      const uid = `test_${docItem.id}`;
      dataMap[uid] = { id: docItem.id, title: t.title, subject: t.subject, link: t.link, duration: t.duration || 60 };

      html += `<div class="app-card p-5 animate-fade-up shadow-sm" style="animation-delay:${idx * 0.08}s"><div class="flex items-start justify-between gap-3 mb-3"><div class="flex items-center gap-2.5"><div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:${color.bg};border:1px solid ${color.border}"><i class="fa-solid fa-file-pen text-sm" style="color:${color.solid}"></i></div><div><span class="badge" style="background:${color.bg};color:${color.solid};border-color:${color.border}">${escapeHtml(t.subject)}</span><h3 class="font-bold text-sm mt-1" style="color:var(--app-text)">${escapeHtml(t.title)}</h3></div></div><span class="text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0" style="background:var(--app-surface2);border-color:var(--app-border);color:var(--app-text-dim)">${t.duration || 60}m</span></div><p class="text-xs leading-relaxed mb-4 line-clamp-2" style="color:var(--app-text-muted)">${escapeHtml(t.description || 'Practice test following UP Board pattern.')}</p><div class="flex items-center justify-between"><span class="text-[11px] font-bold" style="color:var(--app-text-dim)">${t.marks || 100} Marks</span><button type="button" onclick="App.openTestById('${uid}')" class="app-btn" style="padding:10px 20px;font-size:13px;background:${color.solid};color:#fff"><i class="fa-solid fa-play"></i><span>Start Test</span></button></div></div>`;
    });
    if (!html) {
      container.innerHTML = '<p class="text-sm text-center py-8" style="color:var(--app-text-dim)">No tests for this subject yet.</p>';
      return;
    }
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<p class="text-sm text-center py-8" style="color:var(--app-text-dim)">Unable to load tests.</p>';
  }
}

function openTestById(uid) {
  const data = dataMap[uid];
  if (!data) return;
  openTest(data.id, data.title, data.subject, data.link, data.duration);
}

function openTest(id, title, subject, link, duration) {
  closeAllModals();
  const modal = $('#test-modal');
  const titleEl = $('#test-modal-title');
  const subjectEl = $('#test-modal-subject');
  const iframe = $('#test-iframe');
  const external = $('#test-external-link');
  const timerEl = $('#test-modal-timer');
  if (!modal) return;
  if (titleEl) titleEl.textContent = title || 'Mock Test';
  if (subjectEl) subjectEl.textContent = subject || 'Subject';
  if (external) external.href = link || '#';

  let embedUrl = link || '';
  const driveIdx = embedUrl.indexOf('drive.google.com/file/d/');
  if (driveIdx !== -1) {
    const after = embedUrl.substring(driveIdx + 24);
    const fileId = after.split('/')[0].split('?')[0];
    embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
  }
  if (iframe) iframe.src = embedUrl;
  modal.classList.add('open');

  let remaining = (duration || 60) * 60;
  if (state.testTimerInterval) clearInterval(state.testTimerInterval);

  const updateTestTimer = () => {
    const m = Math.floor(remaining / 60).toString().padStart(2, '0');
    const s = (remaining % 60).toString().padStart(2, '0');
    if (timerEl) timerEl.textContent = `${m}:${s}`;
    if (remaining <= 300 && timerEl) timerEl.style.color = 'var(--app-danger)';
    if (remaining <= 0) {
      clearInterval(state.testTimerInterval);
      if (timerEl) timerEl.textContent = 'TIME UP';
    }
    remaining--;
  };
  updateTestTimer();
  state.testTimerInterval = setInterval(updateTestTimer, 1000);
}

function closeTest() {
  const modal = $('#test-modal');
  const iframe = $('#test-iframe');
  if (modal) modal.classList.remove('open');
  if (iframe) iframe.src = '';
  if (state.testTimerInterval) {
    clearInterval(state.testTimerInterval);
    state.testTimerInterval = null;
  }
}

// ===== SOCIAL FEED =====
async function loadFeed() {
  const container = $('#social-feed');
  if (!container || !db) return;
  container.innerHTML = '<p class="text-sm text-center py-12" style="color:var(--app-text-dim)">Loading feed...</p>';
  try {
    const snap = await db.collection('posts').orderBy('createdAt', 'desc').limit(50).get();
    if (snap.empty) {
      container.innerHTML = '<div class="text-center py-14"><div class="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style="background:var(--app-surface2);border:1px solid var(--app-border)"><i class="fa-solid fa-rss text-2xl" style="color:var(--app-text-dim)"></i></div><p class="text-sm font-semibold" style="color:var(--app-text-muted)">No posts yet</p><p class="text-xs mt-1" style="color:var(--app-text-dim)">Admin posts will appear here.</p></div>';
      return;
    }
    let html = '';
    snap.docs.forEach((docItem) => {
      html += renderPost(docItem.data(), docItem.id);
    });
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<p class="text-sm text-center py-8" style="color:var(--app-text-dim)">Unable to load feed.</p>';
  }
}

async function loadFeedPreview() {
  const container = $('#feed-preview');
  if (!container || !db) return;
  try {
    const snap = await db.collection('posts').orderBy('createdAt', 'desc').limit(2).get();
    if (snap.empty) {
      container.innerHTML = '<p class="text-xs text-center py-2" style="color:var(--app-text-dim)">No posts yet.</p>';
      return;
    }
    let html = '';
    snap.docs.forEach((docItem) => {
      const p = docItem.data();
      const isAdmin = p.authorEmail === ADMIN_EMAIL;
      html += `<div class="flex items-start gap-3 p-3 rounded-xl border" style="background:var(--app-surface2);border-color:var(--app-border)"><div class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ${isAdmin ? 'avatar-frame-founder' : ''}" style="background:var(--app-surface2)">${p.authorPhoto ? `<img src="${escapeHtml(p.authorPhoto)}" alt="" class="w-full h-full object-cover">` : `<span class="text-xs font-bold flex items-center justify-center w-full h-full" style="color:var(--app-accent)">${escapeHtml((p.author || 'U').charAt(0))}</span>`}</div><div class="flex-1 min-w-0"><div class="flex items-center gap-1.5 mb-0.5"><p class="text-xs font-bold" style="color:var(--app-text)">${escapeHtml(p.author || 'Anonymous')}</p>${isAdmin ? '<i class="fa-solid fa-circle-check text-[8px]" style="color:#3b82f6"></i>' : ''}</div><p class="text-xs line-clamp-2" style="color:var(--app-text-muted)">${escapeHtml(p.text || '')}</p></div></div>`;
    });
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<p class="text-xs text-center py-2" style="color:var(--app-text-dim)">Unable to load preview.</p>';
  }
}

function renderPost(post, postId) {
  const isAdmin = post.authorEmail === ADMIN_EMAIL;
  const isLiked = (post.likes || []).includes(state.user?.uid || '');
  const likeCount = (post.likes || []).length;
  const authorPhoto = post.authorPhoto || '';
  const authorInitial = escapeHtml((post.author || 'U').charAt(0));
  const authorName = escapeHtml(post.author || 'Anonymous');
  const timeStr = formatTime(post.createdAt);
  const textContent = post.text ? escapeHtml(post.text) : '';
  const imageContent = post.imageUrl ? `<div class="post-image rounded-xl overflow-hidden border mb-3" style="border-color:var(--app-border)"><img src="${escapeHtml(post.imageUrl)}" alt="Post image" class="w-full object-cover" loading="lazy" onerror="this.style.display='none'"></div>` : '';

  const avatarHtml = authorPhoto
    ? `<img src="${escapeHtml(authorPhoto)}" alt="" class="w-full h-full object-cover">`
    : `<span class="text-sm font-bold flex items-center justify-center w-full h-full" style="color:var(--app-accent)">${authorInitial}</span>`;

  const adminBadgeHtml = isAdmin
    ? `<i class="fa-solid fa-circle-check text-xs" style="color:#3b82f6"></i><span class="text-[9px] font-bold px-1.5 py-0.5 rounded" style="background:var(--app-accent);color:#1a1100">Founder</span>`
    : '';

  const heartClass = isLiked ? 'fa-solid fa-heart fa-beat' : 'fa-regular fa-heart';
  const likeColor = isLiked ? '#ef4444' : 'var(--app-text-dim)';

  return `<div class="feed-post p-5"><div class="flex items-center gap-3 mb-3"><div class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ${isAdmin ? 'avatar-frame-founder' : ''}" style="background:var(--app-surface2)">${avatarHtml}</div><div class="flex-1 min-w-0"><div class="flex items-center gap-2 flex-wrap"><p class="text-sm font-bold" style="color:var(--app-text)">${authorName}</p>${adminBadgeHtml}</div><p class="text-[10px]" style="color:var(--app-text-dim)">${timeStr}</p></div></div>${textContent ? `<p class="text-sm leading-relaxed mb-3" style="color:var(--app-text-muted)">${textContent}</p>` : ''}${imageContent}<div class="flex items-center gap-4 pt-2 border-t" style="border-color:var(--app-border)"><button type="button" onclick="App.likePost('${postId}')" class="like-btn ${isLiked ? 'liked' : ''}" style="color:${likeColor}"><i class="${heartClass}"></i><span>${likeCount}</span></button><span class="text-[11px]" style="color:var(--app-text-dim)">${likeCount} ${likeCount === 1 ? 'like' : 'likes'}</span></div></div>`;
}

async function likePost(postId) {
  if (!state.user || !db) { showToast('Please login to like', 'error'); return; }
  try {
    const postRef = db.collection('posts').doc(postId);
    const doc = await postRef.get();
    if (!doc.exists) return;
    const likes = doc.data().likes || [];
    const uid = state.user.uid;
    if (likes.includes(uid)) {
      await postRef.update({ likes: firebase.firestore.FieldValue.arrayRemove(uid) });
    } else {
      await postRef.update({ likes: firebase.firestore.FieldValue.arrayUnion(uid) });
    }
    loadFeed();
    loadFeedPreview();
  } catch (e) {
    showToast('Failed to like', 'error');
  }
}

// ===== ADMIN SOCIAL POST =====
async function createSocialPost(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!state.user || !db) { showToast('Not authenticated', 'error'); return; }

  const textEl = $('#post-text');
  const imageUrlEl = $('#post-image-url');
  const text = textEl?.value?.trim() || '';
  const imageUrl = imageUrlEl?.value || '';

  if (!text && !imageUrl) { showToast('Please add text or image', 'error'); return; }

  try {
    await db.collection('posts').add({
      text: text,
      imageUrl: imageUrl,
      author: state.profile?.name || state.user.displayName || 'Mohammad Arshad',
      authorEmail: state.user.email || '',
      authorPhoto: state.profile?.photoURL || state.user.photoURL || '',
      createdAt: new Date().toISOString(),
      likes: []
    });
    showToast('Post published!');
    const form = $('#social-post-form');
    if (form) form.reset();
    const preview = $('#post-image-preview');
    if (preview) preview.classList.add('hidden');
    if (imageUrlEl) imageUrlEl.value = '';
    loadFeed();
    loadFeedPreview();
    loadAdminSocialPosts();
  } catch (err) {
    showToast(err.message || 'Failed to publish', 'error');
  }
}

async function handlePostImageSelect(input) {
  const file = validateImageFile(input);
  if (!file) return;
  try {
    showToast('Compressing image...', 'info');
    const blob = await compressImage(file);
    const path = `posts/${Date.now()}_${state.user.uid}.jpg`;
    const url = await uploadImageBlob(blob, path);
    const urlEl = $('#post-image-url');
    const preview = $('#post-image-preview');
    if (urlEl) urlEl.value = url;
    if (preview) {
      preview.classList.remove('hidden');
      const img = preview.querySelector('img');
      if (img) img.src = url;
    }
    showToast('Image ready!');
  } catch (err) {
    showToast(err.message || 'Upload failed', 'error');
  }
}

// ===== STORIES =====
async function loadStories() {
  const container = $('#social-stories-row');
  if (!container || !db) return;
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const snap = await db.collection('stories').where('createdAt', '>=', oneDayAgo).orderBy('createdAt', 'desc').limit(20).get();
    if (snap.empty) {
      container.innerHTML = `<p class="text-[10px] flex items-center" style="color:var(--app-text-dim)">No stories yet</p>`;
      return;
    }
    let html = '';
    snap.docs.forEach((docItem) => {
      const s = docItem.data();
      const isAdmin = s.authorEmail === ADMIN_EMAIL;
      const authorName = escapeHtml(s.author || 'User');
      const authorInitial = escapeHtml((s.author || 'U').charAt(0));
      const authorPhoto = s.authorPhoto || '';
      const avatarHtml = authorPhoto
        ? `<img src="${escapeHtml(authorPhoto)}" alt="" class="w-full h-full object-cover">`
        : `<span class="text-xs font-bold flex items-center justify-center w-full h-full" style="color:var(--app-accent)">${authorInitial}</span>`;
      html += `<div class="text-center flex-shrink-0 cursor-pointer" onclick="App.viewStory('${docItem.id}')"><div class="story-ring ${isAdmin ? '' : 'story-ring-viewed'}"><div class="story-inner">${avatarHtml}</div></div><p class="text-[10px] font-bold mt-1.5 truncate max-w-[60px]" style="color:var(--app-text-dim)">${authorName}</p></div>`;
    });
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<p class="text-[10px]" style="color:var(--app-text-dim)">Unable to load stories</p>`;
  }
}

async function viewStory(storyId) {
  if (!db) return;
  try {
    const doc = await db.collection('stories').doc(storyId).get();
    if (!doc.exists) return;
    const s = doc.data();
    const modal = $('#story-modal');
    const img = $('#story-viewer-img');
    const nameEl = $('#story-viewer-name');
    const avatar = $('#story-viewer-avatar');
    const timeEl = $('#story-viewer-time');
    const progress = $('#story-progress');

    if (img) img.src = s.imageUrl || '';
    if (nameEl) nameEl.textContent = s.author || 'Anonymous';
    if (avatar) avatar.src = s.authorPhoto || '';
    if (timeEl) timeEl.textContent = formatTime(s.createdAt);
    if (progress) progress.style.width = '0%';

    modal.classList.add('open');

    setTimeout(() => {
      if (progress) {
        progress.style.transition = 'width 5s linear';
        progress.style.width = '100%';
      }
    }, 50);

    state.storyTimeout = setTimeout(() => {
      closeStoryModal();
    }, 5050);
  } catch (e) {}
}

function closeStoryModal() {
  const modal = $('#story-modal');
  if (modal) modal.classList.remove('open');
  const progress = $('#story-progress');
  if (progress) {
    progress.style.transition = 'none';
    progress.style.width = '0%';
  }
  if (state.storyTimeout) {
    clearTimeout(state.storyTimeout);
    state.storyTimeout = null;
  }
}

function openStoryCamera() {
  showToast('Story upload coming in next update!', 'info');
}

// ===== YOUTUBE SEARCH =====
async function searchYouTube(e) {
  e.preventDefault();
  e.stopPropagation();
  const queryEl = $('#yt-query');
  const resultsEl = $('#yt-results');
  if (!queryEl || !resultsEl) return;
  const query = queryEl.value.trim();
  if (!query) return;
  if (!ytApiKey) {
    resultsEl.innerHTML = '<div class="text-center py-10 text-sm" style="color:var(--app-text-dim)">YouTube search unavailable.</div>';
    return;
  }
  resultsEl.innerHTML = '<div class="col-span-full text-center py-10 text-sm" style="color:var(--app-text-dim)"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Searching...</div>';
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=12&key=${ytApiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.items || !data.items.length) {
      resultsEl.innerHTML = '<div class="text-center py-10 text-sm" style="color:var(--app-text-dim)">No results found.</div>';
      return;
    }
    let html = '';
    data.items.forEach((item) => {
      const vid = item.id.videoId;
      const title = item.snippet.title;
      const channel = item.snippet.channelTitle;
      const thumb = item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '';
      const safeTitle = escapeHtml(title);
      const safeChannel = escapeHtml(channel);
      const uid = `yt_${vid}`;
      dataMap[uid] = { videoId: vid, title: title };
      html += `<div onclick="App.playVideoById('${uid}')" class="app-card cursor-pointer shadow-sm"><div class="relative aspect-video" style="background:var(--app-surface2)"><img src="${thumb}" alt="" class="w-full h-full object-cover opacity-90" loading="lazy"><div class="absolute inset-0 flex items-center justify-center" style="background:rgba(0,0,0,0.2)"><div class="w-10 h-10 rounded-full flex items-center justify-center pl-0.5 shadow-lg" style="background:rgba(255,255,255,0.9)"><i class="fa-solid fa-play text-sm" style="color:#000"></i></div></div></div><div class="p-3"><h4 class="text-sm font-bold line-clamp-2 leading-snug" style="color:var(--app-text)">${safeTitle}</h4><p class="text-xs mt-1" style="color:var(--app-text-dim)">${safeChannel}</p></div></div>`;
    });
    resultsEl.innerHTML = html;
  } catch (err) {
    resultsEl.innerHTML = '<div class="text-center py-10 text-sm" style="color:var(--app-text-dim)"><i class="fa-solid fa-triangle-exclamation mb-2 block text-xl" style="color:var(--app-border)"></i>Unable to load results.</div>';
  }
}

function playVideoById(uid) {
  const data = dataMap[uid];
  if (data) playVideo(data.videoId, data.title);
}

function playVideo(id, title) {
  closeAllModals();
  const modalTitle = $('#modal-title');
  const iframe = $('#video-iframe');
  const modal = $('#video-modal');
  if (modalTitle) modalTitle.textContent = title || 'Video';
  if (iframe) iframe.src = `https://www.youtube.com/embed/${id || ''}?autoplay=1&rel=0&modestbranding=1`;
  if (modal) modal.classList.add('open');
}

function closeVideo() {
  const modal = $('#video-modal');
  const iframe = $('#video-iframe');
  if (modal) modal.classList.remove('open');
  if (iframe) iframe.src = '';
}

// ===== CALCULATOR =====
function openCalculator() {
  const modal = $('#calc-modal');
  if (modal) modal.classList.add('open');
  closeSidebar();
}

function closeCalculator() {
  const modal = $('#calc-modal');
  if (modal) modal.classList.remove('open');
}

function calcInput(val) {
  const display = $('#calc-display');
  if (!display) return;
  if (val === 'C') {
    state.calcExpr = '';
    display.textContent = '0';
  } else if (val === 'del') {
    state.calcExpr = state.calcExpr.slice(0, -1);
    display.textContent = state.calcExpr || '0';
  } else if (val === '=') {
    try {
      const result = Function('"use strict"; return (' + state.calcExpr + ')')();
      state.calcExpr = String(result);
      display.textContent = state.calcExpr;
    } catch (e) {
      display.textContent = 'Error';
      state.calcExpr = '';
    }
  } else {
    state.calcExpr += val;
    display.textContent = state.calcExpr;
  }
}

// ===== NOTEPAD =====
function openNotepad() {
  const modal = $('#notepad-modal');
  if (modal) modal.classList.add('open');
  const area = $('#notepad-area');
  if (area) area.value = localStorage.getItem('studyPro_notes') || '';
  closeSidebar();
}

function closeNotepad() {
  const modal = $('#notepad-modal');
  if (modal) modal.classList.remove('open');
}

function saveNotepad() {
  const area = $('#notepad-area');
  if (area) {
    localStorage.setItem('studyPro_notes', area.value);
    showToast('Notes saved!');
  }
}

function clearNotepad() {
  const area = $('#notepad-area');
  if (area) {
    area.value = '';
    localStorage.setItem('studyPro_notes', '');
    showToast('Notes cleared!');
  }
}

// ===== TODO =====
function openTodo() {
  const modal = $('#todo-modal');
  if (modal) modal.classList.add('open');
  renderTodos();
  closeSidebar();
}

function closeTodo() {
  const modal = $('#todo-modal');
  if (modal) modal.classList.remove('open');
}

function renderTodos() {
  const list = $('#todo-list');
  if (!list) return;
  if (state.todos.length === 0) {
    list.innerHTML = '<p class="text-xs text-center py-4" style="color:var(--app-text-dim)">No tasks yet. Add one above!</p>';
    return;
  }
  let html = '';
  state.todos.forEach((todo, idx) => {
    const doneBg = todo.done ? 'var(--app-success)' : 'transparent';
    const checkIcon = todo.done ? '<i class="fa-solid fa-check text-white text-[10px]"></i>' : '';
    const textDecor = todo.done ? 'line-through' : '';
    const textColor = todo.done ? 'var(--app-text-dim)' : 'var(--app-text)';
    html += `<div class="flex items-center gap-3 p-3 rounded-xl border" style="background:var(--app-surface2);border-color:var(--app-border)"><button type="button" onclick="App.toggleTodo(${idx})" class="w-5 h-5 rounded border flex items-center justify-center shrink-0" style="border-color:var(--app-border);background:${doneBg}">${checkIcon}</button><span class="text-sm flex-1 ${textDecor}" style="color:${textColor}">${escapeHtml(todo.text)}</span><button type="button" onclick="App.deleteTodo(${idx})" class="w-7 h-7 rounded-lg flex items-center justify-center" style="background:rgba(239,68,68,0.1)"><i class="fa-solid fa-xmark text-xs" style="color:var(--app-danger)"></i></button></div>`;
  });
  list.innerHTML = html;
}

function addTodo() {
  const input = $('#todo-input');
  if (!input || !input.value.trim()) return;
  state.todos.push({ text: input.value.trim(), done: false });
  localStorage.setItem('studyPro_todos', JSON.stringify(state.todos));
  input.value = '';
  renderTodos();
}

function toggleTodo(idx) {
  if (state.todos[idx]) {
    state.todos[idx].done = !state.todos[idx].done;
    localStorage.setItem('studyPro_todos', JSON.stringify(state.todos));
    renderTodos();
  }
}

function deleteTodo(idx) {
  state.todos.splice(idx, 1);
  localStorage.setItem('studyPro_todos', JSON.stringify(state.todos));
  renderTodos();
}

// ===== TERMS & ABOUT =====
function openTerms() {
  const modal = $('#terms-modal');
  if (modal) modal.classList.add('open');
  closeSidebar();
}

function closeTerms() {
  const modal = $('#terms-modal');
  if (modal) modal.classList.remove('open');
}

function openAbout() {
  const modal = $('#about-modal');
  if (modal) modal.classList.add('open');
  closeSidebar();
}

function closeAbout() {
  const modal = $('#about-modal');
  if (modal) modal.classList.remove('open');
}

// ===== PWA INSTALL =====
function installApp() {
  if (state.installPrompt) {
    state.installPrompt.prompt();
  } else {
    showToast('Install not available. Add to home screen manually.', 'info');
  }
}

// ===== TAB ROUTER =====
function switchTab(tab) {
  if (!tab) return;
  closeAllOverlays();
  state.tab = tab;
  $$('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active-tab', btn.dataset.tab === tab);
  });
  $$('.tab-view').forEach((v) => {
    v.classList.remove('active');
  });
  const target = $(`#tab-${tab}`);
  if (target) {
    target.classList.add('active');
    target.querySelectorAll('.animate-fade-up').forEach((el) => {
      el.style.animation = 'none';
      void el.offsetHeight;
      el.style.animation = '';
    });
  }
  const scroll = $('#main-scroll');
  if (scroll) scroll.scrollTop = 0;
  if (tab === 'home') {
    loadNotices();
    loadDateSheet();
    loadFormulaOfDay();
    loadWordOfDay();
    loadFeedPreview();
    checkNotifications();
  }
  if (tab === 'study') {
    loadLectures();
    loadTests();
  }
  if (tab === 'social') {
    loadStories();
    loadFeed();
  }
}

function filterSubject(sub) {
  state.activeSubject = sub || 'all';
  $$('.sub-tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.sub === state.activeSubject);
  });
  loadLectures();
  loadTests();
}

// ===== SIDEBAR =====
function toggleSidebar() {
  state.sidebarOpen = !state.sidebarOpen;
  const sidebar = $('#sidebar');
  const overlay = $('#sidebar-overlay');
  if (sidebar) sidebar.classList.toggle('open', state.sidebarOpen);
  if (overlay) overlay.classList.toggle('open', state.sidebarOpen);
}

function closeSidebar() {
  state.sidebarOpen = false;
  const sidebar = $('#sidebar');
  const overlay = $('#sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

// ===== AUTH VIEW SWITCHER =====
function showLogin() {
  const loginBox = $('#login-box');
  const regBox = $('#register-box');
  if (loginBox) loginBox.classList.remove('hidden');
  if (regBox) regBox.classList.add('hidden');
}

function showRegister() {
  const loginBox = $('#login-box');
  const regBox = $('#register-box');
  if (loginBox) loginBox.classList.add('hidden');
  if (regBox) regBox.classList.remove('hidden');
}

// ===== ADMIN =====
function openAdmin() {
  closeAllModals();
  const panel = $('#admin-panel');
  if (panel) panel.classList.add('open');
  closeSidebar();
  loadAdminTests();
  loadDateSheet();
  loadStats();
  loadAdminNotices();
  loadAdminLectures();
  loadAdminHomework();
  loadAdminFormulas();
  loadAdminSocialPosts();
  checkAdminSoonToggle();
}

function closeAdmin() {
  const panel = $('#admin-panel');
  if (panel) panel.classList.remove('open');
  const scroll = $('#admin-scroll');
  if (scroll) scroll.scrollTop = 0;
}

async function checkAdminSoonToggle() {
  if (!db) return;
  try {
    const doc = await db.collection('settings').doc('examTimer').get();
    const isSoon = doc.exists && doc.data().soonMode;
    const knob = $('#admin-soon-knob');
    const btn = $('#admin-soon-toggle');
    if (isSoon) {
      if (knob) { knob.style.left = 'auto'; knob.style.right = '2px'; }
      if (btn) btn.style.background = 'var(--app-success)';
    } else {
      if (knob) { knob.style.left = '2px'; knob.style.right = 'auto'; }
      if (btn) btn.style.background = 'var(--app-border)';
    }
  } catch (e) {}
}

async function toggleExamSoon() {
  if (!db) return;
  try {
    const docRef = db.collection('settings').doc('examTimer');
    const doc = await docRef.get();
    const currentMode = doc.exists && doc.data().soonMode;
    const newMode = !currentMode;
    await docRef.set({ soonMode: newMode });
    const knob = $('#admin-soon-knob');
    const btn = $('#admin-soon-toggle');
    if (newMode) {
      if (knob) { knob.style.left = 'auto'; knob.style.right = '2px'; }
      if (btn) btn.style.background = 'var(--app-success)';
      showToast('Timer set to "Soon..." for all students', 'info');
    } else {
      if (knob) { knob.style.left = '2px'; knob.style.right = 'auto'; }
      if (btn) btn.style.background = 'var(--app-border)';
      showToast('Timer restored to normal', 'info');
    }
  } catch (err) {
    showToast(err.message || 'Failed to toggle', 'error');
  }
}

async function loadStats() {
  if (!db) return;
  try {
    const usersSnap = await db.collection('users').get();
    const testsSnap = await db.collection('tests').get();
    const usersEl = $('#stat-users');
    const testsEl = $('#stat-tests');
    if (usersEl) usersEl.textContent = usersSnap.size;
    if (testsEl) testsEl.textContent = testsSnap.size;
  } catch (e) {}
}

// ===== EDIT PROFILE =====
function openEditModal() {
  const modal = $('#edit-modal');
  if (modal) modal.classList.add('open');
}

function closeEditModal() {
  const modal = $('#edit-modal');
  if (modal) modal.classList.remove('open');
}

// ===== ADMIN FORMS =====
async function publishNotice(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!db) return;
  try {
    await db.collection('notices').add({
      title: $('#notice-title')?.value || '',
      body: $('#notice-body')?.value || '',
      priority: $('#notice-priority')?.value || 'normal',
      createdAt: new Date().toISOString()
    });
    const form = $('#notice-form');
    if (form) form.reset();
    showToast('Notice published!');
    loadAdminNotices();
  } catch (e) {
    showToast(e.message || 'Failed', 'error');
  }
}

async function addLecture(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!db) return;
  try {
    await db.collection('lectures').add({
      title: $('#lec-title')?.value || '',
      subject: $('#lec-subject')?.value || '',
      chapter: $('#lec-chapter')?.value || '',
      url: $('#lec-url')?.value || '',
      progress: 0,
      current: 0,
      total: 12,
      duration: '40 min',
      createdAt: new Date().toISOString()
    });
    const form = $('#lecture-form');
    if (form) form.reset();
    showToast('Lecture added!');
    loadAdminLectures();
  } catch (e) {
    showToast(e.message || 'Failed', 'error');
  }
}

async function addMockTest(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!db) return;
  try {
    await db.collection('tests').add({
      title: $('#test-title')?.value || '',
      subject: $('#test-subject')?.value || '',
      description: $('#test-desc')?.value || '',
      link: $('#test-link')?.value || '',
      testDate: $('#test-date')?.value || '',
      duration: parseInt($('#test-duration')?.value || 60) || 60,
      marks: parseInt($('#test-marks')?.value || 100) || 100,
      createdAt: new Date().toISOString()
    });
    const form = $('#test-form');
    if (form) form.reset();
    showToast('Mock test added!');
    loadAdminTests();
  } catch (e) {
    showToast(e.message || 'Failed', 'error');
  }
}

async function addDateSheet(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!db) return;
  try {
    await db.collection('datesheet').add({
      name: $('#ds-name')?.value || '',
      subject: $('#ds-subject')?.value || '',
      date: $('#ds-date')?.value || '',
      shift: $('#ds-shift')?.value || 'Morning',
      time: $('#ds-time')?.value || '09:00',
      createdAt: new Date().toISOString()
    });
    const form = $('#datesheet-form');
    if (form) form.reset();
    showToast('Exam date added!');
    loadDateSheet();
    updateTimer();
  } catch (e) {
    showToast(e.message || 'Failed', 'error');
  }
}

// ===== ADMIN WIDGET PUBLISHERS =====
async function publishFormula(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!db) return;
  try {
    await db.collection('formulaOfDay').add({
      title: $('#formula-title')?.value || '',
      formula: $('#formula-math')?.value || '',
      description: $('#formula-desc')?.value || '',
      createdAt: new Date().toISOString()
    });
    const form = $('#formula-form');
    if (form) form.reset();
    showToast('Formula of the Day updated!');
    loadAdminFormulas();
  } catch (e) {
    showToast(e.message || 'Failed', 'error');
  }
}

async function publishWord(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!db) return;
  try {
    await db.collection('wordOfDay').add({
      word: $('#word-en')?.value || '',
      hindiMeaning: $('#word-hi')?.value || '',
      synonyms: $('#word-syn')?.value || '',
      example: $('#word-ex')?.value || '',
      createdAt: new Date().toISOString()
    });
    const form = $('#word-form');
    if (form) form.reset();
    showToast('Word of the Day updated!');
  } catch (e) {
    showToast(e.message || 'Failed', 'error');
  }
}

async function publishHomework(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!db) return;
  try {
    await db.collection('summerHomework').add({
      subject: $('#hw-subject')?.value || '',
      teacher: $('#hw-teacher')?.value || '',
      mobile: $('#hw-mobile')?.value || '',
      content: $('#hw-content')?.value || '',
      createdAt: new Date().toISOString()
    });
    const form = $('#homework-form');
    if (form) form.reset();
    showToast('Summer homework published!');
    loadAdminHomework();
  } catch (e) {
    showToast(e.message || 'Failed', 'error');
  }
}

// ===== DASHBOARD WIDGETS =====
async function loadFormulaOfDay() {
  const container = $('#formula-widget');
  if (!container || !db) return;
  try {
    const snap = await db.collection('formulaOfDay').orderBy('createdAt', 'desc').limit(1).get();
    if (snap.empty) {
      container.innerHTML = '<p class="text-sm text-center py-2" style="color:var(--app-text-dim)">No formula set yet.</p>';
      return;
    }
    const data = snap.docs[0].data();
    container.innerHTML = `<div class="p-3 rounded-xl border" style="background:var(--app-surface2);border-color:var(--app-border)"><p class="text-xs font-bold uppercase tracking-wider mb-1" style="color:var(--app-text-dim)">${escapeHtml(data.title || 'Formula')}</p><p class="text-lg font-extrabold font-display my-1 gold-shimmer">${escapeHtml(data.formula)}</p><p class="text-xs leading-relaxed" style="color:var(--app-text-muted)">${escapeHtml(data.description || '')}</p></div>`;
  } catch (e) {
    container.innerHTML = '<p class="text-sm text-center py-2" style="color:var(--app-text-dim)">Unable to load formula.</p>';
  }
}

async function loadWordOfDay() {
  const container = $('#word-widget');
  if (!container || !db) return;
  try {
    const snap = await db.collection('wordOfDay').orderBy('createdAt', 'desc').limit(1).get();
    if (snap.empty) {
      container.innerHTML = '<p class="text-sm text-center py-2" style="color:var(--app-text-dim)">No word set yet.</p>';
      return;
    }
    const data = snap.docs[0].data();
    const syn = data.synonyms ? `<p class="text-[11px] mt-1.5"><span style="color:var(--app-text-dim)">Synonyms: </span><span style="color:var(--app-text-muted)">${escapeHtml(data.synonyms)}</span></p>` : '';
    const ex = data.example ? `<p class="text-[11px] mt-1 italic" style="color:var(--app-text-muted)">"${escapeHtml(data.example)}"</p>` : '';
    container.innerHTML = `<div class="p-3 rounded-xl border" style="background:var(--app-surface2);border-color:var(--app-border)"><div class="flex items-baseline gap-2 mb-1"><p class="text-lg font-extrabold font-display gold-shimmer">${escapeHtml(data.word)}</p><p class="text-xs font-medium" style="color:var(--app-text-muted)">${escapeHtml(data.hindiMeaning || '')}</p></div>${syn}${ex}</div>`;
  } catch (e) {
    container.innerHTML = '<p class="text-sm text-center py-2" style="color:var(--app-text-dim)">Unable to load word.</p>';
  }
}

// ===== SUMMER HOMEWORK =====
function openHomework() {
  closeAllModals();
  const view = $('#homework-view');
  if (view) view.classList.add('open');
  closeSidebar();
  loadHomework();
}

function closeHomework() {
  const view = $('#homework-view');
  if (view) view.classList.remove('open');
  const scroll = $('#homework-scroll');
  if (scroll) scroll.scrollTop = 0;
}

function filterHomework(sub) {
  state.activeHomeworkSubject = sub || 'Hindi';
  $$('.hw-tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.hw === state.activeHomeworkSubject);
  });
  loadHomework();
}

async function loadHomework() {
  const container = $('#homework-list');
  if (!container || !db) return;
  container.innerHTML = '<div class="space-y-4"><div class="skeleton h-32 rounded-2xl"></div><div class="skeleton h-32 rounded-2xl"></div></div>';
  try {
    const snap = await db.collection('summerHomework').where('subject', '==', state.activeHomeworkSubject).orderBy('createdAt', 'desc').get();
    if (snap.empty) {
      container.innerHTML = `<div class="text-center py-14"><div class="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style="background:var(--app-surface2);border:1px solid var(--app-border)"><i class="fa-solid fa-sun text-2xl" style="color:var(--app-text-dim)"></i></div><p class="text-sm font-semibold" style="color:var(--app-text-muted)">No homework for ${escapeHtml(state.activeHomeworkSubject)} yet</p><p class="text-xs mt-1" style="color:var(--app-text-dim)">Check back later or contact your teacher.</p></div>`;
      return;
    }
    let html = '';
    snap.docs.forEach((docItem, idx) => {
      const h = docItem.data();
      const subColors = { Hindi: '#f97316', English: '#8b5cf6', Mathematics: '#f59e0b', Physics: '#3b82f6', Chemistry: '#22c55e' };
      const color = subColors[h.subject] || '#3b82f6';
      const teacherName = escapeHtml(h.teacher);
      const subjectName = escapeHtml(h.subject);
      const mobileNum = escapeHtml(h.mobile);
      const contentText = escapeHtml(h.content);
      html += `<div class="app-card p-5 animate-fade-up shadow-sm" style="animation-delay:${idx * 0.08}s"><div class="flex items-start justify-between gap-3 mb-3"><div class="flex items-center gap-2.5"><div class="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style="background:${color}">${h.subject ? h.subject.charAt(0) : 'H'}</div><div><p class="text-sm font-bold" style="color:var(--app-text)">${teacherName}</p><p class="text-[11px]" style="color:var(--app-text-dim)">${subjectName}</p></div></div>${state.isAdmin ? `<button type="button" onclick="App.handleAdminDelete('homework','${docItem.id}')" class="admin-delete-btn" title="Delete"><i class="fa-solid fa-trash text-xs"></i></button>` : ''}</div><a href="tel:${mobileNum}" class="inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold mb-3" style="background:var(--app-surface2);border-color:var(--app-border);color:var(--app-text);text-decoration:none"><i class="fa-solid fa-phone" style="color:var(--app-success)"></i><span>${mobileNum}</span></a><div class="p-3 rounded-xl border text-sm leading-relaxed hw-content" style="background:var(--app-surface2);border-color:var(--app-border);color:var(--app-text-muted)">${contentText}</div></div>`;
    });
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<p class="text-sm text-center py-8" style="color:var(--app-text-dim)">Unable to load homework.</p>';
  }
}

// ===== ADMIN MANAGE LISTS =====
async function loadAdminTests() {
  const container = $('#admin-tests-list');
  if (!container || !db) return;
  try {
    const snap = await db.collection('tests').orderBy('createdAt', 'desc').get();
    if (snap.empty) { container.innerHTML = '<p class="text-xs text-center py-4" style="color:var(--app-text-dim)">No tests added yet.</p>'; return; }
    let html = '';
    snap.docs.forEach((docItem) => {
      const t = docItem.data();
      html += `<div class="flex items-center justify-between p-3 rounded-xl border" style="background:var(--app-surface2);border-color:var(--app-border)"><div class="overflow-hidden"><p class="text-sm font-bold truncate" style="color:var(--app-text)">${escapeHtml(t.title)}</p><p class="text-[11px]" style="color:var(--app-text-dim)">${escapeHtml(t.subject)} \u2022 ${t.duration || 60}m</p></div><button type="button" onclick="App.handleAdminDelete('tests','${docItem.id}')" class="admin-delete-btn ml-2" title="Delete"><i class="fa-solid fa-trash text-xs"></i></button></div>`;
    });
    container.innerHTML = html;
  } catch (e) { console.error('Load admin tests error:', e); }
}

async function loadAdminNotices() {
  const container = $('#admin-notices-list');
  if (!container || !db) return;
  try {
    const snap = await db.collection('notices').orderBy('createdAt', 'desc').get();
    if (snap.empty) { container.innerHTML = '<p class="text-xs text-center py-4" style="color:var(--app-text-dim)">No notices yet.</p>'; return; }
    let html = '';
    snap.docs.forEach((docItem) => {
      const n = docItem.data();
      html += `<div class="flex items-center justify-between p-3 rounded-xl border" style="background:var(--app-surface2);border-color:var(--app-border)"><div class="overflow-hidden"><p class="text-sm font-bold truncate" style="color:var(--app-text)">${escapeHtml(n.title || 'Untitled')}</p><p class="text-[11px]" style="color:var(--app-text-dim)">${n.createdAt ? new Date(n.createdAt).toLocaleDateString() : 'Recently'}</p></div><button type="button" onclick="App.handleAdminDelete('notices','${docItem.id}')" class="admin-delete-btn ml-2" title="Delete"><i class="fa-solid fa-trash text-xs"></i></button></div>`;
    });
    container.innerHTML = html;
  } catch (e) { console.error('Load admin notices error:', e); }
}

async function loadAdminLectures() {
  const container = $('#admin-lectures-list');
  if (!container || !db) return;
  try {
    const snap = await db.collection('lectures').get();
    if (snap.empty) { container.innerHTML = '<p class="text-xs text-center py-4" style="color:var(--app-text-dim)">No lectures yet.</p>'; return; }
    let html = '';
    snap.docs.forEach((docItem) => {
      const l = docItem.data();
      html += `<div class="flex items-center justify-between p-3 rounded-xl border" style="background:var(--app-surface2);border-color:var(--app-border)"><div class="overflow-hidden"><p class="text-sm font-bold truncate" style="color:var(--app-text)">${escapeHtml(l.title)}</p><p class="text-[11px]" style="color:var(--app-text-dim)">${escapeHtml(l.subject)} \u2022 ${escapeHtml(l.chapter)}</p></div><button type="button" onclick="App.handleAdminDelete('lectures','${docItem.id}')" class="admin-delete-btn ml-2" title="Delete"><i class="fa-solid fa-trash text-xs"></i></button></div>`;
    });
    container.innerHTML = html;
  } catch (e) { console.error('Load admin lectures error:', e); }
}

async function loadAdminHomework() {
  const container = $('#admin-homework-list');
  if (!container || !db) return;
  try {
    const snap = await db.collection('summerHomework').orderBy('createdAt', 'desc').get();
    if (snap.empty) { container.innerHTML = '<p class="text-xs text-center py-4" style="color:var(--app-text-dim)">No homework entries yet.</p>'; return; }
    let html = '';
    snap.docs.forEach((docItem) => {
      const h = docItem.data();
      html += `<div class="flex items-center justify-between p-3 rounded-xl border" style="background:var(--app-surface2);border-color:var(--app-border)"><div class="overflow-hidden"><p class="text-sm font-bold truncate" style="color:var(--app-text)">${escapeHtml(h.teacher)}</p><p class="text-[11px]" style="color:var(--app-text-dim)">${escapeHtml(h.subject)} \u2022 ${h.createdAt ? new Date(h.createdAt).toLocaleDateString() : 'Recently'}</p></div><button type="button" onclick="App.handleAdminDelete('homework','${docItem.id}')" class="admin-delete-btn ml-2" title="Delete"><i class="fa-solid fa-trash text-xs"></i></button></div>`;
    });
    container.innerHTML = html;
  } catch (e) { console.error('Load admin homework error:', e); }
}

async function loadAdminFormulas() {
  const container = $('#admin-formulas-list');
  if (!container || !db) return;
  try {
    const snap = await db.collection('formulaOfDay').orderBy('createdAt', 'desc').get();
    if (snap.empty) { container.innerHTML = '<p class="text-xs text-center py-4" style="color:var(--app-text-dim)">No formulas yet.</p>'; return; }
    let html = '';
    snap.docs.forEach((docItem) => {
      const f = docItem.data();
      html += `<div class="flex items-center justify-between p-3 rounded-xl border" style="background:var(--app-surface2);border-color:var(--app-border)"><div class="overflow-hidden"><p class="text-sm font-bold truncate" style="color:var(--app-text)">${escapeHtml(f.title || 'Formula')}</p><p class="text-[11px] font-mono" style="color:var(--app-text-dim)">${escapeHtml(f.formula || '')}</p></div><button type="button" onclick="App.handleAdminDelete('formulas','${docItem.id}')" class="admin-delete-btn ml-2" title="Delete"><i class="fa-solid fa-trash text-xs"></i></button></div>`;
    });
    container.innerHTML = html;
  } catch (e) { console.error('Load admin formulas error:', e); }
}

async function loadAdminSocialPosts() {
  const container = $('#admin-social-list');
  if (!container || !db) return;
  try {
    const snap = await db.collection('posts').orderBy('createdAt', 'desc').get();
    if (snap.empty) { container.innerHTML = '<p class="text-xs text-center py-4" style="color:var(--app-text-dim)">No posts yet.</p>'; return; }
    let html = '';
    snap.docs.forEach((docItem) => {
      const p = docItem.data();
      html += `<div class="flex items-center justify-between p-3 rounded-xl border" style="background:var(--app-surface2);border-color:var(--app-border)"><div class="overflow-hidden flex-1"><p class="text-sm font-bold truncate" style="color:var(--app-text)">${escapeHtml(p.text ? p.text.substring(0, 40) : 'Image post')}</p><p class="text-[11px]" style="color:var(--app-text-dim)">${escapeHtml(p.author)} \u2022 ${formatTime(p.createdAt)}</p></div><button type="button" onclick="App.handleAdminDelete('social','${docItem.id}')" class="admin-delete-btn ml-2" title="Delete"><i class="fa-solid fa-trash text-xs"></i></button></div>`;
    });
    container.innerHTML = html;
  } catch (e) { console.error('Load admin social error:', e); }
}

// ===== ADMIN DELETE ROUTER =====
function handleAdminDelete(type, id) {
  const callback = () => {
    switch (type) {
      case 'tests': return deleteTest(id);
      case 'notices': return deleteNotice(id);
      case 'lectures': return deleteLecture(id);
      case 'homework': return deleteHomework(id);
      case 'formulas': return deleteFormula(id);
      case 'datesheet': return deleteDateSheet(id);
      case 'social': return deleteSocialPost(id);
    }
  };
  requireAdminDelete(callback);
}

// ===== DELETE FUNCTIONS =====
async function deleteTest(id) {
  if (!db) return;
  try { await db.collection('tests').doc(id).delete(); showToast('Test deleted'); loadTests(); loadAdminTests(); } catch (e) { showToast(e.message || 'Delete failed', 'error'); }
}

async function deleteDateSheet(id) {
  if (!db) return;
  try { await db.collection('datesheet').doc(id).delete(); showToast('Date removed'); loadDateSheet(); updateTimer(); } catch (e) { showToast(e.message || 'Delete failed', 'error'); }
}

async function deleteNotice(id) {
  if (!db) return;
  try { await db.collection('notices').doc(id).delete(); showToast('Notice deleted'); loadNotices(); loadAdminNotices(); } catch (e) { showToast(e.message || 'Delete failed', 'error'); }
}

async function deleteLecture(id) {
  if (!db) return;
  try { await db.collection('lectures').doc(id).delete(); showToast('Lecture deleted'); loadLectures(); loadAdminLectures(); } catch (e) { showToast(e.message || 'Delete failed', 'error'); }
}

async function deleteHomework(id) {
  if (!db) return;
  try { await db.collection('summerHomework').doc(id).delete(); showToast('Homework deleted'); loadHomework(); loadAdminHomework(); } catch (e) { showToast(e.message || 'Delete failed', 'error'); }
}

async function deleteFormula(id) {
  if (!db) return;
  try { await db.collection('formulaOfDay').doc(id).delete(); showToast('Formula deleted'); loadFormulaOfDay(); loadAdminFormulas(); } catch (e) { showToast(e.message || 'Delete failed', 'error'); }
}

async function deleteSocialPost(id) {
  if (!db) return;
  try { await db.collection('posts').doc(id).delete(); showToast('Post deleted'); loadFeed(); loadFeedPreview(); loadAdminSocialPosts(); } catch (e) { showToast(e.message || 'Delete failed', 'error'); }
}

// ===== LOGOUT =====
async function logout() {
  closeAllOverlays();
  if (state.testTimerInterval) { clearInterval(state.testTimerInterval); state.testTimerInterval = null; }
  if (state.timerIntervalId) { clearInterval(state.timerIntervalId); state.timerIntervalId = null; }
  if (!auth) return;
  try { await auth.signOut(); } catch (e) {}
  state.user = null;
  state.profile = null;
  state.isAdmin = false;
  const appShell = $('#app-shell');
  const authScreen = $('#auth-screen');
  if (appShell) { appShell.classList.add('hidden'); appShell.classList.remove('flex'); }
  if (authScreen) authScreen.classList.remove('hidden', 'hidden-auth');
  showToast('Logged out');
}

// ===== KEYBOARD SUPPORT =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllModals();
    closeSidebar();
    const hwView = $('#homework-view');
    if (hwView && hwView.classList.contains('open')) closeHomework();
    const adminPanel = $('#admin-panel');
    if (adminPanel && adminPanel.classList.contains('open')) closeAdmin();
  }
});

// ===== INIT =====
function init() {
  if (state.initialized) return;
  state.initialized = true;

  applyTheme(state.theme);

  // Auth forms
  const loginForm = $('#login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  const regForm = $('#register-form');
  if (regForm) regForm.addEventListener('submit', handleRegister);
  const googleLoginBtn = $('#google-login');
  if (googleLoginBtn) googleLoginBtn.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); handleGoogleAuth(ev, false); });
  const googleRegBtn = $('#google-register');
  if (googleRegBtn) googleRegBtn.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); handleGoogleAuth(ev, true); });

  // Bottom nav
  $$('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Sidebar
  const menuBtn = $('#menu-btn');
  if (menuBtn) menuBtn.addEventListener('click', toggleSidebar);
  const sidebarOverlay = $('#sidebar-overlay');
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);

  // Notification bell
  const notifBell = $('#notif-bell');
  if (notifBell) notifBell.addEventListener('click', openNotifications);

  // Edit profile
  const editProfileBtn = $('#edit-profile-btn');
  if (editProfileBtn) editProfileBtn.addEventListener('click', openEditModal);
  const editForm = $('#edit-form');
  if (editForm) editForm.addEventListener('submit', saveProfile);

  // Admin forms
  const noticeForm = $('#notice-form');
  if (noticeForm) noticeForm.addEventListener('submit', publishNotice);
  const lectureForm = $('#lecture-form');
  if (lectureForm) lectureForm.addEventListener('submit', addLecture);
  const testForm = $('#test-form');
  if (testForm) testForm.addEventListener('submit', addMockTest);
  const datesheetForm = $('#datesheet-form');
  if (datesheetForm) datesheetForm.addEventListener('submit', addDateSheet);
  const ytSearchForm = $('#yt-search-form');
  if (ytSearchForm) ytSearchForm.addEventListener('submit', searchYouTube);
  const formulaForm = $('#formula-form');
  if (formulaForm) formulaForm.addEventListener('submit', publishFormula);
  const wordForm = $('#word-form');
  if (wordForm) wordForm.addEventListener('submit', publishWord);
  const hwForm = $('#homework-form');
  if (hwForm) hwForm.addEventListener('submit', publishHomework);
  const socialPostForm = $('#social-post-form');
  if (socialPostForm) socialPostForm.addEventListener('submit', createSocialPost);

  // PWA Install
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.installPrompt = e;
    const container = $('#install-container');
    if (container) container.classList.remove('hidden');
  });

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Auth state
  if (auth) {
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        if (state.user && state.user.uid === user.uid) return;
        state.user = user;
        const authScreen = $('#auth-screen');
        if (authScreen) authScreen.classList.add('hidden-auth');
        setTimeout(() => {
          if (authScreen) authScreen.classList.add('hidden');
          const appShell = $('#app-shell');
          if (appShell) { appShell.classList.remove('hidden'); appShell.classList.add('flex'); }
          loadProfile(user.uid);
          loadNotices();
          loadDateSheet();
          updateTimer();
          loadFeedPreview();
          checkNotifications();
          if (state.timerIntervalId) clearInterval(state.timerIntervalId);
          state.timerIntervalId = setInterval(updateTimer, 30000);
        }, 500);
      } else {
        state.user = null;
        state.profile = null;
        state.isAdmin = false;
        if (state.timerIntervalId) { clearInterval(state.timerIntervalId); state.timerIntervalId = null; }
        if (state.testTimerInterval) { clearInterval(state.testTimerInterval); state.testTimerInterval = null; }
        const authScreen = $('#auth-screen');
        if (authScreen) authScreen.classList.remove('hidden', 'hidden-auth');
        const appShell = $('#app-shell');
        if (appShell) { appShell.classList.add('hidden'); appShell.classList.remove('flex'); }
      }
    });
  }
}

// ===== EXPOSE APP API =====
window.App = {
  setTheme: applyTheme,
  switchTab,
  logout,
  filterSubject,
  filterHomework,
  toggleSidebar,
  showLogin,
  showRegister,
  playVideo,
  closeVideo,
  playVideoById,
  openAdmin,
  closeAdmin,
  openEditModal,
  closeEditModal,
  openCalculator,
  closeCalculator,
  calcInput,
  openNotepad,
  closeNotepad,
  saveNotepad,
  clearNotepad,
  openTodo,
  closeTodo,
  addTodo,
  toggleTodo,
  deleteTodo,
  openTerms,
  closeTerms,
  openAbout,
  closeAbout,
  installApp,
  openHomework,
  closeHomework,
  openLecture,
  openLectureById,
  closeLecture,
  openTestById,
  closeTest,
  likePost,
  viewStory,
  closeStoryModal,
  openStoryCamera,
  createSocialPost,
  handlePostImageSelect,
  handleProfileImageUpload,
  toggleExamSoon,
  handleAdminDelete,
  openNotifications,
  // Direct delete functions for backward compat
  deleteTest,
  deleteDateSheet,
  deleteNotice,
  deleteLecture,
  deleteHomework,
  deleteFormula,
  deleteSocialPost,
  requireAdminDelete,
};

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
