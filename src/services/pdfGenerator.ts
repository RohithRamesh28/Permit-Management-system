import { jsPDF } from 'jspdf';

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
  county_or_parish: string;
  city: string;
  property_owner: string;
  end_customer: string;
  project_value: string;
  actual_date_of_completion?: string;
  detailed_sow: string;
  requiresSignature: boolean;
  signatureDataUrl?: string;
  permitId?: string;
  status?: string;
  signerName?: string;
  approvedBy?: string;
  approvedAt?: string;
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
      doc.text(`Permit ID: PERMIT-${formData.ontivity_project_number}`, margin + 2, infoBoxY + 5);
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

  tempY = addField('Type of Permit', formData.type_of_permit, margin, yPos, col1Width);
  if (formData.utility_provider && formData.type_of_permit === 'Electrical') {
    tempY2 = addField('Utility Provider', formData.utility_provider, col2X, yPos, col1Width);
    yPos = Math.max(tempY, tempY2) + 2;
  } else {
    yPos = tempY + 2;
  }

  tempY = addField('State', formData.state, margin, yPos, col1Width);
  tempY2 = addField('County', formData.county_or_parish, col2X, yPos, col1Width);
  tempY3 = addField('City', formData.city, col3X, yPos, col1Width);
  yPos = Math.max(tempY, tempY2, tempY3) + 2;

  tempY = addField('Property Owner', formData.property_owner, margin, yPos, col1Width);
  tempY2 = addField('End Customer', formData.end_customer, col2X, yPos, col1Width);
  tempY3 = addField('Project Value', `$${formData.project_value}`, col3X, yPos, col1Width);
  yPos = Math.max(tempY, tempY2, tempY3) + 2;

  if (formData.actual_date_of_completion) {
    yPos = addField('Actual Date of Completion', formData.actual_date_of_completion, margin, yPos, col1Width);
    yPos += 2;
  }

  yPos = addTextArea('Detailed Scope of Work', formData.detailed_sow, margin, yPos, contentWidth);
  yPos += 4;

  if (formData.requiresSignature && formData.signatureDataUrl) {
    yPos = addSectionHeader('AUTHORIZATION & SIGNATURE', yPos);
    yPos += 2;

    drawBox(margin, yPos, contentWidth, 35);

    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('SIGNATURE:', margin + 2, yPos + 4);

    doc.setDrawColor(BORDER_GRAY);
    doc.setLineWidth(0.5);
    doc.line(margin + 4, yPos + 18, margin + 80, yPos + 18);

    try {
      doc.addImage(formData.signatureDataUrl, 'PNG', margin + 4, yPos + 6, 60, 12);
    } catch (error) {
      console.error('Error adding signature to PDF:', error);
    }

    doc.setTextColor(DARK_GRAY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Signed by: ${formData.signerName || formData.requestor}`, margin + 4, yPos + 22);
    doc.text(new Date().toLocaleDateString(), margin + 4, yPos + 27);

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
  } else if (formData.status === 'Approved' && !formData.requiresSignature) {
    yPos = addSectionHeader('APPROVAL STATUS', yPos);
    yPos += 2;

    const approvalBoxHeight = 25;
    doc.setFillColor(240, 253, 244);
    doc.rect(margin, yPos, contentWidth, approvalBoxHeight, 'F');
    drawBox(margin, yPos, contentWidth, approvalBoxHeight);

    doc.setTextColor('#059669');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('APPROVED', margin + 2, yPos + 8);

    doc.setTextColor(DARK_GRAY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    if (formData.approvedBy) {
      doc.text(`Approved by: ${formData.approvedBy}`, margin + 2, yPos + 15);
    }

    if (formData.approvedAt) {
      doc.text(`Approval Date: ${formData.approvedAt}`, margin + 2, yPos + 21);
    }

    yPos += approvalBoxHeight;
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
