package com.csep.app.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.csep.app.service.CallMonitorService

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            val serviceIntent = Intent(context, CallMonitorService::class.java)
            context.startForegroundService(serviceIntent)
        }
    }
}
