/**
 * AETHER UI - Headless & Utility-First Interaction Controller
 * Version: 1.0.0
 * License: MIT
 */

const AetherUI = {
  config: {
    prefix: "aether",
    hiddenClass: "hidden",
    blockScrollClass: "overflow-hidden",
    themeStorageKey: "theme",
    domRefreshDebounce: 150,
    resizeDebounce: 300,
    syncUrl: true,
    debug: true,
  },

  state: {},
  openStack: [],
  initialized: false,
  observer: null,
  focusHandlers: new WeakMap(),
  _scrollbarWidth: undefined,
  _resizeHandler: null,
  _themeListener: null,
  _refreshDebounced: null,
  _pfx: "",

  log(type, msg, details = "") {
    if (!this.config.debug) return;
    const c = {
      info: "#3b82f6",
      success: "#10b981",
      warn: "#f59e0b",
      action: "#8b5cf6",
      error: "#ef4444",
    };
    console.log(
      `%c[AetherUI] ${msg}`,
      `color: ${c[type] || c.info}; font-weight: bold;`,
      details
    );
  },

  debounce(fn, wait = 100) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  },

  dispatch(el, eventName, detail = {}) {
    if (!el) return;
    const name = `${this.config.prefix}:${eventName}`;
    el.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
    this.log("action", `Event: ${name}`, el);
  },

  _sel(name, val = null) {
    return `[${this._pfx}-${name}${val ? `="${val}"` : ""}]`;
  },
  _attr(el, name) {
    return el.getAttribute(`${this._pfx}-${name}`);
  },
  _has(el, name) {
    return el.hasAttribute(`${this._pfx}-${name}`);
  },

  safeClassOp(el, classes, op) {
    if (!el || !classes || !classes.length) return;
    if (el.classList && typeof el.classList[op] === "function")
      el.classList[op](...classes);
  },

  getClasses(el, name) {
    return (this._attr(el, name) || "").trim().split(/\s+/).filter(Boolean);
  },

  getScopedChildren(parent, selector, group) {
    return Array.from(parent.querySelectorAll(selector)).filter(
      (el) => el.closest(group) === parent
    );
  },

  getAllTriggers(id) {
    return document.querySelectorAll(this._sel("target", id));
  },

  init(userConfig = {}) {
    if (this.initialized) return;
    this.config = { ...this.config, ...userConfig };
    this._pfx = `data-${this.config.prefix}`;

    try {
      this.handleGlobalClick = this.handleGlobalClick.bind(this);
      this.handleGlobalKey = this.handleGlobalKey.bind(this);
      this.handlePopstate = this.handlePopstate.bind(this);

      this._refreshDebounced = this.debounce(
        () => this.refreshDOM(),
        this.config.domRefreshDebounce
      );

      this.initTheme();
      this.bindEvents();
      this.refreshDOM();
      this.observeDOM();

      requestAnimationFrame(() => this.handleHashOnLoad());

      this._resizeHandler = this.debounce(() => {
        this._scrollbarWidth = undefined;
      }, this.config.resizeDebounce);
      window.addEventListener("resize", this._resizeHandler, {
        passive: true,
      });
      window.addEventListener("popstate", this.handlePopstate);

      this.initialized = true;
      this.log("success", "v1.0.0 Initialized");
    } catch (err) {
      console.error("AetherUI Init Failed:", err);
    }
  },

  destroy() {
    this.observer?.disconnect();
    this.unbindEvents();
    if (this._resizeHandler)
      window.removeEventListener("resize", this._resizeHandler);
    if (this._themeListener)
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .removeEventListener("change", this._themeListener);
    window.removeEventListener("popstate", this.handlePopstate);

    document.body.classList.remove(this.config.blockScrollClass);
    document.body.style.paddingRight = "";

    this.initialized = false;
    this.openStack = [];
    this.state = {};
    this.focusHandlers = new WeakMap();
    this._refreshDebounced = null;
  },

  applyStateClasses(el, isActive, manageVis = true) {
    const activeCls = this.getClasses(el, "active-class");
    const inactiveCls = this.getClasses(el, "inactive-class");

    if (isActive) {
      if (manageVis) el.classList.remove(this.config.hiddenClass);
      this.safeClassOp(el, inactiveCls, "remove");
      this.safeClassOp(el, activeCls, "add");
    } else {
      this.safeClassOp(el, activeCls, "remove");
      this.safeClassOp(el, inactiveCls, "add");

      const explicitHide = inactiveCls.includes(this.config.hiddenClass);
      if (manageVis && !explicitHide) el.classList.add(this.config.hiddenClass);
    }
  },

  open(id, triggerEl = null) {
    const el = document.getElementById(id);
    if (!el || this.state[id]) return;

    [...this.openStack].reverse().forEach((openId) => {
      const openEl = document.getElementById(openId);
      if (!openEl || openEl.contains(el)) return;
      if (
        !this._has(openEl, "scroll-lock") &&
        this._has(openEl, "click-outside")
      )
        this.close(openId);
    });

    this.getAllTriggers(id).forEach((t) => {
      t.setAttribute("aria-expanded", "true");
      this.applyStateClasses(t, true, false);
    });

    this.applyStateClasses(el, true, true);

    el.querySelectorAll(this._sel("active-class")).forEach((c) => {
      if (this._has(c, "click-outside") || this._has(c, "scroll-lock")) return;
      this.applyStateClasses(c, true, false);
    });

    this.state[id] = {
      clickOutside: this._has(el, "click-outside"),
      scrollLock: this._has(el, "scroll-lock"),
      trapFocus: this._has(el, "focus-trap"),
      returnFocusTo: triggerEl,
    };

    if (this.state[id].scrollLock) {
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      this.manageScrollLock();
    }

    this.openStack.push(id);
    this.dispatch(el, "open");
    if (this.config.syncUrl && this._has(triggerEl, "sync-url"))
      this.updateHash(id);

    if (this.state[id]?.trapFocus) this.trapFocus(el);
    else this.handleAutoFocus(el);
  },

  close(id) {
    const el = document.getElementById(id);
    const state = this.state[id];
    if (!state) return;

    this.openStack
      .filter((oid) => {
        const child = document.getElementById(oid);
        return child && el.contains(child) && oid !== id;
      })
      .forEach((cid) => this.close(cid));

    this.openStack = this.openStack.filter((i) => i !== id);

    if (el) {
      if (state.trapFocus) this.untrapFocus(el);
      this.applyStateClasses(el, false, true);

      el.querySelectorAll(this._sel("active-class")).forEach((c) =>
        this.applyStateClasses(c, false, false)
      );
      this.getAllTriggers(id).forEach((t) => {
        t.setAttribute("aria-expanded", "false");
        this.applyStateClasses(t, false, false);
      });
      if (state.scrollLock) el.removeAttribute("aria-modal");
      this.dispatch(el, "close");
      this.clearHash(id);
    }

    delete this.state[id];
    if (!this.openStack.some((oid) => this.state[oid]?.scrollLock))
      this.manageScrollLock();

    if (state.returnFocusTo && document.body.contains(state.returnFocusTo)) {
      requestAnimationFrame(() => {
        try {
          state.returnFocusTo.focus();
        } catch (e) {}
      });
    }
  },

  toggle(trigger, action) {
    const id = this._attr(trigger, "target");
    if (!id) return;
    const isExp = trigger.getAttribute("aria-expanded") === "true";
    const forceClose = action === "hide" || action === "close";
    const forceOpen = action === "show" || action === "open";
    const shouldOpen = forceOpen ? true : forceClose ? false : !isExp;

    if ((shouldOpen && isExp) || (!shouldOpen && !isExp)) return;
    shouldOpen ? this.open(id, trigger) : this.close(id);
  },

  manageScrollLock() {
    const hasLocks = Object.values(this.state).some((s) => s.scrollLock);
    const b = document.body;

    if (hasLocks && !b.classList.contains(this.config.blockScrollClass)) {
      if (document.documentElement.scrollHeight > window.innerHeight) {
        if (this._scrollbarWidth === undefined) {
          const outer = document.createElement("div");
          outer.style.cssText =
            "visibility:hidden;overflow:scroll;position:absolute;top:-9999px;width:100px;height:100px";
          document.body.appendChild(outer);
          this._scrollbarWidth = outer.offsetWidth - outer.clientWidth || 0;
          outer.remove();
        }
        b.style.paddingRight = `${this._scrollbarWidth}px`;
      }
      b.classList.add(this.config.blockScrollClass);
    } else if (!hasLocks) {
      b.classList.remove(this.config.blockScrollClass);
      b.style.paddingRight = "";
    }
  },

  handleAutoFocus(el) {
    const auto = el.querySelector(this._sel("autofocus"));
    if (auto)
      requestAnimationFrame(() => {
        try {
          auto.focus({ preventScroll: true });
        } catch (e) {}
      });
  },

  trapFocus(el) {
    const getFocusable = () =>
      Array.from(
        el.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        )
      ).filter((node) =>
        node.checkVisibility
          ? node.checkVisibility()
          : node.offsetParent !== null
      );

    const items = getFocusable();
    if (!items.length) {
      el.setAttribute("tabindex", "-1");
      el.focus();
      return;
    }

    try {
      (el.querySelector(this._sel("autofocus")) || items[0]).focus();
    } catch (e) {}

    const handler = (e) => {
      if (e.key !== "Tab") return;
      const cItems = getFocusable();
      if (!cItems.length) return;
      const first = cItems[0],
        last = cItems[cItems.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    this.focusHandlers.set(el, handler);
    el.addEventListener("keydown", handler);
  },

  untrapFocus(el) {
    const handler = this.focusHandlers.get(el);
    if (handler) {
      el.removeEventListener("keydown", handler);
      this.focusHandlers.delete(el);
    }
  },

  setTheme(t) {
    try {
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      if (t === "system") {
        if (window.matchMedia("(prefers-color-scheme: dark)").matches)
          root.classList.add("dark");
      } else root.classList.add(t);
      localStorage.setItem(this.config.themeStorageKey, t);
      this.dispatch(document, "theme-change", { theme: t });
    } catch (e) {}
  },

  initTheme() {
    this.setTheme(
      localStorage.getItem(this.config.themeStorageKey) || "system"
    );
    this._themeListener = () => {
      if (localStorage.getItem(this.config.themeStorageKey) === "system")
        this.setTheme("system");
    };
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", this._themeListener);
  },

  updateHash(id) {
    if (this.config.syncUrl && id) history.replaceState(null, null, `#${id}`);
  },

  clearHash(id) {
    if (this.config.syncUrl && window.location.hash === `#${id}`)
      history.replaceState(
        null,
        null,
        window.location.pathname + window.location.search
      );
  },

  handlePopstate() {
    const hash = window.location.hash.substring(1);
    if (!hash) {
      const last = this.openStack[this.openStack.length - 1];
      if (last) this.close(last);
    } else this.handleHashOnLoad();
  },

  handleHashOnLoad() {
    if (!this.config.syncUrl) return;
    const hash = window.location.hash.substring(1);
    const target = document.getElementById(hash);
    if (!target) return;

    if (this._attr(target, "ui") === "tab-panel") {
      const group = target.closest(this._sel("ui", "tab-group"));
      if (group && this._has(group, "sync-url")) {
        const trigger = group.querySelector(
          `${this._sel("trigger", "tab")}${this._sel("target", hash)}`
        );
        if (trigger) this.activateTab(trigger, true);
      }
      return;
    }

    if (
      (this._has(target, "ui") ||
        this._has(target, "scroll-lock") ||
        this._has(target, "click-outside")) &&
      !this.state[hash]
    )
      this.open(hash);
  },

  observeDOM() {
    if (this.observer) return;
    this.observer = new MutationObserver((mutations) => {
      if (mutations.some((m) => m.removedNodes.length > 0)) this.cleanState();
      const shouldRefresh = mutations.some(
        (m) =>
          m.type === "childList" ||
          (m.type === "attributes" && m.attributeName.startsWith(this._pfx))
      );
      if (shouldRefresh && this._refreshDebounced) this._refreshDebounced();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        `${this._pfx}-ui`,
        `${this._pfx}-trigger`,
        `${this._pfx}-target`,
        `${this._pfx}-default-open`,
      ],
    });
  },

  cleanState() {
    if (!this.openStack.length) return;
    let hadScrollLock = false;
    this.openStack = this.openStack.filter((id) => {
      if (!document.getElementById(id) && this.state[id]) {
        if (this.state[id].scrollLock) hadScrollLock = true;
        delete this.state[id];
        return false;
      }
      return true;
    });
    if (hadScrollLock) this.manageScrollLock();
  },

  refreshDOM() {
    this.setupAccessibility();
    this.initTabs();
    this.initAccordions();
  },

  initTabs() {
    document
      .querySelectorAll(`${this._sel("ui", "tab-group")}:not([data-init])`)
      .forEach((g) => {
        const triggers = this.getScopedChildren(
          g,
          this._sel("trigger", "tab"),
          this._sel("ui", "tab-group")
        );
        const panels = this.getScopedChildren(
          g,
          this._sel("ui", "tab-panel"),
          this._sel("ui", "tab-group")
        );
        const def =
          triggers.find((t) => this._has(t, "default-open")) || triggers[0];
        const activeId = def ? this._attr(def, "target") : null;

        panels.forEach((p) => {
          p.setAttribute("role", "tabpanel");
          p.id !== activeId
            ? (p.classList.add(this.config.hiddenClass),
              p.setAttribute("aria-hidden", "true"))
            : p.setAttribute("aria-hidden", "false");
        });
        triggers.forEach((t) => {
          t.setAttribute("role", "tab");
          t.setAttribute("aria-selected", "false");
          t.setAttribute("tabindex", "-1");
        });
        if (def) this.activateTab(def, true);
        g.setAttribute("data-init", "true");
      });
  },

  activateTab(t, skip = false) {
    const g = t.closest(this._sel("ui", "tab-group"));
    const id = this._attr(t, "target");
    if (!g || !id) return;
    const triggers = this.getScopedChildren(
      g,
      this._sel("trigger", "tab"),
      this._sel("ui", "tab-group")
    );
    const panels = this.getScopedChildren(
      g,
      this._sel("ui", "tab-panel"),
      this._sel("ui", "tab-group")
    );

    triggers.forEach((b) => {
      b.setAttribute("aria-selected", "false");
      b.setAttribute("tabindex", "-1");
      this.applyStateClasses(b, false, false);
    });
    panels.forEach((p) => {
      this.applyStateClasses(p, false, true);
      p.setAttribute("aria-hidden", "true");
    });

    t.setAttribute("aria-selected", "true");
    t.setAttribute("tabindex", "0");
    this.applyStateClasses(t, true, false);
    const active = panels.find((p) => p.id === id);
    if (active) {
      this.applyStateClasses(active, true, true);
      active.setAttribute("aria-hidden", "false");
      this.dispatch(active, "tab-change", { id });
      this.handleAutoFocus(active);
      if (this.config.syncUrl && this._has(g, "sync-url")) this.updateHash(id);
    }
  },

  initAccordions() {
    document
      .querySelectorAll(
        `${this._sel("ui", "accordion-group")}:not([data-init])`
      )
      .forEach((g) => {
        const triggers = this.getScopedChildren(
          g,
          this._sel("trigger", "accordion"),
          this._sel("ui", "accordion-group")
        );
        const defs = triggers.filter((t) => this._has(t, "default-open"));
        const panels = this.getScopedChildren(
          g,
          this._sel("ui", "accordion-panel"),
          this._sel("ui", "accordion-group")
        );
        const ids = defs.map((t) => this._attr(t, "target"));

        panels.forEach((p) => {
          ids.includes(p.id)
            ? p.setAttribute("aria-hidden", "false")
            : (p.classList.add(this.config.hiddenClass),
              p.setAttribute("aria-hidden", "true"));
        });
        triggers.forEach((t) => {
          t.setAttribute("role", "button");
          t.setAttribute("aria-expanded", defs.includes(t) ? "true" : "false");
          const target = this._attr(t, "target");
          if (target) t.setAttribute("aria-controls", target);
        });
        defs.forEach((t) => this.toggleAccordion(t, true, true));
        g.setAttribute("data-init", "true");
      });
  },

  toggleAccordion(t, force, skip = false) {
    const g = t.closest(this._sel("ui", "accordion-group"));
    if (!g) return;
    const id = this._attr(t, "target");
    const p = this.getScopedChildren(
      g,
      `${this._sel("ui", "accordion-panel")}[id="${id}"]`,
      this._sel("ui", "accordion-group")
    )[0];
    if (!p) return;

    const isExpanded = t.getAttribute("aria-expanded") === "true";
    const active = force ?? !isExpanded;
    if (active === isExpanded) return;

    if (active && !this._has(g, "allow-multiple")) {
      this.getScopedChildren(
        g,
        `${this._sel("trigger", "accordion")}[aria-expanded="true"]`,
        this._sel("ui", "accordion-group")
      )
        .filter((ot) => ot !== t)
        .forEach((ot) => {
          ot.setAttribute("aria-expanded", "false");
          this.applyStateClasses(ot, false, false);
          const op = document.getElementById(this._attr(ot, "target"));
          if (op) {
            this.applyStateClasses(op, false, true);
            op.setAttribute("aria-hidden", "true");
          }
        });
    }

    t.setAttribute("aria-expanded", active);
    this.applyStateClasses(t, active, false);
    this.applyStateClasses(p, active, true);
    p.setAttribute("aria-hidden", !active);
    if (active) {
      this.dispatch(p, "accordion-open");
      this.handleAutoFocus(p);
    }
  },

  setupAccessibility() {
    document
      .querySelectorAll(this._sel("ui", "tab-group"))
      .forEach((g) => g.setAttribute("role", "tablist"));
  },

  handleGlobalClick(e) {
    if (e.target.closest(this._sel("theme")))
      return this.setTheme(
        e.target.closest(this._sel("theme")).getAttribute(`${this._pfx}-theme`)
      );

    const tr = e.target.closest(this._sel("trigger"));
    if (tr) {
      if (tr.tagName === "A") e.preventDefault();
      const type = this._attr(tr, "trigger");
      const act = this._attr(tr, "action") || "toggle";

      if (act === "remove") {
        const targetEl = document.getElementById(this._attr(tr, "target"));
        if (targetEl) targetEl.remove();
        return;
      }

      if (type === "ui-control") this.toggle(tr, act);
      else if (type === "tab") this.activateTab(tr);
      else if (type === "accordion") this.toggleAccordion(tr);
      return;
    }

    const last = this.openStack[this.openStack.length - 1];
    if (!last || !document.getElementById(last)) {
      this.cleanState();
      return;
    }

    const el = document.getElementById(last);
    if (
      this.state[last].clickOutside &&
      el &&
      !el.contains(e.target) &&
      !e.target.closest(`${this._sel("trigger")}${this._sel("target", last)}`)
    ) {
      this.close(last);
    }
  },

  handleGlobalKey(e) {
    if (e.key === "Escape") {
      const last = this.openStack[this.openStack.length - 1];
      if (
        last &&
        (this.state[last].clickOutside || this.state[last].scrollLock)
      ) {
        e.preventDefault();
        this.close(last);
      }
    }

    const moveFocus = (items, cur) => {
      const idx = items.indexOf(cur),
        max = items.length - 1;
      let n = null;
      if (["ArrowRight", "ArrowDown"].includes(e.key))
        n = idx >= max ? 0 : idx + 1;
      else if (["ArrowLeft", "ArrowUp"].includes(e.key))
        n = idx <= 0 ? max : idx - 1;
      else if (e.key === "Home") n = 0;
      else if (e.key === "End") n = max;

      if (n !== null) {
        e.preventDefault();
        items[n].focus();
        return items[n];
      }
    };

    const tab = e.target.closest('[role="tab"]');
    const acc = e.target.closest(this._sel("trigger", "accordion"));

    if (tab) {
      const items = this.getScopedChildren(
        tab.closest('[role="tablist"]'),
        '[role="tab"]:not([disabled])',
        '[role="tablist"]'
      );
      const next = moveFocus(items, tab);
      if (next) this.activateTab(next);
    } else if (acc) {
      const items = this.getScopedChildren(
        acc.closest(this._sel("ui", "accordion-group")),
        `${this._sel("trigger", "accordion")}:not([disabled])`,
        this._sel("ui", "accordion-group")
      );
      moveFocus(items, acc);
    } else if (["Enter", " "].includes(e.key)) {
      const t = e.target.closest(this._sel("trigger"));
      if (t && t.tagName !== "BUTTON") {
        e.preventDefault();
        t.click();
      }
    }
  },

  bindEvents() {
    document.addEventListener("click", this.handleGlobalClick);
    document.addEventListener("keydown", this.handleGlobalKey);
  },
  unbindEvents() {
    document.removeEventListener("click", this.handleGlobalClick);
    document.removeEventListener("keydown", this.handleGlobalKey);
  },
};

(function (root, factory) {
  if (typeof define === "function" && define.amd) define([], factory);
  else if (typeof module === "object" && module.exports)
    module.exports = factory();
  else root.AetherUI = factory();
})(typeof self !== "undefined" ? self : this, function () {
  if (typeof document !== "undefined") {
    const autoInit = () => {
      if (
        document.body &&
        document.body.hasAttribute(`data-${AetherUI.config.prefix}-auto`)
      )
        AetherUI.init();
    };
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", autoInit)
      : autoInit();
  }
  return AetherUI;
});
