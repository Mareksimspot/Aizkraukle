const DAYS = ["mon", "tue", "wed", "thu", "fri"];
const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"];
const MAXIMUM_MEDIA_SIZE = 100 * 1024 * 1024;
const DIRECTION_OPTIONS = [
  ["", "Nav norādīts"],
  ["0", "→ Pa labi"],
  ["1", "← Pa kreisi"],
  ["2", "↑ Taisni"],
  ["3", "↗ Uz citu ēku"],
];

let csrfToken = "";
let version = "";
let advertisementsVersion = "";
let advertisements = { screens: { 1: null, 2: null } };
let dirty = false;
const demoHost = location.hostname.endsWith("github.io") || location.hostname === "localhost" || location.hostname === "127.0.0.1";
const demoMode = demoHost && new URLSearchParams(location.search).get("demo") === "1";
const demoStorageKey = "aizkraukle-timetable-admin-demo";

const loginView = document.querySelector("#login-view");
const editorView = document.querySelector("#editor-view");
const recordsBody = document.querySelector("#records");
const editorMessage = document.querySelector("#editor-message");
const advertisementMessage = document.querySelector("#advertisement-message");
const screenFilter = document.querySelector("#screen-filter");

function setMessage(text, type = "") {
  editorMessage.textContent = text;
  editorMessage.className = `message ${type}`;
}

function setAdvertisementMessage(text, type = "") {
  advertisementMessage.textContent = text;
  advertisementMessage.className = `message ${type}`;
}

function setAuthenticated(authenticated) {
  loginView.hidden = authenticated;
  editorView.hidden = !authenticated;
}

async function responseJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function input(field, value, multiline = false) {
  const control = document.createElement(multiline ? "textarea" : "input");
  control.dataset.field = field;
  control.value = value ?? "";
  control.setAttribute("aria-label", field);
  return control;
}

function optionSelect(field, options, value, label) {
  const select = document.createElement("select");
  select.dataset.field = field;
  select.setAttribute("aria-label", label);
  for (const [optionValue, optionLabel] of options) {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionLabel;
    option.selected = String(value ?? "") === optionValue;
    select.append(option);
  }
  return select;
}

function directionSelect(value) {
  return optionSelect("direction", DIRECTION_OPTIONS, value, "Virziens");
}

function screenSelect(value) {
  return optionSelect("screen", [["1", "1"], ["2", "2"]], value, "Ekrāns");
}

function cell(control) {
  const element = document.createElement("td");
  element.append(control);
  return element;
}

function renderRow(record) {
  const row = document.createElement("tr");
  row.dataset.screen = String(record.screen);
  row.append(
    cell(screenSelect(record.screen)),
    cell(input("section", record.section)),
    cell(input("name", record.name)),
    cell(input("place", record.place)),
    cell(directionSelect(record.direction)),
  );
  for (const day of DAYS) row.append(cell(input(day, record[day], true)));

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "delete-record";
  remove.textContent = "×";
  remove.title = "Dzēst ierakstu";
  remove.setAttribute("aria-label", `Dzēst ${record.name || "ierakstu"}`);
  remove.addEventListener("click", () => {
    if (!window.confirm("Vai tiešām dzēst šo ierakstu?")) return;
    row.remove();
    markDirty();
    updateCount();
  });
  row.append(cell(remove));
  return row;
}

function normalizeRecords(records) {
  const half = Math.ceil(records.length / 2);
  return records.map((record, index) => ({ ...record, screen: Number(record.screen) === 2 ? 2 : (record.screen ? 1 : index < half ? 1 : 2) }));
}

function renderRecords(records) {
  recordsBody.replaceChildren(...normalizeRecords(records).map(renderRow));
  dirty = false;
  updateCount();
}

function applyScreenFilter() {
  const filter = screenFilter.value;
  for (const row of recordsBody.rows) row.hidden = filter !== "all" && row.dataset.screen !== filter;
}

