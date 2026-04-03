import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';

export interface PermitFormData {
  requestor: string;
  requester_type: string;
  requester_email?: string;
  date_of_request: string;
  ontivity_project_number: string;
  performing_entity: string;
  date_of_project_commencement: string;
  estimated_date_of_completion: string;
  type_of_permit: string;
  utility_provider?: string;
  state: string;
  permit_jurisdiction?: string;
  permit_jurisdiction_type?: string;
  county_or_parish?: string;
  city?: string;
  land_owner?: string;
  tower_owner?: string;
  end_customer: string;
  project_value: string;
  actual_date_of_completion?: string;
  permit_validity?: string;
  detailed_sow: string;
  requiresSignature: boolean;
  signatureDataUrl?: string;
  permitId?: string;
  status?: string;
  signerName?: string;
  approvedBy?: string;
  approvedAt?: string;
  qp_name?: string;
  qp_email?: string;
  qp_approved_at?: string;
  approver_name?: string;
  approver_email?: string;
  approver_approved_at?: string;
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
    doc.setFillColor(243, 244, 246);
    doc.rect(0, 0, pageWidth, 20, 'F');

    doc.setFillColor(239, 246, 255);
    doc.rect(pageWidth / 2, 0, pageWidth / 2, 20, 'F');

    doc.setFillColor(ONTIVITY_BLUE);
    doc.rect(0, 20, pageWidth, 4, 'F');

    try {
      const logoImg = new Image();
      logoImg.src = '/image_(6).png';
      doc.addImage(logoImg, 'PNG', margin, 4, 40, 12);
    } catch (error) {
      console.error('Error loading logo:', error);
    }

    doc.setTextColor(100, 100, 100);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('DATE OF REQUEST', pageWidth - margin, 8, { align: 'right' });

    doc.setTextColor(DARK_GRAY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const formattedDate = new Date(formData.date_of_request).toLocaleDateString('en-US');
    doc.text(formattedDate, pageWidth - margin, 14, { align: 'right' });
  };

