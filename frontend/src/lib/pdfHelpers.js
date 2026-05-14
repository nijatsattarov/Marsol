// Centralised jsPDF helpers — embed Roboto so Azerbaijani diacritics
// (ə ş ı ğ ö ü ç İ Ə Ş Ç Ğ Ü Ö) render correctly. Without this jsPDF's
// default Helvetica font outputs garbage like "&S&a&h&Y" instead of "Sahə".

import { jsPDF } from 'jspdf';
import { ROBOTO_REGULAR_B64 } from './pdfFont';

/**
 * Create a jsPDF instance with Roboto pre-installed as the active font.
 * Call this instead of `new jsPDF(...)` directly.
 */
export function createUnicodePdf(options = {}) {
  const doc = new jsPDF(options);
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_B64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.setFont('Roboto');
  return doc;
}
