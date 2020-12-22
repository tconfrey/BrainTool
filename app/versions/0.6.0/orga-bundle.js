(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
exports = {
  todos: [`TODO`, `DONE`]
}

},{}],2:[function(require,module,exports){
const Parser = require('./parser')

function parse(string, options = require('./defaults')) {
  const parser = new Parser(options)
  return parser.parse(string)
}

module.exports = {
  Parser,
  parse,
}

},{"./defaults":1,"./parser":6}],3:[function(require,module,exports){
const Node = require('./node')
const uri = require('./uri')

const LINK_PATTERN = /(.*?)\[\[([^\]]*)\](?:\[([^\]]*)\])?\](.*)/m; // \1 => link, \2 => text
const FOOTNOTE_PATTERN = /(.*?)\[fn:(\w+)\](.*)/

const PRE = `(?:[\\s\\({'"]|^)`
const POST = `(?:[\\s-\\.,:!?'\\)}]|$)`
const BORDER = `[^,'"\\s]`

function markup(marker) {
  return RegExp(`(.*?${PRE})${marker}(${BORDER}(?:.*?(?:${BORDER}))?)${marker}(${POST}.*)`, 'm')
}

function parse(text) {
  text = _parse(LINK_PATTERN, text, (captures) => {
    return new Node(`link`)
      .with({ uri: uri(captures[0]), desc: captures[1] })
  })

  text = _parse(FOOTNOTE_PATTERN, text, (captures) => {
    return new Node(`footnote.reference`)
      .with({ label: captures[0] })
  })

  const markups = [
    { name: `bold`, marker: `\\*` },
    { name: `verbatim`, marker: `=` },
    { name: `italic`, marker: `/` },
    { name: `strikeThrough`, marker: `\\+` },
    { name: `underline`, marker: `_` },
    { name: `code`, marker: `~` },
  ]
  for (const { name, marker } of markups) {
    text = _parse(markup(marker), text, (captures) => {
      return new Node(name, captures[0])
    })
  }
  return text
}


function _parse(pattern, text, post) {
  if (typeof text === `string`) {
    var m = pattern.exec(text)
    if (!m) return [new Node(`text`).with({ value: text })]
    m.shift()
    let before = m.shift()
    let after = m.pop()
    var nodes = []
    if ( before.length > 0 ) {
      nodes.push(new Node(`text`).with({ value: before }))
    }
    if (m.length > 0) {
      nodes.push(post(m))
      // nodes.push(new Node(name).with({ value: match }))
    }
    if (after) {
      nodes = nodes.concat(_parse(pattern, after, post))
    }
    return nodes
  }

  if (Array.isArray(text)) {
    return text.reduce((all, node) => {
      if (node.hasOwnProperty(`type`) && node.type !== `text`) {
        return all.concat(node)
      }
      return all.concat(_parse(pattern, node, post))
    }, [])
  }

  if (typeof text.value === `string`) {
    return _parse(pattern, text.value, post)
  }
  return undefined
}

module.exports = {
  parse,
}

},{"./node":5,"./uri":17}],4:[function(require,module,exports){
const { escape } = require('./utils')

function Syntax() {
  this.rules = []
}

Syntax.prototype = {
  define: function(name, pattern, post = () => { return {} }) {
    this.rules.push({
      name,
      pattern,
      post,
    })
  },

  update: function(name, pattern) {
    const i = this.rules.findIndex(r => r.name === name)
    var newRule = { name, post: () => {} }
    if (i !== -1) {
      newRule = this.rules.splice(i, 1)[0]
    }
    newRule.pattern = pattern
    this.rules.splice(i, 0, newRule)
  }
}

var org = new Syntax()

function headlinePattern(todos = ['TODO', 'DONE']) {
  return RegExp(`^(\\*+)\\s+(?:(${todos.map(escape).join('|')})\\s+)?(?:\\[#(A|B|C)\\]\\s+)?(.*?)\\s*(:(?:\\w+:)+)?$`)
}

org.define('headline', headlinePattern(), m => {
  const level = m[1].length
  const keyword = m[2]
  const priority = m[3]
  const content = m[4]
  const tags = (m[5] || '').split(':').map( str => str.trim()).filter(String)
  return { level, keyword, priority, content, tags }
})

org.define('keyword', /^\s*#\+(\w+):\s*(.*)$/, m => {
  const key = m[1]
  const value = m[2]
  return { key, value }
})

const PLANNING_KEYWORDS = ['DEADLINE', 'SCHEDULED', 'CLOSED']
org.define('planning', RegExp(`^\\s*(${PLANNING_KEYWORDS.join('|')}):\\s*(.+)$`), m => {
  const keyword = m[1]
  const timestamp = m[2]
  return { keyword, timestamp }
})

org.define('block.begin', /^\s*#\+begin_(\w+)(.*)$/i, m => {
  const type = m[1]
  const params = m[2].split(' ').map( str => str.trim()).filter(String)
  return { type, params }
})

