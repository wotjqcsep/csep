package com.csep.engineer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;

import org.json.JSONObject;

import java.net.HttpURLConnection;
import java.net.URL;

/**
 * SMS 수신 → 대표 로그인 상태면 서버(/incoming-sms)로 전송.
 */
public class SmsReceiver extends BroadcastReceiver {
    private static final String TAG = "SmsReceiver";
    private static final String API = "https://csep-cf37.onrender.com/api";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) return;
        if (!isBoss(context)) return;
        Bundle bundle = intent.getExtras();
        if (bundle == null) return;
        Object[] pdus = (Object[]) bundle.get("pdus");
        if (pdus == null || pdus.length == 0) return;
        String format = bundle.getString("format");
        StringBuilder body = new StringBuilder();
        String phone = null;
        for (Object pdu : pdus) {
            SmsMessage sms = SmsMessage.createFromPdu((byte[]) pdu, format);
            if (phone == null) phone = sms.getOriginatingAddress();
            body.append(sms.getMessageBody());
        }
        postSms(context, phone, body.toString());
    }

    private boolean isBoss(Context ctx) {
        // boolean 플래그 우선 — 한글 리터럴은 빌드 인코딩에 따라 깨질 수 있어 폴백으로만 쓴다.
        String isBoss = Prefs.get(ctx, "csep_is_boss", "");
        if (!isBoss.isEmpty()) return "1".equals(isBoss);
        return "대표".equals(Prefs.get(ctx, "csep_role", "none"));
    }

    private void postSms(Context ctx, final String phone, final String message) {
        final Context app = ctx.getApplicationContext();
        new Thread(new Runnable() {
            public void run() {
                try {
                    JSONObject b = new JSONObject();
                    b.put("phone", phone == null ? "" : phone);
                    b.put("message", message);
                    b.put("received_at", new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss").format(new java.util.Date()));
                    URL url = new URL(API + "/incoming-sms");
                    HttpURLConnection c = (HttpURLConnection) url.openConnection();
                    c.setRequestMethod("POST");
                    c.setRequestProperty("Content-Type", "application/json");
                    // 2026-08-11 서버 전역 인증 도입 이후 토큰 없는 요청은 401로 버려졌다.
                    Prefs.auth(app, c);
                    c.setConnectTimeout(10000);
                    c.setReadTimeout(10000);
                    c.setDoOutput(true);
                    c.getOutputStream().write(b.toString().getBytes("UTF-8"));
                    int code = c.getResponseCode();
                    Log.d(TAG, "incoming-sms POST " + code);
                    if (code < 200 || code >= 300) Prefs.remoteLog(API, "SMS_POST_FAIL", "HTTP " + code);
                    c.disconnect();
                } catch (Exception e) {
                    Log.e(TAG, "post fail", e);
                    Prefs.remoteLog(API, "SMS_POST_FAIL", String.valueOf(e.getMessage()));
                }
            }
        }).start();
    }
}
