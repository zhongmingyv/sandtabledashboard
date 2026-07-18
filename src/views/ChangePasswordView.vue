<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { api } from '../api/admin'
import { useAuthStore } from '../store/auth'

const router = useRouter()
const auth = useAuthStore()
const formRef = ref()
const loading = ref(false)

const form = reactive({ oldPassword: '', newPassword: '', confirm: '' })

const rules = {
  oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 128, message: '新密码需 6–128 位', trigger: 'blur' },
  ],
  confirm: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_r, v, cb) => (v === form.newPassword ? cb() : cb(new Error('两次输入不一致'))),
      trigger: 'blur',
    },
  ],
}

async function submit() {
  await formRef.value.validate()
  loading.value = true
  try {
    await api.changePassword(form.oldPassword, form.newPassword)
    ElMessage.success('密码已修改，请用新密码重新登录')
    auth.clear()
    router.push({ name: 'login' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <el-card style="max-width: 480px">
    <template #header>修改后台登录密码</template>
    <el-alert
      title="改密后所有登录态失效，需用新密码重新登录。"
      type="info"
      :closable="false"
      style="margin-bottom: 16px"
    />
    <el-form ref="formRef" :model="form" :rules="rules" label-width="90px" @submit.prevent="submit">
      <el-form-item label="当前密码" prop="oldPassword">
        <el-input v-model="form.oldPassword" type="password" show-password autocomplete="current-password" />
      </el-form-item>
      <el-form-item label="新密码" prop="newPassword">
        <el-input v-model="form.newPassword" type="password" show-password autocomplete="new-password" />
      </el-form-item>
      <el-form-item label="确认新密码" prop="confirm">
        <el-input v-model="form.confirm" type="password" show-password autocomplete="new-password" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="submit">提交修改</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>
