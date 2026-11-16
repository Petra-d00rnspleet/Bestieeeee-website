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

// Gratis chat met intentherkenning en lichte gesprekscontext.
// Geen AI, API-sleutel, betaalde API of Cloud Function nodig.
let chatContext = { topic: null, waitingFor: null, lastQuestion: null };

function choose(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function cleanText(value) {
  return value.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/[^\p{L}\p{N}\s?]/gu, " ")
    .replace(/\s+/g, " ").trim();
}

function hasAny(text, phrases) {
  return phrases.some(phrase => text.includes(phrase));
}

function makeBestieReply(message) {
  const text = cleanText(message);
  const petName = profile?.pet?.name || "Mochi";
  const short = text.length < 90;

  // Handle short answers to the previous question first.
  if (chatContext.waitingFor === "feelings_detail") {
    chatContext.waitingFor = "feelings_followup";
    return choose([
      `Dankjewel dat je dat vertelt. Wat was voor jou het vervelendste eraan? ♡`,
      `Ik snap het iets beter. Wil je dat ik met je meedenk, of wil je vooral even je verhaal kwijt?`,
      `Dat klinkt niet makkelijk. Is dit vandaag gebeurd, of speelt het al langer?`
    ]);
  }
  if (chatContext.waitingFor === "happy_detail") {
    chatContext.waitingFor = null;
    return choose([
      `Wat leuk!! Wat maakte dat moment zo bijzonder voor je? ✨`,
      `Awww, daar word ik blij van om te horen. Met wie was je?`,
      `Vertel meer! Was dit iets waar je al lang naar uitkeek?`
    ]);
  }
  if (chatContext.waitingFor === "game_choice") {
    chatContext.waitingFor = null;
    if (hasAny(text, ["raadsel", "puzzel", "quiz", "woord", "boter kaas", "tic tac"])) {
      chatContext.topic = "game";
      return startMiniGame(text);
    }
    return `Leuk! We kunnen een raadsel doen, een woordspelletje of een mini-quiz. Welke lijkt je het leukst?`;
  }

  // Greeting and social conversation.
  if (hasAny(text, ["hallo", "hoi", "hey", "heyy", "hi", "goedemorgen", "goedemiddag", "goedenavond"])) {
    chatContext.topic = "greeting";
    return choose([
      `Hiiii! ♡ Wat leuk dat je er bent. Hoe gaat het vandaag met je?`,
      `Heehee! 🌷 Hoe is jouw dag tot nu toe?`,
      `Hoiii! Ik ben er. Waar heb je zin in om over te kletsen?`
    ]);
  }
  if (hasAny(text, ["hoe gaat het", "hoe is het", "alles goed", "wat doe je"])) {
    chatContext.topic = "smalltalk";
    return choose([
      `Met mij gaat het goed, dankjewel! ♡ Wat ben jij vandaag aan het doen?`,
      `Ik ben klaar voor een gezellig gesprek. Hoe gaat het met jou?`,
      `Goed hier! Is jouw dag een beetje leuk tot nu toe?`
    ]);
  }
  if (hasAny(text, ["dank je", "dankjewel", "thanks", "bedankt"])) {
    return choose(["Graag gedaan! ♡", "Natuurlijk! 🌷", "Geen probleem, fijn dat ik kon helpen!"]);
  }
  if (hasAny(text, ["doei", "tot later", "bye", "welterusten", "slaap lekker"])) {
    chatContext = { topic: null, waitingFor: null, lastQuestion: null };
    return choose(["Tot snel! Zorg goed voor jezelf. ♡", "Doeidoei! Ik hoop dat je een fijne dag hebt. 🌷", "Slaap lekker als je gaat slapen! Tot de volgende keer."]);
  }

  // Emotional messages: respond to the emotion, then ask a relevant question.
  if (hasAny(text, ["verdrietig", "somber", "down", "rot dag", "niet fijn", "huilen", "boos", "gestrest", "stress", "zenuwachtig", "bang", "eenzaam", "niemand"])) {
    chatContext.topic = "feelings";
    chatContext.waitingFor = "feelings_detail";
    return choose([
      `Ah, dat klinkt echt vervelend. ♡ Wil je vertellen wat er is gebeurd?`,
      `Dat klinkt alsof je het moeilijk hebt. Wat maakt dat je je zo voelt?`,
      `Oei, dat is niet fijn. Is er iets specifieks gebeurd, of voel je je gewoon al een tijdje zo?`
    ]);
  }
  if (hasAny(text, ["blij", "happy", "geweldig", "super", "leuk nieuws", "trots", "gelukt", "feest"])) {
    chatContext.topic = "happy";
    chatContext.waitingFor = "happy_detail";
    return choose([
      `Awww, wat fijn om te horen!! ♡ Wat is er gebeurd?`,
      `Jaaa, dat klinkt geweldig! Waar ben je zo blij mee? ✨`,
      `Dat verdient een klein feestje! Vertel me alles! 🎉`
    ]);
  }

  // School and learning.
  if (hasAny(text, ["huiswerk", "toets", "school", "leraar", "docent", "les", "klas", "spreekbeurt", "presentatie"])) {
    chatContext.topic = "school";
    if (hasAny(text, ["huiswerk", "maken", "opdracht", "leren", "studeren"])) {
      return choose([
        `Waar gaat je opdracht over? Als je de vraag hier typt, kan ik je stap voor stap helpen nadenken. ♡`,
        `Welk vak is het? Vertel wat je moet doen, dan maken we het overzichtelijk.`,
        `Zullen we het opdelen in kleine stapjes? Wat is precies de opdracht?`
      ]);
    }
    if (hasAny(text, ["toets", "zenuwachtig", "bang", "stress"])) {
      return `Een toets kan best spannend zijn. ♡ Voor welk vak is de toets, en waar zie je het meest tegenop?`;
    }
    return `Wat is er op school gebeurd? Gaat het om een vak, iemand uit je klas of iets anders?`;
  }

  // Friends and social situations.
  if (hasAny(text, ["vriend", "vriendin", "ruzie", "groep", "genegeerd", "roddel", "verliefd", "crush"])) {
    chatContext.topic = "friends";
    return choose([
      `Dat kan best ingewikkeld voelen. Wat gebeurde er precies tussen jullie?`,
      `Wil je vertellen wat die persoon zei of deed? Dan denk ik met je mee.`,
      `Gaat het vooral om wat je moet zeggen, of om begrijpen wat er is gebeurd?`
    ]);
  }

  // Hobbies, boredom, and suggestions.
  if (hasAny(text, ["verveel", "saai", "niks te doen", "geen idee wat te doen"])) {
    chatContext.topic = "bored";
    return `Zullen we iets kiezen? ♡ We kunnen een raadsel doen, een mini-quiz spelen, een verhaal verzinnen of ideeën bedenken voor iets creatiefs. Waar heb je zin in?`;
  }
  if (hasAny(text, ["muziek", "liedje", "zingen", "film", "serie", "boek", "lezen", "tekenen", "hobby"])) {
    chatContext.topic = "hobby";
    return choose([
      `Leuk! Wat vind je daar het fijnst aan? Heb je een favoriet?`,
      `Oeh, vertel! Doe je dat zelf ook, of vind je het vooral leuk om te kijken/luisteren?`,
      `Wat is jouw favoriet op dit moment? ♡`
    ]);
  }

  // Games and mini-games.
  if (hasAny(text, ["spel", "spelletje", "spelletjes", "game", "puzzel", "raadsel", "quiz", "samen spelen"])) {
    chatContext.topic = "game";
    chatContext.waitingFor = "game_choice";
    return `Jaaa, gezellig! 🎮 Wat wil je doen: een raadsel, een woordspelletje of een mini-quiz?`;
  }

  // Jokes.
  if (hasAny(text, ["grap", "mop", "grappig", "lach"])) {
    chatContext.topic = "joke";
    return choose([
      `Waarom neemt een paddenstoel altijd de bus? Omdat hij geen sporen wil achterlaten! 🍄`,
      `Wat zegt een nul tegen een acht? Mooie riem! 😂`,
      `Waarom kon de fiets niet zelf staan? Hij was te moe! 🚲`
    ]);
  }

  // Identity and pet.
  if (hasAny(text, ["wie ben jij", "wat ben jij", "hoe heet jij", "naam"])) {
    return `Ik ben jouw Virtual Bestie! ♡ Jouw poppetje heet ${petName}. Je kunt met me kletsen, een raadsel doen of vertellen hoe je dag was.`;
  }
  if (hasAny(text, ["hoe heet mijn poppetje", "hoe heet mijn bestie", "naam van mijn poppetje"])) {
    return `Jouw poppetje heet ${petName}! ♡`;
  }

  // If user continues a topic, keep the conversation on that subject.
  if (chatContext.topic === "school") return `Ahh, ik snap het. Wat is het lastigste stukje van die opdracht of situatie?`;
  if (chatContext.topic === "friends") return `En hoe reageerde jij daarop? Wil je hulp met bedenken wat je kunt zeggen?`;
  if (chatContext.topic === "feelings") return `Ik luister. Wat zou je op dit moment het meeste helpen: samen nadenken of even afleiding?`;
  if (chatContext.topic === "hobby") return `Vertel verder! Wat vind je er zo leuk aan?`;
  if (chatContext.topic === "game") return startMiniGame(text);

  // Specific question fallback: ask for the missing detail rather than pretend to know.
  if (text.endsWith("?") || hasAny(text, ["waarom", "hoe", "wat", "wanneer", "wie", "welke", "kan je", "kun je"])) {
    return choose([
      `Ik wil je graag een gericht antwoord geven. Kun je iets meer vertellen over wat je bedoelt?`,
      `Goede vraag! Over welk onderwerp gaat het precies? Dan kan ik gerichter reageren. ♡`,
      `Ik weet niet zeker wat je bedoelt. Kun je een voorbeeld geven?`
    ]);
  }

  if (short) return choose([
    `Ooh, vertel eens iets meer! ♡`,
    `Wat bedoel je precies? Ik wil je goed begrijpen.`,
    `En hoe ging dat verder?`
  ]);
  return choose([
    `Als ik het goed begrijp, vertel je me over: "${message.slice(0, 100)}". Wat vind je daar zelf het belangrijkste aan?`,
    `Dankjewel dat je dat vertelt. Wat zou je graag willen dat er nu gebeurt?`,
    `Ik wil je niet verkeerd begrijpen. Wat bedoel je precies met het belangrijkste stukje?`
  ]);
}

