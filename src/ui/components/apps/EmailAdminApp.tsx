import React, { useState, useEffect, useMemo, FC } from 'react';
import { User, EmailConfig, EmailServiceId, TemplateKey } from '../../../core/models/data';
import { getEmailConfig, updateEmailConfig, sendTestEmail } from '../../../core/api/emailAdminService';
import LoadingSpinner from '../../../../components/LoadingSpinner';

const SERVICES: { id: EmailServiceId; label: string }[] = [
    { id: 'system', label: 'Rendszer' },
    { id: 'bookings', label: 'Foglalások' },
    { id: 'leaves', label: 'Szabadságok' },
    { id: 'polls', label: 'Szavazások' },
];

const TEMPLATES: Record<EmailServiceId, { key: TemplateKey; label: string; samplePayload: Record<string, any> }[]> = {
    system: [
        { key: 'registration', label: 'Sikeres regisztráció', samplePayload: { firstName: 'Anna' } },
        { key: 'newSchedule', label: 'Új beosztás publikálva', samplePayload: { firstName: 'Anna', weekLabel: '2024. júl. 22-28.' } },
    ],
    bookings: [
        { key: 'guestConfirmation', label: 'Vendég visszaigazolás', samplePayload: { guestName: 'Nagy Család', date: '2024-07-28', time: '19:00', headcount: 4, unitName: 'MintLeaf Étterem' } },
        { key: 'newBookingAdminNotification', label: 'Értesítés új foglalásról (admin)', samplePayload: { guestName: 'Nagy Család', date: '2024-07-28', time: '19:00', headcount: 4, unitName: 'MintLeaf Étterem' } },
    ],
    leaves: [
        { key: 'leaveRequest', label: 'Új szabadságkérelem (admin)', samplePayload: { requestorName: 'Kis Gábor', startDate: '2024-08-01', endDate: '2024-08-03', unitName: 'MintLeaf Étterem' } },
        { key: 'leaveStatus', label: 'Szabadságkérelem elbírálva', samplePayload: { firstName: 'Gábor', startDate: '2024-08-01', endDate: '2024-08-03', status: 'Elfogadva' } },
    ],
    polls: [
        { key: 'poll', label: 'Új szavazás', samplePayload: { firstName: 'Anna', pollQuestion: 'Milyen legyen a karácsonyi menü?', unitName: 'MintLeaf Étterem' } },
    ],
};

const EmailAdminApp: FC<{ currentUser: User }> = ({ currentUser }) => {
    const [activeService, setActiveService] = useState<EmailServiceId>('system');
    const [config, setConfig] = useState<EmailConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [writeEnabled, setWriteEnabled] = useState(false);

    useEffect(() => {
        const loadConfig = async () => {
            setIsLoading(true);
            setError('');
            try {
                const { config: fetchedConfig, writeEnabled: flag } = await getEmailConfig(activeService);
                setConfig(fetchedConfig);
                setWriteEnabled(flag);
            } catch (err: any) {
                setError(err.message || 'Hiba a konfiguráció betöltésekor.');
            } finally {
                setIsLoading(false);
            }
        };
        loadConfig();
    }, [activeService]);

    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Email Beállítások</h2>
            <div className="flex border-b mb-4">
                {SERVICES.map(service => (
                    <button 
                        key={service.id}
                        onClick={() => setActiveService(service.id)}
                        className={`px-4 py-2 font-semibold ${activeService === service.id ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500'}`}
                    >
                        {service.label}
                    </button>
                ))}
            </div>
            {isLoading && <div className="relative h-64"><LoadingSpinner /></div>}
            {error && <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}
            {config && <ConfigEditor config={config} writeEnabled={writeEnabled} serviceId={activeService} />}
        </div>
    );
};

