<script setup>
// 网页版模板：Maker 发版时打的 web-template.zip（Godot 网页引擎 + 预编译好的游戏代码），所有战役共用、只留最新一份。
// 游戏数据不在模板里：玩家在官网「在线游戏」页点开一条战役，网页版按战役编号去下作者用 Maker「上传战役」
// 传上来、审核通过的那一版。所以这里只传一份文件，过审的战役自动都能玩；要不要先登录在「战役管理」里逐条设。
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '../api/admin'
import { fmtBytes, fmtDate } from '../utils/format'

const loading = ref(false)
const current = ref(null)
const uploading = ref(false)
const progress = ref(0)
// 传完之后服务器登记的阶段（空 = 还在传）
const stage = ref('')
const fileInput = ref(null)
const lastError = ref('')

async function load() {
  loading.value = true
  try {
    current.value = (await api.webTemplate()).current
  } finally {
    loading.value = false
  }
}

function pick() {
  fileInput.value.value = ''
  fileInput.value.click()
}

async function upload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (!file.name.toLowerCase().endsWith('.zip')) {
    ElMessage.error('请选择 web-template.zip')
    return
  }
  uploading.value = true
  progress.value = 0
  stage.value = ''
  lastError.value = ''
  try {
    const res = await api.uploadWebTemplate(
      file,
      (sent, total) => {
        progress.value = Math.floor((sent * 100) / total)
      },
      (s) => {
        stage.value = s || '处理中'
      },
    )
    current.value = res.current
    ElMessage.success(res.replaced ? '模板已换成新的一份，玩家下次打开就用它' : '模板已上线')
  } catch (err) {
    lastError.value = err?.response?.data?.message || err?.response?.data?.error || '上传失败'
  } finally {
    uploading.value = false
    stage.value = ''
  }
}

onMounted(load)
</script>

<template>
  <div>
    <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px">
      <template #title>
        传 Maker 发版时打的 web-template.zip（网页引擎 + 游戏代码，所有战役共用，只留最新一份）。
        游戏数据不用传：审核通过的战役自动出现在官网「在线游戏」页，玩家点开时网页版按战役去下作者「上传战役」传的那一版。
        要不要先登录在「战役管理」里逐条设。官方 exe 游戏（卖的那几款）不在网页版里。
        R2 桶要配 CORS（允许 GET），否则网页版卡在加载，部署后跑 <code>--check-r2</code> 查。
      </template>
    </el-alert>

    <div class="page-toolbar">
      <input ref="fileInput" type="file" accept=".zip" style="display: none" @change="upload" />
      <el-button type="primary" :loading="uploading" @click="pick">上传模板</el-button>
      <el-progress v-if="uploading && !stage" :percentage="progress" style="width: 280px" />
      <span v-if="uploading && stage" style="color: #909399">已传完，服务器正在处理：{{ stage }}……</span>
      <div class="spacer" />
      <el-button @click="load">刷新</el-button>
    </div>

    <el-alert
      v-if="lastError"
      type="error"
      :title="lastError"
      show-icon
      style="margin-bottom: 12px"
      @close="lastError = ''"
    />

    <el-card v-loading="loading" shadow="never">
      <el-empty v-if="!current" description="还没有上传过模板：官网「在线游戏」页暂时一个都玩不了" />
      <el-descriptions v-else :column="1" border>
        <el-descriptions-item label="版本标识">
          <span style="font-family: monospace">{{ current.dir }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="大小">{{ fmtBytes(current.size) }}</el-descriptions-item>
        <el-descriptions-item label="上传时间">{{ fmtDate(current.createdAt) }}</el-descriptions-item>
        <el-descriptions-item label="文件">
          <span style="font-family: monospace; font-size: 12px">{{ current.files.join('  ') }}</span>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>
