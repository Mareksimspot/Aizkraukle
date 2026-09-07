var DAYS = [
  ["mon", "Pirmdiena"],
  ["tue", "Otrdiena"],
  ["wed", "Trešdiena"],
  ["thu", "Ceturtdiena"],
  ["fri", "Piektdiena"],
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
  "Svētdiena",
  "Pirmdiena",
  "Otrdiena",
  "Trešdiena",
  "Ceturtdiena",
  "Piektdiena",
  "Sestdiena",
];

var UPDATE_INTERVAL = 600000;
var screenNumber = getScreenNumber();

function getScreenNumber() {
  var match = window.location.search.match(/[?&]screen=([^&]+)/);
  return match && decodeURIComponent(match[1]) === "2" ? 2 : 1;
}

function pad(number) {
  return number < 10 ? "0" + number : String(number);
}

function updateClock() {
  var now = new Date();
  document.getElementById("time").textContent = pad(now.getHours()) + ":" + pad(now.getMinutes());
  document.getElementById("date").textContent =
    now.getFullYear() + ". gada " + now.getDate() + ". " + MONTHS[now.getMonth()];
  document.getElementById("weekday").textContent = WEEKDAYS[now.getDay()];
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
  appendAll(row, [span("Ārsts", ""), span("Specialitāte", ""), span("Kab.", "")]);
  row.appendChild(span("Virziens", ""));
  var i;
  for (i = 0; i < DAYS.length; i += 1) row.appendChild(span(DAYS[i][1], ""));
  return row;
}

function createDirectionCell(index) {
  var numericIndex = Number(index);
  var validIndex =
    index !== null && index !== "" && numericIndex % 1 === 0 && numericIndex >= 0 && numericIndex < DIRECTIONS.length;
  var cell = span("", "direction-cell");
  if (!validIndex) {
    cell.appendChild(span("—", "empty"));
    return cell;
  }

  var direction = DIRECTIONS[numericIndex];
  var icon = span(direction.symbol, "direction-icon");
  icon.setAttribute("aria-label", direction.label);
  icon.title = direction.label;
  cell.appendChild(icon);
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

  var before = parts[1].replace(/^\s+|\s+$/g, "");
  var secondary = parts[2].replace(/^\s+|\s+$/g, "");
  var after = parts[3].replace(/^\s+|\s+$/g, "");
  if (before) cell.appendChild(span(before, ""));
  cell.appendChild(span(secondary, "secondary"));
  if (after) cell.appendChild(span(after, ""));
  return cell;
}

function createDoctorRow(record) {
  var row = document.createElement("div");
  row.className = "table-row doctor-row" + (record.name.length > 45 ? " tall-row" : "");
  appendAll(row, [
    span(record.name, "doctor"),
    span(record.section, "specialty"),
    span(record.place === null || record.place === "" ? "—" : record.place, "place"),
    createDirectionCell(record.direction),
  ]);

  var i;
  for (i = 0; i < DAYS.length; i += 1) row.appendChild(createScheduleCell(record[DAYS[i][0]]));
  return row;
}

function showError() {
  var schedule = document.getElementById("schedule");
  if (schedule.querySelector(".doctor-row")) return;
  clear(schedule);
  schedule.appendChild(span("Neizdevās ielādēt pieņemšanas laikus.", "error"));
}

function renderRecords(records) {
  var schedule = document.getElementById("schedule");
  var filtered = [];
  var i;
  for (i = 0; i < records.length; i += 1) {
    if (Number(records[i].screen) === screenNumber) filtered.push(records[i]);
  }

  clear(schedule);
  schedule.appendChild(createColumnHeader());
  for (i = 0; i < filtered.length; i += 1) schedule.appendChild(createDoctorRow(filtered[i]));
  if (!filtered.length) schedule.appendChild(span("Šim ekrānam nav pievienotu speciālistu.", "error"));
}

function requestJson(url, fallbackUrl, onSuccess, onFailure) {
  var request = new XMLHttpRequest();
  var cacheKey = Math.floor(new Date().getTime() / UPDATE_INTERVAL);
  request.open("GET", url + (url.indexOf("?") === -1 ? "?" : "&") + "v=" + cacheKey, true);
  request.onreadystatechange = function () {
    if (request.readyState !== 4) return;
    if (request.status < 200 || request.status >= 300) {
      if (fallbackUrl) requestJson(fallbackUrl, null, onSuccess, onFailure);
      else if (onFailure) onFailure();
      return;
    }
    try {
      onSuccess(JSON.parse(request.responseText));
    } catch (error) {
      if (fallbackUrl) requestJson(fallbackUrl, null, onSuccess, onFailure);
      else if (onFailure) onFailure();
    }
  };
  request.onerror = function () {
    if (fallbackUrl) requestJson(fallbackUrl, null, onSuccess, onFailure);
    else if (onFailure) onFailure();
  };
  request.send();
}

function renderAdvertisement(config) {
  var container = document.getElementById("advertisement");
  var media = config && config.screens ? config.screens[String(screenNumber)] : null;
  clear(container);
  if (!media || !media.url) {
    var placeholder = document.createElement("div");
    placeholder.className = "ad-placeholder";
    placeholder.appendChild(span("i", "info-icon"));
    var details = document.createElement("div");
    details.appendChild(span("Informācija", "ad-placeholder-title"));
    var message = document.createElement("p");
    message.textContent = "Lūdzam ierasties 10 minūtes pirms pierakstītā vizītes laika.";
    details.appendChild(message);
    placeholder.appendChild(details);
    container.appendChild(placeholder);
    return;
  }

  var element;
  if (media.type && media.type.indexOf("video/") === 0) {
    element = document.createElement("video");
    element.autoplay = true;
    element.muted = true;
    element.loop = true;
    element.setAttribute("playsinline", "");
    element.setAttribute("preload", "auto");
  } else {
    element = document.createElement("img");
    element.alt = media.name || "Reklāma";
  }
  element.className = "ad-media";
  element.src = media.url;
  container.appendChild(element);
}

function loadContent() {
  requestJson("/api/timetable", "doctors_timetable.json", renderRecords, showError);
  requestJson("/api/advertisements", "advertisements.json", renderAdvertisement, null);
}

document.getElementById("screen-number").textContent = "Ekrāns " + screenNumber;
updateClock();
window.setInterval(updateClock, 30000);
loadContent();
window.setInterval(loadContent, UPDATE_INTERVAL);