function startMiniGame(choiceText) {
  const text = cleanText(choiceText);
  if (text.includes("raadsel")) {
    chatContext.waitingFor = "riddle_answer";
    return `Raadsel! 🧩 Wat heeft toetsen maar geen deuren, en een spatie maar geen kamer?`;
  }
  if (text.includes("quiz")) {
    chatContext.waitingFor = "quiz_answer";
    return `Mini-quiz! 🌟 Welke planeet staat bekend als de rode planeet?`;
  }
  if (text.includes("woord")) {
    chatContext.waitingFor = "word_game";
    return `Woordspel! Noem een dier dat begint met de letter K. 🐾`;
  }
  chatContext.waitingFor = "riddle_answer";
  return `Leuk, we beginnen met een raadsel! 🧩 Wat heeft toetsen maar geen deuren, en een spatie maar geen kamer?`;
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
    let answer;
    const normalizedAnswer = cleanText(text);
    if (chatContext.waitingFor === "riddle_answer") {
      chatContext.waitingFor = null;
      answer = hasAny(normalizedAnswer, ["toetsenbord", "keyboard"])
        ? "Jaaa, goed geraden!! 🎉 Het is een toetsenbord! Wil je nog een raadsel?"
        : "Leuke poging! Het antwoord is een toetsenbord: het heeft toetsen en een spatiebalk. ♡ Zullen we nog een spelletje doen?";
    } else if (chatContext.waitingFor === "quiz_answer") {
      chatContext.waitingFor = null;
      answer = hasAny(normalizedAnswer, ["mars"])
        ? "Helemaal goed! 🔴 Mars is de rode planeet. Zin in nog een quizvraag?"
        : "Bijna! Het juiste antwoord is Mars. 🔴 Wil je nog een quizvraag proberen?";
    } else if (chatContext.waitingFor === "word_game") {
      chatContext.waitingFor = null;
      answer = /^[a-z]/i.test(text)
        ? `Leuk woord! 🐾 Mijn beurt: kangoeroe! Kun jij nu een dier noemen dat begint met de laatste letter: E?`
        : "Noem maar een dier dat met de letter K begint! ♡";
    } else {
      answer = makeBestieReply(text);
    }
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
