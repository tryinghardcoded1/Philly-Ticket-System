import React from 'react';
import { 
  Search, 
  Car,
  Filter, 
  Plus, 
  MoreHorizontal, 
  Phone, 
  Mail, 
  Calendar, 
  X, 
  CheckCircle2, 
  User, 
  MapPin, 
  Clock, 
  FileCheck, 
  Image as ImageIcon,
  Send,
  MessageSquare,
  AlertCircle,
  Download,
  Eye,
  Trash2
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  getDocs, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  onSnapshot,
  deleteDoc,
  Timestamp 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { cn, formatDate, OperationType, handleFirestoreError } from '../lib/utils';
import { Rental, Note, RentalStatus } from '../types';

import Papa from 'papaparse';
import { GoogleGenAI } from '@google/genai';

export default function RentalsPage() {
  const [rentals, setRentals] = React.useState<Rental[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedRental, setSelectedRental] = React.useState<Rental | null>(null);
  
  // Import States
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);
  const [importText, setImportText] = React.useState('');
  const [importFile, setImportFile] = React.useState<File | null>(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const [importStatus, setImportStatus] = React.useState('');
  const [shouldClearBeforeImport, setShouldClearBeforeImport] = React.useState(false);

  // Detail Panel State
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [newNote, setNewNote] = React.useState('');
  const [isSendingNote, setIsSendingNote] = React.useState(false);

  const fetchRentals = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'rentals'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Rental[];
      setRentals(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'rentals', auth);
    } finally {
      setLoading(false);
    }
  };

  const processImportData = (data: string) => {
    return new Promise<any[]>((resolve, reject) => {
      Papa.parse(data, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: (error) => reject(error)
      });
    });
  };

  const handleBulkImport = async () => {
    if (!importFile && !importText.trim()) return;
    setIsImporting(true);
    setImportStatus('Parsing data...');

    try {
      let rows: any[] = [];
      
      if (importFile) {
        rows = await new Promise<any[]>((resolve, reject) => {
          Papa.parse(importFile, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data),
            error: (error) => reject(error)
          });
        });
      } else {
        rows = await processImportData(importText);
      }

      if (rows.length === 0) {
          throw new Error("No data found in the provided source.");
      }

      if (shouldClearBeforeImport) {
        setImportStatus('Clearing existing records...');
        try {
          const q = query(collection(db, 'rentals'));
          const snapshot = await getDocs(q);
          const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'rentals', d.id)));
          await Promise.all(deletePromises);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'rentals', auth);
        }
      }

      setImportStatus(`Mapping ${rows.length} rows with AI...`);

      // Use Gemini to map columns if needed
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const prompt = `
        I have a CSV with the following headers: [${Object.keys(rows[0]).join(', ')}].
        I need to map these to my internal database schema:
        - firstName
        - lastName
        - customerName (fullName)
        - phone
        - email
        - dob
        - vehicle
        - plateNumber
        - startDate
        - endDate
        - status (one of: active, completed, pending, cancelled)

        Please return ONLY a JSON object where keys are my internal field names and values are the corresponding CSV header names.
        Example: {"customerName": "Client Name", "phone": "Mobile Number"}
      `;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });
      const mappingText = result.text.replace(/```json|```/g, '').trim();
      const mapping = JSON.parse(mappingText);

      setImportStatus('Syncing to Operations Database...');

      const rentalsRef = collection(db, 'rentals');
      
      try {
        for (const row of rows) {
          const rentalData: any = {
            firstName: row[mapping.firstName] || '',
            lastName: row[mapping.lastName] || '',
            customerName: row[mapping.customerName] || (row[mapping.firstName] && row[mapping.lastName] ? row[mapping.firstName] + ' ' + row[mapping.lastName] : row[mapping.firstName] || row[mapping.lastName] || 'Unknown Customer'),
            phone: row[mapping.phone] || 'N/A',
            email: row[mapping.email] || '',
            dob: row[mapping.dob] || '',
            vehicle: row[mapping.vehicle] || 'Standard Sedan',
            plateNumber: row[mapping.plateNumber] || 'TBD',
            startDate: serverTimestamp(), // Default if not parsed
            endDate: serverTimestamp(),
            status: 'pending',
            agreements: {
              accidentNotification: true,
              killSwitch: true,
              underageFee: false,
              insuranceAck: true
            },
            createdAt: serverTimestamp()
          };

          // Try to parse dates if available
          if (row[mapping.startDate]) {
            const d = new Date(row[mapping.startDate]);
            if (!isNaN(d.getTime())) rentalData.startDate = Timestamp.fromDate(d);
          }
          if (row[mapping.endDate]) {
            const d = new Date(row[mapping.endDate]);
            if (!isNaN(d.getTime())) rentalData.endDate = Timestamp.fromDate(d);
          }

          await addDoc(rentalsRef, rentalData);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'rentals', auth);
      }

      setImportStatus('Import complete!');
      setImportText('');
      setTimeout(() => {
        setIsImportModalOpen(false);
        setImportStatus('');
        fetchRentals();
      }, 1500);

    } catch (error) {
      console.error("Import failed:", error);
      let displayError = "An unknown error occurred.";
      if (error instanceof Error) {
        try {
          const parsed = JSON.parse(error.message);
          if (parsed.error && parsed.error.includes("Missing or insufficient permissions")) {
            displayError = "Security Policy Error: Make sure you are verified and the data format matches exactly.";
          } else {
            displayError = error.message;
          }
        } catch {
          displayError = error.message;
        }
      }
      setImportStatus(`Error: ${displayError}`);
    } finally {
      setIsImporting(false);
    }
  };

  React.useEffect(() => {
    fetchRentals();
  }, []);

  // Sync notes when a rental is selected
  React.useEffect(() => {
    if (!selectedRental) {
      setNotes([]);
      return;
    }

    const notesRef = collection(db, 'rentals', selectedRental.id, 'notes');
    const q = query(notesRef, orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Note[];
      setNotes(notesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `rentals/${selectedRental.id}/notes`, auth);
    });

    return () => unsubscribe();
  }, [selectedRental]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !selectedRental || isSendingNote) return;

    setIsSendingNote(true);
    try {
      const notesRef = collection(db, 'rentals', selectedRental.id, 'notes');
      await addDoc(notesRef, {
        text: newNote,
        author: auth.currentUser?.displayName || 'System Admin',
        timestamp: serverTimestamp()
      });
      setNewNote('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notes', auth);
    } finally {
      setIsSendingNote(false);
    }
  };

  const updateRentalStatus = async (id: string, newStatus: RentalStatus) => {
    try {
      await updateDoc(doc(db, 'rentals', id), { status: newStatus });
      if (selectedRental?.id === id) {
        setSelectedRental({ ...selectedRental, status: newStatus });
      }
      fetchRentals();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'rentals', auth);
    }
  };

  const filteredRentals = rentals.filter(r => 
    r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.vehicle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative flex flex-col h-full space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-0">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search name, plate, vehicle..." 
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Download size={16} />
            <span className="hidden xs:inline">Import</span>
            <span className="xs:hidden">CSV</span>
          </button>
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <Filter size={16} />
            Filter
          </button>
          <button 
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs sm:text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} />
            Add
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm h-full">
          <div className="overflow-x-auto h-full">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200">
                  <th className="px-6 py-3 font-semibold w-64">Customer Name</th>
                  <th className="px-6 py-3 font-semibold">Vehicle</th>
                  <th className="px-6 py-3 font-semibold">Plate</th>
                  <th className="px-6 py-3 font-semibold">Pickup</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <Clock className="animate-spin text-indigo-400" size={24} />
                        <span className="font-medium">Loading data...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredRentals.length > 0 ? (
                  filteredRentals.map((rental) => (
                    <tr 
                      key={rental.id} 
                      onClick={() => setSelectedRental(rental)}
                      className={cn(
                        "hover:bg-slate-50/80 transition-colors cursor-pointer group",
                        selectedRental?.id === rental.id && "bg-indigo-50/50"
                      )}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <User size={14} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 truncate">{rental.customerName}</div>
                            <div className="text-[10px] text-slate-500 truncate">{rental.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">{rental.vehicle}</td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[10px] font-bold text-slate-600 font-mono">
                          {rental.plateNumber}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">{formatDate(rental.startDate)}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          rental.status === 'active' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                          rental.status === 'completed' ? "bg-blue-50 text-blue-600 border border-blue-100" :
                          rental.status === 'pending' ? "bg-amber-50 text-amber-600 border border-amber-100" : 
                          "bg-slate-100 text-slate-500 border border-slate-200"
                        )}>
                          {rental.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors">
                          <MoreHorizontal size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">No records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4 px-4">
          {loading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
               <Clock className="animate-spin" size={32} />
               <p className="font-bold text-sm">Syncing operations...</p>
             </div>
          ) : filteredRentals.length > 0 ? (
            filteredRentals.map((rental) => (
              <div 
                key={rental.id} 
                onClick={() => setSelectedRental(rental)}
                className={cn(
                  "bg-white rounded-xl border border-slate-200 p-4 shadow-sm active:scale-[0.98] transition-transform",
                  selectedRental?.id === rental.id && "border-indigo-500 bg-indigo-50/30"
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <User size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{rental.customerName}</h4>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{rental.vehicle}</p>
                    </div>
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                    rental.status === 'active' ? "bg-emerald-100 text-emerald-700" :
                    rental.status === 'completed' ? "bg-blue-100 text-blue-700" :
                    "bg-amber-100 text-amber-700"
                  )}>
                    {rental.status}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
                  <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[10px] font-bold text-slate-600 font-mono italic">
                    {rental.plateNumber}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                    <Calendar size={12} />
                    {formatDate(rental.startDate)}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 text-slate-400 font-medium">No records found.</div>
          )}
        </div>
      </div>

      {/* Detail Drawer Overlay */}
      <AnimatePresence>
        {isImportModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80]"
              onClick={() => !isImporting && setIsImportModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-2xl shadow-2xl z-[90] overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Bulk Operations Import</h3>
                  <p className="text-xs text-slate-500">Paste your Google Sheet CSV export below</p>
                </div>
                <button 
                  onClick={() => setIsImportModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-3">
                  <AlertCircle className="text-amber-600 shrink-0" size={20} />
                  <div className="text-[11px] text-amber-800 leading-relaxed">
                    <p className="font-bold mb-1 uppercase tracking-wider">Pro-Tip for Private Sheets:</p>
                    <p>In Google Sheets, go to <b>File {'>'} Download {'>'} Comma Separated Values (.csv)</b> and upload that file here. Our AI will automatically map your columns.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Upload CSV File</label>
                  <label className={cn(
                    "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 hover:border-indigo-400 transition-all cursor-pointer group",
                    importFile && "bg-indigo-50 border-indigo-200"
                  )}>
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      {importFile ? (
                        <>
                          <FileCheck className="w-8 h-8 text-indigo-500 mb-2" />
                          <p className="text-xs font-bold text-indigo-900">{importFile.name}</p>
                          <p className="text-[10px] text-indigo-500 mt-1">{(importFile.size / 1024).toFixed(1)} KB • Ready to import</p>
                        </>
                      ) : (
                        <>
                          <Download className="w-8 h-8 text-slate-300 group-hover:text-indigo-400 transition-colors mb-2" />
                          <p className="text-xs text-slate-500 font-bold group-hover:text-slate-700 transition-colors">Drop CSV file here or click</p>
                          <p className="text-[10px] text-slate-400 mt-1">UTF-8 Comma-separated values only</p>
                        </>
                      )}
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".csv" 
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-100"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
                    <span className="bg-white px-2 text-slate-300">Or Paste Text</span>
                  </div>
                </div>

                <textarea
                  className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  placeholder="Paste csv raw text here..."
                  value={importText}
                  onChange={(e) => {
                    setImportText(e.target.value);
                    if (e.target.value.trim()) setImportFile(null);
                  }}
                  disabled={isImporting}
                />

                <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={shouldClearBeforeImport} 
                    onChange={(e) => setShouldClearBeforeImport(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-700">Clear existing records first</p>
                    <p className="text-[10px] text-slate-400">Wait until the dashboard is empty before starting the new import</p>
                  </div>
                </label>

                {importStatus && (
                  <div className="flex items-center gap-3 text-xs font-bold text-indigo-600 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                    <Clock className="animate-spin" size={14} />
                    {importStatus}
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button 
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportFile(null);
                    setImportText('');
                    setImportStatus('');
                  }}
                  className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 disabled:opacity-50"
                  disabled={isImporting}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleBulkImport}
                  className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-sm disabled:opacity-50 flex items-center gap-2"
                  disabled={isImporting || (!importText.trim() && !importFile)}
                >
                  {isImporting ? <Clock className="animate-spin" size={18} /> : <Plus size={18} />}
                  Start AI Import
                </button>
              </div>
            </motion.div>
          </>
        )}

        {selectedRental && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRental(null)}
              className="fixed inset-0 bg-slate-900/10 backdrop-blur-[2px] z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-[70] border-l border-slate-200 flex flex-col"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                    <FileCheck size={24} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">{selectedRental.customerName}</h2>
                    <p className="text-[10px] text-slate-400 font-mono truncate">ID: {selectedRental.id.toUpperCase()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select 
                    value={selectedRental.status}
                    onChange={(e) => updateRentalStatus(selectedRental.id, e.target.value as RentalStatus)}
                    className="hidden sm:block text-xs font-bold uppercase rounded-lg border border-slate-200 px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <button 
                    onClick={() => setSelectedRental(null)}
                    className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 sm:space-y-10">
                {/* Mobile Status Select */}
                <div className="sm:hidden">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Update Status</label>
                  <select 
                    value={selectedRental.status}
                    onChange={(e) => updateRentalStatus(selectedRental.id, e.target.value as RentalStatus)}
                    className="w-full text-sm font-bold uppercase rounded-xl border border-slate-200 px-4 py-3 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {/* Visual Overview */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <User size={12} /> Customer Information
                    </h3>
                    <div className="grid gap-3">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Address</label>
                        <p className="text-sm font-medium text-slate-700 capitalize">
                          {selectedRental.streetAddress || 'N/A'}, {selectedRental.city || ''} {selectedRental.state || ''}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Phone</label>
                          <p className="text-sm font-bold text-indigo-600 truncate">{selectedRental.phone}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">DOB</label>
                          <p className="text-sm font-bold text-slate-700">{selectedRental.dob || '01/01/1990'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Car size={12} /> Rental Details
                    </h3>
                    <div className="grid gap-3">
                      <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg">
                        <label className="text-[9px] font-bold text-indigo-400 uppercase">Vehicle</label>
                        <p className="text-sm font-bold text-indigo-900">{selectedRental.vehicle}</p>
                        <p className="text-xs font-mono text-indigo-500 font-bold mt-1 tracking-wider uppercase">{selectedRental.plateNumber}</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center justify-between">
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase block">Submission ID</label>
                          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-tight">{selectedRental.submissionId || 'SUB-7721-002'}</p>
                        </div>
                        <button className="p-2 hover:bg-slate-100 rounded text-slate-400 transition-colors">
                           <Eye size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Agreements Section */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Agreements & Verification</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: 'Accident Policy', val: selectedRental.agreements?.accidentNotification },
                      { label: 'Kill Switch Ack', val: selectedRental.agreements?.killSwitch },
                      { label: 'Underage Fee', val: selectedRental.agreements?.underageFee },
                      { label: 'Insurance Ack', val: selectedRental.agreements?.insuranceAck },
                    ].map((ack, i) => (
                      <div key={i} className={cn(
                        "p-3 rounded-lg border flex flex-col gap-2 items-center text-center",
                        ack.val ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-slate-50 border-slate-100 text-slate-400"
                      )}>
                        {ack.val ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        <span className="text-[9px] font-bold leading-tight">{ack.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Documents Grid */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Document Vault</h3>
                    <button className="text-indigo-600 text-[10px] font-bold flex items-center gap-1 hover:underline">
                      <Download size={12} /> Sync Docs
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { label: "Driver's License", key: 'licenseFile' },
                      { label: "Selfie Holding ID", key: 'selfieFile' },
                      { label: "Proof of Insurance", key: 'insuranceFile' },
                    ].map((doc, i) => (
                      <div key={i} className="group relative aspect-[16/9] sm:aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                        <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                          {selectedRental[doc.key as keyof Rental] ? <ImageIcon size={32} /> : <Clock size={32} />}
                        </div>
                        {selectedRental[doc.key as keyof Rental] && (
                           <img 
                             src={selectedRental[doc.key as keyof Rental] as string} 
                             alt={doc.label}
                             className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-110"
                           />
                        )}
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                           <button className="p-2 bg-white rounded-lg text-slate-900 shadow-xl hover:bg-slate-50"><Eye size={16} /></button>
                           <button className="p-2 bg-white rounded-lg text-slate-900 shadow-xl hover:bg-slate-50"><Download size={16} /></button>
                        </div>
                        <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-slate-900/80 to-transparent">
                          <p className="text-[9px] font-bold text-white truncate uppercase tracking-widest">{doc.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* VA Notes Section */}
                <div className="space-y-4 pb-12">
                   <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                     <MessageSquare size={12} /> VA Operations Notes
                   </h3>
                   
                   <div className="space-y-3">
                      {/* Note Input */}
                      <form onSubmit={handleAddNote} className="relative">
                        <textarea 
                          placeholder="Add team note (e.g. suspension check pending...)"
                          className="w-full rounded-xl border border-slate-200 bg-white p-4 pr-12 text-sm min-h-[80px] focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-sm"
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                        />
                        <button 
                          disabled={!newNote.trim() || isSendingNote}
                          className="absolute bottom-4 right-4 p-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50 hover:bg-indigo-700 transition-colors"
                        >
                          {isSendingNote ? <Clock className="animate-spin" size={18} /> : <Send size={18} />}
                        </button>
                      </form>

                      {/* Notes List */}
                      <div className="space-y-3">
                        {notes.map((note) => (
                          <div key={note.id} className="bg-slate-50 border border-slate-100 rounded-xl p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                               <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[10px] font-bold">
                                    {note.author[0]}
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-700">{note.author}</span>
                               </div>
                               <span className="text-[9px] text-slate-400 font-medium">
                                 {note.timestamp ? formatDate(note.timestamp) : 'Just now'}
                               </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">{note.text}</p>
                          </div>
                        ))}
                        {notes.length === 0 && (
                          <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                             <p className="text-xs text-slate-400">No operations notes recorded yet.</p>
                          </div>
                        )}
                      </div>
                   </div>
                </div>

                {/* Placeholder Future Sections */}
                <div className="border-t border-slate-100 pt-8 opacity-50 pointer-events-none mb-10">
                   <h3 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-4">Upcoming Features</h3>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="border-2 border-dashed border-slate-100 rounded-xl p-4 flex flex-col items-center justify-center text-slate-200">
                        <AlertCircle size={24} />
                        <span className="text-[10px] font-bold mt-2">LINKED VIOLATIONS</span>
                      </div>
                      <div className="border-2 border-dashed border-slate-100 rounded-xl p-4 flex flex-col items-center justify-center text-slate-200">
                        <Trash2 size={24} />
                        <span className="text-[10px] font-bold mt-2">UNPAID BALANCES</span>
                      </div>
                   </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
