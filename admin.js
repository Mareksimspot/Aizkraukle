const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat"];
const DIRECTION_OPTIONS = [
  ["", "Nav norādīts"],
  ["0", "→ Pa labi"],
  ["1", "← Pa kreisi"],
  ["2", "↑ Taisni"],
  ["3", "↗ Uz citu ēku"],
];

let csrfToken = "";
let version = "";
let dirty = false;
const demoHost = location.hostname.endsWith("github.io") || location.hostname === "localhost" || location.hostname === "127.0.0.1";
const demoMode = demoHost && new URLSearchParams(location.search).get("demo") === "1";
const demoStorageKey = "aizkraukle-timetable-admin-demo";

const loginView = document.querySelector("#login-view");
const editorView = document.querySelector("#editor-view");
const recordsBody = document.querySelector("#records");
const editorMessage = document.querySelector("#editor-message");

function setMessage(text, type = "") {
  editorMessage.textContent = text;
  editorMessage.className = `message ${type}`;
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

function directionSelect(value) {
  const select = document.createElement("select");
  select.dataset.field = "direction";
  select.setAttribute("aria-label", "Virziens");
  for (const [optionValue, label] of DIRECTION_OPTIONS) {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = label;
    option.selected = String(value ?? "") === optionValue;
    select.append(option);
  }
  return select;
}

function cell(control) {
  const element = document.createElement("td");
  element.append(control);
  return element;
}

function renderRow(record) {
  const row = document.createElement("tr");
  row.append(
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

function renderRecords(records) {
  recordsBody.replaceChildren(...records.map(renderRow));
  dirty = false;
  updateCount();
}

function updateCount() {
  document.querySelector("#record-count").textContent = `${recordsBody.rows.length} ieraksti`;
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
      sat: optional("sat"),
      direction: value("direction") === "" ? null : Number(value("direction")),
      section: value("section"),
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

async function checkSession() {
  if (demoMode) {
    document.querySelector("#demo-banner").hidden = false;
    document.querySelector("#logout").hidden = true;
    setAuthenticated(true);
    await loadRecords();
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
    await loadRecords();
  } catch (error) {
    setAuthenticated(false);
    document.querySelector("#login-error").textContent = error.message;
  }
}

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
    await loadRecords();
  } catch (error) {
    errorElement.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

recordsBody.addEventListener("input", markDirty);
recordsBody.addEventListener("change", markDirty);

document.querySelector("#add-record").addEventListener("click", () => {
  const lastSection = recordsBody.rows.length
    ? recordsBody.rows[recordsBody.rows.length - 1].querySelector('[data-field="section"]').value
    : "";
  const row = renderRow({ name: "", place: null, direction: null, section: lastSection });
  recordsBody.append(row);
  markDirty();
  updateCount();
  row.querySelector('[data-field="name"]').focus();
});

document.querySelector("#reload-records").addEventListener("click", async () => {
  if (dirty && !window.confirm("Atmest nesaglabātās izmaiņas?")) return;
  try {
    await loadRecords();
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
