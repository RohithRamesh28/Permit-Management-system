import { jsPDF } from 'jspdf';

export interface PermitFormData {
  projectTitle: string;
  workType: string;
  requesterType: string;
  requesterName: string;
  requesterEmail: string;
  site: string;
  dateNeeded: string;
  expiryDate: string;
  workDescription: string;
  safetyMeasures: string;
  requiresSignature: boolean;
  signatureDataUrl?: string;
  submitterName?: string;
  permitId?: string;
  status?: string;
}

const ONTIVITY_BLUE = '#0072BC';
const LIGHT_GRAY = '#F3F4F6';
const DARK_GRAY = '#374151';
const BORDER_GRAY = '#D1D5DB';

export const generatePermitPDF = (formData: PermitFormData): Blob => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  const addHeader = () => {
    doc.setFillColor(ONTIVITY_BLUE);
    doc.rect(0, 0, pageWidth, 35, 'F');

    try {
      const logoImg = new Image();
      logoImg.src = '/image_(6).png';
      doc.addImage(logoImg, 'PNG', margin, 8, 50, 18);
    } catch (error) {
      console.error('Error loading logo:', error);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('PERMIT TO WORK', pageWidth - margin, 20, { align: 'right' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Request Form', pageWidth - margin, 27, { align: 'right' });
  };

  const addFooter = () => {
    doc.setFillColor(LIGHT_GRAY);
    doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');

    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const footerText = 'LOCAL CONNECTIONS | NATIONAL SOLUTIONS';
    doc.text(footerText, pageWidth / 2, pageHeight - 7, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  };

  const drawBox = (x: number, y: number, width: number, height: number, fill = false) => {
    if (fill) {
      doc.setFillColor(LIGHT_GRAY);
      doc.rect(x, y, width, height, 'F');
    }
    doc.setDrawColor(BORDER_GRAY);
    doc.setLineWidth(0.3);
    doc.rect(x, y, width, height);
  };

  const addSectionHeader = (title: string, y: number): number => {
    doc.setFillColor(ONTIVITY_BLUE);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 2, y + 5.5);
    return y + 8;
  };

  const addField = (label: string, value: string, x: number, y: number, width: number): number => {
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(label.toUpperCase(), x + 2, y + 4);

    doc.setTextColor(DARK_GRAY);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(value || 'N/A', width - 4);
    doc.text(lines, x + 2, y + 8);

    const fieldHeight = Math.max(10, lines.length * 5 + 6);
    drawBox(x, y, width, fieldHeight);

    return y + fieldHeight;
  };

  const addTextArea = (label: string, value: string, x: number, y: number, width: number): number => {
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(label.toUpperCase(), x + 2, y + 4);

    doc.setTextColor(DARK_GRAY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(value || 'N/A', width - 4);
    const textHeight = lines.length * 4.5;
    doc.text(lines, x + 2, y + 9);

    const fieldHeight = Math.max(20, textHeight + 12);
    drawBox(x, y, width, fieldHeight);

    return y + fieldHeight;
  };

  addHeader();

  let yPos = 42;

  if (formData.permitId || formData.status) {
    const infoBoxY = yPos;
    const infoBoxHeight = 12;
    doc.setFillColor(LIGHT_GRAY);
    doc.rect(margin, infoBoxY, contentWidth, infoBoxHeight, 'F');

    doc.setTextColor(DARK_GRAY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    if (formData.permitId) {
      doc.text(`Permit ID: ${formData.permitId}`, margin + 2, infoBoxY + 5);
    }

    if (formData.status) {
      const statusColor = formData.status === 'Approved' ? '#059669' : formData.status === 'Rejected' ? '#DC2626' : '#F59E0B';
      doc.setTextColor(statusColor);
      doc.setFont('helvetica', 'bold');
      doc.text(`Status: ${formData.status}`, pageWidth - margin - 2, infoBoxY + 5, { align: 'right' });
    }

    yPos += infoBoxHeight + 3;
  }

  yPos = addSectionHeader('REQUESTER INFORMATION', yPos);
  yPos += 1;

  const col1Width = contentWidth / 2 - 1;
  const col2X = margin + col1Width + 2;

  let tempY = addField('Requester Name', formData.requesterName, margin, yPos, col1Width);
  addField('Requester Email', formData.requesterEmail, col2X, yPos, col1Width);
  yPos = tempY + 2;

  yPos = addSectionHeader('PROJECT DETAILS', yPos);
  yPos += 1;

  tempY = addField('Project Title / Job Number', formData.projectTitle, margin, yPos, col1Width);
  addField('Work Type', formData.workType, col2X, yPos, col1Width);
  yPos = tempY + 2;

  tempY = addField('Site Location', formData.site, margin, yPos, col1Width);
  addField('Requester Type', formData.requesterType || 'Internal', col2X, yPos, col1Width);
  yPos = tempY + 2;

  tempY = addField('Date Needed', formData.dateNeeded, margin, yPos, col1Width);
  addField('Expiry Date', formData.expiryDate || 'N/A', col2X, yPos, col1Width);
  yPos = tempY + 2;

  yPos = addSectionHeader('WORK DESCRIPTION', yPos);
  yPos += 1;
  yPos = addTextArea('Detailed Scope of Work', formData.workDescription, margin, yPos, contentWidth);
  yPos += 2;

  yPos = addSectionHeader('SAFETY MEASURES', yPos);
  yPos += 1;
  yPos = addTextArea('Safety Precautions & Requirements', formData.safetyMeasures, margin, yPos, contentWidth);
  yPos += 4;

  if (formData.requiresSignature && formData.signatureDataUrl) {
    yPos = addSectionHeader('AUTHORIZATION & SIGNATURE', yPos);
    yPos += 2;

    drawBox(margin, yPos, contentWidth, 35);

    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('SIGNATURE:', margin + 2, yPos + 4);

    try {
      doc.addImage(formData.signatureDataUrl, 'PNG', margin + 4, yPos + 6, 60, 20);
    } catch (error) {
      console.error('Error adding signature to PDF:', error);
    }

    doc.setDrawColor(BORDER_GRAY);
    doc.setLineWidth(0.5);
    doc.line(margin + 70, yPos + 28, margin + 120, yPos + 28);

    doc.setTextColor(DARK_GRAY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Signed by: ${formData.submitterName || formData.requesterName}`, margin + 70, yPos + 32);

    doc.line(margin + 125, yPos + 28, pageWidth - margin, yPos + 28);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, margin + 125, yPos + 32);

    yPos += 35;
  } else if (formData.requiresSignature) {
    yPos = addSectionHeader('AUTHORIZATION & SIGNATURE', yPos);
    yPos += 2;

    drawBox(margin, yPos, contentWidth, 25);

    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('Signature Required - Awaiting Authorization', margin + 2, yPos + 8);

    doc.setDrawColor(BORDER_GRAY);
    doc.setLineWidth(0.5);
    doc.line(margin + 4, yPos + 18, margin + 80, yPos + 18);
    doc.text('Authorized Signature', margin + 4, yPos + 22);

    doc.line(margin + 90, yPos + 18, pageWidth - margin - 4, yPos + 18);
    doc.text('Date', margin + 90, yPos + 22);
  }

  addFooter();

  return doc.output('blob');
};

export const downloadPDF = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
