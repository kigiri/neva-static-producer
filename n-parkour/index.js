const parser = require("./parsers.js");
const getLast = arr => arr[arr.length - 1];
const isFn = fn => typeof fn === "function";

const decount = (fn, count) => {
  if (!count) { return fn }
  const originalCount = count;
  const decountFn = el => fn(el) ? (--count < 0) : false;
  decountFn.reset = () => count = originalCount;
  return decountFn;
}

function select(selector, count) {
  if (!selector) {
    return this.tag("root", 0);
  }

  if (isFn(selector)) {
    return this.match(selector, count);
  }

  switch (selector[0]) {
    case '.': return this.class(selector.slice(1), count);
    case '#': return this.id(selector.slice(1), count);
    default:  return this.tag(selector, count);
  }
}

const _id = (fn, id, count) => fn(el => el.attrs.id === id, count);
const _tag = (fn, tag, count) => fn(el => el.tag === tag, count);
const _attrs = (fn, key, val, count) => fn(el => el.attrs[key] === val, count);

function _class(fn, className, count) {
  const re = new RegExp("\\b"+ className +"\\b");
  return fn(el => el.attrs.class && re.test(el.attrs.class), count);
}

const anyOf = (a, b) => el => a(el) || b(el);
const bothOf = (a, b) => el => a(el) && b(el);

function wrapLogic(tests, logic, fn, count) {
  const test = getLast(tests);
  test.fn = logic(test.fn, decount(fn, count));
  return this;
}

function getLogic(fn) {
  const logic = selector => select.call(logic, selector);
  logic.id = _id.bind(null, fn);
  logic.tag = _tag.bind(null, fn);
  logic.class = _class.bind(null, fn);
  logic.attrs = _attrs.bind(null, fn);
  logic.match = fn;
  return logic;
};

function setLogic($, tests, first) {
  $.in = getLogic(first);
  $.or = getLogic(wrapLogic.bind($, tests, anyOf));
  $.and = getLogic(wrapLogic.bind($, tests, bothOf));
  Object.keys($.in).forEach(key => $[key] = $.in[key]);
}

const makeElement = ($, tag, attrs, parent) => ({
  $: $,
  tag: tag,
  attrs: attrs,
  parent: parent,
  children: []
});

function refreshTests(tests, index, el) {
  const previousIndex = index - 1;
  const test = tests[previousIndex];
  if (test.el !== el) { return index }
  if (test.fn.reset) {
    test.fn.reset();
  }
  return previousIndex;
}

const wrap = ($, fn) => x => { fn(x); return $ };

module.exports = strict => {
  const $ = selector => select.call($, selector);
  const tests = [];
  let reject, resolve, filter, stop;
  let q = new Promise((res, rej) => { reject = rej; resolve = res });
  let testIndex = 0;
  let skip = true;
  let parent = makeElement($, "root", {}, null);
  let returnElement = parent;

  setLogic($, tests, (fn, count) => {
    tests.unshift({ fn: decount(fn, count) });
    skip = false;
    return $;
  });

  $.only = fn => { filter = fn; return $ };
  $.then = fn => { q = q.then(fn); return $ };
  $.catch = fn => { q = q.catch(fn); return $ };
  $.fail = reject;
  $.success = resolve;
  $.from = wrap($, parser({
    onerror: reject,
    ontext: text => parent.text = text,
    onopentag: (tag, attrs) => {
      const test = tests[testIndex];
      const el = makeElement($, tag, attrs, parent);

      if (!filter || filter(el)) {
        parent.children.push(el);
      }
      parent = el;
      if (!skip && test.fn(el)) {
        test.el = el;
        testIndex++;
        if (testIndex === tests.length) {
          returnElement = el;
          skip = true;
        }
      }
    },
    onclosetag: () => {
      if (parent === returnElement) {
        this.parser.pause();
        resolve(parent);
      } else if (testIndex) {
        testIndex = refreshTests(tests, testIndex, parent);
      }
      parent = parent.parent;
    }
  }, strict));

  return $;
}

// TODO: bind with https://github.com/fb55/domutils for adding DOM lvl 1