import React from 'react';
import { 
  Car, 
  FileText, 
  Ticket as TicketIcon, 
  TrendingUp, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../lib/utils';
import { Rental, Ticket } from '../types';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: { value: number; isUp: boolean };
  color: string;
}

function StatCard({ title, value, icon: Icon, trend, color }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{title}</p>
      <div className="flex items-end justify-between">
        <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
        {trend && (
          <span className={cn(
            "text-xs font-medium px-2 py-1 rounded-full",
            trend.isUp ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"
          )}>
            {trend.isUp ? '+' : '-'}{trend.value}%
          </span>
        )}
        {!trend && (
           <div className={cn("rounded-lg p-2 bg-slate-50 text-slate-400")}>
             <Icon size={20} />
           </div>
        )}
      </div>
    </div>
  );
}

// Inline cn to avoid extra imports if possible, but we have it
import { cn } from '../lib/utils';

interface DashboardProps {
  rentals: Rental[];
  tickets: Ticket[];
}

export default function Dashboard({ rentals, tickets }: DashboardProps) {
  const navigate = useNavigate();
  const activeRentals = rentals.filter(r => r.status === 'active').length;
  const unpaidTickets = tickets.filter(t => t.status === 'unpaid').length;
  const totalRevenue = tickets.reduce((acc, t) => acc + (t.status === 'paid' ? t.amount : 0), 24500); // Base mock revenue

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Active Rentals" 
          value={activeRentals} 
          icon={Car} 
          color="bg-indigo-600"
          trend={{ value: 12, isUp: true }}
        />
        <StatCard 
          title="Available" 
          value={18} 
          icon={Car} 
          color="bg-slate-100"
        />
        <StatCard 
          title="Unpaid" 
          value={unpaidTickets} 
          icon={AlertTriangle} 
          color="bg-rose-600"
          trend={{ value: 5, isUp: false }}
        />
        <StatCard 
          title="Revenue" 
          value={`$${totalRevenue.toLocaleString()}`} 
          icon={TrendingUp} 
          color="bg-indigo-600"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Rentals */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <h4 className="font-bold text-slate-800 text-sm sm:text-base">Recent Rentals</h4>
            <button 
              onClick={() => navigate('/rentals')}
              className="text-indigo-600 text-[11px] sm:text-sm font-bold hover:underline uppercase tracking-tight"
            >
              View All
            </button>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left min-w-[500px] md:min-w-0">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3 text-center">Plate</th>
                  <th className="px-5 py-3">Vehicle</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {rentals.slice(0, 5).map((rental) => (
                  <tr key={rental.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-800 text-xs">{rental.customerName}</div>
                      <div className="text-[9px] text-slate-500 font-mono">#RNT-{rental.id.slice(0, 4).toUpperCase()}</div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-[9px] font-bold uppercase tracking-tight">
                        {rental.plateNumber}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[11px] text-slate-600 font-medium truncate max-w-[120px]">{rental.vehicle}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider",
                        rental.status === 'active' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                      )}>
                        {rental.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rentals.length === 0 && <p className="text-center text-slate-400 py-8 text-xs font-medium">No recent rentals found.</p>}
          </div>
        </div>

        {/* Recent Tickets Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <h4 className="font-bold text-slate-800 text-sm sm:text-base">Recent Violations</h4>
            <button 
              onClick={() => navigate('/tickets')}
              className="text-indigo-600 text-[11px] sm:text-sm font-bold hover:underline uppercase tracking-tight"
            >
              View All
            </button>
          </div>
          <div className="p-4 sm:p-5 space-y-3 overflow-auto max-h-[350px]">
            {tickets.slice(0, 5).map((ticket) => (
              <div key={ticket.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 transition-colors hover:bg-slate-100 group">
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-sm border",
                  ticket.status === 'unpaid' ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                )}>
                  <TicketIcon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{ticket.plateNumber}</p>
                    <p className="text-xs font-bold text-rose-600">${ticket.amount}</p>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-[10px] text-slate-500 font-bold truncate max-w-[120px] uppercase tracking-tight">{ticket.matchedCustomer || 'Unmatched'}</p>
                    <p className="text-[9px] text-slate-400 font-medium">{formatDate(ticket.violationDate)}</p>
                  </div>
                </div>
              </div>
            ))}
            {tickets.length === 0 && <p className="text-center text-slate-400 py-4 text-xs font-medium">No recent tickets found.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
