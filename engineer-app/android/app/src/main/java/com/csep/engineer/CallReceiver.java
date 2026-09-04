package com.csep.engineer;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.telephony.TelephonyManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;

/**
 * 전화 상태 감지 — 통화 종료 후(RINGING/OFFHOOK → IDLE) 대표 로그인 상태면
 * 서버(/incoming-call)로 전송하고 앱을 깨워 등록/취소 팝업을 유도한다.
 */
public class CallReceiver extends BroadcastReceiver {
    private static final String TAG = "CallReceiver";
    private static final String API = "https://csep-cf37.onrender.com/api";
    private static final String CH = "csep_incoming";
    private static String lastState = TelephonyManager.EXTRA_STATE_IDLE;
    private static String incomingNumber = null;
    private static boolean sawRinging = false;   // 이번 통화가 '수신'인지 (발신 제외)

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!TelephonyManager.ACTION_PHONE_STATE_CHANGED.equals(intent.getAction())) return;
        String state = intent.getStringExtra(TelephonyManager.EXTRA_STATE);
        if (state == null) return;
        String num = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER);
        if (num != null && !num.isEmpty()) incomingNumber = num;
        Log.d(TAG, "state=" + state + " last=" + lastState + " num=" + incomingNumber + " ring=" + sawRinging + " boss=" + isBoss(context));

        if (TelephonyManager.EXTRA_STATE_RINGING.equals(state)) {
            // 수신 전화만 RINGING을 거침 → 발신은 여기 안 들어옴
            sawRinging = true;
            lastState = state;
        } else if (TelephonyManager.EXTRA_STATE_IDLE.equals(state)) {
            boolean wasIncoming = sawRinging;   // RINGING을 거친 통화(=수신)만 반응
            String phone = incomingNumber;
            lastState = state;
            incomingNumber = null;
            sawRinging = false;
            Log.d(TAG, "IDLE 도달 wasIncoming=" + wasIncoming + " phone=" + phone);
            if (wasIncoming && isBoss(context)) {
                String p = (phone == null || phone.isEmpty()) ? "unknown" : phone;
                postIncomingCall(context, p);
                notifyIncoming(context, p);
                bringForeground(context);
            }
        } else {
            // OFFHOOK (통화중/발신) — sawRinging은 그대로 유지
            lastState = state;
        }
    }

    private boolean isBoss(Context ctx) {
        // 대표 판정은 boolean 플래그를 우선 사용한다.
        // 예전엔 "대표" 한글 리터럴만 비교했는데, 빌드 인코딩(javac 기본 charset)이
        // UTF-8이 아니면 리터럴이 깨져서 영원히 false가 되는 위험이 있었다.
        String isBoss = Prefs.get(ctx, "csep_is_boss", "");
        if (!isBoss.isEmpty()) return "1".equals(isBoss);
        String role = Prefs.get(ctx, "csep_role", "none");
        Log.d(TAG, "csep_role=" + role);
        return "대표".equals(role);   // "대표" (인코딩 안전 표기)
    }

    private void postIncomingCall(Context ctx, final String phone) {
        final Context app = ctx.getApplicationContext();
        new Thread(new Runnable() {
            public void run() {
                try {
                    URL url = new URL(API + "/incoming-call?phone=" + URLEncoder.encode(phone, "UTF-8"));
                    HttpURLConnection c = (HttpURLConnection) url.openConnection();
                    c.setRequestMethod("POST");
                    c.setRequestProperty("Content-Type", "application/json");
                    // 2026-08-11 서버에 /api 전역 인증이 도입되면서 토큰 없는 요청은 401로 버려졌다.
                    Prefs.auth(app, c);
                    c.setConnectTimeout(10000);
                    c.setReadTimeout(10000);
                    c.setDoOutput(true);
                    c.getOutputStream().write("{}".getBytes("UTF-8"));
                    int code = c.getResponseCode();
                    Log.d(TAG, "incoming-call POST " + code);
                    if (code < 200 || code >= 300) Prefs.remoteLog(API, "CALL_POST_FAIL", "HTTP " + code + " (phone=" + phone + ")");
                    c.disconnect();
                } catch (Exception e) {
                    Log.e(TAG, "post fail", e);
                    Prefs.remoteLog(API, "CALL_POST_FAIL", String.valueOf(e.getMessage()));
                }
            }
        }).start();
    }

    private void notifyIncoming(Context ctx, String phone) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CH, "전화 수신", NotificationManager.IMPORTANCE_HIGH);
            nm.createNotificationChannel(ch);
        }
        Intent i = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (i == null) i = new Intent(ctx, MainActivity.class);   // null 이면 PendingIntent 생성 시 예외
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new NotificationCompat.Builder(ctx, CH)
                .setContentTitle("📞 전화 수신")
                .setContentText(phone + " — 탭하여 등록/취소")
                .setSmallIcon(android.R.drawable.ic_menu_call)
                .setContentIntent(pi)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .build();
        nm.notify(2001, n);
    }

    private void bringForeground(Context ctx) {
        try {
            Intent i = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
            if (i != null) {
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
                ctx.startActivity(i);
            }
        } catch (Exception e) { /* Android 백그라운드 실행 제한 시 알림으로 대체 */ }
    }
}
