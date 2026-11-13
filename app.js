
import { auth, db, persistenceReady } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  ref,
  onValue,
  runTransaction
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";

const $ = id => document.getElementById(id);

let currentUser = null;
let userData = null;
let unsubscribe = null;

await persistenceReady;

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  currentUser = user;

  if (unsubscribe) unsubscribe();

  const userRef = ref(db, `users/${user.uid}`);

  unsubscribe = onValue(userRef, snapshot => {
    if (!snapshot.exists()) return;

    userData = snapshot.val();
    render();
  }, error => {
    console.error("Database error:", error);
    alert("Could not load your bestie. Please try again.");
  });
});

function render() {
  if (!userData) return;

  const pet = userData.pet;
  const stats = pet.stats;

  $("username").textContent =
    `Welcome, ${userData.username || "Bestie"}!`;

  $("petName").textContent = pet.name;
  $("coins").textContent = pet.coins;
  $("level").textContent = pet.level;
  $("xpText").textContent = `${pet.xp} / 100 XP`;

  $("xpBar").style.width = pet.xp + "%";

  $("happyText").textContent = stats.happiness + "%";
  $("hungerText").textContent = stats.hunger + "%";
  $("energyText").textContent = stats.energy + "%";
  $("cleanText").textContent = stats.cleanliness + "%";

  $("happyBar").style.width = stats.happiness + "%";
  $("hungerBar").style.width = stats.hunger + "%";
  $("energyBar").style.width = stats.energy + "%";
  $("cleanBar").style.width = stats.cleanliness + "%";

  $("petCharacter").textContent =
    pet.type === "bunny" ? "🐰" : "🐻";
}

function petRef() {
  return ref(db, `users/${currentUser.uid}/pet`);
}

async function changePet(action) {
  if (!currentUser) return;

  const messages = {
    feed: "Yummm! Thank you for my snack! 🍓",
    play: "This is SO much fun! 🧸",
    sleep: "Zzz... sweet dreams! 💤",
    bath: "I smell like flowers now! 🫧"
  };

  try {
    const result = await runTransaction(petRef(), pet => {
      if (!pet) return;

      const s = pet.stats;

      if (action === "feed") {
        if (s.hunger >= 100) return;

        s.hunger = Math.min(100, s.hunger + 25);
        s.happiness = Math.min(100, s.happiness + 5);
        pet.coins += 2;
      }

      if (action === "play") {
        if (s.energy < 15) return;

        s.happiness = Math.min(100, s.happiness + 20);
        s.energy = Math.max(0, s.energy - 15);
        s.hunger = Math.max(0, s.hunger - 8);
      }

      if (action === "sleep") {
        s.energy = Math.min(100, s.energy + 35);
      }

      if (action === "bath") {
        s.cleanliness = Math.min(100, s.cleanliness + 35);
        s.happiness = Math.min(100, s.happiness + 5);
      }

      pet.xp += action === "play" ? 25 : 15;

      if (pet.xp >= 100) {
        pet.xp -= 100;
        pet.level += 1;
        pet.coins += 25;
      }

      pet.updatedAt = Date.now();

      return pet;
    });

    if (result.committed) {
      $("speech").textContent = messages[action];
      $("message").textContent = messages[action];
    } else {
      $("speech").textContent =
        "Let's try that again later! ♡";
    }

  } catch (error) {
    console.error(error);
    alert("Something went wrong while updating your bestie.");
  }
}

document.querySelectorAll("[data-action]").forEach(button => {
  button.addEventListener("click", () => {
    changePet(button.dataset.action);
  });
});

$("renameButton").addEventListener("click", async () => {
  const newName = prompt("What should your bestie's name be?");

  if (!newName || !newName.trim()) return;

  try {
    await runTransaction(petRef(), pet => {
      if (!pet) return;
      pet.name = newName.trim().slice(0, 18);
      return pet;
    });
  } catch (error) {
    alert("Could not change the name.");
  }
});

$("logoutButton").addEventListener("click", async () => {
  await signOut(auth);
  window.location.replace("login.html");
});
