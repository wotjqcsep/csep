package com.csep.app.data.model

import com.google.gson.annotations.SerializedName

data class Customer(
    val id: Int,
    val name: String,
    val phone: String,
    @SerializedName("phone2") val phone2: String?,
    @SerializedName("customer_type") val customerType: String,
    @SerializedName("company_name") val companyName: String?,
    @SerializedName("contact_person") val contactPerson: String?,
    val address: String?,
    val memo: String?,
    @SerializedName("outstanding_amount") val outstandingAmount: Double,
)

data class Reception(
    val id: Int,
    @SerializedName("customer_id") val customerId: Int,
    val symptom: String,
    val status: String,
    @SerializedName("reception_channel") val channel: String,
    @SerializedName("reception_phone") val receptionPhone: String?,
    @SerializedName("initial_memo") val initialMemo: String?,
    @SerializedName("assigned_engineer_id") val assignedEngineerId: Int?,
    @SerializedName("received_at") val receivedAt: String,
)

data class ReceptionCreate(
    @SerializedName("customer_id") val customerId: Int,
    val symptom: String,
    @SerializedName("reception_channel") val receptionChannel: String,
    @SerializedName("reception_phone") val receptionPhone: String?,
    @SerializedName("initial_memo") val initialMemo: String?,
)

data class Engineer(
    val id: Int,
    val name: String,
    val phone: String,
    val status: String,
    val location: String?,
)

data class IncomingCall(
    val id: Int,
    val phone: String,
    val customer: Customer?,
    @SerializedName("recent_receptions") val recentReceptions: List<Reception>,
    @SerializedName("received_at") val receivedAt: String,
)

data class DashboardData(
    @SerializedName("today_new") val todayNew: Int,
    @SerializedName("assigned_pending") val assignedPending: Int,
    @SerializedName("in_progress") val inProgress: Int,
    @SerializedName("completed_today") val completedToday: Int,
    @SerializedName("total_outstanding") val totalOutstanding: Double,
    val engineers: List<Engineer>,
    @SerializedName("pending_receptions") val pendingReceptions: List<Reception>,
)

// 전화 수신 시 연락처 그룹 체크용 (로컬)
data class ContactInfo(
    val name: String?,
    val groups: List<String>,
)

// SMS 수신 데이터 (앱 → NAS 서버)
data class SmsReceived(
    val phone: String,
    val message: String,
    @SerializedName("received_at") val receivedAt: String,
)
