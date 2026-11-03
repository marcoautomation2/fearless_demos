const rankNames = ["base", "core", "driver", "worker", "framework", "accumulator", "tool", "app"];
const rankPattern = new RegExp("^(" + rankNames.join("|") + ")([0-9]{3})$");
const defaults = { q: "", rank: [], exact: [], kind: "all", edu: false, tag: [], match: "all", sort: "title" };
const byId = id => document.getElementById(id);
const search = byId("search");
const rankInput = byId("rank_input");
const chips = [];
let demos = [];
let tagCounts = new Map();
let state = { ...defaults };

const byTitle = (a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
const byRank = (a, b) => a.index - b.index || a.number - b.number || byTitle(a, b);
const sorts = { title: byTitle, rank: byRank, kind: (a, b) => b.app - a.app || byTitle(a, b) };

function el(tag, attributes, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) { node.setAttribute(name, value); }
  node.append(...children);
  return node;
}

function plural(count, one, many) { return count + " " + (count === 1 ? one : many); }

function counts(values) {
  const result = new Map();
  for (const value of values) { result.set(value, (result.get(value) || 0) + 1); }
  return result;
}

function https(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch { return null; }
}

function optionalLink(demo, key) {
  if (demo[key] === undefined) { return null; }
  const url = https(demo[key]);
  if (!url) { console.warn(`${demo.id}: ${key} ignored because ${JSON.stringify(demo[key])} is not an https URL`); }
  return url;
}

function prepare(demo) {
  const match = rankPattern.exec(demo.rank);
  const download = https(demo.download);
  if (!match) { throw new Error(`${JSON.stringify(demo.rank)} is not a rank`); }
  if (!download) { throw new Error(`the download ${JSON.stringify(demo.download)} is not an https URL`); }
  const texts = [demo.id, demo.title, demo.summary, ...demo.tags];
  if (!texts.every(text => typeof text === "string")) { throw new Error("id, title, summary and tags must be text"); }
  const file = new URL(download).pathname.split("/").pop();
  return {
    id: demo.id, title: demo.title, summary: demo.summary, rank: demo.rank, download, file,
    tags: [...new Set(demo.tags)],
    name: match[1], index: rankNames.indexOf(match[1]), number: Number(match[2]),
    app: match[1] === "app", edu: /_edu_(app|lib)\.zip$/.test(file),
    page: optionalLink(demo, "page"), image: optionalLink(demo, "image"),
    text: [...texts, demo.rank].join("\n").toLowerCase()
  };
}

function prepareOrSkip(demo) {
  try { return [prepare(demo)]; } catch (error) {
    console.warn(`${demo?.id}: demo skipped because ${error.message}`);
    return [];
  }
}

function fromHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  const choice = (key, allowed) => allowed.includes(params.get(key)) ? params.get(key) : defaults[key];
  return {
    q: params.get("q") || "",
    rank: params.getAll("rank").filter(name => rankNames.includes(name)),
    exact: params.getAll("exact").filter(rank => rankPattern.test(rank)),
    kind: choice("kind", ["app", "library"]),
    edu: params.get("edu") === "1",
    tag: params.getAll("tag").filter(tag => tagCounts.has(tag)),
    match: choice("match", ["any"]),
    sort: choice("sort", ["rank", "kind"])
  };
}

function toHash(current) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (Array.isArray(value)) { value.forEach(item => params.append(key, item)); }
    else if (value !== defaults[key]) { params.set(key, value === true ? "1" : value); }
  }
  return params.toString();
}

function update(patch, replace = false) {
  state = { ...state, ...patch };
  const hash = toHash(state);
  const url = location.pathname + location.search + (hash && "#" + hash);
  if (url !== location.pathname + location.search + location.hash) {
    history[replace ? "replaceState" : "pushState"](null, "", url);
  }
  render();
}

const toggle = (list, value) => list.includes(value) ? list.filter(item => item !== value) : [...list, value];

function matches(demo, filter) {
  const words = filter.q.toLowerCase().split(/\s+/).filter(Boolean);
  const ranked = filter.rank.length + filter.exact.length === 0 || filter.rank.includes(demo.name) || filter.exact.includes(demo.rank);
  const kind = filter.kind === "all" || (filter.kind === "app") === demo.app;
  const tagTest = tag => demo.tags.includes(tag);
  const tagged = filter.tag.length === 0 || (filter.match === "all" ? filter.tag.every(tagTest) : filter.tag.some(tagTest));
  return words.every(word => demo.text.includes(word)) && ranked && kind && (!filter.edu || demo.edu) && tagged;
}

