export const DEMO_SCHEMES = Object.freeze([
  {
    id: 'demo-pm-kisan',
    name: 'PM-KISAN',
    category: 'Agriculture',
    jurisdiction: 'central',
    summary: 'Income-support programme for eligible landholding farmer families. Exclusions and land-record requirements apply.',
    benefit: 'Eligible farmer families receive income support in instalments under the current programme rules.',
    required_documents: ['Aadhaar or another accepted identity document', 'Landholding records', 'Bank account details'],
    official_source_url: 'https://pmkisan.gov.in/',
    application_url: 'https://pmkisan.gov.in/',
    questions: [
      { id: 'cultivable_land', label: 'Is cultivable land recorded for the farmer family?', default: 'yes' },
      { id: 'excluded_category', label: 'Does the applicant fall under an exclusion listed on the official portal?', default: 'no' },
    ],
  },
  {
    id: 'demo-pmuy',
    name: 'Pradhan Mantri Ujjwala Yojana',
    category: 'Energy',
    jurisdiction: 'central',
    summary: 'LPG connection programme for eligible adult women from qualifying households.',
    benefit: 'An eligible applicant may apply for an LPG connection under the current PMUY rules.',
    required_documents: ['Identity and address documents accepted by the portal', 'Household/ration-card details where applicable', 'Bank account details'],
    official_source_url: 'https://www.pmuy.gov.in/',
    application_url: 'https://www.pmuy.gov.in/',
    questions: [
      { id: 'adult_woman', label: 'Is the applicant an adult woman?', default: 'yes' },
      { id: 'existing_lpg', label: 'Does any household member already have an LPG connection?', default: 'no' },
      { id: 'qualifying_household', label: 'Does the household meet a current PMUY eligibility category?', default: 'unsure' },
    ],
  },
  {
    id: 'demo-pmjay',
    name: 'Ayushman Bharat PM-JAY',
    category: 'Health',
    jurisdiction: 'central',
    summary: 'Publicly funded health cover for families identified as eligible under PM-JAY rules.',
    benefit: 'Eligible families may receive covered hospital care within PM-JAY limits and conditions.',
    required_documents: ['Beneficiary identification or family details for the official eligibility check', 'Accepted identity documents for verification'],
    official_source_url: 'https://pmjay.gov.in/',
    application_url: 'https://beneficiary.nha.gov.in/',
    questions: [
      { id: 'listed_in_pmjay', label: 'Does the official beneficiary search show this family as eligible?', default: 'unsure' },
    ],
  },
])

export const DEMO_FORM_TEMPLATES = Object.freeze([
  {
    id: 'general_support',
    label: 'General citizen-support request',
    description: 'A personal draft to organize a request before contacting the relevant service.',
    required_fields: ['full_name', 'phone', 'address', 'request_summary'],
  },
  {
    id: 'housing_support',
    label: 'Housing-service enquiry',
    description: 'A generic enquiry draft; this is not an official housing application.',
    required_fields: ['full_name', 'phone', 'address', 'household_size', 'request_summary'],
  },
  {
    id: 'education_support',
    label: 'Education-assistance enquiry',
    description: 'A generic draft for organizing education-assistance details.',
    required_fields: ['full_name', 'phone', 'course_or_class', 'institution', 'request_summary'],
  },
  {
    id: 'public_grievance',
    label: 'Public-service grievance note',
    description: 'A personal note to prepare before using the responsible authority’s official channel.',
    required_fields: ['full_name', 'phone', 'department', 'reference_number', 'request_summary'],
  },
])

export const DEMO_FORM_FIELD_LABELS = Object.freeze({
  full_name: 'Full name',
  phone: 'Phone number',
  address: 'Address',
  household_size: 'Household size',
  request_summary: 'What assistance are you seeking?',
  course_or_class: 'Course or class',
  institution: 'Institution',
  department: 'Department or service',
  reference_number: 'Reference number (if available)',
})

export const DEMO_FORM_FIELD_MAX_LENGTHS = Object.freeze({
  full_name: 120,
  phone: 24,
  address: 1000,
  household_size: 3,
  request_summary: 2000,
  course_or_class: 120,
  institution: 200,
  department: 120,
  reference_number: 120,
})

