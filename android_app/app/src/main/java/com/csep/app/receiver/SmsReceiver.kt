package com.csep.app.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import com.csep.app.data.api.RetrofitClient
import com.csep.app.data.model.SmsReceived
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

class SmsReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "SmsReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) return

        // 같은 번호에서 온 메시지 합치기 (긴 문자 분할 전송 대비)
        val phone = messages[0].originatingAddress ?: return
        val message = messages.joinToString("") { it.messageBody }
        val receivedAt = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)

        Log.d(TAG, "SMS 수신 - 번호: $phone, 내용: $message")

        // NAS 서버로 전송
        CoroutineScope(Dispatchers.IO).launch {
            try {
                RetrofitClient.api.notifyIncomingSms(
                    SmsReceived(phone = phone, message = message, receivedAt = receivedAt)
                )
                Log.d(TAG, "서버 전송 완료")
            } catch (e: Exception) {
                Log.e(TAG, "서버 전송 실패", e)
            }
        }
    }
}
