import { existsSync, readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ---- EDIT THESE ----
export const SITE_URL = "https://list-app-918a8.web.app";
export const MESSAGE = (name, link) =>
  `Dear ${name},\n\nWith joy in our hearts, we invite you to celebrate our wedding on Sunday, 17 January 2027 at Avenra Gardens Hotel, Negombo.\n\n` +
  `Please view your invitation and RSVP here:\n${link}\n\nWith love,\nBinadhie & Anuja`;
// --------------------

export const GUESTS_FILE = "guests.xlsx";

export function openDb() {
  const keyFile = new URL("./serviceAccount.json", import.meta.url);
  if (!existsSync(keyFile)) {
    console.error("Missing tools/serviceAccount.json.\n" +
      "Firebase console > Project settings > Service accounts > Generate new private key, and save it as tools/serviceAccount.json");
    process.exit(1);
  }
  initializeApp({ credential: cert(JSON.parse(readFileSync(keyFile, "utf8"))) });
  return getFirestore();
}

// Excel cells can hold plain values, hyperlinks, rich text or formula results
export function text(v) {
  if (v == null) return "";
  if (typeof v === "object") {
    if (v.richText) return v.richText.map((t) => t.text).join("").trim();
    return String(v.text ?? v.result ?? v.hyperlink ?? "").trim();
  }
  return String(v).trim();
}

export function friendlyWriteError(err, file) {
  if (err.code === "EBUSY" || err.code === "EPERM") {
    console.error(`Could not save ${file}. Close it in Excel and run again.`);
    process.exit(1);
  }
  throw err;
}