org.define('block.end', /^\s*#\+end_(\w+)$/i, m => {
  const type = m[1]
  return { type }
})

org.define('drawer.end', /^\s*:end:\s*$/i)

org.define('drawer.begin', /^\s*:(\w+):\s*$/, m => {
  const type = m[1]
  return { type }
})

org.define('list.item', /^(\s*)([-+]|\d+[.)])\s+(?:\[(x|X|-| )\])?(.*)$/, m => {
  const indent = m[1].length
  const bullet = m[2]
  const content = m[4]
  var ordered = true
  if ( [`-`, `+`].includes(bullet) ) {
    ordered = false
  }

  var result = { indent, ordered, content }
  if (m[3]) {
    var checked = m[3] !== ' '
    result.checked = checked
  }
  return result
})

org.define('table.separator', /^\s*\|-/)

org.define('table.row', /^\s*\|(\s*.+\|)+\s*$/, m => {
  const cells = m[1].split('|').map( str => str.trim()).filter(String)
  return { cells }
})

org.define('horizontalRule', /^\s*-{5,}\s*$/)

org.define('comment', /^\s*#\s.*$/)

org.define('footnote', /^\[fn:(\w+)\]\s+(.*)$/, m => {
  const label = m[1]
  const content = m[2]
  return { label, content }
})

function Lexer(options = require('./defaults')) {
  this.syntax = org
  const { todos } = options
  if (todos) {
    this.updateTODOs(todos)
  }
}

Lexer.prototype = {
  tokenize: function (input) {
    for ( const { name, pattern, post } of this.syntax.rules ) {
      const m = pattern.exec(input)
      if (!m) { continue }
      var token = { name, raw: input }
      token.data = post(m)
      return token
    }

    const trimed = input.trim()
    if (trimed === '') {
      return { name: `blank`, raw: input }
    }

    return { name: `line`, raw: input }
  },

  updateTODOs: function(todos) {
    this.syntax.update(`headline`, headlinePattern(todos))
  }

}

module.exports = Lexer

},{"./defaults":1,"./utils":18}],5:[function(require,module,exports){
function Node(type, children = []) {
  this.type = type
  this.children = []
  this.push(children)
}

Node.prototype = {
  with: function(data) {
    var newNode = this
    newNode = Object.assign(this, data)
    return newNode
  },

  push: function(node) {
    if (Array.isArray(node)) {
      for (const n of node) {
        this.push(n)
      }
    } else if (node instanceof Node) {
      node.parent = this
      this.children.push(node)
    } else if (typeof node === `string`) {
      var newNode = new Node(`text`).with({ value: node })
      newNode.parent = this
      this.children.push(newNode)
    }
  },
}

module.exports = Node

},{}],6:[function(require,module,exports){
const Lexer = require('./lexer')
const Node = require('./node')

function Parser(options = require('./defaults')) {
  this.options = options
  this.lexer = new Lexer(this.options)
  this.prefix = []
  this._aks = {} // Affiliated Keywords
  this._cel = 0 // Consecutive Empty Lines
}

Parser.prototype.peek = function() {
  if (this.prefix.length > 0) return this.prefix[0]
  return this.getToken(this.cursor + 1)
}

Parser.prototype.hasNext = function() {
  return this.prefix.length > 0 || this.cursor + 1 < this.lines.length
}

Parser.prototype.consume = function() {
  if (this.prefix.length > 0) return this.prefix.shift()
  this.cursor++
  return this.getToken(this.cursor)
}

Parser.prototype.next = function() {
  return this.consume()
}

Parser.prototype.getToken = function(index) {
  var self = this
  if (index >= self.lines.length) { return undefined }
  if (index >= self.tokens.length) {
    const start = self.tokens.length
    for (var i = start; i <= index; i++) {
      self.tokens.push(self.lexer.tokenize(self.lines[i]))
    }
  }
  return self.tokens[index]
}

Parser.prototype.downgradeToLine = function(index) {
  const { raw } = this.tokens[index]
  this.tokens[index] = { name: `line`, raw, data: { content: raw.trim() }}
}

Parser.prototype.tryTo = function(process) {
  const restorePoint = this.cursor
  const result = process.bind(this)()
  if (result) { return result }
  this.cursor = restorePoint
  return result
}

Parser.prototype.processor = require('./processors')

Parser.prototype.parse = function(string) {
  var self = this
  const document = new Node('root').with({ meta: {} })
  self.cursor = -1
  self.lines = string.split('\n') // TODO: more robust lines?
  self.tokens = []
  return this.parseSection(document)
}

/* Total Awareness -- according to Ross */
Parser.prototype.unagi = function(element) {
  if (Object.keys(this._aks).length === 0) return element
  element.attributes = this._aks
  return element
}

Parser.prototype.parseSection = function(section) {
  const token = this.peek()
  if (!token) return section
  if (token.name !== `blank`) this._cel = 0 // reset consecutive empty lines
  const p = this.processor[token.name]
  if (p) {
    return p.bind(this)(token, section)
  }
  this.consume()
  this._aks = {}
  return this.parseSection(section)
}

module.exports = Parser

},{"./defaults":1,"./lexer":4,"./node":5,"./processors":12}],7:[function(require,module,exports){
function process(token, section) {
  var self = this
  self._cel++
  self.consume()
  if (section.type === `footnote` && self._cel > 1) return section
  self._aks = {}
  return self.parseSection(section)
}

module.exports = process

},{}],8:[function(require,module,exports){
const Node = require('../node')

function parseBlock() {
  const t = this.next()
  const { data: { type, params } } = t
  var lines = []
  while (this.hasNext()) {
    const t = this.next()
    if ( t.name === `headline` ) { return undefined }
    if (t.name === `block.end` && t.data.type.toUpperCase() === type.toUpperCase() ) {
      if (t.data.type.toUpperCase() === `EXPORT`) {
        const format = params[0]
        return new Node(format).with({ value: lines.join(`\n`) })
      }
      return new Node('block').with({ name: type.toUpperCase(), params, value: lines.join(`\n`) })
    }
    lines.push(t.raw)
  }
  return undefined
}

function process(token, section) {
  const block = this.tryTo(parseBlock)
  if (block) section.push(this.unagi(block))
  else this.downgradeToLine(this.cursor + 1)
  this._aks = {}
  return this.parseSection(section)
}

module.exports = process

},{"../node":5}],9:[function(require,module,exports){
const Node = require('../node')

function process(token, section) {

  if (section.type === `footnote.definition`) return section // footnote breaks footnote
  var self = this

  const parseFootnote = () => {
    const { label, content } = self.next().data
    self.prefix = [{ name: `line`, raw: content, data: { content: content.trim() } }]
    return self.parseSection(new Node(`footnote.definition`).with({ label }))
  }
  section.push(parseFootnote())
  self._aks = {}
  return self.parseSection(section)
}

module.exports = process

},{"../node":5}],10:[function(require,module,exports){
const Node = require('../node')
const inlineParse = require('../inline').parse

function parsePlanning() {
  const token = this.next()
  if (!token || token.name !== `planning`) { return undefined }
  return new Node('planning').with(token.data)
}

function parseDrawer() {
  const begin = this.next()
  var lines = []
  while (this.hasNext()) {
    const t = this.next()
    if ( t.name === `headline` ) { return undefined }
    if (t.name === `drawer.end` ) {
      return new Node('drawer').with({ name: begin.data.type, value: lines.join(`\n`) })
    }
    lines.push(t.raw)
  }
  return undefined
}

function process(token, section) {
  if (section.type === `footnote.definition`) return section // headline breaks footnote
  const { level, keyword, priority, tags, content } = token.data
  const currentLevel = section.level || 0
  if (level <= currentLevel) { return section }
  this.consume()
  const text = inlineParse(content)
  var headline = new Node('headline', text).with({
    level, keyword, priority, tags
  })
  const planning = this.tryTo(parsePlanning)
  if (planning) {
    headline.push(planning)
  }

  while (this.hasNext() && this.peek().name === `drawer.begin`) {
    let drawer = this.tryTo(parseDrawer)
    if (!drawer) { // broken drawer
      this.downgradeToLine(this.cursor + 1)
      break
    }
    headline.push(drawer)
  }
  const newSection = new Node(`section`).with({ level })
  newSection.push(headline)
  section.push(this.parseSection(this.unagi(newSection)))
  this._aks = {}
  return this.parseSection(section)
}

module.exports = process

},{"../inline":3,"../node":5}],11:[function(require,module,exports){
const Node = require('../node')

function process(token, section) {
  this.consume()
  section.push(new Node(`horizontalRule`))
  this._aks = {}
  return this.parseSection(section)
}

module.exports = process

},{"../node":5}],12:[function(require,module,exports){
const keyword = require('./keyword')
const headline = require('./headline')
const line = require('./line')
const block = require('./block')
const list = require('./list')
const table = require('./table')
const horizontalRule = require('./horizontal-rule')
const footnote = require('./footnote')
const blank = require('./blank')

module.exports = {
  keyword,
  headline,
  line,
  "block.begin": block,
  "list.item": list,
  "table.row": table,
  horizontalRule,
  footnote,
  blank,
}

},{"./blank":7,"./block":8,"./footnote":9,"./headline":10,"./horizontal-rule":11,"./keyword":13,"./line":14,"./list":15,"./table":16}],13:[function(require,module,exports){
const Node = require('../node')

function process(token, section) {
  const { key, value } = token.data
  switch (key) {
  case `TODO`:
    if (section.type !== `root`) break
    const todos = value.split(/\s|\|/g).filter(String)
    section.meta.todos = todos
    this.lexer.updateTODOs(todos)
    break
  case `HTML`:
    section.push(new Node(`html`).with({ value }))
    break
  case `CAPTION`:
  case `HEADER`:
  case `NAME`:
  case `PLOT`:
  case `RESULTS`:
    this._aks[key] = value
    break
  default:
    if (section.type === `root`) {
      let field = key.toLowerCase()
        if (!section.meta[field]) {
          section.meta[field] = value;
        }
        else {
          if (!Array.isArray(section.meta[field])) {
            let list = [];
            list.push(section.meta[field])
            section.meta[field] = list
          }
          section.meta[field].push(value)
        }
    }
    break
  }
  this.consume()
  return this.parseSection(section)
}

module.exports = process

},{"../node":5}],14:[function(require,module,exports){
const Node = require('../node')
const inlineParse = require('../inline').parse

function process(token, section) {

  var nodes = []
  while (this.hasNext()) {
    const token = this.peek()
    // also eats broken block/drawer ends
    if (![`line`, `block.end`, `drawer.end`].includes(token.name)) break
    this.consume()
    push(token.raw.trim())
  }
  section.push(new Node(`paragraph`, nodes))

  this._aks = {}
  return this.parseSection(section)

  function push(line) {
    let newNodes = inlineParse(line)
    // merge text newNodes
    if (nodes.length > 0 &&
        nodes[nodes.length - 1].type === `text` &&
        newNodes.length > 0 &&
        newNodes[0].type === `text`) {
      const n = newNodes.shift()
      let last = nodes.pop()
      last.value = `${last.value} ${n.value}`
      nodes.push(last)
    }

    nodes = [...nodes, ...newNodes]
  }
}

module.exports = process

},{"../inline":3,"../node":5}],15:[function(require,module,exports){
const Node = require('../node')
const inlineParse = require('../inline').parse

function process(token, section) {

  var self = this

  const parseListItem = () => {
    const { indent, content, ordered, checked } = self.next().data
    var lines = [content]
    const item = new Node(`list.item`).with({ ordered })
    if (checked !== undefined) {
      item.checked = checked
    }
    while (self.hasNext()) {
      const { name, raw } = self.peek()
      if (name !== `line`) break
      const lineIndent = raw.search(/\S/)
      if (lineIndent <= indent) break
      lines.push(self.next().raw.trim())
    }
    item.push(inlineParse(lines.join(` `)))
    return item
  }

  const parseList = level => {
    const list = new Node(`list`)
    while (self.hasNext()) {
      const token = self.peek()
      if ( token.name !== `list.item` ) break
      const { indent } = token.data
      if (indent <= level) break
      const item = parseListItem()
      item.push(parseList(indent))
      list.push(item)
    }
    if (list.children.length > 0) { // list
      list.ordered = list.children[0].ordered
      return list
    }
    return undefined
  }

  section.push(this.unagi(parseList(-1)))
  this._aks = {}
  return this.parseSection(section)
}

module.exports = process

},{"../inline":3,"../node":5}],16:[function(require,module,exports){
const Node = require('../node')
const inlineParse = require('../inline').parse

function process(token, section) {

  var self = this

  const parseTable = () => {
    const table = new Node(`table`)
    while (self.hasNext()) {
      const token = self.peek()
      if ( !token.name.startsWith(`table.`) ) break
      self.consume()
      if (token.name === `table.separator`) {
        table.push(new Node(`table.separator`))
        continue
      }
      if ( token.name !== `table.row` ) break
      const cells = token.data.cells.map(c => new Node(`table.cell`, inlineParse(c)))
      const row = new Node(`table.row`, cells)
      table.push(row)
    }
    return table
  }

  const table = this.unagi(parseTable())
  section.push(table)

  return this.parseSection(section)
}

module.exports = process

},{"../inline":3,"../node":5}],17:[function(require,module,exports){
const URL_PATTERN = /(?:([a-z][a-z0-9+.-]*):)?(.*)/

function parse(link) {
  var result = { raw: link }
  const m = URL_PATTERN.exec(link)
  if (!m) return result
  result.protocol = (m[1] || (isFilePath(m[2]) ? `file` : `internal`)).toLowerCase()
  result.location = m[2]
  return processFilePath(result)

  function isFilePath(str) {
    return str.match(/^\.{0,2}\//)
  }
}

function processFilePath(link) {
  if (link.protocol !== `file`) return link
  // const pattern = /([^:]*?)(?:::(.*))?/
  const pattern = /(.*?)::(.*)/
  const m = pattern.exec(link.location)
  if (!m) return link
  if (m[2]) {
    link.location = m[1]
    link.query = processQuery(m[2])
  }
  return link
}

function processQuery(q) {
  const ln = parseInt(q)
  if (ln) {
    return { ln }
  }
  if (q.startsWith(`*`)) {
    const headline = q.replace(/^\*+/, '')
    return { headline }
  }
  return { text: q }
}

module.exports = parse

},{}],18:[function(require,module,exports){
var matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g

function escape(str) {
  if (typeof str !== 'string') {
    throw new TypeError('Expected a string')
  }
  return str.replace(matchOperatorsRe, '\\$&')
}

module.exports = { escape }

},{}],19:[function(require,module,exports){

var { parse } = require('orga');
console.log(parse("* TODO remember the milk    :shopping:"));

window.orgaparse = function(foo){return parse(foo);};
},{"orga":2}]},{},[19]);
