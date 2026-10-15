// Reads guests.xlsx, uploads every guest to Firestore and writes each guest's
// personal link (and a WhatsApp link when a phone number is given) back into the sheet.
//   npm run sync      upload + save links
//   npm run preview   show what would happen, change nothing
import ExcelJS from "exceljs";
import { randomBytes } from "node:crypto";
import { SITE_URL, MESSAGE, GUESTS_FILE, openDb, text, friendlyWriteError } from "./common.js";

const dry = process.argv.includes("--dry");

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(GUESTS_FILE);
const ws = wb.worksheets[0];

const col = {};
const headerRow = ws.getRow(1);
headerRow.eachCell((c, i) => { col[text(c.value).toLowerCase()] = i; });
if (!col.name || !col.guests) {
  console.error(`${GUESTS_FILE} needs "Name" and "Guests" column headers in row 1.`);
  process.exit(1);
}
for (const h of ["ID", "Link", "WhatsApp"]) {
  if (!col[h.toLowerCase()]) {
    col[h.toLowerCase()] = headerRow.cellCount + 1;
    headerRow.getCell(col[h.toLowerCase()]).value = h;
  }
}

const guests = [];
const errors = [];
const seen = new Set();
for (let r = 2; r <= ws.rowCount; r++) {
  const row = ws.getRow(r);
  const name = text(row.getCell(col.name).value);
  if (!name) continue;
  const seats = Number(text(row.getCell(col.guests).value));
  if (!Number.isInteger(seats) || seats < 1 || seats > 20) {
    errors.push(`Row ${r} (${name}): Guests must be a whole number from 1 to 20`);
    continue;
  }
  let id = text(row.getCell(col.id).value);
  if (!id || seen.has(id)) id = randomBytes(6).toString("base64url");
  seen.add(id);

  const link = `${SITE_URL}/?g=${id}`;
  row.getCell(col.id).value = id;
  row.getCell(col.link).value = { text: link, hyperlink: link };
  const phone = col.phone ? text(row.getCell(col.phone).value).replace(/\D/g, "") : "";
  row.getCell(col.whatsapp).value = phone
    ? { text: "Send on WhatsApp", hyperlink: `https://wa.me/${phone}?text=${encodeURIComponent(MESSAGE(name, link))}` }
    : null;
  guests.push({ id, name, seats, link });
}

if (errors.length) {
  console.error("Fix these rows in " + GUESTS_FILE + " and run again:\n  " + errors.join("\n  "));
  process.exit(1);
}

console.table(guests.map(({ name, seats, link }) => ({ name, seats, link })));
const totalSeats = guests.reduce((s, g) => s + g.seats, 0);
console.log(`${guests.length} invitations, ${totalSeats} seats in total`);

if (dry) {
  console.log("\nPreview only – nothing was uploaded or saved. Run `npm run sync` to apply.");
  process.exit(0);
}

// Save the sheet first so the ids are never lost; uploading again with the same ids is safe.
for (const key of ["id", "link", "whatsapp"]) ws.getColumn(col[key]).width = key === "id" ? 12 : 40;
await wb.xlsx.writeFile(GUESTS_FILE).catch((e) => friendlyWriteError(e, GUESTS_FILE));

const db = openDb();
const keep = new Set(guests.map((g) => g.id));
const removed = (await db.collection("guests").get()).docs.filter((d) => !keep.has(d.id));

const ops = [
  ...guests.map((g) => (b) => b.set(db.doc(`guests/${g.id}`), { name: g.name, seats: g.seats })),
  ...removed.map((d) => (b) => b.delete(d.ref)),
];
for (let i = 0; i < ops.length; i += 400) {
  const batch = db.batch();
  ops.slice(i, i + 400).forEach((op) => op(batch));
  await batch.commit();
}

if (removed.length) console.log(`Removed ${removed.length} guest(s) no longer in the sheet: ${removed.map((d) => d.data().name).join(", ")}`);
console.log(`\nDone. Links saved in ${GUESTS_FILE}.`);
