export interface PowerAutomatePayload {
  permitId: string;
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
  status: string;
  rejectionReason?: string;
  pdfBlob?: Blob;
}

export const sendToSharePoint = async (
  payload: PowerAutomatePayload,
  flowUrl: string
): Promise<Response> => {
  try {
    const formData = new FormData();

    Object.entries(payload).forEach(([key, value]) => {
      if (key === 'pdfBlob' && value instanceof Blob) {
        formData.append('pdf', value, `permit_${payload.permitId}.pdf`);
      } else if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });

    const response = await fetch(flowUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  } catch (error) {
    console.error('Error sending to Power Automate:', error);
    throw error;
  }
};

export const sendSubmissionNotification = async (
  payload: PowerAutomatePayload,
  flowUrl: string
): Promise<void> => {
  await sendToSharePoint(payload, flowUrl);
};

export const sendApprovalNotification = async (
  payload: PowerAutomatePayload,
  flowUrl: string
): Promise<void> => {
  await sendToSharePoint(payload, flowUrl);
};

export const sendRejectionNotification = async (
  payload: PowerAutomatePayload,
  flowUrl: string
): Promise<void> => {
  await sendToSharePoint(payload, flowUrl);
};
