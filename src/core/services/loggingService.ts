import { db, serverTimestamp } from '../firebase/config';
import { collection, addDoc } from 'firebase/firestore';
import { ReservationLog, Booking, User } from '../models/data';

interface LogEventPayload {
    type: ReservationLog['type'];
    booking: Booking;
    user: User | null; // null for guest actions
    details?: string;
}

export const logReservationEvent = async ({ type, booking, user, details }: LogEventPayload): Promise<void> => {
    try {
        const logData: Omit<ReservationLog, 'id'> = {
            reservationId: booking.id,
            unitId: booking.unitId,
            type,
            source: user ? 'manual' : 'guest',
            performedByUserId: user ? user.id : null,
            performedByName: user ? user.fullName : 'Vendég',
            timestamp: serverTimestamp() as any,
            details: details || createLogDetails(type, booking),
        };
        await addDoc(collection(db, 'reservation_logs'), logData);
    } catch (error) {
        console.error("Failed to log reservation event:", error);
        // It's crucial that logging failures do not break the main application flow.
    }
};

const createLogDetails = (type: ReservationLog['type'], booking: Booking): string => {
    const time = booking.startTime.toDate().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
    const headcount = `${booking.headcount} fő`;

    switch (type) {
        case 'created':
            return `Új foglalás: ${booking.name} (${headcount}, ${time})`;
        case 'updated':
            return `Foglalás frissítve: ${booking.name}`;
        case 'cancelled':
            return `Foglalás lemondva: ${booking.name}`;
        default:
            return `Ismeretlen esemény: ${booking.name}`;
    }
};