function updateCount() {
  const rows = [...recordsBody.rows];
  const first = rows.filter((row) => row.dataset.screen === "1").length;
  const second = rows.length - first;
  document.querySelector("#record-count").textContent =
    `${rows.length} ieraksti — 1. ekrāns: ${first}, 2. ekrāns: ${second}`;
  applyScreenFilter();
}

function markDirty() {
  dirty = true;
  setMessage("Ir nesaglabātas izmaiņas.");
}

function collectRecords() {
  return [...recordsBody.rows].map((row) => {
    const value = (field) => row.querySelector(`[data-field="${field}"]`).value;
    const optional = (field) => value(field).trim() || null;
    return {
      name: value("name"),
      place: optional("place"),
      mon: optional("mon"),
      tue: optional("tue"),
      wed: optional("wed"),
      thu: optional("thu"),
      fri: optional("fri"),
      direction: value("direction") === "" ? null : Number(value("direction")),
      section: value("section"),
      screen: Number(value("screen")),
    };
  });
}

async function loadRecords() {
  setMessage("Ielādē datus…");
  if (demoMode) {
    const saved = localStorage.getItem(demoStorageKey);
    const records = saved
      ? JSON.parse(saved)
      : await fetch("doctors_timetable.json", { cache: "no-store" }).then((response) => response.json());
    renderRecords(records);
    setMessage("Testa dati ielādēti.", "success");
    return;
  }
  const response = await fetch("/api/timetable?admin=1", { cache: "no-store" });
  if (!response.ok) throw new Error((await responseJson(response)).error || "Neizdevās ielādēt datus");
  version = response.headers.get("x-timetable-version") || "";
  renderRecords(await response.json());
  setMessage("Dati ielādēti.", "success");
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function createMediaElement(item) {
  const element = document.createElement(item.type.startsWith("video/") ? "video" : "img");
  element.src = item.url;
  element.className = "advertisement-preview-media";
  if (element.tagName === "VIDEO") {
    element.controls = true;
    element.muted = true;
    element.loop = true;
  } else {
    element.alt = item.name;
  }
  return element;
}

function renderAdvertisementCard(screen, previewItem = null) {
  const card = document.querySelector(`[data-advertisement-screen="${screen}"]`);
  const preview = card.querySelector("[data-preview]");
  const item = previewItem || advertisements.screens[String(screen)];
  preview.replaceChildren();
  if (item) preview.append(createMediaElement(item));
  else {
    const empty = document.createElement("p");
    empty.textContent = "Reklāma nav pievienota";
    preview.append(empty);
  }
  card.querySelector("[data-media-name]").textContent = item
    ? `${item.name} · ${formatBytes(item.size)}`
    : "";
  card.querySelector("[data-remove]").disabled = !advertisements.screens[String(screen)] || demoMode;
}

function createAdvertisementCard(screen) {
  const card = document.createElement("article");
  card.className = "advertisement-card";
  card.dataset.advertisementScreen = String(screen);
  card.innerHTML = `
    <div class="advertisement-card-heading">
      <h3>${screen}. ekrāns</h3>
      <a href="./?screen=${screen}" target="_blank" rel="noopener">Atvērt ekrānu</a>
    </div>
    <div class="advertisement-preview" data-preview></div>
    <p class="media-name" data-media-name></p>
    <input data-media-file type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" />
    <progress data-progress max="100" value="0" hidden></progress>
    <div class="advertisement-actions">
      <button data-upload type="button" class="primary">Augšupielādēt / nomainīt</button>
      <button data-remove type="button">Noņemt</button>
    </div>`;

  const fileInput = card.querySelector("[data-media-file]");
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!ALLOWED_MEDIA_TYPES.includes(file.type) || file.size > MAXIMUM_MEDIA_SIZE) {
      setAdvertisementMessage("Atļauti JPEG, PNG, WebP, MP4 vai WebM faili līdz 100 MB.", "error");
      fileInput.value = "";
      return;
    }
    if (card.previewUrl) URL.revokeObjectURL(card.previewUrl);
    card.previewUrl = URL.createObjectURL(file);
    renderAdvertisementCard(screen, { url: card.previewUrl, type: file.type, name: file.name, size: file.size });
    setAdvertisementMessage("Fails gatavs augšupielādei.");
  });

  card.querySelector("[data-upload]").addEventListener("click", () => uploadAdvertisement(screen));
  card.querySelector("[data-remove]").addEventListener("click", () => removeAdvertisement(screen));
  return card;
}

