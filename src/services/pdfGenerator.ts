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
}

export const generatePermitPDF = (formData: PermitFormData): Blob => {
  const doc = new jsPDF();
  let yPos = 20;

  doc.setFontSize(18);
  doc.text('Permit to Work Request', 105, yPos, { align: 'center' });
  yPos += 15;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Project Details', 20, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.text(`Project Title: ${formData.projectTitle}`, 20, yPos);
  yPos += 8;
  doc.text(`Work Type: ${formData.workType}`, 20, yPos);
  yPos += 8;
  doc.text(`Site: ${formData.site}`, 20, yPos);
  yPos += 8;
  doc.text(`Date Needed: ${formData.dateNeeded}`, 20, yPos);
  yPos += 8;
  doc.text(`Expiry Date: ${formData.expiryDate}`, 20, yPos);
  yPos += 12;

  doc.setFont('helvetica', 'bold');
  doc.text('Requester Information', 20, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.text(`Requester Type: ${formData.requesterType}`, 20, yPos);
  yPos += 8;
  doc.text(`Name: ${formData.requesterName}`, 20, yPos);
  yPos += 8;
  doc.text(`Email: ${formData.requesterEmail}`, 20, yPos);
  yPos += 12;

  doc.setFont('helvetica', 'bold');
  doc.text('Work Description', 20, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  const workDescLines = doc.splitTextToSize(formData.workDescription, 170);
  doc.text(workDescLines, 20, yPos);
  yPos += workDescLines.length * 7 + 8;

  doc.setFont('helvetica', 'bold');
  doc.text('Safety Measures', 20, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  const safetyLines = doc.splitTextToSize(formData.safetyMeasures, 170);
  doc.text(safetyLines, 20, yPos);
  yPos += safetyLines.length * 7 + 12;

  if (formData.requiresSignature && formData.signatureDataUrl) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Signature', 20, yPos);
    yPos += 10;

    try {
      doc.addImage(formData.signatureDataUrl, 'PNG', 20, yPos, 80, 30);
      yPos += 35;
    } catch (error) {
      console.error('Error adding signature to PDF:', error);
    }

    if (formData.submitterName) {
      doc.setFont('helvetica', 'normal');
      doc.text(`Signed by: ${formData.submitterName}`, 20, yPos);
      yPos += 8;
    }

    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, yPos);
  }

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
