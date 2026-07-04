package com.csep.app.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.csep.app.ui.MainActivity

/**
 * 포그라운드 서비스 — 앱이 백그라운드에 있어도 전화 감지 유지
 * BroadcastReceiver(CallReceiver)가 실제 감지를 담당하고,
 * 이 서비스는 시스템이 앱을 종료하지 않도록 살아있는 역할만 함
 */
class CallMonitorService : Service() {

    companion object {
        const val CHANNEL_ID = "csep_monitor"
        const val NOTIF_ID = 1001
    }

    override fun onCreate() {
        super.onCreate()
        createChannel()
        startForeground(NOTIF_ID, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY  // 시스템이 종료해도 자동 재시작
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "CSEP 전화 감지",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "전화 수신 시 고객 자동 조회"
            setShowBadge(false)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        val tapIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("CSEP 실행 중")
            .setContentText("전화 수신 시 고객 정보를 자동으로 조회합니다")
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentIntent(tapIntent)
            .setOngoing(true)
            .build()
    }
}
