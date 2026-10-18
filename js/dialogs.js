/**
 * 影翻棋 · 弹窗与提示组件
 *
 * toast()      顶部轻提示，配「禁」「候」等小印
 * ask()        确认框（认输、求和），返回 Promise<boolean>
 * showResult() 胜负结果，附落梅飘落
 * openModal()  打开页面上已有的 <dialog>（规则卷轴）
 * initTabs()   标签页：点击或方向键切换
 */
(function (root) {
  'use strict';

  const ICONS = {
    flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  };

  const reduceMotion = () =>
    root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let uid = 0;

  // 小工具：创建元素。props 中 text 为文本，on* 为事件，其余作为属性
  function h(tag, props, children) {
    const el = document.createElement(tag);
    Object.entries(props || {}).forEach(([key, value]) => {
      if (value == null || value === false) return;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = value;
      else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
      else el.setAttribute(key, value === true ? '' : value);
    });
    (children || []).forEach((child) => child && el.append(child));
    return el;
  }

  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = ICONS[name];
    return svg;
  }

  function seal(text, tone, extraClass) {
    return h('span', {
      class: `seal${tone === 'ink' ? ' seal--ink' : ''}${extraClass ? ` ${extraClass}` : ''}`,
      'aria-hidden': 'true',
      text,
    });
  }

  // ===== 轻提示 =====
  let toastHost = null;

  /**
   * @param {string} text
   * @param {{ seal?: string, tone?: 'cinnabar' | 'ink', urgent?: boolean, duration?: number }} [options]
   */
  function toast(text, options) {
    const opts = Object.assign({ seal: '候', tone: 'ink', urgent: false, duration: 2600 }, options);
    if (!toastHost) {
      toastHost = h('div', { class: 'toasts', 'aria-live': 'polite' });
      document.body.append(toastHost);
    }
    // 同样的提示不重复叠加
    Array.from(toastHost.children).forEach((node) => {
      if (node.dataset.text === text) node.remove();
    });
    const node = h('div', { class: 'toast', role: opts.urgent ? 'alert' : null, 'data-text': text }, [
      seal(opts.seal, opts.tone),
      h('span', { text }),
    ]);
    toastHost.append(node);
    setTimeout(() => {
      node.classList.add('is-leaving');
      setTimeout(() => node.remove(), 220);
    }, opts.duration);
    return node;
  }

  // ===== 弹窗通用 =====
  function showDialog(dialog, onClose) {
    const opener = document.activeElement;
    dialog.addEventListener(
      'close',
      () => {
        if (onClose) onClose(dialog.returnValue);
        if (opener && typeof opener.focus === 'function' && opener.isConnected) opener.focus();
      },
      { once: true }
    );
    dialog.showModal();
  }

  /**
   * 打开页面上已有的 <dialog>；其中 [data-close] 的按钮负责关闭
   * @param {HTMLDialogElement} dialog
   */
  function openModal(dialog) {
    if (dialog.open) return;
    if (!dialog.dataset.bound) {
      dialog.dataset.bound = '1';
      dialog.querySelectorAll('[data-close]').forEach((button) =>
        button.addEventListener('click', () => dialog.close())
      );
      // 点击遮罩（对话框本身而非内容）关闭
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close();
      });
    }
    showDialog(dialog);
  }

  /**
   * 确认框
   * @param {{ title: string, text: string, mark: Node, cancel: string, confirm: string, confirmClass?: string }} options
   * @returns {Promise<boolean>}
   */
  function ask(options) {
    return new Promise((resolve) => {
      const id = `ask-${++uid}`;
      const dialog = h('dialog', {
        class: 'modal',
        role: 'alertdialog',
        'aria-labelledby': `${id}-title`,
        'aria-describedby': `${id}-text`,
      }, [
        h('div', { class: 'card ask' }, [
          h('div', { class: 'ask__head' }, [
            options.mark,
            h('h2', { class: 'ask__title', id: `${id}-title`, text: options.title }),
          ]),
          h('p', { class: 'ask__text', id: `${id}-text`, text: options.text }),
          h('div', { class: 'ask__actions' }, [
            h('button', { class: 'btn btn--soft', type: 'button', text: options.cancel, onclick: () => dialog.close('no') }),
            h('button', {
              class: `btn ${options.confirmClass || 'btn--primary'}`,
              type: 'button',
              text: options.confirm,
              onclick: () => dialog.close('yes'),
            }),
          ]),
        ]),
      ]);
      document.body.append(dialog);
      showDialog(dialog, (value) => {
        dialog.remove();
        resolve(value === 'yes');
      });
    });
  }

  // ===== 胜负结果 =====
  const PETAL_FLOWER =
    '<g fill="var(--c)"><circle cx="12" cy="4" r="4.5"/><circle cx="19.6" cy="9.5" r="4.5"/><circle cx="16.7" cy="18.5" r="4.5"/><circle cx="7.3" cy="18.5" r="4.5"/><circle cx="4.4" cy="9.5" r="4.5"/></g><circle cx="12" cy="12" r="2.4" fill="#F2D28A"/>';
  const PETAL_LEAF = '<path d="M2 12 C 8 4 18 4 22 12 C 18 20 8 20 2 12 Z" fill="var(--c)"/>';
  const PETAL_COLORS = ['#D2533C', '#E9A08E'];

  function petals() {
    const layer = h('div', { class: 'petals', 'aria-hidden': 'true' });
    const still = reduceMotion();
    const count = still ? 12 : 26;
    for (let i = 0; i < count; i++) {
      const flower = i % 3 === 0;
      const size = flower ? 16 + Math.random() * 10 : 12 + Math.random() * 8;
      const petal = h('span', { class: `petal${still ? ' petal--still' : ''}` });
      petal.style.setProperty('--x', `${Math.random() * 100}%`);
      petal.style.setProperty('--y', `${Math.random() * 100}%`);
      petal.style.setProperty('--size', `${size}px`);
      petal.style.setProperty('--dur', `${4.2 + Math.random() * 2.6}s`);
      petal.style.setProperty('--delay', `${Math.random() * 3.2}s`);
      petal.style.setProperty('--drift', `${(Math.random() - 0.5) * 220}px`);
      petal.style.setProperty('--spin', `${(Math.random() - 0.5) * 720}deg`);
      petal.style.setProperty('--c', PETAL_COLORS[i % 2]);
      petal.innerHTML = `<svg viewBox="0 0 24 24">${flower ? PETAL_FLOWER : PETAL_LEAF}</svg>`;
      layer.append(petal);
    }
    return layer;
  }

  /**
   * @param {{
   *   tone: 'red' | 'black' | 'draw',
   *   seal: string, title: string, text: string,
   *   move?: { from: HTMLElement, to: HTMLElement },
   *   onReplay: () => void
   * }} options
   */
  function showResult(options) {
    const id = `result-${++uid}`;
    const ink = options.tone !== 'red';
    let replay = false;

    const moveRow = options.move
      ? h('div', { class: 'result__move' }, [
          options.move.from,
          icon('arrow'),
          options.move.to,
          h('span', { class: 'result__move-label', text: '致胜一手' }),
        ])
      : null;

    const dialog = h('dialog', { class: 'modal result', 'aria-labelledby': `${id}-title`, 'aria-describedby': `${id}-text` }, [
      petals(),
      h('div', { class: 'card result__card' }, [
        h('div', { class: `seal seal--framed result__seal${ink ? ' seal--ink' : ''}`, 'aria-hidden': 'true' }, [
          h('span', { class: 'seal__v', text: options.seal }),
        ]),
        h('h2', { class: `result__title${options.tone === 'red' ? ' is-red' : ''}`, id: `${id}-title`, text: options.title }),
        h('p', { class: 'result__text', id: `${id}-text`, text: options.text }),
        moveRow,
        h('div', { class: 'result__actions' }, [
          h('button', { class: 'btn btn--outline', type: 'button', text: '回看棋盘', onclick: () => dialog.close() }),
          h('button', {
            class: 'btn btn--primary',
            type: 'button',
            text: '再来一局',
            autofocus: true,
            onclick: () => {
              replay = true;
              dialog.close();
            },
          }),
        ]),
      ]),
    ]);

    document.body.append(dialog);
    showDialog(dialog, () => {
      dialog.remove();
      if (replay) options.onReplay();
    });
    return dialog;
  }

  // ===== 标签页 =====
  function initTabs(tablist) {
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(tab, false));
      tab.addEventListener('keydown', (event) => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
        if (event.key === 'Home') select(tabs[0], true);
        else if (event.key === 'End') select(tabs[tabs.length - 1], true);
        else if (step) select(tabs[(index + step + tabs.length) % tabs.length], true);
        else return;
        event.preventDefault();
      });
    });
    select(tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0], false);
  }

  root.ShadowFlipUI = { h, icon, seal, toast, ask, showResult, openModal, initTabs };
})(window);