function renderAdvertisementCards() {
  for (const screen of [1, 2]) renderAdvertisementCard(screen);
}

async function loadAdvertisements() {
  setAdvertisementMessage("Ielādē reklāmas…");
  const url = demoMode ? "advertisements.json" : "/api/advertisements?admin=1";
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error((await responseJson(response)).error || "Neizdevās ielādēt reklāmas");
  advertisementsVersion = response.headers.get("x-advertisements-version") || "";
  advertisements = await response.json();
  renderAdvertisementCards();
  setAdvertisementMessage(demoMode ? "Testa reklāmas ielādētas." : "Reklāmas ielādētas.", "success");
}

async function saveAdvertisements() {
  const response = await fetch("/api/advertisements", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "If-Match": advertisementsVersion,
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify(advertisements),
  });
  const result = await responseJson(response);
  if (response.status === 401) {
    setAuthenticated(false);
    throw new Error("Sesija beigusies. Pieslēdzieties vēlreiz.");
  }
  if (!response.ok) throw new Error(result.error || "Neizdevās saglabāt reklāmu");
  advertisementsVersion = result.version;
}

function safeFilename(filename) {
  const normalized = filename.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-120) || "reklama";
}

async function uploadAdvertisement(screen) {
  const card = document.querySelector(`[data-advertisement-screen="${screen}"]`);
  const file = card.querySelector("[data-media-file]").files[0];
  if (!file) {
    setAdvertisementMessage("Vispirms izvēlieties failu.", "error");
    return;
  }
  if (demoMode) {
    setAdvertisementMessage("Testa režīmā fails ir redzams priekšskatījumā, bet netiek augšupielādēts.", "success");
    return;
  }

  const button = card.querySelector("[data-upload]");
  const progress = card.querySelector("[data-progress]");
  button.disabled = true;
  progress.hidden = false;
  progress.value = 0;
  const previous = advertisements.screens[String(screen)];
  setAdvertisementMessage(`Augšupielādē ${screen}. ekrāna reklāmu…`);
  try {
    const pathname = `signage/ads/screen-${screen}/${Date.now()}-${safeFilename(file.name)}`;
    const blob = await window.SignageBlob.upload(pathname, file, {
      access: "public",
      handleUploadUrl: "/api/advertisement-upload",
      clientPayload: JSON.stringify({ screen }),
      headers: { "X-CSRF-Token": csrfToken },
      multipart: file.size > 5 * 1024 * 1024,
      onUploadProgress: ({ percentage }) => { progress.value = percentage; },
    });
    advertisements.screens[String(screen)] = {
      url: blob.url,
      pathname: blob.pathname,
      type: file.type,
      name: file.name,
      size: file.size,
    };
    await saveAdvertisements();
    if (card.previewUrl) URL.revokeObjectURL(card.previewUrl);
    card.previewUrl = "";
    card.querySelector("[data-media-file]").value = "";
    renderAdvertisementCard(screen);
    setAdvertisementMessage("Reklāma saglabāta. Ekrāns to saņems 10 minūšu laikā.", "success");
  } catch (error) {
    advertisements.screens[String(screen)] = previous;
    setAdvertisementMessage(error.message || "Neizdevās augšupielādēt reklāmu.", "error");
  } finally {
    button.disabled = false;
    progress.hidden = true;
  }
}

async function removeAdvertisement(screen) {
  if (!window.confirm(`Noņemt ${screen}. ekrāna reklāmu?`)) return;
  const previous = advertisements.screens[String(screen)];
  advertisements.screens[String(screen)] = null;
  setAdvertisementMessage("Noņem reklāmu…");
  try {
    await saveAdvertisements();
    renderAdvertisementCard(screen);
    setAdvertisementMessage("Reklāma noņemta.", "success");
  } catch (error) {
    advertisements.screens[String(screen)] = previous;
    setAdvertisementMessage(error.message, "error");
  }
}