function monogram(id) {
  const parts = id.split("_").filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : id.slice(0, 2)).toUpperCase();
}

function tileFor(demo) {
  let hash = 0;
  for (const character of demo.id) { hash = (hash * 31 + character.charCodeAt(0)) >>> 0; }
  const tile = el("div", { class: "tile", "aria-hidden": "true" }, el("span", { class: "monogram" }, monogram(demo.id)));
  const hue = seed => (seed % 300 + 80) % 360;
  tile.style.setProperty("--h1", hue(hash));
  tile.style.setProperty("--h2", hue(hash + 40 + (hash >>> 9) % 80));
  if (demo.image) {
    const image = el("img", { src: demo.image, alt: "", width: "640", height: "360", loading: "lazy", referrerpolicy: "no-referrer" });
    image.addEventListener("error", () => image.remove());
    tile.append(image);
  }
  return tile;
}

function tagButton(demo, tag) {
  const pressed = String(state.tag.includes(tag));
  const button = el("button", { type: "button", class: "tag", "aria-pressed": pressed, "aria-label": "Filter by tag " + tag, "data-key": `tag:${demo.id}:${tag}` }, tag);
  button.addEventListener("click", () => update({ tag: toggle(state.tag, tag) }));
  return el("li", {}, button);
}

function actionLink(url, label, demo) {
  return el("a", { class: "button", href: url, rel: "noopener", "aria-label": `${label} of ${demo.title}` }, label);
}

async function copyUrl(button, demo) {
  const label = button.textContent;
  const copied = await navigator.clipboard.writeText(demo.download).then(() => true, () => false);
  button.textContent = copied ? "Copied" : "Copy failed";
  byId("copy_status").textContent = `The URL of ${demo.title} ${copied ? "is copied" : "could not be copied"}.`;
  setTimeout(() => { button.textContent = label; }, 2000);
}

function copyButton(demo) {
  const button = el("button", { type: "button", class: "button primary", "aria-label": `Copy the URL of ${demo.title}` }, "Copy URL");
  button.addEventListener("click", () => copyUrl(button, demo));
  return button;
}

function card(demo) {
  const badges = [el("span", { class: "badge kind" }, demo.app ? "App" : "Library")];
  if (demo.edu) { badges.push(el("span", { class: "badge edu" }, "Educational")); }
  badges.push(el("code", { class: "badge rank" }, demo.rank));
  const actions = [copyButton(demo)];
  if (demo.page) { actions.push(actionLink(demo.page, "Details", demo)); }
  const body = el("div", { class: "body" },
    el("h3", { class: "title" }, demo.title),
    el("div", { class: "badges" }, ...badges),
    el("p", { class: "summary" }, demo.summary),
    el("ul", { class: "tags" }, ...demo.tags.map(tag => tagButton(demo, tag))));
  return el("li", {}, el("article", { class: "card" }, tileFor(demo), body, el("div", { class: "actions" }, ...actions), el("code", { class: "file" }, demo.file)));
}

function addChips(container, key, values, valueCounts) {
  for (const value of values) {
    const count = valueCounts.get(value) || 0;
    const button = el("button", { type: "button", class: "chip" }, el("span", {}, value), el("span", { class: "count" }, String(count)));
    button.addEventListener("click", () => update({ [key]: toggle(state[key], value) }));
    chips.push({ button, key, value, count });
    container.append(button);
  }
}

function exactChip(rank) {
  const attributes = { type: "button", class: "chip", "aria-pressed": "true", "aria-label": "Remove rank " + rank, "data-key": "exact:" + rank };
  const button = el("button", attributes, rank + " \u00d7");
  button.addEventListener("click", () => update({ exact: state.exact.filter(item => item !== rank) }));
  return button;
}

function activeFilters() {
  return state.rank.length + state.exact.length + state.tag.length + (state.kind !== "all") + state.edu;
}

