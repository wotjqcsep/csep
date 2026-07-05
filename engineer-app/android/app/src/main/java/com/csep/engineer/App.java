package com.csep.engineer;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;

public class App extends Application {

    @Override
    public void onCreate() {
        super.onCreate();
        createSilentChannel();
    }

    // 알림 표시용 무음 채널 (소리는 MediaPlayer가 처리 — 삼성 기본음 우회)
    private void createSilentChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (nm.getNotificationChannel("csep_silent") != null) return;

        NotificationChannel ch = new NotificationChannel(
            "csep_silent", "CSEP 알림", NotificationManager.IMPORTANCE_HIGH);
        ch.setSound(null, null);
        ch.enableVibration(true);
        nm.createNotificationChannel(ch);
    }
}
