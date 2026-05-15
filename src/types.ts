export type RentalStatus = 'active' | 'completed' | 'pending' | 'cancelled';
export type TicketStatus = 'unpaid' | 'paid' | 'contested';
export type VehicleStatus = 'available' | 'rented' | 'maintenance';

export interface Note {
  id: string;
  text: string;
  author: string;
  timestamp: any;
}

export interface Rental {
  id: string;
  // Customer Info
  firstName: string;
  lastName: string;
  customerName: string; // Combined for convenience
  phone: string;
  email: string;
  dob: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  
  // Rental Info
  vehicle: string;
  plateNumber: string;
  startDate: any; // Firestore Timestamp
  endDate: any;
  submissionId?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  
  // Agreements
  agreements: {
    accidentNotification: boolean;
    killSwitch: boolean;
    underageFee: boolean;
    insuranceAck: boolean;
  };
  
  // Status
  status: RentalStatus;
  
  // Documents
  licenseFile?: string;
  selfieFile?: string;
  insuranceFile?: string;
  signatureFile?: string;
  
  createdAt: any;
}

export interface Ticket {
  id: string;
  plateNumber: string;
  violationDate: any;
  amount: number;
  location?: string;
  violationType?: string;
  state?: string;
  matchedCustomer?: string;
  rentalId?: string;
  status: TicketStatus;
  ticketImage?: string;
  suggestions?: {
    id: string;
    customerName: string;
    plateNumber: string;
    score: number;
  }[];
  createdAt: any;
}

export interface Customer {
  id: string; // customer_id
  name: string;
  email: string;
  phone: string;
  address: string;
  driverLicenseUrl?: string;
  insuranceUrl?: string;
  signatureUrl?: string;
  createdAt: any;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  color: string;
  status: VehicleStatus;
  createdAt: any;
}
