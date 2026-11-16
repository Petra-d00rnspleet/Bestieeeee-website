import { auth, db, persistenceReady } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  ref, get, set, update, push, remove, onValue
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";

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

// Gratis lokale chat: geen AI-provider, API-sleutel of Cloud Function.
function choose(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function makeBestieReply(message) {
  const text = message.toLowerCase().trim();
  const petName = profile?.pet?.name || "Mochi";

  if (/\b(hallo|hoi|hey|heyy|hi|goedemorgen|goedemiddag|goedenavond)\b/.test(text))
    return choose(["Hiiii! ♡ Wat leuk dat je er bent. Hoe gaat het vandaag met je?", "Heehee! 🌷 Waar zullen we het gezellig over hebben?", "Hoiii! Ik ben er. Wat speelt er vandaag in jouw wereldje?"]);
  if (/\b(hoe gaat het|hoe is het|alles goed)\b/.test(text))
    return choose(["Met mij gaat het goed, dankjewel dat je het vraagt! ♡ Hoe gaat het met jou?", "Ik ben helemaal klaar voor een gezellig gesprek. En hoe is jouw dag?", "Prima hier! Vertel eens, hoe gaat het met jou?"]);
  if (/\b(dank je|dankjewel|thanks|bedankt)\b/.test(text))
    return choose(["Graag gedaan! ♡", "Natuurlijk! Daar ben ik voor. 🌷", "Geen probleem, fijn dat ik kon helpen!"]);
  if (/\b(doei|dag|tot later|bye|slaap lekker|welterusten)\b/.test(text))
    return choose(["Tot snel! Zorg goed voor jezelf. ♡", "Doeidoei! Ik hoop dat je een fijne dag hebt. 🌷", "Tot de volgende keer!"]);
  if (/\b(speel|spelletje|spelletjes|game|puzzel|raadsel|quiz)\b/.test(text))
    return "Jaaa, een spelletje! 🎮 Raadsel: wat heeft steden maar geen huizen, bossen maar geen bomen en water maar geen vissen? Typ je antwoord maar!";
  if (/\b(grapp|mop|lach)\b/.test(text))
    return choose(["Waarom neemt een paddenstoel altijd de bus? Omdat hij geen sporen wil achterlaten! 🍄", "Wat zegt een nul tegen een acht? Mooie riem! 😂", "Waarom was het boek verdrietig? Het had te veel problemen tussen de kaften. 📚"]);
  if (/\b(verdrietig|somber|down|niet fijn|rot dag|boos|gestrest|stress)\b/.test(text))
    return choose(["Dat klinkt als een lastige dag. ♡ Wil je vertellen wat er is gebeurd? Ik luister.", "Ah, dat is vervelend. Wat zit je dwars?", "Wat naar dat je je zo voelt. Wil je erover praten of liever even afleiding?"]);
  if (/\b(blij|happy|geweldig|super|leuk nieuws|trots)\b/.test(text))
    return choose(["Awww, wat fijn om te horen!! ♡ Vertel, wat is er gebeurd?", "Jaaa, dat klinkt geweldig! Ik ben benieuwd! ✨", "Dat verdient een klein feestje! Wat maakte je zo blij? 🎉"]);
  if (/\b(verveel|saai|niks te doen)\b/.test(text))
    return "Zullen we iets leuks verzinnen? ♡ We kunnen een raadsel doen, een mini-quiz spelen of samen een verhaal bedenken. Waar heb je zin in?";
  if (/\b(school|huiswerk|toets|leraar|les)\b/.test(text))
    return choose(["School kan soms best veel zijn. Waar ben je mee bezig? Misschien kan ik helpen het overzichtelijk te maken. ♡", "Hoe gaat het op school de laatste tijd?", "Vertel eens! Gaat het over huiswerk, een vak of iets dat is gebeurd?"]);
  if (/\b(naam|wie ben jij|wat ben jij)\b/.test(text))
    return `Ik ben jouw Virtual Bestie! ♡ En jouw poppetje heet ${petName}. Waar zullen we over kletsen?`;
  if (/\b(weer|temperatuur|regent|weerbericht)\b/.test(text))
    return "Ik kan het actuele weer niet bekijken, maar ik kan wel helpen bedenken wat je kunt doen op een regenachtige of zonnige dag. ☁️";
  if (text.endsWith("?") || /\b(waarom|hoe|wat|wanneer|wie|welke|kan je|kun je)\b/.test(text))
    return choose(["Goede vraag! Ik kan niet alles weten, maar ik denk graag met je mee. Kun je iets meer vertellen?", "Hmm, laten we daar samen over nadenken. Kun je iets meer context geven?", "Ik wil je graag goed begrijpen. Kun je uitleggen wat je precies bedoelt? ♡"]);
  return choose(["Vertel verder! ♡ Wat vind je daar zelf van?", "Ooh, ik luister. Kun je me daar iets meer over vertellen?", "Dat is interessant! Wat gebeurde er daarna?", "Ik ben benieuwd! Hoe voelde dat voor jou?", "Zullen we daar samen over nadenken?"]);
}

const chatSendButton = $("chatForm").querySelector('button[type="submit"]');

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
  setChatStatus("Je bestie denkt even na... ♡");
  const chatRef = ref(db, `users/${currentUser.uid}/chat`);

  try {
    await set(push(chatRef), { role: "user", text, createdAt: Date.now() });
    await new Promise(resolve => setTimeout(resolve, 350));
    const answer = makeBestieReply(text);
    await set(push(chatRef), { role: "assistant", text: answer, createdAt: Date.now() });
    setChatStatus("");
  } catch (error) {
    console.error("Saving chat message failed:", error);
    setChatStatus("Je bericht kon niet worden opgeslagen. Controleer je internetverbinding en probeer opnieuw.", "error");
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
