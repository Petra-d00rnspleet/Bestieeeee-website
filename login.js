import {
  auth,
  db,
  googleProvider,
  persistenceReady
} from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  ref,
  get,
  set
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";

const $ = id => document.getElementById(id);

let mode = "login";
let authActionStarted = false;

// Firebase persistence mag de knoppen niet blokkeren.
persistenceReady.catch(error => {
  console.error("Firebase persistence error:", error);
});

// Login / registratie wisselen
function setMode(newMode) {
  mode = newMode;

  $("loginTab").classList.toggle("active", mode === "login");
  $("signupTab").classList.toggle("active", mode === "signup");

  $("formTitle").innerHTML =
    mode === "login"
      ? "Welcome <em>back.</em>"
      : "Create your <em>account.</em>";

  $("formDescription").textContent =
    mode === "login"
      ? "Your little bestie is waiting for you."
      : "Let's create your own little world.";

  $("submitButton").textContent =
    mode === "login"
      ? "Log in →"
      : "Create account →";

  $("error").textContent = "";
}

$("loginTab").addEventListener("click", () => {
  setMode("login");
});

$("signupTab").addEventListener("click", () => {
  setMode("signup");
});

// Nieuw gebruikersprofiel aanmaken
async function createProfile(user) {
  const userRef = ref(db, `users/${user.uid}`);
  const snapshot = await get(userRef);

  if (!snapshot.exists()) {
    await set(userRef, {
      username: user.displayName || user.email.split("@")[0],
      email: user.email,
      createdAt: Date.now(),

      pet: {
        name: "Mochi",
        type: "bunny",
        level: 1,
        xp: 0,
        coins: 100,

        stats: {
          happiness: 85,
          hunger: 65,
          energy: 75,
          cleanliness: 90
        }
      }
    });
  }
}

// Alleen bestaande gebruikers automatisch doorsturen.
onAuthStateChanged(auth, user => {
  if (user && !authActionStarted) {
    window.location.replace("index.html");
  }
});

// Login en registratie
$("authForm").addEventListener("submit", async event => {
  event.preventDefault();

  const email = $("email").value.trim();
  const password = $("password").value;

  const button = $("submitButton");
  const errorBox = $("error");

  button.disabled = true;
  errorBox.textContent = "";

  authActionStarted = true;

  try {
    // Wacht hier op Firebase, niet bij het laden van de pagina.
    await persistenceReady;

    if (mode === "signup") {
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      await createProfile(result.user);

    } else {
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
    }

    window.location.replace("index.html");

  } catch (error) {
    console.error("Authentication error:", error);

    errorBox.textContent = getErrorMessage(error.code);

    button.disabled = false;
    authActionStarted = false;
  }
});

// Google login
$("googleButton").addEventListener("click", async () => {
  const button = $("googleButton");

  button.disabled = true;
  $("error").textContent = "";

  authActionStarted = true;

  try {
    await persistenceReady;

    const result = await signInWithPopup(
      auth,
      googleProvider
    );

    await createProfile(result.user);

    window.location.replace("index.html");

  } catch (error) {
    console.error("Google authentication error:", error);

    $("error").textContent = getErrorMessage(error.code);

    button.disabled = false;
    authActionStarted = false;
  }
});

// Foutmeldingen
function getErrorMessage(code) {
  const messages = {
    "auth/email-already-in-use":
      "This email is already registered.",

    "auth/invalid-email":
      "Please enter a valid email address.",

    "auth/weak-password":
      "Your password needs at least 6 characters.",

    "auth/invalid-credential":
      "Email or password is incorrect.",

    "auth/user-not-found":
      "No account found with this email.",

    "auth/wrong-password":
      "Incorrect password.",

    "auth/popup-closed-by-user":
      "Google login was cancelled.",

    "auth/unauthorized-domain":
      "This domain is not authorized in Firebase.",

    "auth/network-request-failed":
      "Network error. Please check your internet connection.",

    "auth/operation-not-allowed":
      "This login method is not enabled in Firebase."
  };

  return messages[code] ||
    "Something went wrong: " + (code || "unknown error");
}
