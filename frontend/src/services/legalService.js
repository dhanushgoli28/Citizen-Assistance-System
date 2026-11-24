import api from './api'
import { isDemoSession } from './demoStore'
import {
  getDemoLegalConversations,
  getDemoLegalMessages,
  sendDemoLegalQuestion,
} from './demoService'

export const sendLegalQuestion = (payload) => isDemoSession()
  ? sendDemoLegalQuestion(payload)
  : api.post('/api/legal/chat', payload)
export const getLegalConversations = () => isDemoSession()
  ? getDemoLegalConversations()
  : api.get('/api/legal/conversations')
export const getLegalMessages = (conversationId) =>
  isDemoSession()
    ? getDemoLegalMessages(conversationId)
    : api.get(`/api/legal/conversations/${conversationId}/messages`)
