<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { api } from '../api/admin'
import { useAuthStore } from '../store/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const form = ref({ username: '', password: '' })
const loading = ref(false)

async function submit() {
  if (!form.value.username || !form.value.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    const res = await api.login(form.value.username, form.value.password)
    auth.setSession(res.token, res.username || form.value.username)
    ElMessage.success('登录成功')
    router.push(route.query.redirect || { name: 'overview' })
  } catch (err) {
    const code = err?.response?.data?.error
    if (code === 'too_many_attempts') {
      const secs = err?.response?.data?.retryAfter || 900
      ElMessage.error(`尝试过于频繁，请 ${Math.ceil(secs / 60)} 分钟后再试`)
    } else {
      ElMessage.error(code === 'invalid_credentials' ? '用户名或密码错误' : '登录失败')
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-wrap">
    <el-card class="login-card">
      <div class="login-title">SLGM 运营后台</div>
      <el-form @submit.prevent="submit">
        <el-form-item>
          <el-input v-model="form.username" placeholder="用户名" size="large" @keyup.enter="submit">
            <template #prefix><el-icon><User /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            size="large"
            show-password
            @keyup.enter="submit"
          >
            <template #prefix><el-icon><Lock /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-button type="primary" size="large" style="width: 100%" :loading="loading" @click="submit">
          登录
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.login-wrap {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1f2937, #111827);
}
.login-card {
  width: 360px;
}
.login-title {
  text-align: center;
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 24px;
}
</style>
