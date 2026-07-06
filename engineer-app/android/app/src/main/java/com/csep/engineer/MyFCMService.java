package com.csep.engineer;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * data-only FCM 수신 → 커스텀 소리(MediaPlayer)로 재생하고 무음 채널로 배너 표시.
 * 삼성이 채널 소리를 덮어쓰는 문제를 MediaPlayer 직접 재생으로 우회.
 */
public class MyFCMService extends MessagingService {

    private static final String SILENT_CHANNEL_ID = "csep_silent";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        String title = "CSEP";
        String body = "";
        if (data != null && !data.isEmpty()) {
            if (data.containsKey("title")) title = data.get("title");
            if (data.containsKey("body")) body = data.get("body");
        } else if (remoteMessage.getNotification() != null) {
            RemoteMessage.Notification n = remoteMessage.getNotification();
            if (n.getTitle() != null) title = n.getTitle();
            if (n.getBody() != null) body = n.getBody();
        }

        // 웹(Capacitor Preferences)에서 저장한 선택 소리 (noti1~noti5)
        String pref = getSharedPreferences("CapacitorStorage", MODE_PRIVATE)
            .getString("csep_sound", "noti1");

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wl = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK, "csep:notification_sound");
        wl.acquire(8000);

        playSound(pref, wl);
        showNotification(title, body);
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
    }

    private void playSound(String pref, PowerManager.WakeLock wl) {
        int rawResId;
        switch (pref) {
            case "noti2": rawResId = R.raw.noti2; break;
            case "noti3": rawResId = R.raw.noti3; break;
            case "noti4": rawResId = R.raw.noti4; break;
            case "noti5": rawResId = R.raw.noti5; break;
            default:      rawResId = R.raw.noti1; break;
        }
        try {
            Uri uri = Uri.parse("android.resource://" + getPackageName() + "/" + rawResId);
            MediaPlayer mp = new MediaPlayer();
            mp.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
            mp.setDataSource(getApplicationContext(), uri);
            mp.prepare();
            mp.setOnCompletionListener(mediaPlayer -> {
                mediaPlayer.release();
                if (wl != null && wl.isHeld()) wl.release();
            });
            mp.start();
        } catch (Exception e) {
            if (wl != null && wl.isHeld()) wl.release();
        }
    }

    private void showNotification(String title, String body) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && nm.getNotificationChannel(SILENT_CHANNEL_ID) == null) {
            NotificationChannel ch = new NotificationChannel(
                SILENT_CHANNEL_ID, "CSEP 알림", NotificationManager.IMPORTANCE_HIGH);
            ch.setSound(null, null);
            ch.enableVibration(true);
            nm.createNotificationChannel(ch);
        }
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, intent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, SILENT_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pi);
        nm.notify((int) System.currentTimeMillis(), b.build());
    }
}
