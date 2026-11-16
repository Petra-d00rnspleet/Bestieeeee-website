import { auth, db, functions, persistenceReady } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  ref, get, set, update, push, remove, onValue
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-functions.js";

const $ = id => document.getElementById(id);
const petChoices = ["🐰", "🐻", "🐱", "🐥", "🐼"];
let currentUser = null;
let profile = {};
let selectedPet = "🐰";
let diaryItems = {};
let chatItems = {};
let stopProfile = null;
let stopDiary = null;
let stopChat = null;
let sendingChat = false;

const pageTitles = {
  home: "Welcome to your world ♡",
  character: "My Character ♡",
  room: "My Room ♡",
  diary: "My Diary ♡",
  chat: "My Chat ♡"
};

function showPage(page) {
  document.querySelectorAll(".page").forEach(el => el.classList.toggle("active", el.id === `page-${page}`));
  document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.page === page));
  $("pageTitle").textContent = pageTitles[page] || pageTitles.home;
  history.replaceState(null, "", `#${page}`);
}

document.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click", () => showPage(button.dataset.page)));
document.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", () => showPage(button.dataset.go)));

$("logoutButton").addEventListener("click", async () => {
  await signOut(auth);
  window.location.replace("login.html");
});

function defaultProfile(user) {
  return {
    username: user.displayName || (user.email ? user.email.split("@")[0] : "Bestie"),
    pet: { name: "Mochi", type: "🐰", level: 1, xp: 0, coins: 100, stats: { happiness: 85, hunger: 65, energy: 75, cleanliness: 90 } },
    room: { createdAt: Date.now() }
  };
}

function renderProfile(data) {
  profile = data || {};
  const pet = profile.pet || { name: "Mochi", type: "🐰" };
  selectedPet = petChoices.includes(pet.type) ? pet.type : (pet.type === "bunny" ? "🐰" : "🐻");
  const name = pet.name || "Mochi";
  $("headerPet").textContent = selectedPet;
  $("headerName").textContent = name;
  $("homePet").textContent = selectedPet;
  $("characterPreview").textContent = selectedPet;
  $("previewName").textContent = name;
  $("petNameInput").value = name;
  $("roomPet").textContent = selectedPet;
  $("roomPetName").textContent = name;
  document.querySelectorAll(".character-option").forEach(button => button.classList.toggle("selected", button.dataset.pet === selectedPet));
}

function renderDiary(items) {
  diaryItems = items || {};
  const entries = Object.entries(diaryItems).sort((a,b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));
  $("diaryEntries").innerHTML = "";
  if (!entries.length) {
    $("diaryEntries").innerHTML = '<div class="empty-state">Your diary is waiting for its first little story. ♡</div>';
    return;
  }
  for (const [id, entry] of entries) {
    const article = document.createElement("article");
    article.className = "diary-entry";
    const top = document.createElement("div");
    top.className = "diary-entry-top";
    const date = document.createElement("span");
    date.textContent = new Date(entry.createdAt || Date.now()).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" });
    const del = document.createElement("button");
    del.className = "delete-entry";
    del.type = "button";
    del.textContent = "Delete";
    del.addEventListener("click", async () => {
      if (confirm("Weet je zeker dat je dit dagboekbericht wilt verwijderen?")) {
        await remove(ref(db, `users/${currentUser.uid}/diary/${id}`));
      }
    });
    const body = document.createElement("p");
    body.textContent = entry.text || "";
    top.append(date, del);
    article.append(top, body);
    $("diaryEntries").append(article);
  }
}

function renderChat(items) {
  chatItems = items || {};
  const messages = Object.entries(chatItems).sort((a,b) => (a[1].createdAt || 0) - (b[1].createdAt || 0));
  const container = $("chatMessages");
  container.innerHTML = "";
  if (!messages.length) {
    container.innerHTML = '<div class="chat-welcome"><span>🌷</span><strong>Hi there!</strong><p>What is on your mind today?</p></div>';
    return;
  }
  for (const [, item] of messages) {
    const bubble = document.createElement("div");
    bubble.className = `message ${item.role === "user" ? "user" : "assistant"}`;
    bubble.textContent = item.text || "";
    container.append(bubble);
  }
  container.scrollTop = container.scrollHeight;
}

