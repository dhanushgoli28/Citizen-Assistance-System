import api from './api'
import { isDemoSession } from './demoStore'
import { getDemoNotifications, markDemoNotificationRead } from './demoService'

export const getNotifications = () => isDemoSession()
  ? getDemoNotifications()
  : api.get('/api/notifications')
export const markNotificationRead = (id) => isDemoSession()
  ? markDemoNotificationRead(id)
  : api.patch(`/api/notifications/${id}/read`)