const ConfigEditor: FC<{ config: EmailConfig; writeEnabled: boolean; serviceId: EmailServiceId }> = ({ config: initialConfig, writeEnabled, serviceId }) => {
    const [config, setConfig] = useState(initialConfig);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => { setConfig(initialConfig); }, [initialConfig]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateEmailConfig(serviceId, config);
            alert('Mentve!');
        } catch (err: any) {
            alert(`Hiba mentés közben: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div>
            {!writeEnabled && (
                <div className="p-4 mb-4 bg-yellow-100 text-yellow-800 rounded-lg">
                    <p className="font-bold">Figyelem: A szolgáltatás beállításra vár!</p>
                    <p className="text-sm mt-1">Az email küldés és a beállítások mentése le van tiltva. A funkció használatához a következő lépések szükségesek:</p>
                    <ol className="list-decimal list-inside text-sm mt-2 space-y-1">
                        <li>Állítsd be a <strong>RESEND_API_KEY</strong> és <strong>RESEND_FROM_DEFAULT</strong> titkosított változókat a Firebase projektben a <code>README.md</code> útmutatója alapján.</li>
                        <li>A Firestore adatbázis <code>appFlags/email</code> dokumentumában állítsd a <code>writeEnabled</code> mezőt <code>true</code>-ra.</li>
                    </ol>
                </div>
            )}

            {TEMPLATES[serviceId].map(template => (
                <TemplateEditor 
                    key={template.key} 
                    templateInfo={template} 
                    config={config} 
                    setConfig={setConfig}
                    writeEnabled={writeEnabled}
                    serviceId={serviceId}
                />
            ))}
            
            <div className="mt-6 flex justify-end">
                <button onClick={handleSave} disabled={!writeEnabled || isSaving} className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                    {isSaving ? 'Mentés...' : 'Változtatások mentése'}
                </button>
            </div>
        </div>
    );
};

const TemplateEditor: FC<any> = ({ templateInfo, config, setConfig, writeEnabled, serviceId }) => {
    const { key, label, samplePayload } = templateInfo;
    const [isTestModalOpen, setIsTestModalOpen] = useState(false);
    
    const subject = config.subjectTemplates?.[key] || '';
    const body = config.bodyTemplates?.[key] || '';

    const renderedBody = useMemo(() => {
        let rendered = body;
        for (const placeholder in samplePayload) {
            rendered = rendered.replace(new RegExp(`{{${placeholder}}}`, 'g'), samplePayload[placeholder]);
        }
        return rendered;
    }, [body, samplePayload]);

    const handleUpdate = (type: 'subject' | 'body', value: string) => {
        setConfig((prev: EmailConfig) => {
            const newConfig = { ...prev };
            if (type === 'subject') {
                newConfig.subjectTemplates = { ...(newConfig.subjectTemplates || {}), [key]: value };
            }
            if (type === 'body') {
                newConfig.bodyTemplates = { ...(newConfig.bodyTemplates || {}), [key]: value };
            }
            return newConfig;
        });
    };
    
    return (
        <div className="border p-4 rounded-lg mb-4">
            {isTestModalOpen && <TestEmailModal templateInfo={templateInfo} serviceId={serviceId} onClose={() => setIsTestModalOpen(false)} />}
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">{label}</h3>
                <button onClick={() => setIsTestModalOpen(true)} className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-1 px-3 rounded-lg">Teszt küldése</button>
            </div>
            <div className="mt-4 space-y-4">
                <div>
                    <label className="font-semibold">Tárgy</label>
                    <input value={subject} onChange={e => handleUpdate('subject', e.target.value)} disabled={!writeEnabled} className="w-full p-2 border rounded mt-1 disabled:bg-gray-100" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="font-semibold">Email törzs (HTML)</label>
                        <textarea value={body} onChange={e => handleUpdate('body', e.target.value)} disabled={!writeEnabled} rows={10} className="w-full p-2 border rounded mt-1 font-mono text-sm disabled:bg-gray-100" />
                    </div>
                    <div>
                        <label className="font-semibold">Előnézet</label>
                        <div className="p-2 border rounded mt-1 bg-gray-50 h-full" dangerouslySetInnerHTML={{ __html: renderedBody }} />
                    </div>
                </div>
            </div>
        </div>
    );
};

const TestEmailModal: FC<any> = ({ templateInfo, serviceId, onClose }) => {
    const [to, setTo] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');

    const handleSend = async () => {
        setIsSending(true);
        setError('');
        setResult(null);
        try {
            const res = await sendTestEmail({
                serviceId,
                templateKey: templateInfo.key,
                to,
                samplePayload: templateInfo.samplePayload,
            });
            setResult(res);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b flex justify-between">
                    <h2 className="text-xl font-bold">Teszt email küldése: {templateInfo.label}</h2>
                    <button onClick={onClose}>&times;</button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="font-semibold">Címzett</label>
                        <input value={to} onChange={e => setTo(e.target.value)} placeholder="teszt@email.com" className="w-full p-2 border rounded mt-1" type="email" />
                    </div>
                    {result && (
                        <div className={`p-4 rounded-lg ${result.dryRun ? 'bg-yellow-100' : 'bg-green-100'}`}>
                            <p className="font-bold">{result.dryRun ? 'Száraz futtatás sikeres' : 'Email elküldve'}</p>
                            <p className="text-sm">{result.message}</p>
                            <details className="mt-2 text-xs">
                                <summary className="cursor-pointer">Renderelt tartalom</summary>
                                <div className="mt-2 p-2 bg-white rounded border">
                                    <p><strong>Tárgy:</strong> {result.compiled.subject}</p>
                                    <div className="mt-2 border-t pt-2" dangerouslySetInnerHTML={{ __html: result.compiled.html }} />
                                </div>
                            </details>
                        </div>
                    )}
                    {error && <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}
                </div>
                <div className="p-4 bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="bg-gray-200 px-4 py-2 rounded-lg font-semibold">Mégse</button>
                    <button onClick={handleSend} disabled={isSending || !to} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold disabled:bg-gray-400">
                        {isSending ? 'Küldés...' : 'Küldés'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EmailAdminApp;