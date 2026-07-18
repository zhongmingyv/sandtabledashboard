import { defineStore } from 'pinia'
import { ref } from 'vue'

const TOKEN_KEY = 'slgm_admin_token'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) || '')
  const username = ref(localStorage.getItem('slgm_admin_user') || '')

  function setSession(t, name) {
    token.value = t
    username.value = name || ''
    localStorage.setItem(TOKEN_KEY, t)
    localStorage.setItem('slgm_admin_user', username.value)
  }

  function clear() {
    token.value = ''
    username.value = ''
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem('slgm_admin_user')
  }

  return { token, username, setSession, clear }
})
