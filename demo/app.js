/* ROI Marcel Assaraf — clickable demo. Plain JS, no build step. */
(() => {
  const B = window.BIZ, SV = window.SERVICES, ST = window.STYLISTS;
  const byId = Object.fromEntries(SV.map(s => [s.id, s]));
  const $app = document.getElementById("app");
  const DAY = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  const DAY_S = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
  const MON = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

  // ---------- helpers ----------
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ic = (n, cls = "") => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const hm = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const money = n => n === 0 ? "ללא עלות" : `${n.toLocaleString("he-IL")} ₪`;
  const dur = m => m < 60 ? `${m} דק׳` : (m % 60 ? `${Math.floor(m / 60)} ש׳ ${m % 60} דק׳` : (m === 60 ? "שעה" : m === 120 ? "שעתיים" : `${m / 60} שעות`));
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const longDate = s => { const d = parse(s); return `יום ${DAY[d.getDay()]}, ${d.getDate()} ב${MON[d.getMonth()]}`; };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
  const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) ^ Math.imul(seed ^ (seed >>> 13), 3266489909)) >>> 0) / 4294967296;
  const isOpen = d => d.getDay() <= 4; // Sun–Thu. Friday opens only when the owner opens it.

  // Service plan: processing services first, one blow-dry at the end, optional consult first.
  function plan(ids, addon) {
    const list = ids.map(id => byId[id]).sort((a, b) => hasP(b) - hasP(a));
    let steps = [];
    if (addon) steps.push(["w", window.ADDON.minutes, "addon"]);
    list.forEach(s => s.steps.forEach(st => steps.push([...st, s.id])));
    const blows = steps.filter(st => st[2] === "blow");
    let merged = false;
    if (blows.length > 1) { merged = true; const last = blows[blows.length - 1]; steps = steps.filter(st => st[2] !== "blow" || st === last); }
    const total = steps.reduce((a, st) => a + st[1], 0);
    const wait = steps.filter(st => st[0] === "p").reduce((a, st) => a + st[1], 0);
    const price = list.reduce((a, s) => a + s.price, 0);
    return { list, steps, total, wait, work: total - wait, price, from: list.some(s => s.from), merged };
  }
  const hasP = s => s.steps.some(st => st[0] === "p") ? 1 : 0;
  const ribbon = steps => `<div class="ribbon" role="img" aria-label="זמן בכיסא וזמני המתנה">${steps.map(st => `<b class="${st[0] === "p" ? "p" : ""}" style="flex:${st[1]}"></b>`).join("")}</div>`;
  const legend = p => `<div class="ribbon-legend"><span><i></i>בכיסא ${dur(p.work)}</span>${p.wait ? `<span><i class="p"></i>הצבע נספג ${dur(p.wait)}</span>` : ""}<span>${ic("clock", "sm")}סה״כ ${dur(p.total)}</span></div>`;

  // Busy work-intervals per date (synthetic), plus appointments booked in this session.
  function busy(dateStr) {
    const r = rng(hash(dateStr)), out = [];
    let t = 600 + Math.floor(r() * 4) * 15;
    while (t < 1100) {
      const len = [20, 30, 45, 60, 75][Math.floor(r() * 5)];
      if (r() > .35) out.push([t, t + len]);
      t += len + Math.floor(r() * 5) * 15;
    }
    S.appts.filter(a => a.date === dateStr && a.status === "booked").forEach(a => {
      let off = a.start; plan(a.svc, a.addon).steps.forEach(st => { if (st[0] === "w") out.push([off, off + st[1]]); off += st[1]; });
    });
    return out;
  }
  function slots(dateStr, p) {
    const d = parse(dateStr); if (!isOpen(d)) return [];
    const bz = busy(dateStr), out = [];
    const min = dateStr === ymd(today) ? nowMin() + 60 : 0;
    for (let t = B.open.from; t + p.total <= B.open.to; t += 15) {
      if (t < min) continue;
      let off = t, ok = true;
      for (const st of p.steps) { if (st[0] === "w" && bz.some(([a, b]) => off < b && off + st[1] > a)) { ok = false; break; } off += st[1]; }
      if (ok) out.push(t);
    }
    return out;
  }

  // ---------- state ----------
  const firstAppt = (() => { const d = new Date(today); do d.setDate(d.getDate() + 1); while (!isOpen(d)); d.setDate(d.getDate() + 7); while (!isOpen(d)) d.setDate(d.getDate() + 1); return ymd(d); })();
  const S = {
    mode: "client", theme: "dark", route: "home",
    b: freshBooking(),
    appts: [{ id: 1, date: firstAppt, start: 11 * 60, svc: ["cut_wb"], addon: false, stylist: "roi", status: "booked" }],
    lastBooked: null, confirmCancel: null,
    me: { name: "דנה לוי", phone: "050-1234567", birthday: "", marketing: false, email: "" },
    course: { cohort: null, minor: false },
    st: { route: "cal", sheet: null, method: "card", inst: 1, discount: 0, tip: 0, pin: "idle", q: "", client: null, sent: false, prices: {} },
  };
  function freshBooking() { return { svc: [], addon: false, stylist: "roi", date: null, time: null, step: 0, forOther: false, oName: "", oPhone: "", notes: "", photos: [], recurring: false, every: 4, waitMode: "auto", errors: {}, busy: false }; }
  try { const t = localStorage.getItem("roi-theme"); if (t) S.theme = t; } catch (e) {}

  // ---------- client views ----------
  const tab = (r, label, icon) => `<button data-action="go" data-v="${r}" ${S.route === r || (r === "book" && S.route === "book") ? 'aria-current="page"' : ""}>${ic(icon)}${label}</button>`;
  function clientView() {
    const v = { home, book, success, appts, stylist, course, me }[S.route] || home;
    const inBook = S.route === "book";
    return `<div class="client ${inBook ? "booking" : ""}"><main>${v()}</main>${inBook ? dock() : `<div class="tabbar"><nav aria-label="ניווט ראשי">${tab("home", "בית", "home")}${tab("book", "קביעת תור", "calplus")}${tab("appts", "התורים שלי", "list")}${tab("me", "החשבון", "user")}</nav></div>`}</div>`;
  }
  const head = (title, back) => `<div class="screen-head">${back ? `<button class="icon-btn back" data-action="${back}" aria-label="חזרה">${ic("back")}</button>` : ""}<h1>${title}</h1></div>`;

  function home() {
    const next = S.appts.filter(a => a.status === "booked").sort((a, b) => (a.date + hm(a.start)).localeCompare(b.date + hm(b.start)))[0];
    const st = ST[0];
    return `
      <section class="sign"><img src="assets/logo-360.jpg" alt="ROI Marcel Assaraf Hair Boutique" width="196" height="196"><p>${esc(B.address)}</p></section>
      ${next ? `<article class="next-appt" aria-label="התור הבא שלך"><div class="band"></div><div class="body">
        <h2>התור הבא שלך</h2>
        <div class="meta"><span>${ic("cal", "sm")}${longDate(next.date)}</span><span class="num">${ic("clock", "sm")}${hm(next.start)}</span></div>
        <div class="meta"><span>${ic("scissors", "sm")}${next.svc.map(id => byId[id].name).join(" · ")}</span></div>
        <div class="chip-row"><a class="btn sm" href="${B.waze}" target="_blank" rel="noopener">${ic("nav", "sm")}ניווט</a><button class="btn sm ghost" data-action="go" data-v="appts">ניהול התור</button></div>
      </div></article>` : ""}
      <div class="cta-book"><button class="btn primary block" data-action="go" data-v="book">${ic("calplus")}קביעת תור</button></div>
      <section class="section"><h2>מעצבי השיער</h2>
        <button class="row-link" data-action="stylist" data-v="${st.id}"><img class="avatar" src="${st.photo}" alt=""><span><span class="title">${esc(st.name)}</span><br><span class="desc">${esc(st.role)}</span></span>${ic("fwd", "chev")}</button>
      </section>
      <section class="section"><h2>קורסים</h2>
        ${window.COURSES.map(c => `<button class="row-link" ${c.soon ? "disabled" : `data-action="course" data-v="${c.id}"`}><span class="avatar">${ic("cap")}</span><span><span class="title">${esc(c.name)}</span><br><span class="desc">${c.soon ? "ההרשמה תיפתח בקרוב" : `${c.sessions} מפגשים · ${money(c.price)} · עד 12 תשלומים`}</span></span>${c.soon ? "" : ic("fwd", "chev")}</button>`).join("")}
      </section>
      <section class="section"><h2>יצירת קשר</h2>
        <div class="contact"><a class="btn" href="https://wa.me/${B.whatsapp}" target="_blank" rel="noopener">${ic("wa")}וואטסאפ</a><a class="btn" href="${B.waze}" target="_blank" rel="noopener">${ic("nav")}ניווט ב-Waze</a></div>
        <p class="addr">${esc(B.address)} · א׳–ה׳ 10:00–19:00 · שישי וערבי חג לפי עדכון</p>
      </section>`;
  }

  // booking
  const STEP_T = ["מה עושים היום?", "אצל מי?", "מתי נוח לך?", "כמה פרטים", "בדיקה אחרונה"];
  function book() {
    const b = S.b;
    const bar = `<div class="steps" aria-label="שלב ${b.step + 1} מתוך 5">${STEP_T.map((_, i) => `<i class="${i <= b.step ? "on" : ""}"></i>`).join("")}</div>`;
    const back = b.step === 0 ? "go-home" : "prev";
    return head(STEP_T[b.step], back) + bar + [stepServices, stepStylist, stepWhen, stepDetails, stepConfirm][b.step]();
  }
  function stepServices() {
    const b = S.b;
    return window.CATS.map(cat => `<h2 class="cat">${cat}</h2>` + SV.filter(s => s.cat === cat).map(s => {
      const p = plan([s.id]);
      return `<button class="svc ${s.consult ? "consult" : ""}" data-action="svc" data-v="${s.id}" aria-pressed="${b.svc.includes(s.id)}">
        <span class="name">${esc(s.name)}</span>
        <span class="price">${s.from ? "<small>החל מ־</small>" : ""}${money(s.price)}</span>
        <span class="dur"><span class="tick">${ic("check", "sm")}</span>${dur(p.total)}${p.wait ? ` · מתוכן ${dur(p.wait)} המתנה` : ""}${s.note ? ` · ${esc(s.note)}` : ""}</span>
      </button>`;
    }).join("")).join("") + `
      <div class="panel" style="margin-top:18px"><div class="toggle"><span><b>${esc(window.ADDON.name)}</b><br><span class="hint">ללא עלות · ${window.ADDON.minutes} דק׳ לפני הטיפול</span></span>
      <button class="switch" role="switch" aria-checked="${b.addon}" aria-label="${esc(window.ADDON.name)}" data-action="addon"></button></div></div>
      <p class="hint" style="margin-top:14px">תוספות שיער נקבעות לאחר פגישת ייעוץ. המחיר הסופי נקבע לאחר ייעוץ ואבחון.</p>`;
  }
  function stepStylist() {
    return ST.map(s => `<button class="stylist-card" data-action="pick-stylist" data-v="${s.id}" aria-pressed="${S.b.stylist === s.id}">
      <img class="avatar" src="${s.photo}" alt=""><span><b>${esc(s.name)}</b><br><span class="hint">${esc(s.role)}</span></span>
      <span style="margin-inline-start:auto">${S.b.stylist === s.id ? ic("check") : ""}</span></button>`).join("") +
      `<p class="hint">מעצבי שיער נוספים יצטרפו בקרוב.</p>`;
  }
  function stepWhen() {
    const b = S.b, p = plan(b.svc, b.addon);
    const days = [];
    for (let i = 0; i < 28; i++) { const d = new Date(today); d.setDate(d.getDate() + i); days.push(d); }
    if (!b.date) { const first = days.find(d => isOpen(d) && slots(ymd(d), p).length); b.date = first ? ymd(first) : null; }
    const strip = `<div class="days" role="group" aria-label="בחירת יום">${days.map(d => {
      const s = ymd(d), open = isOpen(d);
      return `<button class="day" data-action="date" data-v="${s}" aria-pressed="${b.date === s}" ${open ? "" : "disabled"} aria-label="${longDate(s)}${open ? "" : ", סגור"}">
        <span class="dn">${i18nDay(d)}</span><span class="dd">${d.getDate()}</span><span class="dm">${open ? MON[d.getMonth()].slice(0, 3) : "סגור"}</span></button>`;
    }).join("")}</div>`;
    let body = "";
    if (b.date) {
      const list = slots(b.date, p);
      const groups = [["בוקר", t => t < 12 * 60], ["צהריים", t => t >= 12 * 60 && t < 15 * 60], ["אחר הצהריים", t => t >= 15 * 60]];
      body = list.length ? groups.map(([g, f]) => { const ts = list.filter(f); return ts.length ? `<div class="slot-group"><h3>${g}</h3><div class="slots">${ts.map(t => `<button class="slot" data-action="time" data-v="${t}" aria-pressed="${b.time === t}">${hm(t)}</button>`).join("")}</div></div>` : ""; }).join("")
        : `<div class="empty">${ic("cal", "lg")}<strong>אין תור פנוי ב${longDate(b.date)}</strong><span>אפשר לבחור יום אחר, או להצטרף לרשימת ההמתנה של היום הזה.</span>
           <div class="chip-row" role="radiogroup" aria-label="כשמתפנה תור">
             <button class="chip" role="radio" data-action="waitmode" data-v="auto" aria-pressed="${b.waitMode === "auto"}" aria-checked="${b.waitMode === "auto"}">שבצו אותי אוטומטית</button>
             <button class="chip" role="radio" data-action="waitmode" data-v="notify" aria-pressed="${b.waitMode === "notify"}" aria-checked="${b.waitMode === "notify"}">שלחו לי הודעה ואבחר</button></div>
           <button class="btn primary" data-action="waitlist">${ic("bell")}הצטרפות לרשימת ההמתנה</button></div>`;
    }
    return strip + `<p class="hint">${p.wait ? "בזמן שהצבע נספג רועי פנוי, ולכן מוצגות גם שעות שחופפות לטיפולים אחרים." : ""}</p>` + body;
  }
  const i18nDay = d => d.toDateString() === today.toDateString() ? "היום" : DAY_S[d.getDay()];
  function stepDetails() {
    const b = S.b, e = b.errors;
    return `
      <div class="panel"><span class="hint">מחובר בתור</span><div><b>${esc(S.me.name)}</b> · <span class="num">${esc(S.me.phone)}</span></div></div>
      <div class="section" style="margin-top:18px"><div class="field"><span>עבור מי התור?</span>
        <div class="chip-row" role="radiogroup"><button class="chip" role="radio" data-action="for" data-v="me" aria-pressed="${!b.forOther}" aria-checked="${!b.forOther}">בשבילי</button><button class="chip" role="radio" data-action="for" data-v="other" aria-pressed="${b.forOther}" aria-checked="${b.forOther}">בשביל מישהו אחר</button></div></div>
        ${b.forOther ? `<div style="display:grid;gap:12px;margin-top:12px">
          <label class="field"><span>שם מלא</span><input class="input" data-bind="oName" value="${esc(b.oName)}" autocomplete="off" ${e.oName ? 'aria-invalid="true"' : ""}>${e.oName ? `<span class="err">צריך שם כדי לקבוע את התור</span>` : ""}</label>
          <label class="field"><span>טלפון נייד</span><input class="input num" data-bind="oPhone" value="${esc(b.oPhone)}" inputmode="tel" placeholder="05X-XXXXXXX" ${e.oPhone ? 'aria-invalid="true"' : ""}>${e.oPhone ? `<span class="err">מספר נייד ישראלי, 10 ספרות שמתחילות ב-05</span>` : `<span class="hint">אישור ותזכורות יישלחו ב-SMS למספר הזה</span>`}</label></div>` : ""}
      </div>
      <label class="field section"><span>הערות לרועי</span><textarea class="input" data-bind="notes" placeholder="לדוגמה: אורך עד הכתפיים, בלי פוני">${esc(b.notes)}</textarea></label>
      <div class="field section"><span>תמונת השראה</span><div class="upload">${b.photos.map(u => `<img src="${u}" alt="תמונת השראה">`).join("")}${b.photos.length < 3 ? `<label>${ic("image")}<input type="file" accept="image/*" class="sr" data-action="photo" aria-label="העלאת תמונת השראה"></label>` : ""}</div><span class="hint">עד 3 תמונות</span></div>
      <div class="panel section"><div class="toggle"><span><b>תור קבוע</b><br><span class="hint">אותו יום ושעה, כל ${b.every} שבועות</span></span><button class="switch" role="switch" aria-checked="${b.recurring}" aria-label="תור קבוע" data-action="recurring"></button></div>
        ${b.recurring ? `<div class="chip-row">${[3, 4, 6, 8].map(n => `<button class="chip" data-action="every" data-v="${n}" aria-pressed="${b.every === n}">כל ${n} שבועות</button>`).join("")}</div>` : ""}</div>`;
  }
  function stepConfirm() {
    const b = S.b, p = plan(b.svc, b.addon), st = ST.find(s => s.id === b.stylist);
    return `<div class="panel"><dl>
        <div class="kv"><dt>אצל</dt><dd>${esc(st.name)}</dd></div>
        <div class="kv"><dt>מתי</dt><dd>${longDate(b.date)} · ${hm(b.time)}</dd></div>
        <div class="kv"><dt>עד בערך</dt><dd>${hm(b.time + p.total)}</dd></div>
        ${b.forOther ? `<div class="kv"><dt>עבור</dt><dd>${esc(b.oName)}</dd></div>` : ""}
        ${p.list.map(s => `<div class="kv"><dt>${esc(s.name)}</dt><dd>${s.from ? "החל מ־" : ""}${money(s.price)}</dd></div>`).join("")}
        ${b.addon ? `<div class="kv"><dt>${esc(window.ADDON.name)}</dt><dd>ללא עלות</dd></div>` : ""}
        <div class="kv"><dt><b>סה״כ</b></dt><dd>${p.from ? "החל מ־" : ""}${money(p.price)}</dd></div>
      </dl></div>
      <div class="panel">${ribbon(p.steps)}${legend(p)}${p.merged ? `<p class="note-line" style="margin-top:8px">${ic("check", "sm")}הפן נעשה פעם אחת, בסוף.</p>` : ""}</div>
      <div class="panel"><p class="note-line">${ic("cash", "sm")}התשלום במספרה: אשראי עד 5 תשלומים, ביט, PayBox, Google Pay או מזומן.</p>
      <p class="note-line" style="margin-top:6px">${ic("clock", "sm")}אפשר לבטל או לשנות עד שעה לפני התור.</p>
      ${b.recurring ? `<p class="note-line" style="margin-top:6px">${ic("repeat", "sm")}תור קבוע כל ${b.every} שבועות.</p>` : ""}</div>`;
  }
  function dock() {
    const b = S.b, p = plan(b.svc, b.addon);
    if (!b.svc.length && b.step === 0) return "";
    const can = [b.svc.length > 0, !!b.stylist, b.date && b.time != null, true, true][b.step];
    const label = b.step === 4 ? "קביעת התור" : "המשך";
    const when = b.date && b.time != null && b.step >= 2 ? `${longDate(b.date)} · ${hm(b.time)}` : `${b.svc.length + (b.addon ? 1 : 0)} נבחרו`;
    return `<div class="dock"><div class="in">
      <div class="sum"><span>${when}</span><strong>${p.from ? "<small style='font-weight:500;font-size:13px;color:var(--ink-3)'>החל מ־ </small>" : ""}${money(p.price)}</strong></div>
      ${ribbon(p.steps)}
      <div class="sum"><span>${dur(p.total)}${p.wait ? ` · מתוכן ${dur(p.wait)} המתנה` : ""}</span></div>
      <button class="btn primary block ${b.busy ? "loading" : ""}" data-action="${b.step === 4 ? "confirm" : "next"}" ${can ? "" : "disabled"}>${b.busy ? "קובע…" : label}</button>
    </div></div>`;
  }
  function success() {
    const a = S.lastBooked, p = plan(a.svc, a.addon);
    return `<div class="success"><div class="seal">${ic("check", "lg")}</div>
      <h1 style="font-family:var(--font-title);font-size:28px;margin:6px 0 0">התור נקבע</h1>
      <p class="sub">${longDate(a.date)} · <span class="num">${hm(a.start)}</span> אצל ${esc(ST[0].name)}</p>
      <p class="hint">אישור נשלח ב-SMS ל-<span class="num">${esc(a.forPhone || S.me.phone)}</span>. יום לפני נבקש לאשר הגעה.</p>
      <div class="panel" style="width:100%;text-align:start">${ribbon(p.steps)}${legend(p)}</div>
      <div class="actions">
        <button class="btn" data-action="ics">${ic("calplus")}הוספה ליומן</button>
        <a class="btn" href="${B.waze}" target="_blank" rel="noopener">${ic("nav")}ניווט</a>
        <a class="btn" href="https://wa.me/${B.whatsapp}" target="_blank" rel="noopener">${ic("wa")}וואטסאפ</a>
        <button class="btn" data-action="share">${ic("send")}שיתוף</button>
      </div>
      <button class="btn primary block" style="margin-top:8px" data-action="go" data-v="appts">לתורים שלי</button></div>`;
  }
  function appts() {
    const up = S.appts.filter(a => a.status !== "cancelled").sort((a, b) => (a.date + hm(a.start || 0)).localeCompare(b.date + hm(b.start || 0)));
    const item = a => {
      if (a.status === "waitlist") return `<div class="appt"><div class="top"><span class="when">${longDate(a.date)}</span><span class="badge warn">ברשימת המתנה</span></div><div class="svcs">${a.svc.map(id => byId[id].name).join(" · ")}</div><span class="hint">${a.waitMode === "auto" ? "כשיתפנה תור מתאים נשבץ אותך ונשלח SMS." : "כשיתפנה תור נשלח לך הודעה לבחירה."}</span><div class="chip-row"><button class="btn sm ghost" data-action="cancel" data-v="${a.id}">יציאה מהרשימה</button></div></div>`;
      const startMs = parse(a.date).getTime() + a.start * 60000, late = startMs - Date.now() < 3600000;
      const ask = S.confirmCancel === a.id;
      return `<div class="appt"><div class="top"><span class="when">${longDate(a.date)} · <span class="num">${hm(a.start)}</span></span><span class="badge ok">נקבע</span></div>
        <div class="svcs">${a.svc.map(id => byId[id].name).join(" · ")} · אצל רועי</div>
        ${late ? `<span class="hint">פחות משעה לתור. לשינוי כתבו לנו בוואטסאפ.</span><div class="chip-row"><a class="btn sm" href="https://wa.me/${B.whatsapp}" target="_blank" rel="noopener">${ic("wa", "sm")}וואטסאפ</a></div>`
        : ask ? `<div class="chip-row"><span style="align-self:center">לבטל את התור?</span><button class="btn sm" data-action="cancel-yes" data-v="${a.id}">כן, לבטל</button><button class="btn sm ghost" data-action="cancel-no">לא</button></div>`
        : `<div class="chip-row"><button class="btn sm" data-action="reschedule" data-v="${a.id}">שינוי מועד</button><button class="btn sm ghost" data-action="cancel" data-v="${a.id}">ביטול</button><a class="btn sm ghost" href="${B.waze}" target="_blank" rel="noopener">${ic("nav", "sm")}ניווט</a></div>`}
      </div>`;
    };
    return head("התורים שלי") + (up.length ? up.map(item).join("") : `<div class="empty" style="margin-top:12px">${ic("cal", "lg")}<strong>אין תורים קרובים</strong><span>כשתקבע תור הוא יופיע כאן, עם אפשרות לשנות או לבטל עד שעה לפני.</span><button class="btn primary" data-action="go" data-v="book">קביעת תור</button></div>`);
  }
  function stylist() {
    const s = ST[0];
    return `<div class="profile-cover"></div>
      <div class="profile-head"><img src="${s.photo}" alt=""><div><h1>${esc(s.name)}</h1><span class="hint">${esc(s.role)}</span></div></div>
      <p style="margin:14px 0 0;color:var(--ink-2)">${esc(s.bio)}</p>
      <div class="socials"><a href="${s.socials.ig}" aria-label="אינסטגרם">${ic("ig")}</a><a href="${s.socials.tt}" aria-label="טיקטוק">${ic("tt")}</a><a href="${s.socials.fb}" aria-label="פייסבוק">${ic("fb")}</a><a href="https://wa.me/${B.whatsapp}" aria-label="וואטסאפ">${ic("wa")}</a></div>
      <button class="btn primary block" style="margin-top:18px" data-action="go" data-v="book">קביעת תור אצל רועי</button>
      <section class="section"><h2>עבודות</h2><div class="gallery">${Array.from({ length: 6 }, () => `<div>${ic("image")}</div>`).join("")}</div>
        <p class="hint" style="margin-top:8px">כאן יופיעו תמונות מהעבודות של רועי. בדמו אין עדיין תמונות.</p>
        <a class="btn block" style="margin-top:8px" href="${s.socials.ig}">${ic("ig")}עוד עבודות באינסטגרם</a></section>
      <section class="section"><h2>מחירון</h2><table class="price-table">${SV.map(x => `<tr><td>${esc(x.name)}</td><td>${x.from ? "החל מ־" : ""}${money(x.price)}</td></tr>`).join("")}</table></section>`;
  }
  function course() {
    const c = window.COURSES[0], st = S.course;
    return head("", "go-home") + `<div class="course-hero"><h1>${esc(c.name)}</h1><p class="sub">${esc(c.audience)}</p></div>
      <div class="panel section"><dl>
        <div class="kv"><dt>מפגשים</dt><dd>${c.sessions}</dd></div>
        <div class="kv"><dt>מתכונת</dt><dd>${esc(c.format)}</dd></div>
        <div class="kv"><dt>מחיר</dt><dd>${money(c.price)}</dd></div>
        <div class="kv"><dt>תשלום</dt><dd>מלא בהרשמה · עד 12 תשלומים</dd></div>
        <div class="kv"><dt>בסיום</dt><dd>תעודה וגישה לסרטונים לצמיתות</dd></div></dl></div>
      <section class="section"><h2>בחירת מחזור</h2><p class="hint" style="margin-top:-6px">תאריכים לדוגמה</p>
        ${c.cohorts.map(h => { const full = h.taken >= h.seats; return `<button class="cohort" data-action="cohort" data-v="${h.id}" aria-pressed="${st.cohort === h.id}" ${full ? "disabled" : ""}><span><b>${esc(h.label)}</b><br><span class="hint">${esc(h.start)}</span></span><span class="seats">${full ? "מלא" : `נשארו ${h.seats - h.taken} מקומות`}</span></button>`; }).join("")}
        <div class="toggle"><span>הנרשם מתחת לגיל 18<br><span class="hint">נבקש פרטים ואישור של הורה</span></span><button class="switch" role="switch" aria-checked="${st.minor}" aria-label="הנרשם מתחת לגיל 18" data-action="minor"></button></div>
        <button class="btn primary block" data-action="enroll" ${st.cohort ? "" : "disabled"}>הרשמה ותשלום מאובטח</button>
        <a class="btn ghost block" style="margin-top:8px" href="https://wa.me/${B.whatsapp}?text=${encodeURIComponent("היי רועי, יש לי שאלה על קורס הספרות")}" target="_blank" rel="noopener">${ic("wa")}שאלות? לדבר עם רועי</a>
        <p class="hint">ביטול עד 14 יום מההרשמה, לפי מדיניות הביטול.</p></section>`;
  }
  function me() {
    const m = S.me;
    return head("החשבון שלי") + `<div style="display:grid;gap:14px">
      <label class="field"><span>שם מלא</span><input class="input" data-bind-me="name" value="${esc(m.name)}"></label>
      <label class="field"><span>טלפון</span><input class="input num" value="${esc(m.phone)}" disabled><span class="hint">הטלפון הוא שם המשתמש שלך. לשינוי פנה למספרה.</span></label>
      <label class="field"><span>תאריך לידה</span><input class="input" type="date" data-bind-me="birthday" value="${esc(m.birthday)}"><span class="hint">בשביל הטבת יום הולדת</span></label>
      <label class="field"><span>אימייל (רשות)</span><input class="input" type="email" data-bind-me="email" value="${esc(m.email)}" placeholder="name@example.com"><span class="hint">לקבלות במייל, בנוסף ל-SMS</span></label>
      <div class="panel"><div class="toggle"><span><b>הטבות ועדכונים ב-SMS</b><br><span class="hint">ברכת יום הולדת, מבצעים ופתיחת קורסים</span></span><button class="switch" role="switch" aria-checked="${m.marketing}" aria-label="הטבות ועדכונים" data-action="marketing"></button></div></div>
      <div class="panel"><div class="toggle"><span><b>מצב תצוגה</b><br><span class="hint">${S.theme === "dark" ? "כהה" : "בהיר"}</span></span><button class="btn sm" data-action="theme">${ic(S.theme === "dark" ? "sun" : "moon", "sm")}החלפה</button></div>
      <div class="toggle"><span><b>שפה</b></span><span class="chip-row"><button class="chip" aria-pressed="true">עברית</button><button class="chip" aria-pressed="false" data-action="toast" data-v="English בגרסה המלאה">English</button></span></div></div>
      <button class="btn ghost" style="color:var(--danger)" data-action="toast" data-v="בגרסה המלאה: מחיקת חשבון לאחר אישור">מחיקת החשבון</button></div>`;
  }

  // ---------- staff views ----------
  function staffView() {
    const r = S.st.route;
    const nav = (k, label, icon) => `<button data-action="st-go" data-v="${k}" ${r === k || (k === "clients" && r === "client") ? 'aria-current="page"' : ""}>${ic(icon)}${label}</button>`;
    const v = { cal: calView, clients: clientsView, client: clientCard, reports: reportsView }[r]();
    return `<div class="staff"><aside class="rail"><div class="brand"><img src="assets/logo-360.jpg" alt=""><b>ROI Marcel Assaraf<small>ניהול המספרה</small></b></div>
      ${nav("cal", "יומן", "cal")}${nav("clients", "לקוחות", "users")}${nav("reports", "דוחות", "chart")}
      <div class="who">מחובר: רועי (מנהל)</div></aside><section class="work">${v}</section></div>${S.st.sheet ? sheet() : ""}`;
  }
  // synthetic week: [dayOffset, startMin, svc[], customerId, status]
  const WEEK = [
    [0, 600, ["root"], 1, "done"], [0, 610, ["cut_m"], 6, "done"], [0, 690, ["cut_wb"], 2, "done"], [0, 780, ["hl_full"], 3, "booked"], [0, 830, ["cut_w"], 4, "booked"], [0, 875, ["blow_s"], 5, "booked"], [0, 990, ["cut_m"], 6, "booked"], [0, 1050, ["cut_wb"], 7, "booked"],
    [1, 630, ["straight"], 5, "booked"], [1, 650, ["cut_m"], 6, "booked"], [1, 690, ["blow_l"], 2, "booked"], [1, 840, ["cut_w", "blow_s"], 1, "booked"], [1, 960, ["color", "cut_wb"], 3, "booked"],
    [2, 600, ["balayage"], 7, "booked"], [2, 660, ["cut_m"], 6, "booked"], [2, 700, ["blow_s"], 4, "booked"], [2, 900, ["repair"], 2, "booked"], [2, 1020, ["cut_m"], 5, "booked"],
    [3, 660, ["cut_wb"], 1, "booked"], [3, 780, ["root", "cut_w"], 2, "booked"], [3, 960, ["babyliss"], 3, "booked"],
    [4, 600, ["consult"], 4, "booked"], [4, 630, ["hl_half"], 5, "booked"], [4, 700, ["cut_m"], 6, "booked"], [4, 1000, ["cut_w"], 7, "booked"],
  ];
  const weekStart = (() => { const d = new Date(today); d.setDate(d.getDate() - d.getDay()); return d; })();
  const weekEvents = () => WEEK.map((w, i) => ({ i, day: w[0], start: w[1], svc: w[2], cust: window.CUSTOMERS.find(c => c.id === w[3]), status: S.st.paid?.[i] ? "done" : w[4] }));
  function calView() {
    const ROW0 = 2, SLOT = 5, rows = (B.open.to - B.open.from) / SLOT;
    const ev = weekEvents();
    const days = Array.from({ length: 6 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
    let cells = "";
    days.forEach((d, i) => {
      const closed = !isOpen(d), istoday = d.toDateString() === today.toDateString();
      cells += `<div class="dh ${istoday ? "today" : ""} ${closed ? "closed" : ""}" style="grid-column:${i + 2};grid-row:1">${DAY[d.getDay()]}<small>${closed ? "סגור" : `${d.getDate()}.${d.getMonth() + 1}`}</small></div>`;
      for (let r = 0; r < rows; r += 3) cells += `<div class="cell ${closed ? "closed" : ""} ${(r / 3) % 2 ? "half" : ""}" style="grid-column:${i + 2};grid-row:${ROW0 + r} / span 3" ${closed ? "" : `data-action="toast" data-v="בגרסה המלאה: קביעת תור ידנית ל-${DAY[d.getDay()]} ${hm(B.open.from + r * SLOT)}"`}></div>`;
    });
    for (let r = 0; r < rows; r += 12) cells += `<div class="tg" style="grid-column:1;grid-row:${ROW0 + r}">${hm(B.open.from + r * SLOT)}</div>`;
    const blocks = ev.map(e => {
      const p = plan(e.svc), fill = ev.some(o => o !== e && o.day === e.day && hasWaitCover(o, e));
      const segs = p.steps.reduce((acc, st) => { const last = acc[acc.length - 1]; if (last && last[0] === st[0]) last[1] += st[1]; else acc.push([st[0], st[1]]); return acc; }, []);
      return `<button class="ev ${e.status === "done" ? "done" : ""} ${fill ? "fill" : ""} ${p.total <= 30 ? "short" : ""}" data-action="open-sheet" data-v="${e.i}" style="grid-column:${e.day + 2};grid-row:${ROW0 + (e.start - B.open.from) / SLOT} / span ${p.total / SLOT};${fill ? "margin-inline-start:26%;" : ""}" aria-label="${esc(e.cust.name)}, ${hm(e.start)}, ${p.list.map(s => s.name).join(", ")}${e.status === "done" ? ", שולם" : ""}">
        ${segs.map(s => s[0] === "p" ? `<span class="seg-p" style="flex:${s[1]}">${s[1] >= 30 ? "המתנה · פנוי" : ""}</span>` : `<span class="seg-w" style="flex:${s[1]}"></span>`).join("")}
        <span class="lbl"><b>${esc(e.cust.name)}</b><span><span class="num">${hm(e.start)}</span> · ${esc(p.list.map(x => x.name).join(" + "))}</span></span>
      </button>`;
    }).join("");
    const nm = nowMin(), todayIdx = today.getDay();
    const nowLine = todayIdx <= 5 && nm > B.open.from && nm < B.open.to ? `<div class="now-line" style="top:${48 + (nm - B.open.from) / SLOT * 8}px"></div>` : "";
    const prevMonth = MON[(today.getMonth() + 11) % 12];
    return `<div class="work-head"><h1>השבוע</h1><span class="hint">${weekStart.getDate()}–${days[5].getDate()} ב${MON[days[5].getMonth()]}</span><span class="spacer"></span>
      <button class="btn sm" data-action="toast" data-v="בגרסה המלאה: תצוגה יומית">יום</button><button class="btn sm primary" aria-pressed="true">שבוע</button>
      <button class="btn sm" data-action="toast" data-v="בגרסה המלאה: חסימת זמן ביומן">חסימת זמן</button></div>
      ${S.st.sent ? "" : `<div class="notice">${ic("receipt")}<p><b>הדוח של ${prevMonth} מוכן</b><span>כל הקבלות ותשלומי המזומן של החודש, מסודרים לרואה החשבון.</span></p><button class="btn sm primary" data-action="st-go" data-v="reports">לצפייה ושליחה</button></div>`}
      <div class="cal-wrap"><div class="cal" style="grid-template-rows:48px repeat(${rows}, 8px)">${cells}${blocks}${nowLine}</div></div>
      <p class="hint" style="margin-top:10px">הבלוקים המקווקווים הם זמן המתנה (הצבע נספג). רועי פנוי בהם, ולכן אפשר לשבץ בהם לקוח נוסף. נתונים לדוגמה.</p>`;
  }
  function hasWaitCover(o, e) { // is e inside o's processing gap?
    let off = o.start;
    for (const st of plan(o.svc).steps) { if (st[0] === "p" && e.start >= off && e.start < off + st[1]) return true; off += st[1]; }
    return false;
  }
  function sheet() {
    const st = S.st, e = weekEvents()[st.sheet], p = plan(e.svc);
    const price = s => st.prices[s.id] ?? s.price;
    const sub = p.list.reduce((a, s) => a + Number(price(s) || 0), 0);
    const disc = st.discount === "bday" ? Math.round(sub * .1) : Number(st.discount) || 0;
    const total = Math.max(0, sub - disc) + Number(st.tip || 0);
    const bday = e.cust.id === 1;
    const done = e.status === "done";
    const methods = [["card", "אשראי", "card"], ["gpay", "Google Pay", "phone"], ["bit", "ביט", "phone"], ["paybox", "PayBox", "phone"], ["cash", "מזומן", "cash"]];
    let body;
    if (done || st.pin === "done") {
      body = `<div class="pinpad-state"><div class="seal" style="width:64px;height:64px">${ic("check", "lg")}</div><b>שולם · ${money(done && st.pin !== "done" ? sub : total)}</b><span class="hint">קבלה מס׳ 0${142 + e.i} הופקה ונשלחה ב-SMS ל-${esc(e.cust.phone)}</span></div>`;
    } else if (st.pin === "wait") {
      body = `<div class="pinpad-state"><div class="pulse">${ic("pinpad", "lg")}</div><b>ממתין לתשלום במסוף</b><span class="hint">הסכום ${money(total)} נשלח למסוף${st.method === "card" && st.inst > 1 ? ` · ${st.inst} תשלומים` : ""}. הלקוח מעביר כרטיס או מצמיד טלפון.</span><button class="btn sm ghost" data-action="pin-cancel">ביטול</button></div>`;
    } else {
      body = `<section><h3 class="cat" style="margin-top:0">שירותים</h3>
        ${p.list.map(s => `<div class="line-item"><span>${esc(s.name)}${s.from ? `<br><span class="hint">מחיר החל מ־${s.price} ₪. אפשר לעדכן למחיר הסופי</span>` : ""}</span><input class="input" inputmode="numeric" aria-label="מחיר ${esc(s.name)}" data-price="${s.id}" value="${price(s)}"></div>`).join("")}</section>
        <section><h3 class="cat" style="margin-top:0">הנחה</h3><div class="chip-row">
          <button class="chip" data-action="disc" data-v="0" aria-pressed="${!st.discount}">ללא</button>
          ${bday ? `<button class="chip" data-action="disc" data-v="bday" aria-pressed="${st.discount === "bday"}">${ic("gift", "sm")}יום הולדת 10%</button>` : ""}
          ${[20, 50].map(n => `<button class="chip" data-action="disc" data-v="${n}" aria-pressed="${st.discount == n}">₪${n}</button>`).join("")}</div>
          ${bday ? `<p class="hint">ל${esc(e.cust.name)} יש יום הולדת השבוע. ההטבה בתוקף עד שבוע אחרי.</p>` : ""}</section>
        <section><h3 class="cat" style="margin-top:0">טיפ לרועי</h3><div class="chip-row">${[0, 20, 30, 50].map(n => `<button class="chip" data-action="tip" data-v="${n}" aria-pressed="${st.tip == n}">${n ? `₪${n}` : "ללא"}</button>`).join("")}</div></section>
        <section><h3 class="cat" style="margin-top:0">אמצעי תשלום</h3><div class="pay-methods">${methods.map(([k, l, i]) => `<button data-action="method" data-v="${k}" aria-pressed="${st.method === k}">${ic(i)}${l}</button>`).join("")}</div>
          ${st.method === "card" ? `<label class="field" style="margin-top:10px"><span>תשלומים</span><select class="select input" data-inst>${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${st.inst == n ? "selected" : ""}>${n === 1 ? "תשלום אחד" : `${n} תשלומים`}</option>`).join("")}</select></label>` : ""}</section>`;
    }
    const foot = done || st.pin === "done" ? `<button class="btn primary block" data-action="close-sheet">סגירה</button>`
      : st.pin === "wait" ? "" : `<div class="total-row"><span>לתשלום</span><span class="num">${money(total)}</span></div>
        <button class="btn primary block" data-action="charge">${st.method === "cash" ? `${ic("receipt")}רישום מזומן והפקת קבלה` : `${ic("pinpad")}שליחת הסכום למסוף`}</button>`;
    return `<div class="sheet-scrim" data-action="close-sheet"></div><aside class="sheet" role="dialog" aria-label="סגירת תור">
      <header><h2>${esc(e.cust.name)}</h2><span class="hint num">${DAY[e.day]} · ${hm(e.start)}</span><button class="icon-btn" data-action="close-sheet" aria-label="סגירה">${ic("x")}</button></header>
      <div class="scroll"><div class="chip-row"><a class="btn sm" href="https://wa.me/972${e.cust.phone.replace(/\D/g, "").slice(1)}" target="_blank" rel="noopener">${ic("wa", "sm")}וואטסאפ</a><button class="btn sm ghost" data-action="open-client" data-v="${e.cust.id}">כרטיס לקוח</button></div>
      <div>${ribbon(p.steps)}${legend(p)}</div>${body}</div>${foot ? `<footer>${foot}</footer>` : ""}</aside>`;
  }
  function clientsView() {
    const q = S.st.q.trim();
    const list = window.CUSTOMERS.filter(c => !q || c.name.includes(q) || c.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "") || "§"));
    return `<div class="work-head"><h1>לקוחות</h1><span class="hint">${window.CUSTOMERS.length} לקוחות לדוגמה · בגרסה המלאה 812 לקוחות מיובאים</span><span class="spacer"></span>
      <label class="searchbox">${ic("search", "sm")}<input class="input" placeholder="חיפוש לפי שם או טלפון" data-q value="${esc(S.st.q)}" aria-label="חיפוש לקוח"></label>
      <button class="btn sm primary" data-action="toast" data-v="בגרסה המלאה: הוספת לקוח בשם וטלפון">${ic("plus", "sm")}לקוח חדש</button></div>
      <div class="card" style="overflow:auto">${list.length ? `<table class="table"><thead><tr><th>שם</th><th>טלפון</th><th class="n">ביקורים</th><th>ביקור אחרון</th></tr></thead><tbody>
      ${list.map(c => `<tr class="client-row" data-action="open-client" data-v="${c.id}" tabindex="0"><td><b>${esc(c.name)}</b></td><td class="num">${esc(c.phone)}</td><td class="n">${c.visits}</td><td class="num">${c.last}</td></tr>`).join("")}</tbody></table>`
      : `<div class="empty" style="margin:16px">${ic("search", "lg")}<strong>לא נמצא לקוח בשם "${esc(q)}"</strong><span>אפשר לחפש גם לפי חלק ממספר הטלפון.</span></div>`}</div>`;
  }
  function clientCard() {
    const c = window.CUSTOMERS.find(x => x.id === S.st.client);
    const hist = WEEK.filter(w => w[3] === c.id).map(w => ({ d: `${DAY[w[0]]} השבוע`, t: hm(w[1]), s: w[2].map(id => byId[id].name).join(" + ") }))
      .concat([{ d: c.last, t: "11:00", s: "תספורת נשים + פן" }, { d: "14.09.2026", t: "16:30", s: "צבע שורש" }]);
    return `<div class="work-head"><button class="icon-btn" data-action="st-go" data-v="clients" aria-label="חזרה">${ic("back")}</button><h1>${esc(c.name)}</h1><span class="spacer"></span>
      <a class="btn sm" href="https://wa.me/972${c.phone.replace(/\D/g, "").slice(1)}" target="_blank" rel="noopener">${ic("wa", "sm")}וואטסאפ</a><a class="btn sm" href="tel:${c.phone}">${ic("phone", "sm")}חיוג</a>
      <button class="btn sm primary" data-action="toast" data-v="בגרסה המלאה: קביעת תור ל${esc(c.name)}">${ic("calplus", "sm")}קביעת תור</button></div>
      <div class="grid-2"><div class="card"><table class="table"><thead><tr><th>תאריך</th><th>שעה</th><th>שירותים</th></tr></thead><tbody>${hist.map(h => `<tr><td class="num">${h.d}</td><td class="num">${h.t}</td><td>${esc(h.s)}</td></tr>`).join("")}</tbody></table></div>
      <div class="card card-pad"><dl><div class="kv"><dt>טלפון</dt><dd>${esc(c.phone)}</dd></div><div class="kv"><dt>ביקורים</dt><dd>${c.visits}</dd></div><div class="kv"><dt>ביקור אחרון</dt><dd>${c.last}</dd></div><div class="kv"><dt>סה״כ הוצאה</dt><dd>${money(c.spent)}</dd></div><div class="kv"><dt>אי-הגעות</dt><dd>0</dd></div></dl>
      <div class="toggle" style="margin-top:6px"><span><b>חסימת קביעה עצמית</b><br><span class="hint">הלקוח יופנה לוואטסאפ</span></span><button class="switch" role="switch" aria-checked="false" aria-label="חסימת לקוח" data-action="toggle-sw"></button></div></div></div>`;
  }
  function reportsView() {
    const pm = MON[(today.getMonth() + 11) % 12], yr = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
    const rows = [["אשראי", 118, 31420], ["ביט", 41, 6150], ["Google Pay", 12, 2380], ["PayBox", 6, 820], ["מזומן", 23, 3100]];
    const sum = rows.reduce((a, r) => a + r[2], 0), cnt = rows.reduce((a, r) => a + r[1], 0);
    return `<div class="work-head"><h1>דוחות</h1><span class="spacer"></span><select class="select input" style="width:auto;min-height:42px" aria-label="תקופה"><option>${pm} ${yr}</option><option>רבעון 3 · ${yr}</option><option>שנת ${yr - 1}</option></select></div>
      <div class="grid-2"><div class="card" style="overflow:auto"><table class="table"><thead><tr><th>אמצעי תשלום</th><th class="n">קבלות</th><th class="n">סכום</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td>${r[0]}</td><td class="n">${r[1]}</td><td class="n">${money(r[2])}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td>סה״כ ${pm}</td><td class="n">${cnt}</td><td class="n">${money(sum)}</td></tr></tfoot></table>
        <p class="hint" style="padding:0 12px 12px">נתונים לדוגמה. כולל טיפים (₪1,460) וקבלה אחת שבוטלה.</p></div>
      <div class="card card-pad"><h2 style="margin:0 0 6px;font-size:18px">שליחה לרואה החשבון</h2>
        <p class="hint" style="margin:0 0 14px">PDF מסכם, אקסל מפורט וקובץ ZIP עם כל ${cnt} הקבלות של ${pm}.</p>
        <dl><div class="kv"><dt>נשלח אל</dt><dd>accountant@example.com</dd></div><div class="kv"><dt>סטטוס</dt><dd>${S.st.sent ? `<span class="badge ok">נשלח</span>` : `<span class="badge warn">ממתין</span>`}</dd></div></dl>
        <div style="display:grid;gap:8px;margin-top:14px"><button class="btn primary" data-action="send-report" ${S.st.sent ? "disabled" : ""}>${ic("send")}${S.st.sent ? "הדוח נשלח" : "שליחה לרואה החשבון"}</button>
        <button class="btn" data-action="toast" data-v="בגרסה המלאה: הורדת אקסל">ייצוא לאקסל</button></div></div></div>`;
  }

  // ---------- render & events ----------
  function render(scrollTop) {
    document.documentElement.dataset.theme = S.theme;
    document.querySelector('meta[name="theme-color"]').content = S.theme === "dark" ? "#0E0B08" : "#F3ECE1";
    document.querySelectorAll(".demo-bar [data-action=mode]").forEach(b => b.setAttribute("aria-selected", b.dataset.v === S.mode));
    document.querySelector(".demo-bar [data-action=theme] use").setAttribute("href", S.theme === "dark" ? "#i-sun" : "#i-moon");
    const keep = document.activeElement?.matches?.("[data-q]") ? document.activeElement.selectionStart : null;
    $app.innerHTML = S.mode === "client" ? clientView() : staffView();
    if (keep != null) { const q = $app.querySelector("[data-q]"); q.focus(); q.setSelectionRange(keep, keep); }
    if (scrollTop) window.scrollTo({ top: 0 });
  }
  let toastT;
  function toast(msg) { const t = document.getElementById("toast"); t.innerHTML = `<div>${esc(msg)}</div>`; clearTimeout(toastT); toastT = setTimeout(() => (t.innerHTML = ""), 2600); }
  const phoneOk = p => /^05\d{8}$/.test(p.replace(/\D/g, ""));

  const A = {
    mode: v => { S.mode = v; render(true); },
    theme: () => { S.theme = S.theme === "dark" ? "light" : "dark"; try { localStorage.setItem("roi-theme", S.theme); } catch (e) {} render(); },
    toast: v => toast(v),
    go: v => { if (v === "book" && S.route !== "book") S.b = freshBooking(); S.route = v; S.confirmCancel = null; render(true); },
    "go-home": () => A.go("home"),
    stylist: () => { S.route = "stylist"; render(true); },
    course: () => { S.route = "course"; render(true); },
    svc: v => { const s = S.b.svc; S.b.svc = s.includes(v) ? s.filter(x => x !== v) : [...s, v]; S.b.time = null; S.b.date = null; render(); },
    addon: () => { S.b.addon = !S.b.addon; S.b.time = null; S.b.date = null; render(); },
    "pick-stylist": v => { S.b.stylist = v; render(); },
    date: v => { S.b.date = v; S.b.time = null; render(); },
    time: v => { S.b.time = Number(v); render(); },
    waitmode: v => { S.b.waitMode = v; render(); },
    waitlist: () => { S.appts.push({ id: Date.now(), date: S.b.date, svc: S.b.svc, addon: S.b.addon, status: "waitlist", waitMode: S.b.waitMode }); toast("נרשמת לרשימת ההמתנה"); S.route = "appts"; render(true); },
    for: v => { S.b.forOther = v === "other"; render(); },
    recurring: () => { S.b.recurring = !S.b.recurring; render(); },
    every: v => { S.b.every = Number(v); render(); },
    prev: () => { S.b.step--; render(true); },
    next: () => {
      const b = S.b;
      if (b.step === 3 && b.forOther) {
        b.errors = { oName: !b.oName.trim(), oPhone: !phoneOk(b.oPhone) };
        if (b.errors.oName || b.errors.oPhone) { render(); $app.querySelector("[aria-invalid=true]")?.focus(); return; }
      }
      b.step++; render(true);
    },
    confirm: () => {
      S.b.busy = true; render();
      setTimeout(() => {
        const b = S.b, a = { id: Date.now(), date: b.date, start: b.time, svc: b.svc, addon: b.addon, stylist: b.stylist, status: "booked", forPhone: b.forOther ? b.oPhone : "" };
        if (S.appts.some(x => x.status === "booked" && x.date === a.date && x.start === a.start)) { b.busy = false; toast("התור נתפס הרגע. בחר שעה אחרת."); b.step = 2; b.time = null; render(true); return; }
        S.appts.push(a); S.lastBooked = a; S.b = freshBooking(); S.route = "success"; render(true);
      }, 700);
    },
    ics: () => {
      const a = S.lastBooked, p = plan(a.svc, a.addon), d = a.date.replace(/-/g, "");
      const t = m => `${d}T${hm(m).replace(":", "")}00`;
      const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ROI Marcel Assaraf//Demo//HE", "BEGIN:VEVENT", `UID:${a.id}@roi-demo`, `DTSTART;TZID=Asia/Jerusalem:${t(a.start)}`, `DTEND;TZID=Asia/Jerusalem:${t(a.start + p.total)}`,
        `SUMMARY:תור אצל רועי מרסל אסרף`, `LOCATION:${B.address}`, `DESCRIPTION:${p.list.map(s => s.name).join(", ")}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
      const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
      Object.assign(document.createElement("a"), { href: url, download: "roi-appointment.ics" }).click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    share: async () => { const txt = `קבעתי תור אצל רועי מרסל אסרף: ${longDate(S.lastBooked.date)} ${hm(S.lastBooked.start)}`; try { if (navigator.share) await navigator.share({ text: txt }); else { await navigator.clipboard.writeText(txt); toast("הועתק"); } } catch (e) {} },
    cancel: v => { const a = S.appts.find(x => x.id == v); if (a.status === "waitlist") { a.status = "cancelled"; toast("יצאת מרשימת ההמתנה"); } else S.confirmCancel = a.id; render(); },
    "cancel-yes": v => { S.appts.find(x => x.id == v).status = "cancelled"; S.confirmCancel = null; toast("התור בוטל. נשלח אישור ב-SMS"); render(); },
    "cancel-no": () => { S.confirmCancel = null; render(); },
    reschedule: v => { const a = S.appts.find(x => x.id == v); S.b = freshBooking(); S.b.svc = [...a.svc]; S.b.step = 2; S.route = "book"; toast("בחר מועד חדש. התור הקיים יוחלף רק אחרי האישור"); render(true); },
    marketing: () => { S.me.marketing = !S.me.marketing; render(); },
    cohort: v => { S.course.cohort = v; render(); },
    minor: () => { S.course.minor = !S.course.minor; render(); },
    enroll: () => toast("בגרסה המלאה: מעבר לדף תשלום מאובטח של זד קרדיט"),
    "toggle-sw": (v, el) => el.setAttribute("aria-checked", el.getAttribute("aria-checked") !== "true"),
    // staff
    "st-go": v => { S.st.route = v; render(true); },
    "open-sheet": v => { Object.assign(S.st, { sheet: Number(v), method: "card", inst: 1, discount: 0, tip: 0, pin: "idle", prices: {} }); render(); },
    "close-sheet": () => { S.st.sheet = null; render(); },
    disc: v => { S.st.discount = v === "bday" ? "bday" : Number(v); render(); },
    tip: v => { S.st.tip = Number(v); render(); },
    method: v => { S.st.method = v; render(); },
    charge: () => {
      const st = S.st;
      if (st.method === "cash") { finishPay(); return; }
      st.pin = "wait"; render();
      clearTimeout(A._pt); A._pt = setTimeout(() => { if (S.st.pin === "wait") finishPay(); }, 2400);
    },
    "pin-cancel": () => { S.st.pin = "idle"; render(); },
    "open-client": v => { S.st.client = Number(v); S.st.sheet = null; S.st.route = "client"; render(true); },
    "send-report": () => { S.st.sent = true; toast("הדוח נשלח לרואה החשבון"); render(); },
  };
  function finishPay() { const st = S.st; st.pin = "done"; st.paid = st.paid || {}; st.paid[st.sheet] = true; render(); }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-action]");
    if (!el || el.disabled || el.tagName === "INPUT") return;
    const fn = A[el.dataset.action]; if (!fn) return;
    if (el.tagName === "A") return;
    e.preventDefault(); fn(el.dataset.v, el);
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && S.st.sheet != null) A["close-sheet"]();
    if (e.key === "Enter" && e.target.matches("tr[data-action]")) A[e.target.dataset.action](e.target.dataset.v);
  });
  document.addEventListener("input", e => {
    const t = e.target;
    if (t.dataset.bind) { S.b[t.dataset.bind] = t.value; if (S.b.errors[t.dataset.bind]) { S.b.errors[t.dataset.bind] = false; t.removeAttribute("aria-invalid"); t.nextElementSibling?.classList.contains("err") && t.nextElementSibling.remove(); } }
    if (t.dataset.bindMe) S.me[t.dataset.bindMe] = t.value;
    if (t.matches("[data-q]")) { S.st.q = t.value; render(); }
    if (t.dataset.price) { S.st.prices[t.dataset.price] = t.value.replace(/\D/g, ""); const pos = t.selectionStart; render(); const n = $app.querySelector(`[data-price="${t.dataset.price}"]`); n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) {} }
  });
  document.addEventListener("change", e => {
    const t = e.target;
    if (t.matches("[data-inst]")) { S.st.inst = Number(t.value); render(); }
    if (t.dataset.action === "photo" && t.files[0]) { S.b.photos.push(URL.createObjectURL(t.files[0])); render(); }
  });

  render();
})();
