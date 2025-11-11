import { Request, User, Unit, Poll } from "../models/data";

export const registrationTemplate = (firstName: string): string => `
  <h1>Üdvözlünk, ${firstName}!</h1>
  <p>Sikeresen regisztráltál a MintLeaf rendszerébe.</p>
  <p>Mostantól be tudsz jelentkezni a megadott email címeddel és jelszavaddal.</p>
  <p>Üdvözlettel,<br>A MintLeaf Csapata</p>
`;

export const newScheduleNotificationTemplate = (firstName: string, weekLabel: string): string => `
  <h1>Szia ${firstName},</h1>
  <p>Publikálásra került a(z) <strong>${weekLabel}</strong> hétre vonatkozó beosztásod.</p>
  <p>A részletekért jelentkezz be a MintLeaf alkalmazásba.</p>
  <p>Üdvözlettel,<br>A MintLeaf Csapata</p>
`;

export const newLeaveRequestTemplate = (request: Request, requestor: User, unit: Unit): string => {
  const startDate = request.startDate.toDate().toLocaleDateString('hu-HU');
  const endDate = request.endDate.toDate().toLocaleDateString('hu-HU');
  return `
    <h1>Új szabadságkérelem</h1>
    <p><strong>${requestor.fullName}</strong> szabadságot kért a(z) <strong>${unit.name}</strong> egységben.</p>
    <p><strong>Időtartam:</strong> ${startDate} - ${endDate}</p>
    ${request.note ? `<p><strong>Megjegyzés:</strong> ${request.note}</p>` : ''}
    <p>A kérelem elbírálásához lépj be a MintLeaf alkalmazásba.</p>
  `;
};

export const leaveRequestStatusTemplate = (request: Request, requestor: User, unit: Unit): string => {
  const statusText = request.status === 'approved' ? 'elfogadták' : 'elutasították';
  const statusColor = request.status === 'approved' ? '#22c55e' : '#ef4444';
  const startDate = request.startDate.toDate().toLocaleDateString('hu-HU');
  const endDate = request.endDate.toDate().toLocaleDateString('hu-HU');

  return `
    <h1>Szabadságkérelmed elbírálva</h1>
    <p>Szia ${requestor.firstName},</p>
    <p>A(z) <strong>${startDate} - ${endDate}</strong> közötti időszakra benyújtott szabadságkérelmedet <strong style="color: ${statusColor};">${statusText}</strong>.</p>
    <p>A részletekért lépj be a MintLeaf alkalmazásba.</p>
  `;
};

export const newPollTemplate = (user: User, poll: Poll, unit: Unit): string => `
    <h1>Új szavazás indult!</h1>
    <p>Szia ${user.firstName},</p>
    <p>Új szavazás indult a(z) <strong>${unit.name}</strong> egységben a következő kérdéssel:</p>
    <p style="font-size: 1.2em; font-weight: bold; margin: 1em 0;">"${poll.question}"</p>
    <p>A szavazatod leadásához lépj be a MintLeaf alkalmazásba.</p>
`;