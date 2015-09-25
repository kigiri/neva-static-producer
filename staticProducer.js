const path = require("path");
const zlib = require('zlib');
const fs = require("fs");
const os = require('os');

const NOT_NULL_FLAG = 1;            /* Field can't be NULL */
const PRI_KEY_FLAG = 2;             /* Field is part of a primary key */
const UNIQUE_KEY_FLAG = 4;          /* Field is part of a unique key */
const MULTIPLE_KEY_FLAG = 8;        /* Field is part of a key */
const BLOB_FLAG = 16;               /* Field is a blob */
const UNSIGNED_FLAG = 32;           /* Field is unsigned */
const ZEROFILL_FLAG = 64;           /* Field is zerofill */
const BINARY_FLAG = 128;            /* Field is binary   */
const ENUM_FLAG = 256;              /* field is an enum */
const AUTO_INCREMENT_FLAG = 512;    /* field is a autoincrement field */
const TIMESTAMP_FLAG = 1024;        /* Field is a timestamp */
const SET_FLAG = 2048;              /* field is a set */
const NO_DEFAULT_VALUE_FLAG = 4096; /* Field doesn't have default value */
const ON_UPDATE_NOW_FLAG = 8192;    /* Field is set to NOW on UPDATE */
const NUM_FLAG = 32768;             /* Field is num (for clients) */


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

function storeTable(table, keys) {
  return new Promise((resolve, reject) => {
    log(table, "start");
    const file = jayZip(table);
    connection.query("SELECT "+ keys +" FROM "+ table)
    .on('error', reject)
    .on('fields', fields => {
      keyPath[table] = fields.filter(f => f.flags & PRI_KEY_FLAG)
      .map(f => f.name);
      file.write("["+ JSON.stringify(keys));
    })
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
const keyPath = {};
(function getNextTable(i, keys) {
  if (!keys[i]) { return }
  return storeTable(keys[i], tables[keys[i]]).then(() => getNextTable(i + 1, keys))
})(0, tablesKeys).then(() => new Promise((resolve, reject) => {
  const sizes = {};
  tablesKeys.forEach((table, i) =>
    fs.stat("./json/"+ table +".json", (err, stats) => {
      if (err) { reject(err) }
      sizes[table] = stats.size;
      if (i === tablesKeys.length - 1) {
        resolve(sizes);
      }
    }));
})).then(sizes => {
  jayZip("tables.min")
  .write(JSON.stringify({sizes, tables, keyPath}) + os.EOL)
  .onFinish(() => log("All done :)"));
})