petChoices.forEach(() => {});
document.querySelectorAll(".character-option").forEach(button => {
  button.addEventListener("click", () => {
    selectedPet = button.dataset.pet;
    $("characterPreview").textContent = selectedPet;
    document.querySelectorAll(".character-option").forEach(el => el.classList.toggle("selected", el === button));
  });
});

$("petNameInput").addEventListener("input", () => {
  $("previewName").textContent = $("petNameInput").value.trim() || "My bestie";
});

$("saveCharacter").addEventListener("click", async () => {
  if (!currentUser) return;
  const name = $("petNameInput").value.trim().slice(0,18) || "Mochi";
  try {
    await update(ref(db, `users/${currentUser.uid}/pet`), { name, type: selectedPet });
    $("characterStatus").textContent = "Your bestie is saved! ♡";
  } catch (error) {
    console.error(error);
    $("characterStatus").textContent = "Could not save your bestie. Please try again.";
  }
});

$("diaryText").addEventListener("input", () => {
  $("diaryCount").textContent = `${$("diaryText").value.length} / 5000`;
});

$("saveDiary").addEventListener("click", async () => {
  const text = $("diaryText").value.trim();
  if (!text || !currentUser) {
    $("diaryStatus").textContent = "Write a little something first. ♡";
    return;
  }
  try {
    await set(push(ref(db, `users/${currentUser.uid}/diary`)), { text, createdAt: Date.now() });
    $("diaryText").value = "";
    $("diaryCount").textContent = "0 / 5000";
    $("diaryStatus").textContent = "Your entry has been saved. ♡";
  } catch (error) {
    console.error(error);
    $("diaryStatus").textContent = "Could not save your entry. Please try again.";
  }
});

const askBestie = httpsCallable(functions, "askBestie");
$("chatForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (sendingChat || !currentUser) return;
  const text = $("chatInput").value.trim();
  if (!text) return;
  sendingChat = true;
  $("chatInput").value = "";
  $("chatStatus").textContent = "Your bestie is thinking... ♡";
  const chatRef = ref(db, `users/${currentUser.uid}/chat`);
  try {
    await set(push(chatRef), { role: "user", text, createdAt: Date.now() });
    const recent = Object.entries(chatItems)
      .sort((a,b) => (a[1].createdAt || 0) - (b[1].createdAt || 0))
      .slice(-11)
      .map(([, item]) => ({ role: item.role, content: item.text }));
    recent.push({ role: "user", content: text });
    const result = await askBestie({ messages: recent });
    const answer = result.data.answer;
    await set(push(chatRef), { role: "assistant", text: answer, createdAt: Date.now() });
    $("chatStatus").textContent = "";
  } catch (error) {
    console.error("Chat error:", error);
    $("chatStatus").textContent = error.code === "functions/not-found"
      ? "The AI chat function is not deployed yet. Follow the setup guide in README."
      : "The chat could not reply right now. Please try again in a moment.";
  } finally {
    sendingChat = false;
  }
});

persistenceReady.catch(error => {
  console.warn("Auth persistence could not be set:", error);
});

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }
  currentUser = user;
  const userRef = ref(db, `users/${user.uid}`);
  try {
    const snapshot = await get(userRef);
    if (!snapshot.exists()) {
      await set(userRef, defaultProfile(user));
    } else if (!snapshot.val().pet) {
      await update(userRef, { pet: defaultProfile(user).pet });
    }
    if (stopProfile) stopProfile();
    if (stopDiary) stopDiary();
    if (stopChat) stopChat();
    stopProfile = onValue(userRef, snap => renderProfile(snap.val()));
    stopDiary = onValue(ref(db, `users/${user.uid}/diary`), snap => renderDiary(snap.val()));
    stopChat = onValue(ref(db, `users/${user.uid}/chat`), snap => renderChat(snap.val()));
    const startPage = location.hash.replace("#", "");
    showPage(["home","character","room","diary","chat"].includes(startPage) ? startPage : "home");
  } catch (error) {
    console.error("Could not load profile:", error);
    alert("Your profile could not be loaded. Check your Firebase Database rules.");
  }
});
