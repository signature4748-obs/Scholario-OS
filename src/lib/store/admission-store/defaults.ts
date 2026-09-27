import type { AdmissionFormData } from '@/components/principal/modules/admission/types'
import type { FeeDataState } from '@/components/principal/modules/FeeStructureStep'
import type { SectionKey, SectionReviewState } from './types'

/**
 * Section review defaults — NEUTRAL. 'Complete' means "no officer flag";
 * the Verification workspace derives real statuses from application data.
 * No invented verification remarks (spec §37).
 */
export const defaultSectionReviews = (): Record<SectionKey, SectionReviewState> => ({
  personal: { status: 'Complete', remarks: '' },
  parents: { status: 'Complete', remarks: '' },
  address: { status: 'Complete', remarks: '' },
  previousSchool: { status: 'Complete', remarks: '' },
  medical: { status: 'Complete', remarks: '' },
  classAllocation: { status: 'Complete', remarks: '' },
  fees: { status: 'Complete', remarks: '' },
  documents: { status: 'Complete', remarks: '' },
  photo: { status: 'Complete', remarks: '' },
})

/**
 * Neutral blank base for any NEW admission draft. Never carries another
 * applicant's identity, documents, or photo — a draft starts empty and is
 * filled by the wizard (spec §37: no fake data in production paths).
 */
export const defaultInitialFormData: AdmissionFormData = {
  admissionType: 'fresh',
  firstName: '',
  lastName: '',
  dob: '',
  gender: 'Female',
  bloodGroup: '',
  nationality: 'Indian',
  religion: 'Hindu',
  category: '',
  aadhaarNo: '',

  fatherName: '',
  fatherOccupation: '',
  fatherPhone: '',
  fatherEmail: '',
  fatherAadhaar: '',
  motherName: '',
  motherOccupation: '',
  motherPhone: '',
  motherEmail: '',
  motherAadhaar: '',
  primaryComm: 'father',

  emergencyName: '',
  emergencyRelation: 'Guardian',
  emergencyPhone: '',

  currentAddress: '',
  country: 'India',
  state: 'Uttar Pradesh',
  district: '',
  city: '',
  pincode: '',
  sameAsCurrentAddress: true,
  permAddress: '',
  permCountry: 'India',
  permState: 'Uttar Pradesh',
  permDistrict: '',
  permCity: '',
  permPincode: '',

  previousSchool: '',
  previousLocation: '',
  previousBoard: '',
  previousYear: '',
  previousClass: '',
  previousSection: '',
  stream: '',
  tcStatus: 'pending',
  tcNumber: '',
  tcDate: '',
  reasonForLeaving: '',
  previousMarks: '',
  academicRemarks: '',

  heightCm: '',
  weightKg: '',
  allergies: '',
  conditions: '',
  specialNeeds: '',
  emergencyNotes: '',
  medicationInstructions: '',
  doctorName: '',
  doctorPhone: '',
  vaccinationStatus: 'Pending',

  className: '',
  section: '',

  transportRequired: false,
  transportRoute: '',
  pickupPoint: '',
  dropPoint: '',
  hostelRequired: false,
  hostelRoomType: '',

  docStatuses: {},
  photoUploaded: false,
  photoDataUrl: null,
  scannedAttachment: null,
}

/**
 * Ira Malhotra's seed application (the demo "Submitted" record). Full,
 * coherent identity of her own — documents are plain "uploaded" records
 * with filenames only (no invented OCR scores, verifiers, or timestamps).
 */
export const iraSeedFormData: AdmissionFormData = {
  ...defaultInitialFormData,
  firstName: 'Ira',
  lastName: 'Malhotra',
  dob: '2017-08-14',
  gender: 'Female',
  bloodGroup: 'B+',
  nationality: 'Indian',
  religion: 'Hindu',
  category: 'General',
  aadhaarNo: '4829 1029 3847',

  fatherName: 'Rajiv Malhotra',
  fatherOccupation: 'Software Architect',
  fatherPhone: '+91 98100 47821',
  fatherEmail: 'rajiv.malhotra@gmail.com',
  fatherAadhaar: '9081 2234 5512',
  motherName: 'Sunita Malhotra',
  motherOccupation: 'Chartered Accountant',
  motherPhone: '+91 98201 93456',
  motherEmail: 'sunita.malhotra@gmail.com',
  motherAadhaar: '9081 2234 5513',
  primaryComm: 'father',

  emergencyName: 'Anil Malhotra',
  emergencyRelation: 'Grandfather',
  emergencyPhone: '+91 98300 11234',

  currentAddress: 'A-204, Sector 62, Noida',
  district: 'Gautam Buddha Nagar',
  state: 'Uttar Pradesh',
  country: 'India',
  city: 'Noida',
  pincode: '201301',
  sameAsCurrentAddress: true,
  permAddress: 'A-204, Sector 62, Noida',
  permDistrict: 'Gautam Buddha Nagar',
  permState: 'Uttar Pradesh',
  permCountry: 'India',
  permCity: 'Noida',
  permPincode: '201301',

  previousSchool: 'Eurokids Preschool, Sector 62',
  previousLocation: 'Noida, Uttar Pradesh',
  previousBoard: 'CBSE',
  previousClass: 'UKG',
  previousSection: 'A',
  previousYear: '2024–2025',
  tcStatus: 'uploaded',
  tcNumber: 'TC-2024-8841',
  tcDate: '2024-03-15',
  reasonForLeaving: 'Relocation & Progression to Primary School',

  heightCm: '118',
  weightKg: '21',
  allergies: 'None',
  conditions: 'None',
  doctorName: 'Dr. S. K. Gupta',
  doctorPhone: '+91 98111 22334',
  vaccinationStatus: 'Fully Vaccinated',

  className: 'Class 2',
  section: 'A',

  docStatuses: {
    aadhaar: { status: 'uploaded', fileName: 'Student_Aadhaar_Ira.pdf' },
    birthCert: { status: 'uploaded', fileName: 'Birth_Certificate_Ira.pdf' },
    tc: { status: 'uploaded', fileName: 'TC_Original_Signed.pdf' },
    marksheet: { status: 'uploaded', fileName: 'UKG_Progress_Report.pdf' },
  },
  photoUploaded: true,
}

export const defaultInitialFeeData: FeeDataState = {
  bookSelections: {},
  uniformSelections: {},
  activityKitSelections: {},
  examGroups: { unitTest: false, termExam: false, customGroups: false },
  transportSelected: false,
  hostelSelected: false,
  discountCode: 'NONE',
  customDiscountValue: 0,
  customDiscountReason: '',
}
