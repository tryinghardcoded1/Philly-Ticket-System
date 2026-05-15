import React from 'react';
import { 
  Car, 
  Settings, 
  Plus, 
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Wrench,
  ChevronRight
} from 'lucide-react';
import { collection, getDocs, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { cn, OperationType, handleFirestoreError } from '../lib/utils';
import { Vehicle } from '../types';

export default function VehiclesPage() {
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'vehicles'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Vehicle[];
      setVehicles(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'vehicles', auth);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchVehicles();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between px-4 sm:px-0">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search fleet by model, plate..." 
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-2">
          <Plus size={18} />
          Add Vehicle
        </button>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 px-4 sm:px-0">
        {loading ? (
          <div className="col-span-full py-20 text-center text-slate-400">Loading fleet...</div>
        ) : vehicles.length > 0 ? (
          vehicles.map((vehicle) => (
            <div key={vehicle.id} className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
              <div className="relative h-44 bg-slate-50 border-b border-slate-100">
                 {/* Placeholder for vehicle image */}
                 <div className="flex h-full w-full items-center justify-center text-slate-200">
                    <Car size={64} className="transition-transform group-hover:scale-105" />
                 </div>
                 <div className={cn(
                   "absolute top-4 right-4 flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
                   vehicle.status === 'available' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                   vehicle.status === 'rented' ? "bg-indigo-50 text-indigo-600 border-indigo-100" : "bg-amber-50 text-amber-600 border-amber-100"
                 )}>
                   {vehicle.status}
                 </div>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-base font-bold text-slate-800">{vehicle.year} {vehicle.make} {vehicle.model}</h4>
                    <span className="mt-1 inline-block font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase">
                      {vehicle.plateNumber}
                    </span>
                  </div>
                  <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                    <Settings size={18} />
                  </button>
                </div>
                
                <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {vehicle.color}
                  </div>
                  <button className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline">
                    Manage <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center">
            <p className="text-slate-400">No vehicles in the database. Add your first vehicle.</p>
          </div>
        )}
      </div>
    </div>
  );
}
