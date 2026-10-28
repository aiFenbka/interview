'use strict';
(() => {
  window.renderAnswer = text => {
    const html = window.marked.parse(String(text), { gfm: true, breaks: true });
    const fragment = window.DOMPurify.sanitize(html, {
      RETURN_DOM_FRAGMENT: true,
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'del', 'ul', 'ol', 'li', 'pre', 'code', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a'],
      ALLOWED_ATTR: ['class', 'start'],
      ALLOW_DATA_ATTR: false,
      ALLOW_ARIA_ATTR: false
    });
    for (const code of fragment.querySelectorAll('pre > code')) {
      const language = /(?:^|\s)language-([\w+-]+)/.exec(code.className)?.[1];
      if (language && window.hljs.getLanguage(language)) {
        const highlighted = window.hljs.highlight(code.textContent, { language, ignoreIllegals: true }).value;
        code.innerHTML = window.DOMPurify.sanitize(highlighted, { ALLOWED_TAGS: ['span'], ALLOWED_ATTR: ['class'] });
        code.classList.add('hljs');
      }
    }
    document.getElementById('answer').replaceChildren(fragment);
  };
})();
