import {
  DEMO_FORM_FIELD_LABELS,
  DEMO_FORM_FIELD_MAX_LENGTHS,
  DEMO_FORM_TEMPLATES,
  DEMO_SCHEMES,
} from './demoFixtures'
import {
  addDemoActivity,
  makeDemoId,
  readDemoData,
  updateDemoData,
} from './demoStore'

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value))
const response = (data) => Promise.resolve({ data: clone(data) })
const failure = (message, status = 400) => {
  const error = new Error(message)
  error.response = { status, data: { detail: message } }
  return error
}
const now = () => new Date().toISOString()

function findById(items, id, label) {
  const item = items.find((entry) => entry.id === id)
  if (!item) throw failure(`${label} was not found.`, 404)
  return item
}

export function getDemoProfile() {
  return response(readDemoData().profile)
}

export function updateDemoProfile(payload) {
  const profile = updateDemoData((data) => {
    data.profile = { ...data.profile, ...payload }
    addDemoActivity(data, 'Updated the fictional demo citizen profile.')
    return data.profile
  })
  return response(profile)
}

export function getDemoFamily() {
  return response(readDemoData().family)
}

export function addDemoFamilyMember(payload) {
  const member = updateDemoData((data) => {
    const newMember = { ...payload, id: makeDemoId('demo-family') }
    data.family.push(newMember)
    addDemoActivity(data, 'Added a family member to the demo profile.')
    return newMember
  })
  return response(member)
}

export function updateDemoFamilyMember(id, payload) {
  const member = updateDemoData((data) => {
    const current = findById(data.family, id, 'Family member')
    Object.assign(current, payload)
    addDemoActivity(data, 'Updated a family member in the demo profile.')
    return current
  })
  return response(member)
}

export function deleteDemoFamilyMember(id) {
  updateDemoData((data) => {
    const before = data.family.length
    data.family = data.family.filter((member) => member.id !== id)
    if (data.family.length === before) throw failure('Family member was not found.', 404)
    addDemoActivity(data, 'Removed a family member from the demo profile.')
  })
  return response(null)
}

export function getDemoDashboard() {
  const data = readDemoData()
  const unread = data.notifications.filter((item) => !item.read_at).length
  return response({
    profile: data.profile,
    schemes: DEMO_SCHEMES,
    applications: data.applications.slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    documents: data.documents.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)),
    notifications: data.notifications.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)),
    activity: data.activity.slice(0, 20),
    counts: {
      applications: data.applications.length,
      documents: data.documents.length,
      unread_notifications: unread,
    },
    demo_mode: true,
  })
}

export function getDemoSchemes(params = {}) {
  const term = (params.search || '').trim().toLowerCase()
  const results = DEMO_SCHEMES.filter((scheme) => (
    (!params.category || scheme.category === params.category)
    && (!params.jurisdiction || scheme.jurisdiction === params.jurisdiction)
    && (!term || `${scheme.name} ${scheme.summary} ${scheme.category}`.toLowerCase().includes(term))
  ))
  return response(results)
}

export function getDemoSchemeAnswers(schemeId) {
  return response(readDemoData().scheme_answers[schemeId] || {})
}

