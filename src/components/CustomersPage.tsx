import React from 'react';
import { collection, getDocs, query, orderBy, Timestamp, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Customer, Rental } from '../types';
import { handleFirestoreError, OperationType, formatDate } from '../lib/utils';
import { Users, UserPlus, Search, Phone, Mail, MapPin, SearchX, Clock, ChevronRight, FileText, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function CustomersPage({ rentals }: { rentals: Rental[] }) {
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: '', email: '', phone: '', address: '', driverLicenseUrl: '', insuranceUrl: '', signatureUrl: ''
  });
  
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'customers', auth);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchCustomers();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'customers'), {
        ...formData,
        createdAt: serverTimestamp()
      });
      setShowAddModal(false);
      setFormData({ name: '', email: '', phone: '', address: '', driverLicenseUrl: '', insuranceUrl: '', signatureUrl: '' });
      fetchCustomers();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'customers', auth);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6 px-4 sm:px-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Users size={24} className="text-indigo-600" />
          Customers
        </h1>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <UserPlus size={18} />
          Add Customer
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="Search customers..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
        />
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-20 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin" size={32} />
            Loading customers...
          </div>
        ) : filteredCustomers.length > 0 ? (
          filteredCustomers.map(customer => {
            const customerRentals = rentals.filter(r => r.email === customer.email || r.phone === customer.phone || r.customerName === customer.name);
            return (
              <div 
                key={customer.id} 
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                onClick={() => setSelectedCustomer(customer)}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold text-lg shrink-0">
                    {customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">{customer.name}</h3>
                    <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                      <Mail size={12} /> {customer.email}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2 mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Phone size={14} className="text-slate-400" />
                    <span>{customer.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Clock size={14} className="text-slate-400" />
                    <span>{customerRentals.length} Rentals</span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
           <div className="col-span-full py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
              <SearchX size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">No customers found</p>
           </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Add Customer</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Phone</label>
                <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Address</label>
                <input required type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Driver License URL (Optional)</label>
                <input type="url" value={formData.driverLicenseUrl} onChange={e => setFormData({...formData, driverLicenseUrl: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Insurance URL (Optional)</label>
                <input type="url" value={formData.insuranceUrl} onChange={e => setFormData({...formData, insuranceUrl: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Signature URL (Optional)</label>
                <input type="url" value={formData.signatureUrl} onChange={e => setFormData({...formData, signatureUrl: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm">Save Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Drawer */}
      <AnimatePresence>
        {selectedCustomer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCustomer(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl z-[70] border-l border-slate-200 flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-4">
                   <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-xl shrink-0">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedCustomer.name}</h2>
                    <p className="text-sm text-slate-500 flex items-center gap-1"><Mail size={14}/> {selectedCustomer.email}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Contact Info</h3>
                  <div className="flex items-center gap-3 text-sm font-medium text-slate-700">
                    <Phone size={16} className="text-slate-400" /> {selectedCustomer.phone}
                  </div>
                  <div className="flex items-start gap-3 text-sm font-medium text-slate-700">
                    <MapPin size={16} className="text-slate-400 mt-0.5" /> 
                    <span className="leading-relaxed">{selectedCustomer.address}</span>
                  </div>
                </div>

                <div>
                   <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                     <FileText size={18} className="text-indigo-500" />
                     Saved Documents
                   </h3>
                   <div className="grid grid-cols-2 gap-4">
                     {selectedCustomer.driverLicenseUrl ? (
                         <a href={selectedCustomer.driverLicenseUrl} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors group">
                           <FileText className="text-slate-400 group-hover:text-indigo-500 mb-2" size={24} />
                           <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-700">Driver License</span>
                         </a>
                     ) : (
                        <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                          <span className="text-xs font-medium">No License</span>
                        </div>
                     )}
                     {selectedCustomer.insuranceUrl ? (
                         <a href={selectedCustomer.insuranceUrl} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors group">
                           <FileText className="text-slate-400 group-hover:text-indigo-500 mb-2" size={24} />
                           <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-700">Insurance</span>
                         </a>
                     ) : (
                        <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                          <span className="text-xs font-medium">No Insurance</span>
                        </div>
                     )}
                     {selectedCustomer.signatureUrl ? (
                         <a href={selectedCustomer.signatureUrl} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors group">
                           <FileText className="text-slate-400 group-hover:text-indigo-500 mb-2" size={24} />
                           <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-700">Signature</span>
                         </a>
                     ) : (
                        <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                          <span className="text-xs font-medium">No Signature</span>
                        </div>
                     )}
                   </div>
                </div>

                <div>
                   <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                     <Clock size={18} className="text-indigo-500" />
                     Rental History
                   </h3>
                   <div className="space-y-3">
                     {(() => {
                       const history = rentals.filter(r => r.email === selectedCustomer.email || r.phone === selectedCustomer.phone || r.customerName === selectedCustomer.name);
                       if (history.length === 0) return <p className="text-sm text-slate-500">No previous rentals.</p>;
                       return history.map(rental => (
                         <div key={rental.id} className="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-xl">
                           <div>
                             <p className="font-bold text-slate-800 text-sm">{rental.vehicle}</p>
                             <p className="text-[10px] text-slate-500 font-mono tracking-tighter">{rental.plateNumber}</p>
                           </div>
                           <div className="text-right">
                             <p className="text-xs font-medium text-slate-600">{formatDate(rental.startDate)}</p>
                             <span className={cn(
                                "inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase",
                                rental.status === 'completed' ? "bg-slate-100 text-slate-600" :
                                rental.status === 'active' ? "bg-emerald-100 text-emerald-700" :
                                "bg-amber-100 text-amber-700"
                              )}>
                                {rental.status}
                              </span>
                           </div>
                         </div>
                       ))
                     })()}
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
