import { emailProviderConfig } from '../config/emailConfig';
import { User, Unit, Request, Poll } from '../models/data';
import { registrationTemplate, newScheduleNotificationTemplate, newLeaveRequestTemplate, leaveRequestStatusTemplate, newPollTemplate } from '../email/templates';

export interface EmailParams {
  to: string | string[];
  subject: string;
  html: string;
}

export const sendEmail = async (params: EmailParams): Promise<{ success: boolean; message: string }> => {
  if (emailProviderConfig.provider === 'mock') {
    console.log('--- MOCK EMAIL SENT ---');
    console.log('To:', params.to);
    console.log('Subject:', params.subject);
    // console.log('Body:', params.html);
    console.log('-----------------------');
    return { success: true, message: 'Mock email sent successfully.' };
  }

  if (emailProviderConfig.provider === 'resend') {
    if (!emailProviderConfig.apiKey) {
      console.error('Resend API key is missing.');
      return { success: false, message: 'Resend API key is not configured.' };
    }
    if (!emailProviderConfig.fromDefault) {
        console.error('Default FROM address is missing for Resend.');
        return { success: false, message: 'Default FROM address is not configured.' };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${emailProviderConfig.apiKey}`,
        },
        body: JSON.stringify({
          from: emailProviderConfig.fromDefault,
          to: params.to,
          subject: params.subject,
          html: params.html,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to send email via Resend:', errorData);
        return { success: false, message: `Resend error: ${errorData.message || 'Unknown error'}` };
      }

      console.log('Email sent successfully via Resend.');
      return { success: true, message: 'Email sent successfully via Resend.' };

    } catch (error) {
      console.error('Network or other error sending email via Resend:', error);
      if (error instanceof Error) {
        return { success: false, message: `Failed to send email: ${error.message}` };
      }
      return { success: false, message: 'An unknown error occurred while sending the email.' };
    }
  }

  return { success: false, message: 'Email provider not configured.' };
};

export const createRegistrationEmail = (user: User): EmailParams => {
  const subject = `Üdv a MintLeaf rendszerében, ${user.firstName}!`;
  const html = registrationTemplate(user.firstName);
  return {
    to: user.email,
    subject,
    html,
  };
};

export const createNewScheduleNotificationEmail = (user: User, weekLabel: string): EmailParams => {
  const subject = `Új beosztás a(z) ${weekLabel} hétre`;
  const html = newScheduleNotificationTemplate(user.firstName, weekLabel);
  return {
    to: user.email,
    subject,
    html,
  };
};

export const createNewLeaveRequestEmail = (admins: User[], request: Request, requestor: User, unit: Unit): EmailParams => {
    const subject = `Új szabadságkérelem érkezett - ${unit.name}`;
    const html = newLeaveRequestTemplate(request, requestor, unit);
    return {
        to: admins.map(a => a.email),
        subject,
        html,
    };
};

export const createLeaveRequestStatusEmail = (request: Request, requestor: User, unit: Unit): EmailParams => {
    const statusText = request.status === 'approved' ? 'elfogadásra' : 'elutasításra';
    const subject = `Szabadságkérelmed elbírálásra került`;
    const html = leaveRequestStatusTemplate(request, requestor, unit);
    return {
        to: requestor.email,
        subject,
        html,
    };
};

export const createNewPollEmail = (user: User, poll: Poll, unit: Unit): EmailParams => {
    const subject = `Új szavazás indult: ${poll.question.substring(0, 50)}...`;
    const html = newPollTemplate(user, poll, unit);
    return {
        to: user.email,
        subject,
        html,
    };
};


export const createGuestReservationConfirmationEmail = (booking: any, unit: Unit): EmailParams | null => {
    if (!booking.contact?.email) return null;
    const locale = booking.locale || 'hu';
    const subject = locale === 'hu' ? `Foglalási kérés a ${unit.name} étterembe` : `Reservation request for ${unit.name}`;
    // A proper template should be used here. For now, a simple text.
    const html = `<p>Kedves ${booking.name},</p><p>Köszönjük foglalási kérését. Hamarosan jelentkezünk a megerősítéssel.</p><p>Azonosító: ${booking.referenceCode}</p>`;
    return {
        to: booking.contact.email,
        subject,
        html,
    };
};

export const createUnitNewReservationNotificationEmail = (booking: any, unit: Unit, recipientEmails: string[]): EmailParams => {
     const subject = `Új foglalási kérés érkezett - ${unit.name}`;
     const html = `<p>Új foglalási kérés érkezett a(z) ${unit.name} egységbe.</p>
        <p><strong>Név:</strong> ${booking.name}</p>
        <p><strong>Létszám:</strong> ${booking.headcount} fő</p>
        <p><strong>Időpont:</strong> ${booking.startTime.toDate().toLocaleString('hu-HU')}</p>
        <p>A foglalás kezeléséhez lépj be a MintLeaf admin felületére.</p>`;
    return {
        to: recipientEmails,
        subject,
        html,
    };
};