const path = require("path");
const zlib = require('zlib');
const fs = require("fs");
const os = require('os');
const log = require("n-bug")(__filename);

global.include = filePath => require(path.join(__dirname, filePath));

const mysql= require('mysql');
const connection = mysql.createConnection(include('config').db);

const tables = {
  item_template: [
    "entry",
    "class",
    "subclass",
    "name",
    "Quality",
    "Flags",
    "FlagsExtra",
    "BuyCount",
    "BuyPrice",
    "SellPrice",
    "InventoryType",
    "AllowableClass",
    "AllowableRace",
    "ItemLevel",
    "RequiredLevel",
    "RequiredSkill",
    "RequiredSkillRank",
    "requiredspell",
    "RequiredReputationFaction",
    "RequiredReputationRank",
    "maxcount",
    "stackable",
    "ContainerSlots",
    "StatsCount",
    "stat_type1",
    "stat_value1",
    "stat_type2",
    "stat_value2",
    "stat_type3",
    "stat_value3",
    "stat_type4",
    "stat_value4",
    "stat_type5",
    "stat_value5",
    "stat_type6",
    "stat_value6",
    "stat_type7",
    "stat_value7",
    "stat_type8",
    "stat_value8",
    "stat_type9",
    "stat_value9",
    "stat_type10",
    "stat_value10",
    "dmg_min1",
    "dmg_max1",
    "armor",
    "delay",
    "bonding",
    "description",
    "block",
    "MaxDurability",
    "area",
    "Map",
    "BagFamily",
    "duration",
    "ItemLimitCategory",
    "HolidayId",
    "ScriptName",
    "minMoneyLoot",
    "maxMoneyLoot",
    "flagsCustom",
  ],
  item_loot_template: [
    "Entry",
    "Item",
    "Reference",
    "Chance",
    "QuestRequired",
    "LootMode",
    "GroupId",
    "MinCount",
    "MaxCount",
  ]
};

function storeTable(table) {
  return new Promise((resolve, reject) => {
    log(table, "start");
    const storedFile = fs.createWriteStream("./json/"+ table +".json");
    const compress = zlib.createGzip({ level: 9 });
    compress.pipe(fs.createWriteStream("./json/"+ table +".json.gz"));

    function storeString(str) {
      storedFile.write(str, "utf-8");
      compress.write(str);
    }

    connection.query("SELECT * FROM "+ table)
    .on('error', reject)
    .on('fields', () => storeString("["+ JSON.stringify(tables[table])))
    .on('result', row =>
      storeString(","+ os.EOL + JSON.stringify(tables[table].map(key => row[key]))))
    .on('end', () => {
      storeString("]"+ os.EOL);
      compress.end();
      log(table, "finish");
      resolve();
    })
  });
}

(function getNextTable(i, keys) {
  if (!keys[i]) { return }
  storeTable(keys[i]).then(() => getNextTable(i + 1, keys))
})(0, Object.keys(tables))