export function checkDemoSchemeEligibility(schemeId, answers = {}) {
  const scheme = findById(DEMO_SCHEMES, schemeId, 'Scheme')
  const rules = scheme.questions.map((question) => {
    const answer = answers[question.id] || question.default || 'unsure'
    const isMissing = answer === 'unsure'
    const fails = (
      (schemeId === 'demo-pm-kisan'
        && ((question.id === 'cultivable_land' && answer === 'no')
          || (question.id === 'excluded_category' && answer === 'yes')))
      || (schemeId === 'demo-pmuy'
        && ((question.id === 'adult_woman' && answer === 'no')
          || (question.id === 'existing_lpg' && answer === 'yes')
          || (question.id === 'qualifying_household' && answer === 'no')))
    )
    return {
      criterion: question.label,
      status: isMissing ? 'missing' : fails ? 'fail' : 'pass',
      explanation: isMissing
        ? 'Not confirmed in this demonstration questionnaire.'
        : 'Recorded answer for this demonstration only; check the official programme rules.',
      actual_value: answer,
      expected_value: schemeId === 'demo-pmuy' && question.id === 'existing_lpg' ? 'no' : 'yes',
    }
  })
  const missing = rules.some((rule) => rule.status === 'missing')
  const failed = rules.some((rule) => rule.status === 'fail')
  const pmjayNeedsOfficialCheck = schemeId === 'demo-pmjay' && answers.listed_in_pmjay !== 'yes'
  const status = failed ? 'not_a_match'
    : missing || pmjayNeedsOfficialCheck ? 'needs_information'
      : 'possible_match'
  const result = {
    scheme_id: schemeId,
    status,
    is_eligible: null,
    rules,
    missing_information: [
      ...rules.filter((rule) => rule.status === 'missing').map((rule) => rule.criterion),
      ...(pmjayNeedsOfficialCheck ? ['Eligibility must be confirmed through the official PM-JAY beneficiary search.'] : []),
    ],
    official_source_url: scheme.official_source_url,
    demo_simulated: true,
    disclaimer: 'Demonstration questionnaire only—not an official eligibility decision.',
  }
  updateDemoData((data) => {
    data.scheme_answers[schemeId] = { ...answers }
    addDemoActivity(data, `Completed the sample eligibility questionnaire for ${scheme.name}.`)
    return result
  })
  return response(result)
}

export function getDemoFormTemplates() {
  return response(DEMO_FORM_TEMPLATES.map((template) => ({
    ...template,
    required_fields: [...template.required_fields],
    official_form: false,
  })))
}

export function validateDemoForm(payload) {
  const template = findById(DEMO_FORM_TEMPLATES, payload.template_id, 'Form template')
  const data = payload.data || {}
  const missing = template.required_fields.filter((field) => (
    data[field] === undefined || data[field] === null || !String(data[field]).trim()
  ))
  const invalid = []
  for (const [field, value] of Object.entries(data)) {
    const maxLength = DEMO_FORM_FIELD_MAX_LENGTHS[field]
    if (maxLength && String(value).length > maxLength) invalid.push(field)
  }
  if (data.phone && !/^[0-9+() -]{7,24}$/.test(String(data.phone))) invalid.push('phone')
  if (data.household_size && (!Number.isInteger(Number(data.household_size)) || Number(data.household_size) < 1)) {
    invalid.push('household_size')
  }
  const invalidFields = [...new Set(invalid)]
  return {
    valid: missing.length === 0 && invalidFields.length === 0,
    missing_fields: missing,
    invalid_fields: invalidFields,
    message: missing.length || invalidFields.length
      ? 'Review the required fields and correct the highlighted values.'
      : 'Required information is present. This remains a personal draft.',
  }
}

export function generateDemoForm(payload) {
  const template = findById(DEMO_FORM_TEMPLATES, payload.template_id, 'Form template')
  const validation = validateDemoForm(payload)
  if (!validation.valid) {
    throw failure({
      message: validation.message,
      missing_fields: validation.missing_fields,
      invalid_fields: validation.invalid_fields,
    }, 422)
  }
  const application = updateDemoData((data) => {
    const draft = {
      id: makeDemoId('demo-application'),
      application_type: `${template.label} (demo draft)`,
      status: 'draft',
      form_data: clone(payload.data),
      document_ids: [],
      is_demo: true,
      created_at: now(),
      updated_at: now(),
      history: [{ id: makeDemoId('demo-history'), label: 'Draft created in demonstration workspace', status: 'draft', created_at: now() }],
    }
    data.applications.unshift(draft)
    addDemoActivity(data, `Saved a ${template.label.toLowerCase()} in the demo workspace.`)
    data.notifications.unshift({
      id: makeDemoId('demo-notification'),
      title: 'Demo draft saved',
      body: 'Your sample draft was saved only in this browser.',
      read_at: null,
      created_at: now(),
    })
    return draft
  })
  return response(application)
}

export function getDemoApplications() {
  return response(readDemoData().applications.slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at)))
}

export function getDemoApplicationHistory(id) {
  const app = findById(readDemoData().applications, id, 'Application')
  return response(app.history.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)))
}

