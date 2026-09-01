var DAYS = [
  ["mon", "Pirmdiena"],
  ["tue", "Otrdiena"],
  ["wed", "Trešdiena"],
  ["thu", "Ceturtdiena"],
  ["fri", "Piektdiena"],
  ["sat", "Sestdiena"],
];

var DIRECTIONS = [
  { symbol: "→", label: "Pa labi" },
  { symbol: "←", label: "Pa kreisi" },
  { symbol: "↑", label: "Taisni" },
  { symbol: "↗", label: "Uz citu ēku" },
];

var MONTHS = [
  "janvāris",
  "februāris",
  "marts",
  "aprīlis",
  "maijs",
  "jūnijs",
  "jūlijs",
  "augusts",
  "septembris",
  "oktobris",
  "novembris",
  "decembris",
];

var WEEKDAYS = [
  "svētdiena",
  "pirmdiena",
  "otrdiena",
  "trešdiena",
  "ceturtdiena",
  "piektdiena",
  "sestdiena",
];

var SLIDE_DURATION = 15000;
var UPDATE_INTERVAL = 600000;
var rotationTimer = null;

function pad(number) {
  return number < 10 ? "0" + number : String(number);
}

function updateClock() {
  var now = new Date();
  document.getElementById("time").textContent = pad(now.getHours()) + ":" + pad(now.getMinutes());
  document.getElementById("date").textContent =
    WEEKDAYS[now.getDay()] + ", " + now.getDate() + ". " + MONTHS[now.getMonth()];
}

function groupBySection(records) {
  var groups = [];
  var i;
  for (i = 0; i < records.length; i += 1) {
    var record = records[i];
    var group = groups.length ? groups[groups.length - 1] : null;
    if (!group || group.section !== record.section) {
      group = { section: record.section, records: [] };
      groups.push(group);
    }
    group.records.push(record);
  }
  return groups;
}

function lineCount(value) {
  if (!value) return 0;
  var matches = value.match(/\n/g);
  return matches ? matches.length : 0;
}

function groupWeight(group) {
  var weight = 1.15;
  var i;
  var day;
  for (i = 0; i < group.records.length; i += 1) {
    var record = group.records[i];
    var extraLines = lineCount(record.name);
    for (day = 0; day < DAYS.length; day += 1) {
      extraLines += lineCount(record[DAYS[day][0]]);
    }
    weight += 1 + extraLines * 0.42;
  }
  return weight;
}

function splitGroups(groups) {
  var total = 0;
  var i;
  for (i = 0; i < groups.length; i += 1) total += groupWeight(groups[i]);

  var target = total / 2;
  var pages = [[], []];
  var page = 0;
  var weight = 0;
  for (i = 0; i < groups.length; i += 1) {
    var nextWeight = groupWeight(groups[i]);
    if (page === 0 && weight > 0 && weight + nextWeight > target) page = 1;
    pages[page].push(groups[i]);
    weight += nextWeight;
  }
  if (!pages[1].length) pages.pop();
  return pages;
}

function span(text, className) {
  var element = document.createElement("span");
  element.className = className;
  element.textContent = text;
  return element;
}

function appendAll(parent, children) {
  var i;
  for (i = 0; i < children.length; i += 1) parent.appendChild(children[i]);
}

function clear(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
}

function createColumnHeader() {
  var row = document.createElement("div");
  row.className = "table-row column-header";
  appendAll(row, [span("Speciālists", ""), span("Kab.", ""), span("Virziens", "")]);
  var i;
  for (i = 0; i < DAYS.length; i += 1) row.appendChild(span(DAYS[i][1], ""));
  return row;
}

function createDirectionCell(index) {
  var validIndex = typeof index === "number" && index >= 0 && index < DIRECTIONS.length;
  if (!validIndex) return span("—", "direction empty");

  var direction = DIRECTIONS[index];
  var cell = span(direction.symbol, "direction");
  cell.setAttribute("aria-label", direction.label);
  cell.title = direction.label;
  return cell;
}

