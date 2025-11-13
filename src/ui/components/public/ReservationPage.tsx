import React, { useState, useEffect, useMemo } from 'react';
// FIX: Corrected import path to use the up-to-date data models from the core directory.
import { Unit, ReservationSetting, User, ThemeSettings, GuestFormSettings, CustomSelectField } from '../../../core/models/data';
import { db, Timestamp } from '../../../core/firebase/config';
import { doc, getDoc, collection, addDoc, setDoc, query, where, getDocs } from 'firebase/firestore';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import CalendarIcon from '../../../../components/icons/CalendarIcon';
import CopyIcon from '../../../../components/icons/CopyIcon'; // Új import
import { translations } from '../../../lib/i1n'; // Import a kiszervezett fájlból
import { sendEmail, createGuestReservationConfirmationEmail, createUnitNewReservationNotificationEmail } from '../../../core/api/emailService';
import { logReservationEvent } from '../../../core/services/loggingService';
// FIX: Import the errorToString utility to handle unknown error types.
import { errorToString } from '../../../core/utils/errorToString';

type Locale = 'hu' | 'en';

interface ReservationPageProps {
    unitId: string;
    allUnits: Unit[];
    currentUser: User | null;
}

const toDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const DEFAULT_THEME: ThemeSettings = {
    primary: '#166534', surface: '#ffffff', background: '#f9fafb', textPrimary: '#1f2937', 
    textSecondary: '#4b5563', accent: '#10b981', success: '#16a34a', danger: '#dc2626',
    radius: 'lg', elevation: 'mid', typographyScale: 'M',
};

const DEFAULT_GUEST_FORM: GuestFormSettings = {
    customSelects: [],
};