export function updateDemoApplicationStatus(id, status) {
  const allowed = ['draft', 'under_review', 'documents_required', 'completed']
  if (!allowed.includes(status)) throw failure('Unsupported sample status.')
  const application = updateDemoData((data) => {
    const app = findById(data.applications, id, 'Application')
    app.status = status
    app.updated_at = now()
    app.history.unshift({
      id: makeDemoId('demo-history'),
      label: `Sample status update: ${status.replaceAll('_', ' ')}`,
      status,
      created_at: now(),
    })
    addDemoActivity(data, `Added a simulated status update to ${app.application_type}.`)
    data.notifications.unshift({
      id: makeDemoId('demo-notification'),
      title: 'Sample application status changed',
      body: `Demo status is now “${status.replaceAll('_', ' ')}”. No government case is connected.`,
      read_at: null,
      created_at: now(),
    })
    return app
  })
  return response(application)
}

export function deleteDemoApplication(id) {
  updateDemoData((data) => {
    const app = findById(data.applications, id, 'Application')
    if (app.status !== 'draft') throw failure('Only demo drafts can be deleted.', 409)
    data.applications = data.applications.filter((item) => item.id !== id)
    addDemoActivity(data, 'Deleted a sample application draft.')
  })
  return response(null)
}

export function getDemoApplicationDocuments(id) {
  const data = readDemoData()
  const app = findById(data.applications, id, 'Application')
  return response(app.document_ids.map((documentId) => ({ document_id: documentId })))
}

export function attachDemoDocument(applicationId, documentId) {
  updateDemoData((data) => {
    const app = findById(data.applications, applicationId, 'Application')
    findById(data.documents, documentId, 'Document')
    if (app.document_ids.includes(documentId)) throw failure('This document is already attached.', 409)
    app.document_ids.push(documentId)
    addDemoActivity(data, 'Associated a demo document with a sample application.')
  })
  return response(null)
}

export function detachDemoDocument(applicationId, documentId) {
  updateDemoData((data) => {
    const app = findById(data.applications, applicationId, 'Application')
    if (!app.document_ids.includes(documentId)) throw failure('Document association was not found.', 404)
    app.document_ids = app.document_ids.filter((id) => id !== documentId)
    addDemoActivity(data, 'Removed a demo document from a sample application.')
  })
  return response(null)
}

async function createPdf(title, lines) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const left = 18
  const maxWidth = pageWidth - left * 2
  let y = 22
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text(title, left, y)
  y += 14
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  for (const line of lines) {
    const wrapped = pdf.splitTextToSize(String(line), maxWidth)
    if (y + wrapped.length * 6 > pageHeight - 18) {
      pdf.addPage()
      y = 20
    }
    pdf.text(wrapped, left, y)
    y += wrapped.length * 6 + 4
  }
  return pdf.output('blob')
}

export async function downloadDemoApplicationPdf(id) {
  const app = findById(readDemoData().applications, id, 'Application')
  const fields = Object.entries(app.form_data || {}).map(([key, value]) => (
    `${DEMO_FORM_FIELD_LABELS[key] || key.replaceAll('_', ' ')}: ${value}`
  ))
  return {
    data: await createPdf('CitizenAssist demo draft', [
      'DEMONSTRATION DOCUMENT — not an official government form.',
      'This draft has not been submitted to any government department.',
      `Draft type: ${app.application_type}`,
      `Demo status: ${app.status.replaceAll('_', ' ')}`,
      ...fields,
    ]),
  }
}

export function getDemoDocuments() {
  return response(readDemoData().documents.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)))
}

