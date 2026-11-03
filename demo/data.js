// Demo data. Services and prices come from the salon's price list (docs/SPEC.md §5.5).
// People, appointments and report figures are synthetic and labeled as such in the UI.

window.BIZ = {
  name: "ROI MARCEL ASSARAF",
  nameHe: "רועי מרסל אסרף",
  tagline: "Hair Boutique · Style · Art · Beauty",
  address: "שדרות משה דיין 166, פסגת זאב, ירושלים",
  whatsapp: "972526424011",
  waze: "https://waze.com/ul?q=" + encodeURIComponent("שדרות משה דיין 166 ירושלים") + "&navigate=yes",
  open: { from: 10 * 60, to: 19 * 60 }, // Sun–Thu
};

// steps: w = work (stylist busy), p = processing (stylist free). blow: the step that is a blow-dry.
window.CATS = ["תספורות", "פן ועיצוב", "צבע", "גוונים ובליאז׳", "החלקות ושיקום", "ייעוץ"];
window.SERVICES = [
  { id: "cut_w", cat: "תספורות", name: "תספורת נשים", note: "כולל חפיפה", price: 250, steps: [["w", 30]] },
  { id: "cut_wb", cat: "תספורות", name: "תספורת נשים + פן", note: "כולל חפיפה", price: 300, steps: [["w", 40], ["w", 20, "blow"]] },
  { id: "cut_m", cat: "תספורות", name: "תספורת גבר", price: 100, steps: [["w", 20]] },
  { id: "blow_s", cat: "פן ועיצוב", name: "פן קצר / בינוני", price: 100, steps: [["w", 20, "blow"]] },
  { id: "blow_l", cat: "פן ועיצוב", name: "פן ארוך / תוספות", price: 150, from: true, steps: [["w", 30, "blow"]] },
  { id: "babyliss", cat: "פן ועיצוב", name: "פן בייביליס מוברש", price: 300, steps: [["w", 30]] },
  { id: "root", cat: "צבע", name: "צבע שורש", price: 250, steps: [["w", 5], ["p", 40], ["w", 10], ["w", 20, "blow"]] },
  { id: "color", cat: "צבע", name: "צבע מלא", price: 350, from: true, steps: [["w", 5], ["p", 40], ["w", 10], ["w", 20, "blow"]] },
  { id: "bleach", cat: "צבע", name: "הבהרה כללית", price: 700, steps: [["w", 40], ["p", 120], ["w", 30, "blow"]] },
  { id: "hl_half", cat: "גוונים ובליאז׳", name: "גוונים חצי ראש", note: "כולל טונר ופן", price: 600, from: true, steps: [["w", 40], ["p", 120], ["w", 30, "blow"]] },
  { id: "hl_full", cat: "גוונים ובליאז׳", name: "גוונים ראש מלא", note: "כולל טונר ופן", price: 1000, from: true, steps: [["w", 40], ["p", 120], ["w", 30, "blow"]] },
  { id: "balayage", cat: "גוונים ובליאז׳", name: "בליאז׳ / אומברה", note: "כולל טונר ופן", price: 1000, from: true, steps: [["w", 40], ["p", 120], ["w", 30, "blow"]] },
  { id: "straight", cat: "החלקות ושיקום", name: "החלקת שיער", price: 1000, from: true, steps: [["w", 10], ["p", 60], ["w", 10], ["w", 75]] },
  { id: "repair", cat: "החלקות ושיקום", name: "טיפול שיקום", price: 600, from: true, steps: [["w", 20], ["p", 10], ["w", 30]] },
  { id: "consult", cat: "ייעוץ", name: "פגישת ייעוץ", note: "גם לתוספות שיער", price: 0, steps: [["w", 20]], consult: true },
];
window.ADDON = { id: "addon_consult", name: "ייעוץ כללי לפני הטיפול", price: 0, minutes: 20 };

window.STYLISTS = [
  { id: "roi", name: "רועי מרסל אסרף", role: "מעצב שיער ובעל המספרה", photo: "assets/logo-360.jpg",
    bio: "טקסט לדוגמה: מעצב שיער עם התמחות בצבע, גוונים והחלקות. מלמד את קורס הספרות של המספרה.",
    socials: { ig: "#", tt: "#", fb: "#" }, services: "all" },
];

window.COURSES = [
  { id: "barber", name: "קורס ספרות גברים וילדים", sessions: 12, price: 6000, format: "פרונטלי במספרה + סרטונים מוקלטים",
    audience: "לכל מי שרוצה ללמוד לספר גברים וילדים. גם ילדים יכולים להירשם, באישור הורה.",
    cohorts: [ { id: "c1", label: "מחזור ינואר 2027", start: "ימי שני · 18:30", seats: 10, taken: 7 },
               { id: "c2", label: "מחזור מרץ 2027", start: "ימי רביעי · 18:30", seats: 10, taken: 10 } ] },
  { id: "keratin", name: "קורס החלקות וטיפולי קראטין", soon: true },
  { id: "cutting", name: "קורס גזירות", soon: true },
];

// Synthetic customers (not from the real customer file).
window.CUSTOMERS = [
  { id: 1, name: "דנה לוי", phone: "050-1234567", visits: 14, last: "12.10.2026", spent: 4820 },
  { id: 2, name: "מיכל אברהם", phone: "052-7654321", visits: 6, last: "28.10.2026", spent: 2150 },
  { id: 3, name: "שירן כהן", phone: "054-1112233", visits: 21, last: "30.10.2026", spent: 9300 },
  { id: 4, name: "נועה פרץ", phone: "053-4445566", visits: 2, last: "02.09.2026", spent: 600 },
  { id: 5, name: "יעל מזרחי", phone: "058-9998877", visits: 9, last: "19.10.2026", spent: 3400 },
  { id: 6, name: "אורי בן חיים", phone: "050-3332211", visits: 11, last: "25.10.2026", spent: 1100 },
  { id: 7, name: "תמר דהן", phone: "052-5556677", visits: 4, last: "07.08.2026", spent: 1450 },
];
