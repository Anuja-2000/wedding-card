// Downloads guests + RSVPs from Firestore into rsvps.xlsx (with totals).
//   npm run export
import ExcelJS from "exceljs";
import { openDb, friendlyWriteError } from "./common.js";

const OUT = "rsvps.xlsx";
const db = openDb();
const [guestSnap, rsvpSnap] = await Promise.all([db.collection("guests").get(), db.collection("rsvps").get()]);
const rsvps = new Map(rsvpSnap.docs.map((d) => [d.id, d.data()]));

const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet("RSVPs");
ws.columns = [
  { header: "Name", key: "name", width: 28 },
  { header: "Invited seats", key: "seats", width: 14 },
  { header: "Response", key: "response", width: 16 },
  { header: "Coming", key: "coming", width: 10 },
  { header: "Note", key: "note", width: 40 },
  { header: "Responded at", key: "at", width: 20 },
];
ws.getRow(1).font = { bold: true };

const totals = { seats: 0, coming: 0, yes: 0, no: 0, pending: 0 };
const rows = guestSnap.docs.map((d) => {
  const g = d.data(), r = rsvps.get(d.id);
  totals.seats += g.seats;
  if (!r) totals.pending++;
  else if (r.attending) { totals.yes++; totals.coming += r.guests; }
  else totals.no++;
  return {
    name: g.name,
    seats: g.seats,
    response: !r ? "No reply yet" : r.attending ? "Attending" : "Declined",
    coming: r ? r.guests : "",
    note: r?.note || "",
    at: r?.updatedAt ? r.updatedAt.toDate() : "",
  };
});
const order = { Attending: 0, Declined: 1, "No reply yet": 2 };
rows.sort((a, b) => order[a.response] - order[b.response] || a.name.localeCompare(b.name));
ws.addRows(rows);
ws.getColumn("at").numFmt = "yyyy-mm-dd hh:mm";

ws.addRow([]);
const summary = [
  ["Total invited seats", totals.seats],
  ["Guests coming", totals.coming],
  ["Invitations accepted", totals.yes],
  ["Invitations declined", totals.no],
  ["No reply yet", totals.pending],
];
for (const s of summary) ws.addRow(s).font = { bold: true };

await wb.xlsx.writeFile(OUT).catch((e) => friendlyWriteError(e, OUT));
console.table(Object.fromEntries(summary));
console.log(`Saved ${OUT}`);
