const path = require("path");
const zlib = require('zlib');
const fs = require("fs");
const os = require('os');

const log = require("n-bug")(__filename);
global.include = filePath => require(path.join(__dirname, filePath));

const mysql= require('mysql');
const connection = mysql.createConnection(include('config').db);
const tables = include("json/tables");

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

function storeTable(table) {
  return new Promise((resolve, reject) => {
    log(table, "start");
    const file = jayZip(table);

    connection.query("SELECT * FROM "+ table)
    .on('error', reject)
    .on('fields', () => file.write("["+ JSON.stringify(tables[table])))
    .on('result', row =>
      file.write(","+ os.EOL + JSON.stringify(tables[table].map(key => row[key]))))
    .on('end', () => {
      file.write("]"+ os.EOL);
      log(table, "finish");
      file.onFinish(resolve);
    })
  });
}

const tablesKeys = Object.keys(tables);
(function getNextTable(i, keys) {
  if (!keys[i]) { return }
  return storeTable(keys[i]).then(() => getNextTable(i + 1, keys))
})(0, tablesKeys).then(() => new Promise((resolve, reject) => {
  const sizes = {};
  tablesKeys.forEach((table, i) => fs.stat("./json/"+ table +".json", (err, stats) => {
    if (err) { reject(err) }
    sizes[table] = stats.size;
    if (i === tablesKeys.length - 1) {
      resolve(sizes);
    }
  }));
})).then(sizes => {
  jayZip("tables.min")
  .write(JSON.stringify({sizes, tables}) + os.EOL)
  .onFinish(() => log("All done :)"));
})
