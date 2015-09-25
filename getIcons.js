const path = require("path");
const zlib = require('zlib');
const fs = require("fs");
const os = require('os');
const get = require("./n-link/index");
const items = require("./json/item_template");
const log = require("n-bug")(__filename);

function jayZip(fileName) {
  fileName = path.join("./json/", fileName +".json");
  const j = fs.createWriteStream(fileName);
  const z = zlib.createGzip({ level: 9 });
  const g = fs.createWriteStream(fileName +".gz");
  z.pipe(g);

  return {
    onFinish(fn) {
      let otherStreamIsDone = false;
      const finish = () => otherStreamIsDone ? fn() : otherStreamIsDone = true;
      z.on("finish", finish);
      g.on("finish", finish);
      z.end();
      return this;
    },
    write(str) {
      j.write(str, "utf-8");
      z.write(str);
      return this;
    },
  };
}

function g(url, reg, entry) {
  return get(url + entry).then(src => src.split(reg)[1]).then(match => {
    if (!match) {  log.error("no match for "+ url +" "+ entry) }
    return match;
  });
}

let prevI = 0;
const models = {};
const icons = {};

function pushData(store, value, entry) {
  if (!value) { return }
  if (store[value]) {
    store[value].push(entry);
  } else {
    store[value] = [ entry ];
  }
}

function reccur() {
  const i = ++prevI;
  const entry = items[i][0];
  if (!entry) { return save() }
  log("getting", entry);
  Promise.all([
    g("http://www.wowhead.com/item=", /"appearances":{"0":\[([0-9]+),/, entry)
      .then(model => pushData(models, model, entry)),
    g("http://wotlk.openwow.com/item=", /,icon:'([^']+)/, entry)
      .then(icon => pushData(icons, icon, entry)),
  ]).then(reccur);
}

reccur();
reccur();
reccur();

let saved = false;
function save() {
  if (saved) { return }
  saved = true;
  jayZip("images")
  .write(JSON.stringify({models, icons}) + os.EOL)
  .onFinish(() => log("All done :)"))
}
