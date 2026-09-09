/*
  Produces static English copies of every public OEM-equipment list.

  This is deliberately a development-time task: the published site never
  calls a translation service or shares a visitor's browsing data. Run after
  adding or replacing files in data/eq, then review the changed source before
  deployment.
*/
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();
const EQ_DIR = path.join(ROOT, "data", "eq");
const CYRILLIC = /[А-Яа-я]/;
const SEP = "\n__AUTOHAUS_EQ_SPLIT_8C2B__\n";
const OVERRIDES = new Map([
  ["Алуминиеви джанти 22″ дизайн 1023М", "22-inch alloy wheels, Design 1023M"]
]);

function readRecord(source, file) {
  const box = { window: {} };
  vm.runInNewContext(source, box, { filename: file });
  const data = box.window.AH_EQ;
  if (!data || !Array.isArray(data.e)) throw new Error(`Invalid equipment file: ${file}`);
  return data;
}

function splitLine(line) {
  const sub = line.match(/^([-–—]\s*)(.+)$/);
  if (sub) return { prefix: sub[1], text: sub[2] };
  const item = line.match(/^([0-9A-Za-zА-Яа-я]{1,5}\s*[–—]\s*)(.+)$/);
  if (item) return { prefix: item[1], text: item[2] };
  return { prefix: "", text: line };
}

async function translateBatch(texts) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "bg");
  url.searchParams.set("tl", "en");
  url.searchParams.append("dt", "t");
  url.searchParams.set("q", texts.join(SEP));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Translation request failed (${response.status})`);
  const payload = await response.json();
  const translated = payload[0].map((part) => part[0]).join("").split(SEP);
  if (translated.length !== texts.length) {
    throw new Error("Translation response lost a list separator");
  }
  return translated.map((text) => text.trim());
}

function batches(values, limit = 3600) {
  const result = [], batch = [];
  let length = 0;
  for (const value of values) {
    const extra = value.length + (batch.length ? SEP.length : 0);
    if (batch.length && length + extra > limit) {
      result.push(batch.splice(0));
      length = 0;
    }
    batch.push(value);
    length += value.length + (batch.length > 1 ? SEP.length : 0);
  }
  if (batch.length) result.push(batch);
  return result;
}

const files = (await readdir(EQ_DIR)).filter((file) => file.endsWith(".js")).sort();
const records = [];
const unique = new Map();

for (const file of files) {
  const source = await readFile(path.join(EQ_DIR, file), "utf8");
  const data = readRecord(source, file);
  records.push({ file, source, data });
  for (const line of data.e) {
    const { text } = splitLine(String(line));
    if (CYRILLIC.test(text)) unique.set(text, null);
  }
}

for (const [source, translation] of OVERRIDES) {
  if (unique.has(source)) unique.set(source, translation);
}
const phrases = [...unique.entries()].filter(([, translation]) => translation == null)
  .map(([source]) => source);
const chunks = batches(phrases);
console.log(`Translating ${phrases.length} unique equipment descriptions in ${chunks.length} request(s).`);

for (let start = 0; start < chunks.length; start += 5) {
  const group = chunks.slice(start, start + 5);
  const translations = await Promise.all(group.map(translateBatch));
  for (let offset = 0; offset < group.length; offset++) {
    const source = group[offset];
    const translated = translations[offset];
    for (let i = 0; i < source.length; i++) unique.set(source[i], translated[i]);
    console.log(`  ${start + offset + 1}/${chunks.length}`);
  }
}

const untranslated = [...unique.entries()].filter(([, value]) => !value || CYRILLIC.test(value));
if (untranslated.length) {
  console.error(untranslated.map(([source]) => source).join("\n"));
  throw new Error(`Untranslated equipment descriptions: ${untranslated.length}`);
}

for (const record of records) {
  const en = record.data.e.map((line) => {
    const { prefix, text } = splitLine(String(line));
    return prefix + (unique.get(text) || text);
  });
  const head = record.source.slice(0, record.source.indexOf("window.AH_EQ="));
  const next = `${head}window.AH_EQ=${JSON.stringify({ ...record.data, en })};\n`;
  if (next !== record.source) await writeFile(path.join(EQ_DIR, record.file), next, "utf8");
}

console.log(`Wrote English equipment data for ${records.length} vehicles.`);
