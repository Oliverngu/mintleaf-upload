import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, FileMetadata, Unit } from '../../../core/models/data';
import { db, storage, serverTimestamp, Timestamp } from '../../../core/firebase/config';
import { collection, onSnapshot, query, orderBy, addDoc, doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import BookIcon from '../../../../components/icons/BookIcon';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import TrashIcon from '../../../../components/icons/TrashIcon';
import DownloadIcon from '../../../../components/icons/DownloadIcon';
import PlusIcon from '../../../../components/icons/PlusIcon';
import ArrowUpIcon from '../../../../components/icons/ArrowUpIcon';
import ArrowDownIcon from '../../../../components/icons/ArrowDownIcon';

interface TudastarAppProps {
  currentUser: User;
  activeUnitIds: string[];
  allUnits: Unit[];
}

const TudastarApp: React.FC<TudastarAppProps> = ({ currentUser, activeUnitIds, allUnits }) => {
    const [documents, setDocuments] = useState<FileMetadata[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');
    const [isEditMode, setIsEditMode] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const activeUnitId = useMemo(() => activeUnitIds.length === 1 ? activeUnitIds[0] : null, [activeUnitIds]);
    const canManage = currentUser.role === 'Admin' || currentUser.role === 'Unit Admin';

    // Data fetching
    useEffect(() => {
        if (!activeUnitId) {
            setDocuments([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const collectionRef = collection(db, 'units', activeUnitId, 'knowledge_base');
        const q = query(collectionRef, orderBy('sortOrder', 'asc'), orderBy('uploadedAt', 'desc'));

        const unsubscribe = onSnapshot(q, snapshot => {
            const fetchedDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FileMetadata));
            setDocuments(fetchedDocs);
            setIsLoading(false);
        }, err => {
            console.error("Error fetching knowledge base:", err);
            setError("Hiba a dokumentumok betöltésekor.");
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [activeUnitId]);
    
    // File upload handler
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !activeUnitId) {
            return;
        }
        const file = e.target.files[0];
        setIsUploading(true);
        setError('');

        try {
            const maxOrder = documents.reduce((max, doc) => Math.max(max, doc.sortOrder || -1), -1);
            const newSortOrder = maxOrder + 1;

            const storagePath = `units/${activeUnitId}/knowledge_base/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, storagePath);
            const uploadResult = await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(uploadResult.ref);

            await addDoc(collection(db, 'units', activeUnitId, 'knowledge_base'), {
                name: file.name.replace(/\.[^/.]+$/, ""),
                description: '',
                url: downloadUrl,
                storagePath,
                size: file.size,
                contentType: file.type,
                uploadedBy: currentUser.fullName,
                uploadedByUid: currentUser.id,
                uploadedAt: serverTimestamp(),
                sortOrder: newSortOrder,
                unitId: activeUnitId,
            });
        } catch (err) {
            console.error("Error uploading file:", err);
            setError("Hiba a fájl feltöltésekor.");
        } finally {
            setIsUploading(false);
            if(fileInputRef.current) fileInputRef.current.value = "";
        }
    };
    
    // Edit handlers
    const handleUpdateDoc = async (docId: string, field: 'name' | 'description', value: string) => {
        if (!activeUnitId) return;
        const docRef = doc(db, 'units', activeUnitId, 'knowledge_base', docId);
        await updateDoc(docRef, { [field]: value });
    };

    const handleMove = async (index: number, direction: 'up' | 'down') => {
        if (!activeUnitId) return;
        
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= documents.length) return;

        const newDocuments = [...documents];
        [newDocuments[index], newDocuments[newIndex]] = [newDocuments[newIndex], newDocuments[index]];

        setDocuments(newDocuments);

        const batch = writeBatch(db);
        newDocuments.forEach((docData, i) => {
            const docRef = doc(db, 'units', activeUnitId, 'knowledge_base', docData.id);
            batch.update(docRef, { sortOrder: i });
        });
        await batch.commit();
    };
    
    const handleDelete = async (document: FileMetadata) => {
        if (!activeUnitId || !window.confirm(`Biztosan törölni szeretnéd a(z) "${document.name}" dokumentumot?`)) return;

        try {
            const storageRef = ref(storage, document.storagePath);
            await deleteObject(storageRef);
            await deleteDoc(doc(db, 'units', activeUnitId, 'knowledge_base', document.id));
        } catch (err: any) {
            if (err.code === 'storage/object-not-found') {
                console.warn("Storage object not found, deleting Firestore doc anyway.");
                await deleteDoc(doc(db, 'units', activeUnitId, 'knowledge_base', document.id));
            } else {
                console.error("Error deleting document:", err);
                setError("Hiba a törlés során.");
            }
        }
    };

    const formatBytes = (bytes: number, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };
    
    if (!activeUnitId) {
         return (
            <div className="p-4 md:p-8 flex items-center justify-center h-full text-center">
                <div>
                    <BookIcon className="h-16 w-16 text-gray-400 mx-auto mb-4"/>
                    <h2 className="text-2xl font-bold text-gray-700">Válassz egy egységet</h2>
                    <p className="mt-2 text-gray-600">A Tudástár használatához kérlek, válassz ki egyetlen egységet a fejlécben.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Tudástár</h1>
                {canManage && (
                    <div className="flex items-center gap-3">
                        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:bg-gray-400">
                           {isUploading ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div> : <PlusIcon className="h-5 w-5" />}
                            Feltöltés
                        </button>
                        <button onClick={() => setIsEditMode(!isEditMode)} className={`${isEditMode ? 'bg-green-700 text-white' : 'bg-gray-200 text-gray-800'} font-semibold py-2 px-4 rounded-lg hover:bg-gray-300`}>
                            {isEditMode ? 'Kész' : 'Szerkesztés'}
                        </button>
                    </div>
                )}
            </div>

            {error && <div className="bg-red-100 p-4 rounded-lg text-red-700 mb-4">{error}</div>}

            {isLoading ? <div className="relative h-64"><LoadingSpinner /></div> : 
             documents.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-gray-300 rounded-xl">
                    <BookIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700">A tudástár üres</h3>
                    <p className="text-gray-500 mt-1">{canManage ? 'Tölts fel egy dokumentumot a kezdéshez.' : 'Nincsenek elérhető dokumentumok.'}</p>
                </div>
            ) : (
                 <div className="space-y-4">
                    {documents.map((docItem, index) => (
                        <div key={docItem.id} className="bg-white p-4 rounded-xl shadow-md border flex items-start gap-4">
                            {isEditMode && canManage && (
                                <div className="flex flex-col items-center gap-1 pt-1">
                                    <button onClick={() => handleMove(index, 'up')} disabled={index === 0} className="p-1 disabled:opacity-30"><ArrowUpIcon className="h-5 w-5" /></button>
                                    <button onClick={() => handleMove(index, 'down')} disabled={index === documents.length - 1} className="p-1 disabled:opacity-30"><ArrowDownIcon className="h-5 w-5" /></button>
                                </div>
                            )}
                            <div className="flex-grow">
                                {isEditMode && canManage ? (
                                    <div className="space-y-2">
                                        <input 
                                            type="text"
                                            defaultValue={docItem.name}
                                            onBlur={(e) => handleUpdateDoc(docItem.id, 'name', e.target.value)}
                                            className="w-full font-semibold text-lg p-1 border rounded"
                                        />
                                        <textarea
                                            defaultValue={docItem.description}
                                            onBlur={(e) => handleUpdateDoc(docItem.id, 'description', e.target.value)}
                                            placeholder="Leírás..."
                                            rows={2}
                                            className="w-full text-sm p-1 border rounded"
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <h3 className="font-semibold text-lg text-gray-800">{docItem.name}</h3>
                                        {docItem.description && <p className="text-sm text-gray-600 mt-1">{docItem.description}</p>}
                                    </>
                                )}
                                <p className="text-xs text-gray-400 mt-2">
                                    Feltöltötte: {docItem.uploadedBy} - {docItem.uploadedAt?.toDate().toLocaleDateString('hu-HU')} ({formatBytes(docItem.size)})
                                </p>
                            </div>
                             <div className="flex items-center gap-2 flex-shrink-0">
                                <a href={docItem.url} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded-full" title="Megnyitás/Letöltés">
                                    <DownloadIcon className="h-5 w-5" />
                                </a>
                                {isEditMode && canManage && (
                                    <button onClick={() => handleDelete(docItem)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-full" title="Törlés">
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                 </div>
            )}
        </div>
    );
};

export default TudastarApp;