const FILE_SIGNATURES = {
  'application/pdf': { extension: ['pdf'], bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  'image/jpeg': { extension: ['jpg', 'jpeg'], bytes: [0xff, 0xd8, 0xff] },
  'image/png': { extension: ['png'], bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
}

export async function uploadDemoDocument(file) {
  if (!file || file.size < 1 || file.size > 10 * 1024 * 1024) {
    throw failure('Choose a non-empty PDF, JPG, or PNG file no larger than 10 MiB.', 413)
  }
  const signature = FILE_SIGNATURES[file.type]
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!signature || !signature.extension.includes(extension)) {
    throw failure('Choose a PDF, JPG, or PNG file with a matching file type and extension.', 415)
  }
  const bytes = new Uint8Array(await file.slice(0, signature.bytes.length).arrayBuffer())
  if (!signature.bytes.every((byte, index) => bytes[index] === byte)) {
    throw failure('The file signature does not match its extension.', 415)
  }
  const document = updateDemoData((data) => {
    const item = {
      id: makeDemoId('demo-document'),
      original_filename: file.name.slice(0, 255),
      mime_type: file.type,
      file_size_bytes: file.size,
      document_type: null,
      status: 'uploaded',
      is_demo: true,
      created_at: now(),
      extraction: null,
    }
    data.documents.unshift(item)
    addDemoActivity(data, 'Added a file to the local demonstration workspace; no file was uploaded to a server.')
    return item
  })
  return response(document)
}

function sampleExtraction(document) {
  const name = document.original_filename.toLowerCase()
  let documentType = 'unclassified'
  let extractedText = 'DEMO SAMPLE TEXT\nDocument type: generic example\nNo real file contents were read.'
  let missingInformation = ['Confirm all required fields against the original document.']
  if (name.includes('income')) {
    documentType = 'income_certificate'
    extractedText = 'DEMO SAMPLE TEXT\nDocument: Income certificate example\nAnnual income: [sample value]\nNo real file contents were read.'
    missingInformation = ['Verify the certificate date and issuing authority on the original.']
  } else if (name.includes('aadhaar') || name.includes('identity')) {
    documentType = 'identity_document'
    extractedText = 'DEMO SAMPLE TEXT\nDocument: Identity document example\nIdentity number: [not provided]\nNo real file contents were read.'
    missingInformation = ['Check that name and date of birth match the application.']
  } else if (name.includes('bank')) {
    documentType = 'bank_statement'
    extractedText = 'DEMO SAMPLE TEXT\nDocument: Bank statement example\nAccount number: [not provided]\nNo real file contents were read.'
    missingInformation = ['Confirm the statement period and account-holder name.']
  }
  return {
    demo_simulated: true,
    document_type: documentType,
    processing_method: 'Scripted sample — no OCR performed',
    summary: 'Demonstration output only. This text was not extracted from the uploaded file.',
    extracted_text: extractedText,
    missing_information: missingInformation,
    extracted_data: {},
  }
}

export function analyzeDemoDocument(id) {
  const extraction = updateDemoData((data) => {
    const document = findById(data.documents, id, 'Document')
    document.status = 'processed'
    document.extraction = sampleExtraction(document)
    document.document_type = document.extraction.document_type
    addDemoActivity(data, 'Viewed scripted sample document analysis; no OCR was performed.')
    return document.extraction
  })
  return response(extraction)
}

export function getDemoDocumentExtraction(id) {
  const document = findById(readDemoData().documents, id, 'Document')
  if (!document.extraction) throw failure('No sample analysis is available. Select Analyze document first.', 404)
  return response(document.extraction)
}

export async function downloadDemoDocumentReport(id) {
  const document = findById(readDemoData().documents, id, 'Document')
  const extraction = document.extraction || sampleExtraction(document)
  return {
    data: await createPdf('CitizenAssist demo document report', [
      'DEMONSTRATION REPORT — not OCR output.',
      'The original file remains in your browser and was not sent to a server.',
      `File: ${document.original_filename}`,
      `Classification: ${extraction.document_type}`,
      extraction.summary,
      extraction.extracted_text,
      ...extraction.missing_information,
    ]),
  }
}

export function deleteDemoDocument(id) {
  updateDemoData((data) => {
    findById(data.documents, id, 'Document')
    data.documents = data.documents.filter((item) => item.id !== id)
    data.applications.forEach((app) => {
      app.document_ids = app.document_ids.filter((documentId) => documentId !== id)
    })
    addDemoActivity(data, 'Deleted a document from the local demonstration workspace.')
  })
  return response(null)
}

export function getDemoNotifications() {
  return response(readDemoData().notifications.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)))
}

