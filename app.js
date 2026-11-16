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

function setChatStatus(message = "", type = "") {
  const status = $("chatStatus");
  status.textContent = message;
  status.className = `chat-status${type ? ` ${type}` : ""}`;
}

document.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click", () => showPage(button.dataset.page)));
document.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", () => showPage(button.dataset.go)));

$("logoutButton").addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.replace("login.html");
  } catch (error) {
    console.error("Logout failed:", error);
  }
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

// Keep the callable function in the same region as functions/index.js.
const askBestie = httpsCallable(functions, "askBestie", { timeout: 60000 });
const chatSendButton = $("chatForm").querySelector('button[type="submit"]');

function explainChatError(error) {
  console.error("Virtual Bestie chat error:", error);
  const code = error?.code || "";
  if (code.includes("functions/not-found")) {
    return "De AI-functie is nog niet naar Firebase gepubliceerd. Volg de stappen 'AI-chat installeren' in README.";
  }
  if (code.includes("functions/unauthenticated")) {
    return "Je inlogsessie is verlopen. Log uit en log opnieuw in.";
  }
  if (code.includes("functions/permission-denied")) {
    return "Firebase heeft deze aanvraag geweigerd. Controleer de rechten van je account.";
  }
  if (code.includes("functions/resource-exhausted")) {
    return "De AI-dienst heeft tijdelijk te veel aanvragen of geen beschikbaar tegoed. Probeer het later opnieuw.";
  }
  if (code.includes("functions/deadline-exceeded")) {
    return "De AI duurde te lang met antwoorden. Probeer het nog een keer.";
  }
  if (code.includes("functions/failed-precondition")) {
    return "De AI-instellingen zijn nog niet goed ingesteld. Controleer de API-sleutel en het model in Firebase.";
  }
  if (code.includes("functions/internal")) {
    return "De AI-server kreeg een fout. Controleer de Firebase Function-logs; vaak ontbreekt de API-sleutel of is de modelsleutel niet beschikbaar.";
  }
  if (code.includes("functions/unavailable")) {
    return "De AI-server is tijdelijk niet bereikbaar. Probeer het straks opnieuw.";
  }
  return `Er ging iets mis met de AI-chat (${code || "onbekende fout"}). Controleer de Firebase Function-logs.`;
}

$("chatForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (sendingChat) return;
  if (!currentUser) {
    setChatStatus("Je bent niet ingelogd. Log opnieuw in.", "error");
    return;
  }

  const text = $("chatInput").value.trim();
  if (!text) return;

  sendingChat = true;
  $("chatInput").value = "";
  $("chatInput").disabled = true;
  chatSendButton.disabled = true;
  setChatStatus("Your bestie is thinking... ♡");

  const chatRef = ref(db, `users/${currentUser.uid}/chat`);

  // Build context before saving the new message, so it cannot accidentally be duplicated.
  const recent = Object.entries(chatItems)
    .sort((a,b) => (a[1].createdAt || 0) - (b[1].createdAt || 0))
    .slice(-10)
    .map(([, item]) => ({ role: item.role, content: String(item.text || "").slice(0, 2000) }));
  recent.push({ role: "user", content: text });

  try {
    await set(push(chatRef), { role: "user", text, createdAt: Date.now() });
    const result = await askBestie({ messages: recent });
    const answer = result?.data?.answer;

    if (typeof answer !== "string" || !answer.trim()) {
      throw new Error("The AI function returned an empty answer.");
    }

    await set(push(chatRef), { role: "assistant", text: answer.trim(), createdAt: Date.now() });
    setChatStatus("♡");
    setTimeout(() => {
      if ($("chatStatus").textContent === "♡") setChatStatus("");
    }, 1800);
  } catch (error) {
    setChatStatus(explainChatError(error), "error");
  } finally {
    sendingChat = false;
    $("chatInput").disabled = false;
    chatSendButton.disabled = false;
    $("chatInput").focus();
  }
});

persistenceReady.catch(error => console.warn("Auth persistence could not be set:", error));

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
