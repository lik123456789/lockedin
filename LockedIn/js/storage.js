// js/storage.js - depends: utils.js

let subjects = [];
let trackers = [];
let sessions = [];
let goals = {};
let fbAuth = null, fbDb = null, fbUser = null;

const firebaseConfig = {
    apiKey: "AIzaSyCOn3FNJpvp-6B7HPgrNUVs1-xtudh97jY",
    authDomain: "lockedin-1b35e.firebaseapp.com",
    projectId: "lockedin-1b35e",
    storageBucket: "lockedin-1b35e.firebasestorage.app",
    messagingSenderId: "264781618369",
    appId: "1:264781618369:web:ff5fa7ec854a39dcca8840"
  };

const isFirebaseConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";

function initFirebase(){
  if(isFirebaseConfigured && typeof firebase !== 'undefined'){
    try{
      firebase.initializeApp(firebaseConfig);
      fbAuth = firebase.auth();
      fbDb = firebase.firestore();
    }catch(e){ console.error('Firebase init failed', e); }
  }
}

function storageGet(key, fallback){
  try{
    const res = localStorage.getItem(key);
    if(!res) return fallback;
    return JSON.parse(res);
  }catch(e){ return fallback; }
}

function storageSet(key, value){
  try{ localStorage.setItem(key, JSON.stringify(value)); }
  catch(e){ console.error("storage set failed", key, e); }
}

function loadSubjects(){
  subjects = storageGet('li_subjects', null);
  if(!subjects || !subjects.length){ subjects = DEFAULT_SUBJECTS.slice(); saveSubjects(); }
}

function saveSubjects(){ 
  storageSet('li_subjects', subjects); 
  syncToCloud(); 
}

function loadTrackers(){
  trackers = storageGet('li_trackers', null);
  if(!trackers || !trackers.length){ trackers = DEFAULT_TRACKERS.slice(); saveTrackers(); }
}

function saveTrackers(){ 
  storageSet('li_trackers', trackers); 
  syncToCloud(); 
}

function loadSessions(){ 
  sessions = storageGet('li_sessions', []); 
}

function saveSessions(){ 
  storageSet('li_sessions', sessions); 
  syncToCloud(); 
}

function loadGoals(){ 
  goals = storageGet('li_goals', {}); 
}

function saveGoals(){ 
  storageSet('li_goals', goals); 
  syncToCloud(); 
}

function loadLocalAll(){ 
  loadSubjects(); 
  loadTrackers(); 
  loadSessions(); 
  loadGoals(); 
}

async function syncToCloud(){
  if(!fbUser || !fbDb) return;
  try{
    await fbDb.collection('users').doc(fbUser.uid).set(
      { subjects, trackers, sessions, goals, updatedAt: Date.now() },
      { merge: true }
    );
  }catch(e){ console.error('cloud sync failed', e); }
}

async function loadFromCloud(){
  if(!fbUser || !fbDb) return;
  try{
    const doc = await fbDb.collection('users').doc(fbUser.uid).get();
    if(doc.exists){
      const data = doc.data();
      subjects = (data.subjects && data.subjects.length) ? data.subjects : DEFAULT_SUBJECTS.slice();
      trackers = (data.trackers && data.trackers.length) ? data.trackers : DEFAULT_TRACKERS.slice();
      sessions = data.sessions || [];
      goals = data.goals || {};
      storageSet('li_subjects', subjects);
      storageSet('li_trackers', trackers);
      storageSet('li_sessions', sessions);
      storageSet('li_goals', goals);
    } else {
      loadLocalAll();
      await fbDb.collection('users').doc(fbUser.uid).set(
        { subjects, trackers, sessions, goals, updatedAt: Date.now() }
      );
    }
  }catch(e){
    console.error('cloud load failed, falling back to local data', e);
    loadLocalAll();
  }
}

initFirebase();
