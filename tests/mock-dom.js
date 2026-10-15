/**
 * Lightweight mock DOM parser and node tree for headless testing of ContineoAdapter.
 * Pure JavaScript, zero external dependencies.
 */

class MockEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.bubbles = !!init.bubbles;
    this.cancelable = !!init.cancelable;
  }
}

class MockElement {
  constructor(tagName, attrs = {}) {
    this.tagName = (tagName || 'div').toUpperCase();
    this.attributes = { ...attrs };
    this.children = [];
    this.parentNode = null;
    this.ownerDocument = null;
    this.eventListeners = {};
    this.value = attrs.value || '';
    this.selectedIndex = 0;
    this.options = [];
    this.disabled = false;
    this.readOnly = false;
    this.style = {};
    this.offsetParent = {};
  }

  get id() { return this.attributes.id || ''; }
  set id(val) { this.attributes.id = val; }

  get name() { return this.attributes.name || ''; }
  set name(val) { this.attributes.name = val; }

  get type() { return this.attributes.type || 'text'; }
  set type(val) { this.attributes.type = val; }

  get placeholder() { return this.attributes.placeholder || ''; }
  set placeholder(val) { this.attributes.placeholder = val; }

  get className() { return this.attributes.class || ''; }
  set className(val) { this.attributes.class = val; }

  get textContent() {
    let text = this._text || '';
    for (const child of this.children) {
      text += child.textContent;
    }
    return text;
  }
  set textContent(val) {
    this._text = val;
    this.children = [];
  }

  get innerText() { return this.textContent; }
  set innerText(val) { this.textContent = val; }

  getAttribute(name) {
    return this.attributes[name] !== undefined ? this.attributes[name] : null;
  }

  setAttribute(name, val) {
    this.attributes[name] = val;
    if (name === 'value') this.value = val;
  }

  appendChild(child) {
    child.parentNode = this;
    child.ownerDocument = this.ownerDocument;
    this.children.push(child);
    if (this.tagName === 'SELECT' && child.tagName === 'OPTION') {
      this.options.push(child);
    }
    return child;
  }

  addEventListener(type, handler) {
    if (!this.eventListeners[type]) this.eventListeners[type] = [];
    this.eventListeners[type].push(handler);
  }

  dispatchEvent(evt) {
    const list = this.eventListeners[evt.type] || [];
    for (const fn of list) {
      fn.call(this, evt);
    }
    return true;
  }

  focus() {
    this.dispatchEvent(new MockEvent('focus'));
  }

  click() {
    this.dispatchEvent(new MockEvent('click'));
  }

  matches(selector) {
    const sel = selector.trim();
    if (sel.includes(',')) {
      return sel.split(',').some(s => this.matches(s.trim()));
    }

    // Match attribute patterns like input[placeholder*='id' i]
    const attrMatch = sel.match(/^([a-zA-Z0-9_-]*)\[([a-zA-Z0-9_-]+)([\*\^]?=)['"]?([^'"\]]+)['"]?\s*([iI])?\]$/);
    if (attrMatch) {
      const [, tag, attrName, op, val, flag] = attrMatch;
      if (tag && this.tagName.toLowerCase() !== tag.toLowerCase()) return false;
      const actualVal = this.getAttribute(attrName) || this[attrName] || '';
      const compareActual = flag ? actualVal.toLowerCase() : actualVal;
      const compareTarget = flag ? val.toLowerCase() : val;

      if (op === '*=') return compareActual.includes(compareTarget);
      if (op === '^=') return compareActual.startsWith(compareTarget);
      return compareActual === compareTarget;
    }

    // ID selector #foo
    if (sel.startsWith('#')) {
      return this.id === sel.slice(1);
    }

    // Class selector .bar
    if (sel.startsWith('.')) {
      return this.className.split(/\s+/).includes(sel.slice(1));
    }

    // Tag with #id, e.g. input#username
    if (sel.includes('#')) {
      const [tag, id] = sel.split('#');
      return (!tag || this.tagName.toLowerCase() === tag.toLowerCase()) && this.id === id;
    }

    // Tag with .class, e.g. input.cn-login-btn
    if (sel.includes('.')) {
      const [tag, cls] = sel.split('.');
      return (!tag || this.tagName.toLowerCase() === tag.toLowerCase()) &&
        this.className.split(/\s+/).includes(cls);
    }

    // Tag name
    return this.tagName.toLowerCase() === sel.toLowerCase();
  }

  querySelector(selector) {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }

  querySelectorAll(selector) {
    const results = [];
    const traverse = (node) => {
      for (const child of node.children) {
        if (child.matches(selector)) {
          results.push(child);
        }
        traverse(child);
      }
    };
    traverse(this);
    return results;
  }
}

class MockDocument {
  constructor() {
    this.head = new MockElement('head');
    this.body = new MockElement('body');
    this.head.ownerDocument = this;
    this.body.ownerDocument = this;
    this.defaultView = {
      Event: MockEvent,
      HTMLInputElement: { prototype: { value: '' } },
      HTMLSelectElement: { prototype: {} },
      location: { href: 'https://student.bmsit.ac.in/parents/index.php' }
    };
  }

  get forms() {
    return this.querySelectorAll('form');
  }

  createElement(tagName) {
    const el = new MockElement(tagName);
    el.ownerDocument = this;
    return el;
  }

  createEvent() {
    return new MockEvent('custom');
  }

  getElementById(id) {
    return this.querySelector(`#${id}`);
  }

  querySelector(selector) {
    if (this.body && this.body.matches(selector)) return this.body;
    return this.body ? this.body.querySelector(selector) : null;
  }

  querySelectorAll(selector) {
    return this.body ? this.body.querySelectorAll(selector) : [];
  }
}

/**
 * Parses basic HTML tags from fixtures into a MockDocument
 */
function parseHTML(htmlString) {
  const doc = new MockDocument();
  let currentParent = doc.body;
  const stack = [doc.body];

  // Regex to match tags
  const tagRegex = /<(\/)?([a-zA-Z0-9-]+)([^>]*)>|([^<]+)/g;
  let match;

  while ((match = tagRegex.exec(htmlString)) !== null) {
    const [full, isClosing, tagName, attrString, textContent] = match;

    if (textContent) {
      const trimmed = textContent.trim();
      if (trimmed) {
        currentParent.appendChild(new MockElement('#text', { value: trimmed }));
        currentParent._text = (currentParent._text || '') + ' ' + trimmed;
      }
      continue;
    }

    if (isClosing) {
      if (stack.length > 1) {
        stack.pop();
        currentParent = stack[stack.length - 1];
      }
      continue;
    }

    // Opening tag
    const attrs = {};
    if (attrString) {
      const attrRegex = /([a-zA-Z0-9_-]+)(?:=['"]([^'"]*)['"])?/g;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(attrString)) !== null) {
        attrs[attrMatch[1].toLowerCase()] = attrMatch[2] !== undefined ? attrMatch[2] : true;
      }
    }

    const el = doc.createElement(tagName);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }

    currentParent.appendChild(el);

    // Self closing tags
    const isSelfClosing = ['input', 'img', 'br', 'hr', 'meta', 'link'].includes(tagName.toLowerCase()) ||
                          attrString.endsWith('/');
    if (!isSelfClosing) {
      stack.push(el);
      currentParent = el;
    }
  }

  return doc;
}

module.exports = {
  MockEvent,
  MockElement,
  MockDocument,
  parseHTML
};
