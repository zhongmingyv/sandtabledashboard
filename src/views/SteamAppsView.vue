<script setup>
// Steam 应用：这台服务器认哪几个 Steam 应用。玩家用 Steam 登录时，服务器拿那个应用的发行商密钥向 Steam 验票；
// 勾了「要求购买」的，再问 Steam 他买没买——Maker 本体（游戏编号空）没买又没激活码的进不了 Maker，
// 官方游戏没买的开不了桌、进不了桌。
// 游戏那几行在「游戏版本」上传整包时按包里的 Steam 应用编号自动建好，这里补密钥、开购买闸即可。
// 密钥只写不读：列表只显示末 4 位；修改时密钥留空 = 保留原来那把。
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api/admin'
import { fmtDate } from '../utils/format'

const loading = ref(false)
const rows = ref([])
const dialog = reactive({ visible: false, isNew: true, appId: '', gameId: '', webApiKey: '', requirePurchase: false, note: '' })
const saving = ref(false)

async function load() {
  loading.value = true
  try {
    rows.value = (await api.steamApps()).items
  } finally {
    loading.value = false
  }
}

function openNew() {
  Object.assign(dialog, { visible: true, isNew: true, appId: '', gameId: '', webApiKey: '', requirePurchase: false, note: '' })
}

function openEdit(row) {
  Object.assign(dialog, {
    visible: true, isNew: false, appId: row.appId, gameId: row.gameId, webApiKey: '',
    requirePurchase: row.requirePurchase, note: row.note,
  })
}

async function save() {
  if (!/^\d{1,10}$/.test(dialog.appId.trim())) {
    ElMessage.error('Steam 应用编号是一串数字')
    return
  }
  if (dialog.isNew && !dialog.webApiKey.trim()) {
    ElMessage.error('请填发行商密钥')
    return
  }
  saving.value = true
  try {
    await api.saveSteamApp(dialog.appId.trim(), {
      gameId: dialog.gameId.trim(),
      webApiKey: dialog.webApiKey.trim() || null,
      requirePurchase: dialog.requirePurchase,
      note: dialog.note.trim(),
    })
    ElMessage.success('已保存')
    dialog.visible = false
    load()
  } catch (err) {
    const code = err?.response?.data?.error
    ElMessage.error(code === 'maker_app_exists'
      ? `已经有一行 Maker 本体（${err.response.data.appId}）了，游戏编号不能再留空`
      : code || '保存失败')
  } finally {
    saving.value = false
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(
      `删除 Steam 应用 ${row.appId}？之后这个应用的玩家不能再用 Steam 登录${row.requirePurchase ? '，购买闸也一起撤掉' : ''}。`,
      '删除', { type: 'warning' },
    )
  } catch {
    return
  }
  await api.deleteSteamApp(row.appId)
  ElMessage.success('已删除')
  load()
}

onMounted(load)
</script>

<template>
  <div>
    <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px">
      <template #title>
        玩家用 Steam 登录时，服务器拿对应应用的发行商密钥（Steamworks「用户与权限 → 管理 Web API 密钥」）向 Steam 验证身份。
        「游戏编号」留空的那一行是 Maker 本体；勾「要求购买」后，没在 Steam 买、也没有激活码的账号进不了 Maker。
        游戏那几行在上传整包时按包里的应用编号自动建好；勾「要求购买」后，没买的玩家开不了桌、进不了桌。
      </template>
    </el-alert>

    <div class="page-toolbar">
      <el-button type="primary" @click="openNew">添加应用</el-button>
      <div class="spacer" />
      <el-button @click="load">刷新</el-button>
    </div>

    <el-table :data="rows" v-loading="loading" border>
      <el-table-column prop="appId" label="Steam 应用编号" width="150" />
      <el-table-column label="游戏编号" min-width="260">
        <template #default="{ row }">
          <el-tag v-if="row.isMaker" type="primary" size="small">Maker 本体</el-tag>
          <span v-else>{{ row.gameId }}</span>
        </template>
      </el-table-column>
      <el-table-column label="发行商密钥" width="130">
        <template #default="{ row }">
          <span v-if="row.hasKey">{{ row.keyHint }}</span>
          <el-tag v-else type="danger" size="small">未填</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="要求购买" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.requirePurchase" type="warning" size="small">是</el-tag>
          <span v-else style="color: #909399">否</span>
        </template>
      </el-table-column>
      <el-table-column prop="note" label="备注" min-width="120" />
      <el-table-column label="更新时间" width="150">
        <template #default="{ row }">{{ fmtDate(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">修改</el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialog.visible" :title="dialog.isNew ? '添加 Steam 应用' : '修改 Steam 应用'" width="520px">
      <el-form label-width="120px">
        <el-form-item label="Steam 应用编号">
          <el-input v-model="dialog.appId" :disabled="!dialog.isNew" placeholder="如 5099480" />
        </el-form-item>
        <el-form-item label="游戏编号">
          <el-input v-model="dialog.gameId" placeholder="留空 = Maker 本体；游戏填 camp_ 开头的编号" />
        </el-form-item>
        <el-form-item label="发行商密钥">
          <el-input v-model="dialog.webApiKey" type="password" show-password
                    :placeholder="dialog.isNew ? '' : '留空 = 不改'" />
        </el-form-item>
        <el-form-item label="要求购买">
          <el-switch v-model="dialog.requirePurchase" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="dialog.note" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