export function markDemoNotificationRead(id) {
  const notification = updateDemoData((data) => {
    const item = findById(data.notifications, id, 'Notification')
    item.read_at = item.read_at || now()
    addDemoActivity(data, 'Marked a demo notification as read.')
    return item
  })
  return response(notification)
}

function legalDemoAnswer(message, category) {
  const text = message.toLowerCase()
  if (category === 'rti' || text.includes('rti') || text.includes('right to information')) {
    return {
      answer: 'DEMO RESPONSE — For central public authorities, RTI Online is an official starting point. Some state authorities use separate processes. Confirm the correct authority, fee, and current filing instructions on the official portal. This scripted example is not legal advice.',
      sources: [{ title: 'RTI Online — Government of India', url: 'https://rtionline.gov.in/' }],
    }
  }
  if (category === 'consumer' || /consumer|refund|defective product|complaint/.test(text)) {
    return {
      answer: 'DEMO RESPONSE — The National Consumer Helpline provides an official starting point for consumer grievance information. Keep relevant invoices and communications, and verify the current complaint process on the portal. This scripted example is not legal advice.',
      sources: [{ title: 'National Consumer Helpline', url: 'https://consumerhelpline.gov.in/' }],
    }
  }
  if (category === 'rights_welfare' || /legal aid|free lawyer|legal services/.test(text)) {
    return {
      answer: 'DEMO RESPONSE — NALSA and the relevant State Legal Services Authority are official starting points for information about legal services and eligibility. Contact them to confirm the assistance available for your situation. This scripted example is not legal advice.',
      sources: [{ title: 'National Legal Services Authority', url: 'https://nalsa.gov.in/' }],
    }
  }
  return {
    answer: 'DEMO RESPONSE — Use India Code to look up central legislation and consult the responsible government office or a qualified legal professional for current, situation-specific guidance. This scripted example is not generated by Gemini and is not legal advice.',
    sources: [{ title: 'India Code — Government of India', url: 'https://www.indiacode.nic.in/' }],
  }
}

export function getDemoLegalConversations() {
  return response(readDemoData().legal_conversations
    .slice()
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .map(({ id, title, category, created_at, updated_at }) => ({ id, title, category, created_at, updated_at })))
}

export function getDemoLegalMessages(id) {
  const conversation = findById(readDemoData().legal_conversations, id, 'Conversation')
  return response(conversation.messages.map((message) => ({
    ...message,
    source_references: message.sources || [],
  })))
}

export function sendDemoLegalQuestion(payload) {
  const message = typeof payload?.message === 'string' ? payload.message.trim() : ''
  if (!message) throw failure('Enter a legal-information question.')
  if (message.length > 2000) throw failure('Questions must be 2000 characters or fewer.', 413)
  const categories = ['general', 'rights_welfare', 'consumer', 'employment', 'rti', 'property', 'civil']
  const category = payload?.category || 'general'
  if (!categories.includes(category)) throw failure('Choose a supported legal topic.')

  const result = updateDemoData((data) => {
    let conversation = payload?.conversation_id
      ? findById(data.legal_conversations, payload.conversation_id, 'Conversation')
      : null
    if (!conversation) {
      conversation = {
        id: makeDemoId('demo-conversation'),
        title: message.slice(0, 100),
        category,
        created_at: now(),
        updated_at: now(),
        messages: [],
      }
      data.legal_conversations.unshift(conversation)
    }
    const answer = legalDemoAnswer(message, category)
    conversation.category = category || conversation.category
    conversation.updated_at = now()
    conversation.messages.push(
      { id: makeDemoId('demo-message'), role: 'user', content: message, created_at: now(), sources: [] },
      { id: makeDemoId('demo-message'), role: 'assistant', content: answer.answer, created_at: now(), sources: answer.sources, demo_simulated: true },
    )
    addDemoActivity(data, 'Used the scripted legal-assistant demonstration.')
    return { conversation_id: conversation.id, answer: answer.answer, sources: answer.sources }
  })
  return response({
    ...result,
    grounded: false,
    demo_simulated: true,
    disclaimer: 'Scripted demo response; not generated by Gemini and not legal advice.',
  })
}

