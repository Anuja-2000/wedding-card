import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, doc, getDoc, setDoc, serverTimestamp, query, orderBy, limit, onSnapshot }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---- EDIT THESE ----
const WEDDING = {
  names: "Binadhie & Anuja",
  date: "2027-01-17T10:00:00+05:30",
  dateText: "Sunday, 17 January 2027",
  venueName: "Avenra Gardens Hotel",
  venueAddr: "Negombo, Sri Lanka",
  venueTime: "Wedding ceremony from 10:00 AM · Lunch to follow",
  mapQuery: "Avenra Gardens Hotel, Negombo, Sri Lanka",
  mapUrl: "https://maps.app.goo.gl/ewet8BMJ3fne9LMp6",
};
// Firebase console > Project settings > Your apps > Web app config
const firebaseConfig = {
  apiKey: "AIzaSyB2RONHDMgdV1XjnQyyFmWyHnKGMLQfvzs",
  authDomain: "list-app-918a8.firebaseapp.com",
  projectId: "list-app-918a8",
  appId: "1:1017126925462:web:34194cb4a14b18330dbeb7",
};
// --------------------

const $ = (id) => document.getElementById(id);
$("names").textContent = WEDDING.names;
document.title = `${WEDDING.names} – Wedding Invitation`;
$("dateText").textContent = WEDDING.dateText;
$("venueName").textContent = WEDDING.venueName;
$("venueAddr").textContent = WEDDING.venueAddr;
$("venueTime").textContent = WEDDING.venueTime;
$("mapBtn").href = WEDDING.mapUrl;
const start = new Date(WEDDING.date);
const fmt = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
$("calBtn").href = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" +
  encodeURIComponent("Wedding: " + WEDDING.names) + "&dates=" + fmt(start) + "/" +
  fmt(new Date(start.getTime() + 4 * 3600e3)) + "&location=" + encodeURIComponent(WEDDING.mapQuery);

// Countdown
function tick() {
  let s = Math.max(0, Math.floor((start - Date.now()) / 1000));
  const u = [["Days", 86400], ["Hrs", 3600], ["Min", 60], ["Sec", 1]];
  $("countdown").innerHTML = u.map(([l, n]) => {
    const v = Math.floor(s / n); s %= n;
    return `<div><b>${v}</b>${l}</div>`;
  }).join("");
}
tick(); setInterval(tick, 1000);

// Scroll reveal
const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")), { threshold: .2 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

// Hide the scroll hint once the guest starts scrolling
addEventListener("scroll", () => $("scrollHint").classList.toggle("hide", scrollY > 60), { passive: true });

// Falling petals
const petalColors = ["#f9c6a8", "#fbd5c0", "#ffe4d6", "#f5b294", "#ffffff", "#fcd9cf"];
function spawnPetal() {
  if (document.hidden) return;
  const p = document.createElement("span");
  const size = 10 + Math.random() * 12;
  const fall = 9 + Math.random() * 7;
  p.className = "petal";
  p.style.cssText = `left:${Math.random() * 100}vw;width:${size}px;height:${size * 0.8}px;` +
    `background:${petalColors[Math.floor(Math.random() * petalColors.length)]};` +
    `animation-duration:${fall}s,${2 + Math.random() * 2}s;`;
  $("petals").append(p);
  setTimeout(() => p.remove(), fall * 1000);
}
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  for (let i = 0; i < 6; i++) setTimeout(spawnPetal, i * 400);
  setInterval(spawnPetal, 700);
}

// Background music: plays by default; browsers may block sound until the first tap
const bgm = $("bgm"), musicBtn = $("musicBtn");
const VOLUME = 0.4;
let muted = false;
try { muted = localStorage.getItem("muted") === "1"; } catch {}
function fadeIn() {
  bgm.volume = 0;
  const t = setInterval(() => {
    bgm.volume = Math.min(VOLUME, bgm.volume + 0.02);
    if (bgm.volume >= VOLUME) clearInterval(t);
  }, 100);
}
function renderMusic() {
  const playing = !bgm.paused;
  musicBtn.classList.toggle("playing", playing);
  musicBtn.classList.toggle("muted", !playing);
  musicBtn.setAttribute("aria-pressed", String(!playing));
  musicBtn.setAttribute("aria-label", playing ? "Mute music" : "Play music");
}
async function playMusic() {
  try { await bgm.play(); fadeIn(); } catch {}
  renderMusic();
}
function unlock(e) {
  if (e.target.closest("#musicBtn")) return;
  if (!muted && bgm.paused) playMusic();
  ["pointerdown", "keydown", "touchend"].forEach((ev) => removeEventListener(ev, unlock));
}
musicBtn.addEventListener("click", () => {
  muted = !bgm.paused;
  try { localStorage.setItem("muted", muted ? "1" : "0"); } catch {}
  muted ? bgm.pause() : playMusic();
  renderMusic();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) bgm.pause();
  else if (!muted) playMusic();
});
bgm.addEventListener("play", renderMusic);
bgm.addEventListener("pause", renderMusic);
renderMusic();
if (!muted) {
  playMusic();
  ["pointerdown", "keydown", "touchend"].forEach((ev) => addEventListener(ev, unlock));
}

