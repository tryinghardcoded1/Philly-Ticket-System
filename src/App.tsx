import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, getDocs, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db, loginWithGoogle, logout } from './lib/firebase';
import { handleFirestoreError, OperationType } from './lib/utils';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import RentalsPage from './components/RentalsPage';
import TicketsPage from './components/TicketsPage';
import VehiclesPage from './components/VehiclesPage';
import CustomersPage from './components/CustomersPage';
import FormPage from './components/FormPage';
import TicketUploadPage from './components/TicketUploadPage';
import Chatbot from './components/Chatbot';
import { Rental, Ticket, Vehicle } from './types';
import { Car, Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = React.useState<User | null>(null);
  const [authLoading, setAuthLoading] = React.useState(true);
  
  const [rentals, setRentals] = React.useState<Rental[]>([]);
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([]);
  const [dataLoading, setDataLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchData = async () => {
    if (!user) return;
    setDataLoading(true);
    try {
      const [rentalsSnap, ticketsSnap, vehiclesSnap] = await Promise.all([
        getDocs(query(collection(db, 'rentals'))),
        getDocs(query(collection(db, 'tickets'))),
        getDocs(query(collection(db, 'vehicles')))
      ]);

      const rData = rentalsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Rental));
      const tData = ticketsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ticket));
      const vData = vehiclesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle));

      setRentals(rData);
      setTickets(tData);
      setVehicles(vData);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'initial-data-load', auth);
    } finally {
      setDataLoading(false);
    }
  };

  React.useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  // Public Routes that don't require Authentication
  const PublicRoutes = (
    <Routes>
      <Route path="/rental-form" element={<FormPage />} />
      <Route path="/ticket-upload" element={<TicketUploadPage />} />
      <Route path="*" element={
        <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-4 font-sans">
          <div className="w-full max-w-[400px] rounded-xl bg-white p-10 shadow-sm border border-slate-200">
            <div className="mb-10 text-center">
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                <Car size={28} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">Philly Car</h1>
              <p className="mt-2 text-slate-500 text-sm font-medium">Operations Dashboard Login</p>
            </div>
            
            <button 
              onClick={loginWithGoogle}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3.5 font-bold text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-full h-full"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/><path fill="none" d="M1 1h22v22H1z"/></svg>
              </div>
              Sign in with Google
            </button>
            
            <div className="mt-8 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Authorized Access Only
              </p>
            </div>
          </div>
        </div>
      } />
    </Routes>
  );

  if (!user) {
    return PublicRoutes;
  }

  return (
    <Layout user={user} onLogout={logout}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard rentals={rentals} tickets={tickets} />} />
        <Route path="/rentals" element={<RentalsPage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/vehicles" element={<VehiclesPage />} />
        <Route path="/customers" element={<CustomersPage rentals={rentals} />} />
        {/* Make public routes accessible while logged in as well */}
        <Route path="/rental-form" element={<FormPage />} />
        <Route path="/ticket-upload" element={<TicketUploadPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Chatbot rentals={rentals} tickets={tickets} vehicles={vehicles} />
    </Layout>
  );
}
