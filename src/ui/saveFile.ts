const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type SaveResult = 'downloaded' | 'shared' | 'cancelled';

/** iPhone/iPad (inclusive iPad que se apresenta como Mac). */
function isAppleMobile(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** App instalado na tela inicial (PWA), e não aberto no navegador. */
function isInstalledApp(): boolean {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/**
 * Entrega um arquivo gerado no aparelho. No iPhone com o app instalado na
 * tela inicial, baixar um arquivo gerado na hora não funciona de forma
 * confiável; lá o arquivo vai pelo menu de compartilhar do sistema (salvar em
 * Arquivos, mandar pelo WhatsApp...). No resto, é um download normal.
 */
export async function saveBlob(blob: Blob, fileName: string): Promise<SaveResult> {
  const file = new File([blob], fileName, { type: blob.type || XLSX_TYPE });

  if (isAppleMobile() && isInstalledApp() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Se o compartilhar falhar por outro motivo, ainda tenta o download.
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Dá tempo do navegador começar o download antes de liberar a memória.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