// Firestore
const db = getFirestore(initializeApp(firebaseConfig));

function handle(formId, statusId, save, thanks, reset) {
  const form = $(formId), status = $(statusId);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    if (fd.get("website")) return; // honeypot
    const btn = form.querySelector("button");
    btn.disabled = true;
    status.textContent = "Sending…";
    try {
      await save(fd);
      status.textContent = thanks;
      if (reset) form.reset();
    } catch (err) {
      console.error(err);
      status.textContent = "Something went wrong. Please try again.";
    } finally {
      btn.disabled = false;
    }
  });
}

handle("wishForm", "wishStatus", (fd) => addDoc(collection(db, "wishes"), {
  name: fd.get("name").trim().slice(0, 60),
  message: fd.get("message").trim().slice(0, 300),
  createdAt: serverTimestamp(),
}), "Thank you! ♡", true);

// Personal invitation: ?g=<guest id> from the link generated by tools/sync-guests.js
const guestId = new URLSearchParams(location.search).get("g");
let guest = null;

function setAttending(yes) {
  $("guestRow").hidden = !yes || guest.seats === 1;
}

async function loadGuest() {
  if (!guestId || !/^[\w-]{6,30}$/.test(guestId)) return;
  const snap = await getDoc(doc(db, "guests", guestId));
  if (!snap.exists()) {
    $("rsvpIntro").textContent = "We couldn't find this invitation link. Please check the link we sent you.";
    return;
  }
  guest = snap.data();
  const plural = guest.seats === 1 ? "seat" : "seats";
  $("guestName").textContent = guest.name;
  $("greeting").hidden = false;
  $("seats").textContent = `We have reserved ${guest.seats} ${plural} in your honour`;
  $("seats").hidden = false;
  $("rsvpName").textContent = guest.name;
  $("guestSelect").replaceChildren(...Array.from({ length: guest.seats }, (_, i) => new Option(i + 1, i + 1)));
  $("guestSelect").value = guest.seats;
  $("wishForm").elements.name.value = guest.name;
  $("rsvpIntro").textContent = "Kindly let us know if you can join us.";
  $("rsvpForm").hidden = false;
  setAttending(true);

  const prev = await getDoc(doc(db, "rsvps", guestId));
  if (prev.exists()) {
    const r = prev.data();
    $("rsvpForm").elements.attending.value = r.attending ? "yes" : "no";
    if (r.attending) $("guestSelect").value = r.guests;
    $("rsvpForm").elements.note.value = r.note || "";
    setAttending(r.attending);
    $("rsvpStatus").textContent = "We've received your response ♡ You can update it anytime.";
    $("rsvpForm").querySelector("button").textContent = "Update RSVP";
  }
}

$("rsvpForm").addEventListener("change", (e) => {
  if (e.target.name === "attending") setAttending(e.target.value === "yes");
});

handle("rsvpForm", "rsvpStatus", async (fd) => {
  const attending = fd.get("attending") === "yes";
  await setDoc(doc(db, "rsvps", guestId), {
    name: guest.name,
    attending,
    guests: attending ? Math.min(guest.seats, Math.max(1, +fd.get("guests") || 1)) : 0,
    note: (fd.get("note") || "").trim().slice(0, 200),
    updatedAt: serverTimestamp(),
  });
  $("rsvpForm").querySelector("button").textContent = "Update RSVP";
}, "Thank you! Your response has been saved ♡", false);

loadGuest().catch((err) => console.error(err));

onSnapshot(query(collection(db, "wishes"), orderBy("createdAt", "desc"), limit(50)), (snap) => {
  const ul = $("wishes"); ul.textContent = "";
  snap.forEach((d) => {
    const { name, message } = d.data();
    const li = document.createElement("li");
    const b = document.createElement("b"); b.textContent = name;
    li.append(b, document.createTextNode(message));
    ul.append(li);
  });
});
