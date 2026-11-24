import { DEMO_MODE_ENABLED } from './demoConfig'

export const DEMO_SESSION_KEY = 'cas_demo_mode'
export const DEMO_DATA_KEY = 'citizenassist_demo_data_v1'
const DEMO_DATA_VERSION = 1

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value))
const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

export function isDemoSession() {
  return DEMO_MODE_ENABLED && localStorage.getItem(DEMO_SESSION_KEY) === 'active'
}

export function enterDemoSession() {
  if (!DEMO_MODE_ENABLED) return false
  localStorage.setItem(DEMO_SESSION_KEY, 'active')
  return true
}

export function leaveDemoSession() {
  localStorage.removeItem(DEMO_SESSION_KEY)
}

function createSeedData() {
  return {
    version: DEMO_DATA_VERSION,
    profile: {
      id: 'demo-citizen',
      full_name: 'Ananya Rao',
      email: 'ananya.demo@example.test',
      phone: '+91 00000 00000',
      date_of_birth: '1988-08-14',
      address: 'Demo address, Pune',
      state: 'Maharashtra',
      district: 'Pune',
      occupation: 'Smallholder farmer',
      annual_income: 180000,
    },
    family: [
      {
        id: 'demo-family-1',
        full_name: 'Rohan Rao',
        relationship: 'Spouse',
        date_of_birth: '1986-03-22',
        occupation: 'Self-employed',
        annual_income: 120000,
      },
      {
        id: 'demo-family-2',
        full_name: 'Mira Rao',
        relationship: 'Child',
        date_of_birth: '2014-11-02',
        occupation: 'Student',
        annual_income: null,
      },
    ],
    scheme_answers: {},
    documents: [
      {
        id: 'demo-document-income',
        original_filename: 'sample-income-certificate.pdf',
        mime_type: 'application/pdf',
        file_size_bytes: 184320,
        document_type: 'income_certificate',
        status: 'processed',
        is_demo: true,
        created_at: daysAgo(2),
        extraction: {
          demo_simulated: true,
          processing_method: 'Scripted sample — no OCR performed',
          summary: 'Demonstration output only. This sample was not extracted from an uploaded document.',
          extracted_text: 'DEMO SAMPLE TEXT\nName: Sample Citizen\nDocument type: Income certificate\nIncome amount: [sample value]\nNo real document content was processed.',
          missing_information: ['Verify certificate date and issuing authority on the original document.'],
          document_type: 'income_certificate',
        },
      },
      {
        id: 'demo-document-identity',
        original_filename: 'sample-identity-card.png',
        mime_type: 'image/png',
        file_size_bytes: 245760,
        document_type: 'identity_document',
        status: 'processed',
        is_demo: true,
        created_at: daysAgo(4),
        extraction: {
          demo_simulated: true,
          processing_method: 'Scripted sample — no OCR performed',
          summary: 'Demonstration output only. No personal identity data was read or stored.',
          extracted_text: 'DEMO SAMPLE TEXT\nIdentity document example\nPersonal number: [not provided]\nNo real document content was processed.',
          missing_information: ['Check that the name and date of birth match the application.'],
          document_type: 'identity_document',
        },
      },
    ],
    applications: [
      {
        id: 'demo-application-housing',
        application_type: 'Housing-service enquiry (demo)',
        status: 'under_review',
        form_data: { full_name: 'Ananya Rao', request_summary: 'Sample housing-service enquiry.' },
        document_ids: ['demo-document-income'],
        is_demo: true,
        created_at: daysAgo(12),
        updated_at: daysAgo(2),
        history: [
          { id: 'demo-history-housing-1', label: 'Draft prepared in demo', created_at: daysAgo(12), status: 'draft' },
          { id: 'demo-history-housing-2', label: 'Sample status update: under review', created_at: daysAgo(2), status: 'under_review' },
        ],
      },
      {
        id: 'demo-application-education',
        application_type: 'Education-assistance enquiry (demo)',
        status: 'documents_required',
        form_data: { full_name: 'Ananya Rao', request_summary: 'Sample education-assistance enquiry.' },
        document_ids: ['demo-document-identity'],
        is_demo: true,
        created_at: daysAgo(6),
        updated_at: daysAgo(1),
        history: [
          { id: 'demo-history-education-1', label: 'Draft prepared in demo', created_at: daysAgo(6), status: 'draft' },
          { id: 'demo-history-education-2', label: 'Sample status update: document review requested', created_at: daysAgo(1), status: 'documents_required' },
        ],
      },
    ],
    notifications: [
      { id: 'demo-notification-1', title: 'Welcome to the demo workspace', body: 'This is sample content. No real citizen account or government case is connected.', read_at: null, created_at: daysAgo(0) },
      { id: 'demo-notification-2', title: 'Sample document review', body: 'A demonstration document result is available in Document Intelligence.', read_at: null, created_at: daysAgo(1) },
      { id: 'demo-notification-3', title: 'Profile tip', body: 'You can edit this fictional profile and family information; changes stay in this browser.', read_at: daysAgo(2), created_at: daysAgo(3) },
    ],
    activity: [
      { id: 'demo-activity-1', summary: 'Entered the CitizenAssist demonstration workspace.', created_at: daysAgo(0) },
      { id: 'demo-activity-2', summary: 'Reviewed a sample document extraction.', created_at: daysAgo(1) },
      { id: 'demo-activity-3', summary: 'Viewed an illustrative application status update.', created_at: daysAgo(2) },
    ],
    legal_conversations: [],
  }
}

function writeData(data) {
  try {
    localStorage.setItem(DEMO_DATA_KEY, JSON.stringify(data))
  } catch {
    throw new Error('Demo changes could not be saved in this browser. Check local storage availability.')
  }
  return clone(data)
}

export function readDemoData() {
  if (!isDemoSession()) throw new Error('Enter Demo before accessing demonstration data.')
  const raw = localStorage.getItem(DEMO_DATA_KEY)
  if (raw === null) return writeData(createSeedData())
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('Saved demo data is invalid. Reset the demo workspace to continue.')
  }
  if (!data || data.version !== DEMO_DATA_VERSION) {
    throw new Error('Saved demo data uses an unsupported version. Reset the demo workspace to continue.')
  }
  return clone(data)
}

export function updateDemoData(update) {
  const data = readDemoData()
  const result = update(data)
  writeData(data)
  return clone(result)
}

export function resetDemoData() {
  if (!isDemoSession()) throw new Error('Enter Demo before resetting demonstration data.')
  return writeData(createSeedData())
}

export function makeDemoId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`
}

export function addDemoActivity(data, summary) {
  data.activity.unshift({
    id: makeDemoId('demo-activity'),
    summary,
    created_at: new Date().toISOString(),
  })
}
