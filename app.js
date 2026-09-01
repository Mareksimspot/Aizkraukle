const DAYS = [
  ["mon", "Pirmdiena"],
  ["tue", "Otrdiena"],
  ["wed", "Trešdiena"],
  ["thu", "Ceturtdiena"],
  ["fri", "Piektdiena"],
  ["sat", "Sestdiena"],
];

const DIRECTIONS = [
  { symbol: "→", label: "Pa labi" },
  { symbol: "←", label: "Pa kreisi" },
  { symbol: "↑", label: "Taisni" },
  { symbol: "↗", label: "Uz citu ēku" },
];

const SLIDE_DURATION = 15_000;

function updateClock() {
  const now = new Date();
  document.querySelector("#time").textContent = new Intl.DateTimeFormat("lv-LV", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
  document.querySelector("#date").textContent = new Intl.DateTimeFormat("lv-LV", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
}

function groupBySection(records) {
  const groups = [];
  for (const record of records) {
    let group = groups.at(-1);
    if (!group || group.section !== record.section) {
      group = { section: record.section, records: [] };
      groups.push(group);
    }
    group.records.push(record);
  }
  return groups;
}

function groupWeight(group) {
  return 1.15 + group.records.reduce((weight, record) => {
    const extraLines = [record.name, ...DAYS.map(([key]) => record[key])]
      .filter(Boolean)
      .reduce((sum, value) => sum + (value.match(/\n/g)?.length ?? 0), 0);
    return weight + 1 + extraLines * 0.42;
  }, 0);
}

function splitGroups(groups) {
  const target = groups.reduce((sum, group) => sum + groupWeight(group), 0) / 2;
  const pages = [[], []];
  let page = 0;
  let weight = 0;

  for (const group of groups) {
    const nextWeight = groupWeight(group);
    if (page === 0 && weight > 0 && weight + nextWeight > target) {
      page = 1;
    }
    pages[page].push(group);
    weight += nextWeight;
  }
  return pages.filter((groupsOnPage) => groupsOnPage.length > 0);
}

function span(text, className) {
  const element = document.createElement("span");
  element.className = className;
  element.textContent = text;
  return element;
}

function createColumnHeader() {
  const row = document.createElement("div");
  row.className = "table-row column-header";
  row.append(span("Speciālists", ""), span("Kab.", ""), span("Virziens", ""));
  for (const [, label] of DAYS) row.append(span(label, ""));
  return row;
}

function createDirectionCell(index) {
  const direction = Number.isInteger(index) ? DIRECTIONS[index] : undefined;
  if (!direction) return span("—", "direction empty");

  const cell = span(direction.symbol, "direction");
  cell.setAttribute("aria-label", direction.label);
  cell.title = direction.label;
  return cell;
}

function createScheduleCell(value) {
  if (!value) return span("—", "day empty");

  const cell = span("", "day");
  const parts = value.match(/^(.*?)\s*\[([^\]]+)](.*)$/s);
  if (!parts) {
    cell.textContent = value;
    return cell;
  }

  const [, before, secondary, after] = parts;
  if (before.trim()) cell.append(span(before.trim(), ""));
  cell.append(span(secondary.trim(), "secondary"));
  if (after.trim()) cell.append(span(after.trim(), ""));
  return cell;
}

function createDoctorRow(record) {
  const row = document.createElement("div");
  row.className = "table-row doctor-row";
  row.append(
    span(record.name, "doctor"),
    span(record.place ?? "—", "place"),
    createDirectionCell(record.direction),
  );

  for (const [key] of DAYS) {
    row.append(createScheduleCell(record[key]));
  }
  return row;
}

function createSlide(groups, index) {
  const slide = document.createElement("article");
  slide.className = `slide${index === 0 ? " active" : ""}`;
  slide.setAttribute("aria-hidden", index === 0 ? "false" : "true");
  slide.append(createColumnHeader());

  for (const group of groups) {
    const title = document.createElement("div");
    title.className = "section-title";
    title.textContent = group.section;
    slide.append(title);
    for (const record of group.records) slide.append(createDoctorRow(record));
  }
  return slide;
}

function startRotation(slides, dots) {
  if (slides.length < 2) return;
  let active = 0;
  window.setInterval(() => {
    slides[active].classList.remove("active");
    slides[active].setAttribute("aria-hidden", "true");
    dots[active].classList.remove("active");
    active = (active + 1) % slides.length;
    slides[active].classList.add("active");
    slides[active].setAttribute("aria-hidden", "false");
    dots[active].classList.add("active");
  }, SLIDE_DURATION);
}

async function renderSchedule() {
  const schedule = document.querySelector("#schedule");
  try {
    const response = await fetch("doctors_timetable.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const records = await response.json();
    const pages = splitGroups(groupBySection(records));
    const slides = pages.map(createSlide);
    schedule.replaceChildren(...slides);

    const indicator = document.querySelector("#page-indicator");
    const dots = pages.map((_, index) => span("", `page-dot${index === 0 ? " active" : ""}`));
    indicator.replaceChildren(...dots);
    startRotation(slides, dots);
  } catch (error) {
    console.error(error);
    const message = document.createElement("p");
    message.className = "error";
    message.textContent = "Neizdevās ielādēt pieņemšanas laikus.";
    schedule.replaceChildren(message);
  }
}

updateClock();
window.setInterval(updateClock, 30_000);
renderSchedule();
