import { TransactionalEmailsApi, SendSmtpEmail, TransactionalEmailsApiApiKeys } from '@getbrevo/brevo';

// Initialize the API client
const apiInstance = new TransactionalEmailsApi();

// Set your API key from .env
apiInstance.setApiKey(TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

/**
 * Sends a transactional email using the 330nur.org domain
 * @param {string} toEmail - Recipient address
 * @param {string} subject - Email subject
 * @param {string} htmlContent - HTML content of the email
 */
export async function sendEmail(toEmail, subject, htmlContent) {
  const sendSmtpEmail = new SendSmtpEmail();

  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = htmlContent;
  
  // This address does not need to exist as a real inbox, 
  // but the domain must be verified in Brevo.
  sendSmtpEmail.sender = { 
    name: "Main Roadmap", 
    email: "noreply@330nur.org" 
  }; 
  
  sendSmtpEmail.to = [{ email: toEmail }];

  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Email sent successfully via 330nur.org. Message ID: ', data.body.messageId, ' Receiver: ' + toEmail);
    return { success: true, messageId: data.body.messageId };
  } catch (error) {
    // Detailed error logging to help debug domain/API issues
    console.error('Brevo Error:', error.response?.body || error.message);
    throw new Error('Failed to send email');
  }
}