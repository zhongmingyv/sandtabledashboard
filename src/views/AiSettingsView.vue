<script setup>
// 系统 → AI 设置：Key、请求地址、模型，保存后立刻生效，不用重启服务器。
// Key 只写不读：页面只拿得到末尾 4 位，输入框留空 = 不改。没填的项用服务器配置文件里的。
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api/admin'

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const info = ref(null)
const apiKey = ref('')
const baseUrl = ref('')
const model = ref('')
const testResult = ref(null)

function apply(res) {
  info.value = res
  apiKey.value = ''
  baseUrl.value = res.baseUrl
  model.value = res.model
}

async function load() {
  loading.value = true
  try {
    apply(await api.aiSettings())
  } finally {
    loading.value = false
  }
}

async function save(clearKey = false) {
  saving.value = true
  testResult.value = null
  try {
    apply(await api.saveAiSettings({ apiKey: apiKey.value, baseUrl: baseUrl.value, model: model.value, clearKey }))
    ElMessage.success('已保存，立刻生效')
  } catch (err) {
    ElMessage.error(err?.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function clearKey() {
  try {
    await ElMessageBox.confirm('清除这里保存的 Key？之后会用服务器配置文件里的 Key，没有的话 AI 功能就不能用了。', '清除 Key', { type: 'warning' })
  } catch {
    return
  }
  apiKey.value = ''
  save(true)
}

async function test() {
  if (apiKey.value || baseUrl.value !== info.value.baseUrl || model.value !== info.value.model) {
    ElMessage.warning('有改动还没保存，先保存再测试')
    return
  }
  testing.value = true
  testResult.value = null
  try {
    testResult.value = await api.testAiSettings()
  } finally {
    testing.value = false
  }
}

onMounted(load)
</script>

<template>
  <div v-loading="loading" style="max-width: 720px">
    <el-alert type="info" :closable="false" show-icon style="margin-bottom: 16px">
      <template #title>
        官网文字的 AI 翻译和 Maker 的 AI 助手都用这里的配置，保存后立刻生效。使用 Anthropic Messages 接口。没填的项用服务器配置文件里的值。
      </template>
    </el-alert>

    <el-card v-if="info" shadow="never">
      <el-form label-width="96px">
        <el-form-item label="当前状态">
          <el-tag v-if="!info.configured" type="danger">未配置 Key</el-tag>
          <el-tag v-else-if="info.keySource === 'page'" type="success">
            已配置{{ info.keyHint ? `，尾号 ${info.keyHint}` : '' }}
          </el-tag>
          <el-tag v-else type="success">使用服务器配置文件的 Key{{ info.keyHint ? `，尾号 ${info.keyHint}` : '' }}</el-tag>
        </el-form-item>
        <el-form-item label="API Key">
          <el-input
            v-model="apiKey"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="info.configured ? '留空 = 不改' : '填入 API Key'"
          />
          <el-button v-if="info.keySource === 'page'" link type="danger" @click="clearKey">清除这里保存的 Key</el-button>
        </el-form-item>
        <el-form-item label="请求地址">
          <el-input v-model="baseUrl" :placeholder="`留空 = ${info.effectiveBaseUrl}`" />
          <div style="color: #909399; font-size: 12px">用第三方中转时填它的地址，不用写 /v1/messages。</div>
        </el-form-item>
        <el-form-item label="模型">
          <el-input v-model="model" :placeholder="`留空 = ${info.effectiveModel}`" />
          <div style="color: #909399; font-size: 12px">填了之后，Maker 的 AI 助手也会改用这个模型。</div>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="save(false)">保存</el-button>
          <el-button :loading="testing" @click="test">测试连接</el-button>
        </el-form-item>
        <el-alert
          v-if="testResult"
          :type="testResult.ok ? 'success' : 'error'"
          :title="testResult.message"
          :closable="false"
          show-icon
        />
      </el-form>
    </el-card>
  </div>
</template>
