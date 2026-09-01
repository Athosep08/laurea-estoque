import '@testing-library/jest-dom/vitest';

// jsdom não implementa <dialog> (showModal/close). Nosso Dialog.tsx depende
// desses métodos nativos; este polyfill mínimo é só para o ambiente de teste,
// o navegador real já tem o comportamento completo.
type DialogLike = HTMLElement & { open?: boolean };

if (!('showModal' in HTMLElement.prototype)) {
  Object.defineProperties(HTMLElement.prototype, {
    showModal: {
      configurable: true,
      value(this: DialogLike) {
        this.open = true;
        this.setAttribute('open', '');
      },
    },
    close: {
      configurable: true,
      value(this: DialogLike) {
        this.open = false;
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      },
    },
  });
}