function syncControls() {
  for (const { button, key, value, count } of chips) {
    const on = state[key].includes(value);
    button.setAttribute("aria-pressed", String(on));
    button.disabled = count === 0 && !on;
  }
  for (const control of document.querySelectorAll("[name]")) {
    if (control.type === "checkbox") { control.checked = state[control.name]; }
    else if (control.type === "radio") { control.checked = control.value === state[control.name]; }
    else { control.value = state[control.name]; }
  }
  if (search.value !== state.q) { search.value = state.q; }
  byId("exact_ranks").replaceChildren(...state.exact.map(exactChip));
  const active = activeFilters();
  byId("filters_badge").hidden = active === 0;
  byId("filters_badge").textContent = String(active);
  for (const button of document.querySelectorAll(".clear_button")) { button.disabled = active === 0 && state.q === ""; }
}

function render() {
  const focused = document.activeElement.dataset.key;
  syncControls();
  const shown = demos.filter(demo => matches(demo, state)).sort(sorts[state.sort]);
  byId("grid").replaceChildren(...shown.map(card));
  byId("empty").hidden = shown.length > 0;
  byId("count").textContent = `${shown.length} of ${plural(demos.length, "demo", "demos")}`;
  if (focused) { document.querySelector(`[data-key="${CSS.escape(focused)}"]`)?.focus(); }
}

function addExact(event) {
  event.preventDefault();
  const typed = rankInput.value.trim();
  const rank = typed.toLowerCase();
  const valid = rankPattern.test(rank);
  rankInput.setAttribute("aria-invalid", String(!valid));
  byId("rank_error").textContent = valid ? "" : `"${typed}" is not a rank. A rank is one of ${rankNames.join(", ")} followed by exactly three digits, for example core120.`;
  if (!valid) { return; }
  rankInput.value = "";
  update({ exact: state.exact.includes(rank) ? state.exact : [...state.exact, rank] });
}

function showStats() {
  const apps = demos.filter(demo => demo.app).length;
  byId("stats").textContent = `${plural(demos.length, "demo", "demos")}: ${plural(apps, "app", "apps")} and ${plural(demos.length - apps, "library", "libraries")}`;
}

function buildFilters() {
  addChips(byId("rank_names"), "rank", rankNames, counts(demos.map(demo => demo.name)));
  tagCounts = counts(demos.flatMap(demo => demo.tags));
  addChips(byId("tag_chips"), "tag", [...tagCounts.keys()].sort(), tagCounts);
  const ranks = new Set([...demos].sort(byRank).map(demo => demo.rank));
  byId("rank_list").replaceChildren(...[...ranks].map(rank => el("option", { value: rank })));
  showStats();
}

function showError(error) {
  byId("loading").hidden = true;
  byId("error_text").textContent = `The file demos.json could not be loaded: ${error.message}`;
  byId("error").hidden = false;
}

async function load() {
  byId("error").hidden = true;
  byId("loading").hidden = false;
  try {
    const response = await fetch("demos.json", { cache: "no-cache" });
    if (!response.ok) { throw new Error(`the server answered ${response.status}`); }
    demos = (await response.json()).flatMap(prepareOrSkip);
  } catch (error) { showError(error); return; }
  byId("loading").hidden = true;
  buildFilters();
  state = fromHash();
  render();
}

search.addEventListener("input", () => update({ q: search.value }, true));
byId("rank_form").addEventListener("submit", addExact);
rankInput.addEventListener("input", () => { rankInput.removeAttribute("aria-invalid"); byId("rank_error").textContent = ""; });
for (const button of document.querySelectorAll(".clear_button")) { button.addEventListener("click", () => update({ ...defaults, sort: state.sort })); }
byId("retry").addEventListener("click", load);
byId("filters_toggle").addEventListener("click", event => {
  const open = event.currentTarget.getAttribute("aria-expanded") !== "true";
  event.currentTarget.setAttribute("aria-expanded", String(open));
  byId("filters_body").hidden = !open;
});
document.addEventListener("change", event => {
  const control = event.target;
  if (control.name) { update({ [control.name]: control.type === "checkbox" ? control.checked : control.value }); }
});
addEventListener("hashchange", () => {
  const hash = location.hash.slice(1);
  if (hash && !hash.includes("=")) { return; }
  state = fromHash();
  render();
});
load();