function createScheduleCell(value) {
  if (!value) return span("—", "day empty");

  var cell = span("", "day");
  var parts = value.match(/^([\s\S]*?)\s*\[([^\]]+)]([\s\S]*)$/);
  if (!parts) {
    cell.textContent = value;
    return cell;
  }

  var before = parts[1].trim();
  var secondary = parts[2].trim();
  var after = parts[3].trim();
  if (before) cell.appendChild(span(before, ""));
  cell.appendChild(span(secondary, "secondary"));
  if (after) cell.appendChild(span(after, ""));
  return cell;
}

function createDoctorRow(record) {
  var row = document.createElement("div");
  row.className = "table-row doctor-row";
  appendAll(row, [
    span(record.name, "doctor"),
    span(record.place === null ? "—" : record.place, "place"),
    createDirectionCell(record.direction),
  ]);

  var i;
  for (i = 0; i < DAYS.length; i += 1) {
    row.appendChild(createScheduleCell(record[DAYS[i][0]]));
  }
  return row;
}

function createSlide(groups, index) {
  var slide = document.createElement("article");
  slide.className = "slide" + (index === 0 ? " active" : "");
  slide.setAttribute("aria-hidden", index === 0 ? "false" : "true");
  slide.appendChild(createColumnHeader());

  var groupIndex;
  var recordIndex;
  for (groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    var group = groups[groupIndex];
    var title = document.createElement("div");
    title.className = "section-title";
    title.textContent = group.section;
    slide.appendChild(title);
    for (recordIndex = 0; recordIndex < group.records.length; recordIndex += 1) {
      slide.appendChild(createDoctorRow(group.records[recordIndex]));
    }
  }
  return slide;
}

function startRotation(slides, dots) {
  if (rotationTimer !== null) {
    window.clearInterval(rotationTimer);
    rotationTimer = null;
  }
  if (slides.length < 2) return;
  var active = 0;
  rotationTimer = window.setInterval(function () {
    slides[active].classList.remove("active");
    slides[active].setAttribute("aria-hidden", "true");
    dots[active].classList.remove("active");
    active = (active + 1) % slides.length;
    slides[active].classList.add("active");
    slides[active].setAttribute("aria-hidden", "false");
    dots[active].classList.add("active");
  }, SLIDE_DURATION);
}

function showError() {
  var schedule = document.getElementById("schedule");
  if (schedule.querySelector(".doctor-row")) return;
  var message = document.createElement("p");
  message.className = "error";
  message.textContent = "Neizdevās ielādēt pieņemšanas laikus.";
  clear(schedule);
  schedule.appendChild(message);
}

function renderRecords(records) {
  var schedule = document.getElementById("schedule");
  var pages = splitGroups(groupBySection(records));
  var slides = [];
  var dots = [];
  var i;

  clear(schedule);
  for (i = 0; i < pages.length; i += 1) {
    slides.push(createSlide(pages[i], i));
    schedule.appendChild(slides[i]);
  }

  var indicator = document.getElementById("page-indicator");
  clear(indicator);
  for (i = 0; i < pages.length; i += 1) {
    dots.push(span("", "page-dot" + (i === 0 ? " active" : "")));
    indicator.appendChild(dots[i]);
  }
  startRotation(slides, dots);
}

function loadSchedule() {
  var request = new XMLHttpRequest();
  var cacheKey = Math.floor(new Date().getTime() / UPDATE_INTERVAL);
  request.open("GET", "doctors_timetable.json?v=" + cacheKey, true);
  request.onreadystatechange = function () {
    if (request.readyState !== 4) return;
    if (request.status < 200 || request.status >= 300) {
      showError();
      return;
    }
    try {
      renderRecords(JSON.parse(request.responseText));
    } catch (error) {
      showError();
    }
  };
  request.onerror = showError;
  request.send();
}

updateClock();
window.setInterval(updateClock, 30000);
loadSchedule();
window.setInterval(loadSchedule, UPDATE_INTERVAL);
