package com.csep.app.data.api

import com.csep.app.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    @GET("customers")
    suspend fun getCustomers(): Response<List<Customer>>

    @GET("receptions")
    suspend fun getReceptions(@Query("status") status: String? = null): Response<List<Reception>>

    @POST("receptions")
    suspend fun createReception(@Body body: ReceptionCreate): Response<Reception>

    @PUT("receptions/{id}/assign")
    suspend fun assignReception(
        @Path("id") id: Int,
        @Query("engineer_id") engineerId: Int,
    ): Response<Reception>

    @PUT("receptions/{id}/status")
    suspend fun updateReceptionStatus(
        @Path("id") id: Int,
        @Query("status") status: String,
    ): Response<Reception>

    @GET("engineers")
    suspend fun getEngineers(): Response<List<Engineer>>

    @GET("dashboard")
    suspend fun getDashboard(): Response<DashboardData>

    // 전화 수신 알림 (Android 앱 → 백엔드 → PC 팝업). CallReceiver 에서만 호출
    @POST("incoming-call")
    suspend fun notifyIncomingCall(@Query("phone") phone: String): Response<IncomingCall>

    // 고객 조회 전용 (팝업 생성 안 함). 폰 오버레이가 고객정보 표시용으로 사용
    @GET("customer-lookup")
    suspend fun lookupCustomer(@Query("phone") phone: String): Response<IncomingCall>

    // SMS 수신 알림 (Android 앱 → 백엔드 → PC 자동접수)
    @POST("incoming-sms")
    suspend fun notifyIncomingSms(@Body body: SmsReceived): Response<Unit>
}