const ProgressIndicator: React.FC<{ currentStep: number, t: typeof translations['hu'] }> = ({ currentStep, t }) => {
    const steps = [t.step1, t.step2, t.step3];
    return (
        <div className="flex items-center justify-center w-full max-w-xl mx-auto mb-8">
            {steps.map((label, index) => {
                const stepNumber = index + 1;
                const isCompleted = currentStep > stepNumber;
                const isActive = currentStep === stepNumber;
                return (
                    <React.Fragment key={stepNumber}>
                        <div className="flex flex-col items-center text-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors ${
                                isCompleted ? 'bg-[var(--color-primary)] text-white' : isActive ? 'bg-green-200 text-[var(--color-primary)] border-2 border-[var(--color-primary)]' : 'bg-gray-200 text-gray-500'
                            }`}>
                                {isCompleted ? '✓' : stepNumber}
                            </div>
                            <p className={`mt-2 text-sm font-semibold transition-colors ${isActive || isCompleted ? 'text-[var(--color-text-primary)]' : 'text-gray-400'}`}>{label}</p>
                        </div>
                        {index < steps.length - 1 && (
                            <div className={`flex-1 h-1 mx-2 transition-colors ${isCompleted ? 'bg-[var(--color-primary)]' : 'bg-gray-200'}`}></div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

const ReservationPage: React.FC<ReservationPageProps> = ({ unitId, allUnits, currentUser }) => {
    const [step, setStep] = useState(1);
    const [unit, setUnit] = useState<Unit | null>(null);
    const [settings, setSettings] = useState<ReservationSetting | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [locale, setLocale] = useState<Locale>('hu');
    
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [formData, setFormData] = useState({ 
        name: '', 
        headcount: '2', 
        startTime: '', 
        endTime: '', 
        phone: '', 
        email: '',
        customData: {} as Record<string, string>
    });
    const [submittedData, setSubmittedData] = useState<any>(null);
    
    const [isSubmitting, setIsSubmitting] = useState(false);

    // State for calendar month and daily headcounts
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [dailyHeadcounts, setDailyHeadcounts] = useState<Map<string, number>>(new Map());
    
    useEffect(() => {
        const browserLang = navigator.language.split('-')[0];
        if (browserLang === 'en') {
            setLocale('en');
        }
    }, []);

    useEffect(() => {
        // FIX: Add a guard to ensure allUnits is a valid array before proceeding.
        if (!Array.isArray(allUnits)) return;
        const currentUnit = allUnits.find(u => u.id === unitId);
        if (currentUnit) {
            setUnit(currentUnit);
            document.title = `Foglalás - ${currentUnit.name}`;
        } else if (allUnits.length > 0) {
            setError('A megadott egység nem található.');
        }
    }, [unitId, allUnits]);

    useEffect(() => {
        if (!unit) return;
        const fetchSettings = async () => {
            setLoading(true);
            try {
                const docRef = doc(db, 'reservation_settings', unitId);
                const docSnap = await getDoc(docRef);
                const defaultSettings: ReservationSetting = { 
                    id: unitId, blackoutDates: [], bookableWindow: { from: '11:00', to: '23:00'}, 
                    kitchenStartTime: null, kitchenEndTime: null, barStartTime: null, barEndTime: null,
                    guestForm: DEFAULT_GUEST_FORM, theme: DEFAULT_THEME,
                    reservationMode: 'request', notificationEmails: [],
                };
                if (docSnap.exists()) {
                    const dbData = docSnap.data() as any;
                    const finalSettings = { 
                        ...defaultSettings, ...dbData,
                        guestForm: { ...DEFAULT_GUEST_FORM, ...(dbData.guestForm || {}) },
                        theme: { ...DEFAULT_THEME, ...(dbData.theme || {}) },
                    };
                    setSettings(finalSettings);
                } else {
                    setSettings(defaultSettings);
                }
            } catch (err) {
                console.error("Error fetching reservation settings:", err);
                setError('Hiba a foglalási beállítások betöltésekor.');
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [unit, unitId]);

     // Fetch headcounts for the visible month
    useEffect(() => {
        if (!unitId || !settings?.dailyCapacity || settings.dailyCapacity <= 0) {
            setDailyHeadcounts(new Map()); // Clear if no capacity limit
            return;
        }

        const fetchHeadcounts = async () => {
            const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
            const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);

            const q = query(
                collection(db, 'units', unitId, 'reservations'),
                where('startTime', '>=', Timestamp.fromDate(startOfMonth)),
                where('startTime', '<=', Timestamp.fromDate(endOfMonth)),
                where('status', 'in', ['pending', 'confirmed'])
            );

            try {
                const querySnapshot = await getDocs(q);
                const headcounts = new Map<string, number>();
                querySnapshot.docs.forEach(doc => {
                    const booking = doc.data();
                    const dateKey = toDateKey(booking.startTime.toDate());
                    const currentCount = headcounts.get(dateKey) || 0;
                    headcounts.set(dateKey, currentCount + (booking.headcount || 0));
                });
                setDailyHeadcounts(headcounts);
            } catch (err) {
                console.error("Error fetching headcounts:", err);
            }
        };

        fetchHeadcounts();
    }, [unitId, currentMonth, settings?.dailyCapacity]);


    useEffect(() => {
        if (settings?.theme) {
            const root = document.documentElement;
            Object.entries(settings.theme).forEach(([key, value]) => {
                if(key !== 'radius' && key !== 'elevation' && key !== 'typographyScale')
                root.style.setProperty(`--color-${key}`, value);
            });
        }
    }, [settings?.theme]);
    
    const resetFlow = () => {
        setSelectedDate(null);
        setFormData({ name: '', headcount: '2', startTime: '', endTime: '', phone: '', email: '', customData: {} });
        setStep(1);
    };

    const handleDateSelect = (day: Date) => { setSelectedDate(day); setStep(2); };

    const normalizePhone = (phone: string): string => {
        let cleaned = phone.replace(/[\s-()]/g, '');
        if (cleaned.startsWith('00')) cleaned = '+' + cleaned.substring(2);
        else if (cleaned.startsWith('06')) cleaned = '+36' + cleaned.substring(2);
        else if (!cleaned.startsWith('+')) cleaned = '+36' + cleaned;
        return cleaned;
    };

    const t = translations[locale];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || !formData.startTime || !unit || !settings) return;
        
        setIsSubmitting(true);
        setError('');

        try {
            // --- VALIDATION ---
            const requestedStartTime = formData.startTime;
            const requestedHeadcount = parseInt(formData.headcount, 10);

            // Time window validation
            const { from: bookingStart, to: bookingEnd } = settings.bookableWindow || { from: '00:00', to: '23:59' };
            if (requestedStartTime < bookingStart || requestedStartTime > bookingEnd) {
                throw new Error(t.errorTimeWindow.replace('{start}', bookingStart).replace('{end}', bookingEnd));
            }
            
            // Capacity validation (re-validate on submit for race conditions)
            if (settings.dailyCapacity && settings.dailyCapacity > 0) {
                const dayStart = new Date(selectedDate);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(selectedDate);
                dayEnd.setHours(23, 59, 59, 999);

                const q = query(
                    collection(db, 'units', unitId, 'reservations'),
                    where('startTime', '>=', Timestamp.fromDate(dayStart)),
                    where('startTime', '<=', Timestamp.fromDate(dayEnd)),
                    where('status', 'in', ['pending', 'confirmed'])
                );

                const querySnapshot = await getDocs(q);
                const currentHeadcount = querySnapshot.docs.reduce((sum, doc) => sum + (doc.data().headcount || 0), 0);
                
                if (currentHeadcount >= settings.dailyCapacity) {
                    throw new Error(t.errorCapacityFull);
                }

                if (currentHeadcount + requestedHeadcount > settings.dailyCapacity) {
                    const availableSlots = settings.dailyCapacity - currentHeadcount;
                    throw new Error(t.errorCapacityLimited.replace('{count}', String(availableSlots)));
                }
            }

            // --- SUBMISSION LOGIC ---
            const startDateTime = new Date(`${toDateKey(selectedDate)}T${formData.startTime}`);
            let endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000); // Default 2 hours duration
            if (formData.endTime) {
                const potentialEndDateTime = new Date(`${toDateKey(selectedDate)}T${