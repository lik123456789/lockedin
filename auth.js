// js/auth.js - depends: utils.js, storage.js

let authMode = 'signin';

function renderAccountPill(){
  const pill = $('account-pill');
  if(!fbUser){ pill.style.display = 'none'; return; }
  pill.style.display = 'flex';
  const avatar = $('account-avatar');
  if(fbUser.photoURL){
    avatar.innerHTML = `<img src="${fbUser.photoURL}" referrerpolicy="no-referrer" />`;
  } else {
    avatar.textContent = (fbUser.displayName || fbUser.email || "?").trim().charAt(0).toUpperCase();
  }
  $('account-name').textContent = (fbUser.displayName || fbUser.email || "Account").split(" ")[0];
}

function setAuthError(msg){
  $('email-auth-error').textContent = msg || "";
}

function friendlyAuthError(e){
  const code = e && e.code || "";
  if(code === 'auth/invalid-email') return "That email address doesn't look right.";
  if(code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') return "Email or password is incorrect.";
  if(code === 'auth/email-already-in-use') return "An account already exists for that email — try signing in instead.";
  if(code === 'auth/weak-password') return "Password should be at least 6 characters.";
  if(code === 'auth/unauthorized-domain') return "This domain isn't authorized for sign-in yet. Add it under Authentication → Settings → Authorized domains in the Firebase console.";
  return e && e.message ? e.message : "Something went wrong. Try again.";
}

function setupAuthUI(){
  $('btn-google-signin').onclick = async () => {
    if(!fbAuth){ alert("Google sign-in isn't configured yet — add your Firebase project keys in the code."); return; }
    const btn = $('btn-google-signin');
    btn.disabled = true;
    try{
      const provider = new firebase.auth.GoogleAuthProvider();
      await fbAuth.signInWithPopup(provider);
    }catch(e){
      alert("Sign-in failed: " + (e.message || e));
      btn.disabled = false;
    }
  };

  $('btn-skip-login').onclick = () => {
    fbUser = null;
    loadLocalAll();
    renderAccountPill();
    showScreen('screen-home');
    renderHome();
  };

  $('auth-toggle-link').onclick = () => {
    authMode = authMode === 'signin' ? 'signup' : 'signin';
    setAuthError("");
    if(authMode === 'signup'){
      $('btn-email-submit').textContent = "Create account";
      $('auth-toggle-link').innerHTML = 'Already have an account? <span>Sign in</span>';
      $('email-auth-password').setAttribute('autocomplete', 'new-password');
    } else {
      $('btn-email-submit').textContent = "Sign in";
      $('auth-toggle-link').innerHTML = "Don't have an account? <span>Sign up</span>";
      $('email-auth-password').setAttribute('autocomplete', 'current-password');
    }
  };

  $('email-auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    setAuthError("");
    if(!fbAuth){ setAuthError("Email sign-in isn't configured yet — add your Firebase project keys in the code."); return; }
    const email = $('email-auth-email').value.trim();
    const password = $('email-auth-password').value;
    if(!email || !password){ setAuthError("Enter an email and password."); return; }

    const btn = $('btn-email-submit');
    btn.disabled = true;
    try{
      if(authMode === 'signup'){
        await fbAuth.createUserWithEmailAndPassword(email, password);
      } else {
        await fbAuth.signInWithEmailAndPassword(email, password);
      }
    }catch(err){
      setAuthError(friendlyAuthError(err));
      btn.disabled = false;
    }
  });

  $('account-pill').onclick = async () => {
    if(!fbAuth || !fbUser) return;
    if(confirm("Sign out of " + (fbUser.displayName || fbUser.email) + "? Your data stays saved to that account.")){
      await fbAuth.signOut();
    }
  };
}

function initAuth(){
  if(!isFirebaseConfigured || !fbAuth){
    $('login-note').textContent = "Google sign-in isn't configured in this copy of the app yet, so everything's stored on this device only.";
    loadLocalAll();
    showScreen('screen-home');
    renderHome();
    return;
  }
  fbAuth.onAuthStateChanged(async (user) => {
    if(user){
      fbUser = user;
      renderAccountPill();
      await loadFromCloud();
      showScreen('screen-home');
      renderHome();
    } else {
      fbUser = null;
      renderAccountPill();
      showScreen('screen-login');
    }
  });
  setupAuthUI();
}
