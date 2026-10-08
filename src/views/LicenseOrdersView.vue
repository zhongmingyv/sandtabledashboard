<script setup>
// 激活码订单：echoshorts.win 卖出的 Maker 激活码。发码、发邮件都在激活码 worker 那边做完了，
// 这里只看「谁买了、码是什么、激活到了哪个账号」。退款 / 补发邮件仍到 echoshorts.win 的后台处理。
import { ref, onMounted } from 'vue'
import { api } from '../api/admin'
import { fmtDate } from '../utils/format'
const loading = ref(false), rows = ref([]), q = ref('')
async function load() { loading.value = true; try { rows.value = (await api.licenseOrders({ search: q.value })).items } finally { loading.value = false } }
onMounted(load)
</script>
<template><div>
  <el-input v-model="q" placeholder="邮箱、激活码或订单号" clearable style="width:280px" @keyup.enter="load" />
  <el-button style="margin-left:8px" @click="load">查询</el-button>
  <span style="margin-left:12px;color:#909399;font-size:13px">最近 500 单 · 共 {{ rows.length }} 单</span>
  <el-table :data="rows" v-loading="loading" border style="margin-top:16px">
    <el-table-column label="下单时间" width="180"><template #default="{row}">{{ fmtDate(row.orderCreatedAt || row.receivedAt) }}</template></el-table-column>
    <el-table-column prop="email" label="买家邮箱" min-width="200" />
    <el-table-column prop="licenseKey" label="激活码" width="220" />
    <el-table-column label="激活账号" min-width="200">
      <template #default="{row}">
        <span v-if="row.activatedBy">{{ row.activatedBy.displayName }}（{{ row.activatedBy.email }}）</span>
        <el-tag v-else type="info" size="small">未激活</el-tag>
      </template>
    </el-table-column>
    <el-table-column prop="discountCode" label="优惠码" width="110" />
    <el-table-column prop="lang" label="语言" width="70" />
    <el-table-column prop="orderId" label="订单号" min-width="280" />
  </el-table>
</div></template>
