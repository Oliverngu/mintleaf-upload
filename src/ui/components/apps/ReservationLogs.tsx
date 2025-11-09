import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../core/firebase/config';
import { collectionGroup, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { ReservationLog, User } from '../../../core/models/data';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import PlusIcon from '../../../../components/icons/PlusIcon';
import PencilIcon from '../../../../components/icons/PencilIcon';
import TrashIcon from '../../../../components/icons/TrashIcon';

// --- Hook for fetching logs ---
const useReservationLogs = (unitId: string) => {
    const [logs, setLogs] = useState<ReservationLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!unitId) {
            setLogs([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        const logsQuery = query(
            collectionGroup(db, 'reservation_logs'),
            where('unitId', '==', unitId),
            orderBy('timestamp', 'desc')
        );

        const unsubscribe = onSnapshot(logsQuery, snapshot => {
            const fetchedLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReservationLog));
            setLogs(fetchedLogs);
            setLoading(false);
        }, err => {
            console.error("Error fetching reservation logs:", err);
            setError("Hiba a naplóbejegyzések betöltésekor.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [unitId]);

    return { logs, loading, error };
};

// --- Log Item Component ---
const LogItem: React.FC<{ log: ReservationLog }> = ({ log }) => {
    const typeStyles = {
        created: { bg: 'bg-green-100', text: 'text-green-800', icon: <PlusIcon className="h-4 w-4" />, label: 'Létrehozva' },
        updated: { bg: 'bg-blue-100', text: 'text-blue-800', icon: <PencilIcon className="h-4 w-4" />, label: 'Frissítve' },
        cancelled: { bg: 'bg-red-100', text: 'text-red-800', icon: <TrashIcon className="h-4 w-4" />, label: 'Lemondva' },
        deleted: { bg: 'bg-gray-100', text: 'text-gray-800', icon: <TrashIcon className="h-4 w-4" />, label: 'Törölve' },
    };
    const style = typeStyles[log.type] || typeStyles.updated;

    return (
        <div className="relative pl-8 py-3 group">
            <div className={`absolute top-4 left-0 w-3 h-3 rounded-full ${style.bg} border-2 border-white ring-4 ring-gray-200`}></div>
            <div className="flex items-start justify-between">
                <div>
                    <p className="font-semibold text-gray-800">{log.details}</p>
                    <p className="text-sm text-gray-500">
                        {log.performedByName} • {log.timestamp?.toDate().toLocaleString('hu-HU')}
                    </p>
                </div>
                <div className={`text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 ${style.bg} ${style.text}`}>
                    {style.icon}
                    <span>{style.label}</span>
                </div>
            </div>
        </div>
    );
};


// --- Main Component ---
interface ReservationLogsProps {
    unitId: string;
    currentUser: User;
}

const ReservationLogs: React.FC<ReservationLogsProps> = ({ unitId, currentUser }) => {
    const { logs, loading, error } = useReservationLogs(unitId);
    const [typeFilter, setTypeFilter] = useState<'all' | ReservationLog['type']>('all');
    const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days'>('all');

    const filteredLogs = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const sevenDaysAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

        return logs.filter(log => {
            const typeMatch = typeFilter === 'all' || log.type === typeFilter;
            if (!typeMatch) return false;

            const logDate = log.timestamp?.toDate();
            if (!logDate) return true; // Keep logs without timestamp if any

            if (dateFilter === 'today' && logDate < today) return false;
            if (dateFilter === '7days' && logDate < sevenDaysAgo) return false;
            
            return true;
        });
    }, [logs, typeFilter, dateFilter]);

    return (
        <div className="bg-white p-6 rounded-b-2xl shadow-lg border border-gray-100">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-4 bg-gray-100 p-3 rounded-lg">
                <div>
                    <span className="text-sm font-semibold mr-2">Típus:</span>
                     <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="p-1 border rounded-md bg-white text-sm">
                        <option value="all">Összes</option>
                        <option value="created">Létrehozott</option>
                        <option value="updated">Frissített</option>
                        <option value="cancelled">Lemondott</option>
                    </select>
                </div>
                 <div>
                    <span className="text-sm font-semibold mr-2">Dátum:</span>
                    <div className="inline-flex rounded-md shadow-sm">
                        <button onClick={() => setDateFilter('today')} className={`px-3 py-1 text-sm font-medium border rounded-l-md ${dateFilter === 'today' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Ma</button>
                        <button onClick={() => setDateFilter('7days')} className={`px-3 py-1 text-sm font-medium border-t border-b ${dateFilter === '7days' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>7 nap</button>
                        <button onClick={() => setDateFilter('all')} className={`px-3 py-1 text-sm font-medium border rounded-r-md ${dateFilter === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Összes</button>
                    </div>
                </div>
            </div>

            {loading && <div className="relative h-32"><LoadingSpinner /></div>}
            {error && <p className="text-red-500">{error}</p>}
            
            {!loading && filteredLogs.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed rounded-lg">
                    <p className="text-gray-500">Nincsenek a szűrőnek megfelelő naplóbejegyzések.</p>
                </div>
            )}
            
            {!loading && filteredLogs.length > 0 && (
                <div className="max-h-[500px] overflow-y-auto pr-2">
                    <div className="relative border-l-2 border-gray-200">
                        {filteredLogs.map(log => <LogItem key={log.id} log={log} />)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReservationLogs;
