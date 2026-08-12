package com.csep.engineer;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

public class App extends Application {

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;

        if (nm.getNotificationChannel("csep_silent") == null) {
            NotificationChannel ch = new NotificationChannel(
                "csep_silent", "CSEP 알림", NotificationManager.IMPORTANCE_HIGH);
            ch.setSound(null, null);
            ch.enableVibration(true);
            nm.createNotificationChannel(ch);
        }

        if (nm.getNotificationChannel("csep_alert") == null) {
            NotificationChannel alertCh = new NotificationChannel(
                "csep_alert", "CSEP 알림 (소리)", NotificationManager.IMPORTANCE_HIGH);
            Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.noti1);
            alertCh.setSound(soundUri, new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
            alertCh.enableVibration(true);
            nm.createNotificationChannel(alertCh);
        }
    }
}
