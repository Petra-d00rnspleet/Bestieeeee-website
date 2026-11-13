
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
    mode === "login" ? "Log in →" : "Create account →";

  $("error").textContent = "";
}

$("loginTab").addEventListener("click", () => setMode("login"));
$("signupTab").addEventListener("click", () => setMode("signup"));

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

await persistenceReady;

onAuthStateChanged(auth, user => {
  if (user) {
    window.location.replace("index.html");
  }
});

$("authForm").addEventListener("submit", async event => {
  event.preventDefault();

  const email = $("email").value.trim();
  const password = $("password").value;

  $("submitButton").disabled = true;
  $("error").textContent = "";

  try {
    if (mode === "signup") {
      const result = await createUserWithEmailAndPassword(
        auth, email, password
      );

      await createProfile(result.user);

    } else {
      await signInWithEmailAndPassword(
        auth, email, password
      );
    }

  } catch (error) {
    $("error").textContent = getErrorMessage(error.code);
    $("submitButton").disabled = false;
  }
});

$("googleButton").addEventListener("click", async () => {
  $("googleButton").disabled = true;
  $("error").textContent = "";

  try {
    const result = await signInWithPopup(auth, googleProvider);
    await createProfile(result.user);

  } catch (error) {
    $("error").textContent = getErrorMessage(error.code);
    $("googleButton").disabled = false;
  }
});

function getErrorMessage(code) {
  const messages = {
    "auth/email-already-in-use": "This email is already registered.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Your password needs at least 6 characters.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/popup-closed-by-user": "Google login was cancelled.",
    "auth/unauthorized-domain": "This domain is not authorized in Firebase."
  };

  return messages[code] || "Something went wrong. Please try again.";
}
