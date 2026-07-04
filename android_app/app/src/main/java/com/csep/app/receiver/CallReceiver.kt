package com.csep.app.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.ContactsContract
import android.telephony.TelephonyManager
import android.util.Log
import com.csep.app.data.api.RetrofitClient
import com.csep.app.ui.call.CallOverlayActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class CallReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "CallReceiver"
        // 이 그룹에 속한 번호는 팝업 무시
        private val IGNORE_GROUPS = setOf("가족", "친구", "family", "friends", "Starred", "즐겨찾기")
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return
        val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
        if (state != TelephonyManager.EXTRA_STATE_RINGING) return

        val phone = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER) ?: return
        Log.d(TAG, "수신: $phone")

        val groups = getContactGroups(context, phone)
        Log.d(TAG, "그룹: $groups")

        // 무시 그룹이면 스킵
        if (groups.any { g -> IGNORE_GROUPS.any { g.contains(it, ignoreCase = true) } }) {
            Log.d(TAG, "무시 그룹 → 팝업 안 띄움")
            return
        }

        // 백엔드 전송 (PC 연동)
        CoroutineScope(Dispatchers.IO).launch {
            try { RetrofitClient.api.notifyIncomingCall(phone) } catch (e: Exception) { Log.e(TAG, "백엔드 전송 실패", e) }
        }

        // 오버레이 팝업
        context.startActivity(
            Intent(context, CallOverlayActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("phone", phone)
            }
        )
    }

    private fun getContactGroups(context: Context, phone: String): List<String> {
        val clean = phone.replace(Regex("[^0-9]"), "")
        return try {
            // 1. 전화번호 → contact_id
            val contactId = context.contentResolver.query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                arrayOf(
                    ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
                    ContactsContract.CommonDataKinds.Phone.NUMBER
                ),
                null, null, null
            )?.use { cursor ->
                while (cursor.moveToNext()) {
                    val stored = cursor.getString(1)?.replace(Regex("[^0-9]"), "") ?: continue
                    if (clean.takeLast(8) == stored.takeLast(8)) {
                        return@use cursor.getString(0)
                    }
                }
                null
            } ?: return emptyList()

            // 2. contact_id → group_id 목록
            val groupIds = mutableListOf<String>()
            context.contentResolver.query(
                ContactsContract.Data.CONTENT_URI,
                arrayOf(ContactsContract.CommonDataKinds.GroupMembership.GROUP_ROW_ID),
                "${ContactsContract.Data.CONTACT_ID} = ? AND ${ContactsContract.Data.MIMETYPE} = ?",
                arrayOf(contactId, ContactsContract.CommonDataKinds.GroupMembership.CONTENT_ITEM_TYPE),
                null
            )?.use { cursor ->
                while (cursor.moveToNext()) groupIds.add(cursor.getString(0))
            }

            if (groupIds.isEmpty()) return emptyList()

            // 3. group_id → group 이름
            val groups = mutableListOf<String>()
            val placeholders = groupIds.joinToString(",") { "?" }
            context.contentResolver.query(
                ContactsContract.Groups.CONTENT_URI,
                arrayOf(ContactsContract.Groups.TITLE),
                "${ContactsContract.Groups._ID} IN ($placeholders)",
                groupIds.toTypedArray(), null
            )?.use { cursor ->
                while (cursor.moveToNext()) cursor.getString(0)?.let { groups.add(it) }
            }
            groups
        } catch (e: Exception) {
            Log.e(TAG, "그룹 조회 실패", e)
            emptyList()
        }
    }
}
