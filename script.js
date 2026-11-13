
let bestie = {
  name: "Mochi",
  happiness: 85,
  hunger: 65,
  energy: 75,
  clean: 90,
  xp: 0,
  level: 1,
  coins: 100
};

function update() {
  const stats = [
    ["happy", bestie.happiness],
    ["food", bestie.hunger],
    ["energy", bestie.energy],
    ["clean", bestie.clean]
  ];

  stats.forEach(([name, value]) => {
    document.getElementById(name + "Bar").style.width = value + "%";
    document.getElementById(name + "Text").textContent = value + "%";
  });

  document.getElementById("petName").textContent = bestie.name + " ✨";
  document.getElementById("level").textContent = bestie.level;
  document.getElementById("xp").textContent = bestie.xp;
  document.getElementById("xpBar").style.width = bestie.xp + "%";
  document.getElementById("coins").textContent = bestie.coins;
}

function reward(amount = 20) {
  bestie.xp += amount;

  if (bestie.xp >= 100) {
    bestie.xp -= 100;
    bestie.level++;
    bestie.coins += 25;
    message("LEVEL UP!! Je bent nu level " + bestie.level + " ✨");
  }
}

function message(text) {
  document.getElementById("message").textContent = text;
  document.getElementById("speech").textContent = text;
}

function feed() {
  if (bestie.hunger >= 100) {
    return message("Ik zit helemaal vol! 🍓");
  }

  bestie.hunger = Math.min(100, bestie.hunger + 25);
  bestie.happiness = Math.min(100, bestie.happiness + 5);
  bestie.coins += 2;

  reward();
  message("YUMMMM! Dankjewel voor het eten! 🍓");
  update();
}

function play() {
  if (bestie.energy < 15) {
    return message("Ik ben een beetje moe... 💤");
  }

  bestie.happiness = Math.min(100, bestie.happiness + 20);
  bestie.energy = Math.max(0, bestie.energy - 15);
  bestie.hunger = Math.max(0, bestie.hunger - 8);

  reward(25);
  message("DIT IS ZO LEUK!! 🧸");
  update();
}

function sleep() {
  bestie.energy = Math.min(100, bestie.energy + 35);
  reward(15);
  message("Zzz... lekker dromen! 💤");
  update();
}

function bath() {
  bestie.clean = Math.min(100, bestie.clean + 35);
  bestie.happiness = Math.min(100, bestie.happiness + 5);

  reward(15);
  message("Ik ruik weer naar bloemetjes! 🫧");
  update();
}

function renamePet() {
  const name = prompt("Hoe wil je jouw bestie noemen?");

  if (name && name.trim()) {
    bestie.name = name.trim().slice(0, 18);
    message("Hiiii! Ik ben " + bestie.name + "! ♡");
    update();
  }
}

update();