  const addFooter = () => {
    doc.setFillColor(LIGHT_GRAY);
    doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');

    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const footerText = '';
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

    const fieldHeight = Math.max(10, lines.length * 5.5 + 7);
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

  let yPos = 30;

  if (formData.ontivity_project_number || formData.status) {
    const infoBoxY = yPos;
    const infoBoxHeight = 12;
    doc.setFillColor(LIGHT_GRAY);
    doc.rect(margin, infoBoxY, contentWidth, infoBoxHeight, 'F');

    doc.setTextColor(DARK_GRAY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    if (formData.ontivity_project_number) {
      doc.text(`PERMIT-${formData.ontivity_project_number}`, margin + 2, infoBoxY + 5);
    }

    if (formData.status) {
      const statusColor = formData.status === 'Approved' ? '#059669' : formData.status === 'Rejected' ? '#DC2626' : '#F59E0B';
      doc.setTextColor(statusColor);
      doc.setFont('helvetica', 'bold');
      doc.text(`Status: ${formData.status}`, pageWidth - margin - 2, infoBoxY + 5, { align: 'right' });
    }

    yPos += infoBoxHeight + 3;
  }

  const col1Width = contentWidth / 3 - 1;
  const col2X = margin + col1Width + 1.5;
  const col3X = margin + (col1Width * 2) + 3;

  let tempY = addField('Requestor', formData.requestor, margin, yPos, col1Width);
  let tempY2 = addField('Requester Type', formData.requester_type, col2X, yPos, col1Width);
  let tempY3 = addField('Ontivity Project Number', formData.ontivity_project_number, col3X, yPos, col1Width);
  yPos = Math.max(tempY, tempY2, tempY3) + 2;

  if (formData.requester_email) {
    yPos = addField('Requester Email', formData.requester_email, margin, yPos, contentWidth);
    yPos += 2;
  }

  tempY = addField('Performing Entity', formData.performing_entity, margin, yPos, col1Width);
  tempY2 = addField('Date of Project Commencement', formData.date_of_project_commencement, col2X, yPos, col1Width);
  tempY3 = addField('Estimated Date of Completion', formData.estimated_date_of_completion, col3X, yPos, col1Width);
  yPos = Math.max(tempY, tempY2, tempY3) + 2;

  tempY = addField('Permit Jurisdiction Type', formData.permit_jurisdiction_type || 'State', margin, yPos, col1Width);
  tempY2 = addField('Type of Permit', formData.type_of_permit, col2X, yPos, col1Width);
  if (formData.utility_provider && formData.type_of_permit === 'Electrical Permit') {
    tempY3 = addField('Utility Provider', formData.utility_provider, col3X, yPos, col1Width);
    yPos = Math.max(tempY, tempY2, tempY3) + 2;
  } else {
    yPos = Math.max(tempY, tempY2) + 2;
  }

  tempY = addField('State', formData.state, margin, yPos, col1Width);
  if (formData.permit_jurisdiction && formData.permit_jurisdiction !== formData.state) {
    tempY2 = addField('Jurisdiction', formData.permit_jurisdiction, col2X, yPos, contentWidth - col1Width - margin);
    yPos = Math.max(tempY, tempY2) + 2;
  } else {
    yPos = tempY + 2;
  }

  tempY = addField('Land Owner (if applicable)', formData.land_owner || 'N/A', margin, yPos, col1Width);
  tempY2 = addField('Tower Owner', formData.tower_owner || '', col2X, yPos, col1Width);
  yPos = Math.max(tempY, tempY2) + 2;

  tempY = addField('End Customer', formData.end_customer, margin, yPos, col1Width);
  tempY2 = addField('Project Value', `$${formData.project_value}`, col2X, yPos, col1Width);
  yPos = Math.max(tempY, tempY2) + 2;

  if (formData.actual_date_of_completion || formData.permit_validity) {
    if (formData.actual_date_of_completion && formData.permit_validity) {
      tempY = addField('Actual Date of Completion', formData.actual_date_of_completion, margin, yPos, col1Width);
      tempY2 = addField('Permit Validity', formData.permit_validity, col2X, yPos, col1Width);
      yPos = Math.max(tempY, tempY2) + 2;
    } else if (formData.actual_date_of_completion) {
      yPos = addField('Actual Date of Completion', formData.actual_date_of_completion, margin, yPos, col1Width);
      yPos += 2;
    } else if (formData.permit_validity) {
      yPos = addField('Permit Validity', formData.permit_validity, margin, yPos, col1Width);
      yPos += 2;
    }
  }

  yPos = addTextArea('Detailed Scope of Work', formData.detailed_sow, margin, yPos, contentWidth);
  yPos += 4;

  if (formData.qp_name || formData.approver_name) {
    yPos = addSectionHeader('APPROVAL INFORMATION', yPos);
    yPos += 2;

    let approvalInfoHeight = 10;
    if (formData.qp_name) approvalInfoHeight += 12;
    if (formData.approver_name) approvalInfoHeight += 12;

    drawBox(margin, yPos, contentWidth, approvalInfoHeight);

    let lineY = yPos + 6;

    if (formData.qp_name) {
      doc.setTextColor(DARK_GRAY);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Qualified Person (QP):', margin + 2, lineY);

      doc.setFont('helvetica', 'normal');
      doc.text(formData.qp_name, margin + 40, lineY);

      if (formData.qp_approved_at) {
        doc.text(`Approved: ${new Date(formData.qp_approved_at).toLocaleDateString()}`, margin + 100, lineY);
      }

      lineY += 6;
    }

    if (formData.approver_name) {
      doc.setTextColor(DARK_GRAY);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Approver:', margin + 2, lineY);

      doc.setFont('helvetica', 'normal');
      doc.text(formData.approver_name, margin + 40, lineY);

      if (formData.approver_approved_at) {
        doc.text(`Approved: ${new Date(formData.approver_approved_at).toLocaleDateString()}`, margin + 100, lineY);
      }

      lineY += 6;
    }

    yPos += approvalInfoHeight;
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

export const mergePDFs = async (permitPdfBlob: Blob, signedDocumentUrl?: string): Promise<Blob> => {
  const mergedPdf = await PDFDocument.create();

  const permitPdfBytes = await permitPdfBlob.arrayBuffer();
  const permitPdf = await PDFDocument.load(permitPdfBytes);

  const permitPages = await mergedPdf.copyPages(permitPdf, permitPdf.getPageIndices());
  permitPages.forEach((page) => mergedPdf.addPage(page));

  if (signedDocumentUrl) {
    try {
      const response = await fetch(signedDocumentUrl);
      const signedDocBytes = await response.arrayBuffer();
      const signedDoc = await PDFDocument.load(signedDocBytes);

      const signedPages = await mergedPdf.copyPages(signedDoc, signedDoc.getPageIndices());
      signedPages.forEach((page) => mergedPdf.addPage(page));
    } catch (error) {
      console.error('Error loading signed document:', error);
    }
  }

  const mergedPdfBytes = await mergedPdf.save();
  return new Blob([mergedPdfBytes], { type: 'application/pdf' });
};

export const embedSignatureInPDF = async (
  pdfUrl: string,
  signatureDataUrl: string,
  position: { x: number; y: number },
  signatureSize: { width: number; height: number }
): Promise<Blob> => {
  const response = await fetch(pdfUrl);
  const pdfBytes = await response.arrayBuffer();
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const signatureImageBytes = await fetch(signatureDataUrl).then(res => res.arrayBuffer());
  const signatureImage = await pdfDoc.embedPng(signatureImageBytes);

  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { width: pageWidth, height: pageHeight } = firstPage.getSize();

  const scaleX = pageWidth / PDF_PREVIEW_WIDTH;
  const scaleY = pageHeight / PDF_PREVIEW_HEIGHT;

  const pdfX = position.x * scaleX;
  const pdfY = position.y * scaleY;
  const pdfWidth = signatureSize.width * scaleX;
  const pdfHeight = signatureSize.height * scaleY;

  firstPage.drawImage(signatureImage, {
    x: pdfX,
    y: pageHeight - pdfY - pdfHeight,
    width: pdfWidth,
    height: pdfHeight,
  });

  const modifiedPdfBytes = await pdfDoc.save();
  return new Blob([modifiedPdfBytes], { type: 'application/pdf' });
};

export interface SignatureData {
  signatureData: string;
  signerName: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  pdfDimensions: { width: number; height: number };
  previewDimensions: { width: number; height: number };
}

export const embedMultipleSignaturesInPDF = async (
  pdfUrl: string,
  signatures: SignatureData[]
): Promise<Blob> => {
  const response = await fetch(pdfUrl);
  const pdfBytes = await response.arrayBuffer();
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { width: pageWidth, height: pageHeight } = firstPage.getSize();

  for (const sig of signatures) {
    const signatureImageBytes = await fetch(sig.signatureData).then(res => res.arrayBuffer());
    const signatureImage = await pdfDoc.embedPng(signatureImageBytes);

    const percentX = (sig.position.x / sig.previewDimensions.width) * 100;
    const percentY = (sig.position.y / sig.previewDimensions.height) * 100;
    const percentWidth = (sig.size.width / sig.previewDimensions.width) * 100;
    const percentHeight = (sig.size.height / sig.previewDimensions.height) * 100;

    const pdfX = (percentX / 100) * pageWidth;
    const pdfY = (percentY / 100) * pageHeight;
    const pdfWidth = (percentWidth / 100) * pageWidth;
    const pdfHeight = (percentHeight / 100) * pageHeight;

    firstPage.drawImage(signatureImage, {
      x: pdfX,
      y: pageHeight - pdfY - pdfHeight,
      width: pdfWidth,
      height: pdfHeight,
    });
  }

  const modifiedPdfBytes = await pdfDoc.save();
  return new Blob([modifiedPdfBytes], { type: 'application/pdf' });
};
