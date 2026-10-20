#!/usr/bin/env node
/** Compile one editable article into Ronu's existing JSON format. No dependencies. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const expectedId = 'sunlight-to-step';
const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const marker = (kind, line) => line.match(new RegExp(`^<!-- ${kind}: ([a-z][a-z0-9-]*) -->$`));
const requireText = (value, message) => { if (!value?.trim()) throw new Error(message); return value.trim(); };

function paragraph(value) {
  const text = requireText(value, 'Empty paragraph.');
  if (/<[^>]+>/.test(text)) throw new Error('Use plain text, not HTML, in the narrative.');
  if (/^\*\*E = mc²\.?\*\*$/.test(text)) return {type:'paragraph', text:'E = mc²', highlight:true};
  if (!text.includes('**')) return {type:'paragraph', text};
  const chunks = text.split('**');
  if (chunks.length % 2 !== 1) throw new Error('Unclosed **bold** formatting.');
  const runs = chunks.flatMap((text, i) => text ? [{text, ...(i % 2 ? {strong:true} : {})}] : []);
  return {type:'paragraph', runs};
}

export function compileArticle(raw) {
  const source = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (source.split('<!-- science-notes -->').length !== 2) {
    throw new Error('Keep exactly one <!-- science-notes --> marker.');
  }
  const [storyText, notesText] = source.split('<!-- science-notes -->');
  const metadata = storyText.match(/^<!-- ronu-article: ([a-z][a-z0-9-]*) -->$/m);
  if (metadata?.[1] !== expectedId) throw new Error('Unexpected or missing article ID.');
  const title = requireText(storyText.match(/^# (.+)$/m)?.[1], 'Missing article title.');
  const sections = [], sectionIds = new Set();
  let current = null, buffer = [];
  const flushStory = () => {
    if (buffer.length) {
      if (!current) throw new Error('Narrative text must follow a section marker.');
      current.blocks.push(paragraph(buffer.join('\n'))); buffer = [];
    }
  };
  for (const line of storyText.split('\n')) {
    let match;
    if (/^<!-- ronu-article:/.test(line) || /^# /.test(line)) continue;
    if ((match = marker('section', line))) {
      flushStory();
      if (sectionIds.has(match[1])) throw new Error('Duplicate section: ' + match[1]);
      sectionIds.add(match[1]); current = {id:match[1], blocks:[]}; sections.push(current);
    } else if ((match = line.match(/^## (.+)$/))) {
      flushStory();
      if (!current || current.heading || current.blocks.length) throw new Error('A section heading must immediately follow its marker.');
      current.heading = match[1];
    } else if ((match = marker('note', line))) {
      flushStory();
      if (!current) throw new Error('A note reference must belong to a section.');
      current.blocks.push({noteKey:match[1]});
    } else if (!line.trim()) flushStory();
    else {
      if (line.startsWith('<!--') || /^#{2,}/.test(line)) throw new Error('Unsupported narrative marker: ' + line);
      buffer.push(line);
    }
  }
  flushStory();
  if (!sections.length || sections.length > 50 || sections.some(s => !s.blocks.length)) throw new Error('Invalid article sections.');

  const notes = new Map(); let note = null, item = null, isConclusion = false; buffer = [];
  const flushNoteText = () => {
    const text = buffer.join('\n').trim(); buffer = [];
    if (!text) return;
    if (isConclusion) note.conclusion = text;
    else if (item) item.text = text;
    else throw new Error('Scientific prose must follow a ### subheading.');
  };
  for (const line of notesText.split('\n')) {
    let match;
    if ((match = marker('science', line))) {
      flushNoteText();
      if (notes.has(match[1])) throw new Error('Duplicate science note: ' + match[1]);
      note = {type:'concepts', items:[]}; notes.set(match[1], note); item = null; isConclusion = false;
    } else if ((match = line.match(/^## (.+)$/))) {
      if (!note || note.label) throw new Error('Invalid science-note heading.');
      note.label = match[1];
    } else if ((match = line.match(/^### (.+)$/))) {
      flushNoteText();
      if (!note || isConclusion) throw new Error('Invalid science subheading.');
      item = {term:match[1], text:''}; note.items.push(item);
    } else if (line === '<!-- conclusion -->') {
      flushNoteText();
      if (!note) throw new Error('Conclusion outside a science note.');
      item = null; isConclusion = true;
    } else {
      if (line.startsWith('<!--')) throw new Error('Unsupported science marker: ' + line);
      if (line.trim() || buffer.length) buffer.push(line);
    }
  }
  flushNoteText();
  for (const [key, value] of notes) {
    if (!value.label || !value.items.length || value.items.length > 8 || value.items.some(i => !i.text.trim())) {
      throw new Error('Invalid science note (1–8 complete items required): ' + key);
    }
  }
  const used = new Set();
  for (const section of sections) {
    section.blocks = section.blocks.map(block => {
      if (!block.noteKey) return block;
      if (!notes.has(block.noteKey)) throw new Error('Missing science note: ' + block.noteKey);
      if (used.has(block.noteKey)) throw new Error('Repeated note reference: ' + block.noteKey);
      used.add(block.noteKey); return notes.get(block.noteKey);
    });
  }
  for (const key of notes.keys()) if (!used.has(key)) throw new Error('Unreferenced science note: ' + key);
  const article = {id:expectedId, sections};
  if (JSON.stringify(article).length > 200000) throw new Error('Article exceeds the current reader limit.');
  return {title, article};
}

function writeFile(file, contents) {
  fs.mkdirSync(path.dirname(file), {recursive:true});
  const temporary = file + '.tmp';
  fs.writeFileSync(temporary, contents, 'utf8'); fs.renameSync(temporary, file);
}

function main(args) {
  let root = defaultRoot, sourcePath, outputPath, check = false, build = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (['--repo', '--source', '--output'].includes(arg)) {
      const value = args[++i]; if (!value || value.startsWith('--')) throw new Error('Missing value for ' + arg);
      if (arg === '--repo') root = path.resolve(value);
      if (arg === '--source') sourcePath = path.resolve(value);
      if (arg === '--output') outputPath = path.resolve(value);
    } else if (arg === '--check') check = true;
    else if (arg === '--build') build = true;
    else if (arg === '--help') {
      console.log('node scripts/update_sunlight.mjs [--check | --build] [--repo DIR] [--source FILE] [--output FILE]');
      return;
    } else throw new Error('Unknown argument: ' + arg);
  }
  if (check && build) throw new Error('Use --check or --build, not both.');
  sourcePath ||= path.join(root, 'docs/articles/sunlight-to-step.md');
  outputPath ||= path.join(root, 'docs/articles/sunlight-to-step.json');
  const raw = fs.readFileSync(sourcePath, 'utf8');
  const {article, title} = compileArticle(raw);
  const json = JSON.stringify(article, null, 2) + '\n';
  if (check) {
    if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== json) throw new Error('Generated JSON is out of date. Run the command without --check.');
    console.log('Verified: master text and generated JSON match.'); return;
  }
  let buildFiles;
  if (build) {
    if (path.resolve(outputPath) !== path.join(root, 'docs/articles/sunlight-to-step.json')) throw new Error('--build requires the repository’s standard JSON output path.');
    const catalogueFile = path.join(root, 'docs/content.js');
    const shellFile = path.join(root, 'scripts/site-shell.html');
    const buildScript = path.join(root, 'scripts/build_site.js');
    for (const file of [catalogueFile,shellFile,buildScript]) if (!fs.existsSync(file)) throw new Error('--build requires a full local website checkout: missing ' + file);
    const catalogue = fs.readFileSync(catalogueFile,'utf8');
    const objectPattern = /\{id:'sunlight-to-step',[^\n]+/;
    const object = catalogue.match(objectPattern)?.[0];
    if (!object || !object.includes("title:'" + title.replaceAll("'", "\\'") + "'")) throw new Error('Article catalogue changed, or title changed. Review docs/content.js before building.');
    const version = 'sunlight-' + createHash('sha256').update(json).digest('hex').slice(0,12);
    const updated = object.replace(/articleVersion:'[^']+'/, "articleVersion:'" + version + "'");
    if (updated === object && !object.includes(version)) throw new Error('Missing articleVersion in catalogue.');
    const shell = fs.readFileSync(shellFile, 'utf8');
    if (!/\/content\.js\?v=[^"']+/.test(shell)) throw new Error('Missing catalogue cache key in site shell.');
    buildFiles = {catalogueFile, shellFile, buildScript,
      catalogue:catalogue.replace(object, updated),
      shell:shell.replace(/\/content\.js\?v=[^"']+/, '/content.js?v=' + version)};
  }
  writeFile(outputPath,json);
  console.log('Saved ' + outputPath);
  if (buildFiles) {
    writeFile(buildFiles.catalogueFile, buildFiles.catalogue); writeFile(buildFiles.shellFile, buildFiles.shell);
    const result = spawnSync(process.execPath,[buildFiles.buildScript],{cwd:root,stdio:'inherit'});
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('Site build failed. Files are local only; inspect before publishing.');
    console.log('Website files prepared locally. No commit, upload or publication was performed.');
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error('Article update failed: ' + error.message); process.exitCode = 1; }
}