async function checkSession() {
  if (demoMode) {
    document.querySelector("#demo-banner").hidden = false;
    document.querySelector("#logout").hidden = true;
    setAuthenticated(true);
    await Promise.all([loadRecords(), loadAdvertisements()]);
    return;
  }
  try {
    const response = await fetch("/api/session", { cache: "no-store" });
    if (!response.ok) {
      setAuthenticated(false);
      return;
    }
    const session = await response.json();
    csrfToken = session.csrfToken;
    setAuthenticated(true);
    await Promise.all([loadRecords(), loadAdvertisements()]);
  } catch (error) {
    setAuthenticated(false);
    document.querySelector("#login-error").textContent = error.message;
  }
}

document.querySelector("#advertisement-cards").append(createAdvertisementCard(1), createAdvertisementCard(2));

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  const errorElement = document.querySelector("#login-error");
  button.disabled = true;
  errorElement.textContent = "";
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: document.querySelector("#username").value,
        password: document.querySelector("#password").value,
      }),
    });
    const result = await responseJson(response);
    if (!response.ok) throw new Error(result.error || "Neizdevās pieslēgties");
    csrfToken = result.csrfToken;
    document.querySelector("#password").value = "";
    setAuthenticated(true);
    await Promise.all([loadRecords(), loadAdvertisements()]);
  } catch (error) {
    errorElement.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

recordsBody.addEventListener("input", markDirty);
recordsBody.addEventListener("change", (event) => {
  if (event.target.dataset.field === "screen") {
    event.target.closest("tr").dataset.screen = event.target.value;
    updateCount();
  }
  markDirty();
});
screenFilter.addEventListener("change", applyScreenFilter);

document.querySelector("#add-record").addEventListener("click", () => {
  const lastSection = recordsBody.rows.length
    ? recordsBody.rows[recordsBody.rows.length - 1].querySelector('[data-field="section"]').value
    : "";
  const selectedScreen = screenFilter.value === "all"
    ? ([...recordsBody.rows].filter((row) => row.dataset.screen === "1").length <= recordsBody.rows.length / 2 ? 1 : 2)
    : Number(screenFilter.value);
  const row = renderRow({ name: "", place: null, direction: null, section: lastSection, screen: selectedScreen });
  recordsBody.append(row);
  markDirty();
  updateCount();
  row.querySelector('[data-field="name"]').focus();
});

document.querySelector("#reload-records").addEventListener("click", async () => {
  if (dirty && !window.confirm("Atmest nesaglabātās izmaiņas?")) return;
  try {
    await Promise.all([loadRecords(), loadAdvertisements()]);
  } catch (error) {
    setMessage(error.message, "error");
  }
});

document.querySelector("#save-records").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  setMessage("Saglabā…");
  try {
    if (demoMode) {
      localStorage.setItem(demoStorageKey, JSON.stringify(collectRecords()));
      dirty = false;
      setMessage("Testa izmaiņas saglabātas šajā pārlūkā.", "success");
      return;
    }
    const response = await fetch("/api/timetable", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "If-Match": version,
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify(collectRecords()),
    });
    const result = await responseJson(response);
    if (response.status === 401) {
      setAuthenticated(false);
      throw new Error("Sesija beigusies. Pieslēdzieties vēlreiz.");
    }
    if (!response.ok) throw new Error(result.error || "Neizdevās saglabāt");
    version = result.version;
    dirty = false;
    setMessage("Izmaiņas saglabātas. Ekrāns tās saņems 10 minūšu laikā.", "success");
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#logout").addEventListener("click", async () => {
  if (dirty && !window.confirm("Iziet, nesaglabājot izmaiņas?")) return;
  await fetch("/api/session", { method: "DELETE", headers: { "X-CSRF-Token": csrfToken } });
  csrfToken = "";
  setAuthenticated(false);
});

window.addEventListener("beforeunload", (event) => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = "";
});

checkSession();
