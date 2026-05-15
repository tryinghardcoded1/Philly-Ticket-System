import React from 'react';
import { collection, addDoc, serverTimestamp, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { extractTicketData } from '../services/aiService';
import { Upload, X, CheckCircle2, ShieldAlert, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function TicketUploadPage() {
  const [images, setImages] = React.useState<{id: string, file: File, dataUrl: string, status: 'pending' | 'uploading' | 'analyzing' | 'success' | 'error', extractedData?: any, errorMsg?: string}[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = async (files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    
    for (const file of validFiles) {
      // Compress image to avoid 1MB Firestore limit
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // heavily compressed

          setImages(prev => [...prev, {
            id: Math.random().toString(36).substring(7),
            file,
            dataUrl,
            status: 'pending'
          }]);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const processAll = async () => {
    for (const img of images) {
      if (img.status === 'pending' || img.status === 'error') {
        await processSingleImage(img.id);
      }
    }
  };

  const processSingleImage = async (id: string) => {
    const imgData = images.find(i => i.id === id);
    if (!imgData) return;

    setImages(prev => prev.map(img => img.id === id ? { ...img, status: 'analyzing' } : img));

    try {
      // 1. Ask Frontend AI Service to extract
      const extractedBase = await extractTicketData(imgData.file);
      const extracted = {
        plate_number: extractedBase.plateNumber,
        violation_date: extractedBase.violationDate,
        amount: extractedBase.amount,
        violation_type: extractedBase.violationType,
        state: extractedBase.location
      };

      setImages(prev => prev.map(img => img.id === id ? { ...img, status: 'uploading', extractedData: extracted } : img));

      // 2. See if we can match a customer/rental
      let matchedCustomer = 'Unknown';
      let rentalId = '';
      if (extracted.plate_number) {
        const q = query(collection(db, 'rentals'), where('plateNumber', '==', extracted.plate_number));
        const rentalsSnap = await getDocs(q);
        // Find a rental that overlaps the violation date
        const vDate = new Date(extracted.violation_date || '');
        for (const rentalDoc of rentalsSnap.docs) {
          const rData = rentalDoc.data();
          const start = rData.startDate.toDate();
          const end = rData.endDate.toDate();
          if (vDate >= start && vDate <= end) {
            matchedCustomer = rData.customerName;
            rentalId = rentalDoc.id;
            break;
          }
        }
      }

      // 3. Save to Firestore tickets collection
      const ticketPayload = {
        plateNumber: extracted.plate_number || 'UNKNOWN',
        violationDate: extracted.violation_date ? Timestamp.fromDate(new Date(extracted.violation_date)) : serverTimestamp(),
        amount: Number(extracted.amount) || 0,
        violationType: extracted.violation_type || 'Unknown Violation',
        state: extracted.state || '',
        matchedCustomer,
        rentalId,
        status: 'unpaid',
        ticketImage: imgData.dataUrl,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'tickets'), ticketPayload);

      setImages(prev => prev.map(img => img.id === id ? { ...img, status: 'success' } : img));

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'ticket-upload', auth);
      setImages(prev => prev.map(img => img.id === id ? { ...img, status: 'error', errorMsg: 'Failed to process' } : img));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="text-indigo-600" />
            Upload Tickets
          </h1>
          <p className="text-sm text-slate-500 mt-1">AI will automatically extract details and match to rentals.</p>
        </div>

        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center transition-all cursor-pointer
            ${isDragging ? 'border-indigo-500 bg-indigo-50 scale-[1.02]' : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'}
          `}
        >
          <input type="file" multiple accept="image/*" className="hidden" id="ticket-upload" onChange={handleFileSelect} />
          <label htmlFor="ticket-upload" className="flex flex-col items-center cursor-pointer w-full h-full">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400 group-hover:text-indigo-500 transition-colors">
              <Upload size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Drag & Drop tickets here</h3>
            <p className="text-sm text-slate-500 mt-2">or click to browse files</p>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-6">Supports JPG, PNG</span>
          </label>
        </div>

        <div className="space-y-4">
          <AnimatePresence>
            {images.map((img) => (
              <motion.div 
                key={img.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row gap-6 items-start sm:items-center"
              >
                <div className="w-full sm:w-32 h-32 bg-slate-100 rounded-xl overflow-hidden shrink-0 relative group">
                  <img src={img.dataUrl} alt="Ticket preview" className="w-full h-full object-cover" />
                  {img.status !== 'success' && img.status !== 'analyzing' && img.status !== 'uploading' && (
                    <button 
                      onClick={() => removeImage(img.id)}
                      className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg text-rose-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-slate-800 truncate pr-4">{img.file.name}</h4>
                    {img.status === 'success' && <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md"><CheckCircle2 size={12}/> Done</span>}
                    {img.status === 'analyzing' && <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md"><Loader2 size={12} className="animate-spin"/> Extracting</span>}
                    {img.status === 'uploading' && <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md"><Loader2 size={12} className="animate-spin"/> Saving</span>}
                    {img.status === 'error' && <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-rose-600 bg-rose-50 px-2 py-1 rounded-md"><AlertCircle size={12}/> Error</span>}
                    {img.status === 'pending' && <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-1 rounded-md">Pending</span>}
                  </div>

                  {img.status === 'success' && img.extractedData && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-slate-400">Plate:</span> <span className="font-mono font-bold text-slate-700">{img.extractedData.plate_number}</span></div>
                      <div><span className="text-slate-400">Date:</span> <span className="font-bold text-slate-700">{img.extractedData.violation_date}</span></div>
                      <div><span className="text-slate-400">Amount:</span> <span className="font-bold text-rose-600">${img.extractedData.amount}</span></div>
                      <div><span className="text-slate-400">Type:</span> <span className="font-bold text-slate-700">{img.extractedData.violation_type}</span></div>
                    </div>
                  )}

                  {img.errorMsg && (
                    <p className="text-xs text-rose-500 font-medium">{img.errorMsg}</p>
                  )}
                </div>

                <div className="w-full sm:w-auto">
                    {img.status === 'pending' || img.status === 'error' ? (
                       <button 
                        onClick={() => processSingleImage(img.id)}
                        className="w-full sm:w-auto px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
                      >
                       Process Now
                      </button>
                    ) : null}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        
        {images.some(i => i.status === 'pending' || i.status === 'error') && (
          <div className="flex justify-end pt-4">
            <button 
              onClick={processAll}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-700 transition-colors"
            >
              Process All Pending Documents
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
